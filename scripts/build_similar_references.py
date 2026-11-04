#!/usr/bin/env python3
"""Build data/similar-references.json.gz: the 22 past sets' cards used as "similar card" candidates.

Inputs
- dev_feature_22.csv.gz from the data repository (card text/type/stats + 28-day GIH WR from the
  official 17Lands Public Dataset)
- Scryfall: mana cost, colors, rarity, card page link
- 17Lands card data: ALSA over each set's same 28-day window (sets whose public data is long out)

- compact_28d/<SET>_gih_28d.csv (optional 3rd argument): 17Lands 28-day GIH of every card. Cards that have a measurement there
  but are missing from the pool above (Scryfall lists them under another set: bonus sheets, reprint slots) are written to
  "name_only". They are shown in the "same-name cards" slot, and those with label vectors and 3,000+ GIH games are also similar-card candidates.
- Extra past sets (scripts/extra_sets.py; a change there is picked up by this workflow only through this file): 17Lands PremierDraft sets outside the 22 (HBG, ELD, ZNR, ... except OM1/DBL/MAT, Y-sets, cubes, FRA) are measured over the same 28-day
  window (shorter if the set is newer; recorded in stats) and written to "name_only" only. They have no labels and are never similar-card candidates, never in "cards".
- Every card carries its Scryfall oracle_id and the printing it was read from (print_set, collector_number: for `cards` the printing in the 17Lands set, for `name_only` the representative printing Scryfall returned); Japanese names are matched by it (scripts/fetch-japanese-text.mjs), never by name.

Usage: python3 scripts/build_similar_references.py <dev_feature_22.csv.gz> [out] [compact_28d dir]
"""
import csv, datetime, gzip, io, json, os, sys, time, urllib.parse, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extra_sets

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else 'data/similar-references.json.gz'
COMPACT = sys.argv[3] if len(sys.argv) > 3 else None
MIN_GIH_GAMES = 500  # same floor as the pool and the compact_28d manifests
BASIC_LANDS = {'Plains', 'Island', 'Swamp', 'Mountain', 'Forest'}
UA = {'User-Agent': 'Sakiyomi/1.0 (limited forecast research)', 'Accept': 'application/json'}
RARITY = {0: 'common', 1: 'uncommon', 2: 'rare', 3: 'mythic'}
stats, errors = {}, []

def get(url, tries=3, wait=2, timeout=90):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            if i == tries - 1: raise
        except Exception:
            if i == tries - 1: raise
        time.sleep(wait * (i + 1))

csv.field_size_limit(10**7)
rows = list(csv.DictReader(io.TextIOWrapper(gzip.open(SRC), encoding='utf-8')))
sets = sorted({r['set'] for r in rows})

def oracle_of(c):
    """Scryfall oracle_id of a card object (top level; for layouts that only carry it per face, the first face)."""
    return c.get('oracle_id') or next((f.get('oracle_id') for f in c.get('card_faces') or [] if f.get('oracle_id')), None)

def scryfall_set(code):
    out, url = {}, f"https://api.scryfall.com/cards/search?q={urllib.parse.quote(f'e:{code.lower()}')}&unique=cards"
    while url:
        d = get(url)
        if not d: break
        for c in d['data']:
            face = (c.get('card_faces') or [c])[0]
            info = {'id': c['id'], 'oracle_id': oracle_of(c), 'print_set': c.get('set'), 'collector_number': c.get('collector_number'), 'mana_cost': c.get('mana_cost') or face.get('mana_cost', ''),
                    'colors': c.get('colors') if c.get('colors') is not None else face.get('colors', []),
                    'rarity': c.get('rarity'), 'source': c.get('scryfall_uri', '').split('?')[0]}
            for k in (c['name'], c['name'].split(' // ')[0]): out.setdefault(k, info)
        url = d.get('next_page') if d.get('has_more') else None
        time.sleep(0.12)
    return out

def card_info(d):
    face = (d.get('card_faces') or [d])[0]
    return {'id': d['id'], 'oracle_id': oracle_of(d), 'print_set': d.get('set'), 'collector_number': d.get('collector_number'), 'mana_cost': d.get('mana_cost') or face.get('mana_cost', ''), 'colors': d.get('colors') if d.get('colors') is not None else face.get('colors', []),
            'rarity': d.get('rarity'), 'source': d.get('scryfall_uri', '').split('?')[0],
            'cmc': d.get('cmc'), 'type_line': face.get('type_line') or d.get('type_line', ''), 'oracle_text': face.get('oracle_text') or d.get('oracle_text', ''),
            'power': face.get('power') or d.get('power'), 'toughness': face.get('toughness') or d.get('toughness')}

