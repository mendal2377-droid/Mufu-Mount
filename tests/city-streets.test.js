import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cityPoint, cityRiverSurfaces} from '../src/city-geography.js';
import {createCityTerrain} from '../src/city-terrain.js';
import {planAvenue, loopFrom, framingDistance, arrivalLook, viewVersusRoad, arrivalFlight, EXTENT} from '../src/city-arrival.js';
import {shoreWalk, buildRoadNetwork, chaikin, longestWetRun, MAX_BRIDGE_SAMPLES} from '../src/city-network.js';

// One terrain for the whole file: it takes about ten seconds to build.
const data = JSON.parse(fs.readFileSync(new URL('../public/city/nanjing.json', import.meta.url)));
const places = data.landmarks.map(p => ({...p, position: cityPoint(p.coord, data)}));
const rivers = cityRiverSurfaces(data);
const lakes = data.lakes.map(l => ({...l, outer: l.outer.map(r => r.map(p => cityPoint(p, data))), inner: l.inner.map(r => r.map(p => cityPoint(p, data)))}));
const terrain = createCityTerrain(places, rivers, lakes, data.boundary.map(r => r.map(p => cityPoint(p, data))));
const {ground, wet} = terrain;
const get = id => places.find(p => p.id === id);

// The loop-shaped walks and their radii, as built in city-scene.js.
const LOOPS = {yuejiang: 48, jiming: 52, zifeng: 58, palace: 62, niushou: 85, qixia: 48};
const avoidFor = id => places.filter(q => q.id !== id).map(q => [q.position[0], q.position[2], (LOOPS[q.id] || 40) + 14]);
const plans = Object.fromEntries(Object.entries(LOOPS).map(([id, radius]) => {
  const [x, , z] = get(id).position;
  return [id, {radius, x, z, plan: planAvenue({x, z, radius, distance: framingDistance(id), ground, wet, avoid: avoidFor(id), targetY: ground(x, z) + EXTENT[id].h * .4})}];
}));

test('every loop-shaped landmark gets an approach avenue', () => {
  for (const [id, {plan}] of Object.entries(plans)) assert.ok(plan, `${id} found no dry, gentle approach`);
});

test('arrivals face along the road, not 66–135° across it as the previous release did', () => {
  for (const [id, {x, z, plan}] of Object.entries(plans)) {
    const spawn = plan.far, look = arrivalLook(id, get(id).position, ground);
    const angle = viewVersusRoad([spawn[0], spawn[1] + 1.7, spawn[2]], look, plan.points);
    assert.ok(angle < 3, `${id}: camera is ${angle.toFixed(1)}° off the road`);
    // And the road really does point at the landmark.
    const heading = Math.atan2(plan.junction[0] - spawn[0], plan.junction[2] - spawn[2]);
    const toward = Math.atan2(x - spawn[0], z - spawn[2]);
    assert.ok(Math.abs(Math.atan2(Math.sin(heading - toward), Math.cos(heading - toward))) < 0.05, `${id}: avenue misses the landmark`);
  }
});

test('avenues start at a distance that frames the landmark, and stay on dry, walkable ground', () => {
  for (const [id, {x, z, radius, plan}] of Object.entries(plans)) {
    const d = Math.hypot(plan.far[0] - x, plan.far[2] - z), want = framingDistance(id);
    assert.ok(d >= Math.max(radius + 28, Math.min(want, radius + 30)) - 1, `${id}: starts only ${d.toFixed(0)} m away`);
    assert.ok(d <= want + 35, `${id}: starts ${d.toFixed(0)} m away, past the framing distance ${want.toFixed(0)}`);
    plan.points.forEach((p, i) => {
      assert.ok(!wet(p[0], p[2]), `${id}: avenue point ${i} is in water`);
      if (i) assert.ok(Math.abs(p[1] - plan.points[i - 1][1]) <= 1.0, `${id}: avenue is steeper than 1:2`);
    });
  }
});

test('avenues are chosen so the landmark can actually be seen down them', () => {
  const hidden = Object.entries(plans).filter(([, {plan}]) => !plan.visible).map(([id]) => id);
  // Some landmarks sit in hills where every dry approach is occluded; most should not.
  assert.ok(hidden.length <= 2, `landmarks hidden from their own avenue: ${hidden.join(', ')}`);
});

test('an avenue joins its loop exactly where the loop begins', () => {
  for (const [id, {x, z, radius, plan}] of Object.entries(plans)) {
    const loop = loopFrom({x, z, radius, bearing: plan.bearing, ground});
    assert.ok(Math.hypot(loop[0][0] - plan.junction[0], loop[0][2] - plan.junction[2]) < 0.01, `${id}: gap at the junction`);
    assert.ok(Math.hypot(loop[0][0] - loop.at(-1)[0], loop[0][2] - loop.at(-1)[2]) < 0.01, `${id}: loop does not close`);
  }
});

