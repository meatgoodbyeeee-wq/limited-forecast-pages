// Daily FRA Color Ratings job (GitHub Actions only; the site itself never calls 17Lands).
import fs from 'node:fs';
import {run} from '../lib/color-ratings.mjs';

const root = new URL('..', import.meta.url);
const paths = {snapshot: 'public/data/fra-actual-color-ratings.json', state: 'data/color-ratings-state.json'};
const io = {
  now: process.env.NOW ? new Date(process.env.NOW) : new Date(),
  readJson(p) { const f = new URL(p, root); if (!fs.existsSync(f)) return null; try { return JSON.parse(fs.readFileSync(f)); } catch { return null; } },
  writeJson(p, obj) { const f = new URL(p, root); fs.mkdirSync(new URL('.', f), {recursive: true}); fs.writeFileSync(f, JSON.stringify(obj, null, 1) + '\n'); },
  async fetchJson(url) {
    const r = await fetch(url, {headers: {'User-Agent': 'Sakiyomi/1.0 (limited forecast research; once a day)', Accept: 'application/json'}, signal: AbortSignal.timeout(90000)});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  },
  log: m => console.log(m),
};
await run(io, paths);
