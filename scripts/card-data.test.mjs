// node --test scripts/card-data.test.mjs — no network: the clock and the API are faked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {run, plan, matchCards, normName, jstDate} from '../lib/card-data.mjs';

const forecast = {forecast: {cards: [
  {id: 'a', name: 'Heartstring Puller'}, {id: 'b', name: "Kiora's Wrath"}, {id: 'c', name: 'Sun // Moon'}, {id: 'd', name: 'Aerid Konstrari'},
]}};
const row = (name, gih = 0.55, alsa = 4.2) => ({name, ever_drawn_win_rate: gih, ever_drawn_game_count: 1200, avg_seen: alsa, seen_count: 5000});
const PATHS = {snapshot: 'snap', state: 'state', publicDatasetStatus: 'live', forecast: 'fc'};

function world({now, files = {}, api = () => ({data: [row('Heartstring Puller')]})}) {
  const store = {fc: forecast, ...files}, calls = [], logs = [];
  const io = {
    now: new Date(now), log: m => logs.push(m),
    readJson: p => (p in store ? structuredClone(store[p]) : null),
    writeJson: (p, o) => { store[p] = structuredClone(o); },
    fetchJson: async url => { calls.push(url); const r = api(url); if (r instanceof Error) throw r; return r; },
  };
  return {io, store, calls, logs};
}
const live = status => ({status, observations: status === 'available' ? {cards: [{name: 'x', gih_n: 10}]} : null});

test('6. before 2026-10-13 00:00 JST: no API access', async () => {
  for (const now of ['2026-09-28T12:00:00Z', '2026-10-12T14:59:59Z']) {
    const w = world({now});
    const r = await run(w.io, PATHS);
    assert.equal(r.called, false); assert.equal(w.calls.length, 0); assert.equal(w.store.snap, undefined); assert.equal(w.store.state, undefined);
  }
});

test('7. from 2026-10-13 00:00 JST: one fetch, window 09-29..yesterday', async () => {
  const w = world({now: '2026-10-12T15:00:00Z'});
  const r = await run(w.io, PATHS);
  assert.equal(r.ok, true); assert.equal(w.calls.length, 1);
  assert.match(w.calls[0], /expansion=FRA&event_type=PremierDraft&start_date=2026-09-29&end_date=2026-10-12/);
  assert.equal(w.store.snap.fetched_date_jst, '2026-10-13'); assert.equal(w.store.snap.source_type, 'Card Data');
  assert.deepEqual(w.store.snap.cards[0], {id: 'a', name: 'Heartstring Puller', gih: 55.00000000000001, gih_n: 1200, alsa: 4.2, seen_n: 5000});
});

test('8. same JST day already done: no second call (also after a rerun)', async () => {
  const w = world({now: '2026-10-15T01:00:00Z'});
  await run(w.io, PATHS);
  w.io.now = new Date('2026-10-15T14:59:00Z'); // still 10-15 23:59 JST
  const r = await run(w.io, PATHS);
  assert.equal(r.called, false); assert.equal(w.calls.length, 1);
});

test('9. next day: exactly one new fetch that updates the snapshot', async () => {
  const w = world({now: '2026-10-15T01:00:00Z'});
  await run(w.io, PATHS);
  w.io.now = new Date('2026-10-15T15:30:00Z'); // 10-16 00:30 JST
  await run(w.io, PATHS); await run(w.io, PATHS);
  assert.equal(w.calls.length, 2); assert.match(w.calls[1], /end_date=2026-10-15/); assert.equal(w.store.snap.fetched_date_jst, '2026-10-16');
});

test('5. API failure keeps the previous snapshot and is not retried the same day', async () => {
  const prev = {window_end: '2026-10-13', fetched_date_jst: '2026-10-14', cards: [{id: 'a'}]};
  const w = world({now: '2026-10-15T01:00:00Z', files: {snap: prev}, api: () => new Error('HTTP 503')});
  const r = await run(w.io, PATHS);
  assert.equal(r.ok, false); assert.deepEqual(w.store.snap, prev); assert.equal(w.store.state.last_result, 'error');
  await run(w.io, PATHS);
  assert.equal(w.calls.length, 1);
});

test('5b. empty or malformed response never overwrites the snapshot', async () => {
  for (const body of [{data: []}, {nope: 1}, [{name: 'Unknown Card', ever_drawn_win_rate: 0.5}]]) {
    const prev = {window_end: '2026-10-13', cards: [{id: 'a'}]};
    const w = world({now: '2026-10-15T01:00:00Z', files: {snap: prev}, api: () => body});
    await run(w.io, PATHS);
    assert.deepEqual(w.store.snap, prev);
  }
});

test('10. Public Dataset not available: daily Card Data updates continue', async () => {
  const w = world({now: '2026-10-20T01:00:00Z', files: {live: live('unavailable')}});
  assert.equal((await run(w.io, PATHS)).ok, true); assert.equal(w.store.snap.public_dataset_available, false);
});

test('11. Public Dataset available: flag saved; Card Data continues only for ALSA (switchable off)', async () => {
  const w = world({now: '2026-10-20T01:00:00Z', files: {live: live('available')}});
  assert.equal((await run(w.io, PATHS)).ok, true); assert.equal(w.store.snap.public_dataset_available, true);
});

test('12. Public Dataset status unreadable: Card Data snapshot is not harmed', async () => {
  const prev = {window_end: '2026-10-18', cards: [{id: 'a'}]};
  const w = world({now: '2026-10-20T01:00:00Z', files: {snap: prev, live: '{broken'}});
  const r = await run(w.io, PATHS);
  assert.equal(r.ok, true); assert.equal(w.store.snap.public_dataset_available, false); assert.equal(w.store.snap.window_end, '2026-10-19');
});

test('window caps at 2026-10-26 and stops once the full window is saved', async () => {
  const w = world({now: '2026-10-28T01:00:00Z'});
  await run(w.io, PATHS);
  assert.match(w.calls[0], /end_date=2026-10-26/); assert.equal(w.store.snap.final, true);
  w.io.now = new Date('2026-10-29T01:00:00Z');
  assert.equal((await run(w.io, PATHS)).called, false); assert.equal(w.calls.length, 1);
});

test('name matching: case, Unicode, apostrophes, split cards; ambiguous/unknown dropped', () => {
  const rows = [row('HEARTSTRING PULLER'), row('Kiora’s Wrath'), row('Sun/Moon'), row('Sun'), row('Not A Card')];
  const {cards, unmatched} = matchCards(rows, forecast.forecast.cards);
  assert.deepEqual(cards.map(c => c.id).sort(), ['a', 'b', 'c']); assert.equal(unmatched, 1);
  const amb = matchCards([row('Twin')], [{id: '1', name: 'Twin'}, {id: '2', name: 'twin'}]);
  assert.equal(amb.cards.length, 0);
  assert.equal(normName('  Kiora’s  Wrath '), "kiora's wrath");
});

test('out-of-range values are stored as missing, not as numbers', () => {
  const {cards} = matchCards([row('Aerid Konstrari', 1.7, 0.2)], forecast.forecast.cards);
  assert.equal(cards[0].gih, null); assert.equal(cards[0].alsa, null);
});

test('JST dates', () => {
  assert.equal(jstDate(new Date('2026-10-12T15:00:00Z')), '2026-10-13');
  assert.equal(plan({now: new Date('2026-10-12T15:00:00Z')}).end, '2026-10-12');
});
