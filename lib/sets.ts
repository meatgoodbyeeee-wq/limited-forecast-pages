// Sets offered by the set picker. To add a set later, add an entry here (and its data files);
// entries with available:false are listed but cannot be selected.
export type SetInfo = {code: string; name_ja: string; name_en: string; available: boolean};

export const SETS: SetInfo[] = [
  {code: 'FRA', name_ja: 'リアリティ・フラクチャー', name_en: 'Reality Fracture', available: true},
  {code: '', name_ja: '次のセット', name_en: 'Next set', available: false},
];
export const DEFAULT_SET = 'FRA';
