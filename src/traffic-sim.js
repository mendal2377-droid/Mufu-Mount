// The street traffic's movement (design/STREET-LIFE-PLAN.md, slice 1b): lanes of vehicles that follow
// the one ahead, stop at red lights and in queues, and turn into the next street at a way's end.
// Pure logic, no drawing: src/world-traffic.js draws what this moves; tests/world-traffic.test.js
// drives it in Node.
//
// Car following is the Intelligent Driver Model (Treiber, Hennecke and Helbing, 2000), the textbook
// model for one lane: each vehicle accelerates towards its desired speed and brakes to keep a safe
// time gap to the vehicle (or red light) ahead. Its parameters below are the usual urban values,
// not measured in Nanjing.

export const IDM = {
  car: {a: 1.4, b: 2.2, s0: 2.2, T: 1.3, len: 4.6},
  bike: {a: 1.2, b: 2.0, s0: 1.0, T: 0.9, len: 1.8},
};
// Signals: one cycle for every junction, the two directions of a crossing given opposite halves.
// Nanjing publishes no cycle lengths (it runs green waves and timing plans by the hour; Beijing's
// Di'anmen Street runs 161 s); 120 s is ours. Each half: 42 % green, then amber and all-red.
export const CYCLE = 120, GREEN = 0.42, STOP_BACK = 9;   // stop line, metres before the junction centre

/** IDM acceleration: speed v, desired speed v0, gap to the leader (m), closing speed dv (v - leader's v). */
export function idm(v, v0, gap, dv, p) {
  const sStar = p.s0 + Math.max(0, v * p.T + v * dv / (2 * Math.sqrt(p.a * p.b)));
  const free = 1 - Math.pow(v / Math.max(v0, .1), 4);
  return p.a * (free - (sStar / Math.max(gap, .1)) ** 2);
}

/** Is the light green for a lane in direction group `group` (0 or 1) at junction phase `offset`, time t? */
export function green(t, offset, group) {
  const c = ((t + offset) % CYCLE + CYCLE) % CYCLE / CYCLE;
  return group === 0 ? c < GREEN : c >= .5 && c < .5 + GREEN;
}

/**
 * One lane in one direction along a way. `stops`: the signals on it, [{at, offset, group}] with `at` in
 * metres along the lane's travel. Vehicles are kept head first: [0] is the furthest along.
 * Each vehicle: {s, v, id, dx, dz, dyaw} (dx, dz, dyaw: the offset left from a junction turn, fading).
 */
export class Lane {
  constructor({length, v0, bike = false, stops = [], key = ''}) {
    Object.assign(this, {length, v0, bike, stops, key, p: bike ? IDM.bike : IDM.car, vehicles: [], next: []});
    this.from = 0; this.to = length;   // the stretch simulated now
  }
  /** Room at the lane's start for one more vehicle? */
  entryFree() {
    const last = this.vehicles.at(-1);
    return !last || last.s - this.from > this.p.len + this.p.s0 + 2;
  }
  /** Fill [a, b] with vehicles spaced `gap` apart at speed v, where there are none: a lane coming into view. */
  fill(a, b, gap, v, id) {
    if (!isFinite(gap) || gap <= 0) return;
    const add = [];
    for (let s = b - gap * .5; s > a; s -= gap) {
      if (!this.vehicles.some(q => Math.abs(q.s - s) < gap * .5)) add.push({s, v, id: id(), dx: 0, dz: 0, dyaw: 0});
    }
    this.vehicles.push(...add);
    this.vehicles.sort((p, q) => q.s - p.s);
  }
  /**
   * Move every vehicle dt seconds at time t. `leaveAt(v)` is called for one reaching the end of the
   * stretch; it returns true if the vehicle went on (into another lane or out of sight), false if it
   * must wait (the lane it turns into is full).
   */
  step(t, dt, leaveAt) {
    const vs = this.vehicles, p = this.p;
    let leader = null;
    for (let i = 0; i < vs.length; i++) {
      const q = vs[i];
      // The nearest obstacle ahead: the vehicle in front, or a red light it can still stop for.
      let gap = Infinity, dv = 0;
      if (leader) { gap = leader.s - q.s - p.len; dv = q.v - leader.v; }
      for (const st of this.stops) {
        const d = st.at - q.s;
        if (d < -.5 || d > 120) continue;
        if (!green(t, st.offset, st.group) && d > q.v * q.v / (2 * p.b * 1.6) - 1 && d < gap) { gap = d; dv = q.v; }
        break;
      }
      // At the end of the stretch with nowhere to go yet: the end is a wall.
      if (q.wait && this.to - q.s < gap) { gap = Math.max(.1, this.to - q.s); dv = q.v; }
      const acc = idm(q.v, this.v0 * (q.slow || 1), gap, dv, p);
      q.v = Math.max(0, q.v + acc * dt);
      q.s += q.v * dt;
      if (leader && q.s > leader.s - p.len - .3) { q.s = leader.s - p.len - .3; q.v = Math.min(q.v, leader.v); }
      // Fade a turn's offset over the first 15 m of the new lane.
      if (q.dx || q.dz || q.dyaw) { const k = Math.max(0, 1 - q.v * dt / Math.max(1, 15 * (q.fade ?? 1))); q.fade = (q.fade ?? 1) * k; q.dx *= k; q.dz *= k; q.dyaw *= k; if (q.fade < .02) q.dx = q.dz = q.dyaw = 0; }
      leader = q;
    }
    // The head vehicles past the end leave, or wait at it.
    while (vs.length && (vs[0].s >= this.to || vs[0].wait)) {
      const q = vs[0];
      if (leaveAt(q)) { q.wait = false; vs.shift(); continue; }
      q.s = this.to - .01; q.v = 0; q.wait = true;
      break;
    }
  }
}
