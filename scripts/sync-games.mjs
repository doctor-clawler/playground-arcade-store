import { access, cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertRegularFile,
  assertRealPathInside,
  assertSafeId,
  manifestPath,
  playgroundRoot,
  projectRoot,
  publicGame,
  publicRoot,
  readManifest,
  resolveInside
} from "./lib.mjs";
import { validateBuild } from "./validate.mjs";

const allowedExtensions = new Set([".html", ".css", ".js", ".mjs", ".json", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".woff2"]);
const bridge = `\n<script src="./store-bridge.js"></script>\n`;
const csp = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src http: https:; style-src http: https: 'unsafe-inline'; img-src http: https: data:; font-src http: https:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">`;
const bridgeSource = `(() => {\n  const send = (type, detail = {}) => {\n    if (window.parent !== window) window.parent.postMessage({ source: "playground-game", type, detail }, "*");\n  };\n  window.addEventListener("load", () => send("ready", { title: document.title }));\n  window.addEventListener("error", (event) => send("error", { message: event.message || "게임 리소스 오류" }));\n  window.addEventListener("unhandledrejection", (event) => send("error", { message: String(event.reason || "게임 실행 오류") }));\n  document.addEventListener("keydown", (event) => {\n    if (event.key.toLowerCase() === "f") {\n      event.preventDefault();\n      if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();\n      else document.exitFullscreen?.();\n    }\n  });\n})();\n`;
const storageFallback = `const __storeMemory = new Map();\nconst safeStorage = {\n  getItem(key) { try { return window.localStorage.getItem(key); } catch { return __storeMemory.get(key) ?? null; } },\n  setItem(key, value) { try { window.localStorage.setItem(key, value); } catch { __storeMemory.set(key, String(value)); } },\n  removeItem(key) { try { window.localStorage.removeItem(key); } catch { __storeMemory.delete(key); } },\n  clear() { try { window.localStorage.clear(); } catch { __storeMemory.clear(); } }\n};\n`;

function stripModuleSyntax(source) {
  return source
    .replace(/import\s*\{[\s\S]*?\}\s*from\s*["'][^"']+["'];?\s*/g, "")
    .replace(/\bexport\s+(?=(?:const|let|var|function|class)\b)/g, "");
}

