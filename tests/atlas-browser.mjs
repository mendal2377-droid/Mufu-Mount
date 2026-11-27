// One map to every place (design/NAVIGATOR-PLAN.md; src/atlas-map.js), audited in the browser:
//   home      the home page opens on the flat map, every place on it; a place's card offers Go now;
//             the 3D view switch closes it, and the home page's map button opens it again
//   keys      in the city N, G and M each open the same map
//   metro     from Xinjiekou, Xuanwu Lake's card offers the metro to the station at its gate, the
//             ride's legs named; "Lead me" sets a walking route to that station
//   route     a far place's card offers the gold route; choosing it sets one
//   go now    Go now from the card enters the place
//   stops     the minimap marks metro entrances and bus stops; near one, the chip names it, and at
//             it says F rides from there
//   no page errors
// Shots: test-results/shots/atlas-*.png. Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/atlas-browser.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const gpu = process.env.MUFU_SWIFTSHADER ? ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: gpu });
await fs.mkdir("test-results/shots", { recursive: true });
const errors = [], fails = [];
const check = (name, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); if (!ok) fails.push(name); };
const open = (page) => page.evaluate(() => document.querySelector("#atlas-map").open);
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
  await page.goto(process.env.MUFU_TEST_URL || "http://localhost:4190/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
  const press = (code) => page.evaluate((code) => { for (const t of ["keydown", "keyup"]) document.body.dispatchEvent(new KeyboardEvent(t, { code, key: code, bubbles: true })); }, code);

  // --- home ---------------------------------------------------------------------------------------
  await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.showPlan(); });
  await page.waitForFunction(() => document.querySelector("#atlas-map")?.open, null, { timeout: 60000 });
  await page.evaluate(() => window.__mufu.city.atlas.ready);
  const home = await page.evaluate(() => { const a = window.__mufu.city.atlas; a.draw(); const pins = a.pins.length, card = a.pick("zhonghua");
    return { pins, card, view3d: !document.querySelector('#atlas-map [data-act="view3d"]').hidden }; });
  await page.screenshot({ path: "test-results/shots/atlas-home.png" });
  await page.locator('#atlas-map [data-act="view3d"]').click();
  const closed3d = !(await open(page));
  await page.locator("#city-open-map").click();
  const reopened = await open(page);
  check("home", home.pins === 18 && home.card.includes("now") && home.view3d && closed3d && reopened,
    `${home.pins} places; Zhonghua Gate's card offers ${home.card.join(", ")}; 3D view closes the map: ${closed3d}; the map button opens it: ${reopened}`);
  await page.evaluate(() => document.querySelector("#atlas-map").close());

  // --- in the city ---------------------------------------------------------------------------------
  await page.evaluate(() => window.__mufu.city.enter("zifeng"));
  await page.waitForFunction(() => window.__mufu.city.world?.nav && window.__mufu.city.world.transit, null, { timeout: 600000 });
  await page.evaluate(() => { const m = window.__mufu, w = m.city.world; w.placeAt(w.spawn("xinjiekou")); m.step(5, .1); });
  const keys = [];
  for (const k of ["KeyN", "KeyG", "KeyM"]) { await press(k); await page.evaluate(() => window.__mufu.step(1, .1)); keys.push(await open(page)); await page.evaluate(() => document.querySelector("#atlas-map").close()); }
  check("keys", keys.every(Boolean), `N, G, M open the map: ${keys.join(", ")}`);

  // --- metro -----------------------------------------------------------------------------------------
  await press("KeyN");
  const metro = await page.evaluate(() => { const a = window.__mufu.city.atlas, buttons = a.pick("xuanwu");
    return { buttons, text: document.querySelector("#atlas-card .atlas-metro")?.textContent || "" }; });
  await page.screenshot({ path: "test-results/shots/atlas-metro.png" });
  const lead = await page.evaluate(() => { document.querySelector('#atlas-card [data-go="metro"]')?.click(); const w = window.__mufu.city.world, r = w.nav.route;
    return { open: document.querySelector("#atlas-map").open, route: r && { label: r.label, len: Math.round(r.length), car: r.car, straight: r.straight } }; });
  const walkEnd = +(metro.text.match(/then walk ([\d.]+) (k?m)/) || [0, 9e9, "m"]).slice(1).reduce((v, u) => (u === "km" ? v * 1000 : +v));
  check("metro", metro.buttons.includes("metro") && /Xuanwumen/.test(metro.text) && /Line 1/.test(metro.text) && walkEnd < 600 && !lead.open && lead.route && !lead.route.car && !lead.route.straight && lead.route.len < 300,
    `"${metro.text.replace(/\s+/g, " ").trim()}"; led to ${JSON.stringify(lead.route)}`);

  // --- route -------------------------------------------------------------------------------------------
  await press("KeyN");
  const route = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, a = m.city.atlas; w.nav.clear(); const buttons = a.pick("zhongshan");
    document.querySelector('#atlas-card [data-go="route"]')?.click(); const r = w.nav.route;
    return { buttons, route: r && { label: r.label, len: Math.round(r.length), straight: r.straight } }; });
  check("route", route.buttons.includes("route") && route.route && !route.route.straight && route.route.len > 5000,
    `Zhongshan's card offers ${route.buttons.join(", ")}; the route: ${JSON.stringify(route.route)}`);
  await page.evaluate(() => window.__mufu.city.world.nav.clear());

  // --- stops -------------------------------------------------------------------------------------------
  const stops = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, tr = w.transit;
    // The nearest metro entrance to Xinjiekou: 30 m from it, then at it.
    const e = tr.entrances.map((q) => ({ q, d: Math.hypot(q.spot[0] - w.body.x, q.spot[1] - w.body.z) })).sort((a, b) => a.d - b.d)[0].q;
    const at = (d) => { const x = e.spot[0] + d, z = e.spot[1]; const h = w.grid.height(x, z) ?? w.body.y; w.placeAt({ feet: [x, h, z], look: [e.spot[0], h, e.spot[1]] }); m.step(3, .1); const c = document.querySelector("#transit-hint"); return { shown: !c.hidden && getComputedStyle(c).display !== "none", text: c.textContent }; };
    const far = at(30), near = at(2);
    const marks = tr.entrances.filter((q) => Math.hypot(q.spot[0] - w.body.x, q.spot[1] - w.body.z) < 200).length;
    return { far, near, marks, busStops: (tr.stops || []).length, station: e.stop.en }; });
  await page.screenshot({ path: "test-results/shots/atlas-stop-hint.png" });
  check("stops", stops.far.shown && stops.near.shown && /F to/.test(stops.near.text) && !/F to/.test(stops.far.text) && stops.marks > 0 && stops.busStops > 20,
    `${stops.station}: 30 m away "${stops.far.text}"; at it "${stops.near.text}"; ${stops.marks} entrances within 200 m for the minimap; ${stops.busStops} bus stops`);

  // --- go now -----------------------------------------------------------------------------------------
  await press("KeyN");
  const go = await page.evaluate(() => { const m = window.__mufu; m.city.atlas.pick("palace"); document.querySelector('#atlas-card [data-go="now"]').click(); m.step(60, .1);
    return { selected: m.city.selected?.id, open: document.querySelector("#atlas-map").open }; });
  check("go now", go.selected === "palace" && !go.open, JSON.stringify(go));

  check("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 5)));
} finally {
  await browser.close();
}
if (fails.length) throw new Error("atlas failed: " + fails.join(", "));
console.log("atlas ok");
