import { syncGames } from "./sync-games.mjs";
import { validateBuild } from "./validate.mjs";

const catalog = await syncGames();
const result = await validateBuild();
console.log(`Publish bundle ready: ${catalog.length} games, version ${result.version}`);
