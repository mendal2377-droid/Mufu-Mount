// Every landmark world outside the city (14 Nov recheck): the view from each arrival point, and one
// oblique from the air over the first.
//   PORT=4191 node tests/_world-shots.mjs
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.on("console", (m) => { if (m.type() === "error") console.log("console:", m.text().slice(0, 300)); });
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 300)));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
// [pin to enter, world id]
const worlds = [["zhongshan", "zhongshan"], ["jiming", "north"], ["qinhuai", "oldsouth"], ["palace", "palace"], ["bridge", "bridge"], ["niushou", "niushou"], ["qixia", "qixia"]];
for (const [pin, id] of worlds) {
  await page.evaluate((pin) => { window.__mufu.paused = true; window.__mufu.city.enter(pin); }, pin);
  await page.waitForFunction((id) => window.__mufu.city.world?.id === id, id, { timeout: 600000 });
  const names = await page.evaluate(() => Object.keys(window.__mufu.city.world.meta.spawns));
  for (const [k, name] of names.entries()) {
    await page.evaluate((name) => {
      const m = window.__mufu, w = m.city.world, s = w.meta.spawns[name];
      m.setClock(10.5, { sky: "clear", season: "summer" });
      w.placeAt(w.spawn(name)); m.step(6, 0.1);
      const [x, y, z] = s.position, [lx, , lz] = s.look, dx = lx - x, dz = lz - z;
      window.__aim = (cx, cy, cz, pitch) => { m.camera.position.set(cx, cy, cz); m.camera.rotation.set(pitch, Math.atan2(-dx, -dz), 0, "YXZ"); m.camera.updateMatrixWorld(); w.scene.updateMatrixWorld(true); m.renderer.render(w.scene, m.camera); };
      window.__sp = [x, y, z, dx / Math.hypot(dx, dz), dz / Math.hypot(dx, dz)];
      window.__aim(x, y + 1.8, z, 0.1);
    }, name);
    await page.screenshot({ path: `test-results/shots/wd-${id}-${k}-${name}.png` });
    if (k === 0) {
      await page.evaluate(() => { const [x, y, z, ux, uz] = window.__sp; window.__aim(x - ux * 140, y + 110, z - uz * 140, -0.5); });
      await page.screenshot({ path: `test-results/shots/wd-${id}-${k}-${name}-air.png` });
    }
  }
  console.log("world", id, names.join(","));
}
await browser.close();
