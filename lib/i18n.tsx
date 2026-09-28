import {createContext,useContext} from 'react';

export type Lang='ja'|'en';
const KEY='sakiyomi-lang';

export const LangContext=createContext<Lang>('ja');
/** `tr(ja,en)` picks the string for the current language. */
export const makeTr=(lang:Lang)=>(ja:string,en:string)=>lang==='en'?en:ja;
export function useLang(){const lang=useContext(LangContext);return {lang,tr:makeTr(lang)};}

/** ?lang=en|ja wins, then the saved choice, then Japanese. */
export function initialLang():Lang{
 try{
  const q=new URLSearchParams(window.location.search).get('lang');if(q==='en'||q==='ja')return q;
  const s=window.localStorage.getItem(KEY);if(s==='en'||s==='ja')return s;
 }catch{ /* storage may be unavailable */ }
 return 'ja';
}
export function saveLang(lang:Lang){try{window.localStorage.setItem(KEY,lang);}catch{ /* ignore */ }}

export const unit=(lang:Lang,t:'gih'|'alsa')=>t==='gih'?'%':lang==='en'?'':'手';
export const pt=(lang:Lang)=>lang==='en'?'pp':'pt';
export const time=(s:string,lang:Lang='ja')=>lang==='en'
 ?new Date(s).toLocaleString('en-US',{timeZone:'Asia/Tokyo',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false})+' JST'
 :new Date(s).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