def scryfall_named(name, code, tries=3, timeout=90, wait=2):
    d = get(f"https://api.scryfall.com/cards/named?exact={urllib.parse.quote(name)}", tries=tries, timeout=timeout, wait=wait)
    time.sleep(0.12)
    return card_info(d) if d else None

def scryfall_collection(names, deadline):
    """Batch lookup (POST /cards/collection, 75 names per request). Returns {requested name: info}; names Scryfall does not know are absent."""
    out = {}
    for i in range(0, len(names), 75):
        if time.time() > deadline: errors.append('scryfall collection: deadline reached'); break
        chunk = names[i:i + 75]
        body = json.dumps({'identifiers': [{'name': n} for n in chunk]}).encode()
        for t in range(2):
            try:
                req = urllib.request.Request('https://api.scryfall.com/cards/collection', data=body, headers={**UA, 'Content-Type': 'application/json'})
                with urllib.request.urlopen(req, timeout=30) as r: d = json.load(r)
                for c in d.get('data', []):
                    info = card_info(c)
                    for k in (c['name'], c['name'].split(' // ')[0]): out.setdefault(k, info)
                break
            except Exception as e:
                if t == 1: errors.append(f'scryfall collection batch {i // 75}: {e}'[:200])
                else: time.sleep(3)
        time.sleep(0.2)
    return out

def alsa_17lands(code, start, end):
    q = urllib.parse.urlencode({'expansion': code, 'event_type': 'PremierDraft', 'start_date': start[:10], 'end_date': end[:10]})
    d = get('https://www.17lands.com/api/card_data?' + q)
    time.sleep(1.0)
    rows = d if isinstance(d, list) else (d or {}).get('data', [])
    return {c['name']: (float(c['avg_seen']), int(c.get('seen_count') or 0)) for c in rows if c.get('name') and c.get('avg_seen') is not None}

num = lambda v: '' if v in ('', None) or v != v else (str(int(float(v))) if float(v).is_integer() else str(v))
refs, als, pool_names = [], {}, {}
for code in sets:
    srows = [r for r in rows if r['set'] == code]
    try: sf = scryfall_set(code)
    except Exception as e: sf = {}; errors.append(f'scryfall {code}: {e}')
    start, end = srows[0]['window_start'], srows[0]['window_end']
    try: al = alsa_17lands(code, start, end)
    except Exception as e: al = {}; errors.append(f'17lands {code}: {e}')
    als[code] = al
    pool_names[code] = {n for r in srows for n in (r['name'], r['name'].split(' // ')[0])}
    miss_sf = miss_al = 0
    for r in srows:
        name = r['name']
        info = sf.get(name) or sf.get(name.split(' // ')[0])
        if not info:
            try: info = scryfall_named(name, code)
            except Exception: info = None
            if not info: miss_sf += 1
        a = al.get(name) or al.get(name.split(' // ')[0])
        if not a: miss_al += 1
        colors = (info or {}).get('colors') or [c for c in 'WUBRG' if r.get(f'color_{c}') == '1']
        refs.append({
            'id': (info or {}).get('id', f'{code}:{name}'), 'oracle_id': (info or {}).get('oracle_id'), 'print_set': (info or {}).get('print_set'), 'collector_number': (info or {}).get('collector_number'), 'name': name, 'set': code,
            'rarity': (info or {}).get('rarity') or RARITY.get(int(float(r['rarity_ord'] or 0)), 'common'),
            'colors': colors, 'cmc': float(r['mv'] or 0), 'mana_cost': (info or {}).get('mana_cost', ''),
            'type_line': r['type_line'], 'oracle_text': r['oracle_text'], 'power': num(r['power']), 'toughness': num(r['toughness']),
            'source': (info or {}).get('source') or 'https://scryfall.com/search?q=' + urllib.parse.quote('!"%s" e:%s' % (name, code.lower())),
            'gih': float(r['gih_wr_pct']), 'gih_n': int(float(r['gih_games'])),
            'alsa': a[0] if a else None, 'alsa_n': a[1] if a else 0,
        })
    stats[code] = {'cards': len(srows), 'scryfall_missing': miss_sf, 'alsa_missing': miss_al, 'oracle_id_missing': sum(1 for x in refs if x['set'] == code and not x['oracle_id'])}
    print(code, stats[code], flush=True)

