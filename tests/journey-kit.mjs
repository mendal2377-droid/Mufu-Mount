// Shared by the browser journeys (tests/*-journey-browser.mjs): route-finding on the exported walk
// grid and driving the traveller along a route with the real controls, time driven by __mufu.step.
import assert from "node:assert/strict";

// Installs window.__journey = { route, drive, nearest, w, g } in the page (the city must be loaded).
export async function installJourney(page) {
  await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, g = w.grid, L = 4;
    const key = (code, down) => document.body.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, key: code, bubbles: true }));
    const held = new Set();
    const hold = (codes) => {
      for (const c of held) if (!codes.includes(c)) { key(c, false); held.delete(c); }
      for (const c of codes) if (!held.has(c)) { key(c, true); held.add(c); }
    };
    // A* on a 4 m lattice: on foot any walkable cell within a step; on the bike, road cells, with a
    // short way off it allowed at a cost, by the bike's own rule (fits in src/landmark-world.js: road
    // here, 6 or 12 m ahead, or 3 m to a side): ground within 3 m of a road ("edge", the promenade
    // beside the riverside road) as often as need be, and at most three lattice points (12 m)
    // farther off in a row. With longer runs allowed the route cut 20-50 m corners over the grass
    // the bike could never ride.
    const nearRoad = (x, z) => [[3, 0], [-3, 0], [0, 3], [0, -3], [2.1, 2.1], [2.1, -2.1], [-2.1, 2.1], [-2.1, -2.1]].some(([a, b]) => g.road(x + a, z + b) !== null);
    // L: the lattice, 4 m by default; 2 m for Xuanwu Lake's 4.5 m bridges on a slant, which a 4 m
    // lattice can step clean over (state ids hold lattice indices within ±4000: 8 km at 2 m).
    function route(from, to, mode, L = 4) {
      const ok = (x, z) => (mode === "bike" ? g.road(x, z) ?? (g.height(x, z) === null ? null : nearRoad(x, z) ? "edge" : "near") : g.height(x, z));
      // A state is a lattice point and the off-road points just crossed to reach it (0-3).
      const id = (i, j, k = 0) => ((i + 4000) * 8000 + (j + 4000)) * 4 + k;
      const ij = (n) => { const c = Math.floor(n / 4); return [Math.floor(c / 8000) - 4000, (c % 8000) - 4000]; };
      // Lattice points at the middles of the 4 m cells, not their corners: on a corner the walker
      // stands a hair inside whichever cell it drifted into, maybe one the route never stepped from
      // (stuck on Purple Mountain, a 1.7 m step from a cell beside the route's).
      const O = L / 2, at = (v) => Math.round((v - O) / L);
      const start = [at(from[0]), at(from[1])], goal = [at(to[0]), at(to[1])];
      const open = [[0, start[0], start[1], 0]], cost = new Map([[id(...start), 0]]), prev = new Map();
      const push = (n) => { open.push(n); let k = open.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (open[p][0] <= open[k][0]) break; [open[p], open[k]] = [open[k], open[p]]; k = p; } };
      const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let s = k; if (a < open.length && open[a][0] < open[s][0]) s = a; if (b < open.length && open[b][0] < open[s][0]) s = b; if (s === k) break; [open[s], open[k]] = [open[k], open[s]]; k = s; } } return top; };
      let seen = 0, closest = null;
      while (open.length && seen < 2500000) {
        const [, i, j, k] = pop(); seen++;
        // Where a route fails, how near it came: on the bike, where the road toward the goal ends.
        const e = Math.hypot(i * L + O - to[0], j * L + O - to[1]);
        if (!closest || e < closest[2]) closest = [i * L + O, j * L + O, e];
        if (Math.abs(i - goal[0]) <= 1 && Math.abs(j - goal[1]) <= 1) {
          const out = [[i * L + O, j * L + O]]; let n = id(i, j, k);
          while (prev.has(n)) { n = prev.get(n); const [pi, pj] = ij(n); out.push([pi * L + O, pj * L + O]); }
          return { path: out.reverse(), seen };
        }
        const x = i * L + O, z = j * L + O, h = g.height(x, z) ?? 0, c0 = cost.get(id(i, j, k));
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const nx = x + di * L, nz = z + dj * L, v = ok(nx, nz), nk = v === "near" ? k + 1 : 0;
          if (v === null || nk > 3) continue;
          const nh = g.height(nx, nz);
          // The walker's own rule (canStep in src/landmark-world.js): a step no taller than the grid allows.
          if (nh === null || Math.abs(nh - h) > g.stepUp(nx, nz) * .95) continue;
          // Every metre along the step clear too: a trunk or lamp post (1-2 m) fits between lattice points.
          let clear = true, last = h;
          for (let q = 1; q < L && clear; q++) {
            const mh = g.height(x + di * q * L / L, z + dj * q * L / L);
            if (mh === null || Math.abs(mh - last) > g.stepUp(x, z) * .95) clear = false; else last = mh;
          }
          if (!clear || Math.abs(nh - last) > g.stepUp(nx, nz) * .95) continue;
          // Keep clear of trunks and posts (a route brushing one diagonally snags the walker's body)
          // and of the lip of a drop (the walker drifts a metre or two off the lattice, over it),
          // where there is a way round: on the mountain's steep 4 m cells such lips are everywhere.
          const round = mode === "walk" ? [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([a, b]) => g.height(nx + a, nz + b)) : [];
          const tight = round.some((rh) => rh === null || Math.abs(rh - nh) > g.stepUp(nx, nz) * .95);
          const step = Math.hypot(di, dj) * L * (v === "near" ? 6 : v === "edge" || tight ? 3 : 1) + Math.abs(nh - h) * 2;
          const n = id(i + di, j + dj, nk), c = c0 + step;
          if (c < (cost.get(n) ?? Infinity)) { cost.set(n, c); prev.set(n, id(i, j, k)); push([c + Math.hypot(nx - to[0], nz - to[1]), i + di, j + dj, nk]); }
        }
      }
      return { path: null, seen, closest };
    }
    // Drive along a path for up to `frames`; returns where it got to.
    function drive(path, mode, frames, dt = 0.1) {
      // A leg is driven in chunks: carry on from where the last chunk left the route, not its start.
      let i = window.__drivePath === path ? window.__driveI : 0, stuck = 0, best = i - 1, top = -Infinity;
      window.__drivePath = path;
      for (let f = 0; f < frames; f++) {
        const b = w.body;
        // Nearest point ahead in a window.
        let k = i, d = Infinity;
        for (let q = i; q < Math.min(path.length, i + 40); q++) { const e = Math.hypot(path[q][0] - b.x, path[q][1] - b.z); if (e < d) { d = e; k = q; } }
        i = k;
        // Aim at the furthest route point within 6 m that a straight line reaches by the walker's
        // own step rule: aiming blindly ahead cut the route's corners onto ledges it went round (a
        // terrace edge behind the Sun Yat-sen Hall, a road's lip on Purple Mountain). Drifted where
        // even the nearest point is out of line, go back a point.
        const reach = (p) => {
          const n = Math.ceil(Math.hypot(p[0] - b.x, p[1] - b.z) / 0.5);
          let last = g.height(b.x, b.z);
          for (let q = 1; q <= n; q++) {
            const x = b.x + (p[0] - b.x) * q / n, z = b.z + (p[1] - b.z) * q / n, h = g.height(x, z);
            if (h === null || last === null || Math.abs(h - last) > g.stepUp(x, z) * .95) return false;
            last = h;
          }
          return true;
        };
        let t = i;
        while (t < path.length - 1 && Math.hypot(path[t + 1][0] - b.x, path[t + 1][1] - b.z) < 6 && reach(path[t + 1])) t++;
        // On the point itself, on along the route: it checked that step at its own spacing.
        if (t === i && Math.hypot(path[i][0] - b.x, path[i][1] - b.z) < 0.5) t = Math.min(i + 1, path.length - 1);
        else if (t === i && !reach(path[i]) && i > 0) t = i - 1;
        const [tx, tz] = path[t], dx = tx - b.x, dz = tz - b.z, end = path[path.length - 1];
        const left = Math.hypot(end[0] - b.x, end[1] - b.z);
        top = Math.max(top, b.y);
        if (left < 6) { hold([]); return { done: true, frames: f, at: [b.x, b.y, b.z], top }; }
        if (mode === "walk") {
          m.camera.rotation.set(-0.15, Math.atan2(-dx, -dz), 0, "YXZ");
          hold(["KeyW", "ShiftLeft"]);
        } else {
          let err = Math.atan2(dx, dz) - w.heading; err = Math.atan2(Math.sin(err), Math.cos(err));
          hold(["KeyW", ...(Math.abs(err) < 0.25 ? ["ShiftLeft"] : []), ...(err < -0.06 ? ["KeyD"] : err > 0.06 ? ["KeyA"] : [])]);
        }
        m.step(1, dt);
        window.__driveI = i;
        if (window.__trace && f % 40 === 0) window.__trace.push([f, i, Math.round(b.x), Math.round(b.z), Math.round(tx), Math.round(tz)]);
        // Progress is along the path, not straight at the goal: a real path may swing away from it
        // (round a building or a pond) for longer than the stuck limit.
        if (i > best) { best = i; stuck = 0; } else if (++stuck > 400) { hold([]); return { done: false, stuck: true, frames: f, at: [b.x, b.y, b.z], left, top }; }
      }
      hold([]);
      const b = w.body;
      return { done: false, frames, at: [b.x, b.y, b.z], left: Math.hypot(path[path.length - 1][0] - b.x, path[path.length - 1][1] - b.z), top };
    }
    // The nearest walkable (or road) spot to (x, z) within r.
    function nearest(x, z, r, test = g.height) {
      // About every 2 m round each ring: a fixed angle step left 100 m gaps 300 m out.
      for (let d = 0; d <= r; d += 2) for (let a = 0; a < 6.28; a += Math.min(0.3, 2 / Math.max(d, 1))) {
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
        if (test(px, pz) !== null) return [px, pz];
      }
      return null;
    }
    window.__journey = { route, drive, nearest, w, g };
  });
}

