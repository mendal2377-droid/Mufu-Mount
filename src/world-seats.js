import * as THREE from 'three';

// Places to sit and look (item 44, step 3; design/THINGS-TO-DO-PLAN.md). Sitting, with the camera
// drifting and new music each time, is what the owner liked at the Music Stage; until now the city's
// only seats were that stage's terraces. These are benches at the places a visitor stops to look.
//
// OSM maps no benches in the city, so every spot here is ours, chosen by a rule rather than surveyed.
// 'here' benches stand within SNAP metres of a mapped place: three of the five mapped viewpoints
// (tourism=viewpoint in research/core/data/features.json) and the summit (北高峰, "Beigaofeng") as OSM
// places them. Mufu Mountain's two viewpoints have none: in our model both stand deep in the wood on
// its top, with trees on every side.
// 'shore' benches start from a spot we know (an island's name board, src/xuanwu-life.js; the Mufu
// riverside spawn; Xuanwu Gate) and stand within SHORE metres of it and 40 m of the water, off the
// roads, nearest both the spot and the water: the boards stand inland among the trees, and the banks
// of the lake and the Yangtze are steep strips the walk grid leaves out, 6 to 40 m wide.
// Either way the spot must be level (a bench end was sunk in a slope), clear for 3 m round, open for
// 8 m behind (where the chase camera sits: one bench put it inside a trunk), and joined to at least
// 30 m of walkable ground without a step (not a strip at the water's level below the path) — see
// findSpot. One that finds no place is left out and reported in `skipped`.
//
// Which way a bench faces is also a rule: 'water' faces the nearest and widest water within 300 m; 'open' faces the
// longest clear view across walkable ground, counted more where the ground falls away (off a
// hilltop); a pair [x east, north] faces that point.
export const WORLD_SEATS = {
  core: [
    // [id, x east, north, place, face, label]
    ['summit', 5357, 3396, 'here', [700, 3500], 'the top of Purple Mountain'],
    ['daosheng', 5845, 3213, 'here', 'open', 'the Daosheng viewpoint'],
    ['linggu', 7384, 2068, 'here', 'open', 'the Linggu viewpoint'],
    ['wenyuan', 3450, 61, 'here', 'open', 'Wenyuan Square'],
    ['mufu-river', -346, 9452, 'shore', 'water', 'the Yangtze below Mufu Mountain'],
    // The lake's west shore inside Xuanwu Gate, 90 m north of the gate road: by the road the drawn stone
    // embankment stands above the walk grid and swallowed the bench. (The wall top beside the gate is
    // not walkable in our model, so no bench stands up there.)
    ['xuanwu-shore', -104, 3510, 'shore', 'water', 'Xuanwu Lake, inside the gate'],
    // The five islands, at the water's edge near each name board. Lingzhou's scene is "Mountain
    // Mists", so its bench looks to Purple Mountain, from the inlet west of the board (the board
    // itself stands on the bank).
    ['huanzhou', 447, 3616, 'shore', 'water', 'Huanzhou'],
    ['yingzhou', 474, 3568, 'shore', 'water', 'Yingzhou'],
    ['liangzhou', 544, 4086, 'shore', 'water', 'Liangzhou'],
    ['cuizhou', 1003, 4007, 'shore', 'water', 'Cuizhou'],
    ['lingzhou', 890, 3125, 'shore', [5357, 3396], 'Lingzhou'],
  ],
};
export const SNAP = 30, SHORE = 160;
const LIFT = 0.42;        // the plank's top: the traveller sits on it

/** How far (m) from (x, z) the nearest water lies, out to 40 m; Infinity if none. */
function waterDistance(water, x, z) {
  for (const d of [4, 8, 12, 16, 22, 28, 34, 40]) {
    for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; if (water(x + Math.sin(a) * d, z + Math.cos(a) * d) != null) return d; }
  }
  return Infinity;
}

/**
 * Is (x, z) joined, over walkable ground on a 2 m lattice with no step over 0.6 m between neighbours,
 * to a point at least `reach` m away? A strip at the water's level below the path is not.
 */
