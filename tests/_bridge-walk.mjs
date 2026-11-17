// The bridge world's park (18 Nov): from the riverside spawn along OSM's footways to the bridgehead plaza.
//   node tests/_bridge-walk.mjs
import { chromium } from "@playwright/test";
import { installJourney } from "./journey-kit.mjs";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("bridge"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "bridge", null, { timeout: 600000 });
await installJourney(page);
const r = await page.evaluate(() => {
  const J = window.__journey, w = J.w, s = w.spawn("riverside"), b = w.spawn("bridge");
  w.placeAt(s); window.__mufu.step(4, 0.1);
  const route = J.route([s.feet[0], s.feet[2]], [b.feet[0], b.feet[2]], "walk");
  if (!route.path) return { route: false, closest: route.closest };
  const out = J.drive(route.path, "walk", 3000);
  return { route: true, steps: route.path.length, done: out.done, at: out.at.map(Math.round) };
});
console.log("park walk", JSON.stringify(r));
await browser.close();
if (!r.done) process.exit(1);
