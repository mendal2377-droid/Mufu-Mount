// Landmark-pass checks in the Yangtze River Bridge world (18 Nov): each spawn as the traveller arrives
// (eye height, facing its look point) and from the air; and from the deck, level, along the river
// both ways (a dark band was seen on the far horizon).
//   PORT=4191 TAG=b5before node tests/_bridge-shots.mjs
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 300)); });
page.on("pageerror", (e) => console.log("pageerror:", String(e).slice(0, 300)));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("bridge"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "bridge", null, { timeout: 600000 });
const T = process.env.TAG || "br";
// [name, yaw offset from the spawn's look (radians), pitch, air]
const views = [["bridge", 0, -0.05, true], ["deck", 0, -0.05, true], ["riverside", 0, -0.02, true], ["mid", 0, -0.05, true],
  ["mid", Math.PI / 2, 0, false], ["mid", -Math.PI / 2, 0, false], ["riverside", Math.PI, -0.02, false]];
for (const [k, [name, yaw, pitch, air]] of views.entries()) {
  const info = await page.evaluate(([name, yaw, pitch]) => {
    const m = window.__mufu, w = m.city.world, g = w.grid;
    m.setClock(17.5, { sky: "clear", season: "autumn" });
    const s = w.spawn(name);
    w.placeAt(s);
    m.step(6, 0.1);
    const [x, y, z] = s.position, dx = s.look[0] - x, dz = s.look[2] - z, h = Math.atan2(-dx, -dz) + yaw;
    window.__views = [() => { m.camera.position.set(x, y, z); m.camera.rotation.set(pitch, h, 0, "YXZ"); },
      () => { m.camera.position.set(x - Math.sin(h) * -160, y + 110, z - Math.cos(h) * -160); m.camera.rotation.set(-0.55, h, 0, "YXZ"); }]
      .map((f) => () => { f(); m.camera.updateMatrixWorld(); w.scene.updateMatrixWorld(true); m.renderer.render(w.scene, m.camera); });
    return { walkable: g.height(x, z) !== null, ground: w.ground(x, z), spawn: s.feet.map((v) => +v.toFixed(1)) };
  }, [name, yaw, pitch]);
  const tag = `${T}-${String(k + 1).padStart(2, "0")}-${name}`;
  await page.evaluate(() => window.__views[0]());
  await page.screenshot({ path: `test-results/shots/${tag}-a-eye.png` });
  if (air) { await page.evaluate(() => window.__views[1]()); await page.screenshot({ path: `test-results/shots/${tag}-b-air.png` }); }
  console.log("view", tag, JSON.stringify(info));
}
await browser.close();
