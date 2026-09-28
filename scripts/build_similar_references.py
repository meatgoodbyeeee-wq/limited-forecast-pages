#!/usr/bin/env python3
"""Build data/similar-references.json.gz: the 22 past sets' cards used as "similar card" candidates.

Inputs
- dev_feature_22.csv.gz from the data repository (card text/type/stats + 28-day GIH WR from the
  official 17Lands Public Dataset)
- Scryfall: mana cost, colors, rarity, card page link
- 17Lands card data: ALSA over each set's same 28-day window (sets whose public data is long out)

Usage: python3 scripts/build_similar_references.py <dev_feature_22.csv.gz> [out]
"""
import csv, gzip, io, json, sys, time, urllib.parse, urllib.request

SRC = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else 'data/similar-references.json.gz'
UA = {'User-Agent': 'Sakiyomi/1.0 (limited forecast research)', 'Accept': 'application/json'}
RARITY = {0: 'common', 1: 'uncommon', 2: 'rare', 3: 'mythic'}
stats, errors = {}, []

def get(url, tries=3):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=90) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code == 404: return None
            if i == tries - 1: raise
        except Exception:
            if i == tries - 1: raise
        time.sleep(2 * (i + 1))

csv.field_size_limit(10**7)
rows = list(csv.DictReader(io.TextIOWrapper(gzip.open(SRC), encoding='utf-8')))
sets = sorted({r['set'] for r in rows})

def scryfall_set(code):
    out, url = {}, f"https://api.scryfall.com/cards/search?q={urllib.parse.quote(f'e:{code.lower()}')}&unique=cards"
    while url:
        d = get(url)
        if not d: break
        for c in d['data']:
            face = (c.get('card_faces') or [c])[0]
            info = {'id': c['id'], 'mana_cost': c.get('mana_cost') or face.get('mana_cost', ''),
                    'colors': c.get('colors') if c.get('colors') is not None else face.get('colors', []),
                    'rarity': c.get('rarity'), 'source': c.get('scryfall_uri', '').split('?')[0]}
            for k in (c['name'], c['name'].split(' // ')[0]): out.setdefault(k, info)
        url = d.get('next_page') if d.get('has_more') else None
        time.sleep(0.12)
    return out

def scryfall_named(name, code):
    d = get(f"https://api.scryfall.com/cards/named?exact={urllib.parse.quote(name)}")
    time.sleep(0.12)
    if not d: return None
    face = (d.get('card_faces') or [d])[0]
    return {'id': d['id'], 'mana_cost': d.get('mana_cost') or face.get('mana_cost', ''), 'colors': d.get('colors') if d.get('colors') is not None else face.get('colors', []),
            'rarity': d.get('rarity'), 'source': d.get('scryfall_uri', '').split('?')[0]}

def alsa_17lands(code, start, end):
    q = urllib.parse.urlencode({'expansion': code, 'event_type': 'PremierDraft', 'start_date': start[:10], 'end_date': end[:10]})
    d = get('https://www.17lands.com/api/card_data?' + q)
    time.sleep(1.0)
    rows = d if isinstance(d, list) else (d or {}).get('data', [])
    return {c['name']: (float(c['avg_seen']), int(c.get('seen_count') or 0)) for c in rows if c.get('name') and c.get('avg_seen') is not None}

num = lambda v: '' if v in ('', None) or v != v else (str(int(float(v))) if float(v).is_integer() else str(v))
refs = []
for code in sets:
    srows = [r for r in rows if r['set'] == code]
    try: sf = scryfall_set(code)
    except Exception as e: sf = {}; errors.append(f'scryfall {code}: {e}')
    start, end = srows[0]['window_start'], srows[0]['window_end']
    try: al = alsa_17lands(code, start, end)
    except Exception as e: al = {}; errors.append(f'17lands {code}: {e}')
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
            'id': (info or {}).get('id', f'{code}:{name}'), 'name': name, 'set': code,
            'rarity': (info or {}).get('rarity') or RARITY.get(int(float(r['rarity_ord'] or 0)), 'common'),
            'colors': colors, 'cmc': float(r['mv'] or 0), 'mana_cost': (info or {}).get('mana_cost', ''),
            'type_line': r['type_line'], 'oracle_text': r['oracle_text'], 'power': num(r['power']), 'toughness': num(r['toughness']),
            'source': (info or {}).get('source') or 'https://scryfall.com/search?q=' + urllib.parse.quote('!"%s" e:%s' % (name, code.lower())),
            'gih': float(r['gih_wr_pct']), 'gih_n': int(float(r['gih_games'])),
            'alsa': a[0] if a else None, 'alsa_n': a[1] if a else 0,
        })
    stats[code] = {'cards': len(srows), 'scryfall_missing': miss_sf, 'alsa_missing': miss_al}
    print(code, stats[code], flush=True)

with gzip.open(OUT, 'wt', encoding='utf-8') as f:
    json.dump({'built_at': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'sets': sets, 'stats': stats, 'errors': errors, 'cards': refs}, f, ensure_ascii=False)
print('wrote', OUT, len(refs), 'cards; errors:', errors)
