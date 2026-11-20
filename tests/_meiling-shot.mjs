// The Meiling Palace spawn in the city (20 Nov): as the traveller arrives, eye height, facing the palace.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "core", null, { timeout: 600000 });
const info = await page.evaluate(() => {
  const m = window.__mufu, w = m.city.world; m.setClock(10.5, { sky: "clear", season: "autumn" });
  w.placeAt(w.spawn("zs-meiling")); m.step(30, 0.1);
  return { body: [w.body.x, w.body.y, w.body.z].map((v) => +v.toFixed(2)), spawnY: w.meta.spawns["zs-meiling"].position[1] };
});
await page.screenshot({ path: `test-results/shots/${process.env.TAG || "ml"}-meiling-arrive.png` });
console.log(JSON.stringify(info));
await browser.close();
