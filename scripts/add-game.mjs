import { readFile } from "node:fs/promises";
import { assertSafeId, readManifest } from "./lib.mjs";
import { syncGames } from "./sync-games.mjs";

const specFlag = process.argv.indexOf("--spec");
if (specFlag < 0 || !process.argv[specFlag + 1]) {
  throw new Error("Usage: npm run add-game -- --spec ./path/to/game-spec.json");
}

const spec = JSON.parse(await readFile(process.argv[specFlag + 1], "utf8"));
assertSafeId(spec.id);
const required = ["title", "version", "genre", "sourcePath", "bundleFiles", "entry", "thumbnailSource", "shortDescription", "description", "mobileControls", "provenance"];
for (const field of required) if (spec[field] == null) throw new Error(`Missing required field: ${field}`);

const manifest = await readManifest();
if (manifest.games.some((game) => game.id === spec.id)) throw new Error(`Game already registered: ${spec.id}`);
manifest.games.push(spec);
await syncGames({ manifest, persistManifest: true });
console.log(`Added and rebuilt ${spec.id}`);
