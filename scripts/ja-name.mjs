// Picks the Japanese printed name of a reference card from Scryfall prints.
// Identity is the Scryfall oracle_id, never the name: a card that merely has a face with the same name
// (e.g. the prepare spell of "Archmage Emeritus // Swords to Plowshares") is a different card and is never used.

// Furigana in full-width parentheses after a kanji (e.g. 旅（たび）路（じ）).
export const stripRuby = t => t.replace(/(?<=[一-鿿々])（[ぁ-ゖー]+）/g, '');

export const oracleOf = c => c?.oracle_id || (c?.card_faces || []).find(f => f.oracle_id)?.oracle_id || null;

// Japanese name of a print: the printed names of all faces joined with " // " (single-faced: its printed name); null when a face has none.
// (Identity is already settled by the oracle_id, so no face is picked by its English name.)
function printedJa(c) {
  const faces = c.card_faces || [];
  const names = faces.length > 1 ? faces.map(f => f.printed_name) : [c.printed_name || faces[0]?.printed_name];
  // a face still printed in English (some special prints) is not a Japanese name
  return names.every(n => n && /[ぁ-ヿ一-鿿]/.test(n)) ? names.join(' // ') : null;
}

/**
 * prints: Scryfall card objects (any set / language). ref: {name, set, oracle_id} of the reference card.
 * Returns the Japanese name, or null (-> the page shows the English name) when no Japanese print of the same oracle_id
 * has printed names for all faces. Choice among valid prints is deterministic: a print in the reference card's own set
 * first, otherwise the newest (released_at, then id).
 */
export function japaneseName(prints, ref) {
  if (!ref?.oracle_id) return null;
  const set = String(ref.set).toLowerCase(), ok = [];
  for (const c of prints || []) {
    if (c.lang && c.lang !== 'ja') continue;
    if (oracleOf(c) !== ref.oracle_id) continue; // gate: same card, not just the same face name
    const ja = printedJa(c);
    if (ja && !/[（）()]/.test(stripRuby(ja))) ok.push({c, ja}); // furigana we could not strip cleanly: not usable
  }
  if (!ok.length) return null;
  const own = x => (String(x.c.set).toLowerCase() === set ? 0 : 1);
  ok.sort((a, b) => own(a) - own(b) || String(b.c.released_at || '').localeCompare(String(a.c.released_at || '')) || String(a.c.id || '').localeCompare(String(b.c.id || '')));
  return stripRuby(ok[0].ja);
}
