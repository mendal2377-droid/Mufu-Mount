// Bake the street network between landmarks into public/city/roads.json.
//
// Why offline: finding the roads is an A* search over the real terrain, which
// cost about 4 s of main-thread time on every page load. The streets only change
// when the map data or the landmark walks do, so they are computed here, once,
// and the page loads the result.
//
// The roads come from running the REAL scene builder (src/city-scene.js) under a
// minimal DOM stub, not from a second implementation of the walks. Their end
// points are therefore the live walk starts by construction, which a reimplemented
// copy could not promise. The page also re-checks every baked end point against
// its live walk start and falls back to computing the roads itself if any have
// drifted (see city-scene.js), so a stale file degrades to slower, never to wrong.
//
//   node tools/research/build-roads.mjs
//
// Re-run it after changing public/city/nanjing.json, a landmark's walk, or any
// of src/city-arrival.js / src/city-network.js. tests/city-roads.test.js fails
// when the file no longer matches the map data.

import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';

// --- the smallest DOM the scene builder touches ------------------------------
const ctx = new Proxy({}, {
  get: (_, k) => k === 'measureText' ? t => ({width: String(t).length * 20}) : k === 'canvas' ? undefined : () => ctx,
  set: () => true,
});
globalThis.document = {
  createElement: () => ({width: 0, height: 0, getContext: () => ctx, style: {}}),
};
globalThis.performance ??= {now: () => Date.now()};

const root = new URL('../../', import.meta.url);
const dataPath = new URL('public/city/nanjing.json', root);
const raw = fs.readFileSync(dataPath);
const data = JSON.parse(raw);

const {buildCityScene} = await import('../../src/city-scene.js');
const shared = Object.fromEntries(['time', 'snow', 'storm', 'sunset', 'dawn', 'flash'].map(k => [k, {value: 0}]));
const makeMaterial = (name, color = [1, 1, 1]) => new THREE.MeshBasicMaterial({color: new THREE.Color(...color)});
// Force a fresh computation: ignore any roads.json already on disk.
const built = buildCityScene(data, shared, makeMaterial, {roads: null});

const round = v => Math.round(v * 10) / 10;
const out = {
  version: 1,
  note: 'Baked by tools/research/build-roads.mjs. Do not edit by hand; re-run the tool.',
  dataHash: crypto.createHash('sha1').update(raw).digest('hex'),
  nodes: Object.fromEntries(built.roadNodes.map(n => [n.id, [round(n.x), round(n.z)]])),
  roads: built.roads.map(r => ({
    a: r.a, b: r.b, length: Math.round(r.length),
    bridges: r.bridges || [],
    points: r.points.map(p => [round(p[0]), round(p[1]), round(p[2])]),
  })),
};
const target = new URL('public/city/roads.json', root);
fs.writeFileSync(target, JSON.stringify(out));
console.log(`wrote ${out.roads.length} roads for ${built.roadNodes.length} nodes, ${(fs.statSync(target).size / 1024).toFixed(1)} KB`);
console.log(out.roads.map(r => `${r.a}–${r.b} ${r.length} m`).join('\n'));
