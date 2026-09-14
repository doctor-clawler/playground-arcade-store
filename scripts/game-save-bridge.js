(() => {
  "use strict";
  if (parent === window) {
    const portal = new URL("../../", document.currentScript.src);
    portal.hash = `game/${document.currentScript.dataset.game}`;
    location.replace(portal.href);
    return;
  }
  const nonce = new URLSearchParams(location.hash.slice(1)).get("loa-session");
  const checkpointKey = "__loa_checkpoint_v1";
  let entries = new Map(), port, adapter, stopped = false, started = false, sequence = 0;
  let changed = false, scheduled = false, lastCheckpoint = null;
  const send = (message) => port?.postMessage(message);
  const storage = {
    get length() { return entries.size; },
    key(index) { return [...entries.keys()][Number(index)] ?? null; },
    getItem(key) { return entries.get(String(key)) ?? null; },
    setItem(key, value) {
      key = String(key); value = String(value);
      if (entries.get(key) === value) return;
      entries.set(key, value); changed = true; schedule();
    },
    removeItem(key) { if (entries.delete(String(key))) { changed = true; schedule(); } },
    clear() { entries.clear(); changed = true; lastCheckpoint = null; schedule(); },
  };
  function capture() {
    if (stopped || !started) return;
    try {
      if (adapter) {
        const value = JSON.stringify({ version: adapter.version, data: adapter.capture() });
        if (value !== lastCheckpoint) {
          lastCheckpoint = value;
          entries.set(checkpointKey, value); changed = true;
        }
      }
      if (changed) {
        changed = false;
        send({ type: "snapshot", sequence: ++sequence, entries: Object.fromEntries(entries) });
      }
    } catch {
      stopped = true;
      send({ type: "restore-error" });
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => { scheduled = false; capture(); }, 0);
  }
  window.LoaSave = {
    storage,
    restoreObject(target, saved) {
      if (!saved || typeof saved !== "object" || Array.isArray(saved)) throw new Error("Invalid checkpoint");
      for (const [key, value] of Object.entries(target)) {
        if (!(key in saved) || (value !== null && (Array.isArray(value) ? !Array.isArray(saved[key]) : typeof value !== typeof saved[key]))) {
          throw new Error(`Invalid checkpoint field: ${key}`);
        }
      }
      for (const key of Object.keys(saved)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("Invalid checkpoint key");
      }
      Object.assign(target, saved);
      return target;
    },
    flush: capture,
    register(value) {
      if (adapter) throw new Error("Only one save adapter per game is allowed");
      adapter = value;
      try {
        const raw = storage.getItem(checkpointKey);
        if (raw !== null) {
          const checkpoint = JSON.parse(raw);
          if (checkpoint.version !== adapter.version) throw new Error("Save version needs migration");
          adapter.restore(checkpoint.data);
          lastCheckpoint = raw;
        }
      } catch {
        stopped = true;
        send({ type: "restore-error" });
        throw new Error("Saved progress could not be restored");
      }
    },
  };
  // Opaque-origin frames still cannot reach portal storage or other games.
  Object.defineProperty(window, "localStorage", { value: storage, configurable: false });
  async function boot(event) {
    if (port || event.source !== parent || event.data?.source !== "loa-save" || event.data.type !== "init" ||
        event.data.nonce !== nonce || event.data.protocol !== 1 || !event.ports[0]) return;
    port = event.ports[0];
    entries = new Map(Object.entries(event.data.entries));
    port.onmessage = ({ data }) => {
      if (data?.type === "flush") { capture(); send({ type: "flushed", requestId: data.requestId }); }
      if (data?.type === "save-error") changed = true;
    };
    try {
      for (const placeholder of document.querySelectorAll("script[data-loa-src]")) {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = placeholder.dataset.loaSrc;
          script.async = false;
          script.onload = resolve;
          script.onerror = reject;
          placeholder.replaceWith(script);
        });
      }
      if (stopped) return;
      started = true;
      capture();
      send({ type: "ready" });
      setInterval(capture, 1000);
      for (const type of ["click", "pointerup", "keyup", "change", "submit"]) document.addEventListener(type, schedule, true);
      document.addEventListener("visibilitychange", capture);
      window.addEventListener("pagehide", capture);
    } catch { send({ type: "error" }); }
  }
  window.addEventListener("message", boot);
  window.addEventListener("error", () => send({ type: "error" }));
  window.addEventListener("unhandledrejection", () => send({ type: "error" }));
  if (parent !== window && nonce) parent.postMessage({ source: "loa-save", type: "hello", protocol: 1, nonce }, "*");
})();
