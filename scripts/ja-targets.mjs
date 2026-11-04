// Which same-name-only references need a Japanese name: the extra sets (not among the 22 reference sets) hold ~10,000 cards,
// but only those whose front-face name is a card of a forecast set (FRA, TRK, ...) can show up in a "same-name cards" slot.
// The 22 reference sets keep the full lookup (any of them can be a similar card).
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';

// Same key as sameNameCards() in lib/predict.mjs: front-face name, Alchemy "A-" prefix ignored, case-insensitive.
export const sameKey = n => String(n || '').replace(/^A-/, '').split(' // ')[0].trim().toLowerCase();

// Card names of every forecast set: public/forecast.json.gz (FRA), data/target.json.gz and data/<set>/target.json.gz.
export function targetFronts(root, forecastCards = []) {
  const names = new Set(forecastCards.map(c => sameKey(c.name)));
  const files = [new URL('data/target.json.gz', root)];
  const dataDir = new URL('data/', root);
  if (fs.existsSync(dataDir)) for (const d of fs.readdirSync(dataDir, {withFileTypes: true})) if (d.isDirectory()) files.push(new URL(`data/${d.name}/target.json.gz`, root));
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    try { for (const c of JSON.parse(gunzipSync(fs.readFileSync(f))).cards || []) names.add(sameKey(c.name)); } catch { /* unreadable target: skip */ }
  }
  names.delete('');
  return names;
}

// refDoc: data/similar-references.json.gz. Returns {refs, skipped}: every `cards` entry, every name_only entry of the 22 reference sets,
// and the name_only entries of the other (extra) sets whose name is in `fronts`.
export function lookupRefs(refDoc, fronts) {
  const core = new Set(refDoc.sets || []), refs = [], skipped = {};
  for (const c of refDoc.cards || []) refs.push(c);
  for (const c of refDoc.name_only || []) {
    if (core.has(c.set) || fronts.has(sameKey(c.name))) refs.push(c);
    else skipped[c.set] = (skipped[c.set] || 0) + 1;
  }
  return {refs, skipped};
}
