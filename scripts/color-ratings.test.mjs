import test from 'node:test';
import assert from 'node:assert/strict';
import {plan, parseRatings, pairOf, apiUrl, run} from '../lib/color-ratings.mjs';

const rows = [
  {is_summary: true, color_name: 'Two-color decks', wins: 500, games: 1000},
  {is_summary: false, color_name: 'Azorius (WU)', short_name: 'WU', wins: 560, games: 1000},
  {is_summary: false, color_name: 'Azorius + Splash', short_name: 'WU+', wins: 1, games: 2},
  {is_summary: false, color_name: 'Mono-White (W)', short_name: 'W', wins: 5, games: 10},
  ...['WB','WR','WG','UB','UR','UG','BR','BG','RG'].map(p => ({is_summary: false, short_name: p, wins: 550, games: 1000})),
];
test('parse keeps only the ten exact two-color rows', () => {
  const p = parseRatings(rows);
  assert.equal(Object.keys(p).length, 10);
  assert.ok(Math.abs(p.WU.wr_pct - 56) < 1e-9); assert.equal(p.WU.games, 1000);
  assert.equal(pairOf({short_name: 'BU'}), 'UB');
  assert.equal(pairOf({color_name: 'Golgari (BG)'}), 'BG');
  assert.equal(pairOf({short_name: 'WUB'}), null);
});
test('rules: embargo, once per JST day, window end', () => {
  const t = s => new Date(s);
  assert.equal(plan({now: t('2026-10-12T14:59:00Z')}).fetch, false);
  assert.equal(plan({now: t('2026-10-14T10:00:00Z')}).fetch, true);
  assert.equal(plan({now: t('2026-10-14T10:00:00Z'), state: {last_attempt_date_jst: '2026-10-14'}}).fetch, false);
  assert.equal(plan({now: t('2026-10-14T10:00:00Z'), snapshot: {window_end: '2026-10-13'}}).fetch, false);
  assert.match(apiUrl({start: '2026-09-29', end: '2026-10-13'}), /combine_splash=false/);
});
test('failed or short response never overwrites the snapshot', async () => {
  const files = {}; const io = {now: new Date('2026-10-14T10:00:00Z'), readJson: p => files[p] ?? null, writeJson: (p, o) => { files[p] = o; }, fetchJson: async () => [rows[1]], log() {}};
  await run(io, {snapshot: 's', state: 't'});
  assert.equal(files.s, undefined); assert.ok(files.t.last_error);
});