test('the drop-in descends from above and behind, lands exactly on the spawn, and never dips underground', () => {
  for (const [id, {plan}] of Object.entries(plans)) {
    const spawn = [plan.far[0], plan.far[1] + 1.7, plan.far[2]], look = arrivalLook(id, get(id).position, ground);
    const f = arrivalFlight(spawn, look);
    assert.deepEqual(f.at(f.seconds).map(v => +v.toFixed(6)), spawn.map(v => +v.toFixed(6)));
    assert.ok(f.at(0)[1] - spawn[1] > 90, `${id}: should start high above`);
    let last = Infinity;
    for (let t = 0; t <= f.seconds; t += f.seconds / 60) {
      const p = f.at(t);
      assert.ok(p[1] <= last + 1e-9, `${id}: climbed during a descent`);
      last = p[1];
      assert.ok(Number.isFinite(p[0] + p[1] + p[2]));
    }
  }
});

test('lake promenades are smooth and dry; the old ones zig-zagged through a few metres', () => {
  for (const [id, arc] of [['xuanwu', {from: .40, to: .64}], ['mochou', {from: .30, to: .78}]]) {
    const ring = lakes.find(l => l.id === id).outer[0];
    const walk = shoreWalk(ring, {...arc, offset: 11, wet, ground});
    assert.ok(walk.length >= 15, `${id}: only ${walk.length} points`);
    let length = 0, lastTurn = 0;
    for (let i = 1; i < walk.length; i++) {
      const step = Math.hypot(walk[i][0] - walk[i - 1][0], walk[i][2] - walk[i - 1][2]);
      // On a tight bend an inland offset stretches a 3 m sample; this only catches teleports.
      assert.ok(step < 6.5, `${id}: a ${step.toFixed(1)} m jump between samples`);
      assert.ok(step > 0.5, `${id}: samples ${i - 1} and ${i} have collapsed onto each other`);
      length += step;
      assert.ok(!wet(walk[i][0], walk[i][2]), `${id}: sample ${i} is wet`);
      if (i > 1) {
        const a = Math.atan2(walk[i - 1][0] - walk[i - 2][0], walk[i - 1][2] - walk[i - 2][2]);
        const b = Math.atan2(walk[i][0] - walk[i - 1][0], walk[i][2] - walk[i - 1][2]);
        const turn = Math.atan2(Math.sin(b - a), Math.cos(b - a));
        // A pond's corner is a real 90° turn. What the old sampler produced was
        // back-and-forth: a hard turn immediately followed by a hard turn the
        // other way. Corners are fine; zig-zags are not; hairpins never.
        assert.ok(Math.abs(turn) < 1.75, `${id}: a ${(Math.abs(turn) * 57.3).toFixed(0)}° hairpin at sample ${i}`);
        assert.ok(!(Math.abs(turn) > 0.5 && Math.abs(lastTurn) > 0.5 && Math.sign(turn) !== Math.sign(lastTurn)), `${id}: zig-zag at sample ${i}`);
        lastTurn = turn;
      }
    }
    assert.ok(length > 50, `${id}: promenade is only ${length.toFixed(0)} m`);
  }
});

test('chaikin smoothing keeps both ends fixed', () => {
  const s = chaikin([[0, 0], [10, 0], [10, 10]], 3);
  assert.deepEqual(s[0], [0, 0]);
  assert.deepEqual(s.at(-1), [10, 10]);
  assert.ok(s.length > 3);
});

test('the street network links the old-city landmarks without crossing water or cliffs', () => {
  const ids = ['qinhuai', 'mendong', 'zifeng', 'palace', 'jiming'];
  const nodes = [];
  const polylines = [], cores = [];
  for (const id of ['zifeng', 'palace', 'jiming']) {
    const {x, z, radius, plan} = plans[id];
    nodes.push({id, x: plan.far[0], z: plan.far[2]});
    polylines.push([...plan.points, ...loopFrom({x, z, radius, bearing: plan.bearing, ground})]);
    cores.push([x, z, radius * .85]);
  }
  for (const id of ['qinhuai', 'mendong']) {
    const [x, , z] = get(id).position;
    const street = Array.from({length: 61}, (_, i) => [x - 65 + i * 2.1, Math.max(1.7, ground(x - 65 + i * 2.1, z)) + .3, z]);
    nodes.push({id, x: street[0][0], z: street[0][2]});
    polylines.push(street);
    for (let i = -3; i <= 3; i++) for (const row of [-1, 1]) cores.push([x + i * 17, z + row * 19, 11]);
  }
  // Zifeng is now seen from 250 m, so its nearest neighbours here are farther than the default.
  const net = buildRoadNetwork({nodes, polylines, cores, ground, wet, maxEdge: 520});
  assert.ok(net.roads.length >= 4, `only ${net.roads.length} roads for ${ids.length} landmarks`);
  assert.equal(net.components, 1, 'the old-city landmarks should form one connected network');
  for (const r of net.roads) {
    assert.ok(r.length > 20, `${r.a}–${r.b} is a stub`);
    r.points.forEach((p, i) => {
      // Ends are the existing walks' own starts (Qinhuai's street begins on a river
      // bank); between them a road may only bridge narrow water, never wade a lake.
      assert.ok(Number.isFinite(p[1]));
      assert.ok(Number.isFinite(p[0] + p[1] + p[2]));
      if (i) assert.ok(Math.hypot(p[0] - r.points[i - 1][0], p[2] - r.points[i - 1][2]) < 3.6, `${r.a}–${r.b}: gap in the road`);
    });
    assert.ok(longestWetRun(r.points, wet) <= MAX_BRIDGE_SAMPLES, `${r.a}–${r.b}: wades ${longestWetRun(r.points, wet) * 3} m of water`);
    // Ends sit exactly on the nodes they join, so walkers can pass between roads.
    const a = nodes.find(n => n.id === r.a), b = nodes.find(n => n.id === r.b);
    assert.ok(Math.hypot(r.points[0][0] - a.x, r.points[0][2] - a.z) < 0.5);
    assert.ok(Math.hypot(r.points.at(-1)[0] - b.x, r.points.at(-1)[2] - b.z) < 0.5);
  }
});

