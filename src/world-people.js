import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CALM} from './world-traffic.js';

// People walking the city's footways, pedestrian streets, paths and steps (item 44, step 4, slice 2;
// design/STREET-LIFE-PLAN.md). The ways are OSM's (public/scenes/core/paths.json, tools/street-ways.py).
//
// Each walker keeps to its way at its own pace, either way along it, and fades in and out where the
// way ends: a plain model, worked out from the clock alone, with no stopping, sitting or meeting.

// Xuanwu Lake: 19 million visits in 2025, about 52,000 a day (Yangtse Evening Post); the stay of
// 2 hours is ours (no source found). Its walkers at the day's busiest hour = person-hours over the
// day curve's sum, spread over the park's paths.
const LAKE_VISITS = 52000, LAKE_STAY = 2;
// Walkers a kilometre on the city's ways at the busiest hour, both ways together: ours (no count of
// people on Nanjing's pavements was found).
const STREET = {footway: 40, pedestrian: 120, path: 10, steps: 10};
// The day, against its busiest hour (ours): the park busiest in the afternoon, the streets in the evening.
export const PARK_DAY = [0, 0, 0, 0, 0, .02, .1, .25, .4, .55, .7, .85, .9, .85, .85, .9, 1, .95, .8, .6, .4, .25, .1, .03];
export const STREET_DAY = [.03, .02, .01, .01, .01, .03, .12, .35, .55, .5, .55, .7, .8, .7, .65, .7, .8, .9, 1, .95, .8, .55, .3, .1];
export const RADIUS = 300;
const CAP = 4000, FADE = 2;

const share = (day, hour) => { const h = ((hour - .5) % 24 + 24) % 24, i = Math.floor(h), f = h - i; return day[i] * (1 - f) + day[(i + 1) % 24] * f; };
/** Walkers a kilometre on a way of this kind at this hour (as drawn: the owner's calmer street). */
export function density(kind, park, hour, lakeKm) {
  if (park) return LAKE_VISITS * LAKE_STAY / PARK_DAY.reduce((a, b) => a + b, 0) / lakeKm * share(PARK_DAY, hour) * CALM.bike;
  return (STREET[kind] || 0) * share(STREET_DAY, hour) * CALM.bike;
}

function hash(i, seed) {
  let h = Math.imul(i ^ seed, 2654435761) ^ (seed >>> 7);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** A walker: {body, head, leg}. Local frame: +z forward, feet at y 0, about 1.7 m tall. The leg hangs
 *  from its hip at the origin, so each leg's matrix can swing it. */
function personModel() {
  const tint = (g, c) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const col = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) col.toArray(a, i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
  const limb = (a, b, r) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), g = new THREE.CapsuleGeometry(r, Math.max(.01, d.length()), 3, 8);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); return g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2); };
  const plain = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); return g; };
  // Coat: torso, shoulders, arms hanging a little forward.
  const body = mergeGeometries([plain(limb([0, .98, 0], [0, 1.38, 0], .16)), plain(limb([-.19, 1.4, 0], [.19, 1.4, 0], .07)),
    plain(limb([-.22, 1.38, 0], [-.25, .95, .05], .05)), plain(limb([.22, 1.38, 0], [.25, .95, .05], .05))]);
  // Head, hair, hands.
  const head = mergeGeometries([tint(new THREE.SphereGeometry(.11, 10, 8).translate(0, 1.6, .01), 0xe6c4a3),
    tint(new THREE.SphereGeometry(.118, 10, 6, 0, Math.PI * 2, 0, Math.PI * .5).translate(0, 1.62, -.01), 0x2a2420),
    tint(new THREE.SphereGeometry(.045, 6, 4).translate(-.25, .92, .06), 0xe6c4a3), tint(new THREE.SphereGeometry(.045, 6, 4).translate(.25, .92, .06), 0xe6c4a3)]);
  // A leg from the hip (origin) to the shoe.
  const leg = mergeGeometries([tint(limb([0, -.02, 0], [0, -.82, 0], .075), 0xffffff), tint(new THREE.BoxGeometry(.11, .08, .24).translate(0, -.9, .05), 0x222222)]);
  return {body, head, leg};
}

