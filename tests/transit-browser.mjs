// Metro and buses in Tiny Nanjing (src/transit.js): ride Line 1 from Xinjiekou to Gulou and step
// out at the station; wait for a bus on Zhongshan Road, ride it and get off at the next stop; see
// a Line 1 train on the viaduct; fly the paraglider in the city without losing the traveller;
// take Line 3 to Shangyuanmen and arrive on the Mufu Mountain walk.
//
//   MUFU_TEST_URL=http://localhost:4190/ node tests/transit-browser.mjs
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

const gpu = process.env.MUFU_SWIFTSHADER
  ? ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
  : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: gpu });
await fs.mkdir("test-results/shots", { recursive: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
  await page.goto(process.env.MUFU_TEST_URL || "http://localhost:4190/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
  await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
  await page.waitForFunction(() => window.__mufu.city.world?.id === "core", null, { timeout: 600000 });

  const stats = await page.evaluate(() => window.__mufu.city.world.transit?.stats());
  console.log("transit", JSON.stringify(stats));
  assert.ok(stats, "Tiny Nanjing loads its transit lines");
  assert.ok(stats.buses >= 4 && stats.entrances >= 20 && stats.trains >= 2, "buses, station entrances and viaduct trains");

  // Metro: Line 1, Xinjiekou to Gulou. The ride is shown from above with the line drawn; it calls
  // Zhujiang Road on the way and leaves the traveller on foot beside the Gulou entrance.
  const metro = await page.evaluate(async () => {
    const m = window.__mufu, w = m.city.world, tr = w.transit, log = [];
    const e = tr.entrances.find((x) => x.line.id === "subway-1" && x.stop.name === "新街口");
    const to = e.line.stops.find((s) => s.name === "鼓楼");
    const seconds = w.rideMetro(e.line, e.stop, to, { onStation: (s) => log.push(s.name), arrive: (x) => log.push("arrive " + x.stop.name) });
    m.step(Math.ceil(seconds / 0.05 / 2), 0.05);
    const mid = { riding: !!tr.metroRide, camY: m.camera.position.y, ribbon: e.line.ribbon.visible };
    m.step(Math.ceil(seconds / 0.05 / 2) + 40, 0.05);
    const b = w.body;
    return { seconds, mid, log, riding: !!tr.metroRide, body: b.toArray(), ground: w.ground(b.x, b.z) };
  });
  console.log("metro", JSON.stringify(metro));
  assert.ok(metro.mid.riding && metro.mid.ribbon && metro.mid.camY > 100, "mid-ride: the line is drawn and the view is from above");
  assert.ok(metro.log.includes("珠江路") && metro.log.at(-1) === "arrive 鼓楼", "Zhujiang Road is called, then Gulou");
  assert.ok(!metro.riding && metro.ground !== null, "on foot on walkable ground at Gulou");
  await page.screenshot({ path: "test-results/shots/transit-metro-arrival.png" });

  // The carriage (V during a ride): deep under the city, the line's colour in the car, the platform
  // of the last station alongside at the end; and back above with V.
  const carriage = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, tr = w.transit;
    const e = tr.entrances.find((x) => x.line.id === "subway-2" && x.stop.name === "新街口");
    const to = e.line.stops.find((s) => s.name === "大行宫");
    if (w.view !== "first") w.toggleView();
    const seconds = w.rideMetro(e.line, e.stop, to, {});
    m.step(20, 0.05);
    const inside = { carriage: tr.inCarriage, camY: m.camera.position.y, ribbon: e.line.ribbon.visible };
    m.step(Math.ceil(seconds / 0.05) + 20, 0.05);
    w.toggleView();
    return { inside, after: { carriage: tr.inCarriage, riding: !!tr.metroRide } };
  });
  console.log("carriage", JSON.stringify(carriage));
  assert.ok(carriage.inside.carriage && carriage.inside.camY < -300 && !carriage.inside.ribbon, "first person rides inside the carriage, under the city");
  assert.ok(!carriage.after.carriage && !carriage.after.riding, "the carriage closes on arrival");

  // X-ray and street level: underground trains show from high above and fade at street level;
  // the next-train time comes from the running trains.
  const xray = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, tr = w.transit;
    const street = tr.xray;
    const e = tr.entrances.find((x) => x.line.id === "subway-1" && x.stop.name === "新街口");
    return { street, next: tr.nextTrain(e.line, e.stop), trains: tr.runners.length };
  });
  console.log("xray", JSON.stringify(xray));
  assert.ok(xray.street < 0.05, "no x-ray at street level");
  assert.ok(xray.trains >= 20 && xray.next >= 0 && xray.next < 240, "trains on every line; the next is minutes away at most");

  // Buses keep to the carriageway, stop on their own side of the road, and never drive through one
  // another (the owner saw all three on Zhongshan Road).
  const traffic = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, g = w.grid, tr = w.transit, out = {onRoad: {}};
    for (const line of tr.lines.filter((l) => l.kind === "bus")) {
      let on = 0, seen = 0;
      for (const run of line.runs) for (let k = 0; k < run.r.n; k += 2) {
        const x = run.r.xs[k], z = run.r.zs[k];
        if (g.height(x, z) === null && g.road(x, z) === null) continue;
        seen++; if (g.road(x, z) !== null) on++;
      }
      out.onRoad[line.id] = on / Math.max(1, seen);
    }
    const sides = tr.lines.find((l) => l.id === "bus-34").runs.map((r) => r.stops.find((q) => q.stop.name === "鼓楼医院")?.stop.spot);
    out.apart = Math.hypot(sides[0][0] - sides[1][0], sides[0][1] - sides[1][1]);
    let overlaps = 0;
    for (let f = 0; f < 600; f++) {
      m.step(1, 0.2);
      if (f % 10) continue;
      const bs = tr.buses.filter((b) => b.p.x !== undefined);
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        const a = bs[i].p, b = bs[j].p;
        if (Math.cos(a.h - b.h) > .6 && Math.hypot(a.x - b.x, a.z - b.z) < 9) overlaps++;
      }
    }
    out.overlaps = overlaps;
    return out;
  });
  console.log("traffic", JSON.stringify(traffic));
  assert.ok(Object.values(traffic.onRoad).every((v) => v > .9), "every bus route keeps to the carriageway");
  assert.ok(traffic.apart > 12, "a stop on each side of the road");
  assert.equal(traffic.overlaps, 0, "no bus drives through another");

  // Bus: wait at Gulou Hospital (鼓楼医院) on Zhongshan Road, board, get off at the next stop.
  const bus = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, tr = w.transit, log = [];
    const line = tr.lines.find((l) => l.id === "bus-1"), st = line.stops.find((s) => s.name === "鼓楼医院");
    w.body.set(st.spot[0], w.ground(st.spot[0], st.spot[1]) ?? w.body.y, st.spot[1]);
    const near = w.nearestTransit();
    w.waitForBus(near.stop, (b) => log.push("board " + b.line.id));
    let n = 0;
    while (!tr.busRide && n < 6000) { m.step(20, 0.05); n += 20; }
    const boardedAfter = n * 0.05;
    w.getOffBus((s) => log.push("off " + s.name));
    n = 0;
    while (tr.busRide && n < 6000) { m.step(20, 0.05); n += 20; }
    const b = w.body;
    return { near: near?.kind, boardedAfter, log, from: st.name, riding: !!tr.busRide, ground: w.ground(b.x, b.z) };
  });
  console.log("bus", JSON.stringify(bus));
  assert.equal(bus.near, "bus", "a bus stop is found where the traveller stands");
  assert.ok(bus.log[0] === "board bus-1" && bus.log[1]?.startsWith("off ") && bus.log[1] !== "off " + bus.from, "boards, then gets off at another stop");
  assert.ok(!bus.riding && bus.ground !== null, "back on foot on walkable ground");

  // A Line 1 train on the viaduct, and the paraglider over the north of the map stays finite.
  const sky = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, tr = w.transit, r = tr.lines[0].route;
    const u = tr.runners[0]; u.s = 1700; m.step(1, 0.05);
    const up = tr.lift(tr.lines[0], u.s) > 5;
    m.city.setWay("fly");
    const k = 900; w.body.set(r.xs[k] + 80, r.ys[k] + 60, r.zs[k] + 80);
    m.step(40, 0.05);
    const p = w.body.toArray(), high = tr.xray;
    m.city.setWay("walk");
    return { trainUp: up, flying: p, finite: p.every(Number.isFinite), high };
  });
  console.log("sky", JSON.stringify(sky));
  assert.ok(sky.trainUp, "a Line 1 train runs on the viaduct");
  assert.ok(sky.finite, "the paraglider keeps a finite position in the north of the city");
  assert.ok(sky.high > 0.5, "from the paraglider the underground trains show through the city");
  // Line 3 to Shangyuanmen (上元门), at the foot of Mufu Mountain, merged into the city: through the
  // station picker (F at the Jiming Temple entrance), the ride ends on foot at the mountain.
  const picker = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, tr = w.transit;
    const e = tr.entrances.find((x) => x.line.id === "subway-3" && x.stop.name === "鸡鸣寺");
    w.body.set(e.spot[0], w.ground(e.spot[0], e.spot[1]) ?? w.body.y, e.spot[1]);
    m.city.interact();
    const buttons = [...document.querySelectorAll("#metro-lines button")].map((b) => [b.textContent, b.disabled]);
    return { open: document.querySelector("#metro-map").open, buttons };
  });
  console.log("picker", JSON.stringify(picker));
  assert.ok(picker.open, "F at an entrance opens the station picker");
  assert.ok(picker.buttons.some(([t, off]) => t.includes("上元门") && t.includes("Mufu Mountain") && !off), "Shangyuanmen leads to Mufu Mountain");
  assert.ok(picker.buttons.some(([t, off]) => t.includes("五塘广场") && !off), "Wutang Square is a walkable station");
  await page.evaluate(async () => {
    const m = window.__mufu;
    [...document.querySelectorAll("#metro-lines button")].find((b) => b.textContent.includes("上元门")).click();
    m.step(Math.ceil((m.city.world.transit.metroRide?.seconds || 30) / 0.05) + 40, 0.05);
    await new Promise((r) => setTimeout(r, 300));
  });
  const mufu = await page.evaluate(() => {
    const w = window.__mufu.city.world, b = w?.body;
    return { world: w?.id ?? null, at: b?.toArray(), ground: b ? w.ground(b.x, b.z) : null, riding: !!w?.transit.metroRide };
  });
  console.log("mufu", JSON.stringify(mufu));
  assert.ok(mufu.world === "core" && !mufu.riding && mufu.ground !== null, "the ride ends on foot at Shangyuanmen, in the city");

  // Mufu Mountain itself: in at the hike's start (the home page's Mufu card), and the stairs climb.
  const hike = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world;
    w.placeAt(w.spawn("mufu")); m.step(5, 0.05);
    const a = w.body.toArray(), grid = w.meta.walk.grids.find((g) => g.name === "mufu");
    return { a, ground: w.ground(a[0], a[2]), grid: grid && [grid.cell, grid.stepUp] };
  });
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__mufu.step(120, 0.05));
  await page.keyboard.up("KeyW");
  const walked = await page.evaluate(() => window.__mufu.city.world.body.toArray());
  console.log("hike", JSON.stringify(hike), JSON.stringify(walked));
  assert.ok(hike.ground !== null && hike.grid, "the hike's start is on Mufu Mountain's walk grid");
  assert.ok(Math.hypot(walked[0] - hike.a[0], walked[2] - hike.a[2]) > 4, "walking up the forest stairs");
  assert.deepEqual(errors, []);
  console.log("transit ok");
} finally {
  await browser.close();
}
