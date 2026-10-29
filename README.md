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

## GIH WR予測モデル（2026-09-29から）
- バージョン `gih-c3-28set-20260929`（`data/adopted-gih-fra.json.gz`）。作成はデータリポジトリの `research/production_c3/`
- 学習：28セット（KHM〜TDMの21セット＋EOE・TLA・ECL・TMT・SOS・MSH・HOB。FIN・MH3・FRAの結果は使わない）
- 特徴量：従来の発売前特徴量＋AIがルールテキストから読み取ったカード効果の特徴（C3。データリポジトリ `research/gih_llm_extract/RUBRIC.md`）
- モデル：構造化特徴量のExtraTrees 70%＋ルールテキストのTF-IDF/Ridge 30%、学習平均の周りに×1.25（従来と同じ）。3シードの平均
- 検証：
  - 28セットのセット単位抜き出し検証：セット内MAE 2.396pp、順位相関 0.562
  - FIN（未使用だった最終検証用セット）で1回だけ採点：MAE 2.611→2.425pp、順位相関 0.407→0.514（`research/fin_final/`）
- 切り替え前の予測は `data/archive/forecast-fra-20260929-gih-22set.json.gz`（22セット・C3なし、`gih-github-22set-ensemble-20260923`）
- モデルを差し替えたときは `node scripts/apply-gih-model.mjs <保存名>` で `public/forecast.json.gz` に反映する（発売前フェーズのみ）。デッキカラー予測もGIH予測から再計算される
- 新しいセットでは、発売前にそのセットのカード効果の抽出（C3）と再出力が必要

## 予測の幅（GIH WR）
- カードごとの幅（名目80%）：`data/gih-range-fra.json`。方法の選択はデータリポジトリの `research/gih_interval/`（`PLAN.md` の事前に決めた判定ルールで6案から選択、結果は `RESULTS.md`）、現行モデル向けの再推定は `research/production_c3/`
- 方法：採用モデルの28セット分の予測誤差（OOF残差）の大きさをExtraTreesで予測し、予測値 ± q·σ とする（正規化コンフォーマル、方法は従来のM5のまま再推定）。予測値そのものは変えない
- 28セットのセット単位抜き出し検証：実測が幅に収まった割合は全体80.0%、レアリティ別78.6〜80.2%、平均幅7.67pp（旧モデルの幅は7.99pp。旧・一律±3.68ppはコモン89%／神話レア60%）
- 公開後にカードのテキストが変わった場合は、レアリティ×タイプ別の表（同ファイルの `fallback`）を使う
- `scripts/refresh-forecast.mjs` がビルドのたびに `forecast.json` へ反映する（公式カードの確認に失敗した場合も反映）
- ALSAの幅は従来どおり

## 過去の類似カード
カード詳細の「過去の類似カード」3枚は、22セット（KHM〜TDM）5,611枚から選びます（`data/similar-references.json.gz`）。候補一覧は手動実行の **Build similar-card references** ワークフローで作成：データリポジトリの22セットのカードデータと28日間GIH WR、Scryfallのマナコスト・リンク、17Landsカードデータの28日間ALSA。類似度は「予測モデルの特徴量（基本属性・能力・ルールテキストの語句）のコサイン類似度＋0.5×AIが読み取ったカード効果・強さのラベル（C3〜C5・C9）のコサイン類似度」で、土地／クリーチャー／その他の区分が同じでマナ総量の差が2以内の候補から選びます（`data/similar-labels.json.gz`、`lib/predict.mjs` の `similarCardsLabelled`。ラベルのないカードは従来の順位付け）。方式はデータリポジトリ `research/similar_cards`（PLAN.md・RESULTS.md）で事前登録して評価し、他セットの類似3枚の実測GIH WR平均と自カードの実測の誤差が従来比で約0.09pp（4%）小さくなりました。表示専用で、予測値には影響しません。

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

## 主表示は常に発売前予測（決定事項）
- 表のGIH WR・ALSA、平均との差、予測の幅、並び順、CSV・Markdownは、発売後も**常に発売前予測**を表示する。列名は「予測GIH WR」「予測ALSA」。
- 実測（Public Datasetから集計したGIH WR、Card DataのALSA）は、各カードの `observed_*` として別列・ピンクの丸・カード詳細の比較グラフにだけ出す。予測に混ぜた値（旧「ライブGIH WR」）は表示しない。
- 実装は `lib/live.mjs` の `forecastWithObservations`（混ぜた値は計算するが表示に使わない）。`scripts/live.test.mjs` が、実測が大量にあっても主表示が予測のままであることを検証する。
- 経緯：2026-10-23、Public Dataset公開（10/19）後に主表示が自動でほぼ実測の「ライブ」値に切り替わっていた（混ぜる係数 K=100 では重み約99%）。上のDataset節の「GIH WRは…切り替わる」は、この決定により**表示には適用しない**。

## 予測の幅から外れたカードの理由（deviation notes）
実測が予測の幅の外にあり、件数が1,000以上のGIH WRでは、`public/deviation-notes.json` の理由を表示します（件数の基準は `components/forecast-range.tsx` の `MIN_N`）。
- FRAの62枚は2026-10-14時点の実測で作成済み（`source: "ai"`）。各理由に「（AIによる理由）」と表示します。毎日の自動作成はしません。
- このファイルに無いカードが新たに予測の幅から外れた場合は、理由を書かず「判定保留」と表示します。
- 理由を追加する場合は、`cards` にカード名で `gih.reasons`（と英訳 `reasons_en`）を書いてmainへpushします。

## 新しいセットの追加（スター・トレック＝TRK が最初の例）
セット一覧は `lib/set-config.mjs` が唯一の定義（画面のセット選択・ビルドスクリプトの両方が読む）。`available: false` の間は選択肢に出ず、予測ファイルもビルドされない（公開スイッチ）。
1. **カード一覧**：Actions の **Collect set cards**（毎日05:37 JST、手動実行も可）が公式ギャラリーから `data/<code>/target.json.gz` を作る。取得の成否・使ったギャラリーは `data/<code>/collect-state.json`
2. **予測の生成（データリポジトリ）**：`research/newset/newset.py` でカード効果の抽出（C3）、`research/production_c3/export_gih_c3_28set.py --set <CODE>` で GIH予測と幅を出力 → `data/<code>/adopted-gih.json.gz` と `data/<code>/gih-range.json` に置く
3. **ビルド**：`scripts/build-set-forecast.mjs <CODE>` が `public/forecast-<code>.json` を作る（Deploy Pages が `data/<code>/adopted-gih.json.gz` のあるセットで自動実行）。ALSA・デッキカラー・類似カードは FRA と同じ処理
4. **公開**：確認後、`lib/set-config.mjs` の `available` を `true` にする。確認だけしたいときは `?set=TRK&preview=1`（ローカルでは `BUILD_UNPUBLISHED=1` でビルド）
5. 発売後の実測の取り込み（17Lands）はFRA専用のまま。新セットで使うときは `live: true` にしたうえで、取り込み側（`live/<code>-public-game.json` など）の対応が必要
- カード画像・日本語テキストはFRAのみ登録済み。他のセットは英語表示（画像は準備中）。CSPの制約で外部サイトの画像は直接読み込まない
