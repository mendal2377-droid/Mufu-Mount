// Where the walk to Yuejiang lantern 0 breaks (15 Nov).
import { chromium } from "@playwright/test";
import { installJourney } from "./journey-kit.mjs";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.goto("http://localhost:4191/", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "core" && window.__mufu.city.world.keepsakes !== undefined, null, { timeout: 600000 });
await installJourney(page);
const r = await page.evaluate(() => {
  const m = window.__mufu, w = m.city.world;
  w.placeAt({ feet: [-4032, w.ground(-4032, -6070), -6070], look: [-4032, 0, -6000] });
  m.step(1, 0.1);
  const path = []; for (let n = 6070; n >= 6016; n -= 1) path.push([n > 6064 ? -4032 : -4028, -n]);
  const end = window.__journey.drive(path, "walk", 900);
  return { end, body: [w.body.x, w.body.y, w.body.z].map((v) => +v.toFixed(1)), lantern: window.__journey.route([-1065, -7860], [-4032, -6069], "walk").path ? "reachable" : "not" };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
