import type {Card, Forecast} from '@/lib/types';

// Applies the observed-values snapshot (public/data/fra-actual-card-data.json) to the forecast.
// The snapshot format is source-agnostic (source_type "Card Data" today, possibly "Public Dataset"
// later), so switching the producer does not require UI changes. Values are shown only — they are
// never blended into the forecast. When the Public Dataset is already applied (live phase),
// GIH WR keeps coming from it and only ALSA is taken from the snapshot.

type Row = {id: string; gih: number | null; gih_n: number; alsa: number | null; seen_n: number};
type Doc = {schema: number; source_type: string; expansion: string; window_start: string; window_end: string; fetched_date_jst: string; cards: Row[]};

const ok = (d: any): d is Doc => d && d.schema === 1 && d.expansion === 'FRA' && typeof d.source_type === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(d.window_start) && /^\d{4}-\d{2}-\d{2}$/.test(d.window_end) && /^\d{4}-\d{2}-\d{2}$/.test(d.fetched_date_jst) && Array.isArray(d.cards);
const count = (v: unknown) => (Number.isSafeInteger(v) && (v as number) > 0 ? (v as number) : 0);
const md = (d: string) => `${+d.slice(5, 7)}/${+d.slice(8, 10)}`;

export function applyActuals(forecast: Forecast, doc: unknown): Forecast {
  if (!ok(doc)) return forecast;
  const rows = new Map<string, Row>();
  for (const r of doc.cards) if (r && typeof r.id === 'string') rows.set(r.id, r);
  if (!rows.size) return forecast;
  const live = !!forecast.phase && forecast.phase !== 'PREVIEW';
  const label = doc.source_type === 'Card Data' ? '17Lands Card Data' : '17Lands ' + doc.source_type;
  const window = `${md(doc.window_start)}–${md(doc.window_end)}`;
  let applied = 0;
  const cards = forecast.cards.map((c: Card) => {
    const r = rows.get(c.id);
    if (!r) return c;
    const gih = typeof r.gih === 'number' && r.gih >= 0 && r.gih <= 100 && count(r.gih_n) ? r.gih : null;
    const alsa = typeof r.alsa === 'number' && r.alsa >= 1 && r.alsa <= 15 && count(r.seen_n) ? r.alsa : null;
    const next: Card = {...c};
    if (!live && gih != null) Object.assign(next, {observed_gih: gih, observed_gih_n: r.gih_n, gih_error: c.late_card ? null : gih - c.gih, observed_gih_source: label, observed_window: window});
    if (alsa != null) Object.assign(next, {observed_alsa: alsa, observed_seen_n: r.seen_n, alsa_error: c.late_card ? null : alsa - (live ? (c.pre_release_alsa ?? c.alsa) : c.alsa), observed_alsa_source: label, observed_window: window});
    if (next !== c && (next.observed_gih_source || next.observed_alsa_source)) applied++;
    return next;
  });
  return applied ? {...forecast, cards, actuals: {source: label, date_label: md(doc.fetched_date_jst), window}} as Forecast : forecast;
}
