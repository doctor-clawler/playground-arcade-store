import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { publicRoot, readManifest, resolveInside } from "./lib.mjs";

const localAssetPattern = /(?:src|href)=["']([^"'#?]+)(?:[?#][^"']*)?["']/gi;

export async function validateBuild() {
  const manifest = await readManifest();
  const catalog = JSON.parse(await readFile(path.join(publicRoot, "catalog.json"), "utf8"));
  const failures = [];

  if (catalog.version !== manifest.storeVersion) failures.push("catalog version does not match manifest");
  if (catalog.games.length !== manifest.games.length || catalog.games.length < 3) failures.push("catalog must contain every game and at least three games");

  for (const game of catalog.games) {
    const root = resolveInside(path.join(publicRoot, "games"), game.id, `${game.id} root`);
    const entryPath = path.join(root, "index.html");
    try {
      await access(entryPath);
      await access(path.join(publicRoot, game.thumbnailUrl.replace(/^\.\//, "").split("?")[0]));
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
      if (/^(data:|mailto:|javascript:|\/)/i.test(ref)) continue;
      const target = resolveInside(root, ref, `${game.id} referenced asset`);
      try {
        await access(target);
      } catch {
        failures.push(`${game.id}: missing referenced asset ${ref}`);
      }
    }
  }

  const storeHtml = await readFile(path.join(publicRoot, "index.html"), "utf8");
  for (const required of ["Content-Security-Policy", "catalog.js", "app.js", "styles.css"]) {
    if (!storeHtml.includes(required)) failures.push(`store entry missing ${required}`);
  }

  if (failures.length) throw new Error(`Static validation failed:\n- ${failures.join("\n- ")}`);
  return { gameCount: catalog.games.length, version: catalog.version };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await validateBuild();
  console.log(`Validated ${result.gameCount} games (catalog ${result.version})`);
}
