// Observed ALSA for FRA from 17Lands card data, fetched during the site build.
// Runs only after the official Public Dataset for FRA is available (live/fra-public-game.json),
// uses the same 28-day window as the Game Data comparison, and writes public/live/fra-alsa.json.
// Never fails the build: on any problem it leaves the previous state (no file) and logs why.
import fs from 'node:fs';

const LIVE = new URL('../public/live/fra-public-game.json', import.meta.url);
const OUT = new URL('../public/live/fra-alsa.json', import.meta.url);
const test = process.env.ALSA_TEST_SET; // e.g. TDM: verify the API format against a past set
const day = d => d.toISOString().slice(0, 10);

async function main() {
  let set = 'FRA', start, end;
  if (test) {
    set = test; start = process.env.ALSA_TEST_START; end = process.env.ALSA_TEST_END;
  } else {
    if (!fs.existsSync(LIVE)) return 'no Public Dataset status file';
    const live = JSON.parse(fs.readFileSync(LIVE, 'utf8')), o = live.observations;
    if (live.status !== 'available' || !o?.cards?.some(c => c.gih_n > 0)) return `Public Dataset not available yet (status ${live.status})`;
    start = o.window_start;
    const last = new Date(Date.parse(o.window_end_exclusive) - 86400000), yesterday = new Date(Date.now() - 86400000);
    end = day(last < yesterday ? last : yesterday);
  }
  const q = new URLSearchParams({expansion: set, event_type: 'PremierDraft', ...(start ? {start_date: start} : {}), ...(end ? {end_date: end} : {})});
  const url = 'https://www.17lands.com/api/card_data?' + q;
  const r = await fetch(url, {headers: {'User-Agent': 'Sakiyomi/1.0 (limited forecast research; daily)', Accept: 'application/json'}, signal: AbortSignal.timeout(90000)});
  if (!r.ok) return `17Lands card data returned ${r.status}`;
  const body = await r.json(), rows = Array.isArray(body) ? body : body.data || [];
  const cards = rows.map(c => ({name: c.name || c.card_name, alsa: Number(c.avg_seen), seen_n: Number(c.seen_count ?? c.seen_n ?? 0)}))
    .filter(c => c.name && Number.isFinite(c.alsa) && c.alsa >= 1 && c.alsa <= 15 && Number.isSafeInteger(c.seen_n) && c.seen_n > 0);
  if (!cards.length) return `no usable rows (fields: ${Object.keys(rows[0] || {}).join(',')})`;
  fs.mkdirSync(new URL('.', OUT), {recursive: true});
  fs.writeFileSync(OUT, JSON.stringify({set, source: '17lands-card-data', source_url: url, window_start: start || null, window_end: end || null, fetched_at: new Date().toISOString(), cards}));
  return `wrote ${cards.length} cards (${start}–${end})`;
}
main().then(m => console.log('17Lands ALSA:', m)).catch(e => console.log('17Lands ALSA: skipped:', e.message));
