(() => {
  "use strict";
  const PREFIX = "loa.save.v1:";
  const MAX_SIZE = 512 * 1024;
  const messages = {
    unavailable: "브라우저 저장이 차단되어 이번 플레이는 저장되지 않아요.",
    unsupported: "자동 저장에는 최신 브라우저와 HTTPS 접속이 필요해요.",
    busy: "다른 탭에서 이 게임을 플레이 중이에요. 그 탭을 닫고 다시 열어 주세요.",
    corrupt: "기존 저장을 읽지 못했어요. 원본은 보관되어 있어요. 저장 삭제 후 새로 시작할 수 있어요.",
    conflict: "다른 탭에서 저장이 변경되었어요. 새로 열어 최신 저장을 불러와 주세요.",
    quota: "브라우저 저장 공간이 부족해요. 마지막 저장 이후 진행은 저장되지 않았어요.",
    invalid: "진행도를 저장하지 못했어요. 마지막으로 저장된 진행은 유지돼요.",
  };
  function failure(code) { return Object.assign(new Error(messages[code]), { code }); }
  function keyFor(id) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw failure("invalid");
    return PREFIX + id;
  }
  function validateEntries(entries) {
    if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw failure("invalid");
    const pairs = Object.entries(entries);
    if (pairs.length > 128 || pairs.some(([k, v]) => k.length > 200 || typeof v !== "string")) throw failure("invalid");
    if (JSON.stringify(entries).length > MAX_SIZE) throw failure("quota");
    return entries;
  }
  // Detect damaged local records before invoking a game restore or overwriting them.
  function checksum(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
    return (hash >>> 0).toString(16);
  }
  function createStore(storage) {
    function read(id) {
      let raw;
      try { raw = storage.getItem(keyFor(id)); } catch { throw failure("unavailable"); }
      if (raw === null) return { raw: null, revision: 0, entries: {}, updatedAt: null };
      try {
        const record = JSON.parse(raw);
        if (record.schema !== 1 || !Number.isSafeInteger(record.revision) || record.revision < 1 ||
            typeof record.updatedAt !== "string" || record.checksum !== checksum(JSON.stringify(record.entries))) throw failure("corrupt");
        validateEntries(record.entries);
        return { ...record, raw };
      } catch { throw failure("corrupt"); }
    }
    function write(id, previous, entries) {
      validateEntries(entries);
      const current = read(id);
      if (current.raw !== previous.raw) throw failure("conflict");
      const record = { schema: 1, revision: previous.revision + 1, updatedAt: new Date().toISOString(), entries,
        checksum: checksum(JSON.stringify(entries)) };
      const raw = JSON.stringify(record);
      try { storage.setItem(keyFor(id), raw); }
      catch (error) { throw failure(error.name === "QuotaExceededError" ? "quota" : "unavailable"); }
      return { ...record, raw };
    }
    function remove(id) {
      try { storage.removeItem(keyFor(id)); } catch { throw failure("unavailable"); }
    }
    return { read, write, remove };
  }
  async function acquire(id) {
    if (!navigator.locks) throw failure("unsupported");
    return new Promise((resolve, reject) => {
      navigator.locks.request(keyFor(id), { ifAvailable: true }, async (lock) => {
        if (!lock) { reject(failure("busy")); return; }
        await new Promise((release) => resolve(release));
      }).catch(reject);
    });
  }
  function connect({ frame, id, nonce, onStatus, onReady, onError }) {
    let closed = false, closing, port, release, store, record, sequence = 0, flushCounter = 0;
    const pendingFlushes = new Map();
    let writable = true;
    const status = (kind, text) => { if (!closed) onStatus(kind, text); };
    const ready = (async () => {
      try {
        release = await acquire(id);
        if (closed) { release(); return false; }
        store = createStore(window.localStorage);
        record = store.read(id);
        status("ready", record.updatedAt ? "이 브라우저의 저장을 불러왔어요." : "이 브라우저에 자동 저장해요.");
        return true;
      } catch (error) {
        const message = messages[error.code] || messages.unavailable;
        status("error", message);
        // Never start from defaults over a damaged save or an active writer.
        if (!closed) onError(message);
        return false;
      }
    })();
    async function hello(event) {
      if (closed || port || event.source !== frame.contentWindow || event.data?.source !== "loa-save" ||
          event.data.type !== "hello" || event.data.nonce !== nonce || event.data.protocol !== 1) return;
      if (!await ready || closed || port) return;
      const channel = new MessageChannel();
      port = channel.port1;
      port.onmessage = ({ data }) => {
        if (closed || !data || typeof data !== "object") return;
        if (data.type === "ready") { onReady(); return; }
        if (data.type === "error") { onError("게임 실행 중 오류가 발생했어요. 다시 열어 주세요."); return; }
        if (data.type === "restore-error") {
          writable = false;
          status("error", messages.corrupt);
          onError(messages.corrupt);
          return;
        }
        if (data.type === "snapshot" && Number.isSafeInteger(data.sequence) && data.sequence > sequence && writable) {
          sequence = data.sequence;
          try {
            record = store.write(id, record, data.entries);
            status("saved", "이 브라우저에 저장됨");
            port.postMessage({ type: "saved", sequence });
          } catch (error) {
            if (["conflict", "corrupt"].includes(error.code)) writable = false;
            status("error", error.message);
            port.postMessage({ type: "save-error", sequence });
          }
        }
        if (data.type === "flushed") pendingFlushes.get(data.requestId)?.();
      };
      frame.contentWindow.postMessage({ source: "loa-save", type: "init", protocol: 1, nonce, entries: record.entries }, "*", [channel.port2]);
    }
    window.addEventListener("message", hello);
    return {
      async flush() {
        if (!port || closed) return;
        await new Promise((resolve) => {
          const requestId = ++flushCounter;
          const done = () => { clearTimeout(timer); pendingFlushes.delete(requestId); resolve(); };
          const timer = setTimeout(done, 1200);
          pendingFlushes.set(requestId, done);
          port.postMessage({ type: "flush", requestId });
        });
      },
      close() {
        if (!closing) closing = (async () => {
          await this.flush();
          closed = true;
          window.removeEventListener("message", hello);
          port?.close();
          release?.();
        })();
        return closing;
      },
    };
  }
  async function remove(id) {
    const release = await acquire(id);
    try { createStore(window.localStorage).remove(id); } finally { release(); }
  }
  globalThis.LoaSaveStore = { createStore, connect, remove, keyFor, MAX_SIZE };
})();
