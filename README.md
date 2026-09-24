# Limited Forecast — GitHub Pages

Existing UI migrated to Vite; frozen forecast exported once using unchanged original models. No training or FIN evaluation performed.

- Original site source: `126c192153487729d0e14b1c45388f0222a404d5`
- Input card snapshot: 2026-09-20T23:59:27.899Z; 290 cards. Live API could not be reached, so equivalence with later live card edits is unverified.
- GIH/ALSA values: `public/forecast.json`. The unchanged models run in the scheduled Pages build only when official draft card fields change. The browser only applies the existing observation blending policy to the official Public Game Dataset result after validation.
- Japanese images are copied from the existing data repository during Actions build.
- Search, sort, filters, card images, details and CSV/Markdown export retained.
- The GitHub Actions site build checks the official card gallery on a five-minute cron (GitHub scheduling may be delayed); visible tabs poll the published JSON every five minutes. The existing data repository checks the Official Public Game Dataset daily. Failed checks retain predictions. Server-side snapshot saving is disabled.
- Original chatgpt.site deployment is unchanged.

## Deploy
Set Settings → Pages → Source to GitHub Actions. Push to main or manually run Deploy Pages.

## Build
`npm install && npm run build`