test('framing distances are bounded, and tall landmarks are seen from farther away', () => {
  for (const id of Object.keys(EXTENT)) {
    const d = framingDistance(id);
    assert.ok(d >= 60 && d <= 250, `${id}: ${d}`);
  }
  assert.ok(framingDistance('zifeng') > framingDistance('palace'));
});

// --- the baked road file -----------------------------------------------------
import crypto from 'node:crypto';
import {bakedRoadsMatch, roadComponents} from '../src/city-network.js';
const roadsFile = JSON.parse(fs.readFileSync(new URL('../public/city/roads.json', import.meta.url)));
const nodeList = Object.entries(roadsFile.nodes).map(([id, [x, z]]) => ({id, x, z}));

test('baked roads were made from the map data that is committed now', () => {
  const hash = crypto.createHash('sha1').update(fs.readFileSync(new URL('../public/city/nanjing.json', import.meta.url))).digest('hex');
  assert.equal(roadsFile.dataHash, hash, 'public/city/nanjing.json changed: run  node tools/research/build-roads.mjs');
});

test('baked roads are walkable: evenly spaced, dry apart from short bridges, and they join their nodes', () => {
  assert.ok(roadsFile.roads.length >= 9, `only ${roadsFile.roads.length} roads`);
  for (const r of roadsFile.roads) {
    assert.ok(r.points.length > 10);
    r.points.forEach((p, i) => {
      assert.ok(p.every(Number.isFinite));
      if (i) assert.ok(Math.hypot(p[0] - r.points[i - 1][0], p[2] - r.points[i - 1][2]) < 3.7, `${r.a}–${r.b}: gap in the road at ${i}`);
    });
    assert.ok(longestWetRun(r.points, wet) <= MAX_BRIDGE_SAMPLES, `${r.a}–${r.b} wades water`);
    const a = roadsFile.nodes[r.a], b = roadsFile.nodes[r.b];
    assert.ok(Math.hypot(r.points[0][0] - a[0], r.points[0][2] - a[1]) < 0.2);
    assert.ok(Math.hypot(r.points.at(-1)[0] - b[0], r.points.at(-1)[2] - b[1]) < 0.2);
  }
});

test('the eleven old-city, riverside and hillside landmarks are one connected network', () => {
  const core = ['qinhuai', 'mendong', 'zhonghua', 'zifeng', 'palace', 'jiming', 'xuanwu', 'mochou', 'yuejiang', 'zijin', 'xiaoling'];
  const parent = new Map(core.map(id => [id, id]));
  const find = id => parent.get(id) === id ? id : (parent.set(id, find(parent.get(id))), parent.get(id));
  for (const r of roadsFile.roads) if (parent.has(r.a) && parent.has(r.b)) parent.set(find(r.a), find(r.b));
  assert.equal(new Set(core.map(find)).size, 1, 'the core landmarks are not all connected by road');
});

test('a baked file is rejected when a landmark has moved, vanished or been added', () => {
  assert.equal(bakedRoadsMatch(roadsFile, nodeList), true);
  const moved = nodeList.map(n => n.id === 'palace' ? {...n, x: n.x + 30} : n);
  assert.equal(bakedRoadsMatch(roadsFile, moved), false, 'a moved node must invalidate the bake');
  assert.equal(bakedRoadsMatch(roadsFile, nodeList.filter(n => n.id !== 'palace')), false, 'a road to a missing node must');
  assert.equal(bakedRoadsMatch(roadsFile, [...nodeList, {id: 'newplace', x: 0, z: 0}]), false, 'an unbaked new landmark must');
  assert.equal(bakedRoadsMatch(null, nodeList), false);
  assert.equal(bakedRoadsMatch({...roadsFile, version: 2}, nodeList), false);
  assert.equal(roadComponents(nodeList, roadsFile.roads) >= 1, true);
});
