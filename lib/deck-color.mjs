// Fixed, FIN-blind 22-set model for unsplashed two-color Premier Draft decks.
export const deckColorModelVersion='deck-color-b1r-22set-finblind-20260924';
const pairs=['WU','WB','WR','WG','UB','UR','UG','BR','BG','RG'];
const baseline=56.2316667933894,intercept=-0.8713450872574361,coefficient=6.3117762712328265;
const error80=2.8506683361;

export function predictDeckColors(cards){
 const pool=cards.filter(c=>['common','uncommon'].includes(c.rarity)&&Array.isArray(c.colors)&&c.colors.length>0);
 const means=pairs.map(pair=>{
  const eligible=pool.filter(c=>c.colors.every(color=>pair.includes(color)));
  if(!eligible.length||eligible.some(c=>!Number.isFinite(c.pre_release_gih??c.gih)))throw Error(`Deck Color prediction unavailable for ${pair}`);
  return {pair,pair_gih:eligible.reduce((sum,c)=>sum+(c.pre_release_gih??c.gih),0)/eligible.length};
 });
 const allPairMean=means.reduce((sum,row)=>sum+row.pair_gih,0)/means.length;
 const predictions=means.map(({pair,pair_gih})=>{
  const predicted_wr_pct=baseline+intercept+coefficient*(pair_gih-allPairMean);
  return {pair,predicted_wr_pct};
 });
 const two_color_mean=predictions.reduce((sum,row)=>sum+row.predicted_wr_pct,0)/predictions.length;
 const rows=predictions.map(({pair,predicted_wr_pct})=>({pair,predicted_wr_pct,delta_pp:predicted_wr_pct-two_color_mean,range80:[predicted_wr_pct-error80,predicted_wr_pct+error80]}))
   .sort((a,b)=>b.predicted_wr_pct-a.predicted_wr_pct||pairs.indexOf(a.pair)-pairs.indexOf(b.pair))
   .map((row,i)=>({...row,rank:i+1}));
 if(rows.length!==10||rows.some(row=>!Number.isFinite(row.predicted_wr_pct)||row.range80.some(n=>!Number.isFinite(n))))throw Error('Invalid Deck Color predictions');
 return {model_version:deckColorModelVersion,two_color_mean,rows};
}
