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
  const g = new THREE.ExtrudeGeometry(s, {depth: width - 2 * bevel, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 6});
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

/** A saloon: {paint, trim}. paint: lower body and roof; trim: glasshouse, tyres, hubs, lamps, grille. */
export function carModel() {
  const lower = profile([[-2.3, .3], [2.3, .3], [2.32, .62, 1], [1.95, .86], [1.0, .93], [-1.75, .93], [-2.25, .86, 1], [-2.32, .56]], 1.78, .08);
  const roof = profile([[.42, 1.33], [.36, 1.42, 1], [.2, 1.47], [-.95, 1.47], [-1.08, 1.42, 1], [-1.12, 1.33]], 1.56, .05);
  const glass = profile([[1.02, .9], [.42, 1.36], [-1.12, 1.36], [-1.72, .9]], 1.5, .04);
  const trim = [tint(plain(glass), 0x3d4b58)];
  for (const [x, z] of [[-.83, 1.42], [.83, 1.42], [-.83, -1.42], [.83, -1.42]]) {
    trim.push(tint(plain(wheel(.33, .24, x, .33, z)), 0x1e1f21), tint(plain(wheel(.17, .26, x, .33, z, 10)), 0xb9bcbf));
  }
  for (const x of [-.6, .6]) {
    trim.push(tint(plain(box(.38, .13, .06, x, .7, 2.33)), 0xfff4d8), tint(plain(box(.4, .12, .06, x, .76, -2.33)), 0xc8302a));
  }
  trim.push(tint(plain(box(.8, .14, .05, 0, .5, 2.34)), 0x2a2d30));   // grille
  return {paint: mergeGeometries([plain(lower), plain(roof)]), trim: mergeGeometries(trim)};
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
  return {shell: mergeGeometries([plain(rear), plain(shield)]), trim: mergeGeometries(trim), coat, helmet: plain(helmet)};
}
