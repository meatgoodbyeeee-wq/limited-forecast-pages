import adopted from '../data/adopted-gih-fra.json' with { type: 'json' };
import {withGihRange} from './gih-range.mjs';

const byId = new Map(adopted.cards.map(card => [card.id, card]));

// A changed preview must not silently inherit a prediction for old card text.
// The GIH range comes from lib/gih-range.mjs (per-card, nominal 80%); the legacy radius is only a last resort.
export function applyAdoptedGih(cards) {
  return cards.map(card => {
    const row = byId.get(card.id);
    if (!row || row.name !== card.name || row.oracle_text !== (card.oracle_text || '') ||
        row.type_line !== (card.type_line || '') || row.mana_cost !== (card.mana_cost || '')) return withGihRange(card);
    const radius = (card.gih_range?.[1] - card.gih_range?.[0]) / 2 || 5;
    return withGihRange({...card, gih: row.gih, gih_range: [Math.max(0, row.gih - radius), Math.min(100, row.gih + radius)],
      gih_model_version: adopted.version,
      gih_explanation: {
        summary: '22セットの発売前特徴量から、構造化特徴量のExtraTreesとルールテキストのTF-IDF/Ridgeを70:30で合成し、固定係数で予測しています。',
        base: adopted.base, card: row.structured_delta, text: row.text_delta, context: 0,
        clipping: row.gih - adopted.base - row.structured_delta - row.text_delta,
        terms: [{label:'構造化特徴量', value:row.structured_delta}, {label:'ルールテキスト', value:row.text_delta}]
      },
      gih_reason: [{label:'構造化特徴量', value:row.structured_delta}, {label:'ルールテキスト', value:row.text_delta}],
      note: 'GIH WR：22セットの構造化特徴量＋ルールテキスト予測。ALSAは従来の予測モデル。'
    });
  });
}

export const adoptedGihVersion = adopted.version;
