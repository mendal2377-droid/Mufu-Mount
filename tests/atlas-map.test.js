import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {metroGraph, metroRide, nearestStation, toXZ} from '../src/atlas-map.js';

const transit = JSON.parse(readFileSync('public/scenes/core/transit.json', 'utf8'));
const g = metroGraph(transit);

test('The map frame: the core origin at nought, east positive, north negative z', () => {
  assert.deepEqual(toXZ([118.7838, 32.0418]).map(v => Math.round(v)), [0, -0]);
  const [x, z] = toXZ([118.7938, 32.0518]);
  assert.ok(x > 900 && x < 1000 && z < -1100 && z > -1110, `${x} ${z}`);
});

test('By metro: Xinjiekou to Gulou is two stops on Line 1', () => {
  const r = metroRide(g, '新街口', '鼓楼');
  assert.equal(r.legs.length, 1);
  assert.equal(r.legs[0].line.en, 'Metro Line 1');
  assert.equal(r.legs[0].stops, 2, JSON.stringify(r.legs.map(l => [l.from.en, l.to.en, l.stops])));
});

test('By metro: a ride that needs a change names the station of the change', () => {
  // Gulou (Line 1, Line 4) to Yunjin Lu (Line 2): change at Xinjiekou or by Line 4 and 2 elsewhere.
  const r = metroRide(g, '鼓楼', '云锦路');
  assert.ok(r && r.legs.length === 2, JSON.stringify(r?.legs.map(l => [l.line.en, l.from.en, l.to.en])));
  assert.equal(r.legs[0].to.name, r.legs[1].from.name);
  assert.notEqual(r.legs[0].line, r.legs[1].line);
});

test('The nearest station to Xinjiekou square is Xinjiekou', () => {
  const [x, z] = toXZ([118.7838, 32.0418]);
  assert.equal(nearestStation(g, x, z).name, '新街口');
});
