// The bus chooser (the owner, 1 Nov 2026: choose the line at a stop, and where to get off).
// At a stop F opens the lines; a line opens its stops ahead; the rider is put off at the one chosen.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "core", null, { timeout: 600000 });
const fail = (m) => { console.log("FAIL", m, errors.slice(0, 3)); process.exit(1); };
// Stand at Gulou Hospital's stop, on Bus 34's first run.
await page.evaluate(() => {
  const m = window.__mufu, w = m.city.world, tr = w.transit;
  const st = tr.lines.find((l) => l.id === "bus-34").runs[0].stops.find((q) => q.stop.name === "鼓楼医院").stop.shelter;
  w.body.set(st.spot[0], w.ground(st.spot[0], st.spot[1]) ?? w.body.y, st.spot[1]);
  m.step(2, 0.05);
});
await page.evaluate(() => window.__mufu.city.interact());
await page.waitForSelector("#bus-pick[open]", { timeout: 10000 }).catch(() => fail("no chooser at the stop"));
const lines = await page.$$eval("#bus-lines button span", (s) => s.map((x) => x.textContent));
console.log("lines:", lines);
await page.screenshot({ path: "test-results/shots/bus-choose-lines.png" });
const i34 = lines.findIndex((t) => t.startsWith("Bus 34"));
if (i34 < 0) fail("Bus 34 not offered");
await page.locator("#bus-lines button").nth(i34).click();
const stops = await page.$$eval("#bus-lines button span", (s) => s.map((x) => x.textContent));
console.log("stops:", stops.slice(0, 6));
await page.screenshot({ path: "test-results/shots/bus-choose-stops.png" });
if (stops[0] !== "Decide on the bus" || stops.length < 4) fail("no stops to choose");
// Two stops ahead (index 0 is "decide on the bus").
const want = stops[2].split(" · ")[0];
await page.locator("#bus-lines button").nth(2).click();
const res = await page.evaluate(async (want) => {
  const m = window.__mufu, w = m.city.world, tr = w.transit;
  let boarded = false, off = null;
  for (let f = 0; f < 6000 && !off; f++) {
    m.step(1, 0.25);
    if (tr.busRide) boarded = true;
    if (boarded && !tr.busRide) {
      const st = tr.lines.filter((l) => l.runs).flatMap((l) => l.runs.flatMap((r) => r.stops.map((q) => q.stop))).find((s) => s.en === want);
      off = { at: Math.round(Math.hypot(w.body.x - st.spot[0], w.body.z - st.spot[1])) };
    }
  }
  return { boarded, off };
}, want);
console.log("ride:", JSON.stringify(res), "wanted", want);
if (!res.boarded) fail("never boarded");
if (!res.off || res.off.at > 30) fail("not put off at the chosen stop");
console.log("ok bus chooser", errors.slice(0, 3));
await browser.close();
