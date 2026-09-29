// Sets offered by the set picker, in release order. To enable a set later, set available:true
// (and add its data files). Upcoming sets are listed with their announced release date but cannot
// be selected. Sources: Wizards of the Coast / mtg-jp.com announcements (Star Trek, 2027 sets).
export type SetInfo = {code: string; name_ja: string; name_en: string; available: boolean; release?: string};

export const SETS: SetInfo[] = [
  {code: 'FRA', name_ja: 'リアリティ・フラクチャー', name_en: 'Reality Fracture', available: true},
  {code: 'TRK', name_ja: 'スター・トレック', name_en: 'Star Trek', available: false, release: '2026-11-13'},
  {code: '', name_ja: 'ノークティス：深淵の水府', name_en: 'Nauctis: The Sunken Realm', available: false, release: '2027-02-05'},
  {code: '', name_ja: '神河：巨獣侵攻', name_en: 'Kamigawa: Titanbreach', available: false, release: '2027-06-04'},
  {code: '', name_ja: 'ザルファー', name_en: 'Zhalfir', available: false, release: '2027-10-01'},
];
export const DEFAULT_SET = 'FRA';
