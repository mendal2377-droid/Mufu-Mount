import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {landmarkDetails, bridgeDetails, loft, loftRing} from '../src/city-landmarks.js';
import {cityPoint} from '../src/city-geography.js';
import {EXTENT} from '../src/city-arrival.js';

// Runs every landmark builder against recording stubs. It exists because the
// builders are only reachable through a ten-second scene build in a browser, so
// a missing helper or a bad argument used to cost a full reload to discover.
const data = JSON.parse(fs.readFileSync(new URL('../public/city/nanjing.json', import.meta.url)));
const places = data.landmarks.map(p => ({...p, position: cityPoint(p.coord, data)}));

function harness() {
  const calls = {add: 0, block: 0, beam: 0, hall: 0, tree: 0, plaques: [], materials: new Set(), boxes: []};
  const geometry = () => new THREE.BoxGeometry(1, 1, 1);
  const finite = (...v) => v.flat().every(n => Number.isFinite(n));
  const helpers = {
    add(g, mat = 'stone', pos = [0, 0, 0], scale = [1, 1, 1], yaw = 0) {
      assert.ok(g?.isBufferGeometry, 'add() needs a geometry');
      assert.ok(typeof mat === 'string', `add() material must be a name, got ${mat}`);
      assert.ok(finite(pos, scale, yaw), `add() got a non-finite transform: ${pos} ${scale} ${yaw}`);
      calls.add++; calls.materials.add(mat);
    },
    block(x, y, z, w, h, d, mat = 'stone', yaw = 0) {
      assert.ok(finite(x, y, z, w, h, d, yaw), `block() got a non-finite value: ${[x, y, z, w, h, d]}`);
      assert.ok(w > 0 && h > 0 && d > 0, `block() has a non-positive size: ${[w, h, d]}`);
      calls.block++; calls.materials.add(mat); calls.boxes.push([x, y, z, w, h, d]);
    },
    beam(a, b, r, mat = 'stone') {
      assert.ok(finite(a, b, r), `beam() got a non-finite value: ${a} ${b} ${r}`);
      calls.beam++; calls.materials.add(mat);
    },
    hall(x, y, z, w, d, h, tiles = 'roof') { assert.ok(finite(x, y, z, w, d, h)); calls.hall++; calls.materials.add(tiles); },
    tree() { calls.tree++; },
    plaque(text, o) {
      assert.ok(text && typeof text === 'string');
      assert.ok(finite(o.x, o.y, o.z, o.w ?? 1, o.h ?? 1), `plaque ${text} has a bad position`);
      calls.plaques.push({text, ...o});
    },
    roof: geometry(), sphere: geometry(), cylinder: geometry(),
    ground: () => 0,
    footing(x, z, w, d, top) { assert.ok(finite(x, z, w, d, top)); calls.footings = (calls.footings || 0) + 1; },
  };
  return {calls, helpers};
}

const known = new Set(['stone', 'white', 'roof', 'red', 'blue', 'ochre', 'bronze', 'glass', 'bark', 'leaf', 'canopy', 'sage', 'glow', 'water', 'terrain', 'gold', 'brick', 'wall', 'lamp']);

for (const p of places.filter(p => !['truss', 'cable', 'eye'].includes(p.kind))) {
  test(`${p.id}: the landmark builder runs and emits only known materials`, () => {
    const {calls, helpers} = harness();
    const position = [p.position[0], 0, p.position[2]];
    assert.doesNotThrow(() => landmarkDetails({...p, position}, helpers));
    for (const m of calls.materials) assert.ok(known.has(m), `${p.id} used an unknown material "${m}"`);
    for (const box of calls.boxes) assert.ok(box.every(Number.isFinite));
  });
}

test('signage names the places it should, in the right characters', () => {
  const texts = {};
  for (const p of places) {
    const {calls, helpers} = harness();
    landmarkDetails({...p, position: [p.position[0], 0, p.position[2]]}, helpers);
    texts[p.id] = calls.plaques.map(x => x.text);
  }
  assert.deepEqual(texts.palace, ['总统府']);
  assert.deepEqual(texts.zhonghua, ['中华门']);
  assert.deepEqual(texts.yuejiang, ['阅江楼']);
  assert.deepEqual(texts.xiaoling, ['明孝陵']);
  assert.deepEqual(texts.qinhuai, ['夫子庙']);
  assert.deepEqual(texts.zhongshan, ['博爱']);
  assert.ok(texts.jiming.includes('鸡鸣寺'));
});

