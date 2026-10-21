// Sets offered by the set picker, in release order (the list itself lives in lib/set-config.mjs so build scripts can read it).
// To enable a set, set available:true there once its forecast file is published.
import {SET_CONFIG, DEFAULT_SET as DEFAULT} from './set-config.mjs';
export type SetInfo = {code: string; name_ja: string; name_en: string; available: boolean; release?: string; forecast?: string; live?: boolean;
  galleries?: string[]; galleries_ja?: string[]};

export const SETS: SetInfo[] = SET_CONFIG;
export const DEFAULT_SET: string = DEFAULT;
export const setInfo = (code: string): SetInfo => SETS.find(s => s.code === code) || SETS[0];