function replaceScript(html, sourcePath, replacement, { moduleOnly = false } = {}) {
  let replaced = false;
  const next = html.replace(/<script\b([^>]*)\bsrc=["']([^"']+)["']([^>]*)><\/script>/gi, (tag, before, src, after) => {
    if (src !== sourcePath || (moduleOnly && !/\btype=["']module["']/i.test(`${before} ${after}`))) return tag;
    replaced = true;
    return replacement;
  });
  if (!replaced) throw new Error(`Script not found in entry: ${sourcePath}`);
  return next;
}

function normalizeRootRelativeAssets(html) {
  return html.replace(/\b(src|href)=(['"])\/(?!\/)/gi, "$1=$2./");
}

function inlineStylesheet(html, sourcePath, css) {
  const normalizedSource = sourcePath.replace(/^\.\//, "").replace(/^\//, "");
  const selfContainedCss = css.replace(/@import\s+(?:url\()?['"]?https?:\/\/[^;]+;/gi, "");
  let replaced = false;
  const next = html.replace(/<link\b([^>]*)\bhref=["']([^"']+)["']([^>]*)>/gi, (tag, before, href) => {
    const normalizedHref = href.replace(/^\.\//, "").replace(/^\//, "");
    if (normalizedHref !== normalizedSource || !/\brel=["']stylesheet["']/i.test(before)) return tag;
    replaced = true;
    return `<style>\n${selfContainedCss}\n</style>`;
  });
  if (!replaced) throw new Error(`Stylesheet not found in entry: ${sourcePath}`);
  return next;
}

async function pathExists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function recoverInterruptedPublishes(localRoot) {
  const entries = await readdir(localRoot, { withFileTypes: true });
  const transactions = entries
    .filter((entry) => entry.isDirectory() && /^publish-\d+-\d+$/.test(entry.name))
    .map((entry) => path.join(localRoot, entry.name))
    .sort();

  for (const transactionRoot of transactions) {
    const backupRoot = path.join(transactionRoot, "public-previous");
    if (await pathExists(backupRoot)) {
      let liveMatchesManifest = false;
      if (await pathExists(publicRoot)) {
        try {
          await validateBuild();
          liveMatchesManifest = true;
        } catch {
          liveMatchesManifest = false;
        }
      }
      if (!liveMatchesManifest) {
        await rm(publicRoot, { recursive: true, force: true });
        await rename(backupRoot, publicRoot);
      }
    }
    await rm(transactionRoot, { recursive: true, force: true });
  }
}

async function acquireRecoveryGuard(recoveryRoot) {
  const recoveryOwnerPath = path.join(recoveryRoot, "owner.json");
  try {
    await mkdir(recoveryRoot);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const ageMs = Date.now() - (await stat(recoveryRoot)).mtimeMs;
    let owner = null;
    try { owner = JSON.parse(await readFile(recoveryOwnerPath, "utf8")); } catch { owner = null; }
    if (processIsAlive(owner?.pid)) throw new Error(`Publish recovery already running in process ${owner.pid}`);
    if (!owner && ageMs < 300_000) {
      throw new Error("Publish recovery already running or was recently interrupted; retry shortly");
    }
    await rm(recoveryRoot, { recursive: true, force: true });
    await mkdir(recoveryRoot);
  }
  await writeFile(recoveryOwnerPath, `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`);
}

async function acquirePublishLock() {
  const localRoot = path.join(projectRoot, ".local");
  const lockRoot = path.join(localRoot, "publish.lock");
  const recoveryRoot = path.join(localRoot, "publish-recovery.lock");
  const ownerPath = path.join(lockRoot, "owner.json");
  const token = `${process.pid}-${Date.now()}`;
  await mkdir(localRoot, { recursive: true });

  try {
    await mkdir(lockRoot);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    await acquireRecoveryGuard(recoveryRoot);
    let promotedRecoveryLock = false;
    try {
      let owner = null;
      try { owner = JSON.parse(await readFile(ownerPath, "utf8")); } catch { owner = null; }
      const lockAgeMs = Date.now() - (await stat(lockRoot)).mtimeMs;
      if (!owner && lockAgeMs < 300_000) throw new Error("Publish lock is initializing or was recently interrupted; retry shortly");
      if (processIsAlive(owner?.pid)) throw new Error(`Publish already running in process ${owner.pid}`);
      await recoverInterruptedPublishes(localRoot);
      await rm(lockRoot, { recursive: true, force: true });
      await rename(recoveryRoot, lockRoot);
      promotedRecoveryLock = true;
    } finally {
      if (!promotedRecoveryLock) await rm(recoveryRoot, { recursive: true, force: true });
    }
  }

  await writeFile(ownerPath, `${JSON.stringify({ pid: process.pid, token })}\n`);
  try {
    await recoverInterruptedPublishes(localRoot);
  } catch (error) {
    await rm(lockRoot, { recursive: true, force: true });
    throw error;
  }
  return async () => {
    try {
      const owner = JSON.parse(await readFile(ownerPath, "utf8"));
      if (owner.token === token) await rm(lockRoot, { recursive: true, force: true });
    } catch {
      // A missing lock means recovery or cleanup already completed.
    }
  };
}

async function currentBuiltAt(version) {
  try {
    const current = JSON.parse(await readFile(path.join(publicRoot, "version.json"), "utf8"));
    if (current.version === version && current.builtAt) return current.builtAt;
  } catch {
    // A missing or unreadable version file is repaired by the next publish.
  }
  return new Date().toISOString();
}

export async function syncGames({ manifest: manifestOverride, persistManifest = false } = {}) {
  const manifest = manifestOverride ?? await readManifest();
  const games = manifest.games;
  if (!Array.isArray(games) || games.length < 3) throw new Error("At least three games are required");
  const releasePublishLock = await acquirePublishLock();

  const transactionRoot = path.join(projectRoot, ".local", `publish-${process.pid}-${Date.now()}`);
  const stagingRoot = path.join(transactionRoot, "public-next");
  const backupRoot = path.join(transactionRoot, "public-previous");
  const manifestNext = path.join(transactionRoot, "games.json.next");
  let backupActive = false;

  try {
    await mkdir(transactionRoot, { recursive: true });
    await cp(publicRoot, stagingRoot, { recursive: true });
    await mkdir(path.join(stagingRoot, "assets"), { recursive: true });
    await rm(path.join(stagingRoot, "games"), { recursive: true, force: true });
    await mkdir(path.join(stagingRoot, "games"), { recursive: true });

    const ids = new Set();
    for (const game of games) {
      assertSafeId(game.id);
      if (ids.has(game.id)) throw new Error(`Duplicate game id: ${game.id}`);
      ids.add(game.id);

      const sourceRoot = resolveInside(playgroundRoot, game.sourcePath, `${game.id} sourcePath`);
      await assertRealPathInside(playgroundRoot, sourceRoot, `${game.id} sourcePath`);
      const destinationRoot = resolveInside(path.join(stagingRoot, "games"), game.id, `${game.id} destination`);
      await mkdir(destinationRoot, { recursive: true });

      for (const relativeFile of game.bundleFiles) {
        const extension = path.extname(relativeFile).toLowerCase();
        if (!allowedExtensions.has(extension)) throw new Error(`Blocked extension for ${game.id}: ${relativeFile}`);
        const sourceFile = resolveInside(sourceRoot, relativeFile, `${game.id} bundle file`);
        await assertRealPathInside(sourceRoot, sourceFile, `${game.id} bundle file`);
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
          await assertRealPathInside(sourceRoot, sourceFile, `${game.id} classic source`);
          parts.push(stripModuleSyntax(await readFile(sourceFile, "utf8")));
        }
        let bundle = parts.join("\n\n");
        if (game.classicBundle.storageFallback) {
          bundle = `${storageFallback}\n${bundle.replace(/\b(?:window\.)?localStorage\b/g, "safeStorage")}`;
        }
        const bundleOutput = resolveInside(destinationRoot, game.classicBundle.output, `${game.id} classic output`);
        await writeFile(bundleOutput, bundle);
        if (game.classicBundle.replaceScripts) {
          for (const [index, sourcePath] of game.classicBundle.replaceScripts.entries()) {
            html = replaceScript(html, sourcePath, index === 0 ? `<script defer src="./${game.classicBundle.output}"></script>` : "");
          }
        } else {
          html = replaceScript(html, game.classicBundle.replaceScript, `<script defer src="./${game.classicBundle.output}"></script>`, { moduleOnly: true });
        }
      }
      for (const stylesheet of game.inlineStyles ?? []) {
        const stylesheetPath = resolveInside(sourceRoot, stylesheet, `${game.id} inline stylesheet`);
        await assertRealPathInside(sourceRoot, stylesheetPath, `${game.id} inline stylesheet`);
        html = inlineStylesheet(html, stylesheet, await readFile(stylesheetPath, "utf8"));
      }
      if (game.normalizeRootRelativeAssets) html = normalizeRootRelativeAssets(html);
      if (!html.includes("Content-Security-Policy")) html = html.replace(/<head([^>]*)>/i, `<head$1>\n    ${csp}`);
      if (!html.includes("store-bridge.js")) html = html.replace(/<\/body>/i, `${bridge}</body>`);
      await writeFile(entryFile, html);
      await writeFile(path.join(destinationRoot, "store-bridge.js"), bridgeSource);

      const thumbnailSource = resolveInside(playgroundRoot, game.thumbnailSource, `${game.id} thumbnail`);
      await assertRealPathInside(playgroundRoot, thumbnailSource, `${game.id} thumbnail`);
      await assertRegularFile(thumbnailSource, `${game.id} thumbnail`);
      await cp(thumbnailSource, path.join(stagingRoot, "assets", `thumb-${game.id}.png`), { force: true });
    }

    const catalog = games.map(publicGame);
    const encodedStoreVersion = encodeURIComponent(manifest.storeVersion);
    const storeEntryPath = path.join(stagingRoot, "index.html");
    let storeHtml = await readFile(storeEntryPath, "utf8");
    for (const resource of ["./assets/styles.css", "./catalog.js", "./assets/app.js"]) {
      const escapedResource = resource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      storeHtml = storeHtml.replace(new RegExp(`(${escapedResource}\\?v=)[^"']+`, "g"), `$1${encodedStoreVersion}`);
    }
    await writeFile(storeEntryPath, storeHtml);
    await writeFile(path.join(stagingRoot, "catalog.json"), `${JSON.stringify({ version: manifest.storeVersion, games: catalog }, null, 2)}\n`);
    await writeFile(path.join(stagingRoot, "catalog.js"), `window.PLAYGROUND_CATALOG = ${JSON.stringify({ version: manifest.storeVersion, games: catalog })};\n`);
    await writeFile(path.join(stagingRoot, "version.json"), `${JSON.stringify({ version: manifest.storeVersion, builtAt: await currentBuiltAt(manifest.storeVersion) }, null, 2)}\n`);
    await validateBuild({ root: stagingRoot, manifest });

    if (persistManifest) await writeFile(manifestNext, `${JSON.stringify(manifest, null, 2)}\n`);

    await rename(publicRoot, backupRoot);
    backupActive = true;
    try {
      await rename(stagingRoot, publicRoot);
      if (persistManifest) await rename(manifestNext, manifestPath);
    } catch (error) {
      await rm(publicRoot, { recursive: true, force: true });
      await rename(backupRoot, publicRoot);
      backupActive = false;
      throw error;
    }
    try {
      await rm(backupRoot, { recursive: true, force: true });
      backupActive = false;
    } catch (error) {
      console.warn(`Publish committed; deferred backup cleanup: ${error.message}`);
    }
    return catalog;
  } finally {
    // Keep the backup on disk if an unexpected rollback failure made it the
    // only remaining copy of the previous live bundle.
    try {
      if (!backupActive) await rm(transactionRoot, { recursive: true, force: true });
    } finally {
      await releasePublishLock();
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const catalog = await syncGames();
  console.log(`Synced ${catalog.length} games`);
}
