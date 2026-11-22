import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Cars and e-bikes on the city's roads (item 44, step 4, slice 1; design/STREET-LIFE-PLAN.md, where
// every number below has its source or is marked as ours). The roads are OSM's drivable surface ways
// (public/scenes/core/streets.json, from tools/street-ways.py).
//
// The model is deliberately plain: each lane is a steady stream at the hour's speed and spacing,
// entering where its way begins and leaving where it ends. No turning at junctions, no lights, no
// collisions. Only the ways within RADIUS of the camera are drawn.

export const CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street',
  'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link'];
// Vehicles an hour in one direction at the morning peak.
export const PEAK = {motorway: 4500, trunk: 4500, primary: 2130, secondary: 1250, tertiary: 600, unclassified: 136, residential: 136, living_street: 136};
// Lanes in one direction where OSM maps none.
const LANES = {motorway: 3, trunk: 3, primary: 3, secondary: 2, tertiary: 1, unclassified: 1, residential: 1, living_street: 1};
// km/h free and at the peak (ours: Nanjing publishes congestion indices, not speeds by class).
const SPEED = {motorway: [60, 30], trunk: [60, 30], primary: [40, 20], secondary: [35, 18], tertiary: [30, 15], unclassified: [20, 12], residential: [20, 12], living_street: [15, 10]};
// E-bikes for every car: three on the small streets (the one count, 808 to 272); one on the big
// roads with their own non-motor lanes (ours); none on motorways and trunks.
const EBIKES = {motorway: 0, trunk: 0, primary: 1, secondary: 1, tertiary: 3, unclassified: 3, residential: 3, living_street: 3};
const EBIKE_SPEED = [18, 14];
// The hour of day against the 8:30 morning peak. The shape is ours, timed to Nanjing's 2017 big-data
// report (morning peak 6:30-10:00, worst near 8:30; the evening peak longer and lighter).
export const PROFILE = [.12, .08, .06, .05, .06, .12, .35, .75, 1, .85, .75, .72, .68, .7, .72, .76, .8, .9, .88, .7, .6, .5, .32, .2];
export const RADIUS = 450;
const LANE_W = 3.2, CAR_CAP = 2600, BIKE_CAP = 2200;
// Out of a hundred cars: black 28, white 27, grey 17, silver 9, blue 7, red 6, other 6 (Axalta 2025, China).
// Painted a shade lighter than the real colours: in this light a true black reads as a hole.
const PAINT = [[28, 0x3a3e44], [27, 0xf1efe8], [17, 0x8e9398], [9, 0xc4c8cb], [7, 0x3b5f9f], [6, 0xb43d32], [6, 0x6b8858]];

const base = k => k.replace('_link', '');
/** The hour's flow against the morning peak. PROFILE[i] is the hour from i:00 to i+1:00, centred on
 *  its half hour (the peak is at 8:30); between half hours the flow is interpolated. */
export function flowShare(hour) {
  const h = ((hour - .5) % 24 + 24) % 24, i = Math.floor(h), f = h - i;
  return PROFILE[i] * (1 - f) + PROFILE[(i + 1) % 24] * f;
}
/** Vehicles an hour in one direction on a road of this class at this hour. */
export function flow(kind, hour) {
  return (PEAK[base(kind)] || 0) * (kind.endsWith('_link') ? .5 : 1) * flowShare(hour);
}
/** km/h at this hour: free flow, slowing towards the peak speed as the flow nears its peak. */
export function speed(kind, hour, bike = false) {
  const [free, peak] = bike ? EBIKE_SPEED : SPEED[base(kind)] || [30, 15];
  return free + (peak - free) * flowShare(hour);
}
/** Metres between vehicles in one lane: speed / (flow per lane). */
export function spacing(kind, hour, lanes, bike = false) {
  const q = flow(kind, hour) * (bike ? EBIKES[base(kind)] : 1) / (bike ? 1 : lanes);
  return q > 0 ? speed(kind, hour, bike) * 1000 / q : Infinity;
}

function hash(i, seed) {
  let h = Math.imul(i ^ seed, 2654435761) ^ (seed >>> 7);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** One way's geometry: points, cumulative lengths, bounding box. */
function wayOf([cls, oneway, lanes, flat], index) {
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
  const kind = CLASSES[cls], per = oneway ? (lanes || LANES[base(kind)] || 1) : (lanes ? Math.max(1, Math.floor(lanes / 2)) : LANES[base(kind)] || 1);
  return {kind, oneway, per, pts, cum, length: cum.at(-1), index,
    box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]};
}

