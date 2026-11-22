import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CALM} from './world-traffic.js';

// Boats out on Xuanwu Lake (item 44, step 4, slice 2; design/STREET-LIFE-PLAN.md). The park's map
// lists pleasure boats, kayaks, paddleboards, dragon boats and rowing boats, kayaks from 9:00 to 17:00
// (xuanwuhu.net); about 600 boats from 11 piers were all out at Qingming 2026 (Yangtse Evening Post).
// On an average day the lake has 52,000 of its 180,000-a-day capacity, so that share of the 600, with
// the owner's calmer street: about 60 boats, out from 9:00 to 17:00 (all boats: ours, from the kayaks).
// The kinds' shares are ours. Each wanders the open water and turns away before the shore; they do
// not keep to piers or routes.

export const OPEN = [9, 17], PEAK_BOATS = 600, AVERAGE_DAY = 52000 / 180000;
const KINDS = [['canopy', .7, 1.4], ['kayak', .2, 1.2], ['paddleboard', .1, .7]];   // [kind, share, m/s]
const LAKE = {x0: -260, x1: 1700, n0: 2560, n1: 4620};

/** Boats out at this hour: none outside opening, ramping over the first and last half hour. */
export function boatsOut(hour) {
  const h = ((hour % 24) + 24) % 24, ramp = Math.min(1, Math.max(0, Math.min(h - OPEN[0], OPEN[1] - h) / .5));
  return Math.round(PEAK_BOATS * AVERAGE_DAY * CALM.bike * ramp);
}

function hash(i, seed) {
  let h = Math.imul(i ^ seed, 2654435761) ^ (seed >>> 7);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}
const tint = (g, c) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const col = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) col.toArray(a, i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const plain = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
/** A pointed hull along z: a box with a tapered bow. */
function hull(w, h, len) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, -len / 2); s.lineTo(w / 2, -len / 2); s.lineTo(w / 2, len * .2); s.quadraticCurveTo(w / 2, len / 2, 0, len / 2); s.quadraticCurveTo(-w / 2, len / 2, -w / 2, len * .2);
  const g = new THREE.ExtrudeGeometry(s, {depth: h, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 1, curveSegments: 5});
  return g.rotateX(Math.PI / 2).translate(0, h, 0);   // shape y to z (forward); extruded down to y 0
}
/** A seated or standing figure at (x, z), facing +z: coat colour c. */
function figure(x, z, c, stand = false) {
  const y = stand ? .9 : .35;
  return [tint(new THREE.CapsuleGeometry(.15, .38, 3, 8).translate(x, y + .45, z), c), tint(new THREE.SphereGeometry(.11, 8, 6).translate(x, y + .86, z), 0xe6c4a3),
    tint(new THREE.SphereGeometry(.117, 8, 5, 0, Math.PI * 2, 0, Math.PI * .5).translate(x, y + .88, z - .01), 0x2a2420)];
}
function models() {
  // A canopied electric pleasure boat: hull (painted per boat), canopy (painted), posts, seats, two to four people.
  const canopy = {paint: plain(hull(1.8, .55, 4.4)), roof: plain(box(1.9, .07, 2.8, 0, 1.85, -.2)),
    trim: mergeGeometries([...[[-.82, .9], [.82, .9], [-.82, -1.3], [.82, -1.3]].map(([x, z]) => tint(box(.06, 1.3, .06, x, 1.2, z), 0xe8e4da)),
      tint(box(1.6, .1, .5, 0, .62, -.7), 0x8a5a36), tint(box(1.6, .1, .5, 0, .62, .5), 0x8a5a36), tint(box(1.82, .12, .2, 0, .58, 2.05), 0xd8d4ca),
      ...figure(-.4, -.7, 0x3d64a8), ...figure(.4, -.7, 0xd9d2c4), ...figure(.35, .5, 0x9a4036)])};
  const kayak = {paint: plain(hull(.62, .3, 3.8)), roof: null,
    trim: mergeGeometries([...figure(0, -.2, 0xf2c230), tint(box(2.2, .04, .1, 0, .95, .05).rotateZ(.35), 0x2a2d30)])};
  const board = {paint: plain(hull(.75, .12, 3.1)), roof: null,
    trim: mergeGeometries([...figure(0, 0, 0x2f6fc0, true), tint(box(.04, 1.8, .04, .3, 1.1, .2), 0x2a2d30)])};
  return {canopy, kayak, paddleboard: board};
}

