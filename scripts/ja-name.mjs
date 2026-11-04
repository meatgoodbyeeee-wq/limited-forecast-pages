// Picks the Japanese printed name of a reference card from Scryfall prints.
// Identity is the Scryfall oracle_id, never the name: a card that merely has a face with the same name
// (e.g. the prepare spell of "Archmage Emeritus // Swords to Plowshares") is a different card and is never used.

// Furigana in full-width parentheses after a kanji (e.g. 旅（たび）路（じ）).
export const stripRuby = t => t.replace(/(?<=[一-鿿々])（[ぁ-ゖー]+）/g, '');

export const oracleOf = c => c?.oracle_id || (c?.card_faces || []).find(f => f.oracle_id)?.oracle_id || null;

// A usable Japanese face name: has Japanese characters and no furigana left over after stripping.
const cleanJa = t => { const n = t && stripRuby(t); return n && /[ぁ-ヿ一-鿿]/.test(n) && !/[（）()]/.test(n) ? n : null; };

// [{en, ja}] per face of a print (a single-faced card has one entry); ja is null when the face has no usable Japanese name.
function faceNames(c) {
  const faces = c.card_faces || [];
  if (faces.length > 1) return faces.map(f => ({en: f.name, ja: cleanJa(f.printed_name)}));
  return [{en: c.name, ja: cleanJa(c.printed_name || faces[0]?.printed_name)}];
}

// An ordinary booster print: not a promo / variation / full-art, no special frame, normal border.
const regular = c => c.booster === true && !c.promo && !c.variation && !c.full_art && !(c.frame_effects || []).length && (c.border_color || 'black') === 'black';
const num = c => { const m = String(c.collector_number ?? '').match(/\d+/); return m ? Number(m[0]) : 1e9; };
const sameStr = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();

// Preference order of the Japanese prints of one card for a reference card (deterministic):
//   (a) the print with the reference's own printing (set + collector number),
//   (b) a print in the reference card's 17Lands set: ordinary booster print first, then the smallest collector number,
//   (c) any other set: ordinary booster print first, then the newest (released_at).
// Ties: smallest collector number, then id.
function rank(c, ref) {
  const own = ref.print_set && ref.collector_number != null && sameStr(c.set, ref.print_set) && String(c.collector_number) === String(ref.collector_number);
  const tier = own ? 0 : sameStr(c.set, ref.set) ? 1 : 2;
  return [tier, regular(c) ? 0 : 1, tier === 2 ? 0 : num(c), tier === 2 ? -Date.parse(c.released_at || '1970-01-01') : 0, num(c), String(c.id || '')];
}
const cmp = (a, b) => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1; return 0; };

/**
 * prints: Scryfall card objects (any set / language). ref: {name, set, oracle_id, print_set?, collector_number?} of the reference card.
 * Returns {name, complete} or null (-> the page shows the English name).
 * Only Japanese prints of the same oracle_id are used. The name is the printed names of all faces joined with " // "
 * (single-faced: its printed name). A face that the preferred print still prints in English is taken from the next print in the
 * preference order that has a Japanese name for the face of the same English name; a face no print has stays English
 * (complete = false). Null when no face at all has a Japanese name.
 */
export function japaneseNameInfo(prints, ref) {
  if (!ref?.oracle_id) return null;
  const ok = (prints || []).filter(c => (!c.lang || c.lang === 'ja') && oracleOf(c) === ref.oracle_id); // gate: same card, not just the same face name
  if (!ok.length) return null;
  const ranked = ok.map(c => ({c, f: faceNames(c), r: rank(c, ref)})).sort((a, b) => cmp(a.r, b.r));
  const names = [];
  let complete = true, any = false;
  for (const {en} of ranked[0].f) {
    const hit = ranked.map(x => x.f.find(y => y.en === en)?.ja).find(Boolean);
    if (hit) any = true; else complete = false;
    names.push(hit || en);
  }
  return any ? {name: names.join(' // '), complete} : null;
}

export const japaneseName = (prints, ref) => japaneseNameInfo(prints, ref)?.name ?? null;
