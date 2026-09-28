// Lists cards whose observed 17Lands value left the pre-release prediction range,
// with the material needed to write "why it deviated" notes in public/deviation-notes.json.
//
// Usage: node scripts/deviation-report.mjs <forecast.json[.gz]> <fra-public-game.json> [notes.json] > report.md
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';

const MIN_N = {gih: 1000, alsa: 1000}; // keep in sync with components/forecast-range.tsx
const read = p => JSON.parse(p.endsWith('.gz') ? gunzipSync(fs.readFileSync(p)).toString() : fs.readFileSync(p, 'utf8'));
const [forecastPath, livePath, notesPath = 'public/deviation-notes.json'] = process.argv.slice(2);
if (!forecastPath || !livePath) { console.error('usage: node scripts/deviation-report.mjs <forecast.json[.gz]> <fra-public-game.json> [notes.json]'); process.exit(1); }

const forecast = read(forecastPath).forecast;
const live = read(livePath);
const obsCards = live.observations?.cards || [];
const notes = fs.existsSync(notesPath) ? read(notesPath).cards || {} : {};
const lookup = new Map(obsCards.map(c => [c.name, c]));
const obsOf = c => lookup.get(c.name) || lookup.get(c.name.split(' // ')[0]);
const f = (n, d = 2) => Number.isFinite(n) ? n.toFixed(d) : '—';

const rows = [];
for (const c of forecast.cards) {
  if (c.late_card) continue;
  const o = obsOf(c); if (!o) continue;
  for (const t of ['gih']) { // reasons are written for GIH WR only
    const obs = o[t], n = o[t + '_n'] || 0, range = c[t + '_range'], pred = c[t];
    if (obs == null || !(n >= MIN_N[t])) continue;
    const gap = obs > range[1] ? obs - range[1] : obs < range[0] ? obs - range[0] : 0;
    if (gap) rows.push({c, t, obs, n, range, pred, gap, noted: !!notes[c.name]?.[t]?.reasons?.length});
  }
}
rows.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));

const out = [];
out.push(`# 予測の幅から外れたカード（${forecast.set || 'FRA'}）`, '');
out.push(`実測の基準日時: ${live.observations?.as_of || '—'} / 判定に必要な最小件数: GIH ${MIN_N.gih}, ALSA ${MIN_N.alsa}`, '');
out.push(`該当 ${rows.length}件（うち理由掲載済み ${rows.filter(r => r.noted).length}件）`, '');
out.push('| カード | 指標 | 発売前予測 | 予測の幅 | 実測 | 件数 | 幅からのずれ | 理由 |', '|---|---|---:|---:|---:|---:|---:|---|');
for (const r of rows) out.push(`| ${r.c.name} | ${r.t.toUpperCase()} | ${f(r.pred)} | ${f(r.range[0])}–${f(r.range[1])} | ${f(r.obs)} | ${r.n.toLocaleString()} | ${r.gap > 0 ? '+' : ''}${f(r.gap)} | ${r.noted ? '掲載済み' : '未'} |`);
out.push('');
for (const r of rows.filter(r => !r.noted)) {
  const c = r.c, e = c[r.t + '_explanation'];
  out.push(`## ${c.name}（${r.t === 'gih' ? 'GIH WR' : 'ALSA'}）`, '');
  out.push(`- ${c.mana_cost || '土地'} · ${c.type_line} · ${c.rarity}${c.power ? ` · ${c.power}/${c.toughness}` : ''}`);
  out.push(`- 発売前予測 ${f(r.pred)} / 予測の幅 ${f(r.range[0])}–${f(r.range[1])} / 実測 ${f(r.obs)}（${r.n.toLocaleString()}件）`);
  out.push('', '```', (c.oracle_text || '').replace(/\r/g, ''), '```', '');
  if (e) {
    out.push(`モデルの内訳: 基準値 ${f(e.base)} / カード特徴 ${f(e.card)} / 語句 ${f(e.text)} / 公開カード構成 ${f(e.context)} / 補正 ${f(e.clipping)}`, '');
    const terms = [...(e.terms || [])].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 8);
    if (terms.length) out.push('主な特徴: ' + terms.map(x => `${x.label} ${x.value >= 0 ? '+' : ''}${f(x.value)}`).join(' / '), '');
  }
  if (c.similar?.length) out.push('過去の類似カード: ' + c.similar.map(s => `${s.name}（${s.set}、GIH ${f(s.gih, 1)}%、ALSA ${f(s.alsa)}）`).join(' / '), '');
}
console.log(out.join('\n'));