/** Boats for Xuanwu Lake: null without the lake's water. */
export function createXuanwuBoats({world}) {
  const water = world.grid.water;
  if (!water || water((LAKE.x0 + LAKE.x1) / 2, -3500) == null && water(600, -3500) == null) return null;
  // Open water: wet for 12 m round. Starting points picked once from a 20 m lattice over the lake's box.
  const open = (x, z, r = 12) => [0, 1, 2, 3, 4, 5, 6, 7].every(k => water(x + Math.cos(k * .785) * r, z + Math.sin(k * .785) * r) != null) && water(x, z) != null;
  const spots = [];
  for (let x = LAKE.x0; x < LAKE.x1; x += 20) for (let n = LAKE.n0; n < LAKE.n1; n += 20) if (open(x, -n, 20)) spots.push([x, -n]);
  if (!spots.length) return null;

  const toon = (vc = false) => new THREE.MeshToonMaterial({color: 0xffffff, gradientMap: world.bands || null, vertexColors: vc});
  const ms = models(), CAPK = 200, kinds = {};
  for (const [name] of KINDS) {
    const g = ms[name], k = {paint: new THREE.InstancedMesh(g.paint, toon(), CAPK), trim: new THREE.InstancedMesh(g.trim, toon(true), CAPK),
      roof: g.roof ? new THREE.InstancedMesh(g.roof, toon(), CAPK) : null, n: 0};
    k.meshes = [k.paint, k.trim, k.roof].filter(Boolean);
    for (const m of [k.paint, k.roof].filter(Boolean)) for (let i = 0; i < CAPK; i++) m.setColorAt(i, new THREE.Color(0xffffff));
    for (const m of k.meshes) { m.name = 'Xuanwu boats'; m.frustumCulled = false; m.count = 0; world.scene.add(m); }
    kinds[name] = k;
  }
  const hulls = {canopy: [0xf0eee8, 0xe8e4da, 0x3d64a8], kayak: [0xf2c230, 0xd84a3a, 0x2f8f6f], paddleboard: [0xf0eee8, 0x8fcfbf, 0xf3a06b]};
  const roofs = [0xc8302a, 0x2f6fc0, 0xf2c230, 0x3f8f5a, 0xe8e4da];

  // Each boat: a fixed identity (kind, colours, start) and a state that wanders.
  const fleet = [];
  const boatOf = i => {
    let r = hash(i, 5), kind = KINDS[0];
    for (const kd of KINDS) { if ((r -= kd[1]) < 0) { kind = kd; break; } }
    const [x, z] = spots[Math.floor(hash(i, 9) * spots.length)];
    return {i, kind: kind[0], speed: kind[2] * (.8 + .4 * hash(i, 13)), x, z, yaw: hash(i, 17) * Math.PI * 2, turn: 0};
  };
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), color = new THREE.Color();
  let lastT = null;
  const boats = {
    spots: spots.length, get fleet() { return fleet; }, stats: {boats: 0},
    update(t, hour) {
      const want = boatsOut(hour);
      while (fleet.length < want) fleet.push(boatOf(fleet.length));
      fleet.length = Math.min(fleet.length, want);
      let dt = lastT == null ? 0 : t - lastT;
      lastT = t;
      if (dt < 0 || dt > 2) dt = 0;
      for (const k of Object.values(kinds)) k.n = 0;
      for (const b of fleet) {
        // Steer: a slow wander, and away from the shore when the water 20 m ahead runs out.
        b.turn += (hash(b.i, Math.floor(t / 6) + 101) - .5) * .02;
        b.turn = Math.max(-.12, Math.min(.12, b.turn));
        const ahead = (a, d) => water(b.x + Math.sin(a) * d, b.z + Math.cos(a) * d) != null;
        if (!ahead(b.yaw, 20) || !ahead(b.yaw, 10)) b.turn = ahead(b.yaw + .6, 20) || !ahead(b.yaw - .6, 20) ? .35 : -.35;
        b.yaw += b.turn * dt;
        const nx = b.x + Math.sin(b.yaw) * b.speed * dt, nz = b.z + Math.cos(b.yaw) * b.speed * dt;
        if (water(nx, nz) != null) { b.x = nx; b.z = nz; } else b.yaw += Math.PI * dt;
        const y = water(b.x, b.z);
        if (y == null) continue;
        const k = kinds[b.kind];
        if (k.n >= CAPK) continue;
        e.set(Math.sin(t * 1.1 + b.i) * .02, b.yaw, Math.sin(t * 1.3 + b.i * 2) * .03); q.setFromEuler(e);
        M.compose(v.set(b.x, y - .05, b.z), q, one);
        for (const m of k.meshes) m.setMatrixAt(k.n, M);
        k.paint.setColorAt(k.n, color.setHex(hulls[b.kind][Math.floor(hash(b.i, 21) * hulls[b.kind].length)]));
        if (k.roof) k.roof.setColorAt(k.n, color.setHex(roofs[Math.floor(hash(b.i, 23) * roofs.length)]));
        k.n++;
      }
      let n = 0;
      for (const k of Object.values(kinds)) { for (const m of k.meshes) { m.count = k.n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } n += k.n; }
      boats.stats = {boats: n, out: want};
    },
  };
  return boats;
}
