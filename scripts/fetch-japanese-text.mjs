// Builds data/card-text-ja.json: official Japanese FRA card text (Wizards card gallery,
// Japanese locale) and Japanese names of past-set "similar cards" (Scryfall).
// Always writes the file with stats/errors so a failed source can be diagnosed from the commit.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {japaneseLines} from './ja-lines.mjs';
import {japaneseNameInfo, oracleOf, stripRuby} from './ja-name.mjs';
import {targetFronts, lookupRefs} from './ja-targets.mjs';

const OUT = new URL('../data/card-text-ja.json', import.meta.url);
const UA = {'User-Agent': 'Sakiyomi/1.0 (limited forecast research)', Accept: 'application/json'};
const SPACE = 'https://cdn.contentful.com/spaces/s5n2t79q9icq/environments/master';
const GALLERIES = ['https://magic.wizards.com/ja/products/reality-fracture/card-image-gallery', 'https://magic.wizards.com/en/products/reality-fracture/card-image-gallery'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Retries rate limits (429) with backoff, honouring Retry-After.
const get = async (url, json = true) => {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(url, {headers: UA, signal: AbortSignal.timeout(60000)});
    if (r.status === 429 && attempt < 5) { await sleep((Number(r.headers.get('retry-after')) || 2 ** attempt * 2) * 1000); continue; }
    if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}`);
    return json ? r.json() : r.text();
  }
};

const forecast = JSON.parse(gunzipSync(fs.readFileSync(new URL('../public/forecast.json.gz', import.meta.url)))).forecast;
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const out = {generated_at: new Date().toISOString(), sources: {}, stats: {}, errors: [], fra: previous.fra || {}, similar: {}};
const entities = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
// Paragraph/line tags become newlines; escaped markup (&lt;i&gt;) is decoded first so it is stripped too.
const clean = s => entities(entities(s || ''))
  .replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li)>/gi, '\n').replace(/<[^>]+>/g, '')
  .replace(/\\([{}])/g, '$1').replace(/\r/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();

// ---- FRA: official Japanese text from the gallery's Contentful space
try {
  let key, gallery;
  for (const g of GALLERIES) {
    try {
      const html = await get(g, false);
      const paths = [...html.matchAll(/<script[^>]*src="(\/_nuxt\/[^" ]+)"/g)].map(m => m[1]);
      for (const p of [...paths.filter(p => /\/119\./.test(p)), ...paths.filter(p => !/\/119\./.test(p))]) {
        const js = await get('https://magic.wizards.com' + p, false);
        key = js.match(/CTF_ACCESS_TOKEN:"([^"]+)"/)?.[1];
        if (key) break;
      }
      if (key) { gallery = g; break; }
    } catch (e) { out.errors.push('gallery: ' + e.message); }
  }
  if (!key) throw new Error('no Contentful delivery key found');
  const locales = (await get(`${SPACE}/locales?access_token=${key}`)).items.map(l => l.code);
  out.stats.contentful_locales = locales;
  const locale = locales.find(c => /^ja/i.test(c));
  if (!locale) throw new Error('no Japanese locale in ' + locales.join(','));
  const ids = forecast.cards.map(c => c.id), fra = {};
  for (let i = 0; i < ids.length; i += 80) {
    const q = new URLSearchParams({access_token: key, 'sys.id[in]': ids.slice(i, i + 80).join(','), limit: '100', include: '2', locale});
    const d = await get(`${SPACE}/entries?${q}`);
    const links = {}; for (const e of d.includes?.Entry || []) links[e.sys.id] = e.fields;
    const labels = refs => (refs || []).map(r => links[r.sys.id]?.label || links[r.sys.id]?.name || '').filter(Boolean);
    for (const e of d.items) {
      const f = e.fields;
      fra[e.sys.id] = {name: f.name || '', type_parts: {super: labels(f.supertypes), types: labels(f.type), sub: labels(f.subtypes)}, run_on: clean(f.rulesText)};
    }
    await sleep(200);
  }
  const withText = Object.values(fra).filter(c => c.run_on && /[぀-ヿ一-鿿]/.test(c.run_on + c.name)).length;
  out.stats.fra = {cards: Object.keys(fra).length, japanese: withText};
  if (withText < ids.length * 0.5) throw new Error(`locale ${locale} returned Japanese text for only ${withText}/${ids.length} cards`);
  out.fra = fra; out.sources.fra = `${gallery} (Contentful locale ${locale})`;
} catch (e) { out.errors.push('fra: ' + e.message); }

// ---- FRA on Scryfall (Japanese printed text keeps the official line breaks when available)
try {
  const sets = (await get('https://api.scryfall.com/sets')).data;
  const set = sets.find(x => x.name === 'Reality Fracture') || sets.find(x => x.code === 'fra');
  out.stats.scryfall_fra_set = set ? `${set.code} (${set.released_at}, ${set.card_count} cards)` : 'not found';
  if (set) {
    const byName = {};
    let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`set:${set.code} lang:ja`)}&unique=prints`;
    while (url) {
      const d = await get(url).catch(e => { if (String(e.message).startsWith('404')) return {data: [], has_more: false}; throw e; });
      for (const c of d.data) {
        const faces = c.card_faces?.length ? c.card_faces : [c];
        const text = faces.map(f => f.printed_text || '').filter(Boolean).join('\n//\n');
        if (text && !byName[c.name]) byName[c.name] = {printed_text: text, printed_type_line: faces.map(f => f.printed_type_line || '').filter(Boolean).join(' // ')};
      }
      url = d.has_more ? d.next_page : null;
      await sleep(500);
    }
    out.stats.scryfall_fra_ja = Object.keys(byName).length;
    out.scryfall_fra = byName;
  }
} catch (e) { out.errors.push('scryfall fra: ' + e.message); }

