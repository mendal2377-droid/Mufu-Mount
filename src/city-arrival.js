// How a visitor arrives at a landmark.
//
// Measured on the previous release: 8 of 18 arrivals faced 66–135° away from
// the road they stood on, because every loop-shaped walk begins tangent to the
// landmark and the camera was pointed at the landmark instead. Pressing W then
// walked straight into the edge of a 5 m corridor. Spawns were also 6–85 m from
// the landmark, so tall ones were seen from their foot and none read as a
// whole silhouette.
//
// The fix is geometric rather than a tuned camera: every walk begins on a
// straight avenue whose far end is the right framing distance away and whose
// heading points at the landmark. The camera looks along the road, and the
// landmark is the thing at the end of it.

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Approximate model-space size of the thing worth framing at each place:
// h is its height, w its widest dimension. These describe the game's compressed
// models, not the real buildings.
export const EXTENT = {
  mufu: { h: 20, w: 90 },
  bridge: { h: 46, w: 120 },
  yuejiang: { h: 38, w: 36 },
  xuanwu: { h: 14, w: 90 },
  jiming: { h: 44, w: 44 },
  zifeng: { h: 115, w: 50 },
  zijin: { h: 25, w: 120 },
  zhongshan: { h: 30, w: 60 },
  xiaoling: { h: 25, w: 50 },
  palace: { h: 26, w: 46 },
  qinhuai: { h: 14, w: 110 },
  zhonghua: { h: 24, w: 80 },
  mendong: { h: 12, w: 90 },
  mochou: { h: 12, w: 70 },
  eye: { h: 34, w: 60 },
  third: { h: 42, w: 120 },
  niushou: { h: 32, w: 120 },
  qixia: { h: 28, w: 80 },
};

/** Distance at which the landmark fills roughly a third of the view. */
export function framingDistance(id) {
  const e = EXTENT[id] || { h: 30, w: 60 };
  // A 68° vertical field of view: height h fills ~24° at 2.35·h. Width is
  // judged against the narrower horizontal fit.
  // A 115 m tower needs room to be seen whole; 175 m left only its lower third in frame.
  return clamp(Math.max(e.h * 2.35, e.w * 0.85), 60, e.h > 90 ? 250 : 175);
}

/** Landmark fronts face +z (south), as Chinese halls do; try that bearing first. */
export const BEARINGS = [0, 25, -25, 50, -50, 80, -80, 110, -110, 140, -140, 180];

const flat = ground => (x, z) => Math.max(1.7, ground(x, z)) + 0.3;

/**
 * Plan a straight approach avenue onto a loop walk.
 *
 * @param {object} o
 * @param {number} o.x @param {number} o.z   landmark centre
 * @param {number} o.radius                   radius of the loop walk
 * @param {number} o.distance                 how far from the centre the avenue starts
 * @param {(x:number,z:number)=>number} o.ground
 * @param {(x:number,z:number)=>boolean} o.wet
 * @param {Array<[number,number,number]>} [o.avoid]  other places: [x, z, clearance]
 * @param {number} [o.targetY]  height of the part of the landmark that should be visible
 *        from the far end; bearings with a clear sight line are preferred
 * @returns {null | {bearing:number, points:number[][], junction:number[], far:number[], visible:boolean}}
 *          points run from the far end to the junction with the loop
 */
