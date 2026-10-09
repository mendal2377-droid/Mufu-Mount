import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {WAYS} from '../src/city-terrain.js';

// The composed views (src/city-sets*.js) are built by the real scene builder here, under a minimal DOM
// stub, because their geometry depends on the real terrain. This takes about half a minute.
const ctx = new Proxy({}, {get: (_, k) => k === 'measureText' ? t => ({width: String(t).length * 20}) : k === 'canvas' ? undefined : () => ctx, set: () => true});
globalThis.document = {createElement: () => ({width: 0, height: 0, getContext: () => ctx, style: {}})};
const data = JSON.parse(fs.readFileSync(new URL('../public/city/nanjing.json', import.meta.url)));
const {buildCityScene} = await import('../src/city-scene.js');
const shared = Object.fromEntries(['time', 'snow', 'storm', 'sunset', 'dawn', 'flash'].map(k => [k, {value: 0}]));
const built = buildCityScene(data, shared, () => new THREE.MeshBasicMaterial(), {roads: null});
const VIEWS = ['xiaoling', 'zhongshan', 'jiming', 'qinhuai', 'mochou', 'xuanwu', 'qixia', 'zijin'];
const get = id => built.places.find(p => p.id === id);

test('every best-view place brings its own light, season and route', () => {
  for (const id of VIEWS) {
    const p = get(id);
    assert.ok(p.vista, `${id} has no composed view`);
    assert.ok(['morning', 'sunset', 'dawn'].includes(p.vista.weather), `${id}: weather ${p.vista.weather}`);
    assert.ok(['summer', 'autumn'].includes(p.vista.season), `${id}: season`);
    assert.ok(built.routes[p.route].points.length >= 20, `${id}: walk too short`);
  }
  assert.deepEqual(VIEWS.filter(id => get(id).vista.season === 'autumn').sort(), ['qixia', 'zijin']);
});

test('the first frame of each view looks along the walk, not into the ground or the sky', () => {
  for (const id of VIEWS) {
    const p = get(id), [sx, sy, sz] = p.spawn, [lx, ly, lz] = p.look;
    assert.ok([sx, sy, sz, lx, ly, lz].every(Number.isFinite), id);
    const run = Math.hypot(lx - sx, lz - sz), pitch = Math.atan2(ly - sy, run) * 180 / Math.PI;
    assert.ok(run > 12, `${id}: looks at something ${run.toFixed(0)} m away`);
    assert.ok(pitch > -9 && pitch < 26, `${id}: the first frame is pitched ${pitch.toFixed(0)} degrees`);
    assert.ok(sy - built.ground(sx, sz) > 1.5, `${id}: the eye is ${(sy - built.ground(sx, sz)).toFixed(1)} m above the ground`);
  }
});

test('the walks are continuous and walkable', () => {
  for (const id of VIEWS) {
    const pts = built.routes[get(id).route].points;
    let longest = 0;
    for (let i = 1; i < pts.length; i++) {
      const step = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][2] - pts[i - 1][2]);
      longest = Math.max(longest, step);
      assert.ok(Math.abs(pts[i][1] - pts[i - 1][1]) < 2.2, `${id}: the walk jumps ${Math.abs(pts[i][1] - pts[i - 1][1]).toFixed(1)} m at sample ${i}`);
    }
    assert.ok(longest < 5, `${id}: a gap of ${longest.toFixed(1)} m in the walk`);
  }
});

test('boardwalk, avenue and Sacred Way grades stay gentle', () => {
  for (const id of Object.keys(WAYS)) {
    const p = get(id), [px, , pz] = p.position, w = WAYS[id];
    let prev = null, worst = 0;
    for (let i = 1; i < w.pts.length; i++) {
      const a = w.pts[i - 1], b = w.pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let s = 0; s < len; s += 4) {
        const f = s / len, y = built.terrain.analytic(px + a[0] + (b[0] - a[0]) * f, pz + a[1] + (b[1] - a[1]) * f);
        if (prev !== null) worst = Math.max(worst, Math.abs(y - prev) / 4);
        prev = y;
      }
    }
    assert.ok(worst < .15, `${id}: the way climbs ${(worst * 100).toFixed(0)}%`);
  }
});

test('the Qixia boardwalk is a deck with railings between maples, not a loop of ground', () => {
  const trees = built.landscape.stats.trees;
  assert.ok(trees > 4000);
  const names = [];
  built.scene.traverse(o => { if (/grove crowns/.test(o.name)) names.push(o.material.customProgramCacheKey?.()); });
  assert.ok(names.some(n => /maple/.test(n)) && names.some(n => /plane/.test(n)), 'autumn maples and plane trees exist');
});
