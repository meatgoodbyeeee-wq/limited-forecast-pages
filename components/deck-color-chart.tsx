import type {CSSProperties} from 'react';

type Row={pair:string;rank:number;predicted_wr_pct:number;delta_pp:number;range80:[number,number]};

const MANA:Record<string,string>={W:'#EFE6C8',U:'#4EA8F2',B:'#9A86B4',R:'#F2694F',G:'#43BE78'};
const MINT='#5EEAC4';
const f=(n:number,d=1)=>Number.isFinite(n)?n.toFixed(d):'—';

/** Horizontal bar chart for two-colour pair win-rate forecasts (Sakiyomi feature-2 design). */
export function DeckColorChart({rows,mean,names}:{rows:Row[];mean:number;names:Record<string,string>}){
 const sorted=[...rows].sort((a,b)=>a.rank-b.rank);
 const lo=Math.floor(Math.min(...sorted.map(r=>r.range80[0])))-1;
 const hi=Math.ceil(Math.max(...sorted.map(r=>r.range80[1])))+1;
 const pct=(v:number)=>Math.min(100,Math.max(0,(v-lo)/(hi-lo)*100));
 const meanPos={'--p':pct(mean)/100} as CSSProperties;
 return <div className="sky-pairs">
  <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 mb-5">
   <p className="text-xs sm:text-sm text-muted-foreground tracking-wider">色組別 勝率予測 · 80%誤差目安</p>
   <div className="flex items-center gap-4 text-xs text-muted-foreground" aria-hidden="true">
    <span className="flex items-center gap-2"><span style={{width:22,height:10,borderRadius:'2px 5px 5px 2px',background:MINT}}/>予測勝率</span>
    <span className="flex items-center gap-2"><span style={{width:22,height:8,borderRadius:4,background:'rgba(94,234,196,.28)'}}/>80%誤差目安</span>
   </div>
  </div>
  <ol className="relative" style={meanPos} aria-label={`色組別の予測勝率。2色平均 ${f(mean)}%`}>
   <div aria-hidden="true" className="sky-mean"/>
   {sorted.map((r,i)=>{return <li key={r.pair} className="sky-row py-2.5 rounded-md" title={`${names[r.pair]||r.pair}：予測 ${f(r.predicted_wr_pct)}%（80%誤差目安 ${f(r.range80[0])}–${f(r.range80[1])}%、2色平均との差 ${r.delta_pp>=0?'+':''}${f(r.delta_pp)}pt）`}>
    <div className="sky-label flex items-center gap-2 min-w-0">
     <span className="flex gap-1 shrink-0">{r.pair.split('').map(k=><span key={k} style={{width:14,height:14,borderRadius:'50%',background:MANA[k]}}/>)}</span>
     <span className="font-mono font-bold text-base" style={{color:'var(--foreground)'}}>{r.pair}</span>
     <span className="text-xs text-muted-foreground truncate">{names[r.pair]}</span>
     <span className="sr-only">{r.rank}位</span>
    </div>
    <div className="sky-track relative" style={{height:26}} aria-hidden="true">
     <div className="sky-mean-tick"/>
     <div className="sky-band" style={{position:'absolute',top:6,height:14,left:`${pct(r.range80[0])}%`,width:`${pct(r.range80[1])-pct(r.range80[0])}%`,borderRadius:7,background:'rgba(94,234,196,.22)',animationDelay:`${120+i*45}ms`}}/>
     <div className="sky-bar" style={{position:'absolute',top:2,height:22,left:0,width:`${pct(r.predicted_wr_pct)}%`,borderRadius:'4px 11px 11px 4px',background:MINT,opacity:.85,animationDelay:`${i*45}ms`}}/>
    </div>
    <div className="sky-value text-right number leading-tight">
     <span className="font-bold text-xl sm:text-2xl" style={{color:'var(--foreground)'}}>{f(r.predicted_wr_pct)}<span className="text-sm text-muted-foreground ml-0.5">%</span></span>
     <div className="text-[11px] text-muted-foreground mt-0.5 whitespace-nowrap">{r.delta_pp>=0?'+':''}{f(r.delta_pp)}pt · {f(r.range80[0])}–{f(r.range80[1])}</div>
    </div>
   </li>})}
  </ol>
  <div className="relative h-6 mt-2 text-xs text-muted-foreground" style={meanPos}>
   <span className="sky-mean-label absolute whitespace-nowrap number">2色平均 {f(mean)}%</span>
  </div>
 </div>;
}
