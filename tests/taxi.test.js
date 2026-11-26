import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fare, tip, isNight, TARIFF} from '../src/taxi-fare.js';
import {buildGraph, shortest, nearestNode, offRoute, waysFrom} from '../src/nav-graph.js';

test('The meter: ¥11 to 3 km, ¥2.4 a km after, a fifth more a km at night', () => {
  assert.equal(fare(0), 11);
  assert.equal(fare(2.9), 11);
  assert.equal(fare(10, 12), 27.8);            // 11 + 7 × 2.4
  assert.equal(fare(10, 23.5), 31.2);          // 11 + 7 × 2.88
  assert.equal(fare(10, 4.9), 31.2);
  assert.equal(fare(10, 5), 27.8);
  assert.ok(isNight(0) && isNight(23) && !isNight(22.99) && !isNight(5));
  assert.equal(TARIFF.flag, 11);
});

test('The tip: a fifth for a quick trip, none for a slow one', () => {
  // 1500 m at 30 km/h is 180 s.
  assert.equal(tip(20, 180, 1500), 4);
  assert.equal(tip(20, 360, 1500), 0);
  assert.equal(tip(20, 270, 1500), 2);
});

// A 3 × 3 street grid, 100 m blocks, drawn as long ways that cross mid-way (as OSM's do), with
// the middle east-west street one-way eastward.
const grid = () => {
  const ways = [];
  for (const z of [0, 100, 200]) ways.push({pts: [[0, z], [100, z], [200, z]], oneway: z === 100 ? 1 : 0, road: true});
  for (const x of [0, 100, 200]) ways.push({pts: [[x, 0], [x, 100], [x, 200]], oneway: 0, road: true});
  return ways;
};

test('Routes join ways where they cross, and keep one-way streets one way when driving', () => {
  const g = buildGraph(grid());
  const at = (x, z) => nearestNode(g, x, z, {radius: 5});
  const east = shortest(g, at(0, 100), at(200, 100), {car: true});
  assert.equal(east.length, 200);
  // Westward along the one-way street is not allowed by car: round a block instead (400 m).
  const west = shortest(g, at(200, 100), at(0, 100), {car: true});
  assert.equal(west.length, 400);
  // On foot it is.
  assert.equal(shortest(g, at(200, 100), at(0, 100)).length, 200);
  assert.ok(offRoute(west.pts, 100, 0).d < 1e-9 || offRoute(west.pts, 100, 200).d < 1e-9);
});

test('A footpath ending near a road is joined to it on foot, never for the car', () => {
  const ways = [...grid(), {pts: [[50, 108], [50, 150]], oneway: 0, road: false}];
  const g = buildGraph(ways);
  const p = nearestNode(g, 50, 150, {radius: 5});
  const r = shortest(g, nearestNode(g, 0, 0, {radius: 5}), p);
  assert.ok(r && r.length < 200.1, JSON.stringify(r));   // 100 + 50 along roads, 8 to the path, 42 up it
  assert.equal(shortest(g, nearestNode(g, 0, 0, {radius: 5}), p, {car: true}), null);
});

test('The core city: a drive from Xinjiekou to the Drum Tower on the mapped roads', () => {
  const streets = JSON.parse(readFileSync('public/scenes/core/streets.json', 'utf8'));
  const g = buildGraph(waysFrom(streets, null));
  // Xinjiekou (-460, -150) to Gulou (the Drum Tower, about -650, -2300 in the browser frame).
  const a = nearestNode(g, -460, -150, {car: true}), b = nearestNode(g, -644, -2312, {car: true});
  const r = shortest(g, a, b, {car: true});
  assert.ok(r, 'no route');
  const straight = Math.hypot(-460 + 644, -150 + 2312);
  assert.ok(r.length > straight && r.length < straight * 1.6, `${r.length} m against ${straight} m straight`);
});