# Cards with a 17Lands measurement that the Scryfall set listing dropped: same-name slot only.
name_only = []
if COMPACT:
    deadline = time.time() + 12 * 60  # whole name_only lookup phase; cards still unresolved afterwards keep the minimal fallback
    pending = []  # (set, row)
    for code in sets:
        path = os.path.join(COMPACT, f'{code}_gih_28d.csv')
        if not os.path.exists(path):
            errors.append(f'compact_28d {code}: file missing'); continue
        seen = set()
        for r in csv.DictReader(open(path, encoding='utf-8')):
            name = r['card_name']
            front = name.split(' // ')[0]
            if front in BASIC_LANDS or name in pool_names[code] or front in pool_names[code] or front in seen: continue
            if int(float(r['gih_games'])) < MIN_GIH_GAMES: continue
            seen.add(front)
            pending.append((code, r))
    names = sorted({r['card_name'] for _, r in pending})
    try: found = scryfall_collection(names, deadline)
    except Exception as e: found = {}; errors.append(f'scryfall collection: {e}'[:200])
    indiv_fail = 0
    for code, r in pending:
        name = r['card_name']; front = name.split(' // ')[0]
        info = found.get(name) or found.get(front)
        if not info and time.time() < deadline and indiv_fail < 10:  # fallback for names the batch did not resolve; stop early if Scryfall does not answer
            try: info = scryfall_named(name, code, tries=2, timeout=20, wait=2)
            except Exception as e: indiv_fail += 1; errors.append(f'scryfall named {code} {name}: {e}'[:200])
        stats[code]['name_only'] = stats[code].get('name_only', 0) + 1
        if not info: stats[code]['name_only_scryfall_missing'] = stats[code].get('name_only_scryfall_missing', 0) + 1
        info = info or {}
        a = als[code].get(name) or als[code].get(front)
        name_only.append({
            'id': info.get('id', f'{code}:{name}'), 'oracle_id': info.get('oracle_id'), 'print_set': info.get('print_set'), 'collector_number': info.get('collector_number'), 'name': name, 'set': code,
            'rarity': info.get('rarity') or 'common',
            'colors': info.get('colors') or [], 'cmc': float(info.get('cmc') or 0), 'mana_cost': info.get('mana_cost', ''),
            'type_line': info.get('type_line', ''), 'oracle_text': info.get('oracle_text', ''), 'power': str(info.get('power') or ''), 'toughness': str(info.get('toughness') or ''),
            'source': info.get('source') or 'https://scryfall.com/search?q=' + urllib.parse.quote('!"%s"' % name),
            'gih': float(r['gih_wr_pct']), 'gih_n': int(float(r['gih_games'])),
            'alsa': a[0] if a else None, 'alsa_n': a[1] if a else 0,
        })
    for code in sets:
        stats[code].setdefault('name_only', 0); stats[code].setdefault('name_only_scryfall_missing', 0)
        stats[code]['name_only_oracle_id_missing'] = sum(1 for x in name_only if x['set'] == code and not x['oracle_id'])
        print(code, 'name_only', stats[code]['name_only'], 'scryfall_missing', stats[code]['name_only_scryfall_missing'], flush=True)

# Extra past sets: same-name slot only (see scripts/extra_sets.py). One failing set never stops the rest.
def _post_collection(body):
    req = urllib.request.Request('https://api.scryfall.com/cards/collection', data=json.dumps(body).encode(), headers={**UA, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)
def _card_data(code, start, end):
    q = urllib.parse.urlencode({'expansion': code, 'event_type': 'PremierDraft', 'start_date': start, 'end_date': end})
    d = get('https://www.17lands.com/api/card_data?' + q); time.sleep(1.0); return d
extra_summary = []
try:
    extra_no, extra_stats, extra_summary = extra_sets.build_extra(get, _card_data, _post_collection, datetime.date.today(), time.time() + 20 * 60, errors)
    name_only += extra_no; stats.update(extra_stats)
    for row in extra_summary: print('extra', row, flush=True)
except Exception as e: errors.append(f'extra sets: {e}'[:200])

missing = sum(1 for x in refs + name_only if not x['oracle_id'])
if missing: errors.append(f'oracle_id missing for {missing} cards (names fall back to English)')
body = {'sets': sets, 'stats': stats, 'errors': errors, 'cards': refs}
if COMPACT or name_only: body['name_only'] = name_only
if extra_summary: body['extra_sets'] = extra_summary
try:
    with gzip.open(OUT, 'rt', encoding='utf-8') as f: prev = json.load(f); prev.pop('built_at', None)
except (FileNotFoundError, ValueError): prev = None
if prev == body:
    print('no changes in', OUT)  # keep the file (and its build time) so reruns don't create empty commits
else:
    with gzip.open(OUT, 'wt', encoding='utf-8') as f:
        json.dump({'built_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), **body}, f, ensure_ascii=False)
    print('wrote', OUT, len(refs), 'cards;', len(name_only), 'name_only; errors:', errors)
