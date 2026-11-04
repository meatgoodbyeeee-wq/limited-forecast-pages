import test from 'node:test';
import assert from 'node:assert/strict';
import {japaneseName, stripRuby} from './ja-name.mjs';

const A = 'oracle-swords', B = 'oracle-emeritus', D = 'oracle-dfc';
const swords = (extra = {}) => ({id: 'a1', lang: 'ja', oracle_id: A, name: 'Swords to Plowshares', printed_name: '剣を鍬に', set: 'trc', released_at: '2019-01-01', ...extra});
// "Archmage Emeritus // Swords to Plowshares": a face with the same name, but another card
const emeritus = (extra = {}) => ({id: 'b1', lang: 'ja', oracle_id: B, name: 'Archmage Emeritus // Swords to Plowshares', printed_name: '休戦の名誉教授 // 剣を鍬に', set: 'sos', released_at: '2026-04-01',
  card_faces: [{name: 'Archmage Emeritus', printed_name: '休戦の名誉教授'}, {name: 'Swords to Plowshares', printed_name: '剣を鍬に（別）'}], ...extra});
const ref = {name: 'Swords to Plowshares', set: 'STX', oracle_id: A};

test('the oracle_id decides: Swords to Plowshares is not taken from the card that only has such a face', () => {
  assert.equal(japaneseName([emeritus(), swords(), emeritus({id: 'b2', released_at: '2027-01-01'})], ref), '剣を鍬に');
  for (let n = 0; n < 5; n++) assert.equal(japaneseName([...Array(n).fill(0).map((_, i) => emeritus({id: `b${i + 9}`, released_at: `203${i}-01-01`})), swords()], ref), '剣を鍬に');
});

test('only the other card available: empty (English name is shown)', () => {
  assert.equal(japaneseName([emeritus()], ref), null);
  assert.equal(japaneseName([], ref), null);
  assert.equal(japaneseName([swords()], {...ref, oracle_id: null}), null);
  assert.equal(japaneseName([swords({lang: 'en'})], ref), null);
});

test('double-faced cards: only the faces that match the reference name', () => {
  const dfc = {id: 'd1', lang: 'ja', oracle_id: D, name: 'Front Face // Back Face', set: 'tdm', released_at: '2025-04-01',
    card_faces: [{name: 'Front Face', printed_name: '表の名前'}, {name: 'Back Face', printed_name: '裏の名前'}]};
  assert.equal(japaneseName([dfc], {name: 'Front Face // Back Face', set: 'TDM', oracle_id: D}), '表の名前 // 裏の名前');
  assert.equal(japaneseName([dfc], {name: 'Front Face', set: 'TDM', oracle_id: D}), '表の名前');
  assert.equal(japaneseName([dfc], {name: 'Back Face', set: 'TDM', oracle_id: D}), '裏の名前');
  assert.equal(japaneseName([{...dfc, card_faces: [dfc.card_faces[0], {name: 'Back Face'}]}], {name: 'Front Face // Back Face', set: 'TDM', oracle_id: D}), null);
});

test('same set first, otherwise the newest print', () => {
  const prints = [swords({id: 'x1', set: 'lea', printed_name: '旧名', released_at: '1993-01-01'}), swords({id: 'x2', set: 'stx', printed_name: '同セット名', released_at: '2021-04-23'}), swords({id: 'x3', set: 'm21', printed_name: '最新名', released_at: '2024-01-01'})];
  assert.equal(japaneseName(prints, ref), '同セット名');
  assert.equal(japaneseName(prints, {...ref, set: 'BLB'}), '最新名');
  assert.equal(japaneseName([...prints].reverse(), {...ref, set: 'BLB'}), '最新名');
});

test('furigana is removed', () => {
  assert.equal(stripRuby('旅（たび）路（じ）の続（つづ）き'), '旅路の続き');
  assert.equal(japaneseName([swords({printed_name: '不（ふ）屈（くつ）の追（つい）跡（せき）者（しゃ）'})], ref), '不屈の追跡者');
});
