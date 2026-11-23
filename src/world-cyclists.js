import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {CALM} from './world-traffic.js';

// Cyclists on the city's leisure cycleways (item 44, step 4, slice 4; design/STREET-LIFE-PLAN.md).
//
// Not in Xuanwu Lake's park: since 2010 its protection regulations ban every vehicle from the scenic
// area and its lakeside road, bicycles included, and Nanjing's park rules keep bikes out unless a park
// allows them. Nanjing's riders go to the greenways: the Yangtze's dyke road under Mufu Mountain, the
// riverside, the 30 km ring round Purple Mountain. The ways are OSM's cycleways that keep away from
// the roads, and its greenways (paths.json `rides`, tools/street-ways.py).
//
// How many: no count was found for Nanjing. On Nanchang's riverside greenway a reporter counted 117
// riders past one point in half an hour at 16:00 on a Saturday in November 2026 (The Paper), so 234
// an hour both ways at a busy hour; at their speeds that is about 14 riders a kilometre. Drawn at the
// owner's calmer setting. Riders came in teams; ours: 60 % ride road bikes in teams of three to seven
// at 22 km/h, 40 % ride shared bikes alone at 12 km/h. The day's curve is ours: busiest at 16:00,
// riders out after dark too (night rides are popular), few before 6.

export const FLOW = 117 * 2;                          // riders an hour past a point, both ways
export const KINDS = {sport: {share: .6, kmh: 22, team: [3, 7]}, city: {share: .4, kmh: 12, team: [1, 1]}};
export const RIDE_DAY = [0, 0, 0, 0, 0, .05, .15, .3, .4, .45, .5, .55, .55, .6, .7, .85, 1, .95, .75, .6, .5, .35, .15, .05];
export const RADIUS = 300;
const CAP = 600, FADE = 3, GAP = 2.6;

const share = (day, hour) => { const h = ((hour - .5) % 24 + 24) % 24, i = Math.floor(h), f = h - i; return day[i] * (1 - f) + day[(i + 1) % 24] * f; };
/** Riders a kilometre of leisure cycleway at this hour (as drawn: the owner's calmer street). */
export function density(hour) {
  // Riders on a stretch = the flow past a point / their speed, for each kind of rider.
  const perKm = FLOW * Object.values(KINDS).reduce((a, k) => a + k.share / k.kmh, 0);
  return perKm * share(RIDE_DAY, hour) * CALM.bike;
}

function hash(i, seed) {
  let h = Math.imul(i ^ seed, 2654435761) ^ (seed >>> 7);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}
const tint = (g, c) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const col = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) col.toArray(a, i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
/** A tube from a to b (bike-local [x, y, z]). */
const tube = (a, b, r, c) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), g = new THREE.CylinderGeometry(r, r, Math.max(.01, d.length()), 6);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); return tint(g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2), c); };
const limb = (a, b, r, c) => { const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), g = new THREE.CapsuleGeometry(r, Math.max(.01, d.length()), 3, 8);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize())); return tint(g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2), c); };

