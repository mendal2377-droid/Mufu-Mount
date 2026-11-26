// Routes over the mapped roads and paths, for the map's waypoint and the taxi's fares
// (design/TAXI-PLAN.md). Pure: no THREE, no DOM, so it is tested in node (tests/taxi.test.js).
//
// The ways come from public/scenes/<world>/streets.json and paths.json (OSM, in the browser frame:
// x east, z = -north). OSM's ways are not split where they meet: 2,180 of the core's roads join
// another in the middle of it. So every vertex is a node, and ways that share a vertex (to the half
// metre) join there. Driving keeps one-way streets one way; on foot every way runs both ways. A way's
// loose end within LINK metres of another way is joined to it: a footway mapped up to a kerb does not
// always share the road's vertex, and the simplified roads of streets.json stop short of the road
// they meet (without the join the core's roads fell into 106 pieces, the biggest only half of them).

export const LINK = 12, BRIDGE = 80;
const CELL = 50;

const keyOf = (x, z) => `${Math.round(x * 2)},${Math.round(z * 2)}`;

/**
 * ways: [{pts: [[x, z], ...], oneway: 0 | 1 | -1, road: bool}]. Returns the graph:
 * {x, z: node coordinates; out: per node [[to, metres, carOk], ...]; grid: node ids by 50 m cell}.
 */
export function buildGraph(ways, {link = LINK, drivable = null, carCheck = null} = {}) {
  ways = splitCrossings(ways);
  const ids = new Map(), x = [], z = [], out = [], road = [];
  const node = (px, pz, isRoad) => {
    const k = keyOf(px, pz);
    let id = ids.get(k);
    if (id === undefined) { id = x.length; ids.set(k, id); x.push(px); z.push(pz); out.push([]); road.push(false); }
    if (isRoad) road[id] = true;
    return id;
  };
  const ends = [];
  for (const w of ways) {
    let prev = -1;
    for (const [px, pz] of w.pts) {
      const id = node(px, pz, w.road);
      if (prev >= 0 && prev !== id) {
        const d = Math.hypot(x[id] - x[prev], z[id] - z[prev]);
        // carOk: a road, and with its one-way direction (1: along the drawn order, -1: against it).
        out[prev].push([id, d, w.road && w.oneway !== -1]);
        out[id].push([prev, d, w.road && w.oneway !== 1]);
      }
      prev = id;
    }
    if (w.pts.length) ends.push(ids.get(keyOf(...w.pts[0])), ids.get(keyOf(...w.pts.at(-1))));
  }
  const grid = new Map();
  for (let i = 0; i < x.length; i++) {
    const k = `${Math.floor(x[i] / CELL)},${Math.floor(z[i] / CELL)}`;
    (grid.get(k) || grid.set(k, []).get(k)).push(i);
  }
  const g = {x, z, out, road, grid};
  // Path ends joined to the nearest point of another way within `link` m (on foot only): the
  // segment there is split by a new node, its car rule kept on both halves.
  if (link > 0) {
    const segs = new Map();   // 50 m cell -> [a, b]; a split segment is replaced by its halves
    const addSeg = (a, b) => {
      for (let i = Math.floor(Math.min(x[a], x[b]) / CELL); i <= Math.floor(Math.max(x[a], x[b]) / CELL); i++)
        for (let j = Math.floor(Math.min(z[a], z[b]) / CELL); j <= Math.floor(Math.max(z[a], z[b]) / CELL); j++) {
          const k = `${i},${j}`; (segs.get(k) || segs.set(k, []).get(k)).push([a, b]);
        }
    };
    const dead = new Set();
    for (let a = 0; a < x.length; a++) for (const [b] of out[a]) if (a < b) addSeg(a, b);
    for (const e of ends) {
      if (e === undefined || out[e].length > 1) continue;   // an end that already meets another way
      const near = new Set(out[e].map(q => q[0]));
      let best = null;
      const cx = Math.floor(x[e] / CELL), cz = Math.floor(z[e] / CELL);
      for (let i = cx - 1; i <= cx + 1; i++) for (let j = cz - 1; j <= cz + 1; j++) for (const [a, b] of segs.get(`${i},${j}`) || []) {
        if (a === e || b === e || near.has(a) && near.has(b) || dead.has(`${a},${b}`)) continue;
        const ux = x[b] - x[a], uz = z[b] - z[a], L2 = ux * ux + uz * uz || 1;
        const k = Math.max(0, Math.min(1, ((x[e] - x[a]) * ux + (z[e] - z[a]) * uz) / L2));
        const px = x[a] + ux * k, pz = z[a] + uz * k, d = Math.hypot(px - x[e], pz - z[e]);
        if (d < link && (!best || d < best.d)) best = {a, b, k, px, pz, d};
      }
      if (!best) continue;
      let p;
      if (best.k < .02) p = best.a; else if (best.k > .98) p = best.b;
      else {
        // Split a-b at p, keeping each direction's car rule.
        const {a, b} = best, ab = out[a].find(q => q[0] === b), ba = out[b].find(q => q[0] === a);
        dead.add(`${a},${b}`);
        p = x.length; x.push(best.px); z.push(best.pz); out.push([]); road.push(road[a] && road[b]);
        const da = Math.hypot(best.px - x[a], best.pz - z[a]), db = Math.hypot(best.px - x[b], best.pz - z[b]);
        out[a] = out[a].filter(q => q !== ab); out[b] = out[b].filter(q => q !== ba);
        out[a].push([p, da, ab[2]]); out[p].push([b, db, ab[2]]);
        out[b].push([p, db, ba[2]]); out[p].push([a, da, ba[2]]);
        const gk = `${Math.floor(best.px / CELL)},${Math.floor(best.pz / CELL)}`;
        (grid.get(gk) || grid.set(gk, []).get(gk)).push(p);
        addSeg(a, p); addSeg(p, b);
      }
      const d = Math.hypot(x[e] - x[p], z[e] - z[p]);
      // A dead-end road joined to another road is open to the car, both ways.
      const car = road[e] && road[p];
      out[e].push([p, d, car]); out[p].push([e, d, car]);
    }
  }
  // Bridges: streets.json leaves out every way off layer 0, the elevated roads and with them the
  // bridges, so the roads either side of each bridge end facing each other across the water (the
  // core's two big pieces met nowhere along the Inner Qinhuai). In the browser, a road's loose end is
  // joined to a road node up to BRIDGE m away when the walk grid has road all along the line:
  // `drivable(x0, z0, x1, z1)`, the grid's own word that a car can go there.
  if (drivable) {
    for (const e of ends) {
      if (e === undefined || !road[e] || out[e].filter(q => road[q[0]]).length > 1) continue;   // not a loose end
      const cand = [];
      const r = Math.ceil(BRIDGE / CELL), cx = Math.floor(x[e] / CELL), cz = Math.floor(z[e] / CELL);
      for (let i = cx - r; i <= cx + r; i++) for (let j = cz - r; j <= cz + r; j++) for (const n of grid.get(`${i},${j}`) || []) {
        if (n === e || !road[n] || out[e].some(q => q[0] === n)) continue;
        const d = Math.hypot(x[n] - x[e], z[n] - z[e]);
        if (d > LINK && d < BRIDGE) cand.push([d, n]);
      }
      cand.sort((a, b) => a[0] - b[0]);
      for (const [d, n] of cand.slice(0, 12)) {
        if (!drivable(x[e], z[e], x[n], z[n])) continue;
        out[e].push([n, d, true]); out[n].push([e, d, true]);
        break;
      }
    }
  }
  // A mapped road the world did not build as carriageway (a road through the Ming Palace's ruins park
  // is paving there): no car on it. carCheck(x0, z0, x1, z1) is the world's word for each edge.
  if (carCheck) {
    for (let a = 0; a < x.length; a++) for (const e of out[a]) {
      if (!e[2] || a > e[0]) continue;
      const b = e[0], back = out[b].find(q => q[0] === a);
      if (!carCheck(x[a], z[a], x[b], z[b])) { e[2] = false; if (back) back[2] = false; }
    }
  }
  return g;
}

