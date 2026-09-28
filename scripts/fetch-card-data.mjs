// Daily FRA Card Data job (GitHub Actions only; the site itself never calls 17Lands).
// NOW=<ISO time> overrides the clock for reproducible checks.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {run} from '../lib/card-data.mjs';

const root = new URL('..', import.meta.url);
const paths = {
  snapshot: 'public/data/fra-actual-card-data.json',
  state: 'data/card-data-state.json',
  publicDatasetStatus: process.env.PUBLIC_DATASET_STATUS || 'public/live/fra-public-game.json',
  forecast: 'public/forecast.json.gz',
};
const io = {
  now: process.env.NOW ? new Date(process.env.NOW) : new Date(),
  readJson(p) {
    const f = new URL(p, root);
    if (!fs.existsSync(f)) return null;
    try { const raw = fs.readFileSync(f); return JSON.parse(p.endsWith('.gz') ? gunzipSync(raw) : raw); } catch { return null; }
  },
  writeJson(p, obj) { const f = new URL(p, root); fs.mkdirSync(new URL('.', f), {recursive: true}); fs.writeFileSync(f, JSON.stringify(obj, null, 1) + '\n'); },
  async fetchJson(url) {
    const r = await fetch(url, {headers: {'User-Agent': 'Sakiyomi/1.0 (limited forecast research; once a day)', Accept: 'application/json'}, signal: AbortSignal.timeout(90000)});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },
  log: m => console.log(m),
};
await run(io, paths);
