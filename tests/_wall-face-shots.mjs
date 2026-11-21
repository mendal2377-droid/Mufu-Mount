// The Ming wall's city face beside Xuanwu Gate (21 Nov): along the wall from the street, close to its
// foot, and up the wall where it steps up from the gate's level; rendered directly, no walker.
//   TAG=before PORT=4191 node tests/_wall-face-shots.mjs
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 300)); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "core", null, { timeout: 600000 });
const T = process.env.TAG || "wf";
// [name, camera x, z, up, target x, z, up] (three.js x, z; heights above the ground there)
const views = [
  ["along-north", -170, -3450, 2, -133, -3330, 6],
  ["along-south", -170, -3370, 2, -128, -3490, 6],
  ["foot-close", -150, -3445, 1.7, -131, -3460, 5],
  ["air-strip", -260, -3410, 60, -131, -3410, 0],
  ["step-up-n", -175, -3290, 3, -138, -3240, 8],
  ["step-up-s", -175, -3530, 3, -125, -3580, 8],
];
for (const [name, x, z, up, tx, tz, tUp] of views) {
  const info = await page.evaluate(([x, z, up, tx, tz, tUp]) => {
    const m = window.__mufu, w = m.city.world;
    m.setClock(10.5, { sky: "clear", season: "summer" });
    m.step(2, 0.05);
    const g = w.ground(x, z), tg = w.ground(tx, tz);
    const cy = (g ?? tg ?? 10) + up, ty = (tg ?? g ?? 10) + tUp;
    const dx = tx - x, dz = tz - z, yaw = Math.atan2(-dx, -dz), pitch = Math.atan2(ty - cy, Math.hypot(dx, dz));
    m.camera.position.set(x, cy, z); m.camera.rotation.set(pitch, yaw, 0, "YXZ");
    m.camera.updateMatrixWorld(); w.scene.updateMatrixWorld(true); m.renderer.render(w.scene, m.camera);
    return { ground: g, targetGround: tg };
  }, [x, z, up, tx, tz, tUp]);
  await page.screenshot({ path: `test-results/shots/${T}-wall-${name}.png` });
  console.log("wall", name, JSON.stringify(info));
}
await browser.close();
