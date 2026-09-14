# LOA Game Portal

- Formal project root: `/Volumes/BigHugeMemory/works/playground-arcade-store`; Slack `#loa`; existing GitHub upstream `doctor-clawler/playground-arcade-store`.
- `games/<id>/` contains maintained game source; `site/` contains the portal shell; `config/games.json` is the catalog. Playground originals are retained historical inputs, not build dependencies.
- For imports use `skills/host-playground-games/SKILL.md` and `docs/ADDING_GAMES.md`. Add source files explicitly, never blindly copy a workspace. Keep original playground projects unchanged.
- `npm run build` rebuilds Vite games and generates `public/`. Do not commit `public/`, `dist/`, dependencies, logs, screenshots from QA, credentials or machine-local env. Source thumbnails under `assets-source/thumbnails/` are product assets.
- Preserve the iframe sandbox and provenance filtering. Games use the parent-owned browser save bridge without same-origin permission. Follow `docs/BROWSER_SAVES.md`; test gameplay restoration after a browser restart. Do not claim Unity/Defold compatibility without testing.
- Run focused tests for changes, then `npm run build`, `npm test`, `npm run validate` and the browser smoke for packaging/catalog changes. Keep tests that mutate the manifest in `tests/catalog.test.mjs` to avoid parallel publish races.
- `npm run build:web` uses `_ops` managed LAN/Tailscale preview. Read `env.dev.local`; never choose a port manually. Report verified URLs only.
- Push to the current upstream after validation. Pages builds from source. Confirm workflow and public HTTP results for authorized publication; DNS/HTTPS readiness is a separate check.
