import * as THREE from 'three';
import {carModel, bikeModel} from './traffic-models.js';

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

  // Toon shading in the city's own bands (as the buildings), so the traffic sits in the painted scene.
  const toon = (c, vertexColors = false) => new THREE.MeshToonMaterial({color: c, gradientMap: world.bands || null, vertexColors});
  const car = carModel(), bike = bikeModel();
  const cars = new THREE.InstancedMesh(car.paint, toon(0xffffff), CAR_CAP);
  const glass = new THREE.InstancedMesh(car.trim, toon(0xffffff, true), CAR_CAP);
  const bikes = new THREE.InstancedMesh(bike.shell, toon(0xffffff), BIKE_CAP);
  const bikeTrim = new THREE.InstancedMesh(bike.trim, toon(0xffffff, true), BIKE_CAP);
  const riders = new THREE.InstancedMesh(bike.coat, toon(0xffffff), BIKE_CAP);
  const helmets = new THREE.InstancedMesh(bike.helmet, toon(0xffffff), BIKE_CAP);
  // Colours set on every instance before the first draw, so each shader is built with them.
  for (const m of [cars, bikes, riders, helmets]) for (let i = 0; i < m.instanceMatrix.count; i++) m.setColorAt(i, new THREE.Color(0xffffff));
  const carMeshes = [cars, glass], bikeMeshes = [bikes, bikeTrim, riders, helmets], meshes = [...carMeshes, ...bikeMeshes];
  for (const m of meshes) { m.name = 'Street traffic'; m.frustumCulled = false; m.count = 0; world.scene.add(m); }
  const paint = [], color = new THREE.Color();
  for (const [n, c] of PAINT) for (let i = 0; i < n; i++) paint.push(c);
  const coats = [0x3b5e8c, 0x3a3a3e, 0x9a4036, 0xd9d2c4, 0x56755a, 0x7a7a84, 0xc98a3a], hats = [0xf2c230, 0xeeece6, 0x2f6fc0, 0xd84a3a, 0xe58aa0];
  // E-bike bodies: white, black, red, blue, pink, mint (our reading of street photographs; no count found).
  const shells = [0xf0eee8, 0x34373b, 0xb8433a, 0x3d64a8, 0xe9a3b4, 0x8fcfbf];

  const dummy = new THREE.Object3D(), at = {x: 0, z: 0, yaw: 0};
  let near = [], lastPick = -1e9, lastAt = [Infinity, Infinity];
  // Ways whose box comes within RADIUS of (x, z), and on each the stretches [from, to] (metres along it)
  // whose segments come within RADIUS + 60: only vehicles there are worked out each frame. Refreshed
  // when the camera has moved 60 m.
  function pick(x, z) {
    const reach = RADIUS + 60, r2 = reach * reach;
    near = [];
    for (const w of ways) {
      if (!(w.box[0] - reach < x && w.box[2] + reach > x && w.box[1] - reach < z && w.box[3] + reach > z)) continue;
      const spans = [];
      for (let j = 1; j < w.pts.length; j++) {
        const [ax, az] = w.pts[j - 1], [bx, bz] = w.pts[j], ux = bx - ax, uz = bz - az, L2 = ux * ux + uz * uz || 1;
        const k = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / L2)), px = ax + ux * k - x, pz = az + uz * k - z;
        if (px * px + pz * pz > r2) continue;
        const last = spans.at(-1);
        if (last && last[1] === w.cum[j - 1]) last[1] = w.cum[j]; else spans.push([w.cum[j - 1], w.cum[j]]);
      }
      if (spans.length) near.push({w, spans});
    }
    lastAt = [x, z];
  }

  // The road's own height first: the road surfaces lie 0.3-0.4 m over the ground (blender/build_core.py,
  // settle_roads), and a car set on the ground sank to its axles. As the buses (src/transit.js).
  const height = (x, z) => world.grid.road(x, z) ?? world.ground(x, z) ?? world.grid.height(x, z);
  // A vehicle's matrix (a turn about y and a move) written straight into each of its meshes: composing
  // it through an Object3D for each of an e-bike's four meshes tripled the frame's cost.
  const M = new Float32Array(16);
  function place(list, i, y) {
    const c = Math.cos(at.yaw), s = Math.sin(at.yaw);
    M[0] = c; M[2] = -s; M[5] = 1; M[8] = s; M[10] = c; M[12] = at.x; M[13] = y; M[14] = at.z; M[15] = 1;
    for (const mesh of list) mesh.instanceMatrix.array.set(M, i * 16);
  }

  const traffic = {
    ways, get near() { return near.map(n => n.w); },
    stats: {cars: 0, bikes: 0},
    /** Each frame: t in seconds, the clock's hour, the camera's position. */
    update(t, hour, eye) {
      if (Math.hypot(eye.x - lastAt[0], eye.z - lastAt[1]) > 60 || t - lastPick > 5) { pick(eye.x, eye.z); lastPick = t; }
      let nc = 0, nb = 0;
      const r2 = RADIUS * RADIUS;
      for (const {w, spans} of near) {
        const dirs = w.oneway ? [w.oneway] : [1, -1];
        for (const dir of dirs) {
          for (let lane = 0; lane <= w.per; lane++) {
            const bike = lane === w.per;
            const g = spacing(w.kind, hour, w.per, bike);
            if (!isFinite(g)) continue;
            const v = speed(w.kind, hour, bike) / 3.6, n = Math.ceil(w.length / g), loop = n * g;
            const off = w.oneway ? (bike ? w.per * LANE_W / 2 + 1.1 : (lane - (w.per - 1) / 2) * LANE_W) : (bike ? w.per * LANE_W + 1.1 : (lane + .5) * LANE_W);
            const seed = w.index * 131 + (dir > 0 ? 0 : 61) + lane * 17;
            // Vehicle i stands at (v t + i g + jitter) mod loop; on a stretch [a, b] only the indices
            // whose slot falls there (one either side for the jitter) can be in it.
            const start = (v * t) % loop;
            for (const [fa, fb] of spans) {
              const a = dir > 0 ? fa : w.length - fb, b = dir > 0 ? fb : w.length - fa;
              const k0 = Math.floor((a - start) / g) - 1, k1 = Math.ceil((b - start) / g) + 1;
              for (let k = Math.max(k0, k1 - n + 1); k <= k1; k++) {   // at most one loop: no vehicle twice
                const i = ((k % n) + n) % n;
                const s = (start + i * g + g * .6 * hash(i, seed)) % loop;
                if (s < a || s > b || s > w.length) continue;
                along(w, s, dir, off, at);
                const dx = at.x - eye.x, dz = at.z - eye.z;
                if (dx * dx + dz * dz > r2) continue;
                const y = height(at.x, at.z);
                if (y == null) continue;
                if (bike) {
                  if (nb >= BIKE_CAP) continue;
                  place(bikeMeshes, nb, y);
                  bikes.setColorAt(nb, color.setHex(shells[Math.floor(hash(i, seed + 11) * shells.length)]));
                  const hsh = hash(i, seed + 7);
                  riders.setColorAt(nb, color.setHex(coats[Math.floor(hsh * coats.length)]));
                  helmets.setColorAt(nb, color.setHex(hats[Math.floor(hash(i, seed + 9) * hats.length)]));
                  nb++;
                } else {
                  if (nc >= CAR_CAP) continue;
                  place(carMeshes, nc, y);
                  cars.setColorAt(nc, color.setHex(paint[Math.floor(hash(i, seed + 3) * paint.length)]));
                  nc++;
                }
              }
            }
          }
        }
      }
      cars.count = glass.count = nc; bikes.count = bikeTrim.count = riders.count = helmets.count = nb;
      for (const m of meshes) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
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
