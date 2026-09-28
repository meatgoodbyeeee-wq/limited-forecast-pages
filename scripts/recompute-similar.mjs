// Recomputes each card's three "similar cards" in public/forecast.json.gz against
// data/similar-references.json.gz (22 past sets). Predictions themselves are untouched.
import fs from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import {similarityIndex, similarCards} from '../lib/predict.mjs';

const read = p => JSON.parse(gunzipSync(fs.readFileSync(new URL(p, import.meta.url))));
const FORECAST = new URL('../public/forecast.json.gz', import.meta.url);
const doc = read('../public/forecast.json.gz'), model = read('../data/model.json.gz'), refs = read('../data/similar-references.json.gz');
const index = similarityIndex(refs.cards, model.models.gih), pool = doc.forecast.cards;
let changed = 0;
doc.forecast.cards = pool.map(c => {
  const similar = similarCards(c, index, model.models.gih, pool);
  if (similar.map(s => s.set + s.name).join() !== (c.similar || []).map(s => s.set + s.name).join()) changed++;
  return {...c, similar};
});
fs.writeFileSync(FORECAST, gzipSync(JSON.stringify(doc)));
const sets = {}; for (const c of doc.forecast.cards) for (const s of c.similar) sets[s.set] = (sets[s.set] || 0) + 1;
console.log(`similar cards recomputed for ${pool.length} cards (${changed} changed) from ${refs.cards.length} references`);
console.log('sets used:', JSON.stringify(sets));
