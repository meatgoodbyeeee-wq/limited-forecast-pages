// Downloads the card images of a set that is not out yet (TRK) into data/<code>/images/<id>.webp and writes data/<code>/card-images.json.
// Run by GitHub Actions only (the sandbox cannot reach Wizards). Images are stored in the repository and copied to public/cards/<code>/
// by the Pages build, so the site never hot-links them. Japanese images are used once the Japanese gallery has them, English before that.
//   node scripts/fetch-set-images.mjs TRK
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {collectOfficial} from '../lib/official.mjs';
import {setConfig} from '../lib/set-config.mjs';

const code = (process.argv[2] || '').toUpperCase(), cfg = setConfig(code);
if (!cfg?.galleries?.length || code === 'FRA') throw Error(`usage: node scripts/fetch-set-images.mjs <SET CODE other than FRA>; got ${code || 'nothing'}`);
const lower = code.toLowerCase(), dir = new URL(`../data/${lower}/`, import.meta.url), imgDir = new URL('images/', dir), manifest = new URL('card-images.json', dir);
fs.mkdirSync(imgDir, {recursive: true});
const cards = JSON.parse(gunzipSync(fs.readFileSync(new URL('target.json.gz', dir)))).cards;
const old = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : {};
let ja = new Map(), jaState = {gallery: cfg.galleries_ja?.[0] || null, read: false, cards: 0, with_own_image: 0, error: null};
try {
  if (cfg.galleries_ja?.length) { const jc = (await collectOfficial(code, cfg.galleries_ja, {language: 'ja'})).cards; ja = new Map(jc.map(c => [c.id, c])); jaState.read = true; jaState.cards = jc.length; }
} catch (e) { jaState.error = e.message; console.warn('Japanese gallery not read, English images only:', e.message); }
const out = {}, log = {downloaded: 0, kept: 0, failed: [], japanese: 0};
for (const c of cards) {
  const j = ja.get(c.id), useJa = !!(j?.image && j.image !== c.image), url = useJa ? j.image : c.image, lang = useJa ? 'ja' : 'en';
  // Only official https images, and only ids that are plain file-name characters (the id becomes the file name).
  const host = (() => { try { const u = new URL(url); return u.protocol === 'https:' ? u.hostname : ''; } catch { return ''; } })();
  if (!url || host !== 'media.wizards.com' || !/^[A-Za-z0-9]{10,40}$/.test(c.id)) { log.failed.push(`${c.name}: image URL or id not allowed`); continue; }
  const file = new URL(`${c.id}.webp`, imgDir), prev = old[c.id];
  if (prev && prev.image_url === url && fs.existsSync(file)) { out[c.id] = prev; log.kept++; if (lang === 'ja') log.japanese++; continue; }
  try {
    const r = await fetch(url, {headers: {'User-Agent': 'LimitedForecast/1.0'}, signal: AbortSignal.timeout(45000)});
    if (!r.ok) throw Error(`HTTP ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 5000) throw Error(`too small (${buf.length} bytes)`);
    fs.writeFileSync(file, buf);
    out[c.id] = {name: c.name, ...(useJa && j.name !== c.name ? {name_ja: j.name} : {}), path: `/cards/${lower}/${c.id}.webp`, source_url: (useJa ? cfg.galleries_ja[0] : cfg.galleries[0]), image_url: url, lang};
    log.downloaded++; if (useJa) log.japanese++;
  } catch (e) { log.failed.push(`${c.name}: ${e.message}`); if (prev) out[c.id] = prev; }
}
jaState.unmatched = cards.filter(c => !(ja.get(c.id)?.image && ja.get(c.id).image !== c.image)).map(c => {
  const j = ja.get(c.id), sameNum = [...ja.values()].filter(x => String(x.collector_number) === String(c.collector_number)).map(x => ({id: x.id, name: x.name, same_image: x.image === c.image}));
  return {id: c.id, name: c.name, number: c.collector_number, in_ja_by_id: !!j, ja_name: j?.name, same_image: j ? j.image === c.image : null, ja_same_number: sameNum.slice(0, 4)};
});
jaState.with_own_image = [...ja.values()].filter(j => { const c = cards.find(x => x.id === j.id); return c && j.image && j.image !== c.image; }).length;
fs.writeFileSync(new URL('ja-state.json', dir), JSON.stringify({checked_at: new Date().toISOString(), ...jaState, names_ja: log.japanese}, null, 1) + '\n');
fs.writeFileSync(manifest, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify({set: code, cards: cards.length, ...log, failed: log.failed.length, failed_list: log.failed.slice(0, 10)}));
if (log.failed.length > cards.length / 2) process.exit(1);
