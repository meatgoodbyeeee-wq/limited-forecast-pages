// node scripts/write-deviation-notes.mjs — GitHub Actions only (needs ANTHROPIC_API_KEY).
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {run, MODEL} from '../lib/deviation-notes.mjs';

const read = p => { try { return JSON.parse(p.endsWith('.gz') ? gunzipSync(fs.readFileSync(p)).toString() : fs.readFileSync(p, 'utf8')); } catch { return null; } };
const NOTES = 'public/deviation-notes.json';
const model = process.env.NOTES_MODEL || MODEL;
const apiKey = process.env.ANTHROPIC_API_KEY || '';
async function callModel(prompt) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {method: 'POST', signal: AbortSignal.timeout(90000),
    headers: {'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01'},
    body: JSON.stringify({model, max_tokens: 900, messages: [{role: 'user', content: prompt}]})});
  if (!r.ok) throw new Error(`API HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const d = await r.json();
  return (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}
const forecast = read('public/forecast.json.gz')?.forecast;
const {notes, written} = await run({forecastCards: forecast?.cards || [], snapshot: read('public/data/fra-actual-card-data.json'), notes: read(NOTES),
  io: {now: new Date(), apiKey, model, callModel, log: m => console.log(m)}});
if (written) { fs.writeFileSync(NOTES, JSON.stringify(notes, null, 2) + '\n'); console.log(`wrote ${written} note(s)`); }
