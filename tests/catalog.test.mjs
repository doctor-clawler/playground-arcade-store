import assert from "node:assert/strict";
import { access, cp, mkdir, readFile, rm, symlink, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { manifestPath, playgroundRoot, projectRoot, resolveInside } from "../scripts/lib.mjs";
import { syncGames } from "../scripts/sync-games.mjs";
import { validateBuild } from "../scripts/validate.mjs";

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
    assert.ok(game.mobileControls.length >= 3);
  }
});

test("store shell declares the security and runtime boundaries", async () => {
  const html = await readFile(path.join(projectRoot, "public", "index.html"), "utf8");
  const app = await readFile(path.join(projectRoot, "public", "assets", "app.js"), "utf8");
  const catalog = await readFile(path.join(projectRoot, "public", "catalog.json"), "utf8");
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /오늘 뭐 하고 놀까/);
  assert.match(html, /모바일 조작/);
  assert.doesNotMatch(html, /만든 기록|HOW IT WORKS|hero-play|detail-facts/);
  assert.match(app, /sandbox.*allow-scripts allow-pointer-lock/);
  assert.doesNotMatch(app, /allow-same-origin/);
  assert.match(app, /requestFullscreen/);
  assert.match(app, /enterMobilePlayMode\(game\)/);
  assert.match(app, /showPlayerError/);
  assert.match(app, /dataset\.orientation/);
  assert.doesNotMatch(app, /provenance|source-list/);
  assert.doesNotMatch(catalog, /provenance|threadUrl|artifactId|localSource/);
});

test("path resolver fails closed on parent traversal", () => {
  assert.throws(() => resolveInside(projectRoot, "../outside"), /escapes allowed root/);
});

test("failed candidate publish leaves the manifest and live catalog unchanged", async () => {
  const originalManifest = await readFile(manifestPath, "utf8");
  const catalogPath = path.join(projectRoot, "public", "catalog.json");
  const originalCatalog = await readFile(catalogPath, "utf8");
  const candidate = JSON.parse(originalManifest);
  candidate.games.push({
    ...candidate.games[0],
    id: "missing-candidate",
    sourcePath: "does-not-exist"
  });

  await assert.rejects(
    syncGames({ manifest: candidate, persistManifest: true }),
    /ENOENT|no such file/i
  );
  assert.equal(await readFile(manifestPath, "utf8"), originalManifest);
  assert.equal(await readFile(catalogPath, "utf8"), originalCatalog);
});

test("candidate publish rejects bundle symlinks that escape the source root", async () => {
  const fixtureRoot = path.join(playgroundRoot, ".publish-symlink-fixture");
  await rm(fixtureRoot, { recursive: true, force: true });
  await mkdir(fixtureRoot);
  await symlink("/etc/hosts", path.join(fixtureRoot, "escape.html"));

  try {
    const candidate = JSON.parse(await readFile(manifestPath, "utf8"));
    candidate.games.push({
      ...candidate.games[0],
      id: "symlink-candidate",
      sourcePath: ".publish-symlink-fixture",
      bundleFiles: ["escape.html"],
      entry: "escape.html"
    });
    await assert.rejects(
      syncGames({ manifest: candidate, persistManifest: true }),
      /escapes allowed root through a symlink|must be a regular file/i
    );
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("validator rejects a same-length catalog that differs from the manifest", async () => {
  const fixtureRoot = path.join(projectRoot, ".local", "catalog-mismatch-fixture");
  await rm(fixtureRoot, { recursive: true, force: true });
  await cp(path.join(projectRoot, "public"), fixtureRoot, { recursive: true });
  try {
    const catalogPath = path.join(fixtureRoot, "catalog.json");
    const catalog = JSON.parse(await readFile(catalogPath, "utf8"));
    catalog.games.reverse();
    await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
    await assert.rejects(validateBuild({ root: fixtureRoot }), /exactly match/);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});

test("a live publish lock fails closed", async () => {
  const lockRoot = path.join(projectRoot, ".local", "publish.lock");
  await rm(lockRoot, { recursive: true, force: true });
  await mkdir(lockRoot, { recursive: true });
  await writeFile(path.join(lockRoot, "owner.json"), `${JSON.stringify({ pid: process.pid, token: "test-owner" })}\n`);
  try {
    await assert.rejects(syncGames(), /Publish already running/);
  } finally {
    await rm(lockRoot, { recursive: true, force: true });
  }
});

test("an abandoned recovery lock is reclaimed after the safety window", async () => {
  const localRoot = path.join(projectRoot, ".local");
  const lockRoot = path.join(localRoot, "publish.lock");
  const recoveryRoot = path.join(localRoot, "publish-recovery.lock");
  await rm(lockRoot, { recursive: true, force: true });
  await rm(recoveryRoot, { recursive: true, force: true });
  await mkdir(lockRoot, { recursive: true });
  await mkdir(recoveryRoot, { recursive: true });
  await writeFile(path.join(lockRoot, "owner.json"), `${JSON.stringify({ pid: 999999, token: "abandoned" })}\n`);
  await writeFile(path.join(recoveryRoot, "owner.json"), `${JSON.stringify({ pid: 999999 })}\n`);
  const staleTime = new Date(Date.now() - 600_000);
  await utimes(lockRoot, staleTime, staleTime);
  await utimes(recoveryRoot, staleTime, staleTime);
  try {
    const catalog = await syncGames();
    assert.ok(catalog.length >= 3);
  } finally {
    await rm(lockRoot, { recursive: true, force: true });
    await rm(recoveryRoot, { recursive: true, force: true });
  }
});
