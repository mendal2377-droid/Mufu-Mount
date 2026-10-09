import {AXIS} from './city-terrain.js';
import {frame, pathFrom, arch} from './city-sets-kit.js';
import {jiming, qinhuai, mochou} from './city-sets-town.js';
import {xuanwu, qixia, zijin} from './city-sets-nature.js';

// Composed views. Each of these places is rebuilt to the framing of its best-known photograph
// (research/nanjing/BEST-VIEWS.md): the arrival camera stands where the photographer did, and
// everything in front of it is set out to match. The photographs are reference only; none is
// used as a texture or redistributed. Dimensions are the atlas's compressed ones.
//
// A set receives the builder helpers of city-scene.js and returns what the scene needs to put
// the visitor in the right place:
//   walk       the route, [x, y, z] samples (default: the scene's own)
//   spawnIndex which sample to start on
//   lookAt     where the first frame looks (world), or lookAhead metres along the route
//   weather    the light the view looks best in ('morning', 'sunset', ...), applied on arrival
//   season     'summer' | 'autumn', informational (the trees are planted in season)

// --- stone figures of the Sacred Way ----------------------------------------------------------
const STONE = 'brick';

function plinth(c, P, w, d) { c.block(...P(0, 0, 0), w, .45, d, STONE, c.yaw); }

const BEASTS = {
  lion(c, P, kneel) {
    const {add, block, beam, sphere} = c;
    plinth(c, P, 2.0, 3.0);
    add(sphere, STONE, P(0, 1.35, -.2), [.85, .85, 1.2], c.yaw);                // body
    add(sphere, STONE, P(0, 1.9, .65), [.62, .75, .6], c.yaw);                  // chest
    add(sphere, STONE, P(0, 2.55, .95), [.55, .52, .5], c.yaw);                 // head
    add(sphere, STONE, P(0, 2.5, .8), [.78, .74, .6], c.yaw);                   // mane
    for (const s of [-1, 1]) beam(P(s * .38, .45, .75), P(s * .38, 1.7, .55), .2, STONE);
    void block; void kneel;
  },
  xiezhi(c, P) {
    BEASTS.lion(c, P);
    c.beam(P(0, 3.0, 1.0), P(0, 3.9, 1.25), .1, STONE);                         // the single horn
  },
  camel(c, P, kneel) {
    const {add, beam, sphere} = c;
    plinth(c, P, 2.4, 5.4);
    const h = kneel ? 1.2 : 2.0;
    add(sphere, STONE, P(0, h + .7, 0), [1.1, .95, 2.1], c.yaw);                // body
    for (const z of [-.9, .7]) add(sphere, STONE, P(0, h + 1.9, z), [.62, .85, .62], c.yaw);   // two humps
    beam(P(0, h + 1.2, 1.7), P(0, h + 2.7, 2.35), .34, STONE);                  // neck
    add(sphere, STONE, P(0, h + 2.95, 2.65), [.4, .38, .7], c.yaw);             // head
    if (!kneel) for (const [x, z] of [[-.6, -1.4], [.6, -1.4], [-.6, 1.3], [.6, 1.3]]) beam(P(x, .4, z), P(x, h + .6, z), .22, STONE);
  },
  elephant(c, P, kneel) {
    const {add, beam, sphere} = c;
    plinth(c, P, 3.0, 5.6);
    const h = kneel ? 1.0 : 1.5;
    add(sphere, STONE, P(0, h + 1.3, -.2), [1.5, 1.4, 2.2], c.yaw);             // body
    add(sphere, STONE, P(0, h + 1.9, 2.0), [1.0, 1.1, .95], c.yaw);             // head
    for (const s of [-1, 1]) add(sphere, STONE, P(s * 1.05, h + 1.9, 1.7), [.1, .85, .75], c.yaw);   // ears
    beam(P(0, h + 1.5, 2.8), P(0, .6, 3.3), .36, STONE);                        // trunk
    if (!kneel) for (const [x, z] of [[-.8, -1.2], [.8, -1.2], [-.8, 1.1], [.8, 1.1]]) beam(P(x, .45, z), P(x, h + .9, z), .42, STONE);
  },
  horse(c, P, kneel) {
    const {add, beam, sphere} = c;
    plinth(c, P, 1.8, 4.2);
    const h = kneel ? .7 : 1.4;
    add(sphere, STONE, P(0, h + .85, 0), [.68, .78, 1.45], c.yaw);              // body
    beam(P(0, h + 1.25, 1.0), P(0, h + 2.15, 1.7), .3, STONE);                  // neck
    add(sphere, STONE, P(0, h + 2.3, 2.1), [.27, .31, .55], c.yaw);             // head
    for (const s of [-1, 1]) beam(P(s * .22, h + 2.6, 1.75), P(s * .22, h + 2.95, 1.7), .06, STONE);   // ears
    add(sphere, STONE, P(0, h + 1.65, -.2), [.5, .12, .65], c.yaw);             // saddle
    if (!kneel) for (const [x, z] of [[-.38, -.9], [.38, -.9], [-.38, .9], [.38, .9]]) beam(P(x, .45, z), P(x, h + .5, z), .14, STONE);
  },
  qilin(c, P, kneel) {
    BEASTS.horse(c, P, kneel);
    c.beam(P(0, 4.0, 1.9), P(0, 4.9, 2.1), .08, STONE);                         // a horn on a horse's body
  },
  /** A standing official or general (weng zhong): robed column, hands together, tall hat. */
  official(c, P, general) {
    const {add, block, sphere, cylinder} = c;
    block(...P(0, 0, 0), 1.2, .5, 1.2, STONE, c.yaw);
    add(cylinder, STONE, P(0, 2.2, 0), [.52, 3.4, .42], c.yaw);                 // robe
    add(sphere, STONE, P(0, 1.2, .2), [.62, .4, .5], c.yaw);                    // hem
    block(...P(0, 3.0, .38), .5, .36, .26, STONE, c.yaw);                       // hands holding the tablet
    add(sphere, STONE, P(0, 4.15, 0), [.3, .34, .3], c.yaw);                    // head
    if (general) { add(sphere, STONE, P(0, 4.4, 0), [.38, .3, .38], c.yaw); block(...P(0, 4.7, 0), .12, .5, .12, STONE, c.yaw); }
    else block(...P(0, 4.38, 0), .62, .62, .3, STONE, c.yaw);                   // the official's flat-topped cap
  },
};

