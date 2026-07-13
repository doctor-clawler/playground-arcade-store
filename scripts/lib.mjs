import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const playgroundRoot = path.resolve(projectRoot, "..");
export const manifestPath = path.join(projectRoot, "config", "games.json");
export const publicRoot = path.join(projectRoot, "public");

export async function readManifest() {
  return JSON.parse(await readFile(manifestPath, "utf8"));
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
  const info = await stat(filePath);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file`);
  }
}

export function publicGame(game) {
  return {
    id: game.id,
    title: game.title,
    edition: game.edition,
    version: game.version,
    featured: game.featured,
    genre: game.genre,
    tags: game.tags,
    players: game.players,
    orientation: game.orientation,
    entryUrl: `./games/${game.id}/${game.entry}?v=${encodeURIComponent(game.version)}`,
    thumbnailUrl: `./assets/thumb-${game.id}.png?v=${encodeURIComponent(game.version)}`,
    shortDescription: game.shortDescription,
    description: game.description,
    controls: game.controls,
    accent: game.accent,
    ink: game.ink,
    provenance: game.provenance
  };
}
