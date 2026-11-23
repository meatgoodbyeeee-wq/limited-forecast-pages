#!/usr/bin/env node
// Turns a 17Lands Color Ratings snapshot fetched by the data repository (17lands-limited-forecast-data:
// live/<code>-color-ratings.json, two colors, splashes not combined, all users) into the file the site reads as observed
// pair win rates (public/data/<code>-actual-color-ratings.json, same format as fra-actual-color-ratings.json).
// Observed values are shown next to the forecast and never blended into it. No 17Lands access here.
//   node scripts/set-color-actuals-from-snapshot.mjs TRK <snapshot.json> [--out <file>]
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {parseRatings, PAIRS} from '../lib/color-ratings.mjs';

const [code, src, ...rest] = process.argv.slice(2);
const opt = name => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : null; };
if (!code || !src) { console.error('usage: set-color-actuals-from-snapshot.mjs <SET> <snapshot.json> [--out f]'); process.exit(2); }
const upper = code.toUpperCase(), outPath = opt('--out') || `public/data/${code.toLowerCase()}-actual-color-ratings.json`;
const doc = JSON.parse(readFileSync(src, 'utf8'));
const day = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
if (doc.expansion !== upper || doc.user_group !== 'all' || doc.source_type !== 'Color Ratings' || doc.splash !== false || !Array.isArray(doc.rows))
  throw new Error('unexpected snapshot (set, user group, type, splash or rows)');
if (!day(doc.window_start) || !day(doc.window_end) || !day(doc.fetched_date_jst)) throw new Error('the snapshot has no date window');
const pairs = parseRatings(doc.rows);
if (PAIRS.some(p => !pairs[p])) throw new Error(`only ${Object.keys(pairs).length} of 10 two-color pairs in the snapshot`);
const out = {schema: 1, source: '17Lands', source_type: 'Color Ratings', expansion: upper, format: 'PremierDraft',
  source_url: doc.source_url, attribution: '17Lands (17lands.com) Color Ratings', splash: false,
  window_start: doc.window_start, window_end: doc.window_end, data_date: doc.window_end, final: !!doc.final,
  fetched_at: doc.fetched_at, fetched_date_jst: doc.fetched_date_jst, pairs};
mkdirSync(dirname(outPath), {recursive: true});
writeFileSync(outPath, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({set: upper, window: `${out.window_start}..${out.window_end}`, fetched_at: out.fetched_at, pairs: Object.keys(pairs).length,
  games: Object.values(pairs).reduce((s, v) => s + v.games, 0), out: outPath}));
