// Cars and e-bikes in the city (item 44, step 4; design/STREET-LIFE-PLAN.md), audited in the browser:
//   loaded     the street file loads and the traffic runs
//   once each  no two vehicles drawn at the same spot
//   on road    every drawn car stands on a road cell of the walk grid (95 % at least: a way's centre
//              line and the stamped road differ by a lane at bends), none on water
//   surface    every car over a road cell stands at that cell's height, not the ground under the road
//   density    the cars counted within 150 m of Xinjiekou at 8:30 against the plan's flow / speed over
//              the mapped road length there (within a factor of 1.5)
//   the day    8:30 busier than 13:00, 13:00 busier than 3:00
//   moving     a car moves at the hour's speed between two frames
//   cost       the per-frame update at 8:30 at Xinjiekou, median under 6 ms
// Shots: test-results/shots/traffic-<name>.png. Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/traffic-browser.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const gpu = process.env.MUFU_SWIFTSHADER ? ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: gpu });
await fs.mkdir("test-results/shots", { recursive: true });
const errors = [], fails = [];
const check = (name, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); if (!ok) fails.push(name); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
  await page.goto(process.env.MUFU_TEST_URL || "http://localhost:4190/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
  await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
  await page.waitForFunction(() => window.__mufu.city.world?.id === "core" && window.__mufu.city.world.traffic, null, { timeout: 600000 });

  // Stand at Xinjiekou at an hour and let the traffic run; return what is drawn.
  const at = (hour, place = [-460, -150]) => page.evaluate(([hour, x, z]) => {
    const m = window.__mufu, w = m.city.world;
    m.setClock(hour, { sky: "clear", season: "summer" });
    const y = w.ground(x, z);
    w.placeAt({ feet: [x, y, z], look: [x, y, z - 10] });
    m.step(6, 0.1);
    const tr = w.traffic, pos = tr.positions();
    return { stats: tr.stats, n: pos.length, cars: pos.filter((p) => p[0] === "car").map((p) => [p[1], p[2], p[3]]),
      cam: [m.camera.position.x, m.camera.position.z] };
  }, [hour, ...place]);

  const peak = await at(8.5);
  check("loaded", peak.stats.cars > 0, JSON.stringify(peak.stats));
  // No vehicle drawn twice: a stretch's index window once wrapped round a short way's loop.
  const twins = await page.evaluate(() => { const seen = new Set(); let n = 0;
    for (const [, x, , z] of window.__mufu.city.world.traffic.positions()) { const k = `${Math.round(x * 4)},${Math.round(z * 4)}`; if (seen.has(k)) n++; seen.add(k); }
    return n; });
  check("once each", twins === 0, `${twins} vehicles drawn on top of another`);

  const where = await page.evaluate((cars) => { const w = window.__mufu.city.world; let road = 0, wet = 0, level = 0, onCell = 0;
    for (const [x, y, z] of cars) { let r = false; for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (w.grid.road(x + dx, z + dz) != null) r = true; if (r) road++; if (w.grid.water(x, z) != null) wet++;
      const rz = w.grid.road(x, z); if (rz != null) { onCell++; if (Math.abs(y - rz) < .05) level++; } }
    return { road, wet, level, onCell, n: cars.length }; }, peak.cars);
  check("on road", where.road >= 0.95 * where.n && where.wet === 0, `${where.road} of ${where.n} cars on a road cell (within 2 m), ${where.wet} on water`);
  // Standing on the road surface itself, not the ground 0.3-0.4 m under it (the owner's view, 23 Nov:
  // cars sunk to their axles).
  check("on the surface", where.level === where.onCell, `${where.level} of ${where.onCell} cars over a road cell stand at its height`);

  // Density near the camera: expected cars = sum over ways of (lanes x length within 150 m x density).
  const dens = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, tr = w.traffic, eye = m.camera.position, R = 150;
    const P = { primary: 2130, secondary: 1250, tertiary: 600, unclassified: 136, residential: 136, living_street: 136, trunk: 4500, motorway: 4500 };
    const S = { primary: 20, secondary: 18, tertiary: 15, unclassified: 12, residential: 12, living_street: 10, trunk: 30, motorway: 30 };
    let want = 0;
    for (const way of tr.near) { const k = way.kind.replace("_link", ""), link = way.kind.endsWith("_link") ? .5 : 1, dirs = way.oneway ? 1 : 2;
      let inside = 0; for (let i = 1; i < way.pts.length; i++) { const a = way.pts[i - 1], b = way.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 2);
        for (let j = 0; j < n; j++) { const x = a[0] + (b[0] - a[0]) * (j + .5) / n, z = a[1] + (b[1] - a[1]) * (j + .5) / n; if (Math.hypot(x - eye.x, z - eye.z) < R) inside += L / n; } }
      want += dirs * inside / 1000 * (P[k] * link) / S[k]; }
    const got = tr.positions().filter((p) => p[0] === "car" && Math.hypot(p[1] - eye.x, p[3] - eye.z) < R).length;
    return { want: Math.round(want), got }; });
  check("density", dens.got > dens.want / 1.5 && dens.got < dens.want * 1.5, `${dens.got} cars within 150 m of Xinjiekou at 8:30, the plan's flows give ${dens.want}`);
  await page.screenshot({ path: "test-results/shots/traffic-xinjiekou-0830.png" });

  const noon = await at(13), night = await at(3);
  check("the day", peak.stats.cars > noon.stats.cars && noon.stats.cars > night.stats.cars * 2, `8:30 ${peak.stats.cars} cars ${peak.stats.bikes} e-bikes; 13:00 ${noon.stats.cars}/${noon.stats.bikes}; 3:00 ${night.stats.cars}/${night.stats.bikes}`);
  await page.screenshot({ path: "test-results/shots/traffic-xinjiekou-0300.png" });

  // Moving: the nearest car to the camera, one second on, has moved about the hour's speed.
  const moved = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, tr = w.traffic;
    m.setClock(13, { sky: "clear", season: "summer" }); m.step(2, 0.1);
    const a = tr.positions().filter((p) => p[0] === "car"); m.step(10, 0.1); const b = tr.positions().filter((p) => p[0] === "car");
    // Match each car to its nearest one second later; the median step is the typical speed.
    const d = a.slice(0, 200).map((p) => Math.min(...b.map((q) => Math.hypot(q[1] - p[1], q[3] - p[3])))).sort((x, y) => x - y);
    return d[Math.floor(d.length / 2)]; });
  check("moving", moved > 3 && moved < 15, `median car moved ${moved.toFixed(1)} m in 1 s (expected 5-11 m/s at 13:00)`);

  // Cost: the traffic is recomputed each frame; at the busiest hour in the busiest place, the median update.
  const cost = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, tr = w.traffic, ms = [];
    m.setClock(8.5, { sky: "clear", season: "summer" });
    for (let i = 0; i < 30; i++) { const t0 = performance.now(); tr.update(100 + i * .05, 8.5, m.camera.position); ms.push(performance.now() - t0); }
    ms.sort((a, b) => a - b); return { median: +ms[15].toFixed(2), worst: +ms[29].toFixed(2), near: tr.near.length }; });
  check("cost", cost.median < 6, `median ${cost.median} ms a frame, worst ${cost.worst} ms, over ${cost.near} ways near the camera`);

  // Views: street level at Xinjiekou at 8:30, and from above along Zhongshan Road.
  await page.evaluate(() => { const m = window.__mufu, w = m.city.world; m.setClock(8.5, { sky: "clear", season: "summer" });
    const x = -470, z = -60, y = w.ground(x, z); w.placeAt({ feet: [x, y, z], look: [x, y, z - 10] }); m.step(6, 0.1);
    m.camera.position.set(-440, y + 70, 120); m.camera.rotation.set(-0.55, 0.15, 0, "YXZ"); m.camera.updateMatrixWorld(); w.traffic.update(m.state?.t ?? 0, 8.5, m.camera.position); m.renderer.render(w.scene, m.camera); });
  await page.screenshot({ path: "test-results/shots/traffic-air-0830.png" });
  check("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 3)));
} finally {
  await browser.close();
}
if (fails.length) { console.error(`traffic FAILED: ${fails.join(", ")}`); process.exit(1); }
console.log("traffic ok");
