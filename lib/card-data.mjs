// FRA observed values from 17Lands Card Data — decision logic, kept free of I/O so it can be tested.
//
// Rules
// - Never before 2026-10-13 00:00 JST (2026-10-12T15:00:00Z).
// - At most one API call per JST calendar day (successful or not).
// - Window: release day 2026-09-29 .. yesterday (JST), capped at the 28-day window end 2026-10-26.
//   Once the full window has been fetched the data can no longer change, so fetching stops.
// - After the Public Dataset is out, GIH WR comes from the Public Dataset (computed by the data
//   repository); Card Data keeps being fetched only for ALSA, which the Game Data lacks.
//   Set CONTINUE_AFTER_PUBLIC_DATASET to false to stop Card Data entirely at that point.

export const EMBARGO_UTC = '2026-10-12T15:00:00Z';
export const WINDOW_START = '2026-09-29';
export const WINDOW_END = '2026-10-26'; // inclusive: 28 days
export const CONTINUE_AFTER_PUBLIC_DATASET = true;
export const API = 'https://www.17lands.com/api/card_data';

export const jstDate = now => new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
const prevDay = d => new Date(Date.parse(d + 'T00:00:00Z') - 86400e3).toISOString().slice(0, 10);

/** What the daily job should do right now. Returns {fetch:false, reason} or {fetch:true, start, end, final}. */
export function plan({now, snapshot, state, publicDatasetAvailable}) {
  if (now.getTime() < Date.parse(EMBARGO_UTC)) return {fetch: false, reason: 'before 2026-10-13 00:00 JST'};
  const today = jstDate(now);
  if (state?.last_attempt_date_jst === today) return {fetch: false, reason: `already attempted on ${today} (JST)`};
  if (snapshot?.final) return {fetch: false, reason: 'full 28-day window already fetched'};
  if (publicDatasetAvailable && !CONTINUE_AFTER_PUBLIC_DATASET) return {fetch: false, reason: 'Public Dataset available; Card Data stopped'};
  const yesterday = prevDay(today), end = yesterday < WINDOW_END ? yesterday : WINDOW_END;
  if (end < WINDOW_START) return {fetch: false, reason: 'window has not started'};
  if (snapshot?.window_end === end) return {fetch: false, reason: `data through ${end} already saved`};
  return {fetch: true, start: WINDOW_START, end, final: end === WINDOW_END};
}

export const apiUrl = ({start, end}) => `${API}?${new URLSearchParams({expansion: 'FRA', event_type: 'PremierDraft', start_date: start, end_date: end})}`;

/** Name normalisation for matching 17Lands names to forecast cards. */
export const normName = s => String(s || '').normalize('NFKC').replace(/[‘’ʼ`´]/g, "'").replace(/[“”]/g, '"')
  .replace(/\s*\/\/?\s*/g, ' // ').replace(/\s+/g, ' ').trim().toLowerCase();

/** Maps API rows onto forecast cards. Ambiguous or unknown names are dropped. */
export function matchCards(rows, forecastCards) {
  const byKey = new Map(), dup = new Set();
  const add = (key, card) => { if (!key) return; if (byKey.has(key) && byKey.get(key).id !== card.id) dup.add(key); else byKey.set(key, card); };
  for (const c of forecastCards) { add(normName(c.name), c); if (c.name.includes('//')) add(normName(c.name.split('//')[0]), c); }
  const seen = new Set(), cards = []; let unmatched = 0;
  for (const r of rows) {
    const key = normName(r.name), front = normName(String(r.name || '').split('//')[0]);
    const k = byKey.has(key) && !dup.has(key) ? key : byKey.has(front) && !dup.has(front) ? front : null;
    if (!k) { unmatched++; continue; }
    const card = byKey.get(k); if (seen.has(card.id)) continue; seen.add(card.id);
    const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null), int = v => (Number.isSafeInteger(v) && v >= 0 ? v : 0);
    const gih = num(r.ever_drawn_win_rate), alsa = num(r.avg_seen);
    cards.push({id: card.id, name: card.name,
      gih: gih != null && gih >= 0 && gih <= 1 ? gih * 100 : null, gih_n: int(r.ever_drawn_game_count),
      alsa: alsa != null && alsa >= 1 && alsa <= 15 ? alsa : null, seen_n: int(r.seen_count)});
  }
  return {cards, unmatched};
}

/** Snapshot document (common format the site reads; source_type may later be "Public Dataset"). */
export function snapshot({now, start, end, final, url, cards, publicDatasetAvailable}) {
  return {schema: 1, source: '17Lands', source_type: 'Card Data', expansion: 'FRA', format: 'PremierDraft',
    source_url: url, attribution: '17Lands (17lands.com) Card Data',
    window_start: start, window_end: end, data_date: end, final,
    fetched_at: now.toISOString(), fetched_date_jst: jstDate(now), public_dataset_available: !!publicDatasetAvailable, cards};
}

/**
 * One daily run. All I/O is injected (tests pass fakes).
 * io: {now, readJson(path)->obj|null, writeJson(path,obj), fetchJson(url)->obj, log}
 * Writes the state file on every API attempt (so a failure is not retried the same day) and the
 * snapshot only on success with usable rows (a failed or empty response never overwrites it).
 */
export async function run(io, paths) {
  const snapshotDoc = io.readJson(paths.snapshot), state = io.readJson(paths.state) || {};
  const live = io.readJson(paths.publicDatasetStatus);
  const publicDatasetAvailable = live?.status === 'available' && !!live?.observations?.cards?.some(c => c.gih_n > 0);
  const p = plan({now: io.now, snapshot: snapshotDoc, state, publicDatasetAvailable});
  if (!p.fetch) { io.log(`Card Data: no API call (${p.reason})`); return {called: false, reason: p.reason}; }
  const url = apiUrl(p), attempt = {last_attempt_date_jst: jstDate(io.now), last_attempt_at: io.now.toISOString()};
  try {
    const body = await io.fetchJson(url);
    const rows = Array.isArray(body) ? body : Array.isArray(body?.data) ? body.data : [];
    const forecast = io.readJson(paths.forecast);
    const {cards, unmatched} = matchCards(rows, forecast?.forecast?.cards || []);
    if (!cards.length) throw new Error(`no usable rows (${rows.length} rows, ${unmatched} unmatched)`);
    io.writeJson(paths.snapshot, snapshot({now: io.now, ...p, url, cards, publicDatasetAvailable}));
    io.writeJson(paths.state, {...state, ...attempt, last_result: 'ok', last_successful_fetch_date_jst: jstDate(io.now), matched: cards.length, unmatched});
    io.log(`Card Data: saved ${cards.length} cards (${unmatched} unmatched) for ${p.start}..${p.end}${p.final ? ' (final)' : ''}`);
    return {called: true, ok: true, cards: cards.length};
  } catch (e) {
    io.writeJson(paths.state, {...state, ...attempt, last_result: 'error', last_error: String(e.message || e).slice(0, 300)});
    io.log(`Card Data: fetch failed, previous snapshot kept: ${e.message || e}`);
    return {called: true, ok: false, error: String(e.message || e)};
  }
}
