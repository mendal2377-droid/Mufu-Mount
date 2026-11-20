// The Meiling Palace spawn (20 Nov): the city's ground and the Zhongshan world's own round the 'zs-meiling' spawn.
import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
const page = await browser.newPage({ viewport: { width: 800, height: 500 } });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
await page.goto(`http://localhost:${process.env.PORT || 4191}/`, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
const probe = async (pin, id, names) => {
  await page.evaluate((p) => { window.__mufu.paused = true; window.__mufu.city.enter(p); }, pin);
  await page.waitForFunction((id) => window.__mufu.city.world?.id === id, id, { timeout: 600000 });
  return page.evaluate((names) => {
    const w = window.__mufu.city.world, meta = w.meta, S = meta.spawns || {};
    const out = {};
    for (const n of names) { const s = S[n] || (w.spawn && w.spawn(n)); if (!s) { out[n] = null; continue; }
      const [x, y, z] = s.position, look = s.look, dz = Math.sign(look[2] - z) || 1, prof = [];
      for (let d = -6; d <= 12; d += 1) { const h = w.ground(x, z + dz * d); prof.push(h === null ? null : +h.toFixed(2)); }
      out[n] = { y, ground: w.ground(x, z), toward_look_from_minus6: prof }; }
    return out;
  }, names);
};
console.log("core", JSON.stringify(await probe("zifeng", "core", ["zs-meiling", "zs-meiling-terrace"])));
console.log("zhongshan", JSON.stringify(await probe("zhongshan", "zhongshan", ["meiling", "meiling-terrace"])));
await browser.close();
