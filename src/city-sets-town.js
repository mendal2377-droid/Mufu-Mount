import {frame, pathFrom, arch, townHouse, groundSpan, along} from './city-sets-kit.js';

// Jiming Temple, the Qinhuai waterfront and Mochou Lake: composed from the best photographs of each
// (research/nanjing/BEST-VIEWS.md).

// --- Jiming Temple -----------------------------------------------------------------------------
/** A peach-walled temple hall with a grey tiled roof, its front turned towards the axis. */
function peachHall(c, cx, cz, side) {
  const {block, add, roof, ground} = c;
  const yaw = side < 0 ? Math.PI / 2 : -Math.PI / 2, y = ground(cx, cz), P = frame(cx, y, cz, yaw);
  const w = 18, d = 12, h = 7;
  c.footing(cx, cz, 14, 20, y);
  block(...P(0, 0, 0), w, h, d, 'pink', yaw);
  add(roof, 'slate', P(0, h, 0), [w + 3.4, 5.2, d + 3.6], yaw);
  block(...P(0, h + 2.55, 0), w * .7, .35, .6, 'slate', yaw);
  for (const s of [-1, 1]) add(c.sphere, 'gold', P(s * (w * .55), h + .3, 0), [.5, .6, .5], yaw);
  for (let i = -3; i <= 3; i++) {
    block(...P(i * 2.5, 0, d / 2 + .25), .4, 5.6, .4, 'red', yaw);
    if (i < 3) block(...P(i * 2.5 + 1.25, .3, d / 2 + .1), 1.9, 4.2, .15, i % 2 ? 'roof' : 'glass', yaw);
  }
  block(...P(0, 5.6, d / 2 + .25), w * .95, .5, .5, 'red', yaw);
}

export function jiming(c) {
  const {x, z, ground, block, add, tree, sphere} = c;
  // The Presidential Palace's garden halls stand 80 m south of this pagoda, so the axis is short: the
  // visitor starts in the temple's outer court and looks up it at the pagoda, as in the photograph
  // taken from the plaza.
  const walk = pathFrom([[x, z + 72], [x, z + 18]], ground, {spacing: 2, round: 0});
  c.pave(walk, 7.5, 'stone');
  // Two pairs of peach halls flank the path, with a yellow outer wall beyond them.
  for (const v of [30, 54]) for (const side of [-1, 1]) peachHall(c, x + side * 21, z + v, side);
  for (const side of [-1, 1]) for (let v = 20; v < 70; v += 6) block(x + side * 40, ground(x + side * 40, z + v), z + v, 1.6, 3.2, 6.2, 'ochre');
  // The incense burner and pairs of clipped trees, like the temple's own courtyards.
  const by = ground(x, z + 34);
  add(c.cylinder, 'bronze', [x, by + 1.1, z + 34], [1.3, 2.2, 1.3]);
  block(x, by, z + 34, 3.4, .5, 3.4, 'stone');
  for (const v of [28, 46, 62]) for (const side of [-1, 1]) {
    add(sphere, 'sage', [x + side * 6.8, ground(x + side * 6.8, z + v) + 2.4, z + v], [1.5, 2.3, 1.5]);
    block(x + side * 6.8, ground(x + side * 6.8, z + v), z + v, .4, 1.6, .4, 'bark');
  }
  for (let v = 84; v > 20; v -= 11) for (const side of [-1, 1]) tree(x + side * (36 + c.random() * 9), z + v, 1.4 + c.random() * .6, 0, {force: true});
  return {walk, spawnIndex: 0, lookAt: [x, ground(x, z) + 27, z], weather: 'morning', season: 'summer'};
}

// --- Qinhuai: Confucius Temple waterfront -----------------------------------------------------
/** Kuiguang Pavilion's relative: a tall red pavilion of three stacked gold roofs on a white plinth. */
function kuiguang(c, px, pz, k = 1.4) {
  const {block, add, roof, sphere, ground} = c, y = ground(px, pz);
  c.footing(px, pz, 18 * k, 18 * k, y + 1.2);
  block(px, y, pz, 16 * k, 1.2, 16 * k, 'white');
  let yy = y + 1.2;
  [[11, 5.4], [8.6, 4.4], [6, 3.6]].map(([w, h]) => [w * k, h * k]).forEach(([w, h], i) => {
    block(px, yy, pz, w, h, w, 'red');
    block(px, yy + h * .4, pz, w + .2, h * .5, w + .2, 'glow');                       // lit like the night photographs
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) block(px + dx * w / 2, yy, pz + dz * w / 2, .5, h, .5, 'red');
    add(roof, 'gold', [px, yy + h, pz], [w + 7.5 - i, (4.6 - i * .4) * k, w + 7.5 - i]);
    for (const dx of [-1, 1]) for (const dz of [-1, 1]) add(sphere, 'gold', [px + dx * (w / 2 + 3.2), yy + h + .4, pz + dz * (w / 2 + 3.2)], [.5, .5, .5]);
    yy += h + 1.6;
  });
  c.beam([px, yy - 1, pz], [px, yy + 4.5, pz], .18, 'bronze');
  add(sphere, 'gold', [px, yy + 4.8, pz], [.5, .7, .5]);
}

