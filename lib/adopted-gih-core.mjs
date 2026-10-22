// Adopted-GIH application that does not depend on any one set's data file (see lib/adopted-gih.mjs for FRA's binding).
// The structured part includes the C3 card-effect features read by an LLM (17lands-limited-forecast-data research/gih_llm_extract).
const STRUCTURED = '構造化特徴量（AI抽出の効果を含む）';

/** Applies one set's adopted GIH file (data/adopted-gih-<set>.json) with that set's range helper (see makeGihRange). */
export function makeAdoptedGih(adopted, withGihRange) {
  const byId = new Map(adopted.cards.map(card => [card.id, card]));
  // A changed preview must not silently inherit a prediction for old card text.
  // The GIH range comes from lib/gih-range.mjs (per-card, nominal 80%); the legacy radius is only a last resort.
  // Optional per-model wording (adopted.texts); without it the text is the 28-set + C3 wording, so existing output is unchanged.
  const tx = adopted.texts || {};
  const structured = tx.structured_label || STRUCTURED;
  const applyAdoptedGih = cards => cards.map(card => {
    const row = byId.get(card.id);
    if (!row || row.name !== card.name || row.oracle_text !== (card.oracle_text || '') ||
        row.type_line !== (card.type_line || '') || row.mana_cost !== (card.mana_cost || '')) return withGihRange(card);
    const radius = (card.gih_range?.[1] - card.gih_range?.[0]) / 2 || 5;
    const terms = [{label:structured, value:row.structured_delta}, {label:'ルールテキスト', value:row.text_delta}];
    return withGihRange({...card, gih: row.gih, gih_range: [Math.max(0, row.gih - radius), Math.min(100, row.gih + radius)],
      gih_model_version: adopted.version,
      gih_explanation: {
        summary: tx.summary || '28セット（KHM〜HOB、FIN・MH3を除く）の発売前特徴量とAIがルールテキストから読み取ったカード効果の特徴から、構造化特徴量のExtraTreesとルールテキストのTF-IDF/Ridgeを70:30で合成し、固定係数で予測しています。',
        base: adopted.base, card: row.structured_delta, text: row.text_delta, context: 0,
        clipping: row.gih - adopted.base - row.structured_delta - row.text_delta,
        terms
      },
      gih_reason: terms,
      note: tx.note || 'GIH WR：28セットの構造化特徴量（AIが読み取ったカード効果を含む）＋ルールテキスト予測。ALSAは従来の予測モデル。'
    });
  });
  return {applyAdoptedGih, adoptedGihVersion: adopted.version};
}
