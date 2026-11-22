// People and boats in the city (item 44, step 4, slice 2; design/STREET-LIFE-PLAN.md), audited in the browser:
//   people     walkers drawn round Huanzhou at 16:30, on walkable ground, none on water, fewer at 3:00
//   walking    a walker moves at a walking pace between frames
//   cost       walkers and boats updated in under 6 ms a frame at the lake at 16:30
//   boats      none out at 8:00; the day's number out at noon, all on water, all still afloat after 5
//              minutes, none run aground
// Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/people-browser.mjs
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
  await page.waitForFunction(() => window.__mufu.city.world?.id === "core" && window.__mufu.city.world.people && window.__mufu.city.world.boats !== undefined, null, { timeout: 600000 });

  const at = (hour, x = 455, z = -3640) => page.evaluate(([hour, x, z]) => { const m = window.__mufu, w = m.city.world;
    m.setClock(hour, { sky: "clear", season: "summer" }); w.placeAt({ feet: [x, w.ground(x, z) ?? 8, z], look: [x, 8, z - 10] }); m.step(4, 0.1);
    const pos = w.people.positions();
    return { n: pos.length, ground: pos.filter(([x, y, z]) => w.grid.height(x, z) != null).length, wet: pos.filter(([x, , z]) => w.grid.water(x, z) != null).length }; }, [hour, x, z]);
  const day = await at(16.5), night = await at(3);
  check("people", day.n > 200 && day.ground >= day.n * .97 && day.wet === 0 && night.n < day.n / 10,
    `${day.n} walkers round Huanzhou at 16:30, ${day.ground} on walkable ground, ${day.wet} on water; ${night.n} at 3:00`);

  const pace = await page.evaluate(() => { const m = window.__mufu, w = m.city.world; m.setClock(16.5, { sky: "clear", season: "summer" }); m.step(2, .1);
    const a = w.people.positions(); m.step(10, .1); const b = w.people.positions();
    const d = a.slice(0, 150).map((p) => Math.min(...b.map((q) => Math.hypot(q[0] - p[0], q[2] - p[2])))).sort((x, y) => x - y); return d[Math.floor(d.length / 2)]; });
  check("walking", pace > .8 && pace < 2, `median walker moved ${pace.toFixed(2)} m in 1 s`);

  const boats = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, b = w.boats;
    m.setClock(8, { sky: "clear", season: "summer" }); m.step(3, .1); const early = b.stats.boats;
    m.setClock(12, { sky: "clear", season: "summer" }); m.step(3, .1); const noon = b.stats.boats, out = b.stats.out;
    const wet = () => b.fleet.filter((q) => w.grid.water(q.x, q.z) != null).length;
    const first = wet(); m.step(3000, .1);
    const shore = b.fleet.filter((q) => [0, 1, 2, 3, 4, 5, 6, 7].some((k) => w.grid.water(q.x + Math.cos(k * .785) * 2, q.z + Math.sin(k * .785) * 2) == null)).length;
    return { early, noon, out, first, later: wet(), shore, n: b.fleet.length }; });
  check("boats", boats.early === 0 && boats.noon === boats.out && boats.out > 40 && boats.first === boats.n && boats.later === boats.n && boats.shore <= boats.n * .1,
    `8:00 ${boats.early} out; noon ${boats.noon} of ${boats.out}; on water ${boats.first} then ${boats.later} after 5 minutes; ${boats.shore} within 2 m of the shore`);
  // Cost: walkers and boats are worked out each frame; at the lake at 16:30, the median update.
  const cost = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, ms = [];
    m.setClock(16.5, { sky: "clear", season: "summer" }); const x = 455, z = -3640; w.placeAt({ feet: [x, w.ground(x, z) ?? 8, z], look: [x, 8, z - 10] }); m.step(2, .1);
    for (let i = 0; i < 30; i++) { const t0 = performance.now(); w.people.update(2000 + i * .05, 16.5, m.camera.position); w.boats.update(2000 + i * .05, 16.5); ms.push(performance.now() - t0); }
    ms.sort((a, b) => a - b); return { median: +ms[15].toFixed(2), worst: +ms[29].toFixed(2), people: w.people.stats.people }; });
  check("cost", cost.median < 6, `median ${cost.median} ms a frame for ${cost.people} walkers and the boats, worst ${cost.worst} ms`);
  check("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 3)));
} finally {
  await browser.close();
}
if (fails.length) { console.error(`people FAILED: ${fails.join(", ")}`); process.exit(1); }
console.log("people ok");
