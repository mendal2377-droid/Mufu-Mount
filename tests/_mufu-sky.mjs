// The Mufu scene's sky after the far-bank switch (18 Nov): it still paints its far bank (uBank 1)
// and its shader compiles. Dusk, looking out over the river at eye height.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error" || /shader|program/i.test(m.text())) errors.push(m.text().slice(0, 300)); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.state?.ready, null, { timeout: 180000 });
const info = await page.evaluate(() => {
  const m = window.__mufu;
  m.city.leave?.();
  m.setClock?.(18.2);
  let dome = null; m.scene.traverse((o) => { if (o.name === "Sky") dome = o; });
  m.camera.position.set(0, 30, 0); m.camera.rotation.set(0, 0, 0, "YXZ");
  m.step(30, 1 / 30);
  return { dome: !!dome, uBank: dome?.material.uniforms.uBank?.value, city: m.city.active };
});
await page.screenshot({ path: "test-results/shots/b5-mufu-sky.png" });
console.log("mufu sky", JSON.stringify(info), "errors", JSON.stringify(errors));
await browser.close();
