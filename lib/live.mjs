export const weight=(n,k)=>{if(!(k>0&&Number.isFinite(k)))throw new Error('検証済みの更新係数がありません。');return n>0?n/(n+k):0;};
export function validateObservations(data,previous=null,now=Date.now()){
 if(data.set!=='FRA'||data.format!=='PremierDraft'||data.queue!=='BO1'||data.source_kind!=='17lands-public-datasets')throw new Error('FRA / Premier Draft BO1 の公開データのみ取り込めます。');
 if(data.window_start!=='2026-09-29'||data.window_end_exclusive!=='2026-10-27')throw new Error('発売後28日間の集計条件が一致しません。');
 if(!Number.isFinite(Date.parse(data.as_of))||Date.parse(data.as_of)>now+60000||previous&&Date.parse(data.as_of)<Date.parse(previous.as_of))throw new Error('実測の取得日時が不正、または前回より古いデータです。');
 if(!Array.isArray(data.cards)||data.cards.length>2000)throw new Error('カード件数が不正です。');const names=new Set();let total=0;
 for(const c of data.cards){if(typeof c.name!=='string'||!c.name||names.has(c.name))throw new Error('カード名が空、または重複しています。');names.add(c.name);for(const t of ['gih','alsa']){const n=c[t+'_n']??0,v=c[t];if(!Number.isSafeInteger(n)||n<0||n>1e10)throw new Error('観測件数が不正です。');if(n>0&&(!Number.isFinite(v)||v<(t==='gih'?0:1)||v>(t==='gih'?100:15)))throw new Error('実測値が範囲外です。');total+=n;}}
 if(previous){const next=new Map(data.cards.map(c=>[c.name,c]));for(const c of previous.cards)for(const t of ['gih','alsa'])if((c[t+'_n']||0)>(next.get(c.name)?.[t+'_n']||0))throw new Error('観測件数が減少したため、前回の実測を保持します。');}
 for(const [kind,source] of Object.entries(data.sources||{})){const expected=`https://17lands-public.s3.amazonaws.com/analysis_data/${kind}_data/${kind}_data_public.FRA.PremierDraft.csv.gz`;if(!['game','draft'].includes(kind)||source.url!==expected)throw new Error('対応する公開データの出典が必要です。');}
 for(const [metric,kind] of [['gih','game'],['alsa','draft']])if(data.cards.some(c=>c[metric+'_n']>0)&&!data.sources?.[kind])throw new Error('実測指標に対応する出典がありません。');
 if(total>0&&!Object.keys(data.sources||{}).length)throw new Error('実測の出典がありません。');return total>0;
}
export function liveForecast(pre,observations,policy){
 if(!observations)return {...pre,phase:'PREVIEW',cards:pre.cards.map(c=>({...c,phase:'PREVIEW',pre_release_gih:c.gih,pre_release_alsa:c.alsa}))};
 const lookup=new Map(observations.cards.map(c=>[c.name,c]));const obs=c=>lookup.get(c.name)||lookup.get(c.name.split(' // ')[0]);let total=0,weightedDelta=0;
 for(const c of pre.cards){const o=obs(c);if(o?.gih_n>0){total+=o.gih_n;weightedDelta+=o.gih_n*(o.gih-c.gih);}}
 const delta=weightedDelta/(total+policy.K_set),wset=weight(total,policy.K_set);const cards=pre.cards.map(c=>{const o=obs(c)||{},wg=weight(o.gih_n||0,policy.K_GIH),wa=weight(o.alsa_n||0,policy.K_ALSA),adjusted=c.gih+delta,lg=(1-wg)*adjusted+wg*(o.gih??adjusted),la=(1-wa)*c.alsa+wa*(o.alsa??c.alsa);return {...c,phase:wg>=policy.gih_dominant_threshold&&wa>=policy.alsa_dominant_threshold?'OBSERVED_DOMINANT':(wg>0||wa>0||wset>0?'EARLY_DATA':'PREVIEW'),pre_release_gih:c.gih,pre_release_alsa:c.alsa,gih:lg,alsa:la,live_gih:lg,live_alsa:la,observed_gih:o.gih??null,observed_gih_n:o.gih_n||0,observed_alsa:o.alsa??null,observed_seen_n:o.alsa_n||0,gih_observation_weight:wg,alsa_observation_weight:wa,set_bias_adjustment:delta,card_bias_adjustment:lg-adjusted,source_timestamp:observations.as_of,gih_error:o.gih==null?null:o.gih-c.gih,alsa_error:o.alsa==null?null:o.alsa-c.alsa};});
 const median=xs=>{const v=xs.sort((a,b)=>a-b);return v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2;};const exists=cards.some(c=>c.observed_gih_n>0||c.observed_seen_n>0);const dominant=median(cards.map(c=>c.gih_observation_weight))>=policy.gih_dominant_threshold&&median(cards.map(c=>c.alsa_observation_weight))>=policy.alsa_dominant_threshold;
 return {...pre,phase:!exists?'PREVIEW':dominant?'OBSERVED_DOMINANT':'EARLY_DATA',cards,source_timestamp:observations.as_of,set_bias_adjustment:delta,set_observation_weight:wset,live_policy_version:policy.model_version};
}
