import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// The street traffic's models (src/world-traffic.js), drawn as instanced meshes. They follow the city's
// illustrated look: rounded, bevelled shapes under the same toon shading as the buildings, not boxes.
// Sizes are a typical Chinese family saloon (4.6 by 1.8 m) and a step-through e-bike; none is a
// particular make. Each model is split into the part painted per vehicle (one instanced colour) and
// the parts whose colours never change (glass, tyres, lamps, trousers), merged with vertex colours.
// Local frame: +z forward, +y up, the wheels' contact at y = 0.

/** Paint every vertex of `g` one colour (for merging parts into one draw). */
function tint(g, c) {
  const col = new THREE.Color(c), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
/** Drop the attributes mergeGeometries would refuse to mix (extrusions carry no others). */
const plain = g => { g = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'color'].includes(k)) g.deleteAttribute(k); return g; };

/**
 * A side profile (points [forward, up], drawn in order, `curves` marking corners rounded by a
 * quadratic through that point) extruded across `width`, bevelled, centred across x.
 */
function profile(points, width, bevel = .06) {
  const s = new THREE.Shape();
  points.forEach(([x, y, round], i) => {
    if (i === 0) s.moveTo(x, y);
    else if (round) { const [nx, ny] = points[(i + 1) % points.length]; s.quadraticCurveTo(x, y, (x + nx) / 2, (y + ny) / 2); }
    else s.lineTo(x, y);
  });
  const g = new THREE.ExtrudeGeometry(s, {depth: width - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 1, curveSegments: 4});
  // Shape x (forward) to world z; the extrusion (shape z) to world -x; centred.
  g.rotateY(-Math.PI / 2).translate((width - 2 * bevel) / 2, 0, 0);
  return g;
}
/** A capsule from a to b ([x, y, z]), radius r: limbs. */
function limb(a, b, r) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
  const g = new THREE.CapsuleGeometry(r, Math.max(.01, len), 3, 8);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()));
  return g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
}
const wheel = (r, w, x, y, z, seg = 14) => new THREE.CylinderGeometry(r, r, w, seg).rotateZ(Math.PI / 2).translate(x, y, z);
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);

// Body types and their shares of the cars drawn. SUV, saloon and MPV from China's 2024 retail sales
// (CPCA, first half: SUV 4.88 M, saloon 4.48 M, MPV 0.48 M); the saloons' split into saloon and
// hatchback, the taxis (Nanjing has 9,168 metered taxis and about 57,000 ride-hailing cars, which look
// like any other car) and the vans are ours. Dimensions are typical of each kind, not a make.
export const BODY_TYPES = [
  // [name, share, length, width, ride, belt, roof, front glass z, roof front z, roof rear z, rear glass z, wheel]
  ['suv', 47, 4.7, 1.88, .38, 1.08, 1.72, 1.08, .45, -1.85, -2.2, .37],
  ['saloon', 33, 4.65, 1.8, .3, .93, 1.47, 1.0, .42, -1.1, -1.72, .33],
  ['hatchback', 7, 4.15, 1.76, .3, .92, 1.5, .95, .35, -1.5, -1.92, .31],
  ['mpv', 5, 5.0, 1.88, .33, 1.02, 1.84, 1.55, 1.0, -2.1, -2.32, .35],
  ['taxi', 5, 4.65, 1.8, .3, .93, 1.47, 1.0, .42, -1.1, -1.72, .33],
  ['van', 3, 4.6, 1.76, .3, 1.0, 1.95, 1.95, 1.5, .55, .55, .31],
];

/**
 * A car of one body type: {paint, trim, plates}. paint: body, roof, pillars and mirrors (the car's own
 * colour); trim: glass, tyres, hubs, lamps, grille, roof rails or taxi sign; plates: front and back
 * (blue, or green for an electric car, set per car).
 */