/** The Sacred Way of Ming Xiaoling, photographed down its length: paired beasts either side of a stone
 *  road, clipped hedges, tall trees overhead. The real way is bent; so is this one. */
function sacredWay(c) {
  const {x, z, ground, tree, add, sphere} = c;
  const ax = x - 50;                                      // the long straight, 50 m west of the gate
  const corners = [[ax, z + 185], [ax, z + 44], [ax + 8, z + 42], [x - 12, z + 42], [x, z + 38], [x, z + 12]];
  const walk = pathFrom(corners, ground, {spacing: 2, round: 2});
  c.pave(walk, 8.6, 'stone');
  // Beasts in the order the Ming gave them: lions, xiezhi, camels, elephants, qilin, horses.
  const order = ['lion', 'xiezhi', 'camel', 'elephant', 'qilin', 'horse'];
  order.forEach((kind, i) => {
    const zz = z + 168 - i * 17;
    for (const side of [-1, 1]) {
      const bx = ax + side * 7.4, kneel = (i + (side > 0 ? 1 : 0)) % 2 === 0;
      const yaw = side > 0 ? -Math.PI / 2 : Math.PI / 2, y0 = ground(bx, zz);
      c.yaw = yaw;
      BEASTS[kind](c, frame(bx, y0, zz, yaw), kneel);
    }
  });
  // The column pair at the bend, then officials either side of the way to the gate.
  for (const side of [-1, 1]) {
    const px = ax + side * 7.4, pz = z + 56;
    add(c.cylinder, STONE, [px, ground(px, pz) + 3.2, pz], [.62, 6.4, .62]);
    add(sphere, STONE, [px, ground(px, pz) + 6.5, pz], [.75, .6, .75]);
  }
  [[x - 38, true], [x - 24, false]].forEach(([ux, general]) => {
    for (const side of [-1, 1]) {
      const oz = z + 42 + side * 7, y0 = ground(ux, oz), yaw = side > 0 ? Math.PI : 0;
      c.yaw = yaw;
      BEASTS.official(c, frame(ux, y0, oz, yaw), general);
    }
  });
  // Clipped yew hedges on either side of the long straight, as in the photographs.
  for (let hz = z + 172; hz > z + 52; hz -= 1.5) for (const side of [-1, 1]) {
    const hx = ax + side * 4.9;
    add(sphere, 'sage', [hx, ground(hx, hz) + .5, hz], [.95, .78, 1.0]);
  }
  for (let hx = ax + 12; hx < x - 8; hx += 1.5) for (const side of [-1, 1]) {
    if (hx > x - 44 && hx < x - 18) continue;                             // clear around the officials
    const hz = z + 42 + side * 4.9;
    add(sphere, 'sage', [hx, ground(hx, hz) + .5, hz], [1.0, .78, .95]);
  }
  // Tall broadleaf and cedar trees meeting overhead, planted where the picture needs them.
  for (let tz = z + 190; tz > z + 40; tz -= 7) for (const side of [-1, 1]) {
    const jx = c.random(), jz = c.random();
    tree(ax + side * (11 + jx * 6), tz + jz * 4, 1.5 + c.random() * .55, c.random() < .22 ? 1 : 0, {force: true});
    if (c.random() < .6) tree(ax + side * (19 + jx * 8), tz + 3 + jz * 3, 1.3 + c.random() * .5, 0, {force: true});
  }
  return {walk, spawnIndex: 0, lookAhead: 70, lookDy: .6, weather: 'morning', season: 'summer'};
}

