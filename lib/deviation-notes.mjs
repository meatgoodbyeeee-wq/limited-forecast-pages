// AI drafts of "why the observed GIH WR left the forecast range" (public/deviation-notes.json).
// Runs in GitHub Actions only, after the daily Card Data update. Forecasts and models are never changed;
// the notes are shown on the site labelled as AI estimates.

export const MIN_N = 1000;          // keep in sync with components/forecast-range.tsx
export const MAX_PER_RUN = 40;      // cost cap per run
export const MODEL = 'claude-sonnet-5-5';

const r1 = v => Math.round(v * 10) / 10;
const mean = xs => xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null;

/** Cards whose observed GIH WR is outside the forecast range with enough samples, plus context for the prompt. */
export function findDeviations(forecastCards, snapshot) {
  const obs = new Map((snapshot?.cards || []).map(r => [r.id, r]));
  const rows = [];
  for (const c of forecastCards) {
    const r = obs.get(c.id);
    if (!r || typeof r.gih !== 'number' || !(r.gih_n >= 1) || c.late_card) continue;
    rows.push({c, obs: r.gih, n: r.gih_n, diff: r.gih - c.gih});
  }
  const solid = rows.filter(x => x.n >= MIN_N);
  const all = mean(solid.map(x => x.diff));
  const byColor = k => mean(solid.filter(x => k === 'C' ? !x.c.colors.length : k === 'M' ? x.c.colors.length > 1 : x.c.colors.length === 1 && x.c.colors[0] === k).map(x => x.diff));
  const byRarity = k => mean(solid.filter(x => x.c.rarity === k).map(x => x.diff));
  const groupKey = c => !c.colors.length ? 'C' : c.colors.length > 1 ? 'M' : c.colors[0];
  return solid.filter(x => x.obs > x.c.gih_range[1] || x.obs < x.c.gih_range[0]).map(x => ({
    card: x.c, observed: x.obs, n: x.n, direction: x.obs > x.c.gih_range[1] ? 'above' : 'below',
    context: {all_cards_avg_diff: all == null ? null : r1(all), same_color_group_avg_diff: (v => v == null ? null : r1(v))(byColor(groupKey(x.c))), same_rarity_avg_diff: (v => v == null ? null : r1(v))(byRarity(x.c.rarity))},
  }));
}

/** Write a note when there is none yet, or when the card has flipped side (above <-> below). */
export const needsNote = (d, notes) => { const n = notes?.cards?.[d.card.name]?.gih; return !n?.reasons?.length || (n.source === 'ai' && n.direction !== d.direction); };

export function prompt(d, snapshot) {
  const c = d.card;
  const sim = (c.similar || []).slice(0, 3).map(s => ({name: s.name, set: s.set, rarity: s.rarity, mana_cost: s.mana_cost, type_line: s.type_line, oracle_text: s.oracle_text, gih: s.gih == null ? null : r1(s.gih)}));
  const data = {
    card: {name: c.name, rarity: c.rarity, colors: c.colors, mana_cost: c.mana_cost, type_line: c.type_line, oracle_text: c.oracle_text, power: c.power, toughness: c.toughness},
    forecast_gih: r1(c.gih), forecast_range: c.gih_range.map(r1), observed_gih: r1(d.observed), observed_games: d.n, direction: d.direction,
    observed_source: `17Lands Card Data, Premier Draft, ${snapshot.window_start}..${snapshot.window_end}`,
    model_breakdown: c.gih_explanation ? {base: c.gih_explanation.base, terms: c.gih_explanation.terms} : null,
    similar_past_cards: sim,
    environment_context_pt: d.context,
  };
  return `You analyse why a pre-release GIH WR forecast for a Magic: The Gathering Limited card (set FRA) missed the observed value.
Use ONLY the data below and general Limited knowledge. Do not invent statistics, decklists or quotes. These are estimates, not confirmed causes.
Consider: whether the whole format / colour group / rarity shifted (environment_context_pt = average observed−forecast in percentage points), what the card does in practice (synergies, removal density, speed of the format), how it differs from the similar past cards the model relied on, and sample size.

DATA:
${JSON.stringify(data, null, 1)}

Return ONLY a JSON object: {"reasons": [2-3 Japanese sentences, each one concrete reason, max 90 characters, plain です/ます style], "reasons_en": [the same reasons in English, max 160 characters each]}`;
}

/** Parses and validates the model output; returns null when unusable. */
export function parseNote(text) {
  const m = String(text || '').match(/\{[\s\S]*\}/);
  if (!m) return null;
  let o; try { o = JSON.parse(m[0].replace(/[\u0000-\u001f]+/g, " ")); } catch { return null; }
  const clean = (xs, max) => Array.isArray(xs) ? xs.filter(s => typeof s === 'string').map(s => s.replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)).filter(Boolean).slice(0, 4) : [];
  const reasons = clean(o.reasons, 140), reasons_en = clean(o.reasons_en, 240);
  return reasons.length ? {reasons, reasons_en} : null;
}

/** One run. io: {now, apiKey, model, callModel(prompt)->text, log}. Returns the updated notes object. */
export async function run({forecastCards, snapshot, notes, io}) {
  const out = {set: 'FRA', ...(notes || {}), cards: {...(notes?.cards || {})}};
  if (!io.apiKey) { io.log('deviation notes: no ANTHROPIC_API_KEY, skipped'); return {notes: out, written: 0}; }
  if (!snapshot?.cards?.length) { io.log('deviation notes: no observed data yet'); return {notes: out, written: 0}; }
  const todo = findDeviations(forecastCards, snapshot).filter(d => needsNote(d, out));
  io.log(`deviation notes: ${todo.length} card(s) need a note (max ${MAX_PER_RUN} per run)`);
  let written = 0;
  const day = new Date(io.now.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  for (const d of todo.slice(0, MAX_PER_RUN)) {
    try {
      const note = parseNote(await io.callModel(prompt(d, snapshot)));
      if (!note) { io.log(`  ${d.card.name}: unusable answer, skipped`); continue; }
      out.cards[d.card.name] = {...(out.cards[d.card.name] || {}), gih: {source: 'ai', model: io.model, written_at: day, data_as_of: snapshot.window_end, direction: d.direction, ...note}};
      written++;
    } catch (e) { io.log(`  ${d.card.name}: ${String(e.message || e).slice(0, 200)}`); }
  }
  return {notes: out, written};
}
