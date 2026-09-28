// Rebuilds line breaks in official Japanese rules text, which Wizards' data delivers as one run-on string.
// The English rules text (which has line breaks) is the guide: each English paragraph is matched to a
// Japanese span using keyword lines, identical cost / loyalty / bullet tokens, and otherwise the sentence
// end closest to the English paragraph's share of the text. Returns null when no consistent split exists.

const KW = {
  flying: '飛行', flash: '瞬速', vigilance: '警戒', menace: '威迫', trample: 'トランプル', reach: '到達', deathtouch: '接死',
  lifelink: '絆魂', haste: '速攻', 'first strike': '先制攻撃', 'double strike': '二段攻撃', hexproof: '呪禁', indestructible: '破壊不能',
  defender: '防衛', prowess: '果敢', shroud: '被覆', fear: '畏怖', infect: '感染', wither: '萎縮', changeling: '多相', convoke: '召集',
  'enchant creature': 'エンチャント（クリーチャー）', 'enchant permanent': 'エンチャント（パーマネント）', 'enchant land': 'エンチャント（土地）',
  'enchant artifact': 'エンチャント（アーティファクト）', 'enchant planeswalker': 'エンチャント（プレインズウォーカー）',
};
const TYPES = {Sorcery: 'ソーサリー', Instant: 'インスタント', Enchantment: 'エンチャント', Artifact: 'アーティファクト', Creature: 'クリーチャー'};
const RUBY = /([㐀-鿿々])（[ぁ-ゟ]+）/g;
export const stripRuby = s => s.replace(RUBY, '$1');

function keywordLine(p) {
  const reminder = /\s*\(.*\)\s*$/.test(p), body = p.replace(/\s*\(.*\)\s*$/, '').trim();
  const parts = body.split(',').map(x => x.trim().toLowerCase());
  return parts.length && parts.every(x => KW[x]) ? {ja: parts.map(x => KW[x]).join('、'), reminder} : null;
}
// Sentence ends outside brackets; short all-kana parentheses are ruby, not reminder text.
function boundaries(t) {
  const b = new Set([0]); let depth = 0, open = -1;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if ('「（('.includes(ch)) { if (depth === 0) open = i; depth++; }
    else if ('」）)'.includes(ch)) {
      depth = Math.max(0, depth - 1);
      if (depth === 0 && ch === '）' && !/^[ぁ-ゟ]+$/.test(t.slice(open + 1, i))) b.add(i + 1);
    }
    else if (depth === 0 && ch === '。') b.add(i + 1);
  }
  b.add(t.length);
  return [...b].sort((x, y) => x - y);
}
function reminderEnd(t, pos) {
  let i = pos; while (t[i] === ' ' || t[i] === '　') i++;
  if (t[i] !== '（') return pos;
  for (let depth = 0; i < t.length; i++) { if (t[i] === '（') depth++; else if (t[i] === '）' && --depth === 0) return i + 1; }
  return pos;
}
const tokenOf = p => {
  const k = keywordLine(p); if (k) return [k.ja];
  const m = p.match(/^(\{o[^}]+\}|[+−-]?\d+:|•)/); if (!m) return null;
  const tok = m[1].replace(':', '：');
  return /^[+−-]/.test(tok) ? [tok, tok.replace('−', '-'), tok.replace('−', '－'), tok.replace('+', '＋')] : [tok];
};

function segment(ja, E) {
  if (E.length <= 1) return [ja.trim()];
  const B = boundaries(ja), ratio = ja.length / Math.max(1, E.join('').length), starts = [0];
  for (let i = 0; i < E.length - 1; i++) {
    const s = starts[i]; let cand = null;
    const k = keywordLine(E[i]);
    if (k && ja.startsWith(k.ja, s)) cand = k.reminder ? reminderEnd(ja, s + k.ja.length) : s + k.ja.length;
    else {
      const toks = tokenOf(E[i + 1]), kc = E[i + 1].match(/^[A-Za-z][A-Za-z ]+ (\{o[^}]+\})/);
      if (toks) cand = B.find(b => b > s && toks.some(t => ja.startsWith(t, b))) ?? null;
      else if (kc) cand = B.find(b => b > s && new RegExp('^[^。]{1,14}' + kc[1].replace(/[{}()/]/g, '\\$&')).test(ja.slice(b))) ?? null;
      if (cand == null) {
        const target = s + E[i].length * ratio, opts = B.filter(b => b > s && b < ja.length);
        if (opts.length) cand = opts.reduce((a, b) => Math.abs(b - target) < Math.abs(a - target) ? b : a);
      }
    }
    if (cand == null || cand <= s) return null;
    starts.push(cand);
  }
  starts.push(ja.length);
  const out = E.map((_, j) => ja.slice(starts[j], starts[j + 1]).trim());
  return out.every(Boolean) ? out : null;
}

/** Japanese rules text with line breaks, or null if it cannot be aligned with the English. */
export function japaneseLines(ja, en) {
  const E = (en || '').replace(/\r/g, '').split('\n').map(x => x.trim()).filter(Boolean);
  if (!ja || !E.length) return null;
  const prepEn = E.indexOf('//Prep//'), prepJa = ja.indexOf('//Prep//');
  if (prepEn < 0 || prepJa < 0) { const s = segment(ja, E); return s && s.join('\n'); }
  // Prepared spell: creature text //Prep// spell name, cost, type line, spell text
  const head = segment(ja.slice(0, prepJa), E.slice(0, prepEn));
  const [, , cost, type, ...spellEn] = E.slice(prepEn);
  let rest = ja.slice(prepJa + '//Prep//'.length);
  const ci = cost ? rest.indexOf(cost) : -1, ja_type = TYPES[type] || '';
  if (!head || ci < 0 || !rest.slice(ci + cost.length).startsWith(ja_type)) return null;
  const name = stripRuby(rest.slice(0, ci)).trim();
  rest = rest.slice(ci + cost.length + ja_type.length);
  const spell = segment(rest, spellEn);
  return spell && [...head, '//Prep//', name, cost, ja_type, ...spell].join('\n');
}
