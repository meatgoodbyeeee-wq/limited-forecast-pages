"""python3 -m unittest scripts/test_extra_sets.py -- offline checks with mocked 17Lands / Scryfall answers."""
import datetime as dt, os, sys, time, unittest
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import extra_sets as ex

TODAY = dt.date(2026, 11, 4)
FILTERS = {'expansions': ['FRA', 'HBG', 'ELD', 'MOM', 'FIN', 'CORE', 'PIO', 'TLA', 'Y23ONE', 'OM1', 'DBL', 'MAT', 'Cube', 'ZNR'],
           'start_dates': {'HBG': '2022-07-07', 'ELD': '2019-10-03T00:00:00Z', 'FIN': '2025-06-10', 'TLA': '2026-10-20', 'ZNR': '2020-09-17'}}
def sset(code, name, rel, typ='expansion'): return {'code': code, 'name': name, 'released_at': rel, 'set_type': typ}
SCRY = [sset('hbg', "Alchemy Horizons: Baldur's Gate", '2022-07-07', 'alchemy'), sset('eld', 'Throne of Eldraine', '2019-10-04'), sset('fin', 'Final Fantasy', '2025-06-13'),
        sset('core', 'Something Else', '2021-01-01'), sset('pio', 'Pioneer Masters', '2025-01-01', 'masters'), sset('tla', 'Avatar: The Last Airbender', '2026-11-21'),
        sset('zna', 'Zendikar Rising Art', '2020-09-17', 'memorabilia'), sset('mom', 'March of the Machine', '2023-04-21')]

def row(name, n=1000, wr=0.55, seen=3.5, sc=2000):
    return {'name': name, 'ever_drawn_game_count': n, 'ever_drawn_win_rate': wr, 'avg_seen': seen, 'seen_count': sc}

CARDS = {  # (name lowercase, set) -> scryfall card
    ('prosper, tome-bound', 'hbg'): {'id': 'p1', 'oracle_id': 'O-PROSPER', 'name': 'Prosper, Tome-Bound', 'set': 'hbg', 'collector_number': '1', 'mana_cost': '{2}{B}{R}', 'colors': ['B', 'R'], 'rarity': 'mythic', 'scryfall_uri': 'https://scryfall.com/card/hbg/1/x?utm=1', 'cmc': 4, 'type_line': 'Legendary Creature', 'oracle_text': 'text', 'power': '3', 'toughness': '3'},
    ('kenrith, the returned king', 'eld'): {'id': 'k1', 'oracle_id': 'O-KEN', 'name': 'Kenrith, the Returned King', 'set': 'eld', 'collector_number': '303', 'mana_cost': '{4}{W}', 'colors': ['W'], 'rarity': 'mythic', 'scryfall_uri': 'https://scryfall.com/card/eld/303/k', 'cmc': 5, 'type_line': 'Legendary Creature', 'oracle_text': 'k'},
    ('bonecrusher giant', 'eld'): {'id': 'b1', 'oracle_id': 'O-BONE', 'name': 'Bonecrusher Giant // Stomp', 'set': 'eld', 'collector_number': '115', 'rarity': 'rare', 'scryfall_uri': 'https://scryfall.com/card/eld/115/b', 'cmc': 3,
                                  'card_faces': [{'name': 'Bonecrusher Giant', 'type_line': 'Creature', 'oracle_text': 'giant', 'mana_cost': '{2}{R}', 'power': '4', 'toughness': '3'}, {'name': 'Stomp', 'type_line': 'Instant', 'oracle_text': 's'}], 'colors': None},
    ('connive', 'hbg'): {'id': 's1', 'oracle_id': 'O-SPLIT', 'name': 'Connive // Concoct', 'set': 'hbg', 'collector_number': '5', 'rarity': 'uncommon', 'scryfall_uri': 'https://scryfall.com/card/hbg/5/s', 'cmc': 2, 'colors': ['B', 'U']},
    ('alchemy thing', 'hbg'): {'id': 'a1', 'oracle_id': 'O-A', 'name': 'A-Alchemy Thing', 'set': 'hbg', 'collector_number': '9', 'rarity': 'rare', 'scryfall_uri': 'https://scryfall.com/card/hbg/9/a', 'cmc': 1},
    ('a-alchemy thing', 'hbg'): {'id': 'a1', 'oracle_id': 'O-A', 'name': 'A-Alchemy Thing', 'set': 'hbg', 'collector_number': '9', 'rarity': 'rare', 'scryfall_uri': 'https://scryfall.com/card/hbg/9/a', 'cmc': 1},
    ('avatar card', 'tla'): {'id': 't1', 'oracle_id': 'O-T', 'name': 'Avatar Card', 'set': 'tla', 'collector_number': '1', 'rarity': 'common', 'scryfall_uri': 'https://scryfall.com/card/tla/1/t', 'cmc': 1},
    ('bonus card', None): {'id': 'x1', 'oracle_id': 'O-X', 'name': 'Bonus Card', 'set': 'sta', 'collector_number': '3', 'rarity': 'rare', 'scryfall_uri': 'https://scryfall.com/card/sta/3/x', 'cmc': 2},
}
for k in list(CARDS): CARDS[k].setdefault('card_faces', None)
POOLS = {
    'HBG': [row('Prosper, Tome-Bound', 4000, 0.60), row('A-Alchemy Thing', 900), row('Plains', 9000), row('Tiny', 499), row('Bonus Card', 600), row('Ghost', 700), row('Connive // Concoct', 800)],
    'ELD': [row('Kenrith, the Returned King', 5000, 0.62), row('Bonecrusher Giant // Stomp', 8000, 0.65), row('Swamp', 9000), {'name': 'NoWR', 'ever_drawn_game_count': 900, 'ever_drawn_win_rate': None}],
    'FIN': [row('Nope', 900)], 'TLA': [row('Avatar Card', 900)],
}

