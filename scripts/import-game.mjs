import { access, copyFile, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { assertSafeId, assertRegularFile, assertRealPathInside, resolveInside, projectRoot, manifestPath } from "./lib.mjs";
import { buildGames } from "./build-games.mjs";
import { syncGames } from "./sync-games.mjs";

// Import only the operator-reviewed source list. Never move or modify the original.
export async function importGame(spec, { fromRoot = process.env.OPS_PLAYGROUND_WORKSPACE_ROOT || "/Volumes/BigHugeMemory/works/playground" } = {}) {
  const game = structuredClone(spec.game);
  assertSafeId(game.id);
  if (!Array.isArray(spec.projectFiles) || !spec.projectFiles.length) throw new Error("projectFiles must list reviewed source files");
  for (const field of ["title", "version", "genre", "entry", "shortDescription", "description", "mobileControls", "provenance"]) {
    if (game[field] == null) throw new Error(`Missing game field: ${field}`);
  }
  if (!game.build && !Array.isArray(game.bundleFiles)) throw new Error("bundleFiles required for a static game");
  const source = resolveInside(path.resolve(fromRoot), spec.projectPath, "import project");
  await assertRealPathInside(path.resolve(fromRoot), source, "import project");
  const destRelative = `games/${game.id}`;
  const dest = resolveInside(projectRoot, destRelative);
  const thumbRelative = `assets-source/thumbnails/${game.id}.png`;
  const thumbDest = resolveInside(projectRoot, thumbRelative);
  const copies = [];
  for (const name of spec.projectFiles) {
    const parts = name.split(/[\\/]/);
    if (parts.some(p => /^(?:\.git|node_modules|dist|build|output|input|tmp|\.local|\.playwright-cli|\.env.*|env\.dev\.local)$/.test(p)) || /\.(?:log|db|sqlite|sqlite3|pem|key|p12)$/i.test(name)) throw new Error(`Excluded source file: ${name}`);
    const file = resolveInside(source, name, "import file");
    await assertRealPathInside(source, file, "import file");
    await assertRegularFile(file);
    copies.push([file, resolveInside(dest, name)]);
  }
  const thumbnail = resolveInside(path.resolve(fromRoot), spec.thumbnailSource, "import thumbnail");
  await assertRealPathInside(path.resolve(fromRoot), thumbnail);
  await assertRegularFile(thumbnail);
  await mkdir(path.join(projectRoot, ".local"), { recursive: true });
  const lock = path.join(projectRoot, ".local/import.lock");
  await mkdir(lock); // Fail closed if another import owns the manifest.
  let copied = false;
  let committed = false;
  try {
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (manifest.games.some(g => g.id === game.id)) throw new Error(`Game already registered: ${game.id}`);
    for (const target of [dest, thumbDest]) {
      try { await access(target); } catch (e) { if (e.code === "ENOENT") continue; throw e; }
      throw new Error(`Import destination already exists: ${target}`);
    }
    await mkdir(dest, { recursive: true });
    copied = true;
    for (const [file, target] of copies) {
      await mkdir(path.dirname(target), { recursive: true });
      await copyFile(file, target);
    }
    await mkdir(path.dirname(thumbDest), { recursive: true });
    await copyFile(thumbnail, thumbDest);
    game.sourcePath = game.build ? `${destRelative}/dist` : destRelative;
    game.thumbnailSource = thumbRelative;
    game.provenance = { ...game.provenance, importedFrom: source, localSource: destRelative };
    if (game.build) game.build.projectPath = destRelative;
    await buildGames({ games: [game] });
    manifest.games.push(game);
    manifest.storeVersion = `${new Date().toISOString().slice(0, 10)}-${Date.now()}`;
    await syncGames({ manifest, persistManifest: true });
    committed = true;
    return { id: game.id, sourcePath: destRelative, gameCount: manifest.games.length };
  } finally {
    if (copied && !committed) {
      await rm(dest, { recursive: true, force: true });
      await rm(thumbDest, { force: true });
    }
    await rm(lock, { recursive: true });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf("--spec");
  if (i < 0 || !process.argv[i + 1]) throw new Error("Usage: npm run import-game -- --spec <reviewed-spec.json>");
  console.log(JSON.stringify(await importGame(JSON.parse(await readFile(process.argv[i + 1], "utf8"))), null, 2));
}
