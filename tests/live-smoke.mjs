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
  await page.screenshot({ path: "test-results/live-welcome.png" });
  await page.locator("#access-0").click();
  await page.evaluate(() => document.exitPointerLock());
  await page.waitForFunction(() => window.__mufu.getStats().audioReady, null, {
    timeout: 60000,
  });
  await page.screenshot({ path: "test-results/live-walking.png" });
  const report = {
    url: page.url(),
    title: await page.title(),
    errors,
    stats: await page.evaluate(() => window.__mufu.getStats()),
  };
  await fs.writeFile(
    "test-results/live-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) throw Error("Live site reported browser errors");
} finally {
  await browser.close();
}
