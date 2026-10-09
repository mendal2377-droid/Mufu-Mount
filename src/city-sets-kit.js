import {chaikin, resample} from './city-network.js';
import {archWall} from './city-landmarks.js';

// Small pieces shared by the composed views (city-sets*.js).

/** Local frame at (ox, oy, oz) turned by yaw, matching block()'s yaw: forward is +z at yaw 0. */
export function frame(ox, oy, oz, yaw) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return (lx, ly, lz) => [ox + lx * c + lz * s, oy + ly, oz - lx * s + lz * c];
}

/** A path through 2D corners, smoothed and sampled every `spacing` m onto the ground. */
export function pathFrom(corners, ground, {spacing = 2, round = 2} = {}) {
  return resample(chaikin(corners, round), spacing, ground);
}

/** Wall with round-headed openings, placed by its foot. */
export function arch(c, x, y, z, w, h, d, openings, mat, yaw = 0) {
  const g = archWall(w, h, d, openings);
  c.add(g, mat, [x, y, z], [1, 1, 1], yaw);
  g.dispose();
}

/** Lowest and highest ground under a rectangle. */
export function groundSpan(ground, x, z, w, d) {
  let lo = Infinity, hi = -Infinity;
  for (const u of [-.5, 0, .5]) for (const v of [-.5, 0, .5]) {
    const y = ground(x + u * w, z + v * d);
    lo = Math.min(lo, y); hi = Math.max(hi, y);
  }
  return [lo, hi];
}

/** Direction of travel and its left-hand normal at sample i of a walk. */
export function along(walk, i) {
  const a = walk[Math.max(0, i - 1)], b = walk[Math.min(walk.length - 1, i + 1)];
  const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1;
  return {tx: dx / len, tz: dz / len, nx: -dz / len, nz: dx / len};
}

/**
 * A half-timbered, white-walled, dark-tiled house of the old waterfront, its front turned to
 * `yaw` (forward is +z), with a lit ground floor and a string of lanterns under the eaves.
 */
export function townHouse(c, cx, cz, yaw, {w = 11, d = 8, h = 6, roofMat = 'slate', wall = 'white', lit = true} = {}) {
  const {block, add, roof} = c;
  const y = c.ground(cx, cz), P = frame(cx, y, cz, yaw);
  c.footing(cx, cz, w + 1, d + 1, y);
  block(...P(0, 0, 0), w, h, d, wall, yaw);
  add(roof, roofMat, P(0, h, 0), [w + 3, 4.2, d + 3.4], yaw);
  block(...P(0, h + 1.9, 0), w * .7, .3, .5, roofMat, yaw);
  for (const s of [-1, 1]) {                                     // stepped gable ends, as on the old houses
    block(...P(s * (w / 2 + .1), h * .35, 0), .3, h * .75, d * .86, wall, yaw);
    block(...P(s * (w / 2 + .1), h * 1.1, 0), .5, .5, d * .5, roofMat, yaw);
  }
  const front = d / 2 + .12;
  for (let i = -2; i <= 2; i++) {
    block(...P(i * w * .2, 1.0, front), w * .12, 2.2, .14, lit ? 'lamp' : 'glass', yaw);   // windows glowing at dusk
    block(...P(i * w * .2, 3.6, front), w * .11, 1.6, .12, 'roof', yaw);
  }
  block(...P(0, h * .7, front + .3), w * .9, .16, .5, 'red', yaw);                           // the eaves rail
  const l = P(-w * .4, h * .62, front + .7), r = P(w * .4, h * .62, front + .7);
  c.lantern(l[0], l[1], l[2], .8); c.lantern(r[0], r[1], r[2], .8);
}
