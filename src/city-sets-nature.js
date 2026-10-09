import {frame, pathFrom, along} from './city-sets-kit.js';

// Xuanwu Lake, Qixia's maples, the Purple Mountain plane-tree road and Niushou: composed from the best
// photographs of each (research/nanjing/BEST-VIEWS.md).

// --- Xuanwu Lake -----------------------------------------------------------------------------
export function xuanwu(c) {
  const {wet, tree, add, ground, places} = c, walk = c.walk, lake = c.shore;
  // Which side is the water?
  const i0 = Math.floor(walk.length / 2), t0 = along(walk, i0), q0 = walk[i0];
  const side = wet(q0[0] + t0.nx * 16, q0[2] + t0.nz * 16) ? 1 : -1;       // +1: the water is to the left of travel
  // Big camphor and plane trees leaning over the path, as in the photograph under the arch of branches.
  for (let i = 3; i < walk.length - 3; i += 3) {
    const p = walk[i], t = along(walk, i), off = 5.5 + c.random() * 3.5;
    tree(p[0] - t.nx * side * off, p[2] - t.nz * side * off, 2.0 + c.random() * .7, 0, {force: true});
  }
  // Lotus: broad leaves over the shallows, here and there a pink bloom.
  const leaf = c.cylinder;
  let leaves = 0, flowers = 0;
  for (let i = 0; i < walk.length; i += 2) {
    const p = walk[i], t = along(walk, i);
    for (let k = 0; k < 9; k++) {
      const off = 9 + c.random() * 34, jit = (c.random() - .5) * 8;
      const x = p[0] + t.nx * side * off + t.tx * jit, z = p[2] + t.nz * side * off + t.tz * jit;
      if (!wet(x, z) || lake(x, z, true) > -3) continue;
      const r = 1.1 + c.random() * 1.1;
      add(leaf, 'lotus', [x, 1.5, z], [r, .08, r]);
      leaves++;
      if (c.random() < .09) { add(c.sphere, 'blossom', [x, 2.3, z], [.34, .4, .34]); c.beam([x, 1.5, z], [x, 2.2, z], .03, 'lotus'); flowers++; }
    }
  }
  void leaves; void flowers;
  // Look across the lake at Zifeng Tower over the lotus and the old city wall.
  // The photographs look across the water at the tower. Turned all the way, the first frame would face
  // 80 degrees off the path; so turn towards it by at most 40 and let the visitor finish the turn.
  const zf = places.find(q => q.id === 'zifeng').position, s0 = walk[0], tw = along(walk, 0);
  const want = Math.atan2(zf[2] - s0[2], zf[0] - s0[0]), have = Math.atan2(tw.tz, tw.tx);
  let delta = Math.atan2(Math.sin(want - have), Math.cos(want - have));
  delta = Math.max(-.7, Math.min(.7, delta));
  const heading = have + delta, reach = Math.hypot(zf[0] - s0[0], zf[2] - s0[2]);
  return {walk, spawnIndex: 0, lookAt: [s0[0] + Math.cos(heading) * reach, zf[1] + 30, s0[2] + Math.sin(heading) * reach], weather: 'morning', season: 'summer'};
}

// --- Qixia: the red-maple boardwalk ---------------------------------------------------------------
export function qixia(c) {
  const {x, z, ground, tree, block, beam} = c;
  const corners = [[-44, 56], [-26, 48], [-6, 56], [16, 46], [34, 30], [44, 10], [46, -14], [36, -34], [16, -48]].map(([u, v]) => [x + u, z + v]);
  const walk = pathFrom(corners, ground, {spacing: 1.5, round: 2});
  // The deck, and a red railing either side: posts every 3 m, two rails.
  c.pave(walk, 3.4, 'plank', .5);
  for (let i = 0; i < walk.length - 2; i += 2) for (const side of [-1, 1]) {
    const p = walk[i], q = walk[Math.min(walk.length - 1, i + 2)], t = along(walk, i);
    const a = [p[0] + t.nx * side * 1.75, ground(p[0], p[2]) + .5, p[2] + t.nz * side * 1.75];
    const b = [q[0] + t.nx * side * 1.75, ground(q[0], q[2]) + .5, q[2] + t.nz * side * 1.75];
    block(a[0], a[1], a[2], .16, 1.1, .16, 'red');
    beam([a[0], a[1] + 1.0, a[2]], [b[0], b[1] + 1.0, b[2]], .06, 'red');
    beam([a[0], a[1] + .5, a[2]], [b[0], b[1] + .5, b[2]], .05, 'red');
  }
  // Maples either side, so close their red crowns meet over the walk; golden ginkgo and plane among them.
  for (let i = 0; i < walk.length; i += 2) {
    const p = walk[i], t = along(walk, i);
    for (const side of [-1, 1]) {
      const near = 3.4 + c.random() * 2.6, far = 8 + c.random() * 6;
      tree(p[0] + t.nx * side * near, p[2] + t.nz * side * near, 1.1 + c.random() * .7, c.random() < .78 ? 3 : 4, {force: true});
      if (i % 4 === 0) tree(p[0] + t.nx * side * far, p[2] + t.nz * side * far, 1.3 + c.random() * .8, c.random() < .6 ? 3 : 4, {force: true});
    }
  }
  return {walk, spawnIndex: 0, lookAhead: 36, lookDy: .2, weather: 'sunset', season: 'autumn',
    autumn: {x, z, r: 280}};
}

