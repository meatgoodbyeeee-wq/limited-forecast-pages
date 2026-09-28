import type {Card} from '@/lib/types';
import {useLang,unit as unitOf,type Lang} from '@/lib/i18n';

export type Metric='gih'|'alsa';
export type DeviationNote={source?:'ai'|'manual';written_at?:string;data_as_of?:string;reasons:string[];reasons_en?:string[]};
export type DeviationNotes={set?:string;cards?:Record<string,Partial<Record<Metric,DeviationNote>>>};

const MINT='#5EEAC4',PINK='#FF5C8A';
/** Minimum observations before an out-of-range result is called a miss (GIH WR sampling noise is large early on). */
export const MIN_N:Record<Metric,number>={gih:1000,alsa:1000};
const f=(n:number,d=2)=>Number.isFinite(n)?n.toFixed(d):'—';
/** Chart labels: round half up to one decimal (61.18 → 61.2). */
const r1=(n:number)=>Number.isFinite(n)?(Math.round(n*10)/10).toFixed(1):'—';

export type Deviation={pred:number;range:[number,number];obs:number|null;n:number;live:boolean;status:'preview'|'none'|'pending'|'inside'|'above'|'below'};
export function deviation(card:Card,t:Metric):Deviation{
 const live=!!card.phase&&card.phase!=='PREVIEW';
 const pred=live?((t==='gih'?card.pre_release_gih:card.pre_release_alsa)??card[t]):card[t];
 const range=(t==='gih'?card.gih_range:card.alsa_range) as [number,number];
 const obs=(t==='gih'?card.observed_gih:card.observed_alsa)??null;
 const n=(t==='gih'?card.observed_gih_n:card.observed_seen_n)||0;
 const status=!live?'preview':obs==null||!(n>0)?'none':n<MIN_N[t]?'pending':obs>range[1]?'above':obs<range[0]?'below':'inside';
 return {pred,range,obs,n,live,status};
}

const label=(t:Metric)=>t==='gih'?'GIH WR':'ALSA';
function pill(t:Metric,d:Deviation,tr:(ja:string,en:string)=>string){
 // ALSA: a smaller number means the card was taken earlier
 const word=d.status==='above'?(t==='gih'?tr('予測を上回る','above forecast'):tr('予測より遅く取られた','picked later than forecast'))
  :d.status==='below'?(t==='gih'?tr('予測を下回る','below forecast'):tr('予測より早く取られた','picked earlier than forecast'))
  :d.status==='inside'?tr('予測の幅に収まる','within forecast range'):d.status==='pending'?tr('判定保留（件数不足）','pending (too few samples)'):d.status==='none'?tr('実測なし','no observed data'):tr('発売前','pre-release');
 const out=d.status==='above'||d.status==='below';
 return <span className="rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap" style={out?{color:PINK,borderColor:'rgba(255,92,138,.55)'}:d.status==='inside'?{color:MINT,borderColor:'rgba(94,234,196,.5)'}:{color:'var(--muted-foreground)',borderColor:'var(--border)'}}>{out||d.status==='inside'?`${label(t)} ${word}`:word}</span>;
}

