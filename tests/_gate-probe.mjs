// Why the city's first gate glide does not start (20 Nov): what interact() does at gate 0.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 1100, height: 760 } });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.addInitScript(() => localStorage.setItem("mufu-quality", "smooth"));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active, null, { timeout: 180000 });
await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
await page.waitForFunction(() => window.__mufu.city.world?.id === "core", null, { timeout: 600000 });
const r = await page.evaluate(() => {
  const m = window.__mufu, w = m.city.world, g = w.meta.gates[0];
  w.placeAt({ feet: [g.position[0], g.position[1], g.position[2] + .5], look: [g.position[0], 0, g.position[2] - 10] });
  m.step(2, .05);
  const before = { body: [w.body.x, w.body.y, w.body.z].map((v) => +v.toFixed(2)), ground: w.ground(g.position[0], g.position[2] + .5), prompt: document.querySelector("#prompt, .prompt, [data-prompt]")?.textContent?.slice(0, 120) ?? null, near: w.near ? Object.keys(w.near) : null, mode: w.stats().mode, transit: (() => { const n = w.nearestTransit(); return n ? { kind: n.kind, stop: n.stop?.en || n.stop?.name || n.name || null } : null; })(), dock: !!w.nearestDock(), gateNear: !!w.nearestGate(), gliding0: w.gliding };
  m.city.interact();
  return { gate: g, before, after: { gliding: w.gliding, mode: w.stats().mode, world: m.city.world?.id, seated: w.stats().seated } };
});
console.log(JSON.stringify(r, null, 1));
await browser.close();
