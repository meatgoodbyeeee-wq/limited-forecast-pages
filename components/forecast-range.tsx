import type {Card} from '@/lib/types';

export type Metric='gih'|'alsa';
export type DeviationNote={source?:'ai'|'manual';written_at?:string;data_as_of?:string;reasons:string[]};
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

const unit=(t:Metric)=>t==='gih'?'%':'手';
const label=(t:Metric)=>t==='gih'?'GIH WR':'ALSA';
function pill(t:Metric,d:Deviation){
 // ALSA: a smaller number means the card was taken earlier
 const word=d.status==='above'?(t==='gih'?'予測を上回る':'予測より遅く取られた'):d.status==='below'?(t==='gih'?'予測を下回る':'予測より早く取られた'):d.status==='inside'?'予測の幅に収まる':d.status==='pending'?'判定保留（件数不足）':d.status==='none'?'実測なし':'発売前';
 const out=d.status==='above'||d.status==='below';
 return <span className="rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap" style={out?{color:PINK,borderColor:'rgba(255,92,138,.55)'}:d.status==='inside'?{color:MINT,borderColor:'rgba(94,234,196,.5)'}:{color:'var(--muted-foreground)',borderColor:'var(--border)'}}>{out||d.status==='inside'?`${label(t)} ${word}`:word}</span>;
}

/** Pre-release prediction band vs. observed value (Sakiyomi feature-3 design). */
export function ForecastRange({card,metric:t}:{card:Card;metric:Metric}){
 const d=deviation(card,t);
 const xs=[d.range[0],d.range[1],d.pred,...(d.obs!=null?[d.obs]:[])];
 let lo=Math.min(...xs),hi=Math.max(...xs);const pad=Math.max(t==='gih'?1:.4,(hi-lo)*.12);lo-=pad;hi+=pad;
 const pos=(v:number)=>(v-lo)/(hi-lo)*100,x=(v:number)=>`${pos(v)}%`;
 const showObs=d.obs!=null&&d.n>0;
 return <div className="mt-3 rounded-lg border border-border bg-background/40 px-4 pt-3 pb-3" aria-label={`${label(t)}：発売前予測 ${f(d.pred)}${unit(t)}、予測の幅 ${f(d.range[0])}–${f(d.range[1])}${unit(t)}${showObs?`、実測 ${f(d.obs!)}${unit(t)}`:''}`}>
  <div className="flex items-center justify-between gap-3">
   <span className="text-xs text-muted-foreground">{d.live?'発売前予測と実測':'発売前予測と予測の幅'}</span>{!card.late_card&&d.live&&pill(t,d)}
  </div>
  <div className="relative h-[62px] number" aria-hidden="true">
   <div className="absolute left-0 right-0 top-[30px] h-[2px] rounded" style={{background:'rgba(232,237,244,.12)'}}/>
   <div className="absolute top-[24px] h-[14px] rounded-full" style={{left:x(d.range[0]),width:`calc(${x(d.range[1])} - ${x(d.range[0])})`,background:'rgba(94,234,196,.28)',border:'1.5px solid rgba(94,234,196,.65)'}}/>
   {d.range.map((v,i)=><span key={i} className="absolute top-[42px] -translate-x-1/2 text-[11px] whitespace-nowrap" style={{left:x(v),color:'rgba(94,234,196,.8)'}}>{r1(v)}{unit(t)}</span>)}
   <span className="absolute top-[24px] size-[14px] -translate-x-1/2 rounded-full" style={{left:x(d.pred),background:MINT,boxShadow:'0 0 0 3px var(--card)'}}/>
   <span className="absolute top-[2px] -translate-x-1/2 text-xs font-bold whitespace-nowrap" style={{left:x(d.pred),color:MINT}}>{r1(d.pred)}{unit(t)}</span>
   {showObs&&<>
    <span className="absolute top-[20px] size-[22px] -translate-x-1/2 rounded-full" style={{left:x(d.obs!),background:PINK,boxShadow:'0 0 0 3px var(--card)'}}/>
    {/* if the observed label would overlap the predicted label, drop it below the track */}
    <span className={'absolute -translate-x-1/2 text-xs font-bold whitespace-nowrap '+(Math.abs(pos(d.obs!)-pos(d.pred))<16?'top-[44px]':'top-0')} style={{left:x(d.obs!),color:PINK}}>{r1(d.obs!)}{unit(t)}</span>
   </>}
  </div>
  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground number">
   <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{background:MINT}}/>{card.late_card?'参考値':'発売前予測'} {f(d.pred)}{unit(t)}</span>
   <span className="inline-flex items-center gap-1.5"><span className="h-2 w-4 rounded-full" style={{background:'rgba(94,234,196,.4)'}}/>予測の幅 {f(d.range[0])}–{f(d.range[1])}{unit(t)}</span>
   {showObs&&<span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{background:PINK}}/>実測 {f(d.obs!)}{unit(t)}（{t==='gih'?'#GIH':'#Seen'} {d.n.toLocaleString()}）</span>}
  </div>
  {t==='alsa'&&<p className="text-[11px] text-muted-foreground mt-1">ALSAは数値が小さいほど早く取られたことを示します。</p>}
  {d.live&&!showObs&&t==='alsa'&&<p className="text-[11px] text-muted-foreground mt-1">ALSAの実測はまだ取り込まれていません（17LandsのGame DataにはALSAが含まれないため）。</p>}
  {d.status==='pending'&&<p className="text-[11px] text-muted-foreground mt-1">件数が{MIN_N[t].toLocaleString()}未満のため、予測の幅から外れたかどうかの判定を保留しています。</p>}
 </div>;
}

/** Reasons shown only after public data, when the observed value left the predicted range. */
export function DeviationReason({card,metric:t,notes}:{card:Card;metric:Metric;notes?:DeviationNotes|null}){
 const d=deviation(card,t);
 if(card.late_card||(d.status!=='above'&&d.status!=='below'))return null;
 const note=(notes?.cards?.[card.name]||notes?.cards?.[card.name.split(' // ')[0]])?.[t];
 if(!note?.reasons?.length)return <div className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">予測の幅から外れました。ずれた理由の分析はまだ掲載されていません。</div>;
 const ai=note.source!=='manual';
 return <div className="mt-3 rounded-lg p-4" style={{border:'1.5px solid rgba(94,234,196,.45)',background:'rgba(94,234,196,.06)'}}>
  <h4 className="flex items-center gap-2 font-semibold text-sm" style={{color:MINT}}><svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true"><path d="M12 1.5l2.3 8.2 8.2 2.3-8.2 2.3-2.3 8.2-2.3-8.2L1.5 12l8.2-2.3z"/></svg>{ai?'AIの分析：ずれた理由':'分析メモ：ずれた理由'}</h4>
  <ol className="mt-2 space-y-1.5 text-sm leading-6 list-decimal pl-5">{note.reasons.map((r,i)=><li key={i}>{r}</li>)}</ol>
  {(note.data_as_of||note.written_at)&&<p className="mt-2 text-[11px] text-muted-foreground">{note.data_as_of&&`${note.data_as_of}時点の実測をもとに分析`}{note.data_as_of&&note.written_at&&' · '}{note.written_at&&`掲載 ${note.written_at}`}{ai&&' · AIによる推定で、確定した原因ではありません'}</p>}
 </div>;
}
