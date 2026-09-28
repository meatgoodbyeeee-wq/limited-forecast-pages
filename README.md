# Limited Forecast — GitHub Pages

Existing UI migrated to Vite; frozen forecast exported once using unchanged original models. No training or FIN evaluation performed.

- Original site source: `126c192153487729d0e14b1c45388f0222a404d5`
- Input card snapshot: 2026-09-20T23:59:27.899Z; 290 cards. Live API could not be reached, so equivalence with later live card edits is unverified.
- GIH/ALSA values: `public/forecast.json`. The unchanged models run in the scheduled Pages build only when official draft card fields change. The browser only applies the existing observation blending policy to the official Public Game Dataset result after validation.
- Japanese images are copied from the existing data repository during Actions build.
- Japanese / English display toggle (top right; remembered per browser, `?lang=en` also works). Card names come from `data/card-images-ja.json`.
- Search, sort, filters, card images, details and CSV/Markdown export retained. The server-only features of the original site (saved predictions, manual card refresh) were removed.
- The GitHub Actions site build checks the official card gallery once a day at 06:07 JST (GitHub scheduling may be delayed; pushes to main and manual runs also rebuild); visible tabs poll the published JSON every five minutes. The existing data repository checks the Official Public Game Dataset daily. Failed checks retain predictions.
- Original chatgpt.site deployment is unchanged.

## Deploy
Set Settings → Pages → Source to GitHub Actions. Push to main or manually run Deploy Pages.

## Build
`npm install && npm run build`

## 予測の幅から外れたカードの理由（deviation notes）
Public Dataの取り込み後、カード詳細のGIH WR・ALSAの下に「発売前予測・予測の幅（ミント）」と「実測（ピンク）」を表示します。実測が予測の幅の外にあり、件数が1,000以上のカードでは、`public/deviation-notes.json` に書いた理由を表示します（件数の基準は `components/forecast-range.tsx` の `MIN_N`）。

1. 外れたカードと分析材料を一覧にする：
   `node scripts/deviation-report.mjs public/forecast.json.gz <fra-public-game.json> > report.md`
   （`fra-public-game.json` はデータリポジトリの `live/` にあります）
2. `report.md` をもとに理由を書き（AIに分析させても可）、`public/deviation-notes.json` に追加してmainへpushします。

```json
{
  "set": "FRA",
  "cards": {
    "Card Name": {
      "gih": {"source": "ai", "data_as_of": "2026-10-05", "written_at": "2026-10-06",
              "reasons": ["理由1", "理由2", "理由3"]}
    }
  }
}
```
`source` は AI による推定なら `"ai"`、人が書いたものなら `"manual"`。英語表示用に `"reasons_en": [...]` を足すと英語ページではそちらを表示します（無ければ日本語の `reasons`）。カード名は英語名（両面カードは表面の名前でも可）です。