export function roomy(height, x, z, reach = 30) {
  const seen = new Set(['0,0']), queue = [[0, 0, height(x, z)]];
  while (queue.length && seen.size < 2500) {
    const [i, j, h] = queue.shift();
    if (Math.hypot(i, j) * 2 >= reach) return true;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = `${i + di},${j + dj}`, nh = height(x + (i + di) * 2, z + (j + dj) * 2);
      if (!seen.has(k) && nh != null && Math.abs(nh - h) <= 0.6) { seen.add(k); queue.push([i + di, j + dj, nh]); }
    }
  }
  return false;
}

/** Open round (x, z) out to 3 m (walkable or water), and no trunk within 2.5 m: nothing against the bench. */
export function clearAround({height, water, trunk}, x, z) {
  if (trunk?.(x, z, 2.5)) return false;
  for (let k = 0; k < 12; k++) {
    const a = k * Math.PI / 6;
    for (const d of [1.5, 3]) { const px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d; if (height(px, pz) == null && water(px, pz) == null) return false; }
  }
  return true;
}

/**
 * The bearing (radians, three.js x and z: 0 faces +z) a bench at (x, z) faces. `height(x, z)` is the
 * walk grid (null off it), `water(x, z)` a water height or null.
 */
export function faceFrom(face, x, z, {height, water}) {
  if (Array.isArray(face)) return Math.atan2(face[0] - x, -face[1] - z);
  const n = 32, h0 = height(x, z) ?? 0;
  if (face === 'water') {
    // Toward the water, weighted by nearness: the sum of the bearings to every wet sample out to
    // 300 m, each over its distance. A straight shore gives the bearing straight across it; an island's
    // bench turns to where the water is widest and nearest.
    let sx = 0, sz = 0;
    for (let k = 0; k < n; k++) {
      const a = 2 * Math.PI * k / n, dx = Math.sin(a), dz = Math.cos(a);
      for (let d = 2; d <= 300; d += 4) if (water(x + dx * d, z + dz * d) != null) { sx += dx / d; sz += dz / d; }
    }
    if (sx || sz) return Math.atan2(sx, sz);
  }
  let best = 0, bestScore = -Infinity;
  for (let k = 0; k < n; k++) {
    const a = 2 * Math.PI * k / n, dx = Math.sin(a), dz = Math.cos(a);
    // Clear: how far the ray runs over walkable ground or water before a building or wall (160 m at most).
    let clear = 0;
    for (let d = 8; d <= 160; d += 8) { const px = x + dx * d, pz = z + dz * d; if (height(px, pz) == null && water(px, pz) == null) break; clear = d; }
    // Fall: how far the ground below drops on average out to 480 m.
    let fall = 0, m = 0;
    for (let d = 60; d <= 480; d += 60) { const h = height(x + dx * d, z + dz * d); if (h != null) { fall += h0 - h; m++; } }
    const score = clear + 4 * Math.max(0, m ? fall / m : 0);
    if (score > bestScore) { bestScore = score; best = a; }
  }
  return best;
}

/** Level: the ground within 0.9 m of (x, z) all walkable and within 0.25 m of its height. */
function level(height, x, z) {
  const h0 = height(x, z);
  for (let k = 0; k < 8; k++) {
    const a = k * Math.PI / 4, h = height(x + Math.sin(a) * .9, z + Math.cos(a) * .9);
    if (h == null || Math.abs(h - h0) > .25) return false;
  }
  return true;
}

/** Open behind a bench facing `a`: where the chase camera sits, 2 to 8 m back, no trunk, wall or building. */
function openBehind({height, water, trunk}, x, z, a) {
  for (const da of [-.35, 0, .35]) for (let d = 2; d <= 8; d += 1.5) {
    const px = x - Math.sin(a + da) * d, pz = z - Math.cos(a + da) * d;
    if ((height(px, pz) == null && water(px, pz) == null) || trunk?.(px, pz, 1.2)) return false;
  }
  return true;
}

/**
 * Where a bench stands and which way it faces, or null. Candidates: for 'here', walkable ground within
 * SNAP of (x, z), nearest first; for 'shore', walkable dry ground off the roads within SHORE of (x, z)
 * and 40 m of water, the lowest (distance from (x, z)) + 3 × (distance to water) first. The first that
 * is level, clear round, open behind once faced, and roomy is the bench's.
 */
