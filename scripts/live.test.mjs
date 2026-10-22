// Regression: observed data must never replace the pre-release forecast in the headline values (README "主表示は常に発売前予測").
import test from 'node:test';
import assert from 'node:assert/strict';
import {forecastWithObservations} from '../lib/live.mjs';

const policy = {K_GIH: 100, K_ALSA: 1, K_set: 1e8, gih_dominant_threshold: 0.8, alsa_dominant_threshold: 0.8};
const pre = {phase: 'PREVIEW', cards: [
  {name: 'A', gih: 56.5, alsa: 3.2, gih_range: [52, 61], alsa_range: [1, 5]},
  {name: 'B', gih: 54.3, alsa: 3.0, gih_range: [50, 58], alsa_range: [1, 5]},
]};
const obs = {as_of: '2026-10-19T21:35:36Z', cards: [{name: 'A', gih: 63.0, gih_n: 9000, alsa: null, alsa_n: 0}, {name: 'B', gih: 49.0, gih_n: 70, alsa: null, alsa_n: 0}]};

test('headline GIH WR / ALSA stay the pre-release forecast even with heavy observed data', () => {
  const f = forecastWithObservations(pre, obs, policy);
  assert.equal(f.phase, 'PREVIEW');
  for (const [c, p] of f.cards.map((c, i) => [c, pre.cards[i]])) {
    assert.equal(c.phase, 'PREVIEW');
    assert.equal(c.gih, p.gih);
    assert.equal(c.alsa, p.alsa);
    assert.deepEqual(c.gih_range, p.gih_range);
  }
});

test('observed values are still attached for their own columns', () => {
  const [a, b] = forecastWithObservations(pre, obs, policy).cards;
  assert.equal(a.observed_gih, 63.0); assert.equal(a.observed_gih_n, 9000);
  assert.equal(b.observed_gih, 49.0);
  assert.equal(a.observed_alsa, null);
  assert.ok(Math.abs(a.gih_error - 6.5) < 1e-9);
});
