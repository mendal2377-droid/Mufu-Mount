// Journeys in the city (item 44, step 2; src/world-journeys.js), checked in the browser:
//   listed    the menu's Journeys dialog lists every journey of the city, none made
//   places    every step's place has walkable ground (the walk grid) where the step expects it
//   392 steps walking with the real controls from the stair's foot to the Sacrificial Hall ticks both steps
//   metro     riding Line 1 from Nanjing Railway Station to Xiaozhuang makes the viaduct journey
//   dropped   arriving at the hall without climbing ticks nothing
// A shot to test-results/shots/journeys.png. Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/journeys-browser.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { installJourney } from "./journey-kit.mjs";

const gpu = process.env.MUFU_SWIFTSHADER ? ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: gpu });
await fs.mkdir("test-results/shots", { recursive: true });
const errors = [], fails = [];
const check = (name, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); if (!ok) fails.push(name); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
  await page.goto(process.env.MUFU_TEST_URL || "http://localhost:4190/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
  await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
  await page.waitForFunction(() => window.__mufu.city.world?.id === "core" && window.__mufu.city.world.journeys !== undefined, null, { timeout: 600000 });
  await installJourney(page);
  const view = () => page.evaluate(() => window.__mufu.city.world.journeys.view().map((j) => [j.id, j.done, j.total, j.finished]));

  const listed = await page.evaluate(() => {
    const m = window.__mufu; m.city.world.journeys.reset(); m.city.journeys(true);
    const cards = [...document.querySelectorAll("#journeys-grid .journey-card")];
    const out = { open: document.querySelector("#city-journeys").open, n: cards.length, steps: cards.map((c) => c.querySelectorAll("li").length), made: cards.filter((c) => c.classList.contains("made")).length,
      count: document.querySelector("#journeys-count").textContent, button: !document.querySelector("#city-journeys-open").hidden };
    return out;
  });
  check("listed", listed.open && listed.n === 7 && listed.made === 0 && listed.button && listed.steps.every((k) => k >= 2), JSON.stringify(listed));
  await page.screenshot({ path: "test-results/shots/journeys.png" });
  await page.evaluate(() => window.__mufu.city.journeys(false));

  // Each place a step names: walkable ground within reach of it. [journey, step, x, north, radius]
  const PLACES = [["steps392", 0, 6093, 2389, 90], ["steps392", 1, 6086, 2470, 40], ["summit", 0, 6120, 1857, 45], ["summit", 1, 5444, 3388, 150],
    ["xuanwu", 0, -82, 3418, 25], ["xuanwu", 1, 447, 3616, 28], ["xuanwu", 2, 474, 3568, 28], ["xuanwu", 3, 544, 4086, 90], ["xuanwu", 4, 1003, 4007, 90], ["xuanwu", 5, 916, 3132, 90],
    ["mufu", 0, -1065, 7860, 70], ["riverbike", 1, -1803, 8434, 90]];
  const places = await page.evaluate((P) => { const g = window.__mufu.city.world.grid, bad = [];
    for (const [id, i, x, n, r] of P) { let ok = false, top = -1e9;
      for (let a = -r; a <= r && !ok; a += 4) for (let b = -r; b <= r; b += 4) if (a * a + b * b < r * r * 0.8) { const h = g.height(x + a, -n + b); if (h !== null) { top = Math.max(top, h); if (id !== "summit" || i !== 1 || h > 430) { ok = true; break; } } }
      if (!ok) bad.push([id, i, top]); }
    // Mufu's top above 180 m; the Yangtze's bank below 14 m; a road for the bike by the river.
    let mufuTop = -1e9, bank = false, road = false;
    for (let x = -1700; x < 3000; x += 8) for (let n = 8200; n < 10600; n += 8) { const h = g.height(x, -n); if (h !== null) { mufuTop = Math.max(mufuTop, h); if (x > -400 && x < 1400 && n > 10150 && h < 14) bank = true; }
      if (x > -1500 && x < 1500 && n > 10000) { const rh = g.road(x, -n); if (rh !== null && rh < 20) road = true; } }
    return { bad, mufuTop, bank, road }; }, PLACES);
  check("places", places.bad.length === 0 && places.mufuTop > 180 && places.bank && places.road, JSON.stringify(places));

  // Dropped at the hall: nothing. Then the climb with the real controls, on the route the Zhongshan
  // journey test proves (from the Bo'ai arch up the axis; the stair spawn itself stands boxed in on
  // the route-finder's 4 m lattice).
  const start = await page.evaluate(() => {
    const { w, route } = window.__journey, m = window.__mufu, jn = w.journeys;
    w.placeAt(w.spawn("zs-hall")); m.city.setWay("walk"); m.step(6, 0.1);
    const dropped = jn.view().find((j) => j.id === "steps392").done;
    w.placeAt(w.spawn("zs-axis")); m.step(6, 0.1);
    const hall = w.meta.spawns["zs-hall"].position, res = route([w.body.x, w.body.z], [hall[0], hall[2]], "walk");
    window.__leg = res.path;
    return { dropped, route: !!res.path };
  });
  check("dropped", start.dropped === 0, `steps ticked on arrival at the hall: ${start.dropped}`);
  let out = null, mid = 0;
  for (let spent = 0; start.route && spent < 9000 && !out?.done && !out?.stuck; spent += 600) {
    out = await page.evaluate(() => { const r = window.__journey.drive(window.__leg, "walk", 600); r.j = window.__journey.w.journeys.view().filter((j) => j.id === "steps392" || j.id === "summit").map((j) => [j.id, j.done, j.finished]); return r; });
    if (out.j[0][1] === 1) mid = 1;
  }
  const toast = await page.evaluate(() => document.querySelector("#toast")?.textContent || "");
  // (An ordered journey finishes only in order: both steps may tick inside one 600-frame chunk.)
  check("392 steps", start.route && out?.done && out.j[0][2] === true, JSON.stringify({ done: out?.done, mid, j: out?.j, at: out?.at?.map(Math.round), toast }));
  // The same walk began at the Bo'ai arch: the summit journey's first step.
  check("arch", out?.j?.[1]?.[1] === 1, JSON.stringify(out?.j?.[1]));

  const metro = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, tr = w.transit;
    const e = tr.entrances.find((x) => x.line.id === "subway-1" && x.stop.en === "Nanjing Railway Station");
    const to = e?.line.stops.find((s) => s.en === "Xiaozhuang");
    if (!e || !to) return { found: false };
    w.placeAt({ feet: [e.spot[0], w.ground(e.spot[0], e.spot[1]) ?? 10, e.spot[1]], look: [e.spot[0], 10, e.spot[1] - 10] }); m.step(4, 0.1);
    const seconds = w.rideMetro(e.line, e.stop, to, {});
    m.step(Math.ceil(seconds / 0.05) + 60, 0.05);
    return { found: true, seconds, riding: !!tr.metroRide, j: w.journeys.view().find((j) => j.id === "metro1") };
  });
  check("metro", metro.found && metro.j?.finished && !metro.riding, JSON.stringify({ seconds: metro.seconds, riding: metro.riding, j: metro.j && [metro.j.done, metro.j.total] }));

  const made = await page.evaluate(() => { const m = window.__mufu; m.city.journeys(true);
    return { count: document.querySelector("#journeys-count").textContent, made: [...document.querySelectorAll("#journeys-grid .journey-card.made")].map((c) => c.dataset.id), saved: localStorage.getItem("mufu-journeys-v1") }; });
  check("shown and saved", made.count === "2" && made.made.length === 2 && /steps392/.test(made.saved) && /metro1/.test(made.saved), JSON.stringify(made));
  await page.screenshot({ path: "test-results/shots/journeys-made.png" });
  console.log("journeys view", JSON.stringify(await view()));
  check("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 3)));
} finally {
  await browser.close();
}
if (fails.length) { console.error(`journeys FAILED: ${fails.join(", ")}`); process.exit(1); }
console.log("journeys ok");
