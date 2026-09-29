import range from '../data/gih-range-fra.json' with { type: 'json' };

// Per-card GIH WR forecast range (nominal 80%), fitted on the adopted model's 28-set out-of-fold residuals (research/production_c3).
// Research and pre-registered selection: 17lands-limited-forecast-data/research/gih_interval/.
if (range.fin_used !== false || range.target_coverage !== 0.8) throw Error('Unexpected GIH range file');

const byId = new Map(range.cards.map(card => [card.id, card]));

export const typeGroup = typeLine => {
  const t = (typeLine || '').toLowerCase();
  if (t.includes('creature')) return 'creature';
  if (t.includes('land')) return 'land';
  if (t.includes('instant') || t.includes('sorcery')) return 'spell';
  return 'other_permanent';
};

// A changed preview must not keep a radius computed for old card text: fall back to the rarity x type table.
export function gihRadius(card) {
  const row = byId.get(card.id);
  if (row && row.name === card.name && row.oracle_text === (card.oracle_text || '') &&
      row.type_line === (card.type_line || '') && row.mana_cost === (card.mana_cost || '')) return row.radius;
  const rarity = card.rarity === 'land' ? 'common' : card.rarity;
  return range.fallback[rarity]?.[typeGroup(card.type_line)] ?? null;
}

/** Recentre the range on the pre-release forecast. Idempotent; cards with no known radius keep their range. */
export function withGihRange(card) {
  const radius = gihRadius(card);
  if (!(radius > 0)) return card;
  const center = card.pre_release_gih ?? card.gih;
  if (!Number.isFinite(center)) return card;
  return {...card, gih_range: [Math.max(0, center - radius), Math.min(100, center + radius)], gih_range_version: range.version};
}

export const gihRangeVersion = range.version;
