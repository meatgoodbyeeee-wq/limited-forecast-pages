import {draftPool} from './draft-pool.mjs';
export const REFRESH_MS=5*60*1000;
const keys=['name','rarity','colors','cmc','mana_cost','type_line','oracle_text','power','toughness'];
export const signature=c=>JSON.stringify(keys.map(k=>c[k]??null));
export function mergeOfficial(old,incoming){
 const byName=new Map(draftPool(old.cards).map(c=>[c.name,c]));
 // An incomplete source response must not delete known or manually edited cards.
 for(const c of draftPool(incoming.cards)){const previous=byName.get(c.name);if(!previous?.manual)byName.set(c.name,c);}
 return {...incoming,cards:[...byName.values()]};
}
export function changes(before,after){const old=new Map(before.map(c=>[c.name,c]));return after.flatMap(c=>{const b=old.get(c.name);if(!b)return [{name:c.name,kind:'added',gih:c.gih,alsa:c.alsa}];const gih=c.gih-b.gih,alsa=c.alsa-b.alsa;if(signature(c)!==signature(b)||Math.abs(gih)>.000001||Math.abs(alsa)>.000001)return [{name:c.name,kind:signature(c)!==signature(b)?'edited':'context',gih,alsa}];return [];});}
