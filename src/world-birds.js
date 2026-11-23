import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Birds in the city (item 44, step 4, slice 3; design/STREET-LIFE-PLAN.md, "Birds").
//
// Land birds: a winter survey of 40 of Beijing's green spaces walked 1 to 1.5 km an hour and counted
// every bird within 25 m either side (Sun et al. 2016, Scientia Silvae Sinicae 52(5)): 164 birds an
// hour, 137 of them land birds. That strip is 5 to 7.5 hectares an hour, so about 22 land birds a
// hectare of green, the only per-area figure found for a Chinese city's parks. Nanjing's commonest
// are the tree sparrow, the light-vented bulbul, the Chinese blackbird and the spotted dove, its
// "four guardians" of the city (Xinhua Daily), with magpies; azure-winged magpies, common in the
// Beijing survey, are ours. The shares and group sizes below are ours. Each group feeds on the ground or sits in a crown, takes off for
// the trees when the walker comes too close, and settles again; all roost unseen at night.
//
// Flights: night herons feed by night and rest by day, so from 17:00 they leave Heping Gate's reeds
// one by one to feed along the lake's shores, and come back from 5:30 (the windows and their 1.5 hours
// are ours). Cormorants gather in their hundreds at dusk on Qianzhou island in the Yangtze's Jiajiang
// channel (Yangtse Evening Post, November 2025); that Xuanwu Lake's come and go from there, arriving in
// lines from 7:00 and leaving from 16:00, is ours. The clock stands still unless someone moves it, so
// each window is a stream: the birds whose turn it is at the clock's hour are in the air, flying at
// their real speed.
//
// Xuanwu Lake in winter (xuanwuhu.net, Yangtse Evening Post, Modern Express), each where it was seen:
// over 200 mandarin ducks off Heping Gate (the old Shence Gate) in November, about 100 in February;
// coots off the north shore, over a hundred by day and some hundreds at dusk; 30 to 40 cormorants by
// the music fountain at Nanjing Station; a hundred and more night herons in Heping Gate's reeds in
// January (resident all year). Mallards: no count, ours. Migrants come from late October, mass in
// late November and leave by late March.

// --- Land birds -------------------------------------------------------------------------------------
export const PER_HA = 137 / ((1 + 1.5) / 2 * .05 * 100);   // birds an hour / hectares walked an hour: ~22
// [name, share of the birds (ours), group (ours), share of time on the ground (ours), length m, flight
//  distance m (ours)]
export const LAND = [
  ['sparrow', .35, 6, .7, .14, 4],
  ['bulbul', .25, 3, .1, .19, 5],
  ['blackbird', .15, 1, .8, .28, 6],
  ['dove', .10, 2, .7, .30, 5],
  ['magpie', .08, 2, .5, .45, 9],
  ['azure', .07, 6, .3, .36, 7],
];
// The day (ours): the survey counted from sunrise to 10:00 and from 16:00 to sunset, the busy hours.
export const ACTIVE = [0, 0, 0, 0, 0, 0, .5, 1, 1, 1, .8, .6, .6, .6, .6, .8, 1, 1, .5, 0, 0, 0, 0, 0];
const CELL = 20, LAND_R = 120;
/** Mean group size for the species mix, given that each species comes in its own group size. */
export const MEAN_GROUP = 1 / LAND.reduce((a, s) => a + s[1] / s[2], 0);
const at = (day, hour) => { const h = ((hour - .5) % 24 + 24) % 24, i = Math.floor(h), f = h - i; return day[i] * (1 - f) + day[(i + 1) % 24] * f; };
/** Land birds a hectare of green at this hour. */
export const landDensity = hour => PER_HA * at(ACTIVE, hour);

// --- Xuanwu Lake's water birds ------------------------------------------------------------------------
// Anchors as [x east, north] from OSM: Shence Gate's footbridge, Nanjing Station.
const HEPING = [-180, 5520], STATION = [716, 5226];
// [name, winter count, anchor, spread m, all year]
export const WATER = [
  ['mandarin', 150, HEPING, 70, 0],
  ['coot', 150, STATION, 160, 0],
  ['cormorant', 35, STATION, 45, 0],
  ['heron', 100, HEPING, 60, 30],
  ['mallard', 40, null, 0, 0],
];
// Flights (ours, from the birds' habits above): [start of the window, its length h, speed m/s, height m].
export const FLIGHTS = {heronOut: [17, 1.5, 6, 18], heronBack: [5.5, 1.5, 6, 18], cormorantIn: [7, 1.5, 14, 30], cormorantOut: [16, 1.5, 14, 30]};
// Where the cormorants fly to and from: the Jiajiang, by Jiangxin Island (32.0310 N, 118.7013 E,
// Wikipedia), as [x east, north]. Qianzhou itself, in the Jiajiang, was not found on a map; only the
// bearing matters here, as the flights start and end 3 km out.
export const QIANZHOU = [-7782, -1189];
/** How many of the winter flock are on the lake in this season (0 spring, 1 summer, 2 autumn,
 *  3 winter, round again): all in winter, none in summer; autumn and spring for the arrivals in late
 *  October to November and the departures in March. */
