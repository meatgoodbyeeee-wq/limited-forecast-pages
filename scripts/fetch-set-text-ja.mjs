// Builds data/<code>/card-text-ja.json: the official Japanese type line and rules text of a set that is not out yet (TRK),
// read from the Japanese locale of the official card gallery (same source as the FRA text in fetch-japanese-text.mjs).
// GitHub Actions only (the cloud sandbox cannot reach Wizards).   node scripts/fetch-set-text-ja.mjs TRK
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {setConfig} from '../lib/set-config.mjs';
import {japaneseLines} from './ja-lines.mjs';

const code = (process.argv[2] || '').toUpperCase(), cfg = setConfig(code);
if (!cfg?.galleries_ja?.length || code === 'FRA') throw Error(`usage: node scripts/fetch-set-text-ja.mjs <SET CODE other than FRA>; got ${code || 'nothing'}`);
const dir = new URL(`../data/${code.toLowerCase()}/`, import.meta.url), OUT = new URL('card-text-ja.json', dir);
const SPACE = 'https://cdn.contentful.com/spaces/s5n2t79q9icq/environments/master', UA = {'User-Agent': 'Sakiyomi/1.0 (limited forecast research)'};
const get = async (url, json = true) => {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, {headers: UA, signal: AbortSignal.timeout(60000)});
    if (r.status === 429 && attempt < 5) { await new Promise(s => setTimeout(s, 2 ** attempt * 2000)); continue; }
    if (!r.ok) throw Error(`${r.status} ${url.split('?')[0]}`);
    return json ? r.json() : r.text();
  }
};
const entities = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const clean = s => entities(entities(s || '')).replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/\\([{}])/g, '$1').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
const typeLine = ({sup = [], types = [], sub = []}) => sup.map(x => x === '伝説' ? '伝説の' : x).join('') + types.join('・') + (sub.length ? ' — ' + sub.join('・') : '');

const cards = JSON.parse(gunzipSync(fs.readFileSync(new URL('target.json.gz', dir)))).cards, en = new Map(cards.map(c => [c.id, c]));
const stats = {cards: cards.length, japanese: 0, aligned: 0, no_breaks: 0}, errors = [];
let key, gallery;
for (const g of cfg.galleries_ja) {
  const html = await get(g, false), paths = [...html.matchAll(/<script[^>]*src="(\/_nuxt\/[^" ]+)"/g)].map(m => m[1]);
  for (const p of [...paths.filter(p => /\/119\./.test(p)), ...paths.filter(p => !/\/119\./.test(p))]) {
    key = (await get('https://magic.wizards.com' + p, false)).match(/CTF_ACCESS_TOKEN:"([^"]+)"/)?.[1];
    if (key) break;
  }
  if (key) { gallery = g; break; }
}
if (!key) throw Error('no Contentful delivery key found');
const locale = (await get(`${SPACE}/locales?access_token=${key}`)).items.map(l => l.code).find(c => /^ja/i.test(c));
if (!locale) throw Error('no Japanese locale');
const out = {}, ids = cards.map(c => c.id);
for (let i = 0; i < ids.length; i += 80) {
  const d = await get(`${SPACE}/entries?${new URLSearchParams({access_token: key, 'sys.id[in]': ids.slice(i, i + 80).join(','), limit: '100', include: '2', locale})}`);
  const links = {}; for (const e of d.includes?.Entry || []) links[e.sys.id] = e.fields;
  const labels = refs => (refs || []).map(r => links[r.sys.id]?.label || links[r.sys.id]?.name || '').filter(Boolean);
  for (const e of d.items) {
    const f = e.fields, run_on = clean(f.rulesText), card = en.get(e.sys.id);
    if (!/[぀-ヿ一-鿿]/.test(run_on + (f.name || ''))) { errors.push(`${card?.name || e.sys.id}: not Japanese`); continue; }
    const text = run_on ? japaneseLines(run_on, card?.oracle_text) : '';
    stats.japanese++; if (text) stats.aligned++; else if (run_on) stats.no_breaks++;
    out[e.sys.id] = {name: f.name || '', type_line: typeLine({sup: labels(f.supertypes), types: labels(f.type), sub: labels(f.subtypes)}), oracle_text: text || run_on};
  }
}
fs.writeFileSync(OUT, JSON.stringify({generated_at: new Date().toISOString(), source: `${gallery} (Contentful locale ${locale})`, stats, errors, cards: out}, null, 1) + '\n');
console.log(JSON.stringify({stats, errors: errors.slice(0, 10)}));
if (stats.japanese < cards.length * 0.9) process.exit(1);
