// Eligibility is based on card metadata, never words in rules text (which may create tokens).
export function isDraftable(c){const type=(c.type_line||'').split(/\s+[—–]\s+/)[0];return !/\b(Token|Emblem|Dungeon|Scheme|Phenomenon|Plane|Vanguard|Conspiracy|Basic)\b/i.test(type)&&!['token','double_faced_token','emblem','art_series','scheme','planar','vanguard'].includes(c.layout)&&c.booster!==false&&c.draftable!==false;}
export const draftPool=cards=>cards.filter(isDraftable);