// --- Purple Mountain: the plane-tree road and the music stage -------------------------------------
/** Where the road begins and ends, and the stage, relative to the Purple Mountain pin. The pin is on the
 *  summit; the road runs along the flat belt at the mountain's foot, 230 m south of it. */
export const ZIJIN_ROAD = {z: 231, x0: -112, x1: 108, stage: 132};

export function zijin(c) {
  const {x, z, ground, add, block, tree, cylinder} = c;
  const rz = z + ZIJIN_ROAD.z, x0 = x + ZIJIN_ROAD.x0, x1 = x + ZIJIN_ROAD.x1, sx = x + ZIJIN_ROAD.stage;
  const walk = pathFrom([[x0, rz], [x1, rz]], ground, {spacing: 2, round: 0});
  c.pave(walk, 15.4, 'stone');
  c.pave(walk, 9.2, 'asphalt', .24);
  // Plane trees, tall and pale, their golden crowns meeting over the road; lamp posts between them.
  for (let u = x0 - 14; u < x1 + 6; u += 8.5) for (const side of [-1, 1]) {
    tree(u + c.random() * 2, rz + side * (7.6 + c.random() * 1.4), 1.6 + c.random() * .35, 4, {force: true});
    if (c.random() < .55) tree(u + 4 + c.random() * 2, rz + side * (13.5 + c.random() * 3), 1.5 + c.random() * .4, 4, {force: true});
  }
  for (let u = x0; u < x1; u += 34) for (const side of [-1, 1]) {
    const px = u, pz = rz + side * 5.6;
    block(px, ground(px, pz), pz, .22, 6.2, .22, 'white');
    add(c.sphere, 'lamp', [px, ground(px, pz) + 6.5, pz], [.4, .4, .4]);
  }
  // The music stage at the end of the road: a fan of stone terraces facing a white curved screen.
  const sy = ground(sx, rz);
  block(sx, sy, rz, 18, 1.1, 20, 'stone');                                   // the stage floor
  for (let k = 0; k < 15; k++) {                                             // the screen, an arc of white panels
    const a = -1.25 + k * (2.5 / 14), px = sx + 9 + Math.cos(a) * 9, pz = rz + Math.sin(a) * 11;
    block(px, sy + 1.1, pz, 1.2, 8.5 - Math.abs(a) * 2.6, 2.6, 'white', -a);
  }
  add(c.roof, 'blue', [sx + 18, sy + 9.6, rz], [4, 1.6, 12]);
  for (let ring = 0; ring < 9; ring++) {                                      // the audience's terraces, widening away from the stage
    const r = 17 + ring * 3.7, count = Math.floor(r * 2.45 / 3.3);
    for (let k = 0; k < count; k++) {
      const a = Math.PI - 1.22 + k * (2.44 / (count - 1));
      const px = sx + Math.cos(a) * r, pz = rz + Math.sin(a) * r;
      if (Math.abs(pz - rz) < 4.4 && px < sx - 10) continue;                  // the aisle the road runs down
      block(px, sy, pz, 3.5, .35 + ring * .26, 1.8, ring % 2 ? 'sage' : 'stone', -a + Math.PI / 2);
    }
  }
  void cylinder;
  return {walk, spawnIndex: 0, lookAhead: 130, lookDy: 3, weather: 'sunset', season: 'autumn',
    autumn: {x, z, r: 240}};
}
