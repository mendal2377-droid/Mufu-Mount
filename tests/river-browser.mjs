import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  proxy: process.env.MUFU_PROXY
    ? { server: process.env.MUFU_PROXY }
    : undefined,
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
try {
  const p = await browser.newPage({ viewport: { width: 1280, height: 800 } }),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await p.goto(process.env.MUFU_TEST_URL || "http://127.0.0.1:4173", {
    waitUntil: "domcontentloaded",
    timeout: 120000,
  });
  await p.waitForFunction(() => window.__mufu?.state.ready, null, {
    timeout: 120000,
  });
  await p.click("#enter");
  await p.evaluate(() => document.exitPointerLock());
  await p.click("#river-watch");
  await p.waitForFunction(
    () => window.__mufu.getStats().river?.ships?.length === 4,
  );
  const before = await p.evaluate(() => window.__mufu.getStats());
  await p.screenshot({
    path: "test-results/river-morning.png",
    timeout: 90000,
  });
  await p.waitForFunction(
    (t) => window.__mufu.getStats().river.riverTime > t + 3,
    before.river.riverTime,
    { timeout: 60000 },
  );
  const after = await p.evaluate(() => window.__mufu.getStats());
  const moved = after.river.ships.map((v, i) =>
    Math.hypot(
      v[0] - before.river.ships[i][0],
      v[2] - before.river.ships[i][2],
    ),
  );
  if (moved.some((d) => d < 2)) throw Error("A ship did not move");
  if (after.river.beaconRotation === before.river.beaconRotation)
    throw Error("Beacon did not rotate");
  await p.click("[data-weather=sunset]");
  await p.waitForFunction(() => window.__mufu.weather.sunset > 0.9, null, {
    timeout: 120000,
  });
  await p.screenshot({ path: "test-results/river-sunset.png", timeout: 90000 });
  await p.click("[data-weather=storm]");
  await p.waitForFunction(() => window.__mufu.weather.storm > 0.9, null, {
    timeout: 120000,
  });
  await p.screenshot({ path: "test-results/river-storm.png", timeout: 90000 });
  await p.setViewportSize({ width: 390, height: 844 });
  await p.click("#river-watch");
  await p.screenshot({ path: "test-results/river-mobile.png", timeout: 90000 });
  await p.click("#focus-view");
  await p.screenshot({ path: "test-results/river-focus.png", timeout: 90000 });
  const report = {
    url: p.url(),
    errors,
    moved,
    beaconRotated: true,
    stats: await p.evaluate(() => window.__mufu.getStats()),
  };
  await fs.writeFile(
    "test-results/river-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (errors.some((e) => !/fonts.googleapis|ERR_CERT/.test(e)))
    throw Error("Browser reported rendering errors");
} finally {
  await browser.close();
}
