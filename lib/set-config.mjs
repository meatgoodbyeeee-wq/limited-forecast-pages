// Single source of truth for the sets the site knows about. Read by the browser (lib/sets.ts) and by the build scripts.
//   available : selectable in the set picker and shown to visitors
//   forecast  : the published forecast file under public/ (FRA is the original file; other sets use forecast-<code>.json)
//   live      : the set has post-release observation feeds (17Lands public data, card data, pair win rates, deviation notes)
//   galleries : official Wizards card gallery pages, tried in order (the cards are read from the gallery's public data)
// Sources: Wizards of the Coast / mtg-jp.com announcements. Star Trek: prerelease 2026-11-06..12, release 2026-11-13.
export const SET_CONFIG = [
  {code: 'FRA', name_ja: 'リアリティ・フラクチャー', name_en: 'Reality Fracture', available: true, forecast: 'forecast.json', live: true,
    galleries: ['https://magic.wizards.com/en/products/reality-fracture/card-image-gallery']},
  {code: 'TRK', name_ja: 'スター・トレック', name_en: 'Star Trek', available: false, release: '2026-11-13', forecast: 'forecast-trk.json', live: false,
    galleries: ['https://magic.wizards.com/en/products/star-trek/card-image-gallery'],
    galleries_ja: ['https://magic.wizards.com/ja/products/star-trek/card-image-gallery']},
  {code: '', name_ja: 'ノークティス：深淵の水府', name_en: 'Nauctis: The Sunken Realm', available: false, release: '2027-02-05'},
  {code: '', name_ja: '神河：巨獣侵攻', name_en: 'Kamigawa: Titanbreach', available: false, release: '2027-06-04'},
  {code: '', name_ja: 'ザルファー', name_en: 'Zhalfir', available: false, release: '2027-10-01'},
];
// The set shown first on a visit: the newest set once it is published (available), otherwise FRA.
export const DEFAULT_SET = SET_CONFIG.some(s => s.code === 'TRK' && s.available) ? 'TRK' : 'FRA';
export const setConfig = code => SET_CONFIG.find(s => s.code && s.code === String(code).toUpperCase());