export function findSpot(grid, x, z, place, face) {
  const {height, water, road} = grid, radius = place === 'shore' ? SHORE : SNAP, step = place === 'shore' ? 3 : 1.5;
  const found = [];
  for (let px = x - radius; px <= x + radius; px += step) for (let pz = z - radius; pz <= z + radius; pz += step) {
    const d = Math.hypot(px - x, pz - z);
    if (d > radius || height(px, pz) == null || water(px, pz) != null) continue;
    if (place === 'shore') {
      if (road?.(px, pz)) continue;
      const w = waterDistance(water, px, pz);
      if (w < Infinity) found.push([d + 3 * w, px, pz]);
    } else found.push([d, px, pz]);
  }
  found.sort((p, q) => p[0] - q[0]);
  for (const [, px, pz] of found.slice(0, 600)) {
    if (!level(height, px, pz) || !clearAround(grid, px, pz)) continue;
    const a = faceFrom(face, px, pz, grid);
    if (openBehind(grid, px, pz, a) && roomy(height, px, pz)) return {at: [px, pz], a};
  }
  return null;
}

/** Place a world's benches and add them to `world.seats`. Returns null for a world with none. */
export function createWorldSeats({world}) {
  const list = WORLD_SEATS[world.id];
  if (!list) return null;
  const placed = [], skipped = [], {height, water} = world.grid;
  for (const [id, x, north, place, face, label] of list) {
    const spot = findSpot(world.grid, x, -north, place, face);
    if (!spot) { skipped.push(id); continue; }
    // The bench stands on the drawn ground or the walk grid, whichever is higher (a paved promenade
    // can lie above the grid); the seated traveller is set on the grid's height plus `lift`
    // (src/landmark-world.js), so lift makes up the difference.
    const {at, a} = spot, g = height(at[0], at[1]), y = Math.max(g, world.ground(at[0], at[1]) ?? g);
    const seat = {id: `bench-${id}`, label, lift: LIFT + y - g, position: [at[0], y, at[1]],
      look: [at[0] + Math.sin(a) * 30, y, at[1] + Math.cos(a) * 30], bench: true};
    placed.push(seat);
    world.seats.push(seat);
  }
  if (skipped.length) console.warn('Benches with no walkable ground:', skipped.join(', '));

  // A plain park bench: a slatted wooden seat and back on two dark iron ends.
  const n = placed.length;
  if (!n) return {placed, skipped};
  const wood = new THREE.MeshLambertMaterial({color: 0x9a6a43}), iron = new THREE.MeshLambertMaterial({color: 0x34383a});
  const parts = [
    [new THREE.BoxGeometry(1.7, .07, .44), wood, [[0, LIFT - .035, 0]]],
    [new THREE.BoxGeometry(1.7, .3, .05), wood, [[0, .72, -.27]]],
    // The ends reach 0.3 m below the walk grid's height: the drawn ground can lie a little lower.
    [new THREE.BoxGeometry(.07, LIFT + .23, .44), iron, [[-.72, (LIFT - .37) / 2, 0], [.72, (LIFT - .37) / 2, 0]]],
    [new THREE.BoxGeometry(.07, .42, .06), iron, [[-.72, .6, -.26], [.72, .6, -.26]]],
  ];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  for (const [geo, mat, offsets] of parts) {
    const mesh = new THREE.InstancedMesh(geo, mat, n * offsets.length);
    mesh.name = 'Benches'; mesh.castShadow = true; mesh.receiveShadow = true;
    placed.forEach((s, i) => {
      const a = Math.atan2(s.look[0] - s.position[0], s.look[2] - s.position[2]);
      q.setFromAxisAngle(up, a);
      offsets.forEach((o, k) => {
        v.set(o[0], o[1], o[2]).applyQuaternion(q).add(new THREE.Vector3(...s.position));
        mesh.setMatrixAt(i * offsets.length + k, m.compose(v, q, one));
      });
    });
    mesh.computeBoundingSphere();
    world.scene.add(mesh);
  }
  return {placed, skipped};
}
