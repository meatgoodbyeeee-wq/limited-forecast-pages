import {extraFeatures,featureNames,featureLabels} from './features.mjs';
export function numeric(c){const n=v=>Number.isFinite(Number(v))?Number(v):0,t=(c.type_line||'').toLowerCase(),colors=c.colors||[];return [Math.min(n(c.cmc),20)/5,Math.min(n(c.power),20)/5,Math.min(n(c.toughness),20)/5,colors.length/2,((c.mana_cost||'').match(/\{[^}]*[WUBRG][^}]*\}/g)||[]).length/3,...['creature','instant','sorcery','land','artifact','enchantment','planeswalker','legendary'].map(k=>+t.includes(k)),...[...'WUBRG'].map(k=>+colors.includes(k)),...['common','uncommon','rare','mythic'].map(k=>+(c.rarity===k)),Math.min((c.oracle_text||'').length,1500)/300];}
export function vector(c,m,pool=[]){const text=((c.oracle_text||'').split(c.name).join('CARD')+' '+(c.type_line||'')).toLowerCase(),counts={};for(const word of text.match(/\b[a-z][a-z]+\b/g)||[]){const id=m.vocabulary[word];if(id!==undefined)counts[id]=(counts[id]||0)+1;}let norm=0;for(const id in counts){counts[id]*=m.idf[id];norm+=counts[id]**2;}norm=Math.sqrt(norm)||1;const x=[...numeric(c),...(m.enhanced?extraFeatures(c,pool):[])].map((v,i)=>[i,v]);for(const id in counts)x.push([Number(id)+m.numeric_features.length,counts[id]/norm]);return x;}
function dot(a,b){const map=new Map(b);return a.reduce((s,[i,v])=>s+v*(map.get(i)||0),0);}function norm(a){return Math.sqrt(a.reduce((s,[,v])=>s+v*v,0))||1;}
const labels={cmc:'マナ総量',power:'パワー',toughness:'タフネス',color_count:'色数',pips:'色マナ記号数',is_creature:'クリーチャー',is_instant:'インスタント',is_sorcery:'ソーサリー',is_land:'土地',is_artifact:'アーティファクト',is_enchantment:'エンチャント',is_planeswalker:'プレインズウォーカー',is_legendary:'伝説',text_length:'テキスト長',common:'コモン',uncommon:'アンコモン',rare:'レア',mythic:'神話レア'};
Object.assign(labels,Object.fromEntries(featureNames.map((k,i)=>[k,featureLabels[i]])));
/** Past-set candidates for "similar cards": vectors are built once per reference list. */
export function similarityIndex(reference,refModel){return reference.map(c=>{const v=vector(c,refModel,reference);return {c,v,n:norm(v)};});}
export function similarCards(c,refs,refModel,pool,k=3){const v=vector(c,refModel,pool),n=norm(v);return refs.map(r=>({c:r.c,similarity:dot(v,r.v)/(n*r.n)})).sort((a,b)=>b.similarity-a.similarity).slice(0,k).map(r=>({...r.c,similarity:r.similarity}));}
/** Label-aware similar cards (research/similar_cards in the data repository: PLAN.md, eval2_results.csv).
 *  score = cosine of the production vector + LABEL_WEIGHT x cosine of the AI-label vectors; candidates must be the same class
 *  (land / creature / other) within 2 mana value when at least k such candidates exist. Cards or references without a label vector keep the old ranking. */