/** Load the walkers' ways and make the people for a world; null where there is no paths.json. */
export async function createWorldPeople({world}) {
  const data = await fetch(`/scenes/${world.id}/paths.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!data) return null;
  const ways = data.ways.map(([k, park, flat], index) => {
    const pts = [];
    for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
    return {kind: data.kinds[k], park, pts, cum, length: cum.at(-1), index, box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]};
  });
  const lakeKm = ways.filter(w => w.park).reduce((a, w) => a + w.length, 0) / 1000;

  const m = personModel(), toon = (vc = false) => new THREE.MeshToonMaterial({color: 0xffffff, gradientMap: world.bands || null, vertexColors: vc});
  const bodies = new THREE.InstancedMesh(m.body, toon(), CAP), heads = new THREE.InstancedMesh(m.head, toon(true), CAP);
  const legsL = new THREE.InstancedMesh(m.leg, toon(true), CAP), legsR = new THREE.InstancedMesh(m.leg, toon(true), CAP);
  for (const k of [bodies, legsL, legsR]) for (let i = 0; i < CAP; i++) k.setColorAt(i, new THREE.Color(0xffffff));
  const meshes = [bodies, heads, legsL, legsR];
  for (const k of meshes) { k.name = 'People'; k.frustumCulled = false; k.count = 0; k.castShadow = true; world.scene.add(k); }
  // Coats in the muted colours of a Nanjing street, a few bright; trousers dark, some light.
  const coats = [0x2f3a4f, 0x3a3a3e, 0x8a8f96, 0xd9d2c4, 0xf0eee8, 0x9a4036, 0x56755a, 0xc98a3a, 0x6f5a8a, 0xb85a7a];
  const trousers = [0x23283a, 0x2a2a2c, 0x3d4a66, 0x5a5048, 0xc9c0ae];

  let near = [], lastAt = [Infinity, Infinity];
  // Palettes as linear RGB triples, written straight into the instance colour buffers.
  const rgb = list => list.map(c => new THREE.Color(c).toArray());
  const COATS = rgb(coats), TROUSERS = rgb(trousers);
  const M = new THREE.Matrix4(), color = new THREE.Color();
  // Matrices written straight into the buffers (composing them through Matrix4 for the body and both
  // legs of every walker cost 8.7 ms a frame at the lake): a turn about y, a scale, a move; each leg
  // that, times its hip's offset and swing about x.
  const put = (arr, i, c, s, sc, x, y, z) => { const o = i * 16;
    arr[o] = c * sc; arr[o + 1] = 0; arr[o + 2] = -s * sc; arr[o + 3] = 0; arr[o + 4] = 0; arr[o + 5] = sc; arr[o + 6] = 0; arr[o + 7] = 0;
    arr[o + 8] = s * sc; arr[o + 9] = 0; arr[o + 10] = c * sc; arr[o + 11] = 0; arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1; };
  const putLeg = (arr, i, c, s, sc, x, y, z, hx, sw) => { const o = i * 16, cw = Math.cos(sw), sn = Math.sin(sw);
    // R_y(yaw) * S * [T(hx, .95, 0) * R_x(sw)]
    arr[o] = c * sc; arr[o + 1] = 0; arr[o + 2] = -s * sc; arr[o + 3] = 0;
    arr[o + 4] = s * sn * sc; arr[o + 5] = cw * sc; arr[o + 6] = c * sn * sc; arr[o + 7] = 0;
    arr[o + 8] = s * cw * sc; arr[o + 9] = -sn * sc; arr[o + 10] = c * cw * sc; arr[o + 11] = 0;
    arr[o + 12] = x + c * hx * sc; arr[o + 13] = y + .95 * sc; arr[o + 14] = z - s * hx * sc; arr[o + 15] = 1; };
  const people = {
    ways, lakeKm, stats: {people: 0},
    /** Each frame: t in seconds, the clock's hour, the camera's position. */
    update(t, hour, eye) {
      if (Math.hypot(eye.x - lastAt[0], eye.z - lastAt[1]) > 40) {
        const r = RADIUS + 40;
        near = ways.filter(w => w.box[0] - r < eye.x && w.box[2] + r > eye.x && w.box[1] - r < eye.z && w.box[3] + r > eye.z);
        lastAt = [eye.x, eye.z];
      }
      let n = 0;
      const r2 = RADIUS * RADIUS, bA = bodies.instanceMatrix.array, hA = heads.instanceMatrix.array, lA = legsL.instanceMatrix.array, rA = legsR.instanceMatrix.array;
      const bC = bodies.instanceColor.array, lC = legsL.instanceColor.array, rC = legsR.instanceColor.array;
      for (const w of near) {
        const count = Math.round(density(w.kind, w.park, hour, lakeKm) * w.length / 1000 + hash(w.index, 3));
        const width = w.kind === 'pedestrian' ? 5 : w.park ? 2.4 : 1.6, loop = w.length + 2 * FADE, seed = w.index * 7;
        for (let i = 0; i < count && n < CAP; i++) {
          const pace = 1.1 + .4 * hash(i, seed + 1), dir = hash(i, seed + 2) < .5 ? 1 : -1;
          const u = (pace * t + hash(i, seed + 3) * loop) % loop - FADE;            // metres along, -FADE..length+FADE
          const fade = Math.min(1, Math.max(0, Math.min(u + FADE, w.length + FADE - u) / FADE));
          if (fade <= 0) continue;
          const d = Math.max(0, Math.min(w.length, dir > 0 ? u : w.length - u));
          let lo = 0, hi = w.cum.length - 1;
          while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (w.cum[mid] <= d) lo = mid; else hi = mid; }
          const a = w.pts[lo], b = w.pts[hi], seg = w.cum[hi] - w.cum[lo] || 1, k = (d - w.cum[lo]) / seg;
          const fx = (b[0] - a[0]) / seg * dir, fz = (b[1] - a[1]) / seg * dir, side = (hash(i, seed + 4) - .5) * width;
          const x = a[0] + (b[0] - a[0]) * k - fz * side, z = a[1] + (b[1] - a[1]) * k + fx * side;
          const dx = x - eye.x, dz = z - eye.z;
          if (dx * dx + dz * dz > r2) continue;
          const y = world.ground(x, z) ?? world.grid.height(x, z);
          if (y == null) continue;
          // Facing (fx, fz): yaw's cosine and sine are fz and fx.
          const sc = (.92 + .16 * hash(i, seed + 5)) * fade, swing = Math.sin(u / .7 * Math.PI) * .45;
          put(bA, n, fz, fx, sc, x, y, z); put(hA, n, fz, fx, sc, x, y, z);
          putLeg(lA, n, fz, fx, sc, x, y, z, -.09, swing); putLeg(rA, n, fz, fx, sc, x, y, z, .09, -swing);
          const co = COATS[Math.floor(hash(i, seed + 6) * COATS.length)], tr = TROUSERS[Math.floor(hash(i, seed + 8) * TROUSERS.length)];
          bC.set(co, n * 3); lC.set(tr, n * 3); rC.set(tr, n * 3);
          n++;
        }
      }
      for (const k of meshes) { k.count = n; k.instanceMatrix.needsUpdate = true; if (k.instanceColor) k.instanceColor.needsUpdate = true; }
      people.stats = {people: n};
    },
    /** Where each drawn walker stands, for the audit (tests/people-browser.mjs). */
    positions() {
      const out = [], p = new THREE.Vector3();
      for (let i = 0; i < bodies.count; i++) { bodies.getMatrixAt(i, M); p.setFromMatrixPosition(M); out.push([p.x, p.y, p.z]); }
      return out;
    },
  };
  return people;
}
