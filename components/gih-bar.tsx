const MINT = '#5EEAC4', PINK = '#FF5C8A';

export type Scale = {lo: number; hi: number; mean: number; exact?: boolean};

/** Games an observed GIH WR needs before it may set the axis (same bar as the forecast-range judgement, MIN_N in forecast-range.tsx). */
const AXIS_MIN_GAMES = 1000;

/** Scale shared by every row: the average and axis bounds of the cards in the current color/rarity filter. */
export function gihScale(cards: {gih: number; gih_range: number[]; observed_gih?: number | null; observed_gih_n?: number}[], exact = false): Scale | null {
  const xs = cards.filter(c => Number.isFinite(c.gih));
  if (!xs.length) return null;
  const mean = xs.reduce((s, c) => s + c.gih, 0) / xs.length;
  if (exact) {
    // Observed data present: the axis runs from the lowest to the highest value among the forecasts and the observed GIH WR of cards with enough games
    // (a card with a handful of games can sit anywhere, even at 0%, and would stretch the axis). Range bands beyond the ends are cut at the edge.
    const vals = xs.flatMap(c => [c.gih, ...(c.observed_gih != null && Number.isFinite(c.observed_gih) && (c.observed_gih_n || 0) >= AXIS_MIN_GAMES ? [c.observed_gih] : [])]);
    return {lo: Math.min(...vals), hi: Math.max(...vals), mean, exact: true};
  }
  // observed values (pink dots) must fit on the axis too
  const obs = (c: (typeof xs)[number]) => (c.observed_gih != null && Number.isFinite(c.observed_gih) && (c.observed_gih_n || 0) > 0 ? c.observed_gih : null);
  const lo = Math.floor(Math.min(...xs.map(c => Math.min(c.gih, c.gih_range?.[0] ?? c.gih, obs(c) ?? c.gih)))) - 1;
  const hi = Math.ceil(Math.max(...xs.map(c => Math.max(c.gih, c.gih_range?.[1] ?? c.gih, obs(c) ?? c.gih)))) + 1;
  return {lo, hi, mean};
}

/** One table row: the forecast range (band between its lower and upper limit) with the forecast as a dot, against the filter average (dashed line); same look as the card detail chart. */
export function GihBar({value, range, scale, delta, observed}: {value: number; range: number[]; scale: Scale; delta: string; observed?: number | null}) {
  const pct = (v: number) => Math.min(100, Math.max(0, (v - scale.lo) / (scale.hi - scale.lo) * 100));
  return <div className="flex items-center gap-3" aria-hidden="true">
    <div className="relative flex-1 h-[22px]">
     <div className={scale.exact ? 'absolute inset-y-0 inset-x-[9px]' : 'absolute inset-0'}>
      <div className="absolute left-0 right-0 top-[10px] h-[2px] rounded" style={{background: 'rgba(232,237,244,.12)'}}/>
      <div className="absolute top-[4px] h-[14px] rounded-full" style={{left: `${pct(range[0])}%`, width: `${pct(range[1]) - pct(range[0])}%`, background: 'rgba(94,234,196,.28)', border: '1.5px solid rgba(94,234,196,.65)'}}/>
      <div className="absolute top-[4px] size-[14px] -translate-x-1/2 rounded-full" style={{left: `${pct(value)}%`, background: MINT, boxShadow: '0 0 0 3px var(--card)'}}/>
      {observed != null && <div className="absolute top-[2px] size-[18px] -translate-x-1/2 rounded-full" style={{left: `${pct(observed)}%`, background: PINK, boxShadow: '0 0 0 2px var(--card)'}}/>}
      <div className="absolute -top-4 -bottom-4" style={{left: `${pct(scale.mean)}%`, borderLeft: '2px dashed rgba(232,237,244,.28)'}}/>
     </div>
    </div>
    <span className="w-12 text-right text-xs number text-muted-foreground">{delta}</span>
  </div>;
}