// Bike-local frame: +z forward, ground at y 0. Wheels 0.68 m across, axles 1.04 m apart; the crank's
// axle (bottom bracket) at BB; the rider's hips at HIP.
const BB = [0, .3, 0], CRANK = .17, THIGH = .45, SHIN = .46;
const RIG = {
  sport: {hip: [0, .95, -.2], shoulder: [0, 1.3, .22], head: [0, 1.45, .34], bar: [.2, .93, .46]},
  city: {hip: [0, .9, -.26], shoulder: [0, 1.4, -.1], head: [0, 1.6, -.04], bar: [.27, 1.02, .34]},
};
/** The bike (frame painted per bike), the fixed dark and skin parts, and the rider's kit. */
function model(kind) {
  const r = RIG[kind], white = 0xffffff, dark = 0x1d1f22, skin = 0xe6c4a3;
  const rear = [0, .34, -.52], front = [0, .34, .52], seat = [0, kind === 'sport' ? .9 : .86, kind === 'sport' ? -.2 : -.26];
  const head = kind === 'sport' ? [0, .82, .44] : [0, .9, .36], low = [0, .66, .48];
  const frame = mergeGeometries([tube(BB, seat, .022, white), tube(seat, head, .02, white), tube(BB, low, .024, white), tube(BB, rear, .015, white),
    tube(seat, rear, .014, white), tube(low, front, .016, white), tube(head, low, .022, white),
    ...(kind === 'city' ? [tube([0, .4, .55], [0, .65, .62], .012, dark), tint(new THREE.BoxGeometry(.34, .2, .26).translate(0, .78, .64), 0x8a7a5a),
      tint(new THREE.BoxGeometry(.12, .04, .5).translate(0, .7, -.5), white)] : [])]);
  const wheel = z => tint(new THREE.TorusGeometry(.33, .022, 5, 18).rotateY(Math.PI / 2).translate(0, .34, z), dark);
  const fixed = mergeGeometries([wheel(-.52), wheel(.52), tube([0, .34, -.52], [0, .34, .52], .004, 0x9a9a9a),
    tint(new THREE.BoxGeometry(.14, .05, .26).translate(...seat).translate(0, .03, 0), dark),
    tube([-r.bar[0], r.bar[1], r.bar[2]], [r.bar[0], r.bar[1], r.bar[2]], .016, dark), tube(head, [0, r.bar[1], r.bar[2] - .02], .016, dark),
    tint(new THREE.SphereGeometry(.105, 10, 8).translate(...r.head), skin),
    tint(new THREE.SphereGeometry(.04, 6, 4).translate(-r.bar[0], r.bar[1] + .02, r.bar[2]), skin), tint(new THREE.SphereGeometry(.04, 6, 4).translate(r.bar[0], r.bar[1] + .02, r.bar[2]), skin)]);
  // Kit (coloured per rider): torso, arms, and a helmet (sport) or hair (city).
  const helmet = kind === 'sport' ? tint(new THREE.SphereGeometry(.125, 10, 6, 0, Math.PI * 2, 0, Math.PI * .55).scale(1, .9, 1.25).translate(r.head[0], r.head[1] + .02, r.head[2] - .02), white)
    : tint(new THREE.SphereGeometry(.112, 10, 6, 0, Math.PI * 2, 0, Math.PI * .5).translate(r.head[0], r.head[1] + .02, r.head[2] - .01), 0x2a2420);
  const kit = mergeGeometries([limb(r.hip, r.shoulder, .15, white), limb([-.18, r.shoulder[1], r.shoulder[2]], [.18, r.shoulder[1], r.shoulder[2]], .07, white),
    limb([-.19, r.shoulder[1] - .02, r.shoulder[2]], [-r.bar[0], r.bar[1] + .03, r.bar[2] - .04], .05, white),
    limb([.19, r.shoulder[1] - .02, r.shoulder[2]], [r.bar[0], r.bar[1] + .03, r.bar[2] - .04], .05, white), helmet]);
  return {frame, fixed, kit};
}
/** A leg segment: a capsule from the origin down to (0, -1, 0); each instance turns and stretches it. */
const segment = r => new THREE.CapsuleGeometry(r, 1, 3, 8).translate(0, -.5, 0);

