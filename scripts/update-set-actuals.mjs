#!/usr/bin/env node
// Daily refresh of the 17Lands observed values for sets other than FRA (lib/set-config.mjs: actuals: true, live: false).
// Run by .github/workflows/set-actuals.yml. It never calls 17Lands: it only converts the snapshot that the data
// repository already fetched (17lands-limited-forecast-data: live/<code>-card-data.json, all users only).
// A set is updated only when
//   - the time is past its actuals_public_from (17Lands' embargo period: the 12th day after the MTG Arena release),
//   - public/data/<code>-actual-card-data.json is already on this branch (the first publication is a reviewed PR), and
//   - the snapshot is newer than the published file.
//   DATA_LIVE=<path to the data repository's live/> node scripts/update-set-actuals.mjs   (NOW=<ISO time> overrides the clock)
import {existsSync, readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {SET_CONFIG} from '../lib/set-config.mjs';

const live = process.env.DATA_LIVE || 'data-source/live';
const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const run = (cmd, args) => { const r = spawnSync(cmd, args, {stdio: 'inherit'}); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed`); };
let failed = false;

for (const s of SET_CONFIG.filter(s => s.actuals && !s.live && s.code)) {
  const code = s.code, lower = code.toLowerCase(), out = `public/data/${lower}-actual-card-data.json`, snap = `${live}/${lower}-card-data.json`;
  const skip = why => console.log(`${code}: ${why}`);
  try {
    if (!s.actuals_public_from || now.getTime() < Date.parse(s.actuals_public_from)) { skip(`not before ${s.actuals_public_from || '(no actuals_public_from)'}`); continue; }
    if (!existsSync(out)) { skip(`${out} is not published yet (first publication is a reviewed PR)`); continue; }
    if (!existsSync(snap)) { skip(`no snapshot at ${snap}`); continue; }
    const doc = read(snap), cur = read(out);
    if (doc.expansion !== code || doc.user_group !== 'all') throw new Error('unexpected snapshot (set or user group)');
    if (!(Date.parse(doc.fetched_at) > Date.parse(cur.fetched_at || 0))) { skip(`published file is up to date (${cur.fetched_at})`); continue; }
    run('node', ['scripts/build-set-forecast.mjs', code]);
    run('node', ['scripts/set-actuals-from-snapshot.mjs', code, snap, '--out', out]);
  } catch (e) { failed = true; console.error(`${code}: ${e.message}`); }
}
if (failed) process.exit(1);
