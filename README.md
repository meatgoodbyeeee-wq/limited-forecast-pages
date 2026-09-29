# Limited Forecast — GitHub Pages

Existing UI migrated to Vite; frozen forecast exported once using unchanged original models. No training or FIN evaluation performed.

- Original site source: `126c192153487729d0e14b1c45388f0222a404d5`
- Input card snapshot: 2026-09-20T23:59:27.899Z; 290 cards. Live API could not be reached, so equivalence with later live card edits is unverified.
- GIH/ALSA values: `public/forecast.json`. The unchanged models run in the scheduled Pages build only when official draft card fields change. The browser only applies the existing observation blending policy to the official Public Game Dataset result after validation.
- Japanese images are copied from the existing data repository during Actions build.
- Set picker on the set title (`components/set-picker.tsx`); sets are listed in `lib/sets.ts` (only FRA is selectable for now — loading another set's data is not wired up yet).
- Japanese / English display toggle (top right; remembered per browser, `?lang=en` also works). Card names come from `data/card-images-ja.json`. Japanese type lines, rules text and past-set similar-card names come from `data/card-text-ja.json`, refreshed by the manual **Fetch Japanese card text** workflow (official Wizards Japanese text; line breaks rebuilt from the English text by `scripts/ja-lines.mjs`, or Scryfall's Japanese printed text once it exists).
- Search, sort, filters, card images, details and CSV/Markdown export retained. The server-only features of the original site (saved predictions, manual card refresh) were removed.
- The GitHub Actions site build checks the official card gallery once a day at 06:07 JST (GitHub scheduling may be delayed; pushes to main and manual runs also rebuild); visible tabs re-read the published JSON every 30 minutes. The existing data repository checks the Official Public Game Dataset daily. Failed checks retain predictions.
- Original chatgpt.site deployment is unchanged.

## Deploy
Set Settings → Pages → Source to GitHub Actions. Push to main or manually run Deploy Pages.

## Build
`npm install && npm run build`

## 予測の幅（GIH WR）
- カードごとの幅（名目80%）：`data/gih-range-fra.json`。作成はデータリポジトリの `research/gih_interval/`（`PLAN.md` の事前に決めた判定ルールで6案から選択、結果は `RESULTS.md`）
- 方法：採用モデルの21セット分の予測誤差（OOF残差）の大きさをExtraTreesで予測し、予測値 ± q·σ とする（正規化コンフォーマル）。予測値そのものは変えない
- 過去21セットのセット単位抜き出し検証：実測が幅に収まった割合は全体80.2%、レアリティ別79〜81%（旧・一律±3.68ppはコモン89%／神話レア60%）
- 公開後にカードのテキストが変わった場合は、レアリティ×タイプ別の表（同ファイルの `fallback`）を使う
- `scripts/refresh-forecast.mjs` がビルドのたびに `forecast.json` へ反映する（公式カードの確認に失敗した場合も反映）
- ALSAの幅は従来どおり

## 過去の類似カード
カード詳細の「過去の類似カード」3枚は、22セット（KHM〜TDM）5,611枚から選びます（`data/similar-references.json.gz`）。候補一覧は手動実行の **Build similar-card references** ワークフローで作成：データリポジトリの22セットのカードデータと28日間GIH WR、Scryfallのマナコスト・リンク、17Landsカードデータの28日間ALSA。類似度は予測モデルの特徴量（基本属性・能力・ルールテキストの語句）のコサイン類似度で、表示専用です（予測値には影響しません）。

## 実測値（17Lands Card Data）
- 取得：`.github/workflows/card-data.yml`（毎日 00:30 JST 頃）→ `scripts/fetch-card-data.mjs` → 判定ロジックは `lib/card-data.mjs`
- **2026-10-13 00:00 JST（2026-10-12T15:00Z）より前は17Lands APIを呼ばない**（コード側でも判定）
- 1暦日（JST）につきAPI呼び出しは最大1回（成功・失敗とも `data/card-data-state.json` に記録し、同日の再実行では呼ばない）
- 期間は発売日 2026-09-29 〜 前日（最長 2026-10-26 の28日間）。28日分を取得し終えたら以後は呼ばない
- 保存先：`public/data/fra-actual-card-data.json`（取得失敗・空応答では上書きしない）。サイトはこの静的JSONだけを読む
- 表示：カード詳細のグラフに実測（ピンク）として表示のみ。予測値には反映しない
- Public Dataset公開後：GIH WRはデータリポジトリがPublic Datasetから集計した値に切り替わる。Game DataにALSAが無いため、ALSAのみCard Dataを継続（止める場合は `lib/card-data.mjs` の `CONTINUE_AFTER_PUBLIC_DATASET` を false）
- 公開確認はデータリポジトリの日次確認結果（`live/fra-public-game.json`）を読むだけで、追加のアクセスはしない
- テスト：`node --test scripts/card-data.test.mjs`（時刻とAPIはモック）

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