// ---- Final FRA entries: name, Japanese type line, rules text with line breaks
// Prefer Scryfall's Japanese printed text (official line breaks) once it exists; otherwise rebuild
// the breaks from the English text; otherwise leave the text out so the page falls back to English.
{
  const en = new Map(forecast.cards.map(c => [c.id, c])), sf = out.scryfall_fra || {}, count = {scryfall: 0, aligned: 0, none: 0};
  const typeLine = ({super: sup = [], types = [], sub = []}) => sup.map(x => x === '伝説' ? '伝説の' : x).join('') + types.join('・') + (sub.length ? ' — ' + sub.join('・') : '');
  for (const [id, e] of Object.entries(out.fra)) {
    if (e.run_on === undefined) continue; // kept from a previous run and already final
    const card = en.get(id), fromSf = card && sf[card.name]?.printed_text;
    const text = fromSf || (e.run_on ? japaneseLines(e.run_on, card?.oracle_text) : null);
    count[fromSf ? 'scryfall' : text ? 'aligned' : 'none']++;
    out.fra[id] = {name: e.name, type_line: typeLine(e.type_parts || {}), oracle_text: text || ''};
  }
  out.stats.fra_text = count;
  delete out.scryfall_fra;
}

// ---- Past sets: Japanese printed names from Scryfall, matched by oracle_id (see ja-name.mjs)
// Candidate list = every card of the similar-card references (any forecast can show any of them) with its Scryfall oracle_id.
const LOOKUP = 'v6'; // when it changes, every stored name is fetched again
const refsFile = new URL('../data/similar-references.json.gz', import.meta.url);
const refDoc = fs.existsSync(refsFile) ? JSON.parse(gunzipSync(fs.readFileSync(refsFile))) : {};
// Extra same-name-only sets (~10,000 cards) are looked up only for cards that share a name with a forecast-set card (FRA, TRK, ...); the 22 reference sets are looked up in full.
const {refs, skipped: extraSkipped} = lookupRefs(refDoc, targetFronts(new URL('../', import.meta.url), forecast.cards));
out.stats.same_name_extra_not_looked_up = extraSkipped;
const refByKey = new Map(); // `SET|name` (full name and front name) -> reference card
for (const c of refs) for (const k of new Set([c.name, c.name.split(' // ')[0]])) if (!refByKey.has(`${c.set}|${k}`)) refByKey.set(`${c.set}|${k}`, c);
const shown = new Set(forecast.cards.flatMap(c => (c.similar || []).map(s => `${String(s.set).toUpperCase()}|${s.name}`)));
const cacheOk = previous.sources?.similar_lookup === LOOKUP;
const prevOracle = cacheOk ? previous.similar_oracle || {} : {};
out.similar = {}; out.similar_oracle = {};
const partial = new Set(cacheOk ? previous.similar_partial || [] : []); // names with a face that no Japanese print has yet (shown in English)
const needOne = new Set(); // printing is in another Scryfall set than the 17Lands set: the set search cannot see it
const put = (c, ja) => { const key = `${c.set}|${c.name}`; out.similar[key] = ja; out.similar_oracle[key] = c.oracle_id; };
for (const c of refs) { // names stored by an earlier run stay while they belong to the same oracle_id
  const key = `${c.set}|${c.name}`;
  if (c.oracle_id && previous.similar?.[key] && !/[（）()]/.test(previous.similar[key]) && prevOracle[key] === c.oracle_id) put(c, previous.similar[key]);
}
const noOracle = refs.filter(c => !c.oracle_id);
out.stats.similar_no_oracle_id = noOracle.length;
const bySet = {};
for (const c of refs) if (c.oracle_id) (bySet[c.set] ||= []).push(c);
const sleepMs = 500;
// 1) per set: all Japanese prints of the set, grouped by oracle_id
for (const [set, list] of Object.entries(bySet)) {
  try {
    const prints = new Map();
    let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`set:${set.toLowerCase()} lang:ja`)}&unique=prints`;
    while (url) {
      const d = await get(url);
      for (const c of d.data) { const o = oracleOf(c); if (o) (prints.get(o) || prints.set(o, []).get(o)).push(c); }
      url = d.has_more ? d.next_page : null;
      await sleep(sleepMs);
    }
    let n = 0;
    for (const c of list) {
      const key = `${c.set}|${c.name}`;
      if (c.print_set && String(c.print_set).toLowerCase() !== set.toLowerCase()) { needOne.add(key); continue; }
      const info = japaneseNameInfo(prints.get(c.oracle_id), c);
      if (info) { put(c, info.name); n++; if (info.complete) partial.delete(key); else partial.add(key); }
      else { delete out.similar[key]; delete out.similar_oracle[key]; partial.delete(key); } // not found here: looked up one by one below
    }
    out.stats[`similar_${set.toLowerCase()}`] = `${n}/${list.length}`;
  } catch (e) { if (!/^404 /.test(e.message)) out.errors.push(`similar ${set}: ${e.message}`); } // 404 = no Japanese prints in this set
}
// 2) one by one by oracle_id for what the set search missed (the 17Lands set differs from Scryfall's, double-faced cards, ...):
//    names on display and every name_only card
const inRefs = new Set(refs), nameOnly = new Set((refDoc.name_only || []).filter(c => inRefs.has(c))); // the 22 sets' name_only and the extra ones that can show up in a same-name slot
const oneByOne = refs.filter(c => { const k = `${c.set}|${c.name}`; return c.oracle_id && (partial.has(k) || !out.similar[k] && (shown.has(k) || nameOnly.has(c) || needOne.has(k))); });
const deadline = Date.now() + 20 * 60 * 1000;
let looked = 0, empty = [];
for (const c of oneByOne) {
  if (Date.now() > deadline) { out.errors.push('similar: one-by-one lookups stopped at the time limit'); break; }
  try {
    const d = await get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(`oracleid:${c.oracle_id} lang:ja`)}&unique=prints`);
    const info = japaneseNameInfo(d.data, c), key = `${c.set}|${c.name}`;
    looked++;
    if (info) { put(c, info.name); if (info.complete) partial.delete(key); else partial.add(key); } else { empty.push(key); partial.delete(key); }
  } catch (e) {
    if (/^404 /.test(e.message)) empty.push(`${c.set}|${c.name}`); // no Japanese print
    else out.errors.push(`similar lookup ${c.set}|${c.name}: ${e.message}`);
  }
  await sleep(sleepMs);
}
out.similar_partial = [...partial].filter(k => out.similar[k]).sort();
out.stats.similar_partial = out.similar_partial.length;
out.stats.similar_one_by_one = `${oneByOne.length - empty.length}/${oneByOne.length}`;
if (empty.length) out.stats.similar_gate_empty = {count: empty.length, examples: empty.slice(0, 10)}; // no Japanese print of this oracle_id with matching faces: English name is shown
for (const k of Object.keys(out.similar)) out.similar[k] = stripRuby(out.similar[k]);
if (!out.errors.length) out.sources.similar_lookup = LOOKUP; // keep redoing until a run finishes without errors
if (Object.keys(out.similar).length) out.sources.similar = 'Scryfall (lang:ja printed_name, matched by oracle_id)';

// Only rewrite when something other than the timestamp changed, so reruns don't create empty commits.
const {generated_at: _a, ...nextBody} = out, {generated_at: _b, ...prevBody} = previous;
if (JSON.stringify(nextBody) !== JSON.stringify(prevBody)) fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
else console.log('No changes in Japanese text');
console.log(JSON.stringify({stats: out.stats, errors: out.errors}, null, 1));