// Roads that cross on the level: OSM's crossing roads do not always share a vertex there either (the
// core's roads stayed in two big pieces that overlap without meeting). Each crossing gets a vertex on
// both ways. Motorways and trunk roads and their links are left out: in Nanjing they are the elevated
// and sunken expressways, which cross the streets without meeting them.
const SEPARATE = /^(motorway|trunk)/;
export function splitCrossings(ways) {
  const segs = new Map(), add = [];
  ways.forEach((w, wi) => {
    add.push(w.pts.map(() => []));
    if (!w.road || SEPARATE.test(w.kind || '')) return;
    for (let i = 1; i < w.pts.length; i++) {
      const [ax, az] = w.pts[i - 1], [bx, bz] = w.pts[i];
      for (let gx = Math.floor(Math.min(ax, bx) / CELL); gx <= Math.floor(Math.max(ax, bx) / CELL); gx++)
        for (let gz = Math.floor(Math.min(az, bz) / CELL); gz <= Math.floor(Math.max(az, bz) / CELL); gz++) {
          const k = `${gx},${gz}`; (segs.get(k) || segs.set(k, []).get(k)).push([wi, i]);
        }
    }
  });
  const seen = new Set();
  for (const list of segs.values()) for (let p = 0; p < list.length; p++) for (let q = p + 1; q < list.length; q++) {
    const [wa, ia] = list[p], [wb, ib] = list[q];
    if (wa === wb) continue;
    const key = `${wa},${ia},${wb},${ib}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const [ax, az] = ways[wa].pts[ia - 1], [bx, bz] = ways[wa].pts[ia], [cx, cz] = ways[wb].pts[ib - 1], [dx, dz] = ways[wb].pts[ib];
    const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz, den = rx * sz - rz * sx;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((cx - ax) * sz - (cz - az) * sx) / den, u = ((cx - ax) * rz - (cz - az) * rx) / den;
    // Strictly inside both (a crossing at a shared end is joined already).
    if (t <= 1e-6 || t >= 1 - 1e-6 || u <= 1e-6 || u >= 1 - 1e-6) continue;
    const pt = [ax + rx * t, az + rz * t];
    add[wa][ia].push([t, pt]); add[wb][ib].push([u, pt]);
  }
  return ways.map((w, wi) => {
    if (!add[wi].some(a => a.length)) return w;
    const pts = [w.pts[0]];
    for (let i = 1; i < w.pts.length; i++) { for (const [, pt] of add[wi][i].sort((a, b) => a[0] - b[0])) pts.push(pt); pts.push(w.pts[i]); }
    return {...w, pts};
  });
}

/** The nearest node to (px, pz) within `radius` m; `car`: road nodes only. null if none. */
export function nearestNode(g, px, pz, {radius = 120, car = false, skip = null} = {}) {
  let best = null, bd = radius;
  const r = Math.ceil(radius / CELL), cx = Math.floor(px / CELL), cz = Math.floor(pz / CELL);
  for (let i = cx - r; i <= cx + r; i++) for (let j = cz - r; j <= cz + r; j++) {
    for (const n of g.grid.get(`${i},${j}`) || []) {
      if (car && !g.road[n]) continue;
      if (skip && skip(n)) continue;
      const d = Math.hypot(g.x[n] - px, g.z[n] - pz);
      if (d < bd) { bd = d; best = n; }
    }
  }
  return best;
}

/** The shortest way from node a to node b: [[x, z], ...] with its length, or null. A*, binary heap. */
export function shortest(g, a, b, {car = false} = {}) {
  if (a === null || b === null) return null;
  const cost = new Float64Array(g.x.length).fill(Infinity), prev = new Int32Array(g.x.length).fill(-1);
  const heap = [];   // [f, node]
  const push = (f, n) => {
    heap.push([f, n]);
    let i = heap.length - 1;
    while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop();
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
      }
    }
    return top;
  };
  const h = (n) => Math.hypot(g.x[n] - g.x[b], g.z[n] - g.z[b]);
  cost[a] = 0; push(h(a), a);
  while (heap.length) {
    const [f, n] = pop();
    if (n === b) break;
    if (f - h(n) > cost[n] + 1e-6) continue;
    for (const [m, d, carOk] of g.out[n]) {
      if (car && !carOk) continue;
      const c = cost[n] + d;
      if (c < cost[m]) { cost[m] = c; prev[m] = n; push(c + h(m), m); }
    }
  }
  if (!Number.isFinite(cost[b])) return null;
  const pts = [], nodes = [];
  for (let n = b; n !== -1; n = prev[n]) { pts.push([g.x[n], g.z[n]]); nodes.push(n); }
  pts.reverse(); nodes.reverse();
  // Each stretch's lane for a car keeping right (src/world-traffic.js's lanes): 1.6 m right of a
  // two-way road's line, on the line of a one-way road.
  const lanes = [];
  for (let i = 1; i < nodes.length; i++) lanes.push(g.out[nodes[i]].some(e => e[0] === nodes[i - 1] && e[2]) ? 1.6 : 0);
  return {pts, length: cost[b], lanes};
}

/** Of the nodes reachable from node a, the one nearest (tx, tz): for a goal in a lake or a park the
 *  ways do not join (the walk graph is in 330 pieces: islands, courtyards, paths mapped alone). */
export function nearestReachable(g, a, tx, tz, {car = false} = {}) {
  if (a === null) return null;
  const seen = new Uint8Array(g.x.length), stack = [a];
  seen[a] = 1;
  let best = a, bd = Math.hypot(g.x[a] - tx, g.z[a] - tz);
  while (stack.length) {
    const n = stack.pop();
    const d = Math.hypot(g.x[n] - tx, g.z[n] - tz);
    if (d < bd) { bd = d; best = n; }
    for (const [m, , carOk] of g.out[n]) if (!seen[m] && (!car || carOk)) { seen[m] = 1; stack.push(m); }
  }
  return best;
}

/** Distance from (px, pz) to a polyline, and the index of the segment nearest it. */
export function offRoute(pts, px, pz) {
  let best = Infinity, at = 0;
  for (let i = 1; i < pts.length; i++) {
    const [ax, az] = pts[i - 1], [bx, bz] = pts[i], ux = bx - ax, uz = bz - az, L2 = ux * ux + uz * uz || 1;
    const k = Math.max(0, Math.min(1, ((px - ax) * ux + (pz - az) * uz) / L2));
    const d = Math.hypot(ax + ux * k - px, az + uz * k - pz);
    if (d < best) { best = d; at = i - 1; }
  }
  return {d: best, at};
}

/** streets.json and paths.json as ways for buildGraph. */
export function waysFrom(streets, paths) {
  const flat = (f) => { const p = []; for (let i = 0; i < f.length; i += 2) p.push([f[i], f[i + 1]]); return p; };
  const ways = [];
  for (const [cls, oneway, , f] of streets?.ways || []) ways.push({pts: flat(f), oneway, road: true, kind: streets.classes?.[cls]});
  for (const [, , f] of paths?.ways || []) ways.push({pts: flat(f), oneway: 0, road: false});
  return ways;
}
