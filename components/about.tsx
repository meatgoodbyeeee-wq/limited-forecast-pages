import {useEffect,useState} from 'react';
import {ArrowUpRight} from 'lucide-react';
import {LangContext,makeTr,initialLang,saveLang,type Lang} from '@/lib/i18n';

const BASE=import.meta.env.BASE_URL;
const LINKS={youtube:'https://youtube.com/@yamabekafka',x:'https://x.com/yamabekafka',note:'https://note.com/yamabekafka',litlink:'https://lit.link/yamabekafka'};
type Feeds={note:{title:string;url:string;thumbnail:string;date:string}[];youtube:{id:string;title:string;date:string}[]};

function ExtLink({href,children,className=''}:{href:string;children:React.ReactNode;className?:string}){return <a href={href} target="_blank" rel="noreferrer noopener" className={className}>{children}</a>}
function Section({title,children,link}:{title:string;children:React.ReactNode;link:React.ReactNode}){return <section className="rounded-xl border border-border bg-card p-5 sm:p-6"><div className="flex items-center justify-between gap-3 mb-4"><h2 className="font-semibold">{title}</h2>{link}</div>{children}</section>}
const more=(href:string,label:string)=><ExtLink href={href} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">{label}<ArrowUpRight className="size-3.5"/></ExtLink>;

