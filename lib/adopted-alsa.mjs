import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';

// Trained on the 22 FIN-blind development sets; contains no FIN observations.
const model=JSON.parse(gunzipSync(fs.readFileSync(new URL('../data/adopted-alsa-fra.json.gz',import.meta.url))));
if(model.fin_used!==false||model.model.loss!=='squared_error'||model.model.max_iter!==250||model.model.learning_rate!==0.06||model.model.l2_regularization!==2)throw Error('Unexpected ALSA model');

const types=['Creature','Instant','Sorcery','Artifact','Enchantment','Planeswalker','Land'];
const keywords=['flying','first strike','double strike','deathtouch','haste','hexproof','lifelink','menace','reach','trample','vigilance','ward','draw','discard','destroy','exile','counter','token','sacrifice','return','graveyard','search','damage','gain','surveil','scry','mill'];
const rarities={common:0,uncommon:1,rare:2,mythic:3};
const test=(text,pattern)=>+pattern.test(text);
const numeric=value=>value===null||value===undefined||value===''?NaN:Number(value);

function cardFeatures(c){
 const text=c.oracle_text||'',type=c.type_line||'',mana=c.mana_cost||'',colors=c.colors||[];
 const tl=text.toLowerCase(),tt=type.toLowerCase(),mv=Number(c.cmc)||0,power=numeric(c.power),toughness=numeric(c.toughness);
 const x={mv,rarity_ord:rarities[c.rarity]??-1,n_colors:colors.length,mana_symbols:(mana.match(/\{/g)||[]).length,
  oracle_len:text.length,oracle_lines:(text.match(/\n/g)||[]).length+Number(!!text),power,toughness};
 for(const t of types)x['type_'+t.toLowerCase()]=+tt.includes(t.toLowerCase());
 for(const k of keywords)x['kw_'+k.replaceAll(' ','_')]=+tl.includes(k);
 for(const color of 'WUBRG')x['color_'+color]=+colors.includes(color);
 const denom=Math.max(mv,1);
 x.is_multicolor=+(colors.length>1);x.is_colorless=+(colors.length===0);x.has_x_cost=+mana.toUpperCase().includes('{X}');
 x.is_aura=+tt.includes('aura');x.is_equipment=+tt.includes('equipment');x.is_vehicle=+tt.includes('vehicle');
 x.has_etb=+(tl.includes('enters')||tl.includes('enter the battlefield'));x.has_eot=+tl.includes('until end of turn');
 x.targets_creature=+tl.includes('target creature');x.keyword_count=keywords.reduce((n,k)=>n+x['kw_'+k.replaceAll(' ','_')],0);
 x.ability_sentences=(text.match(/\./g)||[]).length+(text.match(/;/g)||[]).length;
 const removalDestroy=test(tl,/destroy target/),removalExile=test(tl,/exile target/);
 const damageRemoval=test(tl,/deals? [^.]*(damage) to (any target|target creature|target permanent)/);
 const bounce=test(tl,/return target .* to (its|their) owner.?s hand/);
 x.interaction=+(!!(removalDestroy||removalExile||damageRemoval||bounce));
 x.interaction_per_mv=x.interaction/denom;x.cheap_interaction=+(!!x.interaction&&mv<=3);
 const conditionals=['if ','unless ','only ','with power ','with toughness ','mana value ','that was dealt','attacking','blocking','tapped'];
 x.interaction_condition_count=x.interaction?conditionals.reduce((n,k)=>n+Number(tl.includes(k)),0):0;
 x.clean_interaction=+(!!x.interaction&&x.interaction_condition_count===0);
 x.card_advantage=+(test(tl,/draw (two|three|x|that many) cards/)||(tl.includes('create')&&tl.includes('token')&&x.has_etb));
 x.card_advantage_per_mv=x.card_advantage/denom;
 x.evasion=+['flying','menace',"can't be blocked",'cannot be blocked'].some(k=>tl.includes(k));
 x.evasion_power_efficiency=x.evasion*power/denom;
 x.power_per_mv=power/denom;x.toughness_per_mv=toughness/denom;x.stats_per_mv=(power+toughness)/denom;
 x.semantic_cast_trigger=test(tl,/when you cast|whenever you cast/);
 x.semantic_flexible_target=test(tl,/any target|target (creature or planeswalker|permanent|nonland permanent)/);
 x.semantic_tribal_dependency=test(tl,/creature type|shares? a creature type/);
 x.quality_immediate_removal=test(tl,/when .* enters.*(destroy|exile|deals? .* damage)|enters.*(destroy|exile|deals? .* damage)/);
 x.quality_etb_card_value=test(tl,/when .* enters.*draw .* card|enters.*draw .* card/);
 x.quality_self_contained_value=test(tl,/enters.*(draw|create|destroy|exile|return target|deals? .* damage)|when .* enters.*(draw|create|destroy|exile|return target|deals? .* damage)/);
 x.quality_repeatable_card_value=test(tl,/whenever .* draw|whenever .* create .* token|at the beginning of .* draw|at the beginning of .* create .* token/);
 x.quality_broad_removal=test(tl,/destroy target (creature|permanent)|exile target (creature|permanent)|deals? .* damage to any target|any target/);
 x.is_supplemental_power_set=0;x.is_premier_set=1;
 return x;
}

function features(card){
 const x=cardFeatures(card),text=(card.oracle_text||'').toLowerCase(),type=(card.type_line||'').toLowerCase();
 for(const r of model.rarity_columns)x[r]=r==='rarity_unknown'?1:+(r==='rarity_'+card.rarity);
 // Same expressions and column order as the adopted FIN-blind training script.
 x.alsa_sem_removal=test(text,/destroy target|exile target|target creature gets -/);
 x.alsa_sem_draw=test(text,/draw (a|one|two|three|\\d+) cards?/);
 x.alsa_sem_evasion=+(test(text,/flying|menace|trample|can't be blocked/)||type.includes('vehicle'));
 x.alsa_sem_sweeper=test(text,/all creatures|each creature|all other creatures/);
 x.alsa_sem_dependency=test(text,/if you control|for each|as long as|another .* you control|cards? in your graveyard/);
 x.alsa_sem_narrow=test(text,/artifact or enchantment|nonbasic land|creature with flying|from a graveyard/);
 x.alsa_sem_creature=+type.includes('creature');
 for(const name of Object.keys(x).filter(k=>k.startsWith('alsa_sem_'))){
  for(const r of model.rarity_columns)x[`${name}_x_${r}`]=x[name]*x[r];
 }
 x.alsa_pair_removal_draw=x.alsa_sem_removal*x.alsa_sem_draw;
 x.alsa_sem_mana_fix=test(text,/add one mana of any color|search your library for (a|up to one|one) basic land|basic land card/);
 return model.feature_names.map((name,i)=>Number.isFinite(x[name])?x[name]:model.medians[i]);
}

export function predictAdoptedAlsa(card){
 const x=features(card);let value=model.baseline;
 for(const tree of model.trees){let idx=0;while(!tree[idx][5]){const n=tree[idx],v=x[n[0]];idx=Number.isNaN(v)?(n[6]?n[2]:n[3]):v<=n[1]?n[2]:n[3];}value+=tree[idx][4];}
 return Math.max(value,model.floor);
}

export function applyAdoptedAlsa(cards){return cards.map(card=>{
 const value=predictAdoptedAlsa(card),radius=(card.alsa_range?.[1]-card.alsa_range?.[0])/2||1;
 if(!Number.isFinite(value)||value<=1)throw Error(`Invalid ALSA for ${card.name}`);
 return {...card,alsa:value,alsa_range:[Math.max(model.floor,value-radius),Math.min(15,value+radius)],alsa_model_version:model.version,
  alsa_explanation:{summary:'',base:value,card:0,text:0,context:0,clipping:0,terms:[]},alsa_reason:[]};
 });}

export const adoptedAlsaVersion=model.version;
