import type {Card} from '@/lib/types';
import type {Lang} from '@/lib/i18n';
import {cardName,japaneseCardImage} from '@/components/card-artwork';
import {MANA} from '@/components/deck-color-chart';

/** PC card list: one column per color, one row per grade (17Lands-style tier list). */
type ColKey='W'|'U'|'B'|'R'|'G'|'M'|'C';
const COLS:{key:ColKey;ja:string;en:string}[]=[
  {key:'W',ja:'白',en:'White'},{key:'U',ja:'青',en:'Blue'},{key:'B',ja:'黒',en:'Black'},{key:'R',ja:'赤',en:'Red'},{key:'G',ja:'緑',en:'Green'},
  {key:'M',ja:'多色',en:'Multi'},{key:'C',ja:'無色',en:'Colorless'},
];
export const colKey=(c:Pick<Card,'colors'>):ColKey=>{const ks=c.colors||[];return ks.length>1?'M':ks.length===1?(ks[0] as ColKey):'C';};
/** Grade bands (17Lands-style A+ to F): how far a forecast GIH WR sits above / below the set average, in standard deviations
 *  (lower bound of each grade). 0.5-SD steps with C at the centre (-0.25 to +0.25); F is everything below D-. */
const GRADES:[string,number][]=[['A+',3.25],['A',2.75],['A-',2.25],['B+',1.75],['B',1.25],['B-',0.75],['C+',0.25],['C',-0.25],['C-',-0.75],['D+',-1.25],['D',-1.75],['D-',-2.25],['F',-Infinity]];
export function makeGrader(all:{gih:number}[]){
  const xs=all.map(c=>c.gih).filter(Number.isFinite),n=xs.length||1,mean=xs.reduce((s,v)=>s+v,0)/n,sd=Math.sqrt(xs.reduce((s,v)=>s+(v-mean)**2,0)/n)||1;
  return (gih:number)=>{const z=(gih-mean)/sd;return GRADES.find(([,lo])=>z>=lo)![0];};
}
const RARITY_EDGE:Record<string,string>={common:'#4b5563',uncommon:'#9fb3c8',rare:'#d4b04a',mythic:'#e8592f',land:'#6b7280'};
/** Card art at 70% of its brightness: a 30% black layer directly over the image (text stays at full brightness). */
const ART_DIM='linear-gradient(rgba(0,0,0,.3),rgba(0,0,0,.3))';
const f1=(n:number)=>Number.isFinite(n)?n.toFixed(1):'—';

/** Sort keys that the grade table cannot show (it is always ordered by forecast GIH WR): these get a flat grid in the given order. */
const FLAT_SORTS=new Set(['gih_obs','gih_err','alsa','alsa_obs','alsa_err']);
const PINK='#FF5C8A';