/** Riders for a world: on its paths.json `rides`; null where there are none. */
export async function createWorldCyclists({world}) {
  const data = await fetch(`/scenes/${world.id}/paths.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!data?.rides?.length) return null;
  const ways = data.rides.map((flat, index) => {
    const pts = [];
    for (let i = 0; i < flat.length; i += 2) pts.push([flat[i], flat[i + 1]]);
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
    return {pts, cum, length: cum.at(-1), index, box: [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]};
  });
  const km = ways.reduce((a, w) => a + w.length, 0) / 1000;

  const toon = () => new THREE.MeshToonMaterial({color: 0xffffff, gradientMap: world.bands || null, vertexColors: true});
  const mk = (g, n) => { const m = new THREE.InstancedMesh(g, toon(), n); m.name = 'Cyclists'; m.frustumCulled = false; m.count = 0; m.castShadow = true;
    for (let i = 0; i < n; i++) m.setColorAt(i, new THREE.Color(0xffffff)); world.scene.add(m); return m; };
  const meshes = {};
  for (const kind of Object.keys(KINDS)) { const g = model(kind); meshes[kind] = {frame: mk(g.frame, CAP), fixed: mk(g.fixed, CAP), kit: mk(g.kit, CAP), n: 0}; }
  const thighs = mk(tint(segment(.075), 0xffffff), CAP * 2), shins = mk(tint(segment(.06), 0xffffff), CAP * 2);
  let legs = 0;
  // Sport kit in a club's bright colours; city riders in everyday coats. Road bikes in their usual
  // paints; the shared bikes in Hellobike blue, Meituan yellow and Qingju green.
  const rgb = list => list.map(c => new THREE.Color(c).toArray());
  const JERSEY = rgb([0xd8402a, 0x1f6fc0, 0xf2c230, 0x2a9a6a, 0xf0eee8, 0x222428, 0xe86a9a, 0x3ab0d8]);
  const COAT = rgb([0x2f3a4f, 0x3a3a3e, 0x8a8f96, 0xd9d2c4, 0x9a4036, 0x56755a, 0xc98a3a]);
  const ROAD = rgb([0xf0eee8, 0x222428, 0xc8302a, 0x1f4f9a, 0x9aa0a8]), SHARED = rgb([0x2f7fe0, 0xf2c230, 0x3aa86a]);
  const SHORTS = rgb([0x1d1f22]), TROUSERS = rgb([0x23283a, 0x2a2a2c, 0x3d4a66, 0x5a5048]);

  // Matrices straight into the buffers: R_y(yaw) about the bike, then (for a leg) a move to the hip
  // or knee, a turn about x and a stretch along y.
  const put = (arr, i, c, s, sc, x, y, z) => { const o = i * 16;
    arr[o] = c * sc; arr[o + 1] = 0; arr[o + 2] = -s * sc; arr[o + 3] = 0; arr[o + 4] = 0; arr[o + 5] = sc; arr[o + 6] = 0; arr[o + 7] = 0;
    arr[o + 8] = s * sc; arr[o + 9] = 0; arr[o + 10] = c * sc; arr[o + 11] = 0; arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1; };
  /** A segment from A to B in bike-local (y, z) at side ax: R_y(yaw) [T(A) R_x(t) S(1, L, 1)], scaled. */
  const seg = (arr, i, c, s, sc, x, y, z, ax, ay, az, by, bz) => {
    const dy = by - ay, dz = bz - az, L = Math.hypot(dy, dz) || 1e-3, ct = -dy / L, st = -dz / L, o = i * 16;
    arr[o] = c * sc; arr[o + 1] = 0; arr[o + 2] = -s * sc; arr[o + 3] = 0;
    arr[o + 4] = s * st * L * sc; arr[o + 5] = ct * L * sc; arr[o + 6] = c * st * L * sc; arr[o + 7] = 0;
    arr[o + 8] = s * ct * sc; arr[o + 9] = -st * sc; arr[o + 10] = c * ct * sc; arr[o + 11] = 0;
    arr[o + 12] = x + (c * ax + s * az) * sc; arr[o + 13] = y + ay * sc; arr[o + 14] = z + (-s * ax + c * az) * sc; arr[o + 15] = 1; };
  /** One leg: hip to knee to pedal, the knee forward, in bike-local (y, z). */
  function leg(c, s, sc, x, y, z, side, hip, phase) {
    const py = BB[1] + Math.cos(phase) * CRANK, pz = BB[2] + Math.sin(phase) * CRANK;
    const vy = py - hip[1], vz = pz - hip[2], d = Math.min(THIGH + SHIN - .001, Math.hypot(vy, vz)), a = d / 2, h = Math.sqrt(Math.max(0, THIGH * THIGH - a * a));
    const my = hip[1] + vy / 2, mz = hip[2] + vz / 2, ky = my + vz / d * h, kz = mz - vy / d * h;
    seg(thighs.instanceMatrix.array, legs, c, s, sc, x, y, z, side, hip[1], hip[2], ky, kz);
    seg(shins.instanceMatrix.array, legs, c, s, sc, x, y, z, side, ky, kz, py, pz);
    legs++;
  }

  let near = [], lastAt = [Infinity, Infinity];
  const cyclists = {
    ways, km, stats: {riders: 0},
    /** Each frame: t in seconds, the clock's hour, the camera's position. */
    update(t, hour, eye) {
      if (Math.hypot(eye.x - lastAt[0], eye.z - lastAt[1]) > 40) {
        const r = RADIUS + 40;
        near = ways.filter(w => w.box[0] - r < eye.x && w.box[2] + r > eye.x && w.box[1] - r < eye.z && w.box[3] + r > eye.z);
        lastAt = [eye.x, eye.z];
      }
      for (const m of Object.values(meshes)) m.n = 0;
      legs = 0;
      const r2 = RADIUS * RADIUS, perKm = density(hour);
      // Riders a group, the mix's mean: groups are picked by share / size (teams average 5).
      const meanTeam = 1 / (KINDS.sport.share / 5 + KINDS.city.share / 1);
      for (const w of near) {
        // Groups on this way: its riders over the mean group; each group a kind, a size and a direction.
        const groups = Math.round(perKm * w.length / 1000 / meanTeam + hash(w.index, 3)), seed = w.index * 11;
        const loop = w.length + 2 * FADE + 7 * GAP;
        for (let i = 0; i < groups; i++) {
          const sport = hash(i, seed + 1) < KINDS.sport.share / (KINDS.sport.share + KINDS.city.share * 5), kind = sport ? 'sport' : 'city', K = KINDS[kind];
          const n = sport ? K.team[0] + Math.floor(hash(i, seed + 2) * (K.team[1] - K.team[0] + 1)) : 1;
          const v = K.kmh / 3.6 * (.9 + .2 * hash(i, seed + 3)), dir = hash(i, seed + 4) < .5 ? 1 : -1;
          const lead = (v * t + hash(i, seed + 5) * loop) % loop - FADE;
          for (let k = 0; k < n; k++) {
            const u = lead - k * GAP;
            const fade = Math.min(1, Math.max(0, Math.min(u + FADE, w.length + FADE - u) / FADE));
            if (fade <= 0) continue;
            const d = Math.max(0, Math.min(w.length, dir > 0 ? u : w.length - u));
            let lo = 0, hi = w.cum.length - 1;
            while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (w.cum[mid] <= d) lo = mid; else hi = mid; }
            const a = w.pts[lo], b = w.pts[hi], sl = w.cum[hi] - w.cum[lo] || 1, f = (d - w.cum[lo]) / sl;
            // Keep right of the way's middle (ours: 0.8 m), facing along it.
            const fx = (b[0] - a[0]) / sl * dir, fz = (b[1] - a[1]) / sl * dir, side = .8;
            const x = a[0] + (b[0] - a[0]) * f - fz * side, z = a[1] + (b[1] - a[1]) * f + fx * side;
            const dx = x - eye.x, dz = z - eye.z;
            if (dx * dx + dz * dz > r2) continue;
            const y = world.ground?.(x, z) ?? world.grid.height(x, z);
            if (y == null) continue;
            const M = meshes[kind];
            if (M.n >= CAP) continue;
            const id = i * 8 + k, sc = (.95 + .1 * hash(id, seed + 6)) * fade;
            for (const part of [M.frame, M.fixed, M.kit]) put(part.instanceMatrix.array, M.n, fz, fx, sc, x, y, z);
            M.frame.instanceColor.array.set((sport ? ROAD : SHARED)[Math.floor(hash(sport ? i : id, seed + 7) * (sport ? ROAD : SHARED).length)], M.n * 3);
            // A team rides in its club's colours.
            M.kit.instanceColor.array.set(sport ? JERSEY[Math.floor(hash(i, seed + 8) * JERSEY.length)] : COAT[Math.floor(hash(id, seed + 9) * COAT.length)], M.n * 3);
            M.n++;
            // Pedalling: the crank turns once for every 2.5 (road) or 1.8 (shared bike) turns of the wheel.
            const crank = u / (2.1 * (sport ? 2.5 : 1.8)) * 6.283 + hash(id, seed + 10) * 6.283, trouser = sport ? SHORTS[0] : TROUSERS[Math.floor(hash(id, seed + 11) * TROUSERS.length)];
            const hip = RIG[kind].hip;
            if (legs < CAP * 2 - 1) {
              thighs.instanceColor.array.set(trouser, legs * 3); shins.instanceColor.array.set(trouser, legs * 3); leg(fz, fx, sc, x, y, z, -.1, hip, crank);
              thighs.instanceColor.array.set(trouser, legs * 3); shins.instanceColor.array.set(trouser, legs * 3); leg(fz, fx, sc, x, y, z, .1, hip, crank + Math.PI);
            }
          }
        }
      }
      let n = 0;
      for (const M of Object.values(meshes)) { for (const part of [M.frame, M.fixed, M.kit]) { part.count = M.n; part.instanceMatrix.needsUpdate = true; part.instanceColor.needsUpdate = true; } n += M.n; }
      for (const m of [thighs, shins]) { m.count = legs; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; }
      cyclists.stats = {riders: n, sport: meshes.sport.n, city: meshes.city.n};
    },
    /** Where each drawn rider is and which way it faces, for the audit: [kind, x, y, z, fx, fz]. */
    positions() {
      const out = [], p = new THREE.Vector3(), M4 = new THREE.Matrix4();
      for (const [kind, M] of Object.entries(meshes)) for (let i = 0; i < M.n; i++) { M.frame.getMatrixAt(i, M4); p.setFromMatrixPosition(M4); const e = M4.elements, l = Math.hypot(e[8], e[10]) || 1; out.push([kind, p.x, p.y, p.z, e[8] / l, e[10] / l]); }
      return out;
    },
  };
  return cyclists;
}
