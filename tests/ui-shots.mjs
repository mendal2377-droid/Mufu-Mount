// Screenshots of the home page and its places list (desktop and phone), for judging the UI by eye.
//
//   node tests/ui-shots.mjs     (with vite preview on localhost:4190)
import { chromium } from "@playwright/test";
const b = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:4190/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__mufu?.state?.ready, null, { timeout: 180000 });
await page.waitForTimeout(2000);
await page.screenshot({ path: "test-results/shots/ui-home-atlas.png" });
// The home page switches to Tiny Nanjing once the city has loaded.
await page.waitForFunction(() => window.__mufu.city.home, null, { timeout: 300000 }).catch(() => console.log("home city did not load"));
await page.evaluate(() => window.__mufu.step(30, 0.05));
await page.screenshot({ path: "test-results/shots/ui-home.png" });
await page.locator('#city-tabs button[data-group="heritage"]').click();
await page.waitForTimeout(400);
await page.screenshot({ path: "test-results/shots/ui-heritage.png", clip: { x: 960, y: 100, width: 320, height: 560 } });
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
await page.screenshot({ path: "test-results/shots/ui-phone.png" });
await b.close();
