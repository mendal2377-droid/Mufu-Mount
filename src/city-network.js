// Streets between landmarks.
//
// The atlas is drawn at scale 0.065, so the old-city landmarks are walkable
// neighbours — Qinhuai and Zhonghua Gate are 74 m apart, Jiming and Zifeng 74 m,
// the Palace and Zifeng 148 m — yet each used to sit on its own isolated loop.
// This links them with roads so the city can be walked, not just visited.
//
// Pure functions over a height and a water test, so they run in plain Node
// against the real terrain and are covered by tests/city-network.test.js.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(item, key) {
    const a = this.a; a.push([key, item]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]]; i = p;
    }
  }
  pop() {
    const a = this.a, top = a[0], last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1; let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]]; i = m;
      }
    }
    return top[1];
  }
}

/** Mark every grid cell within `buffer` metres of a polyline as unavailable. */
export function blockMask(polylines, cores, cell, buffer = 8) {
  const blocked = new Set();
  const key = (gx, gz) => gx * 100003 + gz;
  const mark = (x, z, r) => {
    const g = Math.ceil(r / cell);
    const cx = Math.round(x / cell), cz = Math.round(z / cell);
    for (let i = -g; i <= g; i++) for (let j = -g; j <= g; j++) {
      if (Math.hypot(i * cell, j * cell) <= r) blocked.add(key(cx + i, cz + j));
    }
  };
  for (const line of polylines) {
    for (let i = 1; i < line.length; i++) {
      const a = line[i - 1], b = line[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / (cell * 0.6)));
      for (let k = 0; k <= n; k++) mark(a[0] + (b[0] - a[0]) * k / n, a[2] + (b[2] - a[2]) * k / n, buffer);
    }
  }
  for (const [x, z, r] of cores) mark(x, z, r);
  return { has: (gx, gz) => blocked.has(key(gx, gz)), blocked };
}

/**
 * A* over a lazily sampled grid. Water and steep ground are impassable; slopes
 * and the water's edge cost extra so roads hug the flat and keep off the shore.
 */
export function findRoad({ from, to, ground, wet, mask, cell = 12, limit = 2200, maxSlope = 0.5, weight = 1.3 }) {
  const gx0 = Math.round(from[0] / cell), gz0 = Math.round(from[1] / cell);
  const gx1 = Math.round(to[0] / cell), gz1 = Math.round(to[1] / cell);
  const key = (gx, gz) => gx * 100003 + gz;
  const info = new Map();
  const sample = (gx, gz) => {
    const k = key(gx, gz);
    let v = info.get(k);
    if (!v) {
      const x = gx * cell, z = gz * cell;
      const free = Math.hypot(x - from[0], z - from[1]) < cell * 2.2 || Math.hypot(x - to[0], z - to[1]) < cell * 2.2;
      v = { x, z, y: ground(x, z), wet: wet(x, z), blocked: !free && mask.has(gx, gz) };
      v.edge = !v.wet && (wet(x + cell, z) || wet(x - cell, z) || wet(x, z + cell) || wet(x, z - cell));
      info.set(k, v);
    }
    return v;
  };
  const g = new Map(), parent = new Map(), done = new Set();
  const heap = new Heap();
  const start = key(gx0, gz0), goal = key(gx1, gz1);
  // A goal that is itself water, or walled in by another landmark, can never be
  // reached; say so now instead of exploring everything around it first.
  const target = sample(gx1, gz1);
  if (target.wet) return null;
  g.set(start, 0); heap.push([gx0, gz0], 0);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let expanded = 0;
  while (heap.size && expanded < limit) {
    const [cx, cz] = heap.pop(); const ck = key(cx, cz);
    if (done.has(ck)) continue;
    done.add(ck); expanded++;
    if (ck === goal) break;
    const here = sample(cx, cz);
    for (const [dx, dz] of dirs) {
      const nx = cx + dx, nz = cz + dz, nk = key(nx, nz);
      if (done.has(nk)) continue;
      const n = sample(nx, nz);
      if (n.wet || n.blocked) continue;
      // A canal narrower than one cell can run between two dry cell centres, so
      // test the middle of the step as well as its ends.
      const crossing = wet((here.x + n.x) / 2, (here.z + n.z) / 2);
      const dist = Math.hypot(dx, dz) * cell;
      const slope = Math.abs(n.y - here.y) / dist;
      if (slope > maxSlope) continue;
      // Diagonals must not clip a wet corner.
      if (dx && dz && (sample(cx + dx, cz).wet || sample(cx, cz + dz).wet)) continue;
      // A short stone bridge over a canal is fine; it costs enough that a dry way round wins.
      const cost = dist * (1 + 7 * Math.max(0, slope - 0.08)) + (n.edge ? cell * 0.8 : 0) + (crossing ? cell * 3 : 0);
      const ng = g.get(ck) + cost;
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng); parent.set(nk, ck);
        heap.push([nx, nz], ng + Math.hypot(gx1 - nx, gz1 - nz) * cell * weight);
      }
    }
  }
  if (!parent.has(goal) && start !== goal) return null;
  const cells = [];
  for (let k = goal; k !== undefined; k = parent.get(k)) {
    const v = info.get(k); cells.push([v.x, v.z]);
    if (k === start) break;
  }
  cells.reverse();
  cells[0] = [from[0], from[1]];
  cells[cells.length - 1] = [to[0], to[1]];
  return { cells, expanded };
}

