"""Extra past sets for the "same-name cards" slot only (display; never model, evaluation, labels or similar-card candidates).

17Lands PremierDraft sets that are not among the 22 reference sets are measured over the same 28-day window and written to
`name_only` of data/similar-references.json.gz. They have no AI labels, so extraIndex() in lib/predict.mjs never offers them as
similar cards; the 22-set `cards` list and everything evaluated from it are unchanged.

Included: every ordinary 17Lands draft set that is not excluded below. Excluded on purpose: OM1, DBL, MAT (requested), the forecast
set FRA (and Y26FRA), the annual Arena-only Y-sets (Y22SNC, Y23ONE, ... Y26SOS), cubes / Chaos / Remix, RAVM and "Ravnica".
A 17Lands code is added only when it is a real Scryfall set (checked in `plan_sets`) and 17Lands' cards are found in it
(`MIN_SET_HIT_RATE`); anything else is reported in `extra_sets` (status) and `errors`, never guessed.
"""
import datetime as dt
import re
import time
import urllib.parse

# Listed oldest to newest only for readability; the order that matters is SET_ORDER in lib/predict.mjs.
EXTRA_CODES = ['KTK', 'XLN', 'RIX', 'DOM', 'M19', 'GRN', 'RNA', 'WAR', 'M20', 'ELD', 'THB', 'IKO', 'M21', 'AKR', 'ZNR', 'KLR', 'CORE',
               'HBG', 'SIR', 'PIO', 'FIN', 'EOE', 'TLA', 'ECL', 'TMT', 'SOS', 'MSH', 'HOB']
# Codes that are ambiguous as Scryfall set codes: the Scryfall set name must match, otherwise the set is held back (reported, not added).
NAME_HINT = {'CORE': r'core', 'PIO': r'pioneer'}
# Scryfall set types of real draft products (Arena Alchemy sets such as HBG are "alchemy").
OK_SET_TYPES = {'core', 'expansion', 'masters', 'draft_innovation', 'alchemy', 'remaster'}
BASIC_LANDS = {'Plains', 'Island', 'Swamp', 'Mountain', 'Forest'}
MIN_GIH_GAMES = 500
WINDOW_DAYS = 28
MIN_SET_HIT_RATE = 0.5  # share of a set's cards found in the Scryfall set of the same code; below it the code is not that set
RARITY_OK = {'common', 'uncommon', 'rare', 'mythic', 'special', 'bonus'}

front_of = lambda n: str(n).split(' // ')[0]
# Arena Alchemy rebalanced cards are named "A-Name"; the same-name slot treats "A-Name" as "Name" (display keeps the printed name).
unalchemy = lambda n: re.sub(r'^A-', '', n)


def parse_date(v):
    if not v: return None
    try: return dt.date.fromisoformat(str(v)[:10])
    except ValueError: return None


def plan_sets(filters, scry_sets, today, codes=EXTRA_CODES):
    """Decide per 17Lands code: Scryfall set, 28-day window. Returns a list of dicts with status 'ok' or a reason (held back)."""
    expansions = {e for e in ((filters or {}).get('expansions') or []) if isinstance(e, str)}
    starts = (filters or {}).get('start_dates') or {}
    by_code = {s['code'].upper(): s for s in scry_sets or []}
    plan = []
    for code in codes:
        p = {'code': code, 'status': 'ok'}
        plan.append(p)
        if expansions and code not in expansions: p['status'] = 'not in 17Lands expansions'; continue
        s = by_code.get(code)  # 17Lands code == Scryfall set code
        if not s: p['status'] = 'no Scryfall set with this code'; continue
        p.update(scryfall_set=s['code'].lower(), scryfall_name=s.get('name'), released_at=s.get('released_at'))
        if s.get('set_type') not in OK_SET_TYPES: p['status'] = f"Scryfall set type {s.get('set_type')}"; continue
        if code in NAME_HINT and not re.search(NAME_HINT[code], s.get('name') or '', re.I):
            p['status'] = f"Scryfall set name '{s.get('name')}' does not match the expected set"; continue
        start = parse_date(starts.get(code)) or parse_date(s.get('released_at'))
        p['start_source'] = '17lands start_dates' if parse_date(starts.get(code)) else 'scryfall released_at'
        if not start: p['status'] = 'no start date'; continue
        end = min(start + dt.timedelta(days=WINDOW_DAYS), today)
        if end <= start: p['status'] = 'window not started yet'; continue
        p.update(window_start=start.isoformat(), window_end=end.isoformat(), window_days=(end - start).days, window_complete=(end - start).days >= WINDOW_DAYS)
    return plan


