import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_SEATS, findSpot, faceFrom, roomy} from '../src/world-seats.js';

// A made-up park: flat ground from x = -60 to 20 (z -60 to 60), a lake east of x = 20, a road along
// x = -2..2, and a trunk at (-20, 0).
const height = (x, z) => (x < -60 || x >= 20 || Math.abs(z) > 60 || Math.hypot(x + 20, z) < 1 ? null : 5);
const water = (x, z) => (x >= 20 && x < 400 && Math.abs(z) < 400 ? 4.5 : null);
const road = (x) => (Math.abs(x) <= 2 ? 1 : null);
const grid = {height, water, road};

test('Every bench is well formed: a place rule, a facing and an English label', () => {
  const ids = new Set();
  for (const [world, list] of Object.entries(WORLD_SEATS)) for (const [id, x, north, place, face, label] of list) {
    assert.ok(!ids.has(id), `${world}: ${id} twice`); ids.add(id);
    assert.ok(Number.isFinite(x) && Number.isFinite(north), id);
    assert.ok(place === 'here' || place === 'shore', id);
    assert.ok(face === 'water' || face === 'open' || (Array.isArray(face) && face.length === 2), id);
    assert.ok(typeof label === 'string' && /^[\x20-\x7e]+$/.test(label), `${id}: label in English`);
  }
});

test('A shore bench stands by the water, off the road, and faces the water', () => {
  const s = findSpot(grid, 0, 0, 'shore', 'water');
  assert.ok(s, 'found');
  const [x, z] = s.at;
  assert.ok(x > 2 && x < 20, `on the bank, off the road: x ${x}`);
  assert.ok(20 - x <= 40, 'within 40 m of the water');
  assert.ok(Math.abs(s.a - Math.PI / 2) < 0.25, `faces east, over the lake: ${s.a}`);
  assert.ok(Math.abs(z) < 30);
});

test('A bench keeps clear of a trunk, and of a pocket cut off by a step', () => {
  const s = findSpot(grid, -20, 0, 'here', 'open');
  assert.ok(s && Math.hypot(s.at[0] + 20, s.at[1]) >= 3, 'not against the trunk');
  // A short low strip 3 m below the path, joined to it only by a step.
  const stepped = (x, z) => (x > 10 && x < 14 && Math.abs(z) < 10 ? 2 : height(x, z));
  assert.equal(roomy(stepped, 12, 0), false);
  assert.equal(roomy(height, 0, 0), true);
});

test('A bench given a point faces it; one on a hilltop faces down the slope', () => {
  assert.ok(Math.abs(faceFrom([0, 100], 0, 0, grid) - Math.PI) < 1e-9, 'north is -z');
  const hill = (x, z) => (Math.abs(x) > 600 || Math.abs(z) > 600 ? null : 100 - Math.max(0, z) * 0.2);
  const a = faceFrom('open', 0, 0, {height: hill, water: () => null});
  assert.ok(Math.abs(a) < 0.3, `faces +z, where the ground falls: ${a}`);
});
