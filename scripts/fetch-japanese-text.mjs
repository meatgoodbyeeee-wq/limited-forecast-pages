// Builds data/card-text-ja.json: official Japanese FRA card text (Wizards card gallery,
// Japanese locale) and Japanese names of past-set "similar cards" (Scryfall).
// Always writes the file with stats/errors so a failed source can be diagnosed from the commit.
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {japaneseLines} from './ja-lines.mjs';

const OUT = new URL('../data/card-text-ja.json', import.meta.url);
const UA = {'User-Agent': 'Sakiyomi/1.0 (limited forecast research)', Accept: 'application/json'};
const SPACE = 'https://cdn.contentful.com/spaces/s5n2t79q9icq/environments/master';
const GALLERIES = ['https://magic.wizards.com/ja/products/reality-fracture/card-image-gallery', 'https://magic.wizards.com/en/products/reality-fracture/card-image-gallery'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (url, json = true) => { const r = await fetch(url, {headers: UA, signal: AbortSignal.timeout(60000)}); if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]}`); return json ? r.json() : r.text(); };

const forecast = JSON.parse(gunzipSync(fs.readFileSync(new URL('../public/forecast.json.gz', import.meta.url)))).forecast;
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const out = {generated_at: new Date().toISOString(), sources: {}, stats: {}, errors: [], fra: previous.fra || {}, similar: previous.similar || {}};
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
      await sleep(150);
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

// ---- Past sets: Japanese printed names from Scryfall
const wanted = {};
for (const c of forecast.cards) for (const s of c.similar || []) (wanted[s.set.toLowerCase()] ||= new Set()).add(s.name);
const similar = {};
for (const [set, names] of Object.entries(wanted)) {
  try {
    let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`set:${set} lang:ja`)}&unique=prints`, n = 0;
    while (url) {
      const d = await get(url);
      for (const c of d.data) {
        const ja = c.printed_name || (c.card_faces || []).map(f => f.printed_name).filter(Boolean).join(' // ');
        if (!ja) continue;
        const keys = [c.name, c.name.split(' // ')[0]];
        for (const k of keys) if (names.has(k) && !similar[`${set.toUpperCase()}|${k}`]) { similar[`${set.toUpperCase()}|${k}`] = ja; n++; }
      }
      url = d.has_more ? d.next_page : null;
      await sleep(150);
    }
    out.stats[`similar_${set}`] = `${n}/${names.size}`;
  } catch (e) { out.errors.push(`similar ${set}: ${e.message}`); }
}
if (Object.keys(similar).length) { out.similar = {...out.similar, ...similar}; out.sources.similar = 'Scryfall (lang:ja printed_name)'; }

fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({stats: out.stats, errors: out.errors}, null, 1));
