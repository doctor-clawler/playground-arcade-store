import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertRegularFile,
  assertSafeId,
  playgroundRoot,
  publicGame,
  publicRoot,
  readManifest,
  resolveInside
} from "./lib.mjs";

const allowedExtensions = new Set([".html", ".css", ".js", ".mjs", ".json", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".woff2"]);
const bridge = `\n<script src="./store-bridge.js"></script>\n`;
const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src http: https:; style-src http: https: 'unsafe-inline'; img-src http: https: data:; font-src http: https:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
const bridgeSource = `(() => {\n  const send = (type, detail = {}) => {\n    if (window.parent !== window) window.parent.postMessage({ source: "playground-game", type, detail }, "*");\n  };\n  window.addEventListener("load", () => send("ready", { title: document.title }));\n  window.addEventListener("error", (event) => send("error", { message: event.message || "게임 리소스 오류" }));\n  window.addEventListener("unhandledrejection", (event) => send("error", { message: String(event.reason || "게임 실행 오류") }));\n  document.addEventListener("keydown", (event) => {\n    if (event.key.toLowerCase() === "f") {\n      event.preventDefault();\n      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();\n      else document.exitFullscreen?.();\n    }\n  });\n})();\n`;
const storageFallback = `const __storeMemory = new Map();\nconst safeStorage = {\n  getItem(key) { try { return window.localStorage.getItem(key); } catch { return __storeMemory.get(key) ?? null; } },\n  setItem(key, value) { try { window.localStorage.setItem(key, value); } catch { __storeMemory.set(key, String(value)); } }\n};\n`;

function stripModuleSyntax(source) {
  return source
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?\s*/g, "")
    .replace(/\bexport\s+(?=(?:const|let|var|function|class)\b)/g, "");
}

export async function syncGames() {
  const manifest = await readManifest();
  const games = manifest.games;
  if (!Array.isArray(games) || games.length < 3) throw new Error("At least three games are required");

  await mkdir(path.join(publicRoot, "assets"), { recursive: true });
  await rm(path.join(publicRoot, "games"), { recursive: true, force: true });
  await mkdir(path.join(publicRoot, "games"), { recursive: true });

  const ids = new Set();
  for (const game of games) {
    assertSafeId(game.id);
    if (ids.has(game.id)) throw new Error(`Duplicate game id: ${game.id}`);
    ids.add(game.id);

    const sourceRoot = resolveInside(playgroundRoot, game.sourcePath, `${game.id} sourcePath`);
    const destinationRoot = resolveInside(path.join(publicRoot, "games"), game.id, `${game.id} destination`);
    await mkdir(destinationRoot, { recursive: true });

    for (const relativeFile of game.bundleFiles) {
      const extension = path.extname(relativeFile).toLowerCase();
      if (!allowedExtensions.has(extension)) throw new Error(`Blocked extension for ${game.id}: ${relativeFile}`);
      const sourceFile = resolveInside(sourceRoot, relativeFile, `${game.id} bundle file`);
      const destinationFile = resolveInside(destinationRoot, relativeFile, `${game.id} output file`);
      await assertRegularFile(sourceFile, `${game.id}/${relativeFile}`);
      await mkdir(path.dirname(destinationFile), { recursive: true });
      await cp(sourceFile, destinationFile, { dereference: false, force: true });
    }

    const entryFile = resolveInside(destinationRoot, game.entry, `${game.id} entry`);
    let html = await readFile(entryFile, "utf8");
    if (game.classicBundle) {
      const parts = [];
      for (const relativeFile of game.classicBundle.sources) {
        const sourceFile = resolveInside(sourceRoot, relativeFile, `${game.id} classic source`);
        parts.push(stripModuleSyntax(await readFile(sourceFile, "utf8")));
      }
      let bundle = parts.join("\n\n");
      if (game.classicBundle.storageFallback) {
        bundle = `${storageFallback}\n${bundle.replaceAll("localStorage.", "safeStorage.")}`;
      }
      const bundleOutput = resolveInside(destinationRoot, game.classicBundle.output, `${game.id} classic output`);
      await writeFile(bundleOutput, bundle);
      const escapedScript = game.classicBundle.replaceScript.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      html = html.replace(new RegExp(`<script\\s+type=["']module["']\\s+src=["']${escapedScript}["']\\s*><\\/script>`, "i"), `<script src="./${game.classicBundle.output}"></script>`);
    }
    if (!html.includes("Content-Security-Policy")) html = html.replace(/<head([^>]*)>/i, `<head$1>\n    ${csp}`);
    if (!html.includes("store-bridge.js")) html = html.replace(/<\/body>/i, `${bridge}</body>`);
    await writeFile(entryFile, html);
    await writeFile(path.join(destinationRoot, "store-bridge.js"), bridgeSource);

    const thumbnailSource = resolveInside(playgroundRoot, game.thumbnailSource, `${game.id} thumbnail`);
    await assertRegularFile(thumbnailSource, `${game.id} thumbnail`);
    await cp(thumbnailSource, path.join(publicRoot, "assets", `thumb-${game.id}.png`), { force: true });
  }

  const catalog = games.map(publicGame);
  await writeFile(path.join(publicRoot, "catalog.json"), `${JSON.stringify({ version: manifest.storeVersion, games: catalog }, null, 2)}\n`);
  await writeFile(path.join(publicRoot, "catalog.js"), `window.PLAYGROUND_CATALOG = ${JSON.stringify({ version: manifest.storeVersion, games: catalog })};\n`);
  await writeFile(path.join(publicRoot, "version.json"), `${JSON.stringify({ version: manifest.storeVersion, builtAt: new Date().toISOString() }, null, 2)}\n`);
  return catalog;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const catalog = await syncGames();
  console.log(`Synced ${catalog.length} games`);
}