def make_post(log):
    def post(body):
        log.append(body)
        data = []
        for i in body['identifiers']:
            k = (i['name'].lower(), i.get('set'))
            c = CARDS.get(k)  # exact names only: the full "A // B" of a split card is not found, its front name is
            if c and (i.get('set') is None or c['set'] == i['set']): data.append(c)
        return {'data': data}
    return post

def fetch_json(url):
    if url.endswith('/filters'): return FILTERS
    if url.endswith('/sets'): return {'data': SCRY}
    raise AssertionError(url)

class T(unittest.TestCase):
    def test_plan(self):
        plan = {p['code']: p for p in ex.plan_sets(FILTERS, SCRY, TODAY)}
        self.assertEqual(plan['HBG']['status'], 'ok'); self.assertEqual(plan['HBG']['window_start'], '2022-07-07'); self.assertEqual(plan['HBG']['window_end'], '2022-08-04'); self.assertTrue(plan['HBG']['window_complete'])
        self.assertEqual(plan['ELD']['window_start'], '2019-10-03')                        # from 17Lands start_dates
        self.assertEqual(plan['ZNR']['status'], 'no Scryfall set with this code')          # zna is another code; never guessed
        self.assertIn('does not match', plan['CORE']['status'])                            # ambiguous code, wrong Scryfall set
        self.assertEqual(plan['PIO']['status'], 'ok')
        self.assertEqual(plan['PIO']['start_source'], 'scryfall released_at')              # no 17Lands start date -> Scryfall released_at
        self.assertEqual(plan['TLA']['window_days'], 15); self.assertFalse(plan['TLA']['window_complete'])  # newer than 28 days: until today
        self.assertEqual(plan['KTK']['status'], 'not in 17Lands expansions')
        for excluded in ('OM1', 'DBL', 'MAT', 'FRA', 'Y23ONE', 'Cube', 'RAVM'): self.assertNotIn(excluded, plan)

    def test_filters(self):
        rows = ex.measured_cards(POOLS['HBG'])
        self.assertEqual([r['name'] for r in rows], ['Prosper, Tome-Bound', 'A-Alchemy Thing', 'Bonus Card', 'Ghost', 'Connive // Concoct'])  # no basics, 500+ games
        self.assertAlmostEqual(rows[0]['gih'], 60.0); self.assertEqual(rows[0]['gih_n'], 4000); self.assertEqual(rows[0]['alsa'], 3.5); self.assertEqual(rows[0]['alsa_n'], 2000)
        self.assertEqual([r['name'] for r in ex.measured_cards(POOLS['ELD'])], ['Kenrith, the Returned King', 'Bonecrusher Giant // Stomp'])

    def run_all(self, pools=POOLS):
        log, errors = [], []
        def cards(code, s, e):
            self.assertRegex(s, r'^\d{4}-\d\d-\d\d$'); return pools.get(code)
        out, stats, summary = ex.build_extra(fetch_json, cards, make_post(log), TODAY, time.time() + 600, errors)
        return out, stats, summary, errors

    def test_build(self):
        out, stats, summary, errors = self.run_all()
        by = {(c['set'], c['name']): c for c in out}
        p = by[('HBG', 'Prosper, Tome-Bound')]
        self.assertEqual((p['oracle_id'], p['print_set'], p['rarity'], p['gih_n']), ('O-PROSPER', 'hbg', 'mythic', 4000))
        self.assertEqual(p['source'], 'https://scryfall.com/card/hbg/1/x')
        self.assertEqual(by[('ELD', 'Kenrith, the Returned King')]['oracle_id'], 'O-KEN')
        b = by[('ELD', 'Bonecrusher Giant // Stomp')]
        self.assertEqual((b['type_line'], b['colors'], b['mana_cost'], b['oracle_id']), ('Creature', [], '{2}{R}', 'O-BONE'))
        self.assertIn(('HBG', 'A-Alchemy Thing'), by)                                    # printed name kept
        self.assertEqual(by[('HBG', 'Bonus Card')]['print_set'], 'sta')                  # not in the set: found by name
        g = by[('HBG', 'Ghost')]; self.assertIsNone(g['oracle_id']); self.assertEqual(g['rarity'], 'common')
        self.assertEqual(by[('HBG', 'Connive // Concoct')]['oracle_id'], 'O-SPLIT'); self.assertEqual(by[('HBG', 'Connive // Concoct')]['name'], 'Connive // Concoct')
        self.assertEqual(stats['HBG']['name_only'], 5); self.assertEqual(stats['HBG']['scryfall_in_set'], 3); self.assertEqual(stats['HBG']['scryfall_by_name'], 1)
        self.assertEqual(stats['HBG']['name_only_scryfall_missing'], 1); self.assertEqual(stats['HBG']['alchemy_a_prefix'], 1)
        self.assertTrue(all(s['extra'] for s in stats.values()))
        self.assertEqual(stats['TLA']['window_days'], 15); self.assertFalse(stats['TLA']['window_complete'])
        self.assertTrue(all(c['set'] not in ('MOM', 'FRA') for c in out))
        status = {r['code']: r['status'] for r in summary}
        self.assertEqual(status['HBG'], 'ok'); self.assertEqual(status['ZNR'], 'no Scryfall set with this code'); self.assertTrue(status['FIN'].startswith('failed'))  # FIN: nothing found in Scryfall -> not added
        self.assertEqual([c for c in out if c['set'] == 'FIN'], [])
        self.assertTrue(any('extra ZNR' in e for e in errors)); self.assertTrue(any('extra FIN' in e for e in errors))

    def test_one_set_failure_does_not_stop_others(self):
        errors = []
        def cards(code, s, e):
            if code == 'HBG': raise RuntimeError('boom')
            return POOLS.get(code)
        out, stats, summary, = ex.build_extra(fetch_json, cards, make_post([]), TODAY, time.time() + 600, errors)[0:3]
        self.assertNotIn('HBG', stats); self.assertIn('ELD', stats)
        self.assertTrue(any('extra HBG: boom' in e for e in errors))

    def test_deadline(self):
        errors = []
        out, stats, summary = ex.build_extra(fetch_json, lambda *a: POOLS.get(a[0]), make_post([]), TODAY, time.time() - 1, errors)
        self.assertEqual(out, []); self.assertTrue(any('deadline' in e for e in errors))

    def test_filters_unavailable(self):
        errors = []
        def fj(url):
            if url.endswith('/filters'): raise RuntimeError('403')
            return fetch_json(url)
        _, stats, _ = ex.build_extra(fj, lambda c, s, e: POOLS.get(c), make_post([]), TODAY, time.time() + 600, errors)
        self.assertIn('HBG', stats)       # falls back to Scryfall released_at
        self.assertTrue(any('filters' in e for e in errors))

if __name__ == '__main__': unittest.main()