export function seasonShare(season) {
  const s = ((season % 4) + 4) % 4, k = [.3, 0, .4, 1, .3], i = Math.floor(s), f = s - i;
  return k[i] * (1 - f) + k[i + 1] * f;
}
/** Birds of one water flock at this season and hour. Coots double at dusk ("some hundreds"). */
export function flockSize([name, winter, , , resident], season, hour) {
  const dusk = name === 'coot' && hour >= 16 && hour < 18.5 ? 2 : 1;
  return Math.round((resident + (winter - resident) * seasonShare(season)) * dusk);
}

function hash(i, seed) {
  let h = Math.imul(i ^ seed, 2654435761) ^ (seed >>> 7);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  return ((h ^ (h >>> 13)) >>> 0) / 4294967296;
}

// --- Models: +z forward, feet (or the waterline) at y 0, the bird's length 1 -------------------------
const tint = (g, c) => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  const col = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) col.toArray(a, i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; };
const ball = (r, sx, sy, sz, x, y, z, c, d = 1) => tint(new THREE.IcosahedronGeometry(r, d).scale(sx, sy, sz).translate(x, y, z), c);
const beak = (r, len, x, y, z, c, down = 0) => tint(new THREE.ConeGeometry(r, len, 5).rotateX(Math.PI / 2 + down).translate(x, y, z), c);
const slab = (w, h, d, x, y, z, c, tilt = 0) => tint(new THREE.BoxGeometry(w, h, d).rotateX(tilt).translate(x, y, z), c);
const stick = (h, x, z, c) => tint(new THREE.CylinderGeometry(.012, .012, h, 4).translate(x, h / 2, z), c);

