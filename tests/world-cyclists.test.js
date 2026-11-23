import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {density, FLOW, KINDS, RIDE_DAY} from '../src/world-cyclists.js';
import {CALM} from '../src/world-traffic.js';

test('Riders a kilometre: the counted flow over the riders\' speeds, at the calmer setting', () => {
  // 234 an hour past a point; 60 % at 22 km/h, 40 % at 12 km/h: about 14 a kilometre at the busiest hour.
  const perKm = FLOW * (KINDS.sport.share / KINDS.sport.kmh + KINDS.city.share / KINDS.city.kmh);
  assert.ok(Math.abs(perKm - 14.2) < .1, `${perKm}`);
  assert.ok(Math.abs(density(16.5) - perKm * CALM.bike) < 1e-9);
  assert.equal(Math.max(...RIDE_DAY), RIDE_DAY[16]);
  assert.ok(density(3.5) === 0);
  assert.ok(Math.abs(KINDS.sport.share + KINDS.city.share - 1) < 1e-9);
});

test('The leisure cycleways keep out of Xuanwu Lake\'s park, where bicycles are banned', () => {
  const paths = JSON.parse(readFileSync(new URL('../public/scenes/core/paths.json', import.meta.url), 'utf-8'));
  assert.ok(paths.rides.length >= 10);
  // The park's box as tools/street-ways.py and src/xuanwu-life.js have it (x east, north).
  const LAKE = [-260, 1700, 2560, 4620];
  for (const flat of paths.rides) for (let i = 0; i < flat.length; i += 2) {
    const x = flat[i], n = -flat[i + 1];
    assert.ok(!(x > LAKE[0] && x < LAKE[1] && n > LAKE[2] && n < LAKE[3]), `a ride inside the park at ${x}, ${n}`);
  }
});
