// Height profile from the Yuejiang lantern up toward the podium top (15 Nov): a jump over 1 m means a wall.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "core", null, { timeout: 600000 });
const out = await page.evaluate(() => {
  const g = window.__mufu.city.world.grid, rows = [];
  for (let n = 6070; n >= 5990; n -= 2) { const row = []; for (let x = -4040; x <= -3996; x += 4) { const h = g.height(x, -n); row.push(h === null ? "  ----" : h.toFixed(1).padStart(6)); } rows.push(String(n) + " " + row.join("")); }
  return rows.join("\n");
});
console.log("x -4040..-3996 by 4\n" + out);
await browser.close();
