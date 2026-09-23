'use client';
import {useState} from 'react';
import images from '@/data/card-images-ja.json';
import type {Card} from '@/lib/types';

type ImageEntry={name:string;name_ja?:string;path:string;source_url:string;back_path?:string};
const catalog=images as Record<string,ImageEntry>;
export function japaneseCardImage(card:Pick<Card,'id'|'name'|'set'>){
  if(card.set.toUpperCase()!=='FRA')return undefined;
  return catalog[card.id]||Object.values(catalog).find(entry=>entry.name===card.name);
}
export function CardArtwork({card}:{card:Card}){
  const entry=japaneseCardImage(card);
  const [failed,setFailed]=useState(false);
  const [back,setBack]=useState(false);
  const path=back?entry?.back_path:entry?.path;
  const src=path?import.meta.env.BASE_URL+path.replace(/^\//,''):undefined;
  return <figure className="min-w-0 space-y-3">
    {entry&&src&&!failed?<a href={src} target="_blank" rel="noreferrer" aria-label={`${entry.name_ja||card.name}の画像を拡大`} className="block mx-auto max-w-[360px] rounded-xl focus-visible:outline-2 focus-visible:outline-primary">
      <img src={src} alt={`${entry.name_ja||card.name}（日本語カード画像${back?'・裏面':''}）`} width={672} height={936} decoding="async" onError={()=>setFailed(true)} className="w-full h-auto rounded-xl"/>
    </a>:<p role="status" className="rounded-lg border border-border p-6 text-sm text-muted-foreground">{failed?'画像を読み込めませんでした。':'このカードの日本語画像はまだ登録されていません。'}</p>}
    {entry?.back_path&&<button type="button" className="text-sm text-primary underline" onClick={()=>{setBack(!back);setFailed(false);}}>{back?'表面を表示':'裏面を表示'}</button>}
    {entry&&<figcaption className="text-sm text-muted-foreground text-center"><a href={entry.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-4">日本語カード画像：Wizards公式</a><span className="block mt-1">© Wizards of the Coast</span></figcaption>}
  </figure>;
}