/** The Boai memorial archway: four white pillars and three blue-roofed spans. */
function paifang(c, xx, yy, zz) {
  const {block, add, sphere, roof} = c;
  for (const dx of [-10, -4, 4, 10]) { block(xx + dx, yy, zz, .75, 10, .75, 'white'); add(sphere, 'white', [xx + dx, yy + 10.4, zz], [.55, .55, .55]); }
  for (const [dx, w, h] of [[0, 9, 8.3], [-7, 6, 6.8], [7, 6, 6.8]]) {
    block(xx + dx, yy + h - 1, zz, w, 1, .7, 'white'); add(roof, 'blue', [xx + dx, yy + h, zz], [w + 1, 3, 3]);
  }
}

/** The Sun Yat-sen Mausoleum, photographed up its axis from the archway: dark cedars either side,
 *  the three-doored tomb gate, the stele pavilion, the great stair, the blue-roofed hall at the top. */
function mausoleum(c) {
  const {ground, tree, block, add, roof, sphere} = c;
  const mx = c.x + AXIS.du, mz = c.z + AXIS.dv;
  const y0 = v => ground(mx, mz + v);
  // The approach, from the archway down the avenue to the foot of the first flight.
  const approach = pathFrom([[mx, mz + 200], [mx, mz + 101]], ground, {spacing: 1, round: 0});
  c.pave(approach, 9, 'stone');
  paifang(c, mx, y0(150), mz + 150);
  c.plaque('博爱', {x: mx, y: y0(150) + 7.2, z: mz + 150.45, w: 6.2, h: 1.7, bg: '#2f4a73', fg: '#f0d98a'});
  // Cedars in four ranks, taller towards the hall: the dark walls of every photograph.
  for (let v = 142; v > 96; v -= 4.2) for (const side of [-1, 1]) {
    const j = c.random();
    tree(mx + side * (9.5 + j * 2), mz + v + j * 2, 1.6 + c.random() * .5, 1, {force: true});
    tree(mx + side * (16 + j * 5), mz + v + 2, 1.5 + c.random() * .5, 1, {force: true});
  }
  for (let v = 96; v > 60; v -= 6) for (const side of [-1, 1]) tree(mx + side * (24 + c.random() * 6), mz + v, 1.4 + c.random() * .4, 1, {force: true});
  // Tomb gate: a white wall of three arched doors under a blue hip roof, wings either side.
  const gy = y0(100);
  c.footing(mx, mz + 100, 36, 8, gy);
  arch(c, mx, gy, mz + 100, 24, 11, 5, [-8, 0, 8].map(x => ({x, r: x ? 2.5 : 3.2, spring: x ? 4.4 : 5.2})), 'white');
  add(roof, 'blue', [mx, gy + 11, mz + 100], [30, 6, 12]);
  for (const side of [-1, 1]) { block(mx + side * 21, gy, mz + 100, 18, 5.5, 3.2, 'white'); block(mx + side * 21, gy + 5.5, mz + 100, 19, .7, 3.8, 'blue'); }
  // Stele pavilion: a square white pavilion open on four sides, blue roof and a gilt finial.
  const py = y0(80);
  c.footing(mx, mz + 80, 14, 14, py);
  block(mx, py, mz + 80, 13, 1, 13, 'white');
  arch(c, mx, py + 1, mz + 80, 11, 8, 1.4, [{x: 0, r: 2.7, spring: 3.4}], 'white');
  arch(c, mx, py + 1, mz + 80, 11, 8, 1.4, [{x: 0, r: 2.7, spring: 3.4}], 'white', Math.PI / 2);
  add(roof, 'blue', [mx, py + 9, mz + 80], [16, 6, 16]);
  c.beam([mx, py + 12, mz + 80], [mx, py + 14.5, mz + 80], .15, 'bronze');
  // The existing walk begins at the foot of the avenue; join the new approach to it.
  const walk = [...approach.slice(0, -1), ...c.walk];
  void sphere;
  return {walk, spawnIndex: 0, lookAhead: 110, lookDy: 3, weather: 'morning', season: 'summer'};
}

export function buildVista(p, c) {
  const sets = {xiaoling: sacredWay, zhongshan: mausoleum, jiming, qinhuai, mochou, xuanwu, qixia, zijin};
  const fn = sets[p.id];
  return fn ? fn({...c, x: p.position[0], y: p.position[1], z: p.position[2], id: p.id}) : null;
}

