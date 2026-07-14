import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { publicGame, publicRoot, readManifest, resolveInside } from "./lib.mjs";

const localAssetPattern = /(?:src|href)=["']([^"'#?]+)(?:[?#][^"']*)?["']/gi;

export async function validateBuild({ root = publicRoot, manifest: manifestOverride } = {}) {
  const manifest = manifestOverride ?? await readManifest();
  const catalog = JSON.parse(await readFile(path.join(root, "catalog.json"), "utf8"));
  const failures = [];
  const expectedGames = manifest.games.map(publicGame);

  if (catalog.version !== manifest.storeVersion) failures.push("catalog version does not match manifest");
  if (catalog.games.length < 3 || JSON.stringify(catalog.games) !== JSON.stringify(expectedGames)) {
    failures.push("catalog must exactly match every manifest game");
  }

  for (const [index, game] of expectedGames.entries()) {
    const manifestGame = manifest.games[index];
    const gameRoot = resolveInside(path.join(root, "games"), game.id, `${game.id} root`);
    const entryPath = resolveInside(gameRoot, manifestGame.entry, `${game.id} entry`);
    try {
      await access(entryPath);
      await access(path.join(root, game.thumbnailUrl.replace(/^\.\//, "").split("?")[0]));
    } catch (error) {
      failures.push(`${game.id}: missing entry or thumbnail (${error.message})`);
      continue;
    }

    const html = await readFile(entryPath, "utf8");
    if (!html.includes("Content-Security-Policy")) failures.push(`${game.id}: missing CSP`);
    if (!html.includes("store-bridge.js")) failures.push(`${game.id}: missing store bridge`);
    if (/https?:\/\//i.test(html)) failures.push(`${game.id}: external URL found in game entry`);

    for (const match of html.matchAll(localAssetPattern)) {
      const ref = match[1];
      if (ref.startsWith("/")) {
        failures.push(`${game.id}: root-relative asset escapes game bundle ${ref}`);
        continue;
      }
      if (/^(data:|mailto:|javascript:)/i.test(ref)) continue;
      const target = resolveInside(gameRoot, ref, `${game.id} referenced asset`);
      try {
        await access(target);
      } catch {
        failures.push(`${game.id}: missing referenced asset ${ref}`);
      }
    }
  }

  const storeHtml = await readFile(path.join(root, "index.html"), "utf8");
  for (const required of ["Content-Security-Policy", "catalog.js", "app.js", "styles.css"]) {
    if (!storeHtml.includes(required)) failures.push(`store entry missing ${required}`);
  }
  const encodedStoreVersion = encodeURIComponent(manifest.storeVersion);
  for (const resource of ["./assets/styles.css", "./catalog.js", "./assets/app.js"]) {
    if (!storeHtml.includes(`${resource}?v=${encodedStoreVersion}`)) failures.push(`store entry has stale cache version for ${resource}`);
  }

  if (failures.length) throw new Error(`Static validation failed:\n- ${failures.join("\n- ")}`);
  return { gameCount: catalog.games.length, version: catalog.version };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await validateBuild();
  console.log(`Validated ${result.gameCount} games (catalog ${result.version})`);
}
