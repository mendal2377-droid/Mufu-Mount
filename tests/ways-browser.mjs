// Ways to explore in Tiny Nanjing: ride the bike up Zhongshan Road, row a boat on Xuanwu Lake,
// take off on the paraglider, and step back onto your feet. Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4190/ node tests/ways-browser.mjs
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

  // Bike: from the Zhongshan Road spawn, pedal for ten simulated seconds.
  const before = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world;
    w.placeAt(w.spawn("zhongshan")); m.step(5, 0.05);
    m.city.setWay("bike"); m.step(2, 0.05);
    return { vehicle: w.vehicle, body: w.body.toArray() };
  });
  assert.equal(before.vehicle, "bike");
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__mufu.step(200, 0.05));
  await page.keyboard.up("KeyW");
  const rode = await page.evaluate(() => window.__mufu.city.world.body.toArray());
  const bikeDistance = Math.hypot(rode[0] - before.body[0], rode[2] - before.body[2]);
  await page.screenshot({ path: "test-results/shots/ways-bike.png" });
  console.log("bike", bikeDistance.toFixed(1), "m");
  assert.ok(bikeDistance > 25, `the bike should cover ground (rode ${bikeDistance.toFixed(1)} m)`);

  // Boat: from the shore of Xuanwu Lake (south-west of the Jiming spawn), row out.
  const boat = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world;
    w.setVehicle("walk");
    // Xuanwu Lake's south-west shore in the core frame (32.068 N, 118.785 E).
    const x = (118.785 - 118.7838) * 111320 * Math.cos(32.0418 * Math.PI / 180), y = (32.068 - 32.0418) * 110574;
    w.placeAt({ feet: [x, w.ground(x, -y) ?? 8, -y], look: [x + 50, 8, -y - 300] });
    m.step(2, 0.05);
    const msg = m.city.world.setVehicle("boat");
    return { msg, vehicle: w.vehicle, canBoat: w.canBoat, body: w.body.toArray() };
  });
  console.log("boat", JSON.stringify(boat));
  assert.ok(boat.canBoat, "the city has a water grid");
  assert.equal(boat.vehicle, "boat", boat.msg);
  await page.keyboard.down("KeyW");
  await page.evaluate(() => window.__mufu.step(160, 0.05));
  await page.keyboard.up("KeyW");
  const rowed = await page.evaluate(() => window.__mufu.city.world.body.toArray());
  await page.screenshot({ path: "test-results/shots/ways-boat.png" });
  const rowDistance = Math.hypot(rowed[0] - boat.body[0], rowed[2] - boat.body[2]);
  console.log("boat", rowDistance.toFixed(1), "m");
  assert.ok(rowDistance > 8, `the boat should move (${rowDistance.toFixed(1)} m)`);

  // Paraglider, then back on foot by the shore.
  const fly = await page.evaluate(() => { const m = window.__mufu; m.city.setWay("fly"); m.step(20, 0.05); return m.state.flying; });
  assert.equal(fly, true, "the paraglider takes off");
  const foot = await page.evaluate(() => { const m = window.__mufu; m.city.setWay("walk"); m.step(5, 0.05); return [m.state.flying, m.city.world.vehicle]; });
  console.log("foot", JSON.stringify(foot));
  assert.deepEqual(errors, []);
  console.log("ways ok");
} finally {
  await browser.close();
}
