// node --test scripts/deviation-notes.test.mjs — no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {findDeviations, needsNote, parseNote, run} from '../lib/deviation-notes.mjs';

const card = (id, gih, range, colors = ['U'], rarity = 'common') => ({id, name: 'Card ' + id, gih, gih_range: range, colors, rarity, type_line: 'Creature', oracle_text: '', similar: []});
const cards = [card('a', 55, [52, 58]), card('b', 55, [52, 58]), card('c', 55, [52, 58]), card('d', 55, [52, 58], ['R'])];
const snap = {window_start: '2026-09-29', window_end: '2026-10-13', cards: [
  {id: 'a', gih: 61, gih_n: 5000}, {id: 'b', gih: 50, gih_n: 3000}, {id: 'c', gih: 61, gih_n: 400}, {id: 'd', gih: 56, gih_n: 9000}]};
const io = (answers = {}) => ({now: new Date('2026-10-14T00:00:00Z'), apiKey: 'k', model: 'm', log: () => {}, calls: 0,
  callModel(p) { this.calls++; return p.includes('Card b') ? answers.b ?? 'nonsense' : answers.a ?? '{"reasons":["理由1","理由2"],"reasons_en":["r1","r2"]}'; }});

test('only out-of-range cards with enough samples', () => {
  const d = findDeviations(cards, snap);
  assert.deepEqual(d.map(x => [x.card.id, x.direction]), [['a', 'above'], ['b', 'below']]);
  assert.equal(typeof d[0].context.all_cards_avg_diff, 'number');
});
test('no API key: nothing is called or written', async () => {
  const i = io(); i.apiKey = '';
  const r = await run({forecastCards: cards, snapshot: snap, notes: null, io: i});
  assert.equal(r.written, 0); assert.equal(i.calls, 0);
});
test('writes AI notes, skips unusable answers, keeps manual notes', async () => {
  const manual = {cards: {'Card b': {gih: {source: 'manual', reasons: ['手書き']}}}};
  const i = io();
  const r = await run({forecastCards: cards, snapshot: snap, notes: manual, io: i});
  assert.equal(i.calls, 1); assert.equal(r.written, 1);
  assert.deepEqual(r.notes.cards['Card a'].gih.reasons, ['理由1', '理由2']);
  assert.equal(r.notes.cards['Card a'].gih.source, 'ai'); assert.equal(r.notes.cards['Card a'].gih.data_as_of, '2026-10-13');
  assert.deepEqual(r.notes.cards['Card b'].gih.reasons, ['手書き']);
});
test('existing note is reused unless the card flipped side', () => {
  const d = findDeviations(cards, snap)[0];
  assert.equal(needsNote(d, {cards: {'Card a': {gih: {source: 'ai', direction: 'above', reasons: ['x']}}}}), false);
  assert.equal(needsNote(d, {cards: {'Card a': {gih: {source: 'ai', direction: 'below', reasons: ['x']}}}}), true);
});
test('output validation', () => {
  assert.equal(parseNote('no json'), null);
  assert.equal(parseNote('{"reasons":[]}'), null);
  const n = parseNote('前置き {"reasons":["<b>強い</b>\n理由", 3],"reasons_en":["ok"]}');
  assert.equal(n.reasons.length, 1); assert.ok(!/[<>\n]/.test(n.reasons[0]) && n.reasons[0].includes('強い')); assert.deepEqual(n.reasons_en, ['ok']);
});
