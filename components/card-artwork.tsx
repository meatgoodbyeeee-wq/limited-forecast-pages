'use client';
import {useState} from 'react';
import images from '@/data/card-images-ja.json';
import type {Card} from '@/lib/types';
import {useLang,type Lang} from '@/lib/i18n';
import cardTextJa from '@/data/card-text-ja.json';

type ImageEntry={name:string;name_ja?:string;path:string;source_url:string;back_path?:string};
const catalog=images as Record<string,ImageEntry>;
const byName=new Map(Object.values(catalog).map(entry=>[entry.name,entry]));
export function japaneseCardImage(card:Pick<Card,'id'|'name'|'set'>){
  if(card.set.toUpperCase()!=='FRA')return undefined;
  return catalog[card.id]||byName.get(card.name);
}
/** Card name in the display language (Japanese falls back to English when no Japanese name is known). */
export function cardName(card:{name:string;id?:string;set?:string},lang:Lang){
  if(lang==='en')return card.name;
  const entry=card.id&&card.set?japaneseCardImage(card as Pick<Card,'id'|'name'|'set'>):byName.get(card.name)||byName.get(card.name.split(' // ')[0]);
  return entry?.name_ja||card.name;
}
type TextJa={name:string;type_line:string;oracle_text:string};
const fraJa=(cardTextJa as {fra?:Record<string,TextJa>}).fra||{};
const similarJa=(cardTextJa as {similar?:Record<string,string>}).similar||{};
/** Contentful mana codes ({oT}, {oCoC}, {o2o(r/g)}) as ordinary symbols ({T}, {C}{C}, {2}{R/G}). */
export const manaSymbols=(t:string)=>t.replace(/\{((?:o[^o}]+)+)\}/g,(_,codes:string)=>codes.split('o').filter(Boolean).map(c=>'{'+c.replace(/[()]/g,'').toUpperCase()+'}').join(''));
/** Type line and rules text in the display language (Japanese falls back to English per field). */
export function cardText(card:Pick<Card,'id'|'type_line'|'oracle_text'>,lang:Lang){
  const ja=lang==='ja'?fraJa[card.id]:undefined;
  return {type_line:ja?.type_line||card.type_line,oracle_text:manaSymbols(ja?.oracle_text?ja.oracle_text.replace(/ +（/g,'（'):card.oracle_text||''),ja:!!ja?.oracle_text};
}
export function similarName(s:{set:string;name:string},lang:Lang){
  return lang==='ja'?similarJa[`${s.set}|${s.name}`]||similarJa[`${s.set}|${s.name.split(' // ')[0]}`]||s.name:s.name;
}
export function CardArtwork({card}:{card:Card}){
  const {lang,tr}=useLang();
  const entry=japaneseCardImage(card);
  const [failed,setFailed]=useState(false);
  const [back,setBack]=useState(false);
  const path=back?entry?.back_path:entry?.path;
  const src=path?import.meta.env.BASE_URL+path.replace(/^\//,''):undefined;
  const name=cardName(card,lang);
  return <figure className="min-w-0 space-y-3">
    {entry&&src&&!failed?<a href={src} target="_blank" rel="noreferrer" aria-label={tr(`${name}の画像を拡大`,`Enlarge the image of ${name}`)} className="block mx-auto max-w-[360px] rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
      <img src={src} alt={tr(`${name}（日本語カード画像${back?'・裏面':''}）`,`${name} (Japanese card image${back?', back face':''})`)} width={672} height={936} decoding="async" onError={()=>setFailed(true)} className="w-full h-auto rounded-xl"/>
    </a>:<p role="status" className="rounded-lg border border-border p-6 text-sm text-muted-foreground">{failed?tr('画像を読み込めませんでした。','Could not load the image.'):tr('このカードの日本語画像はまだ登録されていません。','No Japanese image is registered for this card yet.')}</p>}
    {entry?.back_path&&<button type="button" className="text-sm text-primary underline" onClick={()=>{setBack(!back);setFailed(false);}}>{back?tr('表面を表示','Show front face'):tr('裏面を表示','Show back face')}</button>}
    {entry&&<figcaption className="text-sm text-muted-foreground text-center"><a href={entry.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">{tr('日本語カード画像：Wizards公式','Japanese card image: Wizards of the Coast')}</a><span className="block mt-1">© Wizards of the Coast</span></figcaption>}
  </figure>;
}
