# LOA manifest patterns

Canonical manifest: `/Volumes/BigHugeMemory/works/playground-arcade-store/config/games.json`.
All stored `sourcePath`, `thumbnailSource`, `build.projectPath` values are relative to the portal repository. Originals in playground are provenance only.

Read `docs/ADDING_GAMES.md` and `docs/import-game.example.json` in the portal for import format. `projectFiles` lists reviewed editable sources; `bundleFiles` lists only public runtime files. Keep tests and operator notes out of bundleFiles.

Plain ESM uses existing `classicBundle` metadata (source order, output, replaceScript and optional storageFallback). Vite uses `build: {kind: "vite", projectPath: "games/<id>"}` and `sourcePath: "games/<id>/dist"`. The publisher discovers hashed assets, embeds CSS and converts the one entry script. Multi-entry/chunked or external-resource builds need explicit packaging work and runtime QA.

Public metadata includes id/title/genre/tags/orientation/description/mobileControls and entry/thumbnail URLs. Internal provenance including local paths and Slack links must never enter public payloads.