/** Chaikin corner cutting, keeping both ends exactly where they were. */
export function chaikin(points, rounds = 2) {
  let p = points;
  for (let r = 0; r < rounds; r++) {
    if (p.length < 3) break;
    const q = [p[0]];
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
      q.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    q.push(p.at(-1));
    p = q;
  }
  return p;
}

/** Resample at an even spacing, as [x, y, z] with y from the rendered ground. */
export function resample(points, spacing, ground) {
  const out = [];
  let carry = 0;
  const height = (x, z) => Math.max(1.7, ground(x, z)) + 0.3;
  out.push([points[0][0], height(points[0][0], points[0][1]), points[0][1]]);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = spacing - carry;
    while (d <= len) {
      const x = a[0] + (b[0] - a[0]) * d / len, z = a[1] + (b[1] - a[1]) * d / len;
      out.push([x, height(x, z), z]);
      d += spacing;
    }
    carry = len - (d - spacing);
  }
  const e = points.at(-1);
  out.push([e[0], height(e[0], e[1]), e[1]]);
  return out;
}

/** Points at 3 m spacing: a run this long is a 15 m bridge, the widest we allow. */
export const MAX_BRIDGE_SAMPLES = 5;
const interior = (pts, i) => i > 1 && i < pts.length - 2;
export function wetRuns(pts, wet) {
  const runs = [];
  let start = -1;
  pts.forEach((p, i) => {
    const w = interior(pts, i) && wet(p[0], p[2]);
    if (w && start < 0) start = i;
    if (!w && start >= 0) { runs.push([start, i - 1]); start = -1; }
  });
  if (start >= 0) runs.push([start, pts.length - 1]);
  return runs;
}
export const longestWetRun = (pts, wet) => wetRuns(pts, wet).reduce((m, [a, b]) => Math.max(m, b - a + 1), 0);

const roadLength = pts => pts.reduce((s, p, i) => i ? s + Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]) : 0, 0);

/**
 * Link the nodes with roads: a minimum spanning tree over the pairs that can
 * actually be walked, plus a short extra link per node so the network has
 * loops to wander rather than one dead-end spine.
 *
 * @param {object} o
 * @param {Array<{id:string,x:number,z:number}>} o.nodes   road end points (avenue far ends)
 * @param {number[][][]} o.polylines                       routes roads must keep off, [x,y,z] points
 * @param {number[][]} o.cores                             footprints to keep off: [x, z, radius]
 */
export function buildRoadNetwork({ nodes, polylines, cores, ground, wet, maxEdge = 400, detour = 1.7, cell = 12, limit = 2200 }) {
  const mask = blockMask(polylines, cores, cell);
  const pairs = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
    const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].z - nodes[j].z);
    if (d <= maxEdge) pairs.push({ i, j, d });
  }
  pairs.sort((a, b) => a.d - b.d);

  const parent = nodes.map((_, i) => i);
  const find = i => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const roads = [], tried = new Map();
  const route = (i, j) => {
    const k = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (tried.has(k)) return tried.get(k);
    const a = nodes[i], b = nodes[j];
    const found = findRoad({ from: [a.x, a.z], to: [b.x, b.z], ground, wet, mask, cell, limit });
    let result = null;
    if (found) {
      let pts = resample(chaikin(found.cells), 3, ground);
      // Corner cutting may clip a shore; fall back to the raw grid path if so.
      if (longestWetRun(pts, wet) > MAX_BRIDGE_SAMPLES) pts = resample(found.cells, 3, ground);
      // A road may cross narrow water on a short bridge, never wade a lake.
      if (longestWetRun(pts, wet) <= MAX_BRIDGE_SAMPLES) result = { a: a.id, b: b.id, points: pts, length: roadLength(pts), bridges: wetRuns(pts, wet) };
    }
    tried.set(k, result);
    return result;
  };

  // Spanning tree first: only the pairs that join two separate components.
  for (const { i, j, d } of pairs) {
    if (find(i) === find(j)) continue;
    const road = route(i, j);
    if (!road || road.length > d * detour * 1.3) continue;
    roads.push(road); parent[find(i)] = find(j);
  }
  // One extra short link per node, where it is not much longer than straight.
  const degree = nodes.map(() => 0);
  roads.forEach(r => { degree[nodes.findIndex(n => n.id === r.a)]++; degree[nodes.findIndex(n => n.id === r.b)]++; });
  const have = new Set(roads.map(r => [r.a, r.b].sort().join('|')));
  for (const { i, j, d } of pairs) {
    if (degree[i] >= 2 && degree[j] >= 2) continue;
    if (d > maxEdge * 0.65) continue;
    const id = [nodes[i].id, nodes[j].id].sort().join('|');
    if (have.has(id)) continue;
    const road = route(i, j);
    if (!road || road.length > d * detour) continue;
    roads.push(road); have.add(id); degree[i]++; degree[j]++;
  }

  const components = new Set(nodes.map((_, i) => find(i))).size;
  return { roads, components, expanded: [...tried.values()].filter(Boolean).length, mask };
}

