// node --test scripts/set-forecast.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {SET_CONFIG, setConfig} from '../lib/set-config.mjs';
import {makeGihRange} from '../lib/gih-range-core.mjs';
import {makeAdoptedGih} from '../lib/adopted-gih-core.mjs';

const card = (o = {}) => ({id: 'a', name: 'Test Card', oracle_text: 'Flying', type_line: 'Creature — Test', mana_cost: '{1}{U}', rarity: 'common', gih: 55, ...o});
const rangeFile = {version: 'r1', fin_used: false, target_coverage: 0.8, fallback: {common: {creature: 3.1}},
  cards: [{id: 'a', name: 'Test Card', oracle_text: 'Flying', type_line: 'Creature — Test', mana_cost: '{1}{U}', radius: 2.5}]};
const adoptedFile = {version: 'g1', base: 55, cards: [{id: 'a', name: 'Test Card', oracle_text: 'Flying', type_line: 'Creature — Test', mana_cost: '{1}{U}',
  gih: 58, structured_delta: 2, text_delta: 1}]};

test('set config: sets are found by code, case-insensitively, and unpublished ones say so', () => {
  assert.equal(setConfig('trk').code, 'TRK');
  assert.equal(setConfig('TRK').forecast, 'forecast-trk.json');
  assert.equal(setConfig('TRK').available, false);
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

test('build-set-forecast: an unpublished set builds nothing and exits cleanly', () => {
  const r = spawnSync(process.execPath, ['scripts/build-set-forecast.mjs', 'TRK'], {encoding: 'utf8', env: {...process.env, BUILD_UNPUBLISHED: ''}});
  assert.equal(r.status, 0);
  assert.match(r.stdout, /not published/);
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
