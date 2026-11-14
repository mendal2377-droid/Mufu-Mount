import { chromium } from "@playwright/test";
import { installJourney } from "./journey-kit.mjs";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 900, height: 600 } });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
await page.goto("http://localhost:4191/", { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "core", null, { timeout: 600000 });
await installJourney(page);
console.log(JSON.stringify(await page.evaluate(() => {
  const { g, route } = window.__journey, out = {};
  const G = [624, 2254], A = [-0.380, 0.925], C = [0.925, 0.380];
  const at = (u, s) => [G[0] + A[0] * s + C[0] * u, -(G[1] + A[1] * s + C[1] * u)];
  out.patch = [];
  for (let s = 90; s <= 100; s += 1) { const row = [s]; for (let u = -6; u <= 6; u += 1) { const [x, z] = at(u, s); const h = g.height(x, z); row.push(h === null ? null : +h.toFixed(2)); } out.patch.push(row.join(" ")); }
  out.stepUp = g.stepUp(...at(0, 95));
  const r = route(at(0, 93), at(0, 99), "walk", 1); out.r93_99 = r.path ? "ok" : r.closest.map((v) => +v.toFixed(1));
  const r2 = route(at(0, 97), at(0, 105), "walk", 1); out.r97_105 = r2.path ? "ok" : r2.closest.map((v) => +v.toFixed(1));
  return out;
})));
await browser.close();
