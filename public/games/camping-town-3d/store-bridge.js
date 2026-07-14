(() => {
  const send = (type, detail = {}) => {
    if (window.parent !== window) window.parent.postMessage({ source: "playground-game", type, detail }, "*");
  };
  window.addEventListener("load", () => send("ready", { title: document.title }));
  window.addEventListener("error", (event) => send("error", { message: event.message || "게임 리소스 오류" }));
  window.addEventListener("unhandledrejection", (event) => send("error", { message: String(event.reason || "게임 실행 오류") }));
  document.addEventListener("keydown", (event) => {
    if (event.key.toLowerCase() === "f") {
      event.preventDefault();
      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
      else document.exitFullscreen?.();
    }
  });
})();
