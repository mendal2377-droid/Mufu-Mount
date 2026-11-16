// Walk probes for the landmark pass: Yuejiang (15 Nov), now Toutuo Ridge's platform (16 Nov).
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
  // Toutuo Ridge (16 Nov): from the cable car station up the platform's stair to its top.
  const m = window.__mufu, w = m.city.world, g = w.grid;
  const S = [5051.4, 3365.6], P = [5059.4, 3391.7];
  w.placeAt({ feet: [S[0], w.ground(S[0], -S[1]), -S[1]], look: [P[0], 0, -P[1]] });
  m.step(1, 0.1);
  // The road lies 1.2 m below the grass right at the station: let the route finder find the way up.
  const path = window.__journey.route([S[0], -S[1]], [P[0], -P[1]]).path;
  const end = window.__journey.drive(path, "walk", 1500);
  const prof = []; for (let q = 0; q <= 40; q += 2) { const h = g.height(S[0] + (P[0] - S[0]) * q / 40, -(S[1] + (P[1] - S[1]) * q / 40)); prof.push(h === null ? null : +h.toFixed(2)); }
  return { end: { done: end.done, at: end.at.map((v) => +v.toFixed(1)) }, profile: prof, top: g.height(P[0], -P[1]) };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
