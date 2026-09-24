import fs from 'node:fs';
import {collectOfficial} from '../lib/official.mjs';
import {mergeOfficial,signature} from '../lib/refresh.mjs';
import {draftPool} from '../lib/draft-pool.mjs';
import {predictCards} from '../lib/predict.mjs';
import {applyAdoptedGih,adoptedGihVersion} from '../lib/adopted-gih.mjs';
import {applyAdoptedAlsa,adoptedAlsaVersion} from '../lib/adopted-alsa.mjs';
import {predictDeckColors} from '../lib/deck-color.mjs';
import {liveForecast} from '../lib/live.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`,import.meta.url)));
const current=JSON.parse(fs.readFileSync(new URL('../public/forecast.json',import.meta.url)));
const original=read('target'),incumbent=read('model');
let incoming;
try { incoming=await collectOfficial(); }
catch (error) { console.warn('公式カード情報の確認に失敗。既存の予測を保持:',error.message); process.exit(0); }
// Rebuild from the existing model only if published draft cards actually changed.
const merged=mergeOfficial(original,incoming),pool=draftPool(merged.cards);
const before=new Map(original.cards.map(c=>[c.name,c]));
const changed=pool.length!==original.cards.length||pool.some(c=>signature(c)!==signature(before.get(c.name)||{}));
if(!changed){current.forecast.checked_at=new Date().toISOString();fs.writeFileSync(new URL('../public/forecast.json',import.meta.url),JSON.stringify(current));console.log(`公式確認済み：${pool.length}枚、予測は維持`);process.exit(0);}
const predicted=applyAdoptedAlsa(applyAdoptedGih(predictCards(pool,incumbent)));
if(!predicted.length||predicted.some(c=>!Number.isFinite(c.gih)||!Number.isFinite(c.alsa)))throw Error('予測値の検証に失敗');
const policy=read('live-policy').policies.current;
const forecast=liveForecast({...merged,phase:'PREVIEW',cards:predicted,deck_color:predictDeckColors(predicted),model_version:`${incumbent.version} + ${adoptedGihVersion} + ${adoptedAlsaVersion}`,checked_at:new Date().toISOString()},null,policy);
fs.writeFileSync(new URL('../public/forecast.json',import.meta.url),JSON.stringify({...current,forecast}));
console.log(`予測更新：${forecast.cards.length}枚`);