/** A perching bird: body, belly, head, beak, tail; the wings drawn apart. */
function perching({body, belly, head, bill, tail = body, tailLen = .4, cheek, nape, collar, shoulder, legs = 0x6a5a4a, wing = body}) {
  const parts = [ball(.25, 1.15, 1, 1.75, 0, .3, 0, body), ball(.22, 1.1, 1, 1.5, 0, .25, .08, belly), ball(.15, 1, 1, 1.05, 0, .5, .3, head),
    beak(.035, .14, 0, .49, .5, bill), slab(.15 + tailLen * .1, .045, tailLen, 0, .33, -.32 - tailLen / 2, tail, -.25),
    stick(.16, -.05, .02, legs), stick(.16, .05, .02, legs)];
  if (cheek) parts.push(ball(.06, .5, 1, 1, -.13, .48, .33, cheek, 0), ball(.06, .5, 1, 1, .13, .48, .33, cheek, 0));
  if (nape) parts.push(ball(.09, 1, .8, 1, 0, .58, .22, nape, 0));
  if (shoulder) parts.push(ball(.1, .45, .8, 1.8, -.25, .36, -.02, shoulder, 0), ball(.1, .45, .8, 1.8, .25, .36, -.02, shoulder, 0));
  if (collar) parts.push(ball(.12, 1.35, .55, 1, 0, .4, .22, collar, 0));
  return {body: mergeGeometries(parts), wing: wingGeometry(wing, .75)};
}
/** A swimming bird, sitting at the waterline. */
function swimming({body, breast = body, head, bill, neck = 0, crest, stripe, side, sail, billLen = .14}) {
  const parts = [ball(.25, 1.25, .8, 2, 0, .1, 0, body), ball(.22, 1.15, .85, 1.1, 0, .14, .22, breast), ball(.14, 1, 1, 1.15, 0, .38 + neck, .4 + neck * .3, head),
    tint(new THREE.CylinderGeometry(.06, .08, .22 + neck, 5).rotateX(-.35).translate(0, .26 + neck / 2, .34 + neck * .15), breast),
    beak(.05, billLen, 0, .36 + neck, .55 + neck * .3 + billLen / 2 - .05, bill, .1), slab(.18, .04, .2, 0, .14, -.52, body, -.4)];
  if (crest) parts.push(ball(.1, .7, .9, 1.6, 0, .44 + neck, .32 + neck * .3, crest, 0));
  if (stripe) parts.push(ball(.05, .5, .6, 2.2, -.11, .42 + neck, .38 + neck * .3, stripe, 0), ball(.05, .5, .6, 2.2, .11, .42 + neck, .38 + neck * .3, stripe, 0));
  if (sail) parts.push(slab(.03, .2, .18, -.12, .3, -.12, sail, .3), slab(.03, .2, .18, .12, .3, -.12, sail, .3), ball(.16, .9, .6, 1.4, 0, .17, .26, 0xf4f0e8, 0));
  if (side) parts.push(ball(.12, .5, 1.1, 1, -.2, .26, -.05, side, 0), ball(.12, .5, 1.1, 1, .2, .26, -.05, side, 0));
  return {body: mergeGeometries(parts), wing: wingGeometry(body, .8)};
}
/** A standing night heron: hunched on yellow legs. */
function heron() {
  // Hunched: a short upright body, the head sunk into the shoulders, on yellow legs.
  const parts = [ball(.22, 1.05, 1.25, 1.2, 0, .6, 0, 0x8b9198), ball(.18, 1.08, 1.1, 1.05, 0, .66, -.03, 0x2a3038), ball(.18, 1, 1.15, 1, 0, .55, .08, 0xe4e6e6),
    ball(.13, 1, .95, 1.1, 0, .86, .12, 0x2a3038), ball(.1, 1.05, .8, 1, 0, .82, .16, 0xe8eaea), beak(.03, .2, 0, .84, .3, 0x202020),
    slab(.12, .04, .25, 0, .52, -.32, 0x7a8088, -.6),
    tint(new THREE.CylinderGeometry(.025, .025, .42, 5).translate(-.07, .21, 0), 0xd8c040), tint(new THREE.CylinderGeometry(.025, .025, .42, 5).translate(.07, .21, 0), 0xd8c040)];
  return {body: mergeGeometries(parts), wing: wingGeometry(0x8b9198, .9)};
}
/** Two wings from the shoulder (the origin): tips raised, so a scale in y swings them up and down. */
function wingGeometry(c, span) {
  const p = [];
  for (const s of [-1, 1]) p.push(0, 0, .12, s * span, .3, -.1, s * span * .35, .05, -.28, 0, 0, .12, s * span * .35, .05, -.28, 0, 0, -.2);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return tint(g, c);
}
const MODELS = {
  sparrow: () => perching({body: 0x8a5a3a, belly: 0xd8cfc0, head: 0x7a3e25, bill: 0x2a2420, cheek: 0xf2eee6, collar: 0x2a2420, wing: 0x7a5034}),
  bulbul: () => perching({body: 0x7b7f55, belly: 0xd9d6c6, head: 0x232323, bill: 0x222222, nape: 0xf4f2ec, wing: 0x8a8f4e}),
  blackbird: () => perching({body: 0x221e1b, belly: 0x2a2522, head: 0x1e1b19, bill: 0xe8a21e, tailLen: .5, legs: 0x302820}),
  dove: () => perching({body: 0x9c8070, belly: 0xc8a898, head: 0xa89490, bill: 0x3a3030, collar: 0x2a2a2a, tailLen: .55, legs: 0xc06060, wing: 0x8c7060}),
  magpie: () => perching({shoulder: 0xf2f2ee, body: 0x16181e, belly: 0xf2f2ee, head: 0x111216, bill: 0x111111, tail: 0x1f2a44, tailLen: .9, legs: 0x111111, wing: 0x1c2438}),
  azure: () => perching({body: 0xc9c0b4, belly: 0xe2dbd0, head: 0x18181a, bill: 0x111111, tail: 0x6f9fc8, tailLen: .85, legs: 0x222222, wing: 0x6f9fc8}),
  mandarin: () => swimming({body: 0xb8743a, breast: 0x5a3a5a, head: 0x3f6a48, bill: 0xd8402a, crest: 0xc06030, stripe: 0xf4f0e8, side: 0xe0a050, sail: 0xe07a2a}),
  mandarinF: () => swimming({body: 0x8a8078, breast: 0x9a9088, head: 0x8a8580, bill: 0x6a5a50, stripe: 0xe8e4dc}),
  coot: () => swimming({body: 0x26262a, head: 0x1e1e22, bill: 0xf0ece0, billLen: .1}),
  cormorant: () => swimming({body: 0x1d2020, breast: 0x262a2a, head: 0x1a1c1c, bill: 0xc8a040, neck: .18, billLen: .2}),
  mallard: () => swimming({body: 0xb8b4aa, breast: 0x6a3a2a, head: 0x1f5a3a, bill: 0xe8c840}),
  mallardF: () => swimming({body: 0x9a7a58, breast: 0xa8865e, head: 0x8a6c50, bill: 0xc07830}),
  heron,
};
const LEN = {mandarin: .43, mandarinF: .43, coot: .38, cormorant: .85, mallard: .58, mallardF: .58, heron: .6};