export function carModel(type) {
  const [name, , L, W, ride, belt, roofH, fg, rf, rr, rg, wr] = BODY_TYPES.find(b => b[0] === type) || BODY_TYPES[1];
  const h = L / 2, van = name === 'van';
  const lower = profile([[-h, ride], [h, ride], [h + .03, belt - .3, 1], [h - .3, belt - .06], [fg, belt], [van ? -h + .05 : rg, belt],
    [-h + .06, belt - .07, 1], [-h - .02, ride + .25]], W, .08);
  const paint = [plain(lower)];
  const trim = [], gw = W - .28;
  if (van) {
    // A light van: the cab's glass, then the cargo box to the roof.
    trim.push(tint(plain(profile([[fg + .02, belt - .02], [rf, roofH - .1], [rr + .1, roofH - .1], [rr + .1, belt - .02]], gw, .04)), 0x3d4b58));
    paint.push(plain(profile([[rr + .12, belt - .05], [rr + .12, roofH], [-h + .04, roofH, 1], [-h, roofH - .1], [-h, belt - .05]], W - .02, .05)));
    paint.push(plain(box(W - .1, .08, rf - rr, 0, roofH - .04, (rf + rr) / 2)));
  } else {
    trim.push(tint(plain(profile([[fg + .02, belt - .02], [rf, roofH - .08], [rr, roofH - .08], [rg, belt - .02]], gw, .04)), 0x3d4b58));
    paint.push(plain(profile([[rf + .06, roofH - .12], [rf, roofH - .03, 1], [rf - .15, roofH], [rr + .12, roofH], [rr - .02, roofH - .03, 1], [rr - .06, roofH - .12]], gw + .08, .04)));
    // Pillars between the side windows: one on a saloon, two on the long bodies.
    const pillars = name === 'mpv' || name === 'suv' ? [rf + (rr - rf) * .38, rf + (rr - rf) * .74] : [(rf + rr) / 2];
    for (const z of pillars) paint.push(plain(box(gw + .03, roofH - belt - .05, .11, 0, (roofH + belt) / 2, z)));
  }
  // Mirrors at the foot of the windscreen.
  for (const x of [-1, 1]) paint.push(plain(box(.1, .12, .2, x * (W / 2 + .06), belt + .1, fg - .12)));
  // Tyres with pale hubs; lamps; grille.
  const axle = Math.min(1.45, h - .82);
  for (const [x, z] of [[-1, axle], [1, axle], [-1, -axle], [1, -axle]]) {
    trim.push(tint(plain(wheel(wr, .24, x * (W / 2 - .07), wr, z)), 0x1e1f21), tint(plain(wheel(wr * .5, .26, x * (W / 2 - .07), wr, z, 10)), 0xb9bcbf));
  }
  for (const x of [-1, 1]) {
    trim.push(tint(plain(box(.36, .12, .06, x * (W / 2 - .3), belt - .2, h + .02)), 0xfff4d8), tint(plain(box(.38, .12, .06, x * (W / 2 - .28), belt - .14, -h - .02)), 0xc8302a));
  }
  trim.push(tint(plain(box(W * .45, .14, .05, 0, ride + .2, h + .03)), 0x2a2d30));
  if (name === 'suv') for (const x of [-1, 1]) trim.push(tint(plain(box(.05, .05, rf - rr, x * (gw / 2 - .05), roofH + .04, (rf + rr) / 2)), 0x2a2d30));
  if (name === 'taxi') trim.push(tint(plain(box(.62, .2, .28, 0, roofH + .1, (rf + rr) / 2)), 0xfff0b8));
  const plates = mergeGeometries([plain(box(.44, .14, .03, 0, ride + .42, h + .05)), plain(box(.44, .14, .03, 0, belt - .32, -h - .05))]);
  return {paint: mergeGeometries(paint), trim: mergeGeometries(trim), plates};
}

/**
 * An e-bike and its rider: {shell, trim, coat, helmet}. shell: the scooter's painted body; trim: tyres,
 * seat, footboard, bars, the rider's trousers, face and shoes; coat: torso and arms; helmet.
 */
export function bikeModel() {
  // A step-through e-bike: rear body under the seat, a low footboard, the front shield and stem.
  const rear = profile([[-.82, .34], [-.12, .34], [.02, .5, 1], [-.12, .74], [-.78, .76, 1], [-.9, .52]], .34, .05);
  const shield = profile([[.4, .3], [.6, .34, 1], [.66, 1.0], [.54, 1.06, 1], [.46, .46]], .36, .04);
  const trim = [
    tint(plain(wheel(.25, .09, 0, .25, .66)), 0x1e1f21), tint(plain(wheel(.25, .09, 0, .25, -.62)), 0x1e1f21),
    tint(plain(box(.3, .06, .58, 0, .34, .12)), 0x3a3d40),                       // footboard
    tint(plain(box(.3, .08, .62, 0, .81, -.45)), 0x2a2b2d),                      // seat
    tint(plain(limb([0, 1.0, .6], [0, 1.18, .55], .03)), 0x3a3d40),              // stem
    tint(plain(limb([-.32, 1.18, .52], [.32, 1.18, .52], .025)), 0x3a3d40),      // bars
    tint(plain(box(.3, .2, .24, 0, .92, .8)), 0x6a6f73),                         // basket
    // The rider's legs: thighs along the seat, shins down to the footboard; face; shoes.
    tint(plain(limb([-.12, .9, -.4], [-.12, .86, .05], .085)), 0x2f3440), tint(plain(limb([.12, .9, -.4], [.12, .86, .05], .085)), 0x2f3440),
    tint(plain(limb([-.12, .86, .05], [-.12, .42, .12], .07)), 0x2f3440), tint(plain(limb([.12, .86, .05], [.12, .42, .12], .07)), 0x2f3440),
    tint(plain(box(.11, .08, .22, -.12, .4, .18)), 0x222222), tint(plain(box(.11, .08, .22, .12, .4, .18)), 0x222222),
    tint(plain(new THREE.SphereGeometry(.12, 10, 8).translate(0, 1.62, -.24)), 0xe6c4a3),
  ];
  // Torso leaning a little forward, arms reaching to the bars.
  const coat = mergeGeometries([plain(limb([0, 1.0, -.38], [0, 1.4, -.28], .17)),
    plain(limb([-.2, 1.38, -.27], [-.3, 1.17, .45], .055)), plain(limb([.2, 1.38, -.27], [.3, 1.17, .45], .055))]);
  const helmet = new THREE.SphereGeometry(.15, 12, 8, 0, Math.PI * 2, 0, Math.PI * .55).translate(0, 1.66, -.25);
  // A delivery rider's insulated box on the rack behind the seat (coloured per platform).
  const deliveryBox = box(.44, .4, .4, 0, 1.0, -.95);
  return {shell: mergeGeometries([plain(rear), plain(shield)]), trim: mergeGeometries(trim), coat, helmet: plain(helmet), box: plain(deliveryBox)};
}