/** Pre-release prediction band vs. observed value (Sakiyomi feature-3 design). */
export function ForecastRange({card,metric:t}:{card:Card;metric:Metric}){
 const {lang,tr}=useLang();const u=unitOf(lang,t);
 const d=deviation(card,t);
 const xs=[d.range[0],d.range[1],d.pred,...(d.obs!=null?[d.obs]:[])];
 let lo=Math.min(...xs),hi=Math.max(...xs);const pad=Math.max(t==='gih'?1:.4,(hi-lo)*.12);lo-=pad;hi+=pad;
 // ALSA runs right-to-left so that further right = picked earlier (smaller number), like GIH WR's "better" side
 const pos=(v:number)=>(t==='alsa'?hi-v:v-lo)/(hi-lo)*100,x=(v:number)=>`${pos(v)}%`;
 const bandL=Math.min(pos(d.range[0]),pos(d.range[1])),bandW=Math.abs(pos(d.range[1])-pos(d.range[0]));
 const showObs=d.obs!=null&&d.n>0;
 return <div className="mt-3 rounded-lg border border-border bg-background/40 px-4 pt-3 pb-3" aria-label={tr(`${label(t)}：発売前予測 ${f(d.pred)}${u}、予測の幅 ${f(d.range[0])}–${f(d.range[1])}${u}${showObs?`、実測 ${f(d.obs!)}${u}`:''}`,`${label(t)}: pre-release forecast ${f(d.pred)}${u}, forecast range ${f(d.range[0])}–${f(d.range[1])}${u}${showObs?`, observed ${f(d.obs!)}${u}`:''}`)}>
  <div className="flex items-center justify-between gap-3">
   <span className="text-xs text-muted-foreground">{d.live?tr('発売前予測と実測','Pre-release forecast vs observed'):tr('発売前予測と予測の幅','Pre-release forecast and range')}</span>{!card.late_card&&d.live&&pill(t,d,tr)}
  </div>
  <div className="relative h-[62px] number" aria-hidden="true">
   <div className="absolute left-0 right-0 top-[30px] h-[2px] rounded" style={{background:'rgba(232,237,244,.12)'}}/>
   <div className="absolute top-[24px] h-[14px] rounded-full" style={{left:`${bandL}%`,width:`${bandW}%`,background:'rgba(94,234,196,.28)',border:'1.5px solid rgba(94,234,196,.65)'}}/>
   {d.range.map((v,i)=><span key={i} className="absolute top-[42px] -translate-x-1/2 text-[11px] whitespace-nowrap" style={{left:x(v),color:'rgba(94,234,196,.8)'}}>{r1(v)}{u}</span>)}
   <span className="absolute top-[24px] size-[14px] -translate-x-1/2 rounded-full" style={{left:x(d.pred),background:MINT,boxShadow:'0 0 0 3px var(--card)'}}/>
   <span className="absolute top-[2px] -translate-x-1/2 text-xs font-bold whitespace-nowrap" style={{left:x(d.pred),color:MINT}}>{r1(d.pred)}{u}</span>
   {showObs&&<>
    <span className="absolute top-[20px] size-[22px] -translate-x-1/2 rounded-full" style={{left:x(d.obs!),background:PINK,boxShadow:'0 0 0 3px var(--card)'}}/>
    {/* if the observed label would overlap the predicted label, drop it below the track */}
    <span className={'absolute -translate-x-1/2 text-xs font-bold whitespace-nowrap '+(Math.abs(pos(d.obs!)-pos(d.pred))<16?'top-[44px]':'top-0')} style={{left:x(d.obs!),color:PINK}}>{r1(d.obs!)}{u}</span>
   </>}
  </div>
  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground number">
   <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{background:MINT}}/>{card.late_card?tr('参考値','Reference'):tr('発売前予測','Pre-release forecast')} {f(d.pred)}{u}</span>
   <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full" style={{background:'rgba(94,234,196,.4)'}}/>{tr('予測の幅','Forecast range')} {f(d.range[0])}–{f(d.range[1])}{u}</span>
   {showObs&&<span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{background:PINK}}/>{tr('実測','Observed')} {f(d.obs!)}{u}{tr('（',' (')}{t==='gih'?'#GIH':'#Seen'} {d.n.toLocaleString(lang==='en'?'en-US':'ja-JP')}{tr('）',')')}</span>}
  </div>
  {t==='alsa'&&<p className="text-[11px] text-muted-foreground mt-1">{tr('ALSAは数値が小さいほど早く取られたことを示します（グラフは右ほど早い）。','A lower ALSA means the card was taken earlier (further right = earlier).')}</p>}
  {d.live&&!showObs&&t==='alsa'&&<p className="text-[11px] text-muted-foreground mt-1">{tr('ALSAの実測は17Landsのカードデータから1日1回取得します（まだ取得できていません）。','Observed ALSA comes from 17Lands card data once a day (not available yet).')}</p>}
  {showObs&&t==='alsa'&&<p className="text-[11px] text-muted-foreground mt-1">{tr('ALSAの実測は17Landsのカードデータ（発売後28日間）。予測値には反映していません。','Observed ALSA is from 17Lands card data (first 28 days). It is not blended into the forecast.')}</p>}
  {d.status==='pending'&&<p className="text-[11px] text-muted-foreground mt-1">{tr(`件数が${MIN_N[t].toLocaleString()}未満のため、予測の幅から外れたかどうかの判定を保留しています。`,`Fewer than ${MIN_N[t].toLocaleString('en-US')} samples, so it is too early to say whether the value left the forecast range.`)}</p>}
 </div>;
}

/** Reasons shown only after public data, when the observed value left the predicted range. */
export function DeviationReason({card,metric:t,notes}:{card:Card;metric:Metric;notes?:DeviationNotes|null}){
 const {lang,tr}=useLang();
 const d=deviation(card,t);
 // Reasons are written for GIH WR only.
 if(t==='alsa'||card.late_card||(d.status!=='above'&&d.status!=='below'))return null;
 const note=(notes?.cards?.[card.name]||notes?.cards?.[card.name.split(' // ')[0]])?.[t];
 if(!note?.reasons?.length)return <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">{tr('予測の幅から外れました。ずれた理由の分析はまだ掲載されていません。','The observed value left the forecast range. No analysis of why has been posted yet.')}</div>;
 const ai=note.source!=='manual';
 const reasons=reasonsFor(note,lang);
 return <div className="mt-3 rounded-lg p-4" style={{border:'1.5px solid rgba(94,234,196,.45)',background:'rgba(94,234,196,.06)'}}>
  <h4 className="flex items-center gap-2 font-semibold text-sm" style={{color:MINT}}><svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true"><path d="M12 1.5l2.3 8.2 8.2 2.3-8.2 2.3-2.3 8.2-2.3-8.2L1.5 12l8.2-2.3z"/></svg>{ai?tr('AIの分析：ずれた理由','AI analysis: why it deviated'):tr('分析メモ：ずれた理由','Analysis: why it deviated')}</h4>
  <ol className="mt-2 space-y-1.5 text-sm leading-6 list-decimal pl-5" lang={reasons===note.reasons?'ja':'en'}>{reasons.map((r,i)=><li key={i}>{r}</li>)}</ol>
  {(note.data_as_of||note.written_at)&&<p className="mt-2 text-[11px] text-muted-foreground">{note.data_as_of&&tr(`${note.data_as_of}時点の実測をもとに分析`,`Based on data as of ${note.data_as_of}`)}{note.data_as_of&&note.written_at&&' · '}{note.written_at&&tr(`掲載 ${note.written_at}`,`posted ${note.written_at}`)}{ai&&tr(' · AIによる推定で、確定した原因ではありません',' · AI estimate, not a confirmed cause')}</p>}
 </div>;
}
/** English page shows reasons_en when present, otherwise the Japanese reasons. */
const reasonsFor=(note:DeviationNote,lang:Lang)=>lang==='en'&&note.reasons_en?.length?note.reasons_en:note.reasons;
