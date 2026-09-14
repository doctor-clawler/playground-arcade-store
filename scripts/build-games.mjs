import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { manifestPath, projectRoot, resolveInside, assertRealPathInside } from "./lib.mjs";

export async function buildGames(manifest) {
  manifest ??= JSON.parse(await readFile(manifestPath, "utf8"));
  for (const game of manifest.games) {
    if (!game.build) continue;
    if (game.build.kind !== "vite") throw new Error(`Unsupported build kind: ${game.build.kind}`);
    const cwd = resolveInside(projectRoot, game.build.projectPath);
    await assertRealPathInside(projectRoot, cwd);
    for (const args of [["ci", "--no-audit", "--no-fund"], ["run", "build"]]) {
      const result = spawnSync("npm", args, { cwd, stdio: "inherit", env: process.env });
      if (result.status !== 0) throw new Error(`${game.id}: npm ${args.join(" ")} failed (${result.status})`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await buildGames();
