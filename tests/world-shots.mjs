// Look-dev screenshots of a Blender world in the real runtime, for judging the detail pass by eye.
//
//   MUFU_TEST_URL=http://localhost:4190/ node tests/world-shots.mjs zhongshan "axis;music;cam:x,y,z>lx,ly,lz" [tag]
//
// Writes test-results/shots/<world>-<spawn>-<tag>.png. Uses the machine's GPU when headless Chrome
// gets one (much faster than SwiftShader); set MUFU_SWIFTSHADER=1 to force software rendering.
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const [world = "zhongshan", spawnList = "axis", tag = "now"] = process.argv.slice(2);
const pin = { north: "jiming", oldsouth: "qinhuai", core: "zifeng" }[world] || world;
const args = process.env.MUFU_SWIFTSHADER
  ? ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"]
  : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args });
await fs.mkdir("test-results/shots", { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  // The tier visitors get by default on a laptop: shadows and ambient occlusion on.
  await page.addInitScript((q) => localStorage.setItem("mufu-quality", q), process.env.MUFU_QUALITY || "balanced");
  await page.goto(process.env.MUFU_TEST_URL || "http://localhost:4190/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
  console.log("renderer", await page.evaluate(() => {
    const gl = window.__mufu.renderer.getContext(), d = gl.getExtension("WEBGL_debug_renderer_info");
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown";
  }));
  await page.evaluate((p) => { window.__mufu.paused = true; window.__mufu.city.enter(p); }, pin);
  // MUFU_WEATHER=sunset|morning|dawn: the light to judge in (the pins pick their own on arrival).
  if (process.env.MUFU_WEATHER) await page.evaluate((w) => window.__mufu.setWeather(w), process.env.MUFU_WEATHER);
  // MUFU_HOUR=21.5: set the clock instead (the light eases there over a few simulated seconds).
  if (process.env.MUFU_HOUR || process.env.MUFU_SEASON) await page.evaluate(([h, season]) => {
    const m = window.__mufu;
    m.setClock(h ? Number(h) : m.state.hour, season ? { season } : {});
    m.step(60, 0.5);
  }, [process.env.MUFU_HOUR, process.env.MUFU_SEASON]);
  await page.waitForFunction((w) => window.__mufu.city.world?.id === w, world, { timeout: 600000 });
  for (const spawn of spawnList.split(";")) {
    const info = await page.evaluate((s) => {
      const m = window.__mufu, w = m.city.world;
      // "cam:x,y,z>lx,ly,lz" (three.js metres) is a free camera, for aerial views; else a spawn.
      if (s.startsWith("cam:")) {
        const [a, b] = s.slice(4).split(">").map((t) => t.split(",").map(Number));
        w.placeAt({ feet: [a[0], 0, a[2]], look: b });
        m.step(30, 0.05);
        m.camera.position.fromArray(a); m.camera.lookAt(...b); m.camera.updateMatrixWorld();
        w.traveller.root.visible = false;
        m.renderer.render(w.scene, m.camera);
        return { spawn: s };
      }
      const sp = w.spawn(s);
      w.placeAt(sp);
      m.camera.position.fromArray(sp.position);
      m.camera.lookAt(...sp.look);
      m.step(30, 0.05); // settle the camera, trees and fog
      return { spawn: s, triangles: m.renderer.info.render.triangles, calls: m.renderer.info.render.calls };
    }, spawn);
    const path = `test-results/shots/${world}-${spawn.startsWith("cam:") ? "cam" + spawnList.split(";").indexOf(spawn) : spawn}-${tag}.png`;
    await page.screenshot({ path, timeout: 300000 });
    console.log("shot", path, JSON.stringify(info));
  }
} finally {
  await browser.close();
}