test('Yuejiang Tower is four stepped red tiers, not one wide castle', () => {
  const {calls, helpers} = harness();
  const p = places.find(p => p.id === 'yuejiang');
  landmarkDetails({...p, position: [p.position[0], 0, p.position[2]]}, helpers);
  // Each storey's dark inner wall is a block whose width shrinks going up.
  const walls = calls.boxes.filter(b => b[4] > 5 && b[4] < 5.5 && b[3] > 9 && b[3] < 30).sort((a, b) => a[1] - b[1]);
  const widths = walls.map(b => b[3]);
  assert.ok(widths.length >= 4, `only ${widths.length} tiers`);
  for (let i = 1; i < 4; i++) assert.ok(widths[i] < widths[i - 1], `tier ${i} is not narrower than the one below`);
  assert.ok(calls.materials.has('bronze'), 'gilded ridges and eave tips');
  assert.ok(calls.materials.has('red') && calls.materials.has('blue'), 'red pillars over a band of cyan brackets');
  const top = Math.max(...calls.boxes.map(b => b[1] + b[4]));
  assert.ok(top > EXTENT.yuejiang.h * 0.5, 'tall enough to read as a tower');
});

test('the Yangtze Bridge builds cream bridgehead towers, flags, lamp posts and piers', () => {
  const {calls, helpers} = harness();
  const deck = 20;
  // A straight 112-unit span along z, matching the compressed bridge.
  const bp = (t, side = 0, h = deck) => [side, h, t * 112];
  assert.doesNotThrow(() => bridgeDetails('truss', bp, deck, helpers));
  const towers = calls.boxes.filter(b => b[3] === 8 && b[4] === 36);
  assert.equal(towers.length, 4, 'two towers at each end of the bridge');
  assert.ok(calls.materials.has('ochre'), 'cream tower walls');
  assert.ok(calls.add >= 12 + 38 * 3, 'flags on the towers and multi-globe lamps down the deck');
});

test('the other bridge builders still run', () => {
  for (const kind of ['cable', 'eye']) {
    const {helpers} = harness();
    const bp = (t, side = 0, h = 14) => [side, h, t * 100];
    assert.doesNotThrow(() => bridgeDetails(kind, bp, 14, helpers), kind);
  }
});

test('Xiaoling is a vermilion wall under yellow glazed tile with studded arched doors, not a red box', () => {
  const {calls, helpers} = harness();
  const p = places.find(p => p.id === 'xiaoling');
  landmarkDetails({...p, position: [p.position[0], 0, p.position[2]]}, helpers);
  for (const m of ['wall', 'gold', 'brick', 'blue', 'bronze']) assert.ok(calls.materials.has(m), `uses ${m}`);
  assert.deepEqual(calls.plaques.map(x => x.text), ['明孝陵']);
  assert.ok(calls.footings >= 1, 'the gate house has a footing');
});

test('Zifeng is one tapering twisted blade, with its floor belts and four sharp edges', () => {
  const {calls, helpers} = harness();
  const p = places.find(p => p.id === 'zifeng');
  landmarkDetails({...p, position: [p.position[0], 0, p.position[2]]}, helpers);
  assert.ok(calls.beam >= 5 * 5 + 5 * 12, 'five floor belts and five vertical edges');
  assert.ok(calls.materials.has('glass'));
});

test('the loft narrows smoothly and stays finite', () => {
  const outline = [[-12, -9], [9, -10], [14, 2], [-3, 13], [-12, 6]];
  const shape = {height: 92, twist: .42, taper: t => 1 - .78 * t ** 1.15, drift: [5, 0]};
  const g = loft(outline, shape);
  const pos = g.attributes.position;
  assert.ok(Array.from(pos.array).every(Number.isFinite));
  g.computeBoundingBox();
  assert.ok(Math.abs(g.boundingBox.max.y - 92) < 1e-6, 'reaches its full height');
  let prev = Infinity;
  for (const t of [0, .25, .5, .75, 1]) {
    const ring = loftRing(outline, shape, t), width = Math.max(...ring.map(r => r[0])) - Math.min(...ring.map(r => r[0]));
    assert.ok(width < prev + 1e-9, 'each slice is no wider than the one below');
    prev = width;
  }
});

test('Qixia is led by its stone pagoda; the Zhonghua wall is grey brick', () => {
  const qixia = harness(), zh = harness();
  const q = places.find(p => p.id === 'qixia'), z = places.find(p => p.id === 'zhonghua');
  landmarkDetails({...q, position: [q.position[0], 0, q.position[2]]}, qixia.helpers);
  landmarkDetails({...z, position: [z.position[0], 0, z.position[2]]}, zh.helpers);
  assert.ok(qixia.calls.add >= 5 * 3, 'five storeys, each with its own eave');
  assert.ok(zh.calls.materials.has('brick'), 'grey brick as photographed');
});

test('the Yangtze Bridge has no tall pylons beside the deck', () => {
  const {calls, helpers} = harness();
  const bp = (t, side = 0, h = 20) => [side, h, t * 112];
  bridgeDetails('truss', bp, 20, helpers);
  // Nothing but the four bridgehead towers (8 x 36) rises above the deck.
  const tall = calls.boxes.filter(b => b[4] > 12);
  assert.ok(tall.every(b => b[3] === 8 && b[4] === 36), 'only the bridgehead towers are tall');
});
