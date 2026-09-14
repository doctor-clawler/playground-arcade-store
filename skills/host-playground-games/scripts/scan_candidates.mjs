#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const rootFlag = args.indexOf("--root");
const root = path.resolve(rootFlag >= 0 && args[rootFlag + 1] ? args[rootFlag + 1] : process.cwd());
const ignored = new Set(["node_modules", ".git", ".local", "output", ".playwright-cli"]);

async function exists(target) {
  try { await stat(target); return true; } catch { return false; }
}

async function collectRuntimeText(directory, depth = 0) {
  if (depth > 3) return "";
  let output = "";
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) output += await collectRuntimeText(target, depth + 1);
    else if (/\.(?:html|js|mjs|ts)$/.test(entry.name) && (await stat(target)).size < 2_000_000) {
      output += `\n${await readFile(target, "utf8")}`;
    }
    if (output.length > 4_000_000) break;
  }
  return output;
}

const candidates = [];
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory() || ignored.has(entry.name)) continue;
  const directory = path.join(root, entry.name);
  const sourceEntry = path.join(directory, "index.html");
  const distEntry = path.join(directory, "dist", "index.html");
  if (!(await exists(sourceEntry)) && !(await exists(distEntry))) continue;
  const info = await stat(directory);
  const runtimeText = await collectRuntimeText(directory);
  candidates.push({
    directory: entry.name,
    updatedAt: info.mtime.toISOString(),
    entries: [await exists(sourceEntry) ? "index.html" : null, await exists(distEntry) ? "dist/index.html" : null].filter(Boolean),
    hasPackage: await exists(path.join(directory, "package.json")),
    hasProgress: await exists(path.join(directory, "progress.md")),
    hasTests: await exists(path.join(directory, "tests")),
    indicators: {
      canvas: /<canvas\b/i.test(runtimeText),
      touch: /touch|pointer/i.test(runtimeText),
      stateHook: /render_game_to_text/.test(runtimeText),
      timeHook: /advanceTime/.test(runtimeText),
      externalUrl: /https?:\/\//i.test(runtimeText)
    }
  });
}

candidates.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
console.log(JSON.stringify({ root, count: candidates.length, candidates }, null, 2));
