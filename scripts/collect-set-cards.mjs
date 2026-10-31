// Collects the revealed cards of a set from the official gallery into data/<code>/target.json.gz (run by GitHub Actions only:
// the sandbox cannot reach Wizards). Cards already stored are kept (an incomplete response never deletes them); the gallery wins
// for cards it returns, except manually edited ones. Writes data/<code>/collect-state.json so a failure can be diagnosed.
//   node scripts/collect-set-cards.mjs TRK
import fs from 'node:fs';
import path from 'node:path';
import {gunzipSync, gzipSync} from 'node:zlib';
import {collectOfficial} from '../lib/official.mjs';
import {mergeOfficial, signature} from '../lib/refresh.mjs';
import {draftPool} from '../lib/draft-pool.mjs';
import {setConfig} from '../lib/set-config.mjs';

const code = (process.argv[2] || '').toUpperCase();
const cfg = setConfig(code);
if (!cfg?.galleries?.length) throw Error(`usage: node scripts/collect-set-cards.mjs <SET CODE> (known: FRA, TRK); got ${code || 'nothing'}`);
const dir = new URL(`../data/${code.toLowerCase()}/`, import.meta.url), file = new URL('target.json.gz', dir), state = new URL('collect-state.json', dir);
fs.mkdirSync(dir, {recursive: true});
const old = fs.existsSync(file) ? JSON.parse(gunzipSync(fs.readFileSync(file))) : {cards: []};
const log = {checked_at: new Date().toISOString(), set: code, stored_before: old.cards.length};
try {
  const incoming = await collectOfficial(code);
  const merged = mergeOfficial(old, incoming), pool = draftPool(merged.cards);
  const before = new Map(old.cards.map(c => [c.name, c]));
  const added = pool.filter(c => !before.has(c.name)).length, changed = pool.filter(c => before.has(c.name) && signature(c) !== signature(before.get(c.name))).length;
  const {skipped: _skipped, ...mergedMeta} = merged;  // diagnostic list, logged in collect-state.json only
  fs.writeFileSync(file, gzipSync(JSON.stringify({...mergedMeta, cards: pool})));
  Object.assign(log, {ok: true, gallery: incoming.source, entry_count: incoming.entry_count, skipped_counts: Object.fromEntries(Object.entries(incoming.skipped||{}).map(([k,v])=>[k,v.length])), skipped_sample: Object.fromEntries(Object.entries(incoming.skipped||{}).map(([k,v])=>[k,v.slice(0,40)])), cards: pool.length, added, changed});
} catch (e) {
  Object.assign(log, {ok: false, error: e.message});
  console.warn('公式カード情報の確認に失敗。保存済みのカードを保持:', e.message);
}
fs.writeFileSync(state, JSON.stringify(log, null, 1) + '\n');
console.log(JSON.stringify(log));