export function qinhuai(c) {
  const {x, z, ground, block, add, sphere} = c;
  const cz = z - 44, half = 9;                                    // the canal's centre line and half width
  // Water level: just above the highest ground it crosses, so the canal reads as a channel.
  let gmax = -Infinity;
  for (let u = -130; u <= 130; u += 10) for (const d of [-14, 0, 14]) gmax = Math.max(gmax, ground(x + u, cz + d));
  const wy = Math.max(1.2, gmax) + .25, top = wy + .7;
  const bend = u => Math.sin(u / 52) * 3.2;
  const canal = [];
  for (let u = -135; u <= 135; u += 9) canal.push([x + u, wy, cz + bend(u)]);
  const water = c.ribbon(canal, half * 2, 0);
  add(water, 'water'); water.dispose();
  // Raised stone embankments, white balustrades and a promenade on each bank.
  for (const side of [-1, 1]) {
    for (let u = -135; u < 135; u += 6) {
      const bz = cz + bend(u) + side * (half + 3.4), bx = x + u + 3;
      const [lo] = groundSpan(ground, bx, bz, 6.2, 6.8);
      block(bx, Math.min(lo, top) - .4, bz, 6.2, top - Math.min(lo, top) + .4, 6.8, 'stone');
      const ez = cz + bend(u) + side * (half + .6);
      block(bx - 3, top, ez, .35, 1.05, .35, 'white');
      c.beam([bx - 3, top + .95, ez], [bx + 3, top + .95, ez], .09, 'white');
    }
  }
  // The promenade the visitor walks, on the south bank.
  const walk = [];
  for (let u = -78; u <= 100; u += 2) walk.push([x + u, top + .3, cz + bend(u) + half + 3.4]);
  // Old waterfront houses on both banks, fronts to the water, strings of lanterns across the way.
  for (let i = 0; i < 8; i++) {
    const u = -96 + i * 28, nz = cz + bend(u) - half - 14;
    if (Math.abs(u - 14) < 32) continue;                              // the pavilion's court
    townHouse(c, x + u, nz, 0, {w: 12 + (i % 3), d: 9, h: 6 + (i % 2) * 1.5});
  }
  for (let i = 0; i < 7; i++) {
    const u = -84 + i * 30;
    townHouse(c, x + u, cz + bend(u) + half + 24, Math.PI, {w: 13, d: 9, h: 6.5 + (i % 2)});
  }
  // The temple pavilion on the far bank, and the memorial archway where the promenade begins.
  kuiguang(c, x + 14, cz - half - 26);
  const ay = ground(x - 120, cz + half + 3.4);
  for (const dx of [-5, 5]) { block(x - 120 + dx, top, cz + bend(-120) + half + 3.4, .8, 9, .8, 'white'); add(sphere, 'white', [x - 120 + dx, top + 9.4, cz + bend(-120) + half + 3.4], [.55, .55, .55]); }
  block(x - 120, top + 7.6, cz + bend(-120) + half + 3.4, 11, 1, .8, 'white');
  add(c.roof, 'gold', [x - 120, top + 8.6, cz + bend(-120) + half + 3.4], [12, 3, 4]);
  c.plaque('夫子庙', {x: x - 120, y: top + 7.6, z: cz + bend(-120) + half + 3.85, w: 7, h: 1.5, bg: '#6e2a1f', fg: '#e3bd62'});
  // Lantern strings across the canal.
  for (let u = -100; u <= 100; u += 25) {
    const a = [x + u, top + 6.5, cz + bend(u) - half - 1], b = [x + u, top + 6.5, cz + bend(u) + half + 1];
    let prev = null;
    for (let k = 0; k <= 8; k++) {
      const f = k / 8, p = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - Math.sin(f * Math.PI) * 1.4, a[2] + (b[2] - a[2]) * f];
      if (prev) c.beam(prev, p, .04, 'bronze');
      if (k) c.lantern(p[0], p[1] - .5, p[2], .85);
      prev = p;
    }
  }
  void ay;
  // Gold-roofed pleasure boats on the canal (moored here; the app also moves a few).
  const path = canal.map(([bx, , bz]) => [bx, wy + .05, bz]);
  return {walk, spawnIndex: 0, lookAt: [x + 14, wy + 12, cz - half - 26], weather: 'sunset', season: 'summer',
    boats: {path, count: 4, wy}};
}

