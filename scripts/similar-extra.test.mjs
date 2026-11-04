import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {similarityIndex, extraIndex, similarCards, similarCardsLabelled} from '../lib/predict.mjs';

const read = p => JSON.parse(gunzipSync(fs.readFileSync(new URL(p, import.meta.url))));
const model = read('../data/model.json.gz').models.gih, refs = read('../data/similar-references.json.gz'), labels = read('../data/similar-labels.json.gz');
const front = n => String(n).split(' // ')[0].trim().toLowerCase();
const index = similarityIndex(refs.cards, model), extra = extraIndex(refs.name_only, index, model, labels);

test('extraIndex: only labelled name_only cards, one per set and front name, none already in the main list', () => {
  const keys = extra.map(r => `${r.c.set}|${front(r.c.name)}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.ok(extra.every(r => labels.refs[`${r.c.set}|${r.c.name}`]));
  const main = new Set(refs.cards.map(c => `${c.set}|${front(c.name)}`));
  assert.ok(keys.every(k => !main.has(k)));
  assert.ok(extra.length > 0);
  assert.deepEqual(extraIndex(refs.name_only, index, model, null), []);
  assert.deepEqual(extraIndex(refs.name_only, index, model, {...labels, refs: {}}), []);
});

test('similarCardsLabelled with extras: three cards, never the same card, extras can appear; without extras the result is the old one', () => {
  const pool = read('../public/forecast.json.gz').forecast.cards;
  const names = new Set(extra.map(r => `${r.c.set}|${r.c.name}`));
  let used = 0;
  for (const c of pool) {
    const withExtra = similarCardsLabelled(c, index, model, pool, labels, 3, extra), without = similarCardsLabelled(c, index, model, pool, labels);
    assert.equal(withExtra.length, 3);
    assert.ok(withExtra.every(s => front(s.name) !== front(c.name)));
    assert.ok(without.every(s => !names.has(`${s.set}|${s.name}`)));
    used += withExtra.filter(s => names.has(`${s.set}|${s.name}`)).length;
  }
  assert.ok(used > 0);
  // the old method (fallback for cards without a label vector) never uses the extras
  const c = {...pool[0], id: 'no-label-vector'};
  assert.deepEqual(similarCardsLabelled(c, index, model, pool, labels, 3, extra).map(s => s.name), similarCards(c, index, model, pool).map(s => s.name));
});