// A leg: route from `from` to `to` ([x, z]), then drive it in 600-frame chunks; logged and added to
// report.legs.
export function legRunner(page, report) {
  return async (name, from, to, mode, frames) => {
    if (process.env.TRACE) await page.evaluate(() => { window.__traceOn = true; });
    const r = await page.evaluate(([from, to, mode]) => { const res = window.__journey.route(from, to, mode); window.__leg = res.path; if (window.__traceOn) window.__trace = []; return { found: !!res.path, length: res.path?.length, seen: res.seen }; }, [from, to, mode]);
    assert.ok(r.found, `${name}: a ${mode} route exists (${r.seen} cells searched)`);
    let out = null;
    for (let spent = 0; spent < frames && !out?.done; spent += 600) {
      out = await page.evaluate(([mode]) => window.__journey.drive(window.__leg, mode, 600), [mode]);
      if (out.stuck) break;
    }
    report.legs.push({ name, mode, route: r, result: out });
    if (process.env.TRACE) console.log('path', JSON.stringify(await page.evaluate(() => window.__leg.filter((p) => Math.hypot(p[0] - window.__mufu.city.world.body.x, p[1] - window.__mufu.city.world.body.z) < 40).map((p) => [...p.map(Math.round), window.__mufu.city.world.grid.road(p[0], p[1]) !== null ? "r" : "-"]))), 'trace', JSON.stringify(await page.evaluate(() => window.__trace)));
    console.log(name, JSON.stringify({ route: r, result: { ...out, at: out.at.map((v) => +v.toFixed(1)), left: out.left && +out.left.toFixed(1), top: +out.top.toFixed(1) } }));
    return out;
  };
}