// --- Mochou Lake ---------------------------------------------------------------------------------
function lakePavilion(c, px, pz, yaw) {
  const {block, add, roof, sphere, ground} = c, y = ground(px, pz), P = frame(px, y, pz, yaw);
  c.footing(px, pz, 16, 13, y);
  block(...P(0, 0, 0), 15, .9, 11.5, 'stone', yaw);
  block(...P(0, .9, 0), 12, 4.1, 8, 'white', yaw);                         // lower storey
  for (const dx of [-5.8, -2, 2, 5.8]) block(...P(dx, .9, 4.1), .45, 4.1, .45, 'red', yaw);
  block(...P(0, 5, 0), 15.4, .3, 12.2, 'red', yaw);                         // balcony floor
  for (let i = -7; i <= 7; i++) block(...P(i, 5.3, 6.1), .18, 1.1, .18, 'red', yaw);
  block(...P(0, 6.3, 6.1), 15.4, .2, .2, 'red', yaw);
  block(...P(0, 5.3, 0), 10, 3.7, 6.4, 'white', yaw);                       // upper storey
  for (const dx of [-3.6, 0, 3.6]) block(...P(dx, 6, 3.25), 2, 2.1, .14, 'lamp', yaw);
  add(roof, 'slate', P(0, 5.2, 0), [18.5, 3.4, 14.4], yaw);                 // lower eave
  add(roof, 'slate', P(0, 9, 0), [14.4, 4.6, 10.6], yaw);                   // upper roof
  for (const s of [-1, 1]) for (const t of [-1, 1]) add(sphere, 'gold', P(s * 8.2, 5.6, t * 6.4), [.4, .45, .4], yaw);
  block(...P(0, 11.2, 0), 9, .35, .5, 'slate', yaw);
  for (let i = 0; i < 6; i++) block(...P(-6 + i * 2.4, 0, 8), 2.4, .3 + i * .0, .9, 'stone', yaw);    // steps
}

function statue(c, sx, sz) {
  const {add, sphere, cylinder, ground} = c, y = ground(sx, sz);
  for (let i = 0; i < 9; i++) {                                              // the rockery
    const a = i * 2.4, r = 1.2 + (i % 3) * 1.1;
    add(sphere, 'stone', [sx + Math.cos(a) * r, y + .5 + (i % 2) * .5, sz + Math.sin(a) * r], [1.3 + (i % 3) * .3, 1 + (i % 2) * .6, 1.3]);
  }
  add(cylinder, 'white', [sx, y + 3.4, sz], [.55, 3.2, .45]);                // the white figure
  add(sphere, 'white', [sx, y + 5.3, sz], [.34, .4, .34]);
  add(sphere, 'white', [sx, y + 4.6, sz], [.75, .35, .5]);
  for (let i = 0; i < 12; i++) add(sphere, 'wall', [sx + Math.cos(i * 1.3) * 3.4, y + .9 + (i % 3) * .3, sz + Math.sin(i * 1.3) * 3.4], [.25, .25, .25]);   // red quince blossom
}

export function mochou(c) {
  const {wet, tree, ground} = c, walk = c.walk;
  const i0 = Math.round(walk.length * .6), q = walk[i0], t = along(walk, i0);
  // Which side of the path is the water?
  let side = wet(q[0] + t.nx * 14, q[2] + t.nz * 14) ? 1 : -1;
  if (!wet(q[0] + t.nx * side * 14, q[2] + t.nz * side * 14)) side = -side;
  const nx = t.nx * side, nz = t.nz * side;                                  // towards the water
  const yaw = Math.atan2(nx, nz);
  lakePavilion(c, q[0] - nx * 14, q[2] - nz * 14, yaw);
  const i1 = Math.min(walk.length - 2, i0 + 16), q1 = walk[i1], t1 = along(walk, i1);
  statue(c, q1[0] - nx * 9, q1[2] - nz * 9);
  // Weeping willows along the bank, leaning over the path, and a few big shade trees behind.
  const spawn = Math.max(0, i0 - 22), s0 = walk[spawn], pav = [q[0] - nx * 14, q[2] - nz * 14];
  const clear = (px, pz) => {                                              // keep the view from the first step to the pavilion open
    const dx = pav[0] - s0[0], dz = pav[1] - s0[2], f = Math.max(0, Math.min(1, ((px - s0[0]) * dx + (pz - s0[2]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(px - s0[0] - dx * f, pz - s0[2] - dz * f) > 11;
  };
  for (let i = 4; i < walk.length - 4; i += 4) {
    const p = walk[i], tt = along(walk, i);
    if (!clear(p[0] - tt.nx * side * 6, p[2] - tt.nz * side * 6)) continue;
    tree(p[0] - tt.nx * side * (4.5 + c.random() * 3), p[2] - tt.nz * side * (4.5 + c.random() * 3), 1.5 + c.random() * .6, 2, {force: true});
    if (i % 8 === 0) tree(p[0] - tt.nx * side * (14 + c.random() * 8), p[2] - tt.nz * side * (14 + c.random() * 8), 1.6 + c.random() * .5, 0, {force: true});
  }
  void t1; void ground;
  return {walk, spawnIndex: Math.max(0, i0 - 22), lookAt: [q[0] - nx * 14, ground(q[0] - nx * 14, q[2] - nz * 14) + 8, q[2] - nz * 14], weather: 'sunset', season: 'summer'};
}
