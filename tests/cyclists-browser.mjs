// Cyclists on the leisure cycleways (item 44, step 4, slice 4; design/STREET-LIFE-PLAN.md), audited in
// the browser on Purple Mountain's greenway:
//   riders     riders drawn at 16:00 near the greenway, as many as its length in range gives; none at 3:00
//   placed     every rider on the ground under it, none on water
//   riding     riders move at cycling speeds, and each pedals: two legs a rider
//   cost       riders updated in under 2 ms a frame
// Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/cyclists-browser.mjs
import { chromium } from "@playwright/test";

const gpu = process.env.MUFU_SWIFTSHADER ? ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: gpu });
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
  await page.waitForFunction(() => window.__mufu.city.world?.id === "core" && window.__mufu.city.world.cyclists, null, { timeout: 600000 });

  // Purple Mountain's greenway (紫金山绿道, OSM): stand at its middle.
  const r = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, c = w.cyclists;
    // The longest way with ground under most of it: the greenway, 2 km.
    const onGround = (q) => q.pts.filter(([x, z]) => w.ground(x, z) != null).length / q.pts.length;
    const way = c.ways.filter((q) => onGround(q) > .5).reduce((b, q) => (q.length > b.length ? q : b));
    const mid = way.pts[Math.floor(way.pts.length / 2)];
    window.__greenway = mid;
    const at = (hour) => { m.setClock(hour, { sky: "clear", season: "autumn" }); w.placeAt({ feet: [mid[0], w.ground(mid[0], mid[1]) ?? 8, mid[1]], look: [mid[0], 8, mid[1] - 10] }); m.step(3, .1); };
    // Expected: the riders on the stretch of every ride way within 300 m of the camera.
    at(16);
    const eye = m.camera.position;
    let metres = 0;
    for (const q of c.ways) for (let i = 1; i < q.pts.length; i++) {
      const [ax, az] = q.pts[i - 1], [bx, bz] = q.pts[i], L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.ceil(L / 5));
      for (let j = 0; j < k; j++) { const x = ax + (bx - ax) * (j + .5) / k, z = az + (bz - az) * (j + .5) / k; if (Math.hypot(x - eye.x, z - eye.z) < 300 && w.ground(x, z) != null) metres += L / k; }
    }
    const pos = c.positions(), legs = w.scene.children.filter((o) => o.isInstancedMesh && o.name === "Cyclists").map((o) => o.count);
    const off = pos.filter(([, x, y, z]) => Math.abs(y - (w.ground(x, z) ?? -999)) > .3).length, wet = pos.filter(([, x, , z]) => w.grid.water(x, z) != null).length;
    // Speed: each rider's nearest position one second later.
    const a = c.positions(); m.step(10, .1); const b = c.positions();
    const moved = a.map((p) => Math.min(...b.map((q) => Math.hypot(q[1] - p[1], q[3] - p[3])))).sort((x, y) => x - y);
    at(3);
    return { way: Math.round(way.length), riders: pos.length, sport: c.stats.sport, km: metres / 1000, off, wet, legs, moved: moved[Math.floor(moved.length / 2)], night: c.stats.riders };
  });
  const want = 4.96 * r.km;
  check("riders", r.riders >= want * .3 && r.riders <= want * 2.5 + 3 && r.night === 0,
    `${r.riders} riders (${r.sport} on road bikes) by the ${r.way} m greenway, ${r.km.toFixed(2)} km of ride in range at 16:00, about ${want.toFixed(1)} expected; ${r.night} at 3:00`);
  check("placed", r.riders > 0 && r.off === 0 && r.wet === 0, `${r.off} riders off the ground, ${r.wet} on water`);
  // The two leg meshes (thighs, shins) hold two legs a rider.
  const legMeshes = r.legs.slice(-2);
  check("riding", r.moved > 2 && r.moved < 8 && legMeshes.every((n) => n === r.riders * 2),
    `median rider moved ${r.moved.toFixed(1)} m in 1 s; legs ${legMeshes.join(", ")} for ${r.riders} riders`);

  const cost = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, ms = [];
    const [x, z] = window.__greenway; m.setClock(16, { sky: "clear", season: "autumn" }); w.placeAt({ feet: [x, w.ground(x, z) ?? 8, z], look: [x, 8, z - 10] }); m.step(2, .1);
    for (let i = 0; i < 30; i++) { const t0 = performance.now(); w.cyclists.update(m.time ?? 100 + i * .05, 16, m.camera.position); ms.push(performance.now() - t0); }
    ms.sort((a, b) => a - b); return { median: +ms[15].toFixed(2), worst: +ms[29].toFixed(2), riders: w.cyclists.stats.riders }; });
  check("cost", cost.median < 2, `median ${cost.median} ms a frame for ${cost.riders} riders, worst ${cost.worst} ms`);
  check("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 3)));
} finally {
  await browser.close();
}
if (fails.length) { console.error(`cyclists FAILED: ${fails.join(", ")}`); process.exit(1); }
console.log("cyclists ok");
