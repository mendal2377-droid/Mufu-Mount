// Smoke test of the deployed site, as a visitor uses it: the Nanjing atlas opens, a pin with a
// Blender world (Qixia) loads and stands the traveller on walkable ground, the map button returns
// to the atlas, and an atlas pin (Zifeng Tower) walks in. Time inside the page is driven with
// __mufu.step; only loading waits on the clock.
//
//   node tests/live-smoke.mjs                      (production)
//   MUFU_TEST_URL=http://localhost:4190/ node tests/live-smoke.mjs
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  proxy: process.env.MUFU_PROXY
    ? { server: process.env.MUFU_PROXY }
    : undefined,
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
await fs.mkdir("test-results", { recursive: true });
// Screenshots are evidence, not checks: a software-WebGL frame of a full world can take longer
// than Playwright's screenshot timeout.
const shot = (page, path) => page.screenshot({ path, timeout: 90000 }).catch((e) => console.log("screenshot skipped", path, e.message.split("\n")[0]));
try {
  const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    }),
    errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    process.env.MUFU_TEST_URL || "https://mufu-mount.vercel.app",
    { waitUntil: "domcontentloaded", timeout: 120000 },
  );
  await page.waitForFunction(() => window.__mufu?.state.ready, null, {
    timeout: 120000,
  });
  // The atlas is the home page.
  await page.locator("#nanjing-home").waitFor({ state: "visible", timeout: 120000 });
  await shot(page, "test-results/live-welcome.png");
  console.log("atlas ready");

  // A Blender world: click the Qixia pin and wait for the world (software WebGL is slow).
  await page.locator('.city-pin[data-city="qixia"]').click();
  await page.waitForFunction(() => window.__mufu.city.world?.id === "qixia", null, {
    timeout: 600000,
  });
  const world = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world;
    m.paused = true;
    m.step(400, 0.05); // let the arrival glide land
    const b = w.body;
    return { id: w.id, gliding: w.gliding, onGround: w.ground(b.x, b.z) !== null, stats: w.stats() };
  });
  assert.equal(world.gliding, false, "the arrival glide lands");
  assert.ok(world.onGround, "the traveller stands on walkable ground in Qixia");
  console.log("qixia world", JSON.stringify({ onGround: world.onGround, body: world.stats.body }));
  await shot(page, "test-results/live-world.png");
  await page.evaluate(() => { window.__mufu.paused = false; });

  // Back to the atlas, then an atlas walk: the Zifeng Tower pin.
  await page.evaluate(() => document.exitPointerLock());
  await page.locator("#back-to-plan").click();
  await page.locator("#nanjing-home").waitFor({ state: "visible", timeout: 60000 });
  await page.locator('.city-pin[data-city="zifeng"]').click();
  await page.waitForFunction(
    () => window.__mufu.city.selected?.id === "zifeng" && !window.__mufu.city.world,
    null,
    { timeout: 60000 },
  );
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => window.__mufu.getStats().audioReady, null, {
    timeout: 60000,
  });
  console.log("zifeng walk, audio started");
  await shot(page, "test-results/live-walking.png");
  const report = {
    url: page.url(),
    title: await page.title(),
    errors,
    world,
    stats: await page.evaluate(() => window.__mufu.getStats()),
  };
  await fs.writeFile(
    "test-results/live-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ url: report.url, title: report.title, errors, world: { id: world.id, onGround: world.onGround } }, null, 2));
  if (errors.length) throw Error("Live site reported browser errors");
  console.log("Live smoke passed: atlas, Qixia world, back to the map, Zifeng walk, audio");
} finally {
  await browser.close();
}
