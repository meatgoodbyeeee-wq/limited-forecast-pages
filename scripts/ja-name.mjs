// Picks the Japanese printed name of a reference card from Scryfall prints.
// Identity is the Scryfall oracle_id, never the name: a card that merely has a face with the same name
// (e.g. the prepare spell of "Archmage Emeritus // Swords to Plowshares") is a different card and is never used.

// Furigana in full-width parentheses after a kanji (e.g. 旅（たび）路（じ）).
export const stripRuby = t => t.replace(/(?<=[一-鿿々])（[ぁ-ゖー]+）/g, '');

export const oracleOf = c => c?.oracle_id || (c?.card_faces || []).find(f => f.oracle_id)?.oracle_id || null;

// Japanese name of the faces whose English name equals the reference name ("A" or "A // B"); null when any of them has no printed name.
function faceJa(c, parts) {
  const faces = c.card_faces || [];
  const names = [];
  for (const part of parts) {
    let ja;
    if (faces.length > 1) { const f = faces.find(x => x.name === part); ja = f?.printed_name; }
    else if (c.name === part) ja = c.printed_name || faces[0]?.printed_name;
    if (!ja) return null;
    names.push(ja);
  }
  return names.join(' // ');
}

/**
 * prints: Scryfall card objects (any set / language). ref: {name, set, oracle_id} of the reference card.
 * Returns the Japanese name, or null (-> the page shows the English name) when no Japanese print of the same oracle_id
 * has printed names for the faces. Choice among valid prints is deterministic: a print in the reference card's own set
 * first, otherwise the newest (released_at, then id).
 */
export function japaneseName(prints, ref) {
  if (!ref?.oracle_id) return null;
  const parts = String(ref.name).split(' // '), set = String(ref.set).toLowerCase(), ok = [];
  for (const c of prints || []) {
    if (c.lang && c.lang !== 'ja') continue;
    if (oracleOf(c) !== ref.oracle_id) continue; // gate: same card, not just the same face name
    const ja = faceJa(c, parts);
    if (ja && !/[（）()]/.test(stripRuby(ja))) ok.push({c, ja}); // furigana we could not strip cleanly: not usable
  }
  if (!ok.length) return null;
  const own = x => (String(x.c.set).toLowerCase() === set ? 0 : 1);
  ok.sort((a, b) => own(a) - own(b) || String(b.c.released_at || '').localeCompare(String(a.c.released_at || '')) || String(a.c.id || '').localeCompare(String(b.c.id || '')));
  return stripRuby(ok[0].ja);
}
