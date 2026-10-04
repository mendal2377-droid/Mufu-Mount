import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

async function menuClick(page, selector) {
  if (!await page.locator('#info').evaluate(n => n.open)) await page.click('#walk-menu');
  await page.click(selector);
}

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
await page.goto(process.env.MUFU_TEST_URL || "http://127.0.0.1:4173", {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => window.__mufu?.state.ready, {
  timeout: 120000,
});
await page.screenshot({ path: "test-results/welcome.png" });
await page.locator("#access-0").click();
await page.waitForTimeout(2000);
await page.keyboard.press("Escape");
await page.evaluate(() => document.exitPointerLock());
const before = await page.evaluate(() => window.__mufu.getStats());
await page.keyboard.down("w");
await page.waitForFunction(
  (d) => window.__mufu.state.distance > d + 0.4,
  before.distance,
  { timeout: 60000 },
);
await page.keyboard.up("w");
const after = await page.evaluate(() => window.__mufu.getStats());
if (after.distance <= before.distance + 0.3)
  throw Error("WASD did not move the player");
await page.screenshot({ path: "test-results/walking.png" });
await menuClick(page, "#collect");
for (let i = 1; i < 5; i++) {
  if (!await page.locator("#info").evaluate(n => n.open)) await page.click("#walk-menu");
  await page.locator("#destination").selectOption(String(i));
  await menuClick(page, "#collect");
}
if ((await page.locator("#found").textContent()) !== "5 / 5")
  throw Error("Notes collection failed");
if (!await page.locator("#info").evaluate(n => n.open)) await page.click("#walk-menu");
  await page.locator("#destination").selectOption("3");
for (const weather of ["sunset", "storm", "snow"]) {
  await page.locator("#walk-weather").selectOption(weather);
  await page.waitForFunction((w) => window.__mufu.weather[w] > 0.8, weather, {
    timeout: 120000,
  });
  await page.screenshot({ path: `test-results/${weather}.png` });
}
await menuClick(page, "#menu-map");
await page.waitForTimeout(500);
await page.screenshot({ path: "test-results/overview.png" });
await page.locator("#access-0").click();
await page.evaluate(() => document.exitPointerLock());
await menuClick(page, "#auto");
const autoBefore = await page.evaluate(() => window.__mufu.state.distance);
await page.waitForTimeout(2000);
const autoAfter = await page.evaluate(() => window.__mufu.state.distance);
if (autoAfter <= autoBefore) throw Error("Guided walk failed");
await menuClick(page, "#auto");
const download = page.waitForEvent("download");
await menuClick(page, "#postcard");
await (await download).saveAs("test-results/postcard.png");
if (!await page.locator("#info").evaluate(n => n.open)) await page.click("#walk-menu");
await page.screenshot({ path: "test-results/help.png" });
await page.locator("#close-info").click();
const report = {
  errors,
  wasdDistance: after.distance - before.distance,
  guidedDistance: autoAfter - autoBefore,
  stats: await page.evaluate(() => window.__mufu.getStats()),
};
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({ path: "test-results/mobile.png" });
await fs.writeFile(
  "test-results/browser-report.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
await browser.close();
if (
  errors.some(
    (e) =>
      !/fonts.googleapis|ERR_CERT|pointer lock|PointerLock|pointerlock/i.test(
        e,
      ),
  )
)
  process.exitCode = 1;
