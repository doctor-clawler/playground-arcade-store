import { lstat, readFile, realpath, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const sourceRoot = projectRoot;
export const siteRoot = path.join(projectRoot, "site");
export const manifestPath = path.join(projectRoot, "config", "games.json");
export const publicRoot = path.join(projectRoot, "public");

export async function readManifest() {
  return hydrateManifest(JSON.parse(await readFile(manifestPath, "utf8")));
}

// Vite hashes are build outputs, never hand-maintained catalog configuration.
export async function hydrateManifest(manifest) {
  const result = structuredClone(manifest);
  for (const game of result.games) {
    if (!game.build) continue;
    if (game.build.kind !== "vite") throw new Error(`Unsupported build kind: ${game.build.kind}`);
    const root = resolveInside(projectRoot, game.sourcePath);
    await assertRealPathInside(projectRoot, root);
    const html = await readFile(resolveInside(root, game.entry), "utf8");
    const scripts = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi)].map(m => m[1]);
    if (scripts.length !== 1 || !/^\.?\/?assets\/.+\.js$/.test(scripts[0])) throw new Error(`Expected one local Vite entry for ${game.id}`);
    const styles = [...html.matchAll(/<link\b[^>]*href=["']([^"']+\.css)["'][^>]*>/gi)].map(m => m[1].replace(/^\.?\//, ""));
    const files = [];
    async function walk(dir, prefix = "") {
      for (const item of await readdir(dir, { withFileTypes: true })) {
        const rel = path.posix.join(prefix, item.name);
        if (item.isSymbolicLink()) throw new Error(`Symlink in build: ${rel}`);
        if (item.isDirectory()) await walk(path.join(dir, item.name), rel);
        else files.push(rel);
      }
    }
    await walk(root);
    game.bundleFiles = files.sort();
    game.classicBundle = { sources: [scripts[0].replace(/^\.?\//, "")], output: "game.bundle.js", replaceScript: scripts[0], storageFallback: true };
    game.inlineStyles = styles;
    game.normalizeRootRelativeAssets = true;
  }
  return result;
}

export function assertSafeId(id) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
    throw new Error(`Unsafe game id: ${id}`);
  }
}

export function resolveInside(root, relativePath, label = "path") {
  const resolved = path.resolve(root, relativePath);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`${label} escapes allowed root: ${relativePath}`);
  }
  return resolved;
}

export async function assertRegularFile(filePath, label = filePath) {
  const info = await lstat(filePath);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file`);
  }
}

export async function assertRealPathInside(root, target, label = "path") {
  const [realRoot, realTarget] = await Promise.all([realpath(root), realpath(target)]);
  if (realTarget !== realRoot && !realTarget.startsWith(`${realRoot}${path.sep}`)) {
    throw new Error(`${label} escapes allowed root through a symlink`);
  }
  return realTarget;
}

export function publicGame(game) {
  return {
    id: game.id,
    title: game.title,
    genre: game.genre,
    tags: game.tags,
    orientation: game.orientation,
    entryUrl: `./games/${game.id}/${game.entry}?v=${encodeURIComponent(game.version)}`,
    thumbnailUrl: `./assets/thumb-${game.id}.png?v=${encodeURIComponent(game.version)}`,
    shortDescription: game.shortDescription,
    description: game.description,
    mobileControls: game.mobileControls
  };
}
