// Re-apply the adopted GIH model (data/adopted-gih-fra.json + data/gih-range-fra.json) to the published forecast.
// Used when the GIH model changes; scripts/refresh-forecast.mjs only re-predicts when the official cards change.
// Run after `gunzip -k data/adopted-gih-fra.json.gz public/forecast.json.gz`; writes public/forecast.json.gz
// and archives the previous forecast under data/archive/.
//   node scripts/apply-gih-model.mjs <archive-name>
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {applyAdoptedGih, adoptedGihVersion} from '../lib/adopted-gih.mjs';
import {gihRangeVersion} from '../lib/gih-range.mjs';
import {predictDeckColors} from '../lib/deck-color.mjs';

const archiveName = process.argv[2];
if (!archiveName) throw Error('usage: node scripts/apply-gih-model.mjs <archive-name>');
const src = new URL('../public/forecast.json', import.meta.url);
const current = JSON.parse(fs.readFileSync(src));
const f = current.forecast;
if (f.phase !== 'PREVIEW') throw Error(`forecast phase is ${f.phase}; re-applying a pre-release model after observations is not allowed`);

fs.mkdirSync(new URL('../data/archive/', import.meta.url), {recursive: true});
fs.writeFileSync(new URL(`../data/archive/${archiveName}.json.gz`, import.meta.url), gzipSync(JSON.stringify(current)));

// Drop the old pre-release GIH so the range is centred on the new prediction, then record the new one.
const stripped = f.cards.map(({pre_release_gih, ...card}) => card);
const cards = applyAdoptedGih(stripped).map(card => ({...card, pre_release_gih: card.gih}));
const missed = cards.filter(card => card.gih_model_version !== adoptedGihVersion).map(card => card.name);
if (missed.length) throw Error(`cards not covered by the adopted GIH file: ${missed.join(', ')}`);
if (cards.some(card => !Number.isFinite(card.gih) || card.gih_range?.length !== 2)) throw Error('invalid GIH values');

const parts = f.model_version.split(' + ');
if (parts.length !== 3) throw Error(`unexpected model_version ${f.model_version}`);
parts[1] = adoptedGihVersion;
const forecast = {...f, cards, deck_color: predictDeckColors(cards), model_version: parts.join(' + '),
  gih_range_version: gihRangeVersion, gih_model_applied_at: new Date().toISOString(),
  previous_forecast: `data/archive/${archiveName}.json.gz`};
fs.writeFileSync(new URL('../public/forecast.json.gz', import.meta.url), gzipSync(JSON.stringify({...current, forecast})));
console.log(JSON.stringify({cards: cards.length, model_version: forecast.model_version, gih_range_version: gihRangeVersion,
  deck_color_top: forecast.deck_color.rows.slice(0, 3).map(r => r.pair)}));
