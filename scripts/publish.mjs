import { syncGames } from "./sync-games.mjs";
import { validateBuild } from "./validate.mjs";
import { buildGames } from "./build-games.mjs";

await buildGames();
const catalog = await syncGames();
const result = await validateBuild();
console.log(`Publish bundle ready: ${catalog.length} games, version ${result.version}`);
