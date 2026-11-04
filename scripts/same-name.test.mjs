import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync, gzipSync} from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import {SET_ORDER, sameNameCards, similarityIndex, extraIndex} from '../lib/predict.mjs';
import {sameKey, targetFronts, lookupRefs} from './ja-targets.mjs';

const read = p => JSON.parse(gunzipSync(fs.readFileSync(new URL(p, import.meta.url))));
const refs = read('../data/similar-references.json.gz'), model = read('../data/model.json.gz').models.gih, labels = read('../data/similar-labels.json.gz');
const card = (set, name, extra = {}) => ({set, name, id: `${set}:${name}`, gih: 55, alsa: 4, gih_n: 4000, alsa_n: 9000, source: 'https://example.test', ...extra});

test('SET_ORDER: no duplicates and every set of the references is listed (otherwise its same-name rows sort last)', () => {
  assert.equal(new Set(SET_ORDER).size, SET_ORDER.length);
  const used = new Set([...refs.cards, ...refs.name_only].map(c => c.set));
  assert.deepEqual([...used].filter(s => !SET_ORDER.includes(s)), []);
  assert.deepEqual(refs.sets.filter(s => !SET_ORDER.includes(s)), []);
});

test('SET_ORDER follows the Scryfall release dates stored with the references (extra_sets and the 22 sets)', () => {
  const dated = (refs.extra_sets || []).filter(s => s.released_at && s.cards).map(s => [s.code, s.released_at]);
  const sorted = [...dated].sort((a, b) => a[1].localeCompare(b[1]) || SET_ORDER.indexOf(a[0]) - SET_ORDER.indexOf(b[0]));
  const byOrder = [...dated].sort((a, b) => SET_ORDER.indexOf(a[0]) - SET_ORDER.indexOf(b[0]));
  assert.deepEqual(byOrder.map(x => x[0]), sorted.map(x => x[0]));
});

test('sameNameCards: newest set first, one row per set and front name, main list wins, extra sets included', () => {
  const kenrith = card('MOM', 'Kenrith, the Returned King');
  const main = [card('MOM', 'Kenrith, the Returned King', {gih: 1}), card('DMU', 'Other')];
  const extra = [card('ELD', 'Kenrith, the Returned King'), card('ELD', 'Kenrith, the Returned King'), card('HBG', "Prosper, Tome-Bound"), card('MOM', 'Kenrith, the Returned King', {gih: 2}), card('KTK', 'Kenrith, the Returned King // Back')];
  const rows = sameNameCards(kenrith, main, extra);
  assert.deepEqual(rows.map(r => r.set), ['MOM', 'ELD', 'KTK']);
  assert.equal(rows[0].gih, 1);
  assert.deepEqual(sameNameCards(card('TRK', 'Prosper, Tome-Bound'), main, extra).map(r => r.set), ['HBG']);
});

test('sameNameCards: Alchemy "A-Name" is the same card as "Name"; the printed name stays; "Live Long and Prosper" is not Prosper', () => {
  const rows = sameNameCards(card('TRK', 'Prosper, Tome-Bound'), [], [card('HBG', 'A-Prosper, Tome-Bound'), card('FDN', 'Live Long and Prosper'), card('ONE', 'Prosper, Tome-Bound')]);
  assert.deepEqual(rows.map(r => [r.set, r.name]), [['ONE', 'Prosper, Tome-Bound'], ['HBG', 'A-Prosper, Tome-Bound']]);
  assert.equal(sameKey('A-Foo // Bar'), 'foo');
});

test('sameNameCards on the real references: ordered newest first, every row has the same front name', () => {
  for (const c of refs.name_only.slice(0, 200)) {
    const rows = sameNameCards(c, refs.cards, refs.name_only);
    assert.ok(rows.length >= 1 && rows.every(r => sameKey(r.name) === sameKey(c.name)));
    const ranks = rows.map(r => SET_ORDER.indexOf(r.set));
    assert.deepEqual(ranks, [...ranks].sort((a, b) => b - a));
  }
});

test('extra sets are same-name only: unlabelled name_only cards never become similar-card candidates', () => {
  const index = similarityIndex(refs.cards, model);
  const fake = ['HBG', 'FIN', 'ELD'].map(set => card(set, `Fake ${set}`, {oracle_text: 'Flying', type_line: 'Creature', gih_n: 99999, cmc: 2, rarity: 'rare', colors: ['W']}));
  const base = extraIndex(refs.name_only, index, model, labels), more = extraIndex([...refs.name_only, ...fake], index, model, labels);
  assert.equal(more.length, base.length);
  assert.ok(more.every(r => !fake.includes(r.c)));
  assert.ok(refs.cards.every(c => !['HBG', 'FIN', 'ELD'].includes(c.set)));
});

test('lookupRefs / targetFronts: extra-set cards get a Japanese lookup only when a forecast card shares the name', () => {
  const doc = {sets: ['MOM'], cards: [card('MOM', 'A')], name_only: [card('MOM', 'Bonus'), card('ELD', 'Kenrith, the Returned King'), card('HBG', 'A-Prosper, Tome-Bound'), card('HBG', 'Unrelated'), card('FIN', 'Unrelated 2')]};
  const {refs: kept, skipped} = lookupRefs(doc, new Set(['kenrith, the returned king', 'prosper, tome-bound']));
  assert.deepEqual(kept.map(c => `${c.set}|${c.name}`), ['MOM|A', 'MOM|Bonus', 'ELD|Kenrith, the Returned King', 'HBG|A-Prosper, Tome-Bound']);
  assert.deepEqual(skipped, {HBG: 1, FIN: 1});
  const root = new URL(`file://${fs.mkdtempSync(path.join(os.tmpdir(), 'jat-'))}/`);
  fs.mkdirSync(new URL('data/trk/', root), {recursive: true});
  fs.writeFileSync(new URL('data/trk/target.json.gz', root), gzipSync(JSON.stringify({cards: [{name: 'Prosper, Tome-Bound'}, {name: 'Foo // Bar'}]})));
  const fronts = targetFronts(root, [{name: 'Kenrith, the Returned King'}]);
  assert.deepEqual([...fronts].sort(), ['foo', 'kenrith, the returned king', 'prosper, tome-bound']);
});