def card_rows(payload):
    return payload if isinstance(payload, list) else (payload or {}).get('data', [])


def measured_cards(rows, min_games=MIN_GIH_GAMES):
    """17Lands card_data rows -> [{name, gih (%), gih_n, alsa, alsa_n}], 500+ GIH games, no basic lands, one per front name."""
    out, seen = [], set()
    for c in rows:
        name = c.get('name')
        if not name or front_of(name) in BASIC_LANDS or front_of(name) in seen: continue
        n, wr = c.get('ever_drawn_game_count'), c.get('ever_drawn_win_rate')
        if n is None or wr is None or int(n) < min_games: continue
        wr = float(wr)
        seen.add(front_of(name))
        seen_avg = c.get('avg_seen')
        out.append({'name': name, 'gih': wr * 100 if wr <= 1.5 else wr, 'gih_n': int(n),
                    'alsa': float(seen_avg) if seen_avg is not None else None, 'alsa_n': int(c.get('seen_count') or 0) if seen_avg is not None else 0})
    return out


def oracle_of(c):
    return c.get('oracle_id') or next((f.get('oracle_id') for f in c.get('card_faces') or [] if f.get('oracle_id')), None)


def card_info(d):
    face = (d.get('card_faces') or [d])[0]
    return {'id': d['id'], 'oracle_id': oracle_of(d), 'print_set': d.get('set'), 'collector_number': d.get('collector_number'), 'mana_cost': d.get('mana_cost') or face.get('mana_cost', ''),
            'colors': d.get('colors') if d.get('colors') is not None else face.get('colors', []), 'rarity': d.get('rarity'), 'source': d.get('scryfall_uri', '').split('?')[0],
            'cmc': d.get('cmc'), 'type_line': face.get('type_line') or d.get('type_line', ''), 'oracle_text': face.get('oracle_text') or d.get('oracle_text', ''),
            'power': face.get('power') or d.get('power'), 'toughness': face.get('toughness') or d.get('toughness')}


def lookup(identifiers, post, deadline, errors, label):
    """Batches of 75 identifiers ({'name'} or {'name','set'}) through `post(body) -> Scryfall list`. Returns {(lowercase name, set or None): info}.
    A card is registered under its full name and its front name; with a set in the identifier the key carries the set."""
    out = {}
    for i in range(0, len(identifiers), 75):
        if time.time() > deadline: errors.append(f'{label}: scryfall deadline reached'); break
        chunk = identifiers[i:i + 75]
        for t in range(2):
            try:
                for c in post({'identifiers': chunk}).get('data', []):
                    info = card_info(c)
                    for n in {c['name'], front_of(c['name'])}:
                        out.setdefault((n.lower(), c.get('set')), info)
                        out.setdefault((n.lower(), None), info)
                break
            except Exception as e:
                if t == 1: errors.append(f'{label} scryfall batch {i // 75}: {e}'[:200])
                else: time.sleep(3)
        time.sleep(0.2)
    return out


