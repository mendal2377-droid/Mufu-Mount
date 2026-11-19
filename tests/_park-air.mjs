

import { chromium } from "@playwright/test";
import { installJourney } from "./journey-kit.mjs";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("bridge"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "bridge", null, { timeout: 600000 });
const T = process.env.TAG || "pk";
for (const k of [0, 1, 2, 3]) {
  const info = await page.evaluate((k) => {
    const m = window.__mufu, w = m.city.world;
    m.setClock(12, { sky: "clear", season: "summer" });
    const s = w.spawn("riverside"), b = w.spawn("bridge");
    const cx = (s.feet[0] + b.feet[0]) / 2, cz = (s.feet[2] + b.feet[2]) / 2, cy = w.ground(cx, cz) ?? s.feet[1];
    w.placeAt({ feet: [cx, cy, cz], look: [cx, cy, cz - 10] }); m.step(6, 0.1);
    const h = k * Math.PI / 2;
    m.camera.position.set(cx + Math.sin(h) * 130, cy + 100, cz + Math.cos(h) * 130);
    m.camera.lookAt(cx, cy, cz); m.camera.updateMatrixWorld(); w.scene.updateMatrixWorld(true); m.renderer.render(w.scene, m.camera);
    return [cx, cz].map(Math.round);
  }, k);
  await page.screenshot({ path: `test-results/shots/${T}-park-air-${k}.png` });
  console.log("park air", k, info);
}
await browser.close();
