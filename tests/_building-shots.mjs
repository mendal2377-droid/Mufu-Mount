// The city's buildings, district by district (14 Nov): an oblique from 150 m and a street-level view
// from the nearest road, with the traveller moved there first so near trees and LODs are the real ones.
//   PORT=4191 node tests/_building-shots.mjs
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 300)); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "core", null, { timeout: 600000 });
// [name, x east, north]
const districts = [["xinjiekou", -460, 150], ["gulou", -470, 2000], ["shanxi-road", -1300, 3000], ["xiaguan-west", -4000, 5500],
  ["wutang", -1065, 7860], ["maigaoqiao", 1950, 7000], ["railway-station", 700, 5200], ["ming-palace-east", 2000, 300],
  ["mochou-west", -2700, 200], ["east-homes", 2500, 1500], ["longjiang", -3300, 2500], ["north-east-yanziji", 3100, 10700]];
for (const [k, [name, x, n]] of districts.entries()) {
  const info = await page.evaluate(([x, n]) => {
    const m = window.__mufu, w = m.city.world, g = w.grid;
    m.setClock(10.5, { sky: "clear", season: "summer" });
    let road = null;
    for (let d = 0; d <= 300 && !road; d += 4) for (let a = 0; a < 6.28; a += Math.min(0.4, 3 / Math.max(d, 1))) {
      const px = x + Math.cos(a) * d, pz = -n + Math.sin(a) * d;
      if (g.road(px, pz) !== null) { road = [px, pz]; break; }
    }
    const at = road || [x, -n], y = w.ground(at[0], at[1]) ?? 10;
    w.placeAt({ feet: [at[0], y, at[1]], look: [at[0], y, at[1] - 10] });
    m.step(6, 0.1);
    window.__shot = (cx, cy, cz, yaw, pitch) => { m.camera.position.set(cx, cy, cz); m.camera.rotation.set(pitch, yaw, 0, "YXZ"); m.camera.updateMatrixWorld(); w.scene.updateMatrixWorld(true); m.renderer.render(w.scene, m.camera); };
    window.__at = [at[0], y, at[1]];
    return { road: !!road, y };
  }, [x, n]);
  const tag = String(k + 1).padStart(2, "0") + "-" + name;
  await page.evaluate(() => { const [x, y, z] = window.__at; window.__shot(x, y + 150, z + 230, 0, -0.55); });
  await page.screenshot({ path: `test-results/shots/bld-${tag}-a-air.png` });
  await page.evaluate(() => { const [x, y, z] = window.__at; window.__shot(x, y + 2.2, z, 0.6, 0.14); });
  await page.screenshot({ path: `test-results/shots/bld-${tag}-b-street.png` });
  console.log("bld", tag, JSON.stringify(info));
}
await browser.close();
