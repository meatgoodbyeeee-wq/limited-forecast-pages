#!/usr/bin/env bash
# Builds the PRIVATE TRK preview (forecast + 17Lands observed values in separate columns) into dist/.
#   scripts/preview-trk.sh <path to the data repository's live/trk-card-data.json>
# Nothing here is committed or deployed: the observed-values file and the build inputs are untracked,
# and the public site is only built from main by .github/workflows/pages.yml.
set -euo pipefail
cd "$(dirname "$0")/.."
SNAPSHOT="${1:?path to live/trk-card-data.json}"
[ -d node_modules ] || npm ci --no-audit --no-fund
gunzip -kf public/forecast.json.gz
gunzip -kf data/live-policy.json.gz
node scripts/build-set-forecast.mjs TRK
node scripts/preview-set-actuals.mjs TRK "$SNAPSHOT"
mkdir -p public/cards/trk && cp -R data/trk/images/. public/cards/trk/
npx vite build --base=./
ls dist/assets
