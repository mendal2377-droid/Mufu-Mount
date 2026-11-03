// A journey onto Purple Mountain, now that the Zhongshan world stands in the city at its real place
// (blender/zhongshan_merge.py): walk from Bus 34's Zhongshan Gate stop to the Bo'ai arch (by the
// shortest way the walk grid allows, roads or woods), up the Mausoleum's stair to the Sacrificial
// Hall, on to the mountain's top; then by bike from the arch back by road to the gate.
//
// Routes are found on the exported walk grid and driven with the real controls (tests/journey-kit.mjs);
// time is driven with __mufu.step. Screenshots at each stage go to test-results/shots/zs-journey-*.png.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/zhongshan-journey-browser.mjs
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { installJourney, legRunner } from "./journey-kit.mjs";

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
  await installJourney(page);
  const leg = legRunner(page, report);
  const shot = (name) => page.screenshot({ path: `test-results/shots/zs-journey-${name}.png` });

  const start = await page.evaluate(() => {
    const { w, g } = window.__journey, m = window.__mufu;
    m.setClock(10, { sky: "clear", season: "summer" });
    const at = (id) => { const p = w.meta.spawns[id]?.position; return p ? [p[0], p[2]] : null; };
    const gate = w.transit.lines.find((l) => l.id === "bus-34")?.runs.flatMap((r) => r.stops.map((q) => q.stop)).find((s) => s.name === "中山门");
    // The mountain's top: the highest walkable point over Purple Mountain's ridge, on an 8 m scan.
    let top = null;
    for (let x = 3500; x < 5700; x += 8) for (let n = 2300; n < 4100; n += 8) {
      const h = g.height(x, -n);
      if (h !== null && (!top || h > top[2])) top = [x, -n, h];
    }
    return { gate: gate && gate.spot, arch: at("zs-axis"), hall: at("zs-hall"), top };
  });
  console.log("start", JSON.stringify(start));
  assert.ok(start.gate, "Bus 34 stops at Zhongshan Gate");
  assert.ok(start.arch && start.hall, "the Mausoleum's spawns are in the city");
  assert.ok(start.top && start.top[2] > 300, "Purple Mountain's top is walkable and high");

  await page.evaluate(([x, z]) => {
    const { w } = window.__journey;
    w.body.set(x, w.ground(x, z) ?? 10, z); window.__mufu.city.setWay("walk"); window.__mufu.step(200, 0.05);
  }, start.gate);
  await shot("1-zhongshan-gate");
  const out = await leg("walk from Zhongshan Gate to the Bo'ai arch", start.gate, start.arch, "walk", 15000);
  assert.ok(out.done, "walked from Zhongshan Gate to the Bo'ai arch");
  await shot("2-boai-arch");
  const up = await leg("walk up the stair to the Sacrificial Hall", [out.at[0], out.at[2]], start.hall, "walk", 9000);
  assert.ok(up.done, "walked up to the Sacrificial Hall");
  await shot("3-sacrificial-hall");
  const top = await leg("walk on to the mountain's top", [up.at[0], up.at[2]], [start.top[0], start.top[1]], "walk", 15000);
  assert.ok(top.done, "walked from the Hall to Purple Mountain's top");
  await shot("4-summit");

  // Then by bike, by road, back to the gate, from where the road ends nearest the arch: the arch
  // stands on its plaza, off the road, so the bike's route from the gate toward it ends short; the
  // nearest point it reaches is the start. (The roads at the plaza's edge are OSM stubs; the one
  // that joins the town runs off north-east and round.)
  const ends = await page.evaluate(([arch, gate]) => {
    const { w, nearest, route, g } = window.__journey;
    const to = nearest(gate[0], gate[1], 60, g.road), r = to && route(to, arch, "bike");
    const from = r && (r.path ? r.path[r.path.length - 1] : r.closest);
    if (!from) return {};
    w.body.set(from[0], w.ground(from[0], from[1]) ?? 10, from[1]); window.__mufu.city.setWay("bike"); window.__mufu.step(10, 0.05);
    return { from: [from[0], from[1]], to, fromArch: Math.hypot(from[0] - arch[0], from[1] - arch[1]) };
  }, [start.arch, start.gate]);
  console.log("bike start", JSON.stringify(ends));
  assert.ok(ends.from && ends.to && ends.fromArch < 100, "road by the gate, and by road to within 100 m of the arch");
  const ride = await leg("bike from the Mausoleum back by road to Zhongshan Gate", ends.from, ends.to, "bike", 24000);
  assert.ok(ride.done, "rode from the Mausoleum to Zhongshan Gate");
  await shot("5-back-at-the-gate");

  await fs.writeFile("test-results/zhongshan-journey.json", JSON.stringify(report, null, 1));
  assert.deepEqual(errors, []);
  console.log("journey ok");
} finally {
  await browser.close();
}