export const LABEL_WEIGHT=0.5;
const cardClass=t=>/\bLand\b/.test(t||'')?0:/\bCreature\b/.test(t||'')?1:2;
export function similarCardsLabelled(c,refs,refModel,pool,labels,k=3){
 const lv=labels?.cards?.[`${c.set}|${c.id}`];if(!lv)return similarCards(c,refs,refModel,pool,k);
 const v=vector(c,refModel,pool),n=norm(v),map=new Map(v),cls=cardClass(c.type_line),mv=Number(c.cmc)||0,scale=(labels.scale||1000)**2,rows=[];
 for(const r of refs){const rl=labels.refs[`${r.c.set}|${r.c.name}`];if(!rl)continue;let d=0;for(const [i,x] of r.v){const y=map.get(i);if(y)d+=x*y;}let l=0;for(let i=0;i<lv.length;i++)l+=lv[i]*rl[i];
  rows.push({c:r.c,score:d/(n*r.n)+LABEL_WEIGHT*l/scale,ok:cardClass(r.c.type_line)===cls&&Math.abs((Number(r.c.cmc)||0)-mv)<=2});}
 let pick=rows.filter(r=>r.ok);if(pick.length<k)pick=rows;
 return pick.sort((a,b)=>b.score-a.score).slice(0,k).map(r=>({...r.c,similarity:r.score/(1+LABEL_WEIGHT)}));
}
export function predictCards(cards,bundle,pool=cards){const reference=bundle.references.gih,refModel=bundle.models.gih;const refs=similarityIndex(reference,refModel);const inverse={};for(const t of ['gih','alsa'])inverse[t]=Object.fromEntries(Object.entries(bundle.models[t].vocabulary).map(([k,v])=>[Number(v)+bundle.models[t].numeric_features.length,k]));
 return cards.map(c=>{const result={...c,model_version:bundle.version};for(const t of ['gih','alsa']){const m=bundle.models[t],v=vector(c,m,pool);const raw=m.kind==='rarity-baseline'?m.rarity_means[c.rarity]:m.intercept+v.reduce((s,[i,x])=>s+x*m.coef[i],0);const lower=t==='gih'?0:1,upper=t==='gih'?100:15;const value=Math.max(lower,Math.min(upper,raw));result[t]=value;result[t+'_range']=[Math.max(lower,value-m.interval_radius),Math.min(upper,value+m.interval_radius)];result[t+'_explanation']=explain(c,m,v,t,value,raw,inverse[t]);result[t+'_reason']=m.kind==='rarity-baseline'?[{label:'過去セットの同レアリティ平均',value}]:v.map(([i,x])=>({label:i<m.numeric_features.length?(labels[m.numeric_features[i]]||m.numeric_features[i]):'語句: '+inverse[t][i],value:x*m.coef[i]})).filter(x=>Math.abs(x.value)>.02).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value)).slice(0,5);}
 result.similar=bundle.similar_labels?similarCardsLabelled(c,refs,refModel,pool,bundle.similar_labels):similarCards(c,refs,refModel,pool);result.note='公開カードの構成に応じて再計算。タイプ供給は近似であり、新能力のルール相互作用・特殊パック構成は未検証。';return result;});}

function explain(c,m,v,t,value,raw,inverse){
 const unit=t==='gih'?'pt':'手',metric=t==='gih'?'GIH WR':'ALSA';
 if(m.kind==='rarity-baseline')return {summary:'学習セットの同レアリティ平均を使用しています。',base:value,card:0,text:0,context:0,clipping:0,terms:[]};
 const parts={base:m.intercept,card:0,text:0,context:0,clipping:value-raw};
 const terms=v.map(([i,x])=>{const name=m.numeric_features[i],group=i>=m.numeric_features.length?'text':name.startsWith('context_')?'context':'card',effect=x*m.coef[i];parts[group]+=effect;return {label:labels[name]||name||'語句: '+inverse[i],value:effect,group};});
 const ordered=terms.filter(x=>Math.abs(x.value)>.02).sort((a,b)=>Math.abs(b.value)-Math.abs(a.value));
 const positive=ordered.filter(x=>x.value>0).slice(0,2),negative=ordered.filter(x=>x.value<0).slice(0,2);
 const fmt=xs=>xs.map(x=>`${x.label}（${x.value>=0?'+':''}${x.value.toFixed(2)}${unit}）`).join('、');
 const summary=`${metric} ${value.toFixed(2)}${t==='gih'?'%':'手'}。`+(positive.length?`数値を押し上げる主な要因は${fmt(positive)}。`:'')+(negative.length?`押し下げる主な要因は${fmt(negative)}。`:'')+(t==='alsa'?'ALSAが低いほど早い手順でパックからなくなる予測です。':'');
 return {...parts,summary,terms:ordered.slice(0,8)};
}
