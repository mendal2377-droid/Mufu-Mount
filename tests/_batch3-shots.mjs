// Landmark-pass checks (15-16 Nov): edit the marks for the batch in hand.
// an oblique from the air, the traveller moved there first so near trees and LODs are the real ones.
//   PORT=4191 node tests/_landmark-shots.mjs
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
// [name, stand x, stand north, target x, target north, target height above the stand's ground, air distance]
const marks = [
  ["toutuo-from-station", 5051, 3366, 5059, 3392, 4, 110], ["toutuo-platform-view", 5059, 3396, -548, 2309, -60, 160],
  ["toutuo-maitreya", 5064, 3403, 5065.5, 3416.6, 3, 70], ["yuejiang-stair", -4028, 6075, -4024, 6010, 15, 120],
];
const _old = [
  ["zhongshan-arch", 6121, 1800, 6120, 1857, 8, 160], ["zhongshan-hall", 6090, 2400, 6086, 2485, 35, 220],
  ["xiaoling-sacred-way", 4509, 1090, 4509, 1140, 3, 140], ["xiaoling-ming-tower", 4796, 1960, 4796, 2040, 12, 200],
  ["zijin-summit", 5444, 3388, 4800, 3000, -60, 200], ["meiling-palace", 5442, 590, 5442, 640, 6, 160],
  ["music-stage", 6288, 1742, 6274, 1716, 2, 160], ["xuanwu-liangzhou", 544, 4040, 544, 4090, 4, 220],
  ["jiming-temple", 588, 2310, 560, 2360, 14, 200], ["zifeng-tower", -500, 2150, -548, 2309, 160, 420],
  ["gulou-drum-tower", -600, 2040, -657, 2093, 12, 160], ["palace-gate", 798, 455, 798, 489, 9, 140],
  ["mochou-lake", -2578, -134, -2500, -400, 0, 260], ["yuejiang-tower", -4008, 5880, -4008, 6009, 30, 240],
  ["mufu-foot", -345, 9451, -300, 9700, 60, 400], ["xinjiekou", -460, 150, -460, 250, 30, 300],
];
for (const [k, [name, sx, sn, tx, tn, th, air]] of marks.entries()) {
  const info = await page.evaluate(([sx, sn, tx, tn, th, air]) => {
    const m = window.__mufu, w = m.city.world, g = w.grid;
    m.setClock(10.5, { sky: "clear", season: "summer" });
    let at = null;
    for (let d = 0; d <= 120 && !at; d += 3) for (let a = 0; a < 6.28; a += Math.min(0.5, 3 / Math.max(d, 1))) {
      const px = sx + Math.cos(a) * d, pz = -sn + Math.sin(a) * d;
      if (g.height(px, pz) !== null) { at = [px, pz]; break; }
    }
    at ||= [sx, -sn];
    const y = w.ground(at[0], at[1]) ?? 10;
    w.placeAt({ feet: [at[0], y, at[1]], look: [tx, y, -tn] });
    m.step(6, 0.1);
    const aim = (cx, cy, cz, ty) => { const dx = tx - cx, dz = -tn - cz; m.camera.position.set(cx, cy, cz);
      m.camera.rotation.set(Math.atan2(ty - cy, Math.hypot(dx, dz)), Math.atan2(-dx, -dz), 0, "YXZ"); m.camera.updateMatrixWorld(); w.scene.updateMatrixWorld(true); m.renderer.render(w.scene, m.camera); };
    const ux = at[0] - tx, uz = at[1] + tn, ul = Math.hypot(ux, uz) || 1;
    window.__views = [() => aim(at[0], y + 1.9, at[1], y + th), () => aim(tx + ux / ul * air, y + Math.max(th, 0) + air * 0.45, -tn + uz / ul * air, y + Math.max(th, 0) * 0.4)];
    return { walkable: g.height(at[0], at[1]) !== null, y: +y.toFixed(1), moved: +Math.hypot(at[0] - sx, at[1] + sn).toFixed(0) };
  }, [sx, sn, tx, tn, th, air]);
  const tag = String(k + 1).padStart(2, "0") + "-" + name;
  await page.evaluate(() => window.__views[0]());
  await page.screenshot({ path: `test-results/shots/b3-${tag}-a-stand.png` });
  await page.evaluate(() => window.__views[1]());
  await page.screenshot({ path: `test-results/shots/b3-${tag}-b-air.png` });
  console.log("lm", tag, JSON.stringify(info));
}
await browser.close();