/** YouTube: thumbnail first; the player (youtube-nocookie) loads only after a click. */
function Video({id,title,tr}:{id:string;title:string;tr:(a:string,b:string)=>string}){
 const [play,setPlay]=useState(false);
 return <div className="overflow-hidden rounded-lg border border-border bg-background/40"><div className="relative aspect-video bg-black">{play
  ?<iframe className="absolute inset-0 size-full" src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin"/>
  :<button type="button" onClick={()=>setPlay(true)} className="group absolute inset-0 size-full" aria-label={tr(`再生：${title}`,`Play: ${title}`)}><img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy" className="size-full object-cover"/><span className="absolute inset-0 grid place-items-center bg-black/20 group-hover:bg-black/10"><span className="grid size-14 place-items-center rounded-full bg-[#FF5C8A] text-white shadow-lg"><svg viewBox="0 0 24 24" className="size-6 ml-0.5" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></span></button>}</div><p className="p-3 text-sm leading-6">{title}</p></div>;
}

/** X: the official timeline widget is loaded only after the visitor asks for it. */
function XTimeline({tr,lang}:{tr:(a:string,b:string)=>string;lang:Lang}){
 const [on,setOn]=useState(false);
 useEffect(()=>{if(!on)return;const s=document.createElement('script');s.src='https://platform.twitter.com/widgets.js';s.async=true;s.charset='utf-8';document.body.appendChild(s);return()=>{s.remove();};},[on]);
 if(!on)return <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground"><p className="leading-6">{tr('最新のポストを表示すると、Xのサーバーに接続します。','Showing the latest posts connects to X\'s servers.')}</p><button type="button" onClick={()=>setOn(true)} className="mt-3 rounded-full border border-primary/60 px-4 py-1.5 text-primary hover:bg-primary/10">{tr('最新のポストを表示','Show latest posts')}</button></div>;
 return <div className="max-h-[560px] overflow-y-auto rounded-lg"><a className="twitter-timeline" data-theme="dark" data-height="540" data-chrome="noheader nofooter transparent" data-lang={lang} href="https://twitter.com/yamabekafka?ref_src=twsrc%5Etfw">Posts by @yamabekafka</a></div>;
}

export function About(){
 const [lang,setLangState]=useState<Lang>(initialLang),[feeds,setFeeds]=useState<Feeds|null>(null);
 const tr=makeTr(lang);
 useEffect(()=>{document.documentElement.lang=lang;document.title=tr('About me｜山辺カフカ｜サキヨミ™','About me | Yamabe Kafka | Sakiyomi™');window.scrollTo(0,0);},[lang]);
 useEffect(()=>{fetch(BASE+'data/about-feeds.json',{cache:'no-store'}).then(r=>r.ok?r.json():null).then(d=>{if(d&&Array.isArray(d.note)&&Array.isArray(d.youtube))setFeeds(d);}).catch(()=>{});},[]);
 const logo=BASE+(lang==='en'?'sakiyomi-logo-en.svg':'sakiyomi-logo.svg');
 const note=feeds?.note||[];
 // Representative video (self-introduction) shown until the build-time feed provides the latest uploads
 const yt=feeds?.youtube?.length?feeds.youtube:[{id:'S8uYKN9qAp8',title:'【自己紹介】Vtuber一問一答自己紹介【新人Vtuber/山辺カフカ】',date:''}];
 const back=()=>{location.hash='';};
 return <LangContext.Provider value={lang}><main className="max-w-5xl mx-auto px-4 sm:px-8 pb-16">
  <header className="flex items-center justify-between py-6 border-b border-border gap-4"><a href={BASE} onClick={e=>{e.preventDefault();back();}} className="flex items-center shrink-0" aria-label={tr('サキヨミ™ トップへ戻る','Back to Sakiyomi™')}><img src={logo} alt={tr('サキヨミ™','Sakiyomi™')} className="h-9 sm:h-10 w-auto"/></a>
   <div className="flex items-center gap-2 sm:gap-3"><a href={BASE} onClick={e=>{e.preventDefault();back();}} className="text-sm text-muted-foreground hover:text-foreground whitespace-nowrap">← {tr('予測ページへ','Forecasts')}</a>
    <div role="group" aria-label="表示言語 / Language" className="flex shrink-0 rounded-full border border-border p-0.5 text-xs">{(['ja','en'] as const).map(l=><button key={l} type="button" lang={l} aria-pressed={lang===l} onClick={()=>{setLangState(l);saveLang(l);}} className={'rounded-full px-2.5 py-1 transition-colors '+(lang===l?'bg-primary text-primary-foreground font-semibold':'text-muted-foreground hover:text-foreground')}>{l==='ja'?'日本語':'EN'}</button>)}</div></div></header>

  <section className="grid gap-8 py-10 md:grid-cols-[minmax(0,320px)_1fr] md:items-center">
   <div className="mx-auto w-full max-w-[300px] md:max-w-none"><div className="relative"><div aria-hidden="true" className="absolute inset-x-6 bottom-0 top-16 rounded-[2rem]" style={{background:'radial-gradient(closest-side,rgba(94,234,196,.22),transparent)'}}/><img src={BASE+'kafka-about.webp'} alt={tr('白衣を着てフラスコを掲げる山辺カフカのイラスト','Illustration of Yamabe Kafka in a lab coat holding up a flask')} width={640} height={1435} className="relative mx-auto h-auto w-auto max-h-[560px] md:max-h-[620px] max-w-full"/></div></div>
   <div>
    <p className="text-primary text-sm tracking-widest">ABOUT ME</p>
    <h1 className="mt-2 text-3xl sm:text-4xl font-bold">{tr('山辺カフカ','Yamabe Kafka')}</h1>
    <p className="mt-1 text-sm text-muted-foreground">{tr('VTuber／カードゲーマー／記事ライター','VTuber / Card gamer / Article writer')}</p>
    <div className="mt-6 space-y-3 leading-7 text-[15px]">
     <p>{tr('見つけてくれて、ありがとう♡ ゲームも、日々のことも。カフカのあれこれ、ここからどうぞ。','Thank you for finding me ♡ Games, everyday life — everything about Kafka starts here.')}</p>
     <p>{tr('マジック：ザ・ギャザリングのリミテッドが好きで、17Landsの公開データを使った発売前予測ツール「サキヨミ™」を作っています。カードを見て、発売前にどれくらい勝てそうかを研究するのがカフカの実験です。','I love Magic: The Gathering Limited, and I build Sakiyomi™, a pre-release forecasting tool based on 17Lands public data. Studying how well a card might perform before release is Kafka\'s experiment.')}</p>
    </div>
    <div className="mt-6 flex flex-wrap gap-2.5">{([['YouTube',LINKS.youtube],['X',LINKS.x],['note',LINKS.note],['lit.link',LINKS.litlink]] as const).map(([n,u])=><ExtLink key={n} href={u} className="inline-flex items-center gap-1.5 rounded-full border border-primary/50 px-4 py-1.5 text-sm text-primary hover:bg-primary/10">{n}<ArrowUpRight className="size-3.5"/></ExtLink>)}</div>
   </div>
  </section>

  <div className="grid gap-6 lg:grid-cols-2">
   <Section title={tr('YouTube','YouTube')} link={more(LINKS.youtube,tr('チャンネルを見る','Open channel'))}>
    <div className="grid gap-4">{yt.slice(0,2).map(v=><Video key={v.id} id={v.id} title={v.title} tr={tr}/>)}</div>
   </Section>
   <Section title="X" link={more(LINKS.x,tr('Xを見る','Open X'))}><XTimeline tr={tr} lang={lang}/></Section>
   <div className="lg:col-span-2"><Section title="note" link={more(LINKS.note,tr('noteを見る','Open note'))}>
    {note.length?<ul className="grid gap-3 sm:grid-cols-3">{note.map(a=><li key={a.url}><ExtLink href={a.url} className="block h-full overflow-hidden rounded-lg border border-border bg-background/40 hover:border-primary/60">{a.thumbnail&&<img src={a.thumbnail} alt="" loading="lazy" referrerPolicy="no-referrer" className="aspect-[1.91/1] w-full object-cover"/>}<div className="p-3"><p className="text-sm font-medium leading-6">{a.title}</p>{a.date&&<p className="mt-1 text-xs text-muted-foreground number">{a.date}</p>}</div></ExtLink></li>)}</ul>
     :<p className="text-sm text-muted-foreground leading-6">{tr('カフカ自身のことを書いた記事は、noteでご覧いただけます。','Articles written about Kafka herself are on note.')}</p>}
   </Section></div>
  </div>

  <section className="mt-6 rounded-xl border border-border bg-card p-5 sm:p-6 text-sm leading-7 text-muted-foreground"><h2 className="font-semibold text-foreground mb-2">{tr('サキヨミ™について','About Sakiyomi™')}</h2><p>{tr('サキヨミ™は山辺カフカが開発・運営している、非公式のMTGリミテッド研究ツールです。17LandsおよびWizards of the Coastによる承認・保証はありません。','Sakiyomi™ is an unofficial MTG Limited research tool developed and run by Yamabe Kafka. It is not endorsed by 17Lands or Wizards of the Coast.')}</p></section>
  <footer className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground">© {tr('山辺カフカ','Yamabe Kafka')} · {tr('イラスト・文章の無断転載はご遠慮ください。','Please do not repost the illustration or text without permission.')}</footer>
 </main></LangContext.Provider>;
}
