import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {density, PARK_DAY, STREET_DAY} from '../src/world-people.js';
import {boatsOut, PEAK_BOATS, AVERAGE_DAY} from '../src/xuanwu-boats.js';
import {CALM} from '../src/world-traffic.js';

test('Xuanwu Lake walkers: 52,000 visits a day of 2 hours over the day curve, spread over the park paths, drawn calmer', () => {
  const km = 18.9, perKm = density('footway', 1, 16.5, km);
  const people = 52000 * 2 / PARK_DAY.reduce((a, b) => a + b, 0) / km * CALM.bike;
  assert.ok(Math.abs(perKm - people) < 1e-6);
  assert.ok(perKm > 150 && perKm < 220, `${perKm.toFixed(0)} a km at 16:30`);
  assert.equal(density('footway', 1, 3, km), 0, 'the park empty at 3 am');
  assert.ok(density('pedestrian', 0, 18.5, 0) === 3 * density('footway', 0, 18.5, 0), 'pedestrian streets three times the footways');
  assert.equal(Math.max(...STREET_DAY), 1);
});

test('Boats: none outside 9:00-17:00; at noon the average day\'s share of the 600, drawn calmer', () => {
  assert.equal(boatsOut(8), 0);
  assert.equal(boatsOut(17.5), 0);
  assert.equal(boatsOut(12), Math.round(PEAK_BOATS * AVERAGE_DAY * CALM.bike));
  assert.ok(boatsOut(9.25) < boatsOut(12), 'ramping up after opening');
});

test('The walkers\' file: footways, pedestrian streets, paths and steps; Xuanwu\'s park paths marked', () => {
  const data = JSON.parse(fs.readFileSync('public/scenes/core/paths.json', 'utf8'));
  assert.deepEqual(data.kinds, ['footway', 'pedestrian', 'path', 'steps']);
  assert.ok(data.ways.length > 2000 && data.ways.filter(w => w[1]).length > 100);
  for (const [k, park, flat] of data.ways) assert.ok(k >= 0 && k < 4 && (park === 0 || park === 1) && flat.length >= 4 && flat.every(Number.isFinite));
});
