// Build-time fetch of Kafka's latest note articles and X posts for the About page.
// Output: public/data/about-feeds.json. Failures never fail the build (the page falls back to link cards).
import {mkdirSync, writeFileSync} from 'node:fs';

const NOTE_RSS = 'https://note.com/yamabekafka/rss';
const UA = {'User-Agent': 'Sakiyomi/1.0 (about page feed)', 'Accept-Language': 'ja,en;q=0.8'};
const get = async url => { const r = await fetch(url, {headers: {...UA, Cookie: 'CONSENT=YES+1; SOCS=CAI'}, signal: AbortSignal.timeout(20000)}); if (!r.ok) throw new Error(`${url} HTTP ${r.status}`); return r.text(); };
const decode = s => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (x, t) => { const m = x.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)); return m ? decode(m[1]) : ''; };
const https = u => (typeof u === 'string' && /^https:\/\//.test(u) ? u : '');

const out = {fetched_at: new Date().toISOString(), note: [], x: []};
try {
  const xml = await get(NOTE_RSS);
  out.note = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 3).map(m => {
    const x = m[1], thumb = x.match(/<media:thumbnail[^>]*>([^<]+)</) || x.match(/<enclosure[^>]*url="([^"]+)"/);
    const link = https(tag(x, 'link')), d = new Date(tag(x, 'pubDate'));
    return {title: tag(x, 'title'), url: link, thumbnail: https(thumb ? decode(thumb[1]) : ''), date: Number.isNaN(+d) ? '' : d.toISOString().slice(0, 10)};
  }).filter(a => a.title && a.url.startsWith('https://note.com/'));
} catch (e) { console.log('note feed skipped:', e.message); out.note_error = String(e.message).slice(0, 120); }
try {
  // Latest posts via X's public syndication page (best effort; the page falls back to X's own timeline widget).
  const html = await get('https://syndication.twitter.com/srv/timeline-profile/screen-name/yamabekafka');
  const m = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) throw new Error('no timeline data');
  const entries = JSON.parse(m[1])?.props?.pageProps?.timeline?.entries || [];
  out.x = entries.map(e => e?.content?.tweet).filter(t => t && t.id_str && (t.full_text || t.text) && !t.retweeted_status)
    .map(t => ({id: String(t.id_str), text: String(t.full_text || t.text).replace(/https:\/\/t\.co\/\w+/g, '').trim().slice(0, 280), date: t.created_at ? new Date(t.created_at).toISOString().slice(0, 10) : '', url: `https://x.com/yamabekafka/status/${t.id_str}`}))
    .filter(t => t.text).slice(0, 3);
} catch (e) { console.log('x feed skipped:', e.message); out.x_error = String(e.message).slice(0, 120); }
mkdirSync('public/data', {recursive: true});
writeFileSync('public/data/about-feeds.json', JSON.stringify(out));
console.log(`about feeds: ${out.note.length} note, ${out.x.length} x posts`);
