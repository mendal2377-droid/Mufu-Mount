import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CLASSES, PEAK, PROFILE, flowShare, flow, speed, spacing} from '../src/world-traffic.js';

test('The day: the morning peak at 8:30 is the busiest hour, the night the quietest; the peak hour is 7-9 % of the day', () => {
  const max = Math.max(...PROFILE.map((_, h) => flowShare(h + .5)));
  assert.equal(PROFILE[8], 1);
  assert.equal(flowShare(8.5), max, 'the morning peak leads');
  assert.ok(flowShare(17.5) < 1 && flowShare(17.5) >= .85, 'the evening peak is lighter');
  assert.ok(flowShare(3.5) < .07);
  const share = 1 / PROFILE.reduce((a, b) => a + b, 0);
  assert.ok(share > .07 && share < .09, `peak hour ${(share * 100).toFixed(1)} % of the day (tunnel: 7.5 %)`);
});

test('Flows by class follow the counts: the avenues 2,130 an hour a direction at the peak, links half', () => {
  assert.equal(flow('primary', 8.5), 2130);
  assert.equal(flow('primary_link', 8.5), 1065);
  assert.equal(flow('trunk', 8.5), PEAK.trunk);
  assert.ok(flow('residential', 3) < 10);
  assert.ok(speed('primary', 8.5) === 20 && speed('primary', 3) > 38, 'slow at the peak, free at night');
});

test('Spacing: an avenue lane at the peak every 25-35 m; at 3 am hundreds of metres; no e-bikes on trunks', () => {
  const peak = spacing('primary', 8.5, 3);
  assert.ok(peak > 25 && peak < 35, `${peak} m`);
  assert.ok(spacing('primary', 3, 3) > 300);
  assert.equal(spacing('trunk', 8, 3, true), Infinity);
  assert.ok(spacing('residential', 8, 1, true) < spacing('residential', 8, 1), 'three e-bikes to a car on side streets');
});

test('The street file: drivable surface ways only, in the classes the traffic knows', () => {
  const data = JSON.parse(fs.readFileSync('public/scenes/core/streets.json', 'utf8'));
  assert.deepEqual(data.classes, CLASSES);
  assert.ok(data.ways.length > 2000);
  for (const [cls, oneway, lanes, flat] of data.ways) {
    assert.ok(cls >= 0 && cls < CLASSES.length && [-1, 0, 1].includes(oneway) && lanes >= 0 && lanes <= 8);
    assert.ok(flat.length >= 4 && flat.length % 2 === 0 && flat.every(Number.isFinite));
  }
});