def build_set(p, fetch_cards, post, deadline, errors):
    """One planned set -> (name_only entries, stats). Raises on failure (the caller records it and goes on with the next set)."""
    code, scry = p['code'], p['scryfall_set']
    rows = measured_cards(card_rows(fetch_cards(code, p['window_start'], p['window_end'])))
    if not rows: raise RuntimeError('17Lands returned no card with 500+ GIH games')
    # 1) the printing in the set itself (A- names: as 17Lands writes them first, then without the prefix); 2) by name only for the rest
    ids = [{'name': r['name'], 'set': scry} for r in rows] + [{'name': unalchemy(r['name']), 'set': scry} for r in rows if r['name'].startswith('A-')]
    in_set = lookup(ids, post, deadline, f'extra {code}', errors)
    hit = lambda r: in_set.get((r['name'].lower(), scry)) or in_set.get((front_of(r['name']).lower(), scry)) or in_set.get((unalchemy(r['name']).lower(), scry))
    n_hit = sum(1 for r in rows if hit(r))
    if n_hit < MIN_SET_HIT_RATE * len(rows): raise RuntimeError(f'only {n_hit}/{len(rows)} cards found in Scryfall set {scry}; not added')
    rest = [r for r in rows if not hit(r)]
    rest_names = sorted({n for r in rest for n in {r['name'], unalchemy(r['name'])}})
    by_name = lookup([{'name': n} for n in rest_names], post, deadline, f'extra {code}', errors) if rest else {}
    out, fallback, missing = [], 0, 0
    for r in rows:
        info = hit(r)
        if not info:
            info = by_name.get((r['name'].lower(), None)) or by_name.get((front_of(r['name']).lower(), None)) or by_name.get((unalchemy(r['name']).lower(), None))
            fallback += bool(info)
        if not info: missing += 1
        info = info or {}
        out.append({
            'id': info.get('id', f'{code}:{r["name"]}'), 'oracle_id': info.get('oracle_id'), 'print_set': info.get('print_set'), 'collector_number': info.get('collector_number'), 'name': r['name'], 'set': code,
            'rarity': info.get('rarity') if info.get('rarity') in RARITY_OK else 'common',
            'colors': info.get('colors') or [], 'cmc': float(info.get('cmc') or 0), 'mana_cost': info.get('mana_cost', ''),
            'type_line': info.get('type_line', ''), 'oracle_text': info.get('oracle_text', ''), 'power': str(info.get('power') or ''), 'toughness': str(info.get('toughness') or ''),
            'source': info.get('source') or 'https://scryfall.com/search?q=' + urllib.parse.quote('!"%s"' % r['name']),
            'gih': r['gih'], 'gih_n': r['gih_n'], 'alsa': r['alsa'], 'alsa_n': r['alsa_n'],
        })
    stats = {'extra': True, 'scryfall_set': scry, 'released_at': p.get('released_at'), 'window_start': p['window_start'], 'window_end': p['window_end'], 'window_days': p['window_days'],
             'window_complete': p['window_complete'], 'start_source': p['start_source'], 'name_only': len(out), 'scryfall_in_set': n_hit, 'scryfall_by_name': fallback,
             'name_only_scryfall_missing': missing, 'name_only_oracle_id_missing': sum(1 for x in out if not x['oracle_id']),
             'alchemy_a_prefix': sum(1 for x in out if x['name'].startswith('A-'))}
    return out, stats


def build_extra(fetch_json, fetch_cards, post, today, deadline, errors):
    """All extra sets. fetch_json(url) for 17Lands filters / Scryfall sets; fetch_cards(code, start, end) for 17Lands card_data;
    post(body) for Scryfall /cards/collection. A failing set is recorded and skipped. Returns (name_only, stats by code, extra_sets summary)."""
    try: filters = fetch_json('https://www.17lands.com/data/filters')
    except Exception as e: filters = {}; errors.append(f'extra: 17lands filters: {e}'[:200])
    try: scry_sets = (fetch_json('https://api.scryfall.com/sets') or {}).get('data', [])
    except Exception as e: scry_sets = []; errors.append(f'extra: scryfall sets: {e}'[:200])
    plan = plan_sets(filters, scry_sets, today)
    name_only, stats, summary = [], {}, []
    for p in plan:
        row = {k: p.get(k) for k in ('code', 'scryfall_set', 'scryfall_name', 'released_at', 'status')}
        if p['status'] != 'ok':
            errors.append(f"extra {p['code']}: held back ({p['status']})")
        elif time.time() > deadline:
            row['status'] = 'deadline'; errors.append(f"extra {p['code']}: not fetched (deadline)")
        else:
            try:
                out, st = build_set(p, fetch_cards, post, deadline, errors)
                name_only += out; stats[p['code']] = st
                row.update(cards=len(out), window_start=p['window_start'], window_end=p['window_end'], window_days=p['window_days'])
            except Exception as e:
                row['status'] = f'failed: {e}'[:200]; errors.append(f"extra {p['code']}: {e}"[:220])
        summary.append(row)
    return name_only, stats, summary
