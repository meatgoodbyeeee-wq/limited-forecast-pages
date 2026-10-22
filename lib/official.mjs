import {isDraftable} from './draft-pool.mjs';
const ORIGIN='https://magic.wizards.com';
import {setConfig} from './set-config.mjs';
export const GALLERY=ORIGIN+'/en/products/reality-fracture/card-image-gallery';
async function fetchSource(url,json=false,signal){const r=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(45000)]),headers:{'User-Agent':'LimitedForecast/1.0'}});if(!r.ok)throw new Error(`公開カードの取得に失敗しました (${r.status})。保存済みデータを保持します。`);return json?r.json():r.text();}
/** Reads the official gallery of a set (FRA by default). Other sets: collectOfficial('TRK') tries the galleries listed in lib/set-config.mjs. */
export async function collectOfficial(code='FRA',galleries){
 const cfg=setConfig(code);const list=galleries||cfg?.galleries;if(!list?.length)throw new Error(`セット ${code} の公式ギャラリーが設定されていません。`);
 const signal=AbortSignal.timeout(120000),request=(url,json=false)=>fetchSource(url,json,signal);
 let html,GALLERY_URL;const failures=[];
 for(const url of list){try{html=await request(url);GALLERY_URL=url;break;}catch(e){failures.push(`${url}: ${e.message}`);}}
 if(!html)throw new Error(failures.join(' / '));
 const GALLERY=GALLERY_URL;const ids=[];
 for(const key of ['cardList','newCardList']){const m=html.match(new RegExp(key+':\\{body:("(?:\\\\.|[^"\\\\])*")'));if(m)for(const id of JSON.parse(m[1]).matchAll(/\[([^\]]+)\]/g))ids.push(id[1]);}
 if(!ids.length)throw new Error('公式ギャラリーの形式が変わりました。保存済みカードは変更していません。');
 const paths=[...html.matchAll(/<script[^>]*src="(\/_nuxt\/[^" ]+)"/g)].map(m=>m[1]);let key;
 // This is the public read-only delivery key shipped by the official gallery, not user credentials.
 for(const p of [...paths.filter(p=>/\/119\./.test(p)),...paths.filter(p=>!/\/119\./.test(p))]){const js=await request(ORIGIN+p);key=js.match(/CTF_ACCESS_TOKEN:"([^"]+)"/)?.[1];if(key)break;}
 if(!key)throw new Error('公式ギャラリーの読込設定を取得できませんでした。JSON取込も利用できます。');
 const all=[...new Set(ids)],entries=[],links={};
 for(let i=0;i<all.length;i+=80){const q=new URLSearchParams({'access_token':key,'sys.id[in]':all.slice(i,i+80).join(','),limit:'100',include:'2'});const d=await request('https://cdn.contentful.com/spaces/s5n2t79q9icq/environments/master/entries?'+q,true);entries.push(...d.items);for(const e of d.includes?.Entry||[])links[e.sys.id]=e.fields;}
 const seenProducts=new Set(),boosterNames=cfg.boosterProducts||['Play Booster'];const labels=refs=>(refs||[]).map(r=>links[r.sys.id]?.label||links[r.sys.id]?.name||'');const now=new Date().toISOString(),byName=new Map();
 for(const e of entries){const f=e.fields;if(f.galleryDatetime&&f.galleryDatetime>now)continue;const main=labels(f.supertypes).concat(labels(f.type)).join(' '),sub=labels(f.subtypes).join(' '),type=main+(sub?' — '+sub:'');if(/\bBasic\b/.test(type)||['Plains','Island','Swamp','Mountain','Forest'].includes(f.name))continue;const products=labels(f.foundInProducts);products.forEach(p=>seenProducts.add(p));if(!products.some(p=>boosterNames.some(n=>p.includes(n))))continue;
 const mana=f.manaCost||{};let cmc=0,cost='';const colors=new Set();for(const [symbol,n] of Object.entries(mana)){if(symbol==='GENERIC'){cmc+=Number(n);cost+='{'+n+'}';continue;}for(const part of symbol.split('/'))if('WUBRG'.includes(part)&&part.length===1)colors.add(part);cmc+=(symbol==='X'?0:symbol.startsWith('2/')?2:1)*Number(n);cost+=('{'+symbol+'}').repeat(Number(n));}
 const c={id:e.sys.id,name:f.name,set:cfg.code,rarity:f.rarity.toLowerCase().replace('mythic rare','mythic'),colors:[...'WUBRG'].filter(c=>colors.has(c)),cmc,mana_cost:cost,type_line:type,oracle_text:(f.rulesText||'').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&#39;/g,"'"),power:f.power||'',toughness:f.toughness||'',image:f.face,source:GALLERY,revealed_at:f.galleryDatetime,collector_number:f.collectorNumber,treatments:labels(f.treatments),booster:true};
 if(!isDraftable(c))continue;
 if(!byName.has(c.name)||Number(c.collector_number)<Number(byName.get(c.name).collector_number))byName.set(c.name,c);
 }
 if(!byName.size)throw new Error(`公開カードが0枚のため更新を中止しました。(取得${entries.length}件、収録商品: ${[...seenProducts].join(', ')||'なし'})`);
 return {retrieved_at:now,set:cfg.code,release_arena:code==='FRA'?'2026-09-29':cfg.release,cards:[...byName.values()],entry_count:entries.length,complete:false,source:GALLERY};
}