/** Re-space a 2-D polyline evenly, which also removes points that collapsed onto each other. */
function evenly(pts, spacing) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 1e-6) continue;
    let d = spacing - carry;
    while (d <= len) { out.push([a[0] + (b[0] - a[0]) * d / len, a[1] + (b[1] - a[1]) * d / len]); d += spacing; }
    carry = len - (d - spacing);
  }
  return out;
}

/**
 * A lakeside promenade along part of a shoreline ring.
 *
 * Offsetting each tiny OSM polygon segment by its own normal made the old walk
 * zig-zag (Mochou was nine points jittering through 25 m), because adjacent
 * normals disagree wherever the surveyed outline is noisy. This smooths the
 * shoreline first, offsets it inland by one consistent normal, resamples it
 * evenly and keeps the longest run that stays dry.
 *
 * @param {number[][]} ring   [x, y, z] shoreline points (a closed polygon)
 * @param {object} o  from/to are fractions of the ring; offset is metres inland
 */
export function shoreWalk(ring, { from = 0.4, to = 0.7, offset = 11, spacing = 3, wet, ground, smooth = 4 }) {
  const n = ring.length;
  const first = Math.floor(n * from), last = Math.max(first + 3, Math.floor(n * to));
  let pts = [];
  for (let i = first; i <= last; i++) { const q = ring[i % n]; pts.push([q[0], q[2]]); }
  // Moving-average smoothing, keeping the two ends fixed.
  for (let pass = 0; pass < smooth; pass++) {
    pts = pts.map((q, i) => (i === 0 || i === pts.length - 1) ? q : [
      (pts[i - 1][0] + q[0] * 2 + pts[i + 1][0]) / 4, (pts[i - 1][1] + q[1] * 2 + pts[i + 1][1]) / 4]);
  }
  // Even spacing before the normals are taken, so tiny segments cannot dominate.
  const even = [];
  let carry = 0;
  even.push(pts[0]);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    let d = spacing - carry;
    while (d <= len) { even.push([a[0] + (b[0] - a[0]) * d / len, a[1] + (b[1] - a[1]) * d / len]); d += spacing; }
    carry = len - (d - spacing);
  }
  if (even.length < 4) return [];
  const normals = even.map((q, i) => {
    const a = even[Math.max(0, i - 3)], b = even[Math.min(even.length - 1, i + 3)];
    const tx = b[0] - a[0], tz = b[1] - a[1], l = Math.hypot(tx, tz) || 1;
    return [-tz / l, tx / l];
  });
  // One side for the whole arc: whichever puts more of it on dry land.
  let dry = 0, dryFlipped = 0;
  even.forEach((q, i) => {
    if (!wet(q[0] + normals[i][0] * offset, q[1] + normals[i][1] * offset)) dry++;
    if (!wet(q[0] - normals[i][0] * offset, q[1] - normals[i][1] * offset)) dryFlipped++;
  });
  const side = dry >= dryFlipped ? 1 : -1;
  // Offsetting a tight corner inland makes the inside edge collapse into a kink,
  // so smooth the offset path itself too, and only keep a smoothed point where it
  // stays dry.
  let off = even.map((q, i) => [q[0] + normals[i][0] * offset * side, q[1] + normals[i][1] * offset * side]);
  for (let pass = 0; pass < 6; pass++) {
    off = off.map((q, i) => {
      if (i === 0 || i === off.length - 1) return q;
      const m = [(off[i - 1][0] + q[0] * 2 + off[i + 1][0]) / 4, (off[i - 1][1] + q[1] * 2 + off[i + 1][1]) / 4];
      return wet(m[0], m[1]) ? q : m;
    });
  }
  off = evenly(off, spacing);
  let run = [], best = [];
  const flush = () => { if (run.length > best.length) best = run; run = []; };
  off.forEach(([x, z]) => {
    if (wet(x, z)) flush(); else run.push([x, Math.max(1.7, ground(x, z)) + 0.3, z]);
  });
  flush();
  return best;
}

export const _internal = { clamp };
