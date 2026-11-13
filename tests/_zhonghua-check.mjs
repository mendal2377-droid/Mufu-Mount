// Zhonghua Gate and the Bao'en tower after the 14 Nov remodel: walk from the south spawn through the
// four passages to the city side with the real controls, and shots of the gate, a court and the tower.
//   PORT=4191 node tests/_zhonghua-check.mjs
import { chromium } from "@playwright/test";
import { installJourney } from "./journey-kit.mjs";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
page.on("pageerror", (e) => console.log("pageerror:", e.message.slice(0, 300)));
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zhonghua"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "oldsouth", null, { timeout: 600000 });
await installJourney(page);
const shot = async (name, pos, look) => {
  await page.evaluate(([pos, look]) => { const m = window.__mufu, w = m.city.world; m.setClock(10.5, { sky: "clear", season: "summer" }); m.step(2, 0.05);
    const dx = look[0] - pos[0], dy = look[1] - pos[1], dz = look[2] - pos[2];
    m.camera.position.set(...pos); m.camera.rotation.set(Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(-dx, -dz), 0, "YXZ"); m.camera.updateMatrixWorld(); w.scene.updateMatrixWorld(true); m.renderer.render(w.scene, m.camera); }, [pos, look]);
  await page.screenshot({ path: `test-results/shots/zh-${name}.png` });
};
const s = await page.evaluate(() => { const w = window.__mufu.city.world, sp = w.meta.spawns; return { z: sp.zhonghua.position, wall: sp.wall.position, b: sp.baoen.position, bl: sp.baoen.look }; });
// The gate's centre is 94 m north of the south spawn (30 m + half of 128 m); three.js z = -north.
const [x, y, z] = s.z, north = (d) => z - d;
const walk = await page.evaluate(([x, z0, z1]) => {
  const { w, route, drive, g } = window.__journey, m = window.__mufu;
  w.placeAt(w.spawn("zhonghua")); m.city.setWay("walk"); m.step(6, 0.1);
  const r = route([w.body.x, w.body.z], [x, z1], "walk", 2);
  if (!r.path) return { route: false, closest: r.closest };
  const xs = r.path.map((p) => p[0]);
  const out = drive(r.path, "walk", 4000);
  return { route: true, steps: r.path.length, xSpread: [Math.min(...xs), Math.max(...xs)].map(Math.round), done: out.done, at: out.at.map(Math.round), startZ: Math.round(z0) };
}, [x, z, north(30 + 128 + 25)]);
console.log("walk through the gate", JSON.stringify(walk));
await shot("south-face", [x + 14, y + 2, z + 18], [x, y + 11, north(30)]);
await shot("in-first-court", [x, y + 1.8, north(30 + 30)], [x, y + 6, north(30 + 60)]);
await shot("air", [x + 110, y + 85, z + 60], [x, y + 8, north(94)]);
await shot("wall-top", [s.wall[0], s.wall[1] + 1.8, s.wall[2]], [s.wall[0] - 30, s.wall[1], s.wall[2] - 60]);
await shot("baoen", [s.b[0], s.b[1] + 1.8, s.b[2]], [s.bl[0], s.b[1] + 34, s.bl[2]]);
await page.evaluate(() => window.__mufu.setClock(19.5, { sky: "clear", season: "summer" }));
await page.evaluate(() => window.__mufu.step(4, 0.05));
await page.evaluate(([b, bl]) => { const m = window.__mufu, w = m.city.world; const dx = bl[0] - b[0], dz = bl[2] - b[2]; m.camera.position.set(b[0], b[1] + 1.8, b[2]); m.camera.rotation.set(0.5, Math.atan2(-dx, -dz), 0, "YXZ"); m.camera.updateMatrixWorld(); m.renderer.render(w.scene, m.camera); }, [s.b, s.bl]);
await page.screenshot({ path: "test-results/shots/zh-baoen-dusk.png" });
await browser.close();
