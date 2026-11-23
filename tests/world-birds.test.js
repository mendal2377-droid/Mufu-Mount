import test from 'node:test';
import assert from 'node:assert/strict';
import {PER_HA, LAND, MEAN_GROUP, landDensity, WATER, seasonShare, flockSize} from '../src/world-birds.js';

test('Land birds: the Beijing winter survey gives about 22 a hectare of green at the busy hours', () => {
  // 137 land birds an hour along a 50 m strip walked at 1 to 1.5 km an hour.
  assert.ok(Math.abs(PER_HA - 21.9) < .1, `${PER_HA}`);
  assert.equal(landDensity(8), PER_HA);
  assert.equal(landDensity(23), 0);
  assert.ok(landDensity(13) < PER_HA * .7, 'fewer about at midday');
});

test('Land birds: the species shares add up, and the mean group is what the cells are filled with', () => {
  assert.ok(Math.abs(LAND.reduce((a, s) => a + s[1], 0) - 1) < 1e-9);
  // Groups picked by share / size, each its size: birds come out at the shares.
  const w = LAND.map(s => s[1] / s[2]), W = w.reduce((a, b) => a + b, 0);
  const mean = LAND.reduce((a, s, i) => a + w[i] / W * s[2], 0);
  assert.ok(Math.abs(mean - MEAN_GROUP) < 1e-9);
  LAND.forEach((s, i) => assert.ok(Math.abs(w[i] / W * s[2] / mean - s[1]) < 1e-9, s[0]));
});

test('Xuanwu Lake: the winter flocks at their reported sizes, gone in summer, the herons there all year', () => {
  const by = Object.fromEntries(WATER.map(f => [f[0], f]));
  assert.equal(seasonShare(3), 1);
  assert.equal(seasonShare(1), 0);
  assert.ok(seasonShare(2) > 0 && seasonShare(2) < 1 && seasonShare(0) > 0 && seasonShare(0) < 1);
  assert.equal(flockSize(by.mandarin, 3, 10), 150);
  assert.equal(flockSize(by.mandarin, 1, 10), 0);
  assert.equal(flockSize(by.cormorant, 3, 10), 35);
  assert.equal(flockSize(by.heron, 3, 10), 100);
  assert.equal(flockSize(by.heron, 1, 10), 30);
  assert.equal(flockSize(by.coot, 3, 17), 300, 'coots double at dusk');
  assert.equal(flockSize(by.coot, 3, 10), 150);
});
