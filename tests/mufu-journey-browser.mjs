// A real journey through Tiny Nanjing and Mufu Mountain, set by the owner (1 November 2026):
// walk from Wutang Square up Mufu Mountain's south side to the top, down its north side to the
// river; on to the riverside road, then by bike along the river to Shangyuanmen station and back to
// Wutang Square.
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
  // The top of Mufu Mountain: the highest walkable point over the mountain, on an 8 m scan.
  await page.evaluate(() => {
    const { g } = window.__journey;
    function summit() {
      let best = null;
      for (let x = -1700; x < 3000; x += 8) for (let n = 8200; n < 10600; n += 8) {
        const h = g.height(x, -n);
        if (h !== null && (!best || h > best[2])) best = [x, -n, h];
      }
      return best;
    }
    window.__journey.summit = summit;
  });

  const shot = (name) => page.screenshot({ path: `test-results/shots/journey-${name}.png` });
  const leg = legRunner(page, report);

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

  // The promenade is no road: walk to the riverside road, then get on the bike.
  const road = await page.evaluate(() => { const { w, nearest, g } = window.__journey; return nearest(w.body.x, w.body.z, 200, g.road); });
  assert.ok(road, "a road by the riverside promenade");
  const onRoad = await leg("walk to the riverside road", [down.at[0], down.at[2]], road, "walk", 3000);
  assert.ok(onRoad.done, "walked to the riverside road");
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
