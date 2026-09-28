const MINT = '#5EEAC4';

export type Scale = {lo: number; hi: number; mean: number};

/** Scale shared by every row: the average and axis bounds of the cards in the current color/rarity filter. */
export function gihScale(cards: {gih: number; gih_range: number[]}[]): Scale | null {
  const xs = cards.filter(c => Number.isFinite(c.gih));
  if (!xs.length) return null;
  const mean = xs.reduce((s, c) => s + c.gih, 0) / xs.length;
  const lo = Math.floor(Math.min(...xs.map(c => Math.min(c.gih, c.gih_range?.[0] ?? c.gih)))) - 1;
  const hi = Math.ceil(Math.max(...xs.map(c => Math.max(c.gih, c.gih_range?.[1] ?? c.gih)))) + 1;
  return {lo, hi, mean};
}

/** One table row's GIH WR vs. the filter average (same visual language as the color-pair chart). */
export function GihBar({value, range, scale, delta}: {value: number; range: number[]; scale: Scale; delta: string}) {
  const pct = (v: number) => Math.min(100, Math.max(0, (v - scale.lo) / (scale.hi - scale.lo) * 100));
  return <div className="flex items-center gap-3" aria-hidden="true">
    <div className="relative flex-1 h-[22px]">
      <div className="absolute top-[6px] h-[10px] rounded-full" style={{left: `${pct(range[0])}%`, width: `${pct(range[1]) - pct(range[0])}%`, background: 'rgba(94,234,196,.2)'}}/>
      <div className="absolute left-0 top-[4px] h-[14px]" style={{width: `${pct(value)}%`, borderRadius: '3px 7px 7px 3px', background: MINT, opacity: .85}}/>
      <div className="absolute -top-4 -bottom-4" style={{left: `${pct(scale.mean)}%`, borderLeft: '2px dashed rgba(232,237,244,.28)'}}/>
    </div>
    <span className="w-12 text-right text-xs number text-muted-foreground">{delta}</span>
  </div>;
}
