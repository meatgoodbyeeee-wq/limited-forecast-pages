// Builds public/forecast-<code>.json for a set that is not FRA (FRA keeps its own flow in scripts/refresh-forecast.mjs).
// Same pipeline as refresh-forecast.mjs: first-stage model + similar cards -> adopted GIH (28-set + C3) -> adopted ALSA -> deck colours.
//   node scripts/build-set-forecast.mjs TRK
// Inputs (all under data/<code>/ unless overridden): target.json.gz (cards), adopted-gih.json.gz and gih-range.json (from the data
// repository: research/production_c3/export_gih_c3_28set.py --set <CODE>). Without the adopted files the first-stage model is used and
// the forecast is marked as such; that forecast must not be published (the set stays available:false in lib/set-config.mjs,
// which also makes this script build nothing; BUILD_UNPUBLISHED=1 overrides that for local checks).
// Optional data/<code>/gih-reasons.json (research/trk_preview/reasons_b11g.py, same model version): one plain-language reason per card,
// shown instead of the numeric breakdown. Like the adopted files it stays out of the public repository until the set is published.
// Options: --target <gz> --adopted <gz> --range <json> --reasons <json> --out <json> --summary-from <forecast.json.gz>
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {draftPool} from '../lib/draft-pool.mjs';
import {predictCards} from '../lib/predict.mjs';
import {makeAdoptedGih} from '../lib/adopted-gih-core.mjs';
import {makeGihRange} from '../lib/gih-range-core.mjs';
import {applyAdoptedAlsa, adoptedAlsaVersion} from '../lib/adopted-alsa.mjs';
import {predictDeckColors} from '../lib/deck-color.mjs';
import {liveForecast} from '../lib/live.mjs';
import {setConfig} from '../lib/set-config.mjs';

const args = process.argv.slice(2), code = (args[0] || '').toUpperCase(), opt = k => { const i = args.indexOf('--' + k); return i > 0 ? args[i + 1] : undefined; };
const cfg = setConfig(code);
if (!cfg?.forecast) throw Error(`usage: node scripts/build-set-forecast.mjs <SET CODE>; got ${code || 'nothing'}`);
// Publishing switch: a set whose lib/set-config.mjs entry says available:false is never built (BUILD_UNPUBLISHED=1 overrides it for local checks).
if (!cfg.available && !process.env.BUILD_UNPUBLISHED) { console.log(`${code} is not published (available:false); nothing built`); process.exit(0); }
const c = code.toLowerCase(), url = p => new URL(p, import.meta.url);
const readGz = p => JSON.parse(gunzipSync(fs.readFileSync(p)));
const targetPath = opt('target') || url(`../data/${c}/target.json.gz`), adoptedPath = opt('adopted') || url(`../data/${c}/adopted-gih.json.gz`),
  rangePath = opt('range') || url(`../data/${c}/gih-range.json`), reasonsPath = opt('reasons') || url(`../data/${c}/gih-reasons.json`), out = opt('out') || url(`../public/${cfg.forecast}`);
if (!fs.existsSync(targetPath)) throw Error(`カード一覧がありません: ${targetPath}（Collect set cards を先に実行してください）`);

const target = readGz(targetPath), pool = draftPool(target.cards);
if (!pool.length) throw Error('公開カードが0枚です');
const incumbent = readGz(url('../data/model.json.gz'));
const refs = url('../data/similar-references.json.gz');
if (fs.existsSync(refs)) incumbent.references = {...incumbent.references, gih: readGz(refs).cards};
const simLabels = url('../data/similar-labels.json.gz');
if (fs.existsSync(simLabels)) incumbent.similar_labels = readGz(simLabels);

let apply = cards => cards, gihVersion = 'first-stage-only (no adopted GIH file)', rangeVersion = null, preliminary = false;
if (fs.existsSync(adoptedPath) && fs.existsSync(rangePath)) {
  const adopted = readGz(adoptedPath), range = JSON.parse(fs.readFileSync(rangePath, 'utf8'));
  if (adopted.set && adopted.set !== code) throw Error(`adopted file is for ${adopted.set}, not ${code}`);
  if (range.gih_model_version !== adopted.version) throw Error('range file and adopted file belong to different model versions');
  const reasons = fs.existsSync(reasonsPath) ? JSON.parse(fs.readFileSync(reasonsPath, 'utf8')) : null;
  const gr = makeGihRange(range), ad = makeAdoptedGih(adopted, gr.withGihRange, reasons);
  apply = ad.applyAdoptedGih; gihVersion = ad.adoptedGihVersion; rangeVersion = gr.gihRangeVersion; preliminary = adopted.preliminary === true;
}
const predicted = applyAdoptedAlsa(apply(predictCards(pool, incumbent)));
if (!predicted.length || predicted.some(x => !Number.isFinite(x.gih) || !Number.isFinite(x.alsa))) throw Error('予測値の検証に失敗');
const adoptedCount = predicted.filter(x => x.gih_model_version === gihVersion).length;
const policy = readGz(url('../data/live-policy.json.gz')).policies.current;
const {cards: _cards, skipped: _skipped, ...meta} = target;  // `skipped` is a collection diagnostic, not part of the published forecast
const forecast = liveForecast({...meta, phase: 'PREVIEW', cards: predicted, deck_color: predictDeckColors(predicted),
  model_version: `${incumbent.version} + ${gihVersion} + ${adoptedAlsaVersion}`, gih_range_version: rangeVersion, ...(preliminary ? {preliminary: true} : {}), checked_at: new Date().toISOString(),
  adopted_gih_cards: adoptedCount, first_stage_cards: predicted.length - adoptedCount}, null, policy);
const summary = readGz(opt('summary-from') || url('../public/forecast.json.gz')).summary;
fs.writeFileSync(out, JSON.stringify({forecast, snapshots: [], summary}));
console.log(JSON.stringify({set: code, cards: forecast.cards.length, adopted_gih: adoptedCount, first_stage: predicted.length - adoptedCount, model_version: forecast.model_version}));
