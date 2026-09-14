---
name: host-playground-games
description: Add or update browser games in the formal LOA game portal at /Volumes/BigHugeMemory/works/playground-arcade-store, including importing completed playground projects, validating gameplay, and publishing the catalog.
---

# LOA Game Portal

Canonical project: `/Volumes/BigHugeMemory/works/playground-arcade-store`.
Public domain: `loa.mibstudio.top`. GitHub repository: `doctor-clawler/playground-arcade-store`.
Slack project channel: `#loa` (`C0C1P2B8LSV`). The old playground portal directory was promoted; do not recreate it.

## Add a playground game

1. Read the portal `AGENTS.md`, `docs/ADDING_GAMES.md`, manifest and git status. Keep existing work intact.
2. Discover candidates with `node scripts/scan_candidates.mjs --root /Volumes/BigHugeMemory/works/playground` from this skill directory. This is an inventory, not proof of playability. Skip projects already identified by manifest `provenance.importedFrom`.
3. Inspect the requested game, its dependencies, tests, source and source thread if available. Record real provenance; never invent a Slack thread. Review only this candidate rather than requiring a full Slack sweep for a named game.
4. Use a real gameplay screenshot. Prepare an import spec with an explicit reviewed `projectFiles` list, runtime `bundleFiles` for plain HTML, or `build.kind: vite` for Vite. See [manifest patterns](references/manifest-schema.md).
5. Run `npm run import-game -- --spec <file>` in the portal. This copies sources into `games/<id>/`, imports the thumbnail, builds and validates the catalog transactionally. The original playground project remains intact. Do not copy credentials, node_modules, temporary output or hidden tool sessions.
6. Treat the imported `games/<id>/` as the maintained source. For subsequent edits, work there, bump game/catalog versions, build and verify. Do not reimport over it or sync stale originals automatically.
7. Preserve `sandbox="allow-scripts allow-pointer-lock"`, internal-only provenance and current storage boundary. This importer supports plain HTML and qualified single-entry Vite builds. Unity/Defold/WASM/server-backed games require their own verified build and hosting support; do not loosen sandbox/CSP just to register them.
8. Run `npm run build`, `npm test`, `npm run validate`, and the imported game's meaningful tests. Use `npm run build:web` for a centrally allocated LAN/Tailscale preview.
9. Add a real first-play action to `scripts/verify-browser.mjs` for the new game. Run `PORTAL_BASE_URL=<verified-url>/ npm run test:browser`. Verify state changes, resources, mobile input and screenshots. Report unavailable save/fullscreen capabilities accurately.
10. Commit source/config/tests/docs only; `public/` and `games/*/dist/` are generated and ignored. Push the existing upstream only when publication is authorized. The Pages workflow rebuilds from source and deploys `public/`. Verify workflow success and public root/catalog/game resources before reporting deployed.

## Output

Return concise status, game count, public URL, source location and verification evidence. Return assistant answers/artifacts through the active `_ops` thread; do not post them with a user token or Slack connector. If domain authentication or HTTPS issuance is pending, distinguish repository deployment from custom-domain readiness.
