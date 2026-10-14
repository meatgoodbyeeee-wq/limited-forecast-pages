// FRA observed two-color win rates from 17Lands Color Ratings — decision and parsing logic, free of I/O.
//
// Same rules as Card Data (lib/card-data.mjs): never before 2026-10-13 00:00 JST, at most one API call per
// JST day (successful or not), window 2026-09-29 .. yesterday (JST) capped at 2026-10-26, run from GitHub
// Actions only (the site never calls 17Lands). Splashed decks are excluded (combine_splash=false, two exact colors).
import {EMBARGO_UTC, WINDOW_START, WINDOW_END, jstDate} from './card-data.mjs';

export const API = 'https://www.17lands.com/color_ratings/data';
export const PAIRS = ['WU', 'WB', 'WR', 'WG', 'UB', 'UR', 'UG', 'BR', 'BG', 'RG'];
const prevDay = d => new Date(Date.parse(d + 'T00:00:00Z') - 86400e3).toISOString().slice(0, 10);

export function plan({now, snapshot, state}) {
  if (now.getTime() < Date.parse(EMBARGO_UTC)) return {fetch: false, reason: 'before 2026-10-13 00:00 JST'};
  const today = jstDate(now);
  if (state?.last_attempt_date_jst === today) return {fetch: false, reason: `already attempted on ${today} (JST)`};
  if (snapshot?.final) return {fetch: false, reason: 'full 28-day window already fetched'};
  const yesterday = prevDay(today), end = yesterday < WINDOW_END ? yesterday : WINDOW_END;
  if (end < WINDOW_START) return {fetch: false, reason: 'window has not started'};
  if (snapshot?.window_end === end) return {fetch: false, reason: `data through ${end} already saved`};
  return {fetch: true, start: WINDOW_START, end, final: end === WINDOW_END};
}

export const apiUrl = ({start, end}) => `${API}?${new URLSearchParams({expansion: 'FRA', event_type: 'PremierDraft', start_date: start, end_date: end, combine_splash: 'false'})}`;

const order = 'WUBRG';
/** Colour letters of a row, e.g. "Azorius (WU)" / "WU" -> "WU". Returns null for splash, summary or unreadable rows. */
export function pairOf(row) {
  if (!row || row.is_summary || typeof row !== 'object') return null;
  const name = String(row.short_name ?? row.color_name ?? '');
  if (/\+/.test(name) || /splash/i.test(name)) return null;
  const m = name.match(/\(([WUBRG]{1,5})\)\s*$/) || name.match(/^([WUBRG]{1,5})$/);
  if (!m) return null;
  const letters = [...new Set(m[1].split(''))].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join('');
  // 17Lands lists pairs in WUBRG order; map to this site's pair keys (e.g. WU, UB, BR, RG, WG)
  return PAIRS.find(p => [...p].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join('') === letters && letters.length === 2) || null;
}

/** Rows -> {pair: {wr_pct, games}} for the ten two-color pairs. Unknown/duplicate rows are dropped. */
export function parseRatings(rows) {
  const list = Array.isArray(rows) ? rows : Array.isArray(rows?.data) ? rows.data : [];
  const pairs = {};
  for (const r of list) {
    const pair = pairOf(r);
    if (!pair || pairs[pair]) continue;
    const wins = Number(r.wins), games = Number(r.games);
    if (!Number.isFinite(wins) || !Number.isSafeInteger(games) || games <= 0 || wins < 0 || wins > games) continue;
    pairs[pair] = {wr_pct: wins / games * 100, games};
  }
  return pairs;
}

export function snapshot({now, start, end, final, url, pairs}) {
  return {schema: 1, source: '17Lands', source_type: 'Color Ratings', expansion: 'FRA', format: 'PremierDraft',
    source_url: url, attribution: '17Lands (17lands.com) Color Ratings', splash: false,
    window_start: start, window_end: end, data_date: end, final, fetched_at: now.toISOString(), fetched_date_jst: jstDate(now), pairs};
}

export async function run(io, paths) {
  const snap = io.readJson(paths.snapshot), state = io.readJson(paths.state) || {};
  const p = plan({now: io.now, snapshot: snap, state});
  if (!p.fetch) { io.log(`Color Ratings: no API call (${p.reason})`); return {called: false, reason: p.reason}; }
  const url = apiUrl(p), attempt = {last_attempt_date_jst: jstDate(io.now), last_attempt_at: io.now.toISOString()};
  let rows;
  try { rows = await io.fetchJson(url); }
  catch (e) { io.writeJson(paths.state, {...state, ...attempt, last_error: String(e.message || e)}); io.log(`Color Ratings: request failed (${e.message})`); return {called: true, ok: false}; }
  const pairs = parseRatings(rows);
  if (Object.keys(pairs).length < 10) { io.writeJson(paths.state, {...state, ...attempt, last_error: `usable pairs: ${Object.keys(pairs).length}`}); io.log(`Color Ratings: only ${Object.keys(pairs).length} usable pairs; snapshot kept`); return {called: true, ok: false}; }
  io.writeJson(paths.snapshot, snapshot({now: io.now, start: p.start, end: p.end, final: p.final, url, pairs}));
  io.writeJson(paths.state, {...state, ...attempt, last_error: null});
  io.log(`Color Ratings: saved ${Object.keys(pairs).length} pairs through ${p.end}`);
  return {called: true, ok: true};
}
