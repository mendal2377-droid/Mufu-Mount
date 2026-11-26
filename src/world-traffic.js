import * as THREE from 'three';
import {BODY_TYPES, carModel, bikeModel, loadCarModels} from './traffic-models.js';
import {Lane, CYCLE, STOP_BACK, aspect} from './traffic-sim.js';

// Cars and e-bikes on the city's roads (item 44, step 4, slice 1; design/STREET-LIFE-PLAN.md, where
// every number below has its source or is marked as ours). The roads are OSM's drivable surface ways
// (public/scenes/core/streets.json, from tools/street-ways.py).
//
// Each lane is simulated (src/traffic-sim.js): vehicles follow the one ahead, stop at red lights at the
// signal junctions (streets.json: OSM's mapped signals and the crossings of main roads, our rule) and
// in the queues behind them, and at a way's end turn into a street that leaves the same point. Cars
// arrive at the lanes' ends at the hour's flow. Only the ways near the camera are simulated, and only
// the vehicles within RADIUS drawn. Not modelled: lane changes, overtaking, turns across traffic
// waiting for a gap, pedestrians, parking.

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
// The owner's choice (23 Nov, "less traffic"): a calmer street than the counts. Cars at 45 % of the
// counted flow, e-bikes at 35 %; the counts above stay as they are, so the street can be made busier
// again by raising these.
export const CALM = {car: .45, bike: .35};
/** Metres between vehicles in one lane: speed / (flow per lane, as drawn). */
export function spacing(kind, hour, lanes, bike = false) {
  const q = flow(kind, hour) * (bike ? EBIKES[base(kind)] * CALM.bike : CALM.car) / (bike ? 1 : lanes);
  return q > 0 ? speed(kind, hour, bike) * 1000 / q : Infinity;
}

