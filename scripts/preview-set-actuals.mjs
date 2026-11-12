#!/usr/bin/env node
// Private preview only: turns a 17Lands Card Data snapshot fetched by the data repository
// (17lands-limited-forecast-data: live/trk-card-data.json) into the file the site reads as observed values
// (public/data/<code>-actual-card-data.json, format of lib/card-data.mjs). The output is NOT committed
// (see scripts/preview-trk.sh); observed values are shown in their own columns and never blended into the forecast.
//   node scripts/preview-set-actuals.mjs TRK <snapshot.json> [--forecast public/forecast-trk.json] [--out <file>]
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {matchCards} from '../lib/card-data.mjs';

const [code, src, ...rest] = process.argv.slice(2);
const opt = name => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : null; };
if (!code || !src) { console.error('usage: preview-set-actuals.mjs <SET> <snapshot.json> [--forecast f] [--out f]'); process.exit(2); }
const lower = code.toLowerCase();
const forecastPath = opt('--forecast') || `public/forecast-${lower}.json`;
const outPath = opt('--out') || `public/data/${lower}-actual-card-data.json`;
const doc = JSON.parse(readFileSync(src, 'utf8'));
const forecast = JSON.parse(readFileSync(forecastPath, 'utf8')).forecast;
const day = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
if (doc.expansion !== code.toUpperCase() || doc.user_group !== 'all' || !Array.isArray(doc.cards)) throw new Error('unexpected snapshot (set, user group or rows)');
if (!day(doc.window_start) || !day(doc.window_end) || !day(doc.fetched_date_jst)) throw new Error('the snapshot has no date window (period must be "window")');
const {cards, unmatched} = matchCards(doc.cards, forecast.cards);
if (cards.length < forecast.cards.length * 0.9) throw new Error(`only ${cards.length} of ${forecast.cards.length} cards matched`);
const out = {schema: 1, source: '17Lands', source_type: 'Card Data', expansion: code.toUpperCase(), format: 'PremierDraft',
  source_url: doc.source_url, attribution: '17Lands (17lands.com) Card Data',
  window_start: doc.window_start, window_end: doc.window_end, data_date: doc.window_end, final: false,
  fetched_at: doc.fetched_at, fetched_date_jst: doc.fetched_date_jst, preview_only: true, cards};
mkdirSync(dirname(outPath), {recursive: true});
writeFileSync(outPath, JSON.stringify(out) + '\n');
const n = min => cards.filter(c => c.gih != null && c.gih_n >= min).length;
console.log(JSON.stringify({set: out.expansion, window: `${out.window_start}..${out.window_end}`, fetched_at: out.fetched_at, matched: cards.length, unmatched,
  gih_shown: cards.filter(c => c.gih != null).length, gih_1000: n(1000), alsa_shown: cards.filter(c => c.alsa != null).length, out: outPath}));
