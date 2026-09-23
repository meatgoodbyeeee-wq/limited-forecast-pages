# Limited Forecast — GitHub Pages

Existing UI migrated to Vite; frozen forecast exported once using unchanged original models. No training or FIN evaluation performed.

- Original site source: `126c192153487729d0e14b1c45388f0222a404d5`
- Input card snapshot: 2026-09-20T23:59:27.899Z; 290 cards. Live API could not be reached, so equivalence with later live card edits is unverified.
- GIH/ALSA values: `public/forecast.json`. No model execution in build or browser.
- Japanese images are copied from the existing data repository during Actions build.
- Search, sort, filters, card images, details and CSV/Markdown export retained.
- Server-only card refresh and snapshot saving are disabled. The existing data repository's daily Official Public Game Dataset workflow remains unchanged; observation integration into this static version is not connected.
- Original chatgpt.site deployment is unchanged.

## Deploy
Set Settings → Pages → Source to GitHub Actions. Push to main or manually run Deploy Pages.

## Build
`npm install && npm run build`
