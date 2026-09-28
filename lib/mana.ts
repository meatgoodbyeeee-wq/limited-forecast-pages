// Mana costs arrive from the official gallery data in arbitrary symbol order ({R}{R}{4}).
// Display them in printed order: X, generic, colorless, then colored symbols in the
// standard color order for the card's color combination, then hybrid / Phyrexian symbols.
const ORDER: Record<string, string> = {
  // two colors: allied clockwise, enemy
  UW: 'WU', BU: 'UB', BR: 'BR', GR: 'RG', GW: 'GW', BW: 'WB', RU: 'UR', BG: 'BG', RW: 'RW', GU: 'GU',
  // shards and wedges
  BUW: 'WUB', BRU: 'UBR', BGR: 'BRG', GRW: 'RGW', GUW: 'GWU', BGW: 'WBG', RUW: 'URW', BGU: 'BGU', BRW: 'RWB', GRU: 'GUR',
  // four colors (named by the missing color's opposite start) and five
  BRUW: 'WUBR', BGRU: 'UBRG', BGRW: 'BRGW', GRUW: 'RGWU', BGUW: 'GWUB', BGRUW: 'WUBRG',
};
const colorOrder = (colors: string[]) => {
  const key = [...colors].sort().join('');
  return colors.length < 2 ? key : ORDER[key] || 'WUBRG';
};

export function formatManaCost(cost: string) {
  const symbols = cost.match(/\{[^}]+\}/g);
  if (!symbols) return cost;
  const inner = (s: string) => s.slice(1, -1).toUpperCase();
  const variable = symbols.filter(s => /^[XYZ]$/.test(inner(s)));
  const generic = symbols.filter(s => /^\d+$/.test(inner(s)));
  const colorless = symbols.filter(s => /^[CS]$/.test(inner(s)));
  const mono = symbols.filter(s => /^[WUBRG]$/.test(inner(s)));
  const other = symbols.filter(s => !variable.includes(s) && !generic.includes(s) && !colorless.includes(s) && !mono.includes(s));
  const order = colorOrder([...new Set(mono.map(inner))]);
  mono.sort((a, b) => order.indexOf(inner(a)) - order.indexOf(inner(b)));
  return [...variable, ...generic, ...colorless, ...mono, ...other].join('');
}