/** Birds for a world: land birds wherever there are trees; Xuanwu Lake's flocks in the core. */
export function createWorldBirds({world, season}) {
  const grid = world.grid;
  if (!grid?.crowns) return null;
  const toon = () => new THREE.MeshToonMaterial({color: 0xffffff, gradientMap: world.bands || null, vertexColors: true, side: THREE.DoubleSide});
  const kinds = {}, CAP = {sparrow: 600, bulbul: 300, blackbird: 200, dove: 200, magpie: 150, azure: 300, mandarin: 200, mandarinF: 200, coot: 400, cormorant: 60, mallard: 40, mallardF: 40, heron: 120};
  for (const [name, make] of Object.entries(MODELS)) {
    const g = make(), k = {body: new THREE.InstancedMesh(g.body, toon(), CAP[name]), wing: new THREE.InstancedMesh(g.wing, toon(), CAP[name]), n: 0, cap: CAP[name]};
    for (const m of [k.body, k.wing]) { m.name = 'Birds'; m.frustumCulled = false; m.count = 0; world.scene.add(m); }
    kinds[name] = k;
  }
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(0, 0, 0, 'YXZ'), v = new THREE.Vector3(), s = new THREE.Vector3();
  /** Draw one bird: its kind, position, heading, pitch, size, and its wings (0 folded, else -1..1). */
  function draw(kind, x, y, z, yaw, pitch, len, flap) {
    const k = kinds[kind];
    if (k.n >= k.cap) return;
    e.set(pitch, yaw, 0); q.setFromEuler(e);
    M.compose(v.set(x, y, z), q, s.set(len, len, len));
    M.toArray(k.body.instanceMatrix.array, k.n * 16);
    if (flap) {
      const sy = len * .42;
      M.compose(v.set(x, y + sy, z), q, s.set(len, len * flap, len));
    } else M.makeScale(0, 0, 0);
    M.toArray(k.wing.instanceMatrix.array, k.n * 16);
    k.n++;
  }
  const height = (x, z) => world.ground?.(x, z) ?? grid.height(x, z);
  const body = () => world.body || {x: 0, z: 0};

  // --- Land birds: groups in the 20 m cells of green round the camera --------------------------------
  const greenCache = new Map(), groups = new Map();
  /** A cell is green with two crowns within 14 m of its centre; its ground spot is walkable, not road. */
  function cellInfo(i, j) {
    const key = `${i},${j}`;
    let c = greenCache.get(key);
    if (c) return c;
    const cx = (i + .5) * CELL, cz = (j + .5) * CELL, near = grid.crowns(cx, cz, 14);
    c = {green: near.length >= 2, crowns: near.slice(0, 6), spot: null};
    if (c.green) for (let k = 0; k < 8 && !c.spot; k++) {
      const x = cx + (hash(i * 7919 + j, k + 31) - .5) * CELL, z = cz + (hash(i * 104729 + j, k + 37) - .5) * CELL;
      if (grid.height(x, z) != null && !grid.road(x, z) && grid.water(x, z) == null && !grid.trunk(x, z, 1)) c.spot = [x, z];
    }
    greenCache.set(key, c);
    return c;
  }
  function perchOn(c, r1, r2) {
    const a = r1 * 6.283, el = .15 + .55 * r2;
    return [c[0] + Math.cos(a) * Math.cos(el) * c[3], c[1] + Math.sin(el) * c[3] * .8, c[2] + Math.sin(a) * Math.cos(el) * c[3], Math.atan2(Math.cos(a), Math.sin(a))];
  }
  /** The species of a cell's group, and whether a group is there at this activity. */
  function cellGroup(i, j, info, act) {
    const seed = (i * 73856093) ^ (j * 19349663);
    // Species by group weight (share / group size), so the birds come out at the species' shares.
    let r = hash(seed, 1) * LAND.reduce((a, sp) => a + sp[1] / sp[2], 0), sp = LAND[0];
    for (const x of LAND) { if ((r -= x[1] / x[2]) < 0) { sp = x; break; } }
    const P = PER_HA * CELL * CELL / 10000 * act / MEAN_GROUP;
    return {seed, sp, here: info.green && info.crowns.length > 0 && hash(seed, 2) < P};
  }
  function makeGroup(info, {seed, sp}, t) {
    const [name, , size, groundShare, len, fid] = sp, n = Math.max(1, Math.round(size * (.6 + .8 * hash(seed, 3))));
    const birds = [];
    for (let b = 0; b < n; b++) {
      const onGround = info.spot && hash(seed + b, 4) < groundShare;
      const c = info.crowns[Math.floor(hash(seed + b, 5) * info.crowns.length)];
      const p = onGround ? [info.spot[0] + (hash(seed + b, 6) - .5) * 3, 0, info.spot[1] + (hash(seed + b, 7) - .5) * 3, hash(seed + b, 8) * 6.283] : perchOn(c, hash(seed + b, 9), hash(seed + b, 10));
      if (onGround && grid.height(p[0], p[2]) == null) { p[0] = info.spot[0]; p[2] = info.spot[1]; }
      if (onGround) p[1] = height(p[0], p[2]) ?? 0;
      birds.push({state: onGround ? 'ground' : 'perch', x: p[0], y: p[1], z: p[2], yaw: p[3], next: t + 2 + 20 * hash(seed + b, 12), from: null, to: null, t0: 0, dur: 0, pitch: 0, hop: 0});
    }
    return {name, len: len * (.9 + .2 * hash(seed, 11)), fid, groundShare, info, birds, seed};
  }
  /** Send a bird flying to a point; it arrives in the given state. */
  function fly(b, t, to, state) {
    const d = Math.hypot(to[0] - b.x, to[2] - b.z, to[1] - b.y);
    b.from = [b.x, b.y, b.z]; b.to = to; b.t0 = t; b.dur = Math.max(.6, d / 6); b.state = 'fly'; b.arrive = state;
    b.yaw = Math.atan2(to[0] - b.x, to[2] - b.z);
  }
  let lastCell = '', flushes = 0;
  function updateLand(t, hour, eye) {
    const act = at(ACTIVE, hour);
    const ci = Math.floor(eye.x / CELL), cj = Math.floor(eye.z / CELL), R = Math.ceil(LAND_R / CELL);
    const key = `${ci},${cj},${act.toFixed(2)}`;
    if (key !== lastCell) {
      lastCell = key;
      const keep = new Set();
      for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++) {
        if ((i - ci) ** 2 + (j - cj) ** 2 > R * R) continue;
        const k = `${i},${j}`, info = cellInfo(i, j);
        keep.add(k);
        // Groups come and go with the day's activity; one already here stays as it is.
        const c = info.green ? cellGroup(i, j, info, act) : null;
        if (!c?.here) groups.set(k, null);
        else if (!groups.get(k)) groups.set(k, makeGroup(info, c, t));
      }
      for (const k of groups.keys()) if (!keep.has(k)) groups.delete(k);
    }
    const w = body();
    for (const g of groups.values()) {
      if (!g) continue;
      const sp = g.info.spot, crowns = g.info.crowns;
      for (let i = 0; i < g.birds.length; i++) {
        const b = g.birds[i], r = Math.random;
        const near = Math.hypot(b.x - w.x, b.z - w.z) < g.fid;
        if (b.state === 'ground') {
          if (near) { const c = crowns[Math.floor(r() * crowns.length)]; fly(b, t, perchOn(c, r(), r()), 'perch'); b.next = t + 8 + 20 * r(); flushes++; }
          else if (t > b.next) {
            // A hop: up to 40 cm, staying within 3 m of the group's spot; then pecking a while.
            const a = r() * 6.283, d = .1 + .3 * r();
            let x = b.x + Math.sin(a) * d, z = b.z + Math.cos(a) * d;
            if (Math.hypot(x - sp[0], z - sp[1]) > 3) { x = b.x + (sp[0] - b.x) * .2; z = b.z + (sp[1] - b.z) * .2; }
            const y = height(x, z);
            if (y != null && grid.height(x, z) != null) { b.hopFrom = [b.x, b.y, b.z]; b.x = x; b.z = z; b.y = y; b.hop = t; b.yaw = Math.atan2(x - b.hopFrom[0], z - b.hopFrom[2]); }
            b.next = t + .4 + 1.6 * r();
          }
        } else if (b.state === 'perch') {
          if (t > b.next) {
            // Down again to feed when the walker is far enough; else, now and then, to another tree.
            if (sp && Math.hypot(sp[0] - w.x, sp[1] - w.z) > g.fid * 2 && r() < g.groundShare + .2) {
              const x = sp[0] + (r() - .5) * 3, z = sp[1] + (r() - .5) * 3, y = height(x, z);
              if (y != null && grid.height(x, z) != null) fly(b, t, [x, y, z], 'ground');
            } else if (r() < .3) { const c = crowns[Math.floor(r() * crowns.length)]; fly(b, t, perchOn(c, r(), r()), 'perch'); }
            b.next = t + 6 + 20 * r();
          }
        }
        if (b.state === 'fly') {
          const u = Math.min(1, (t - b.t0) / b.dur);
          const f = b.from, to = b.to, lift = Math.min(3, b.dur * 1.5) * 4 * u * (1 - u);
          b.x = f[0] + (to[0] - f[0]) * u; b.y = f[1] + (to[1] - f[1]) * u + lift; b.z = f[2] + (to[2] - f[2]) * u;
          if (u >= 1) { b.state = b.arrive; b.y = to[1]; if (to[3] != null) b.yaw = to[3]; b.next = t + (b.state === 'ground' ? .5 : 6 + 20 * r()); }
        }
        // Drawn: a hop's little arc, pecking when still on the ground, wings beating in flight.
        let y = b.y, pitch = 0, flap = 0;
        if (b.state === 'ground') { const h = (t - b.hop) / .22; if (h < 1) y += Math.sin(h * Math.PI) * .06; else pitch = Math.sin(t * 7 + i) > .55 ? .5 : 0; }
        if (b.state === 'fly') flap = Math.sin(t * (g.len < .25 ? 40 : 24) + i);
        draw(g.name, b.x, y, b.z, b.yaw, pitch, g.len, flap);
      }
    }
  }

  // --- Xuanwu Lake's flocks ---------------------------------------------------------------------------
  const lake = world.id === 'core' && grid.water ? (() => {
    const open = (x, z, r) => [0, 1, 2, 3, 4, 5, 6, 7].every(k => grid.water(x + Math.cos(k * .785) * r, z + Math.sin(k * .785) * r) != null);
    // The lake's own water: inside the box of OSM's outline of 玄武湖 (Xuanwu Lake), not the moat beyond it.
    const PARK = {x0: -196, x1: 2346, n0: 2130, n1: 5095};
    const wet = [];
    for (let x = PARK.x0; x < PARK.x1; x += 10) for (let n = PARK.n0; n < PARK.n1; n += 10) if (grid.water(x, -n) != null && open(x, -n, 4)) wet.push([x, -n]);
    if (!wet.length) return null;
    const nearestWet = ([x, n]) => wet.reduce((b, p) => (Math.hypot(p[0] - x, p[1] + n) < Math.hypot(b[0] - x, b[1] + n) ? p : b));
    const flocks = WATER.map(spec => {
      const [name, , anchor, spread] = spec, centre = anchor ? nearestWet(anchor) : null;
      // Each bird's own spot: open water within the flock's spread (the whole lake for the mallards);
      // the night herons on the shore's edge and in the trees beside it.
      let spots = centre ? wet.filter(p => Math.hypot(p[0] - centre[0], p[1] - centre[1]) < spread) : wet;
      let shore = [];
      if (name === 'heron') {
        for (let x = centre[0] - spread; x < centre[0] + spread; x += 3) for (let z = centre[1] - spread; z < centre[1] + spread; z += 3)
          if (grid.water(x, z) == null && grid.height(x, z) != null && ![0, 1, 2, 3, 4, 5, 6, 7].some(k => grid.water(x + Math.cos(k * .785) * 3, z + Math.sin(k * .785) * 3) != null)
            && [0, 1, 2, 3, 4, 5, 6, 7].some(k => grid.water(x + Math.cos(k * .785) * 6, z + Math.sin(k * .785) * 6) != null)) shore.push([x, z]);
        spots = shore;
      }
      const roost = name === 'heron' ? grid.crowns(centre[0], centre[1], spread + 60) : [];
      return {spec, name, centre, spots, roost, birds: []};
    });
    // The herons' night feeding: the lake's banks, 3 to 6 m from its water, on a 20 m lattice.
    const banks = [];
    for (let x = PARK.x0; x < PARK.x1; x += 20) for (let n = PARK.n0; n < PARK.n1; n += 20) {
      const z = -n;
      if (grid.water(x, z) == null && grid.height(x, z) != null && ![0, 2, 4, 6].some(k => grid.water(x + Math.cos(k * .785) * 3, z + Math.sin(k * .785) * 3) != null)
        && [0, 1, 2, 3, 4, 5, 6, 7].some(k => grid.water(x + Math.cos(k * .785) * 6, z + Math.sin(k * .785) * 6) != null)) banks.push([x, z]);
    }
    for (const f of flocks) f.banks = f.name === 'heron' ? banks.filter(p => Math.hypot(p[0] - f.centre[0], p[1] - f.centre[1]) < 1500) : [];
    return {wet, flocks, banks};
  })() : null;
  function bird(f, i) {
    const p = f.spots.length ? f.spots[Math.floor(hash(i, 41 + f.name.length) * f.spots.length)] : null;
    let r = f.name === 'heron' || !p ? [0, 0] : [(hash(i, 43) - .5) * 9, (hash(i, 47) - .5) * 9];
    if (p && grid.water(p[0] + r[0], p[1] + r[1]) == null) r = [0, 0];
    const kind = (f.name === 'mandarin' || f.name === 'mallard') && hash(i, 53) < .5 ? f.name + 'F' : f.name;
    // A heron on the bank faces the water.
    let yaw = hash(i, 61) * 6.283;
    if (f.name === 'heron' && p) for (let k = 0; k < 8; k++) if (grid.water(p[0] + Math.cos(k * .785) * 6, p[1] + Math.sin(k * .785) * 6) != null) { yaw = Math.atan2(Math.cos(k * .785), Math.sin(k * .785)); break; }
    // Herons: when each leaves and comes back, and where it feeds. Cormorants: their line (nine to a
    // line, ours) and when it comes and goes.
    const team = Math.floor(i / 9), slot = i % 9;
    const fl = f.name === 'heron' ? {out: FLIGHTS.heronOut[0] + FLIGHTS.heronOut[1] * hash(i, 89), back: FLIGHTS.heronBack[0] + FLIGHTS.heronBack[1] * hash(i, 97),
      feed: f.banks.length ? f.banks[Math.floor(hash(i, 101) * f.banks.length)] : p}
      : f.name === 'cormorant' ? {out: FLIGHTS.cormorantOut[0] + FLIGHTS.cormorantOut[1] * hash(team, 103), back: FLIGHTS.cormorantIn[0] + FLIGHTS.cormorantIn[1] * hash(team, 107), slot} : null;
    return {kind, fl, x: p ? p[0] + r[0] : 0, z: p ? p[1] + r[1] : 0, phase: hash(i, 59) * 6.283, yaw, dive: 0, len: LEN[kind] * (.92 + .16 * hash(i, 67)),
      perch: f.roost.length && hash(i, 71) < .7 ? perchOn(f.roost[Math.floor(hash(i, 73) * f.roost.length)], hash(i, 79), hash(i, 83)) : null};
  }
  /** Is the hour within [from, to), round midnight if need be? */
  const inHours = (h, from, to) => { to %= 24; return from <= to ? h >= from && h < to : h >= from || h < to; };
  let flying = 0, air = [];
  /** Draw a bird in the air if this hour is its turn to fly; true if it is flying. */
  function flight(f, b, t, hour, eye) {
    const heron = f.name === 'heron', fl = b.fl;
    const [, , speed, top] = heron ? FLIGHTS.heronOut : FLIGHTS.cormorantIn;
    let from, to;
    if (heron) { from = [b.x, b.z]; to = fl.feed; }
    else {
      // From the Jiajiang: the line comes in over the city, 3 km out along that bearing.
      const dx = QIANZHOU[0] - b.x, dz = -QIANZHOU[1] - b.z, d = Math.hypot(dx, dz);
      from = [b.x + dx / d * 3000, b.z + dz / d * 3000]; to = [b.x, b.z];
    }
    const dist = Math.max(1, Math.hypot(to[0] - from[0], to[1] - from[1])), dur = dist / speed, span = dur / 3600;
    // Out (herons to feed, cormorants to Qianzhou) or back: is this hour within the flight that
    // starts at the bird's time?
    const out = inHours(hour, fl.out, fl.out + span), back = inHours(hour, fl.back, fl.back + span);
    if (!out && !back) return false;
    // The clock stands still: the bird flies its leg over and over at its real speed (a stream).
    const u = (t / dur + b.phase / 6.283) % 1;
    // Herons go out from home to feed; cormorants come back from Qianzhou to the lake.
    let [ax, az] = from, [bx, bz] = to;
    if (heron ? back : out) { [ax, az] = to; [bx, bz] = from; }
    // A cormorant's place in its line: back and to one side of the one ahead (ours: 2.5 m, 1.5 m).
    const ex = (bx - ax) / dist, ez = (bz - az) / dist, k = fl.slot != null ? Math.ceil(fl.slot / 2) : 0, side = (fl.slot % 2 ? 1 : -1) * k * 1.5, rear = k * 2.5;
    const x = ax + (bx - ax) * u - ex * rear - ez * side, z = az + (bz - az) * u - ez * rear + ex * side;
    flying++;
    if (Math.hypot(x - eye.x, z - eye.z) > 900) return true;
    const ga = height(ax, az) ?? grid.water(ax, az) ?? 8, gb = height(bx, bz) ?? grid.water(bx, bz) ?? 8;
    const y = ga + (gb - ga) * u + top * Math.min(1, 6.4 * u * (1 - u));
    draw(b.kind, x, y, z, Math.atan2(ex, ez), heron ? 1.35 : 0, b.len, Math.sin(t * (heron ? 9 : 11) + b.phase));
    air.push([b.kind, x, y, z, ex, ez]);
    return true;
  }
  let lastT = null;
  function updateLake(t, hour, eye) {
    if (!lake) return;
    const sv = season?.value ?? 2, w = body(), dt = lastT == null ? 0 : Math.max(0, Math.min(.5, t - lastT));
    lastT = t;
    for (const f of lake.flocks) {
      const want = f.spots.length ? flockSize(f.spec, sv, hour) : 0;
      while (f.birds.length < want) f.birds.push(bird(f, f.birds.length));
      f.birds.length = want;
      if (f.centre && Math.hypot(f.centre[0] - eye.x, f.centre[1] - eye.z) > 700 && f.name !== 'mallard' && f.name !== 'heron' && f.name !== 'cormorant') continue;
      for (const b of f.birds) {
        if (b.fl && flight(f, b, t, hour, eye)) continue;
        if (f.name === 'heron') {
          // At home by day: most roost in the trees by the reeds, the rest stand on the bank. Out on the
          // lake's banks by night, feeding.
          const home = inHours(hour, b.fl.back, b.fl.out), [x, z] = home ? [b.x, b.z] : b.fl.feed;
          if (Math.hypot(x - eye.x, z - eye.z) > 500) continue;
          if (home && b.perch && hour > 7) draw('heron', b.perch[0], b.perch[1], b.perch[2], b.perch[3], 0, b.len, 0);
          else draw('heron', x, height(x, z) ?? 0, z, home ? b.yaw : b.phase, .15 * Math.sin(t * .3 + b.phase), b.len, 0);
          continue;
        }
        if (Math.hypot(b.x - eye.x, b.z - eye.z) > 500) continue;
        // Cormorants are on the lake only between their morning and evening flights.
        if (f.name === 'cormorant' && !inHours(hour, b.fl.back, b.fl.out)) continue;
        // A slow paddle about its spot; away from a walker or boat closer than 15 m (ours).
        const a = t * .05 + b.phase, ox = Math.sin(a) * 3, oz = Math.cos(a * .8) * 3;
        const d = Math.hypot(b.x - w.x, b.z - w.z);
        if (d < 15 && d > .01) {
          const k = Math.min(1, (15 - d) * dt * .4), nx = b.x + (b.x - w.x) / d * 15 * k, nz = b.z + (b.z - w.z) / d * 15 * k;
          if (grid.water(nx, nz) != null) { b.x = nx; b.z = nz; }
        }
        const x = b.x + ox, z = b.z + oz, y = grid.water(x, z);
        if (y == null) continue;
        // Coots and cormorants dive for a while now and then (ours: 8 s under, a minute between).
        if ((f.name === 'coot' || f.name === 'cormorant') && (t * .016 + b.phase) % 1 < .13) continue;
        const yaw = Math.atan2(Math.cos(a), -Math.sin(a * .8) * .8);
        draw(b.kind, x, y - .02, z, yaw, 0, b.len, 0);
      }
    }
  }

  const birds = {
    stats: {birds: 0},
    get groups() { return groups; }, get lake() { return lake; }, get flushes() { return flushes; },
    /** The birds drawn in flight to or from the lake this frame: [kind, x, y, z, fx, fz]. */
    get air() { return air; },
    /** Each frame: t in seconds, the clock's hour, the camera's position. */
    update(t, hour, eye) {
      for (const k of Object.values(kinds)) k.n = 0;
      flying = 0; air = [];
      updateLand(t, hour, eye);
      updateLake(t, hour, eye);
      let n = 0;
      for (const k of Object.values(kinds)) {
        for (const m of [k.body, k.wing]) { m.count = k.n; m.instanceMatrix.needsUpdate = true; }
        n += k.n;
      }
      birds.stats = {birds: n, flying, ...Object.fromEntries(Object.entries(kinds).map(([name, k]) => [name, k.n]))};
    },
    /** Every land bird near the camera, for the audit: [kind, state, x, y, z]. */
    land() {
      const out = [];
      for (const g of groups.values()) if (g) for (const b of g.birds) out.push([g.name, b.state, b.x, b.y, b.z]);
      return out;
    },
  };
  return birds;
}