/** The point `s` metres along the way (dir 1) or back from its end (dir -1), moved `off` metres to the right. */
function along(w, s, dir, off, out) {
  const d = dir > 0 ? s : w.length - s;
  let lo = 0, hi = w.cum.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (w.cum[m] <= d) lo = m; else hi = m; }
  const a = w.pts[lo], b = w.pts[hi], seg = w.cum[hi] - w.cum[lo] || 1, k = (d - w.cum[lo]) / seg;
  let fx = (b[0] - a[0]) / seg * dir, fz = (b[1] - a[1]) / seg * dir;
  out.x = a[0] + (b[0] - a[0]) * k - fz * off; out.z = a[1] + (b[1] - a[1]) * k + fx * off;
  out.yaw = Math.atan2(fx, fz);
  return out;
}

/** Load the roads and make the traffic for a world; null for a world without streets.json. */
export async function createWorldTraffic({world}) {
  const data = await fetch(`/scenes/${world.id}/streets.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!data) return null;
  const ways = data.ways.map(wayOf);

  const lambert = c => new THREE.MeshLambertMaterial({color: c});
  // A geometry painted one colour, for merging parts that share a mesh.
  const tint = (g, c) => { const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.toArray(a, i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const wheel = (r, w, x, y, z) => new THREE.CylinderGeometry(r, r, w, 10).rotateZ(Math.PI / 2).translate(x, y, z);
  // A car: the painted body (its own colour per car); glass, tyres and lamps in one more draw.
  const body = mergeGeometries([box(1.8, .62, 4.5, 0, .62, 0), box(1.6, .55, 2.4, 0, 1.2, -.2)]);
  const trim = mergeGeometries([
    tint(box(1.64, .44, 2.2, 0, 1.22, -.2), 0x34404c),                                   // the glasshouse
    ...[[-.86, 1.45], [.86, 1.45], [-.86, -1.45], [.86, -1.45]].map(([x, z]) => tint(wheel(.33, .24, x, .33, z), 0x1c1c1e)),
    ...[-.6, .6].map(x => tint(box(.34, .14, .06, x, .72, 2.26), 0xfff3d6)),            // headlamps
    ...[-.62, .62].map(x => tint(box(.36, .14, .06, x, .78, -2.26), 0xd2322a)),         // tail lamps
  ]);
  const cars = new THREE.InstancedMesh(body, lambert(0xffffff), CAR_CAP);
  const glass = new THREE.InstancedMesh(trim, new THREE.MeshLambertMaterial({vertexColors: true}), CAR_CAP);
  // An e-bike: a dark frame on two small wheels with a basket; the rider's coat and helmet coloured apart.
  const frame = mergeGeometries([tint(box(.2, .5, 1.25, 0, .62, 0), 0x2c2f33), tint(wheel(.27, .1, 0, .27, .58), 0x1c1c1e), tint(wheel(.27, .1, 0, .27, -.58), 0x1c1c1e),
    tint(box(.34, .26, .3, 0, .9, .62), 0x5a5f63), tint(box(.62, .05, .05, 0, 1.12, .48), 0x2c2f33)]);
  const torso = mergeGeometries([box(.46, .6, .32, 0, 1.3, -.12), box(.16, .45, .16, -.14, .85, -.05), box(.16, .45, .16, .14, .85, -.05)]);
  const helmet = new THREE.SphereGeometry(.17, 8, 6).translate(0, 1.78, -.08);
  const bikes = new THREE.InstancedMesh(frame, new THREE.MeshLambertMaterial({vertexColors: true}), BIKE_CAP);
  const riders = new THREE.InstancedMesh(torso, lambert(0xffffff), BIKE_CAP);
  const helmets = new THREE.InstancedMesh(helmet, lambert(0xffffff), BIKE_CAP);
  // Colours set on every instance before the first draw, so each shader is built with them.
  for (const m of [cars, riders, helmets]) for (let i = 0; i < m.instanceMatrix.count; i++) m.setColorAt(i, new THREE.Color(0xffffff));
  for (const m of [cars, glass, bikes, riders, helmets]) { m.name = 'Street traffic'; m.frustumCulled = false; m.count = 0; world.scene.add(m); }
  const paint = [], color = new THREE.Color();
  for (const [n, c] of PAINT) for (let i = 0; i < n; i++) paint.push(c);
  const coats = [0x3b5e8c, 0x2b2b2b, 0x8a3a32, 0xd6cfc0, 0x4d6b48, 0x6f6f78], hats = [0xf2c230, 0xe8e6e0, 0x2f6fc0, 0xd84a3a];

  const dummy = new THREE.Object3D(), at = {x: 0, z: 0, yaw: 0};
  let near = [], lastPick = -1e9, lastAt = [Infinity, Infinity];
  // Ways whose box comes within RADIUS of (x, z); refreshed when the camera has moved 60 m.
  function pick(x, z) {
    near = ways.filter(w => w.box[0] - RADIUS < x && w.box[2] + RADIUS > x && w.box[1] - RADIUS < z && w.box[3] + RADIUS > z);
    lastAt = [x, z];
  }

  const height = (x, z) => world.ground(x, z) ?? world.grid.height(x, z);
  function place(mesh, i, y) { dummy.position.set(at.x, y, at.z); dummy.rotation.set(0, at.yaw, 0); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); }

  const traffic = {
    ways, get near() { return near; },
    stats: {cars: 0, bikes: 0},
    /** Each frame: t in seconds, the clock's hour, the camera's position. */
    update(t, hour, eye) {
      if (Math.hypot(eye.x - lastAt[0], eye.z - lastAt[1]) > 60 || t - lastPick > 5) { pick(eye.x, eye.z); lastPick = t; }
      let nc = 0, nb = 0;
      const r2 = RADIUS * RADIUS;
      for (const w of near) {
        const dirs = w.oneway ? [w.oneway] : [1, -1];
        for (const dir of dirs) {
          for (let lane = 0; lane <= w.per; lane++) {
            const bike = lane === w.per;
            const g = spacing(w.kind, hour, w.per, bike);
            if (!isFinite(g)) continue;
            const v = speed(w.kind, hour, bike) / 3.6, n = Math.ceil(w.length / g), loop = n * g;
            const off = w.oneway ? (bike ? w.per * LANE_W / 2 + 1.1 : (lane - (w.per - 1) / 2) * LANE_W) : (bike ? w.per * LANE_W + 1.1 : (lane + .5) * LANE_W);
            const seed = w.index * 131 + (dir > 0 ? 0 : 61) + lane * 17;
            for (let i = 0; i < n; i++) {
              const s = (v * t + i * g + g * .6 * hash(i, seed)) % loop;
              if (s > w.length) continue;
              along(w, s, dir, off, at);
              const dx = at.x - eye.x, dz = at.z - eye.z;
              if (dx * dx + dz * dz > r2) continue;
              const y = height(at.x, at.z);
              if (y == null) continue;
              if (bike) {
                if (nb >= BIKE_CAP) continue;
                place(bikes, nb, y); place(riders, nb, y); place(helmets, nb, y);
                const hsh = hash(i, seed + 7);
                riders.setColorAt(nb, color.setHex(coats[Math.floor(hsh * coats.length)]));
                helmets.setColorAt(nb, color.setHex(hats[Math.floor(hash(i, seed + 9) * hats.length)]));
                nb++;
              } else {
                if (nc >= CAR_CAP) continue;
                place(cars, nc, y); place(glass, nc, y);
                cars.setColorAt(nc, color.setHex(paint[Math.floor(hash(i, seed + 3) * paint.length)]));
                nc++;
              }
            }
          }
        }
      }
      cars.count = glass.count = nc; bikes.count = riders.count = helmets.count = nb;
      for (const m of [cars, glass, bikes, riders, helmets]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      traffic.stats = {cars: nc, bikes: nb};
    },
    /** Where each drawn car and e-bike stands, for the audit (tests/traffic-browser.mjs). */
    positions() {
      const out = [], m = new THREE.Matrix4(), p = new THREE.Vector3();
      for (const [mesh, kind] of [[cars, 'car'], [bikes, 'bike']]) for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m); out.push([kind, p.x, p.y, p.z]); }
      return out;
    },
  };
  return traffic;
}