function hash(i, seed) {
  let h = Math.imul(i ^ seed, 2654435761) ^ (seed >>> 7);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

/** One way's geometry: points, cumulative lengths, bounding box. */
const at0 = {x: 0, z: 0, yaw: 0};
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
  // Only roads the world built as carriageway: OSM maps roads over Purple Mountain's slopes and the
  // scenic area's paths that the world has as grass, stairs or paving, and cars and e-bikes were drawn
  // on the hillside there (the owner, 27 Nov). A way is kept when carriageway lies within 3 m of its
  // line at 70 % of points 4 m apart.
  const roadNear = (x, z) => world.grid.road(x, z) != null || world.grid.road(x + 3, z) != null || world.grid.road(x - 3, z) != null
    || world.grid.road(x, z + 3) != null || world.grid.road(x, z - 3) != null;
  const allWays = data.ways.map(wayOf);
  const ways = allWays.filter(w => {
    let n = 0, ok = 0;
    for (let s = 0; s <= w.length; s += 4) { along(w, s, 1, 0, at0); n++; if (roadNear(at0.x, at0.z)) ok++; }
    return ok >= n * .7;
  });
  ways.forEach((w, i) => { w.index = i; });
  console.info(`Traffic: ${ways.length} of ${allWays.length} mapped roads built as carriageway`);

  // Toon shading in the city's own bands (as the buildings), so the traffic sits in the painted scene.
  const toon = (c, vertexColors = false) => new THREE.MeshToonMaterial({color: c, gradientMap: world.bands || null, vertexColors});
  // One set of instanced meshes per body type (src/traffic-models.js): its paint, trim and plates.
  // Kenney's cars, stretched to real sizes; the generated ones if they fail to load (or, for comparing
  // the two, when localStorage 'mufu-cars' is 'own').
  let own = false;
  try { own = localStorage.getItem('mufu-cars') === 'own'; } catch { /* storage blocked: Kenney's */ }
  const kenney = own ? null : await loadCarModels().catch(e => { console.warn('Car models did not load; drawing the generated ones.', e); return null; });
  const kinds = BODY_TYPES.map(([name, share]) => {
    const m = kenney?.[name] || carModel(name);
    const k = {name, share, paint: new THREE.InstancedMesh(m.paint, toon(0xffffff), CAR_CAP), trim: new THREE.InstancedMesh(m.trim, toon(0xffffff, true), CAR_CAP),
      plates: new THREE.InstancedMesh(m.plates, toon(0xffffff), CAR_CAP), n: 0};
    k.meshes = [k.paint, k.trim, k.plates];
    return k;
  });
  const shareSum = kinds.reduce((a, k) => a + k.share, 0);
  const bike = bikeModel();
  const bikes = new THREE.InstancedMesh(bike.shell, toon(0xffffff), BIKE_CAP);
  const bikeTrim = new THREE.InstancedMesh(bike.trim, toon(0xffffff, true), BIKE_CAP);
  const riders = new THREE.InstancedMesh(bike.coat, toon(0xffffff), BIKE_CAP);
  const helmets = new THREE.InstancedMesh(bike.helmet, toon(0xffffff), BIKE_CAP);
  const boxes = new THREE.InstancedMesh(bike.box, toon(0xffffff), BIKE_CAP);
  const colored = [...kinds.flatMap(k => [k.paint, k.plates]), bikes, riders, helmets, boxes];
  // Colours set on every instance before the first draw, so each shader is built with them.
  for (const m of colored) for (let i = 0; i < m.instanceMatrix.count; i++) m.setColorAt(i, new THREE.Color(0xffffff));
  const bikeMeshes = [bikes, bikeTrim, riders, helmets], meshes = [...kinds.flatMap(k => k.meshes), ...bikeMeshes, boxes];
  for (const m of meshes) { m.name = 'Street traffic'; m.frustumCulled = false; m.count = 0; world.scene.add(m); }
  const paint = [], color = new THREE.Color();
  for (const [n, c] of PAINT) for (let i = 0; i < n; i++) paint.push(c);
  const coats = [0x3b5e8c, 0x3a3a3e, 0x9a4036, 0xd9d2c4, 0x56755a, 0x7a7a84, 0xc98a3a], hats = [0xf2c230, 0xeeece6, 0x2f6fc0, 0xd84a3a, 0xe58aa0];
  // E-bike bodies: white, black, red, blue, pink, mint (our reading of street photographs; no count found).
  const shells = [0xf0eee8, 0x34373b, 0xb8433a, 0x3d64a8, 0xe9a3b4, 0x8fcfbf];
  // Plates: blue, or green for a new-energy car: 12 % of China's cars at the end of 2025 (Ministry of
  // Public Security; Nanjing's own share is not published).
  const PLATE_BLUE = 0x2457b8, PLATE_GREEN = 0x6cc48c, GREEN_SHARE = .12;
  // Delivery riders, their box and jacket in the platform's colour: Meituan yellow, Ele.me blue, two to
  // one. Their share of the e-bikes is ours (no count for Nanjing found): one in eight.
  const DELIVERY = .125, MEITUAN = [0xf3c22f, 0xf3c22f], ELEME = [0x1f8bdc, 0x1f8bdc];

  /** The body type of car `id` (a stable hash), weighted by the shares. */
  function kindOf(id) {
    let r = id * shareSum;
    for (const k of kinds) { if ((r -= k.share) < 0) return k; }
    return kinds[0];
  }
  function drawCar(id, y) {
    const k = kindOf(hash(id, 5));
    if (k.n >= CAR_CAP) return false;
    place(k.meshes, k.n, y);
    // Vans are mostly white (ours).
    const c = k.name === 'van' && hash(id, 3) < .7 ? 0xf1efe8 : paint[Math.floor(hash(id, 3) * paint.length)];
    k.paint.setColorAt(k.n, color.setHex(c));
    k.plates.setColorAt(k.n, color.setHex(hash(id, 13) < GREEN_SHARE ? PLATE_GREEN : PLATE_BLUE));
    k.n++;
    return true;
  }
  let nd = 0;
  function drawBike(id, y, nb) {
    place(bikeMeshes, nb, y);
    const job = hash(id, 15), delivery = job < DELIVERY, brand = job < DELIVERY * 2 / 3 ? MEITUAN : ELEME;
    bikes.setColorAt(nb, color.setHex(shells[Math.floor(hash(id, 11) * shells.length)]));
    riders.setColorAt(nb, color.setHex(delivery ? brand[0] : coats[Math.floor(hash(id, 7) * coats.length)]));
    helmets.setColorAt(nb, color.setHex(delivery ? brand[1] : hats[Math.floor(hash(id, 9) * hats.length)]));
    if (delivery && nd < BIKE_CAP) { place([boxes], nd, y); boxes.setColorAt(nd, color.setHex(brand[0])); nd++; }
  }

  const at = {x: 0, z: 0, yaw: 0};

  // --- The road graph: signal stops along each way, and which streams leave each way's end ---------
  // A stream is (way, direction); its lanes are 0..per-1 for cars and `per` for e-bikes.
  const lights = (data.junctions || []).map(([x, z, mapped], i) => ({x, z, mapped, offset: hash(i, 77) * CYCLE}));
  const lightGrid = new Map();
  for (const j of lights) { const k = `${Math.floor(j.x / 50)},${Math.floor(j.z / 50)}`; (lightGrid.get(k) || lightGrid.set(k, []).get(k)).push(j); }
  // Junctions within 8 m of a way's line: [{s along the way, light, segment direction}].
  for (const w of ways) {
    w.lights = [];
    for (let i = 1; i < w.pts.length; i++) {
      const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], ux = bx - ax, uz = bz - az, L = Math.hypot(ux, uz) || 1;
      const seen = new Set();
      for (let gx = Math.floor((Math.min(ax, bx) - 8) / 50); gx <= Math.floor((Math.max(ax, bx) + 8) / 50); gx++)
        for (let gz = Math.floor((Math.min(az, bz) - 8) / 50); gz <= Math.floor((Math.max(az, bz) + 8) / 50); gz++)
          for (const j of lightGrid.get(`${gx},${gz}`) || []) {
            if (seen.has(j)) continue;
            seen.add(j);
            const k = ((j.x - ax) * ux + (j.z - az) * uz) / (L * L);
            if (k < 0 || k > 1) continue;
            if (Math.hypot(ax + ux * k - j.x, az + uz * k - j.z) < 8) w.lights.push({s: w.cum[i - 1] + k * L, j, ux: ux / L, uz: uz / L});
          }
    }
  }
  const nodeKey = (p) => `${Math.round(p[0] * 2)},${Math.round(p[1] * 2)}`;
  const starts = new Map();   // node -> streams that begin there
  for (const w of ways) for (const dir of w.oneway ? [w.oneway] : [1, -1]) {
    const k = nodeKey(dir > 0 ? w.pts[0] : w.pts.at(-1));
    (starts.get(k) || starts.set(k, []).get(k)).push({w, dir});
  }

  // --- The signal heads: one on each approach to a signal junction --------------------------------
  // A pole at the stop line on the kerb side, an arm over the road 6 m up, and a head of three lamps
  // side by side (the usual form on Nanjing's main roads) facing the drivers, lit as the simulation's
  // light. The pole's place is ours: at the stop line, 2.5 m beyond the outer lane.
  const heads = [];
  for (const w of ways) for (const l of w.lights) for (const dir of w.oneway ? [w.oneway] : [1, -1]) {
    const s = l.s - dir * STOP_BACK;
    if (s < 0 || s > w.length) continue;
    const out = (w.oneway ? w.per * LANE_W / 2 : w.per * LANE_W) + 2.5;
    heads.push({w, s, dir, out, arm: Math.max(2, out - (w.oneway ? 0 : 1.6) - LANE_W * .5), offset: l.j.offset, group: Math.abs(l.uz) >= Math.abs(l.ux) ? 0 : 1});
  }
  const HEAD_CAP = 700, POLE_H = 6;
  const poleMat = new THREE.MeshToonMaterial({color: 0x5d646b, gradientMap: world.bands || null});
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.11, .14, POLE_H, 8).translate(0, POLE_H / 2, 0), poleMat, HEAD_CAP);
  // The arm runs along local +x from the pole (the road side), unit length, scaled per head.
  const arms = new THREE.InstancedMesh(new THREE.BoxGeometry(1, .14, .14).translate(.5, POLE_H - .2, 0), poleMat, HEAD_CAP);
  const housings = new THREE.InstancedMesh(new THREE.BoxGeometry(1.15, .42, .3).translate(0, POLE_H - .55, 0), new THREE.MeshToonMaterial({color: 0x26292c, gradientMap: world.bands || null}), HEAD_CAP);
  const lampGeo = x => new THREE.CylinderGeometry(.14, .14, .06, 12).rotateX(Math.PI / 2).translate(x, POLE_H - .55, -.17);
  // Red, amber, green from the kerb side outwards; each lit or dark per head.
  const LAMPS = [[-.36, 0xff3b30, 0x4a1512], [0, 0xffb020, 0x4a3410], [.36, 0x35e06b, 0x123f22]];
  const lamps = LAMPS.map(([x]) => new THREE.InstancedMesh(lampGeo(x), new THREE.MeshBasicMaterial({color: 0xffffff}), HEAD_CAP));
  for (const m of lamps) for (let i = 0; i < HEAD_CAP; i++) m.setColorAt(i, new THREE.Color(0x222222));
  const signalMeshes = [poles, arms, housings, ...lamps];
  for (const m of signalMeshes) { m.name = 'Traffic lights'; m.frustumCulled = false; m.count = 0; world.scene.add(m); }
  const lampOn = LAMPS.map(([, on]) => new THREE.Color(on).toArray()), lampOff = LAMPS.map(([, , off]) => new THREE.Color(off).toArray());
  const hp = {x: 0, z: 0, yaw: 0}, HM = new THREE.Matrix4(), HQ = new THREE.Quaternion(), HE = new THREE.Euler(), HV = new THREE.Vector3(), HS = new THREE.Vector3();
  function drawHeads(t, eye) {
    let n = 0;
    const r2 = (RADIUS - 50) ** 2;
    for (const h of heads) {
      if (n >= HEAD_CAP) break;
      along(h.w, h.dir > 0 ? h.s : h.w.length - h.s, h.dir, 0, hp);
      const dx = hp.x - eye.x, dz = hp.z - eye.z;
      if (dx * dx + dz * dz > r2) continue;
      // The pole on the kerb side: right of travel is local -x.
      const c = Math.cos(hp.yaw), sn = Math.sin(hp.yaw), px = hp.x - c * h.out, pz = hp.z + sn * h.out;
      const y = world.ground(px, pz) ?? height(hp.x, hp.z);
      if (y == null) continue;
      HE.set(0, hp.yaw, 0); HQ.setFromEuler(HE);
      HM.compose(HV.set(px, y, pz), HQ, HS.set(1, 1, 1)); poles.setMatrixAt(n, HM);
      HM.compose(HV.set(px, y, pz), HQ, HS.set(h.arm, 1, 1)); arms.setMatrixAt(n, HM);
      HM.compose(HV.set(px + c * h.arm, y, pz - sn * h.arm), HQ, HS.set(1, 1, 1));
      housings.setMatrixAt(n, HM);
      const a = aspect(t, h.offset, h.group), lit = a === 'red' ? 0 : a === 'amber' ? 1 : 2;
      lamps.forEach((m, k) => { m.setMatrixAt(n, HM); m.instanceColor.array.set(k === lit ? lampOn[k] : lampOff[k], n * 3); });
      n++;
    }
    for (const m of signalMeshes) { m.count = n; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    return n;
  }

  // --- Lanes in the simulation: the ways near the camera --------------------------------------------
  const lanes = new Map();
  let nextId = 1, transfers = 0, lastT = null, lastHour = null, near = [], lastPick = -1e9, lastAt = [Infinity, Infinity];
  const newId = () => nextId++;
  const laneKey = (w, dir, lane) => `${w.index}:${dir}:${lane}`;
  const offsetOf = (w, lane) => {
    const bike = lane === w.per;
    // E-bikes on the carriageway's edge, just inside the kerb, as in Nanjing's non-motor lanes.
    return w.oneway ? (bike ? w.per * LANE_W / 2 + .5 : (lane - (w.per - 1) / 2) * LANE_W) : (bike ? w.per * LANE_W + .5 : (lane + .5) * LANE_W);
  };
  function makeLane(w, dir, lane, from, to, hour) {
    const bike = lane === w.per;
    if (!isFinite(spacing(w.kind, hour, w.per, bike))) return null;
    // Stop lines: STOP_BACK before each junction, in the lane's travel; the light's half of the cycle by
    // the lane's heading there (north-south one half, east-west the other).
    const stops = w.lights.map(l => {
      const at = (dir > 0 ? l.s : w.length - l.s) - STOP_BACK;
      return {at, offset: l.j.offset, group: Math.abs(l.uz) >= Math.abs(l.ux) ? 0 : 1};
    }).filter(st => st.at > 1).sort((p, q) => p.at - q.at);
    const ln = new Lane({length: w.length, v0: speed(w.kind, 3, bike) / 3.6, bike, stops, key: laneKey(w, dir, lane)});
    Object.assign(ln, {w, dir, lane, off: offsetOf(w, lane)});
    ln.from = from; ln.to = to;
    return ln;
  }
  // The ways within reach of (x, z) and the stretch of each to simulate: from 250 m before the first
  // point within reach (so vehicles arrive already moving) to 80 m past the last.
  function pick(x, z, hour) {
    const reach = RADIUS + 60, r2 = reach * reach, keep = new Set();
    near = [];
    for (const w of ways) {
      if (!(w.box[0] - reach < x && w.box[2] + reach > x && w.box[1] - reach < z && w.box[3] + reach > z)) continue;
      let lo = Infinity, hi = -Infinity;
      for (let j = 1; j < w.pts.length; j++) {
        const [ax, az] = w.pts[j - 1], [bx, bz] = w.pts[j], ux = bx - ax, uz = bz - az, L2 = ux * ux + uz * uz || 1;
        const k = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / L2)), px = ax + ux * k - x, pz = az + uz * k - z;
        if (px * px + pz * pz > r2) continue;
        lo = Math.min(lo, w.cum[j - 1]); hi = Math.max(hi, w.cum[j]);
      }
      if (lo > hi) continue;
      near.push(w);
      for (const dir of w.oneway ? [w.oneway] : [1, -1]) {
        const a = dir > 0 ? lo : w.length - hi, b = dir > 0 ? hi : w.length - lo;
        const from = Math.max(0, a - 250), to = Math.min(w.length, b + 80);
        for (let lane = 0; lane <= w.per; lane++) {
          const key = laneKey(w, dir, lane), bike = lane === w.per, gap = spacing(w.kind, hour, w.per, bike), v = speed(w.kind, hour, bike) / 3.6;
          let ln = lanes.get(key);
          if (!ln) {
            ln = makeLane(w, dir, lane, from, to, hour);
            if (!ln) continue;
            lanes.set(key, ln);
            ln.fill(from, to, gap, v, newId, clear(ln));
          } else {
            // The stretch moved with the camera: drop what left it, fill what it gained.
            const oa = ln.from, ob = ln.to;
            ln.from = from; ln.to = to;
            ln.vehicles = ln.vehicles.filter(q => q.s >= from && q.s <= to);
            if (from < oa) ln.fill(from, Math.min(oa, to), gap, v, newId, clear(ln));
            if (to > ob) ln.fill(Math.max(ob, from), to, gap, v, newId, clear(ln));
          }
          keep.add(key);
        }
      }
    }
    for (const key of [...lanes.keys()]) if (!keep.has(key)) lanes.delete(key);
    lastAt = [x, z];
  }

  // A vehicle at a lane's end: into a stream leaving the same point, straight on more often than
  // turning, never back the way it came. Returns false to wait (the lane it turns into is full).
  const pos = {x: 0, z: 0, yaw: 0}, pos2 = {x: 0, z: 0, yaw: 0};
  function leave(ln, q) {
    if (ln.to < ln.length - .5) return true;            // the end of the stretch, out of sight: gone
    const end = ln.dir > 0 ? ln.w.pts.at(-1) : ln.w.pts[0];
    along(ln.w, ln.length - .01, ln.dir, ln.off, pos);
    const options = [];
    for (const st of starts.get(nodeKey(end)) || []) {
      if (st.w === ln.w) continue;
      let cands;
      if (ln.bike) { const b = lanes.get(laneKey(st.w, st.dir, st.w.per)); cands = b && b.from === 0 ? [b] : []; }
      else { cands = []; for (let l = 0; l < st.w.per; l++) { const t = lanes.get(laneKey(st.w, st.dir, l)); if (t && t.from === 0) cands.push(t); } }
      if (!cands.length) continue;
      along(st.w, .5, st.dir, 0, pos2);
      const turn = Math.abs(Math.atan2(Math.sin(pos2.yaw - pos.yaw), Math.cos(pos2.yaw - pos.yaw)));
      options.push({cands, weight: turn < .5 ? 3 : turn < 2.2 ? 1 : .2});
    }
    if (!options.length) return true;                    // a dead end or the edge of the map: gone
    let r = hash(q.id, transfers + 31) * options.reduce((a, o) => a + o.weight, 0), chosen = options[0];
    for (const o of options) { if ((r -= o.weight) < 0) { chosen = o; break; } }
    const target = chosen.cands[Math.floor(hash(q.id, 41) * chosen.cands.length)];
    if (!target.entryFree()) return false;
    // Not into a lane whose start lies against the visitor's taxi, closer to it than the vehicle is now: it
    // would land on it, and waits. One moving away from the taxi goes on (the car in front of a waiting
    // taxi, held so, held the taxi for good).
    const ob = traffic.obstacle;
    if (ob) { along(target.w, 0, target.dir, target.off, pos2);
      if (margin(ob, pos2.x, pos2.z, ln.bike) < 1.5 && Math.hypot(pos2.x - ob.x, pos2.z - ob.z) < Math.hypot(pos.x - ob.x, pos.z - ob.z)) return false; }
    // Carry the vehicle across, keeping where it was drawn: the difference fades over its first metres.
    along(target.w, 0, target.dir, target.off, pos2);
    q.dx = pos.x - pos2.x; q.dz = pos.z - pos2.z; q.dyaw = Math.atan2(Math.sin(pos.yaw - pos2.yaw), Math.cos(pos.yaw - pos2.yaw)); q.fade = 1;
    q.s = 0; q.wait = false;
    target.vehicles.push(q);
    transfers++;
    return true;
  }

  // The road's own height first: the road surfaces lie 0.3-0.4 m over the ground (blender/build_core.py,
  // settle_roads), and a car set on the ground sank to its axles. As the buses (src/transit.js).
  const height = (x, z) => world.grid.road(x, z) ?? world.ground(x, z) ?? world.grid.height(x, z);
  // Each street's own height along its middle, every 4 m. The walk grid holds one surface a cell, the
  // topmost: under an elevated road it is the deck's, and vehicles on the street below rode up onto it
  // (23 Nov). A sample standing over 1.5 m above the median of its neighbours is a deck overhead; those,
  // and samples with no road at all, are bridged from the street's height on either side.
  const STEP = 4, mid = {x: 0, z: 0, yaw: 0};
  function profile(w) {
    if (w.prof) return w.prof;
    const n = Math.ceil(w.length / STEP) + 1, h = new Array(n);
    for (let i = 0; i < n; i++) {
      along(w, Math.min(i * STEP, w.length), 1, 0, mid);
      h[i] = world.grid.road(mid.x, mid.z) ?? world.grid.road(mid.x + 2, mid.z) ?? world.grid.road(mid.x - 2, mid.z) ?? world.grid.road(mid.x, mid.z + 2) ?? world.grid.road(mid.x, mid.z - 2) ?? world.ground(mid.x, mid.z);
    }
    const ok = h.map((v, i) => {
      if (v == null) return false;
      const around = h.slice(Math.max(0, i - 6), i + 7).filter(x => x != null).sort((a, b) => a - b);
      return v - around[Math.floor(around.length / 2)] <= 1.5;
    });
    const out = h.slice();
    for (let i = 0; i < n; i++) {
      if (ok[i]) continue;
      let a = i - 1, b = i + 1;
      while (a >= 0 && !ok[a]) a--;
      while (b < n && !ok[b]) b++;
      out[i] = a >= 0 && b < n ? h[a] + (h[b] - h[a]) * (i - a) / (b - a) : a >= 0 ? h[a] : b < n ? h[b] : null;
    }
    return (w.prof = out);
  }
  /** A vehicle's height: the surface under it where that agrees with its street's profile, else the profile. */
  function vehicleHeight(w, s, dir, x, z) {
    const prof = profile(w), d = dir > 0 ? s : w.length - s, f = d / STEP, i = Math.min(prof.length - 1, Math.floor(f));
    const a = prof[i], b = prof[Math.min(prof.length - 1, i + 1)];
    const p = a == null ? b : b == null ? a : a + (b - a) * (f - i);
    // The road right under the vehicle where it agrees with the profile, else the profile (a deck
    // overhead, or past the road's edge). Never the ground beside the road: past the kerb it can be the
    // top of a planter or a podium, and an e-bike rode 3.5 m up in the air there (23 Nov).
    const r = world.grid.road(x, z);
    if (p == null) return r ?? height(x, z);
    if (r != null) return Math.abs(r - p) < .8 ? r : p;
    // No road cell under it (an e-bike at the kerb, off the stamped road): the pavement when it lies
    // within a metre below the line's height, never above it (a planter's top is above). An e-bike stood
    // 0.7 m over the road on the line's height there (27 Nov).
    const g = height(x, z);
    return g != null && g <= p && p - g < 1 ? g : p;
  }
  // A vehicle's matrix (a turn about y and a move) written straight into each of its meshes: composing
  // it through an Object3D for each of an e-bike's four meshes tripled the frame's cost.
  const M = new Float32Array(16);
  function place(list, i, y) {
    const c = Math.cos(at.yaw), s = Math.sin(at.yaw);
    M[0] = c; M[2] = -s; M[5] = 1; M[8] = s; M[10] = c; M[12] = at.x; M[13] = y; M[14] = at.z; M[15] = 1;
    for (const mesh of list) mesh.instanceMatrix.array.set(M, i * 16);
  }

  // The visitor's taxi (src/world-taxi.js sets traffic.obstacle = {x, z, v, heading}, or null): each
  // lane it stands in follows it like a car. A lane holds it where the lane's own line passes within
  // 2 m of the taxi's middle, nose or tail; its speed along the lane is the taxi's, never below nought.
  const near2 = {x: 0, z: 0, yaw: 0}, at3 = {x: 0, z: 0, yaw: 0};
  // No car is placed within 25 m of the taxi when a stretch of road fills: one appeared on it (build of 26 Nov).
  const at4 = {x: 0, z: 0, yaw: 0};
  const clear = (ln) => (s) => { const ob = traffic.obstacle; if (!ob) return true; along(ln.w, Math.min(s, ln.length), ln.dir, ln.off, at4); return Math.hypot(at4.x - ob.x, at4.z - ob.z) > 25; };
  // And whatever the lanes say, a car or an e-bike that would come within a metre of the taxi's
  // outline, closing on it, holds still this step (q.held, src/traffic-sim.js); one moving away goes on.
  function margin(ob, x, z, bike) {
    const fx = Math.sin(ob.heading), fz = Math.cos(ob.heading), dx = x - ob.x, dz = z - ob.z;
    const fw = Math.abs(dx * fx + dz * fz) - (2.33 + (bike ? .9 : 2.33)), lat = Math.abs(dx * fz - dz * fx) - (.9 + (bike ? .35 : .9));
    return Math.max(fw, lat);
  }
  let blocked = false;
  function blocks() {
    const ob = traffic.obstacle;
    // Nothing to undo and no taxi: no work (the traffic's frame stays as cheap as before the taxi).
    if (!ob && !blocked) return;
    blocked = !!ob;
    for (const ln of lanes.values()) {
      ln.block = null;
      for (const q of ln.vehicles) q.held = false;
      if (!ob) continue;
      const [bx0, bz0, bx1, bz1] = ln.w.box;
      if (ob.x > bx0 - 20 && ob.x < bx1 + 20 && ob.z > bz0 - 20 && ob.z < bz1 + 20) for (const q of ln.vehicles) {
        along(ln.w, Math.min(q.s, ln.length), ln.dir, ln.off, at3);
        const x = at3.x + q.dx, z = at3.z + q.dz;
        if (Math.abs(x - ob.x) > 12 || Math.abs(z - ob.z) > 12) continue;
        const m = margin(ob, x, z, ln.bike);
        if (m > 1) continue;
        const step = Math.max(.3, q.v * .1), m2 = margin(ob, x + Math.sin(at3.yaw) * step, z + Math.cos(at3.yaw) * step, ln.bike);
        if (m2 < m) q.held = true;
      }
      const w = ln.w, [x0, z0, x1, z1] = w.box;
      if (ob.x < x0 - 8 || ob.x > x1 + 8 || ob.z < z0 - 8 || ob.z > z1 + 8) continue;
      // The taxi's middle, nose and tail: each point of the way nearest one, in metres along the way.
      // The lane holds the taxi from the first of them its line passes within 2 m of: a lane
      // crossing a junction in front of the taxi stops short of its nose.
      // And where its nose will be in 1.2 s: a car about to turn into the street just ahead of a moving
      // taxi waits for it to pass (the taxi could not stop for one turning in 4 m in front of it).
      const fx = Math.sin(ob.heading), fz = Math.cos(ob.heading);
      for (const k of ob.v > 1 ? [0, 2.3, -2.3, 2.3 + ob.v * 1.2] : [0, 2.3, -2.3]) {
        const px = ob.x + fx * k, pz = ob.z + fz * k;
        let best = Infinity, sw = 0;
        for (let i = 1; i < w.pts.length; i++) {
          const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i], ux = bx - ax, uz = bz - az, L2 = ux * ux + uz * uz || 1;
          const q = Math.max(0, Math.min(1, ((px - ax) * ux + (pz - az) * uz) / L2));
          const d = Math.hypot(ax + ux * q - px, az + uz * q - pz);
          if (d < best) { best = d; sw = w.cum[i - 1] + q * Math.sqrt(L2); }
        }
        if (best > 12) continue;
        const s = ln.dir > 0 ? sw : w.length - sw;
        along(w, Math.min(s, ln.length), ln.dir, ln.off, near2);
        if (Math.hypot(near2.x - px, near2.z - pz) > 2) continue;
        // A taxi standing still is waited for only along its own road: crossing traffic goes on past
        // its nose (a crossing car stopped for a stopped taxi, and the taxi for it, for good).
        if (ob.v < 1 && Math.abs(Math.cos(ob.heading - near2.yaw)) < .7) continue;
        if (!ln.block || s < ln.block.s) ln.block = {s, v: Math.max(0, ob.v * Math.cos(ob.heading - near2.yaw))};
      }
    }
  }

  const traffic = {
    obstacle: null,
    ways, lights, heads, get near() { return near; }, get lanes() { return lanes; }, get transfers() { return transfers; },
    stats: {cars: 0, bikes: 0},
    /** Each frame: t in seconds, the clock's hour, the camera's position. */
    update(t, hour, eye) {
      // A jump of the clock (the time slider) starts the streets again at the new hour's numbers;
      // the clock's own running changes them through the arrivals.
      const jump = lastHour == null ? 0 : (((hour - lastHour) % 24) + 24) % 24;
      if (Math.min(jump, 24 - jump) > .25) { lanes.clear(); lastPick = -1e9; }
      lastHour = hour;
      if (Math.hypot(eye.x - lastAt[0], eye.z - lastAt[1]) > 60 || t - lastPick > 5) { pick(eye.x, eye.z, hour); lastPick = t; }
      // Simulate in steps of at most 0.1 s; a jump of the clock (a test, a pause) is not driven through.
      let dt = lastT == null ? 0 : t - lastT;
      lastT = t;
      if (dt < 0 || dt > 2) dt = 0;
      blocks();
      for (let left = dt; left > 1e-6;) {
        const h = Math.min(.1, left);
        left -= h;
        const now = t - left;
        for (const ln of lanes.values()) {
          ln.step(now, h, q => leave(ln, q));
          // Arrivals at the stretch's start at the hour's flow, while the lane holds fewer than it should.
          const gap = spacing(ln.w.kind, hour, ln.w.per, ln.bike), v = speed(ln.w.kind, hour, ln.bike) / 3.6;
          if (isFinite(gap) && ln.vehicles.length < (ln.to - ln.from) / gap * 1.1 && ln.entryFree() && Math.random() < v / gap * h)
            ln.vehicles.push({s: ln.from, v: Math.min(v, ln.vehicles.at(-1)?.v ?? v), id: newId(), dx: 0, dz: 0, dyaw: 0});
        }
      }
      // Draw what is within RADIUS.
      let nc = 0, nb = 0;
      for (const k of kinds) k.n = 0;
      nd = 0;
      const r2 = RADIUS * RADIUS;
      for (const ln of lanes.values()) for (const q of ln.vehicles) {
        along(ln.w, Math.min(q.s, ln.length), ln.dir, ln.off, at);
        at.x += q.dx; at.z += q.dz; at.yaw += q.dyaw;
        const dx = at.x - eye.x, dz = at.z - eye.z;
        if (dx * dx + dz * dz > r2) continue;
        const y = vehicleHeight(ln.w, Math.min(q.s, ln.length), ln.dir, at.x, at.z);
        if (y == null) continue;
        // Over a stretch the world did not build as road (a kept way is 70 % carriageway): not drawn there.
        if (!roadNear(at.x, at.z)) continue;
        if (ln.bike) { if (nb < BIKE_CAP) { drawBike(q.id, y, nb); nb++; } }
        else if (drawCar(q.id, y)) nc++;
      }
      for (const k of kinds) for (const m of k.meshes) m.count = k.n;
      bikes.count = bikeTrim.count = riders.count = helmets.count = nb; boxes.count = nd;
      for (const m of meshes) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
      const signals = drawHeads(t, eye);
      traffic.stats = {cars: nc, bikes: nb, delivery: nd, kinds: Object.fromEntries(kinds.map(k => [k.name, k.n])), lanes: lanes.size, transfers, signals};
    },
    /** Where each drawn car and e-bike stands, for the audit (tests/traffic-browser.mjs). */
    positions() {
      const out = [], m = new THREE.Matrix4(), p = new THREE.Vector3();
      for (const [mesh, kind] of [...kinds.map(k => [k.paint, 'car']), [bikes, 'bike']]) for (let i = 0; i < mesh.count; i++) { mesh.getMatrixAt(i, m); p.setFromMatrixPosition(m); out.push([kind, p.x, p.y, p.z]); }
      return out;
    },
  };
  return traffic;
}
