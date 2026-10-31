// node --test scripts/set-forecast.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {SET_CONFIG, setConfig} from '../lib/set-config.mjs';
import {makeGihRange} from '../lib/gih-range-core.mjs';
import {makeAdoptedGih} from '../lib/adopted-gih-core.mjs';

const card = (o = {}) => ({id: 'a', name: 'Test Card', oracle_text: 'Flying', type_line: 'Creature — Test', mana_cost: '{1}{U}', rarity: 'common', gih: 55, ...o});
const rangeFile = {version: 'r1', fin_used: false, target_coverage: 0.8, fallback: {common: {creature: 3.1}},
  cards: [{id: 'a', name: 'Test Card', oracle_text: 'Flying', type_line: 'Creature — Test', mana_cost: '{1}{U}', radius: 2.5}]};
const adoptedFile = {version: 'g1', base: 55, cards: [{id: 'a', name: 'Test Card', oracle_text: 'Flying', type_line: 'Creature — Test', mana_cost: '{1}{U}',
  gih: 58, structured_delta: 2, text_delta: 1}]};

test('set config: sets are found by code, case-insensitively, and the publishing flag is set for published sets', () => {
  assert.equal(setConfig('trk').code, 'TRK');
  assert.equal(setConfig('TRK').forecast, 'forecast-trk.json');
  assert.equal(setConfig('TRK').available, true);
  assert.equal(setConfig('FRA').live, true);
  assert.equal(setConfig('XXX'), undefined);
  assert.equal(setConfig(''), undefined);
  assert.equal(new Set(SET_CONFIG.map(s => s.code).filter(Boolean)).size, SET_CONFIG.filter(s => s.code).length);
});

test('gih range: centred on the forecast; changed card text falls back to the rarity x type table', () => {
  const {withGihRange, gihRangeVersion} = makeGihRange(rangeFile);
  assert.equal(gihRangeVersion, 'r1');
  assert.deepEqual(withGihRange(card()).gih_range, [52.5, 57.5]);
  assert.deepEqual(withGihRange(card({oracle_text: 'Flying, haste'})).gih_range, [51.9, 58.1]);
  assert.equal(withGihRange(card({rarity: 'mythic', oracle_text: 'x'})).gih_range, undefined); // no known radius: untouched
});

test('gih range: a file that used FIN or has another coverage is refused', () => {
  assert.throws(() => makeGihRange({...rangeFile, fin_used: true}));
  assert.throws(() => makeGihRange({...rangeFile, target_coverage: 0.9}));
});

test('adopted GIH: matching cards take the adopted value, edited cards keep the first-stage value', () => {
  const {withGihRange} = makeGihRange(rangeFile);
  const {applyAdoptedGih, adoptedGihVersion} = makeAdoptedGih(adoptedFile, withGihRange);
  assert.equal(adoptedGihVersion, 'g1');
  const [hit, edited] = applyAdoptedGih([card({gih: 50}), card({gih: 50, oracle_text: 'Flying, haste'})]);
  assert.equal(hit.gih, 58);
  assert.equal(hit.gih_model_version, 'g1');
  assert.deepEqual(hit.gih_range, [55.5, 60.5]);
  assert.equal(edited.gih, 50);
  assert.equal(edited.gih_model_version, undefined);
});

test('build-set-forecast: a published set builds its forecast from the data folder', () => {
  const out = path.join(os.tmpdir(), `forecast-trk-test-${process.pid}.json`);
  const r = spawnSync(process.execPath, ['scripts/build-set-forecast.mjs', 'TRK', '--out', out], {encoding: 'utf8', env: {...process.env, BUILD_UNPUBLISHED: ''}});
  assert.equal(r.status, 0, r.stderr);
  const built = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.equal(built.set, 'TRK');
  assert.ok(built.cards > 0);
  assert.equal(built.first_stage, 0, 'every card has the adopted GIH prediction');
  fs.rmSync(out, {force: true});
});

test('adopted GIH: per-model wording is used when the file has texts, and the default wording is unchanged without them', () => {
  const {withGihRange} = makeGihRange(rangeFile);
  const plain = makeAdoptedGih(adoptedFile, withGihRange).applyAdoptedGih([card()])[0];
  assert.match(plain.note, /AIが読み取ったカード効果を含む/);
  assert.equal(plain.gih_reason[0].label, '構造化特徴量（AI抽出の効果を含む）');
  const texts = {structured_label: 'L', summary: 'S', note: 'N'};
  const custom = makeAdoptedGih({...adoptedFile, texts}, withGihRange).applyAdoptedGih([card()])[0];
  assert.equal(custom.note, 'N');
  assert.equal(custom.gih_explanation.summary, 'S');
  assert.equal(custom.gih_reason[0].label, 'L');
  assert.equal(custom.gih, plain.gih);
});

test('adopted GIH: a reasons file of the same model version adds the plain-language reason; another version is refused', () => {
  const {withGihRange} = makeGihRange(rangeFile);
  const reasons = {version: 'g1', cards: [{id: 'a', name: 'Test Card', ja: '飛行を持つから、平均より高い勝率が見込まれる。', en: 'It has flying, so it is expected to do better than average.'}]};
  const withReason = makeAdoptedGih(adoptedFile, withGihRange, reasons).applyAdoptedGih([card()])[0];
  assert.deepEqual(withReason.gih_reason_text, {ja: reasons.cards[0].ja, en: reasons.cards[0].en});
  assert.equal(withReason.gih, 58);
  assert.equal(makeAdoptedGih(adoptedFile, withGihRange).applyAdoptedGih([card()])[0].gih_reason_text, undefined);
  const renamed = {...reasons, cards: [{...reasons.cards[0], name: 'Old Name'}]};
  assert.equal(makeAdoptedGih(adoptedFile, withGihRange, renamed).applyAdoptedGih([card()])[0].gih_reason_text, undefined);
  assert.throws(() => makeAdoptedGih(adoptedFile, withGihRange, {...reasons, version: 'g0'}), /different model versions/);
});