export function planAvenue({ x, z, radius, distance, ground, wet, avoid = [], bearings = BEARINGS, targetY = null }) {
  const height = flat(ground);
  const length = Math.max(30, distance - radius);
  const step = 2;
  const count = Math.ceil(length / step);
  const candidates = [];
  for (const deg of bearings) {
    const a = deg * DEG, sx = Math.sin(a), sz = Math.cos(a);
    const points = [];
    let ok = true, last = null;
    for (let i = 0; i <= count && ok; i++) {
      const d = radius + length - (i / count) * length; // far → junction
      const px = x + sx * d, pz = z + sz * d;
      // Wet ground, either side of the line, would put the road in a lake.
      if (wet(px, pz) || wet(px + sz * 3.5, pz - sx * 3.5) || wet(px - sz * 3.5, pz + sx * 3.5)) ok = false;
      const py = height(px, pz);
      if (last && Math.abs(py - last[1]) > 1.0) ok = false; // steeper than 1 : 2
      for (const [ax, az, clearance] of avoid) {
        if (Math.hypot(px - ax, pz - az) < clearance) ok = false;
      }
      points.push([px, py, pz]);
      last = [px, py, pz];
    }
    if (!ok) continue;
    const plan = { bearing: deg, points, junction: points.at(-1), far: points[0], visible: true };
    if (targetY == null) return plan;
    plan.visible = lineOfSight({ x, z, sx, sz, from: radius + length, ground, eye: points[0][1] + 1.7, targetY });
    candidates.push(plan);
    if (plan.visible) return plan;
  }
  // No bearing sees the landmark whole; a hidden one still beats none.
  return candidates[0] || null;
}

/** Does the terrain stay below the sight line from the avenue's far end to the landmark? */
function lineOfSight({ x, z, sx, sz, from, ground, eye, targetY }) {
  const steps = Math.ceil(from / 5);
  for (let i = 1; i < steps; i++) {
    const f = i / steps, d = from * (1 - f);
    const lineY = eye + (targetY - eye) * f;
    if (ground(x + sx * d, z + sz * d) > lineY - 0.8) return false;
  }
  return true;
}

/** A closed loop that starts and ends at `bearing`, so it joins an avenue cleanly. */
export function loopFrom({ x, z, radius, bearing, ground, count = 48 }) {
  const height = flat(ground), a0 = bearing * DEG;
  return Array.from({ length: count + 1 }, (_, i) => {
    const a = a0 + (i / count) * Math.PI * 2;
    const px = x + Math.sin(a) * radius, pz = z + Math.cos(a) * radius;
    return [px, height(px, pz), pz];
  });
}

/** Where the arrival camera looks: the landmark itself, at about half its height. */
export function arrivalLook(id, position, ground) {
  const e = EXTENT[id] || { h: 30 };
  const [x, , z] = position;
  return [x, Math.max(position[1], ground(x, z)) + e.h * 0.45, z];
}

/**
 * Horizontal angle, in degrees, between where a camera at `spawn` looks and the
 * direction the road runs from there. The previous release's worst case was 135.
 */
export function viewVersusRoad(spawn, look, points) {
  const a = points[0], b = points[Math.min(points.length - 1, 4)];
  const tx = b[0] - a[0], tz = b[2] - a[2];
  const lx = look[0] - spawn[0], lz = look[2] - spawn[2];
  const tl = Math.hypot(tx, tz) || 1, ll = Math.hypot(lx, lz) || 1;
  return Math.acos(clamp((tx * lx + tz * lz) / (tl * ll), -1, 1)) / DEG;
}

/**
 * The drop-in: arrive from above and behind, like the kite coming down, and
 * settle at the spawn point facing the landmark. Pure math over arrays so it
 * can be tested without a camera.
 */
export function arrivalFlight(spawn, look, { seconds = 3.2, height = 105, back = 38, sweep = 16 } = {}) {
  const hx = look[0] - spawn[0], hz = look[2] - spawn[2];
  const hl = Math.hypot(hx, hz) || 1;
  const dx = hx / hl, dz = hz / hl; // heading
  const from = [spawn[0] - dx * back, spawn[1] + height, spawn[2] - dz * back];
  const ease = u => 1 - Math.pow(1 - clamp(u, 0, 1), 3);
  return {
    seconds, from, to: spawn.slice(), look: look.slice(),
    at(t) {
      const e = ease(t / seconds);
      // A shallow sideways arc, zero at both ends, gives the descent parallax.
      const arc = Math.sin(Math.PI * e) * sweep * (1 - e);
      return [
        from[0] + (spawn[0] - from[0]) * e - dz * arc,
        from[1] + (spawn[1] - from[1]) * e,
        from[2] + (spawn[2] - from[2]) * e + dx * arc,
      ];
    },
  };
}
