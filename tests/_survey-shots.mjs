// A survey of the whole city (13 Nov): street-level and oblique views at each district, rendered directly.
//   PORT=4191 node tests/_survey-shots.mjs
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
// [name, x, z, metres above ground, yaw (0 north, pi/2 west, -pi/2 east, pi south), pitch]
const P = Math.PI;
const views = [
  ["01-xinjiekou-street", -460, -150, 2, 0, 0.12], ["02-xinjiekou-air", -460, 150, 140, 0, -0.4],
  ["03-zhongshan-road", -430, -1100, 2, 0, 0.08], ["04-gulou-street", -470, -2000, 2, 0.9, 0.08],
  ["05-gulou-air", -300, -1700, 110, 0.6, -0.4], ["06-palace-street", 807, -288, 2, 0, 0.05],
  ["07-xuanwu-lake-air", -100, -3300, 160, -1.0, -0.35], ["08-xuanwu-island", 700, -4200, 2, P / 2, 0.03],
  ["09-wutang-street", -1065, -7860, 2, 0, 0.08], ["10-mufu-foot", -345, -9451, 2, 0.2, 0.1],
  ["11-river-air", -1500, -8600, 220, 0.3, -0.3], ["12-mochou-street", -2700, -200, 2, 2.4, 0.05],
  ["13-west-homes-street", -2200, 900, 2, 0.65, 0.08], ["14-city-high-south", 0, -3200, 900, P, -0.55],
  ["15-purple-mountain-from-city", 2500, -1500, 60, -P / 2, 0.02], ["16-mausoleum-axis", 6121, -1832, 2, 0.05, 0.12],
  ["17-south-air", -300, 2500, 160, 0, -0.35], ["18-east-street", 2000, -300, 2, -P / 2, 0.06],
];
for (const [name, x, z, y, yaw, pitch] of views) {
  const g = await page.evaluate(([x, z, y, yaw, pitch]) => {
    const m = window.__mufu, w = m.city.world;
    m.setClock(10.5, { sky: "clear", season: "summer" });
    m.step(2, 0.05);
    const g = w.ground(x, z);
    m.camera.position.set(x, (g ?? 10) + y, z);
    m.camera.rotation.set(pitch, yaw, 0, "YXZ");
    m.camera.updateMatrixWorld();
    w.scene.updateMatrixWorld(true);
    m.renderer.render(w.scene, m.camera);
    return g;
  }, [x, z, y, yaw, pitch]);
  await page.screenshot({ path: `test-results/shots/survey-${name}.png` });
  console.log("survey", name, "ground", g);
}
await browser.close();
