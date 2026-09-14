#!/usr/bin/env bash
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"
if [[ -f env.dev.local ]]; then
  set -a
  source env.dev.local
  set +a
fi
npm run build
npm test
npm run validate
exec /Volumes/BigHugeMemory/works/_ops/scripts/serve-lan-preview.sh --directory "$PROJECT_DIR/public"