export function TierGrid({cards,all,lang,selectedId,onSelect,onOpen,narrowHint,sort}:{cards:Card[];all:Card[];lang:Lang;selectedId?:string;onSelect:(id:string)=>void;onOpen:(id:string)=>void;narrowHint?:boolean;sort?:string}){
  const grade=makeGrader(all),ja=lang==='ja';
  const tile=(card:Card,rank?:number)=>{
    const entry=japaneseCardImage(card),src=entry?.path?import.meta.env.BASE_URL+entry.path.replace(/^\//,''):'',name=cardName(card,lang);
    const alsa=!!sort&&sort.startsWith('alsa'),obs=alsa?(card.observed_seen_n?card.observed_alsa:null):(card.observed_gih_n?card.observed_gih:null);
    const pred=alsa?card.alsa.toFixed(2):f1(card.gih)+'%',obsText=obs==null?'—':alsa?obs.toFixed(2):f1(obs)+'%';
    return <button key={card.id} type="button" title={`${card.name} · GIH WR ${f1(card.gih)}% · ALSA ${card.alsa.toFixed(2)}`}
      onClick={()=>onOpen(card.id)}
      className={'relative flex w-full min-h-11 items-center justify-between gap-1.5 overflow-hidden rounded-sm pl-2.5 pr-1.5 py-1 text-left text-white focus-visible:outline-2 focus-visible:outline-primary '+(selectedId===card.id?'ring-2 ring-primary':'hover:brightness-125')}
      style={{boxShadow:`inset 3px 0 0 ${RARITY_EDGE[card.rarity]||RARITY_EDGE.common}`,backgroundColor:'#1f2430',backgroundImage:`linear-gradient(90deg,rgba(0,0,0,.78) 0%,rgba(0,0,0,.45) 55%,rgba(0,0,0,.25) 100%)${src?`,${ART_DIM},url("${src}")`:''}`,backgroundSize:'100% 100%,100% 100%,130% auto',backgroundPosition:'0 0,0 0,50% 31%',backgroundRepeat:'no-repeat'}}>
      <span className="text-[13px] font-semibold leading-tight underline underline-offset-2 [text-shadow:0_1px_2px_#000] min-w-0 break-words">{rank!=null&&<span className="no-underline inline-block mr-1 text-[11px] font-normal opacity-80 number">{rank}.</span>}{name}</span>
      {rank==null?<span className="shrink-0 text-xs number [text-shadow:0_1px_2px_#000]">{f1(card.gih)}%</span>
        :<span className="shrink-0 text-right text-[11px] leading-tight number [text-shadow:0_1px_2px_#000]"><span className="block">{ja?'予測 ':'Fcst '}{pred}</span><span className="block font-semibold" style={{color:PINK}}>{ja?'実測 ':'Obs '}{obsText}</span></span>}
    </button>;
  };
  if(sort&&FLAT_SORTS.has(sort)){
    if(!cards.length)return <p className="p-8 text-muted-foreground rounded-xl border border-border bg-card">{ja?'該当するカードがありません。検索条件を変更してください。':'No cards match. Try different filters.'}</p>;
    return <section id="cards-table" aria-label={ja?'並び替えの順のカード一覧':'Cards in the selected order'} className="rounded-xl border border-border bg-card p-2">
      <p className="px-1 pb-2 text-xs text-muted-foreground">{ja?'選んだ並び替えの順に、左上から右へ表示しています。A+〜F のランク別の表示は「予測GIH WRの高い順」のときだけです。':'Cards are shown in the selected order, left to right. The A+ to F grade table is used only for "Highest forecast GIH WR".'}</p>
      <div className="grid gap-1" style={{gridTemplateColumns:'repeat(auto-fill,minmax(210px,1fr))'}}>{cards.map((c,i)=>tile(c,i+1))}</div>
    </section>;
  }
  const rows=GRADES.map(([g])=>g).map(g=>({g,cells:Object.fromEntries(COLS.map(c=>[c.key,[] as Card[]])) as Record<ColKey,Card[]>}));
  const byGrade=new Map(rows.map(r=>[r.g,r]));
  for(const c of [...cards].sort((a,b)=>b.gih-a.gih))byGrade.get(grade(c.gih))!.cells[colKey(c)].push(c);
  const shown=rows.filter(r=>COLS.some(c=>r.cells[c.key].length));
  if(!shown.length)return <p className="p-8 text-muted-foreground rounded-xl border border-border bg-card">{ja?'該当するカードがありません。検索条件を変更してください。':'No cards match. Try different filters.'}</p>;
  const grid={gridTemplateColumns:'3.25rem repeat(7,minmax(0,1fr))'};
  return <section id="cards-table" aria-label={ja?'色別・グレード別のカード予測':'Card forecasts by color and grade'} className="rounded-xl border border-border bg-card overflow-x-auto">
    <div className="min-w-[980px]">
      <div className="grid sticky top-0 z-10 bg-card/95 border-b border-border" style={grid}>
        <div/>
        {COLS.map(c=><div key={c.key} className="py-2 text-center text-sm font-medium flex items-center justify-center gap-1.5">
          {c.key!=='M'&&<span aria-hidden style={{width:14,height:14,borderRadius:'50%',display:'inline-block',background:c.key==='C'?'#C9CED6':MANA[c.key]}}/>}
          {c.key==='M'&&<span aria-hidden className="inline-block" style={{width:14,height:14,borderRadius:'50%',background:'conic-gradient('+['W','U','B','R','G'].map((k,i)=>`${MANA[k]} ${i*72}deg ${(i+1)*72}deg`).join(',')+')'}}/>}
          {ja?c.ja:c.en}
        </div>)}
      </div>
      {shown.map(r=><div key={r.g} className="grid border-b border-border last:border-0" style={grid}>
        <div className="flex items-start justify-center pt-3 text-base font-semibold text-primary number">{r.g}</div>
        {COLS.map(c=><div key={c.key} className="p-1 space-y-1 min-w-0">
          {r.cells[c.key].map(card=>tile(card))}
        </div>)}
      </div>)}
    </div>
  </section>;
}
