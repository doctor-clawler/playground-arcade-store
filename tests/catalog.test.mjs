import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { manifestPath, playgroundRoot, projectRoot, resolveInside } from "../scripts/lib.mjs";

test("manifest registers three unique playable games", async () => {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.ok(manifest.games.length >= 3);
  assert.equal(new Set(manifest.games.map((game) => game.id)).size, manifest.games.length);
  for (const game of manifest.games) {
    const sourceRoot = resolveInside(playgroundRoot, game.sourcePath);
    await access(resolveInside(sourceRoot, game.entry));
    await access(resolveInside(playgroundRoot, game.thumbnailSource));
    assert.match(game.provenance.threadUrl, /^https:\/\/mibcompany\.slack\.com\/archives\/C0B07FH4M3R\//);
    assert.ok(game.controls.length >= 3);
  }
});

test("store shell declares the security and runtime boundaries", async () => {
  const html = await readFile(path.join(projectRoot, "public", "index.html"), "utf8");
  const app = await readFile(path.join(projectRoot, "public", "assets", "app.js"), "utf8");
  assert.match(html, /Content-Security-Policy/);
  assert.match(app, /sandbox.*allow-scripts allow-pointer-lock/);
  assert.doesNotMatch(app, /allow-same-origin/);
  assert.match(app, /requestFullscreen/);
  assert.match(app, /showPlayerError/);
});

test("path resolver fails closed on parent traversal", () => {
  assert.throws(() => resolveInside(projectRoot, "../outside"), /escapes allowed root/);
});
