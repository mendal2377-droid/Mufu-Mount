// A real journey through Tiny Nanjing and Mufu Mountain, set by the owner (1 November 2026):
// walk from Wutang Square up Mufu Mountain's south side to the top, down its north side to the
// river; then by bike along the river to Shangyuanmen station and back to Wutang Square.
//
// The route is found on the exported walk grid (each grid's own step height; the bike on road
// cells), and the traveller is driven along it with the real controls: W and Shift on foot with the
// camera turned to the next waypoint, W and A / D steering on the bike. Time is driven with
// __mufu.step. Screenshots at each stage go to test-results/shots/journey-*.png.
//
//   MUFU_TEST_URL=http://localhost:4190/ node tests/mufu-journey-browser.mjs
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const gpu = process.env.MUFU_SWIFTSHADER
  ? ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
  : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: gpu });
await fs.mkdir("test-results/shots", { recursive: true });
const errors = [], report = { legs: [] };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
  await page.goto(process.env.MUFU_TEST_URL || "http://localhost:4190/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
  await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
  await page.waitForFunction(() => window.__mufu.city.world?.id === "core", null, { timeout: 600000 });

  // Route-finding and driving, installed once in the page.
  await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, g = w.grid, L = 4;
    const key = (code, down) => document.body.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, key: code, bubbles: true }));
    const held = new Set();
    const hold = (codes) => {
      for (const c of held) if (!codes.includes(c)) { key(c, false); held.delete(c); }
      for (const c of codes) if (!held.has(c)) { key(c, true); held.add(c); }
    };
    // A* on a 4 m lattice: on foot any walkable cell within a step; on the bike, road cells, with a
    // short way across a junction's pavement allowed at a cost.
    function route(from, to, mode) {
      const ok = (x, z) => (mode === "bike" ? g.road(x, z) ?? (g.height(x, z) !== null ? "near" : null) : g.height(x, z));
      const id = (i, j) => (i + 4000) * 8000 + (j + 4000);
      const start = [Math.round(from[0] / L), Math.round(from[1] / L)], goal = [Math.round(to[0] / L), Math.round(to[1] / L)];
      const open = [[0, start[0], start[1]]], cost = new Map([[id(...start), 0]]), prev = new Map();
      const push = (n) => { open.push(n); let k = open.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (open[p][0] <= open[k][0]) break; [open[p], open[k]] = [open[k], open[p]]; k = p; } };
      const pop = () => { const top = open[0], last = open.pop(); if (open.length) { open[0] = last; let k = 0; for (;;) { const a = 2 * k + 1, b = a + 1; let s = k; if (a < open.length && open[a][0] < open[s][0]) s = a; if (b < open.length && open[b][0] < open[s][0]) s = b; if (s === k) break; [open[s], open[k]] = [open[k], open[s]]; k = s; } } return top; };
      let seen = 0;
      while (open.length && seen < 900000) {
        const [, i, j] = pop(); seen++;
        if (Math.abs(i - goal[0]) <= 1 && Math.abs(j - goal[1]) <= 1) {
          const out = [[i * L, j * L]]; let k = id(i, j);
          while (prev.has(k)) { k = prev.get(k); out.push([Math.floor(k / 8000) * L - 4000 * L, (k % 8000) * L - 4000 * L]); }
          return { path: out.reverse(), seen };
        }
        const x = i * L, z = j * L, h = g.height(x, z) ?? 0, c0 = cost.get(id(i, j));
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
          const nx = x + di * L, nz = z + dj * L, v = ok(nx, nz);
          if (v === null) continue;
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
          const step = Math.hypot(di, dj) * L * (v === "near" ? 6 : 1) + Math.abs(nh - h) * 2;
          const n = id(i + di, j + dj), c = c0 + step;
          if (c < (cost.get(n) ?? Infinity)) { cost.set(n, c); prev.set(n, id(i, j)); push([c + Math.hypot(nx - to[0], nz - to[1]), i + di, j + dj]); }
        }
      }
      return { path: null, seen };
    }
    // Drive along a path for up to `frames`; returns where it got to.
    function drive(path, mode, frames, dt = 0.1) {
      // A leg is driven in chunks: carry on from where the last chunk left the route, not its start.
      let i = window.__drivePath === path ? window.__driveI : 0, stuck = 0, best = i - 1, top = -Infinity;
      window.__drivePath = path;
      for (let f = 0; f < frames; f++) {
        const b = w.body;
        // Nearest point ahead in a window, then aim 6 m beyond it.
        let k = i, d = Infinity;
        for (let q = i; q < Math.min(path.length, i + 40); q++) { const e = Math.hypot(path[q][0] - b.x, path[q][1] - b.z); if (e < d) { d = e; k = q; } }
        i = k;
        let t = i; while (t < path.length - 1 && Math.hypot(path[t][0] - b.x, path[t][1] - b.z) < 6) t++;
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
    // The top of Mufu Mountain: the highest walkable point over the mountain, on an 8 m scan.
    function summit() {
      let best = null;
      for (let x = -1700; x < 3000; x += 8) for (let n = 8200; n < 10600; n += 8) {
        const h = g.height(x, -n);
        if (h !== null && (!best || h > best[2])) best = [x, -n, h];
      }
      return best;
    }
    // The nearest walkable (or road) spot to (x, z) within r.
    function nearest(x, z, r, test = g.height) {
      for (let d = 0; d <= r; d += 2) for (let a = 0; a < 6.28; a += 0.3) {
        const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
        if (test(px, pz) !== null) return [px, pz];
      }
      return null;
    }
    window.__journey = { route, drive, summit, nearest, w, g };
  });

  const shot = (name) => page.screenshot({ path: `test-results/shots/journey-${name}.png` });
  const leg = async (name, from, to, mode, frames) => {
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

  // Start at Wutang Square, by Line 3's station.
  const start = await page.evaluate(() => {
    const { w, summit, nearest, g } = window.__journey;
    w.placeAt(w.spawn("wutang")); window.__mufu.city.setWay("walk"); window.__mufu.step(5, 0.05);
    const top = summit();
    // The river: a walkable spot at the riverside promenade, north of the mountain, low by the water.
    let river = null;
    for (let d = 0; d < 400 && !river; d += 8) {
      const p = nearest(585 - d * 0.6, -(10264 + d * 0.8), 10, (x, z) => { const h = g.height(x, z); return h !== null && h < 14 ? h : null; });
      if (p) river = p;
    }
    const e = w.transit.entrances.find((x) => x.stop.name === "上元门");
    return { body: [w.body.x, w.body.z], top, river, station: e && e.spot };
  });
  console.log("start", JSON.stringify(start));
  assert.ok(start.top && start.top[2] > 60, "Mufu Mountain's top is walkable and high");
  assert.ok(start.river, "a walkable spot on the riverside promenade");
  await shot("1-wutang");

  const up = await leg("walk up the south side", start.body, [start.top[0], start.top[1]], "walk", 9000);
  assert.ok(up.done, "walked from Wutang Square to the top of Mufu Mountain");
  await shot("2-summit");
  const down = await leg("walk down the north side", [up.at[0], up.at[2]], start.river, "walk", 9000);
  assert.ok(down.done, "walked down the north side to the river");
  await shot("3-riverside");

  await page.evaluate(() => window.__mufu.city.setWay("bike"));
  const here = await page.evaluate(() => [window.__journey.w.body.x, window.__journey.w.body.z]);
  const station = await page.evaluate(([x, z]) => window.__journey.nearest(x, z, 60, window.__journey.g.road), start.station);
  const ride = await leg("bike along the river to Shangyuanmen", here, station, "bike", 9000);
  assert.ok(ride.done, "rode to Shangyuanmen station");
  await shot("4-shangyuanmen");
  const home = await page.evaluate(([x, z]) => window.__journey.nearest(x, z, 80, window.__journey.g.road), start.body);
  const back = await leg("bike back to Wutang Square", [ride.at[0], ride.at[2]], home, "bike", 9000);
  assert.ok(back.done, "rode back to Wutang Square");
  await shot("5-back-at-wutang");

  await fs.writeFile("test-results/mufu-journey.json", JSON.stringify(report, null, 1));
  assert.deepEqual(errors, []);
  console.log("journey ok");
} finally {
  await browser.close();
}
