// Outcome-free features. Identical implementation for training and live previews.
export const featureNames=['body_efficiency','flying','deathtouch','lifelink','haste','vigilance','trample','ward','draw_effect','removal_effect','token_effect','etb_effect','tapped_land','equipment','aura','mana_fixing','expensive','context_curve','context_creatures','context_removal','context_tribe','context_support'];
export const featureLabels=['マナに対するサイズ','飛行','接死','絆魂','速攻','警戒','トランプル','護法','ドローの記述','除去の記述','トークン生成','戦場に出たときの能力','タップイン土地','装備品','オーラ','マナ供給・色補助','重いマナ域','同色カードとのマナ域差','同色のクリーチャー比率','同色の除去候補比率','同族カードの供給','参照するタイプの供給'];
const text=c=>(c.oracle_text||'').toLowerCase();
const removal=c=>/(destroy|exile) target (creature|permanent)|deals? \w+ damage to (any target|target creature)|target creature gets -/.test(text(c));
const types=c=>(c.type_line.split(' — ')[1]||'').toLowerCase().match(/[a-z]+/g)||[];
const creature=c=>c.type_line.toLowerCase().includes('creature');
const share=(a,b)=>!(a.colors||[]).length||!(b.colors||[]).length||a.colors.some(x=>b.colors.includes(x));
const weight=c=>({common:1,uncommon:.5,rare:.15,mythic:.075}[c.rarity]||.15);
export function extraFeatures(c,pool){const t=text(c),type=c.type_line.toLowerCase(),cost=Number(c.cmc)||0;
 const peers=pool.filter(p=>p.name!==c.name&&p.set===c.set&&share(c,p)&&!p.type_line.includes('Basic Land'));
 const total=peers.reduce((s,p)=>s+weight(p),0),sum=fn=>peers.reduce((s,p)=>s+weight(p)*fn(p),0);
 // Shrink sparse previews with 20 pseudo-card units. This is not actual booster collation.
 const denom=total+20,ownTypes=types(c);
 const mentions=p=>types(p).some(k=>!['equipment','aura','vehicle'].includes(k)&&new RegExp('\\b'+k+'s?\\b').test(t));
 const context=[(cost-(sum(p=>Number(p.cmc)||0)+60)/denom)/5,(sum(p=>+creature(p))+10)/denom,(sum(p=>+removal(p))+3)/denom,sum(p=>+(creature(p)&&types(p).some(k=>ownTypes.includes(k))))/denom,sum(p=>+mentions(p))/denom];
 return [(creature(c)?((Number(c.power)||0)+(Number(c.toughness)||0))/Math.max(cost,1)/4:0),...['flying','deathtouch','lifelink','haste','vigilance','trample','ward'].map(k=>+new RegExp('\\b'+k+'\\b').test(t)),+/draw (a|two|three|x|that many) cards?/.test(t),+removal(c),+/create .*token/.test(t),+/when .*enters/.test(t),+(type.includes('land')&&/enters.*tapped/.test(t)),+type.includes('equipment'),+type.includes('aura'),+/add \{|any color|search your library for .*land/.test(t),Math.max(0,cost-4)/5,...context];
}
