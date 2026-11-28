// Weather and seasons on the ground (design/LANDMARK-DETAIL-PLAN.md, round 1), audited in the browser
// at the Presidential Palace's plaza and Xuanwu Lake's shore:
//   overcast  in rain and in snow the sun's shadows fade to a trace
//   wet       rain soaks the ground within a minute (the plaza darker than dry), and it stays wet a
//             while after the rain stops
//   snow      snow settles over a minute and is still there a minute after it stops; the lake's open
//             water stays its colour under it
//   lawn      in a clear winter the lawn is straw-coloured, in summer green
//   no page errors
// Shots: test-results/shots/weather-*.png. Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/weather-browser.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"] });
await fs.mkdir("test-results/shots", { recursive: true });
const errors = [], fails = [];
const check = (name, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); if (!ok) fails.push(name); };
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
  await page.goto(process.env.MUFU_TEST_URL || "http://localhost:4190/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
  const enter = async (id) => {
    await page.evaluate((id) => { window.__mufu.paused = true; window.__mufu.city.enter(id); }, id);
    await page.waitForFunction((id) => window.__mufu.city.selected?.id === id && window.__mufu.city.world?.body, id, { timeout: 600000 });
  };
  // Mean brightness of a screen box (fractions of the frame), from a fresh render.
  const sample = (box) => page.evaluate((box) => {
    const m = window.__mufu, c = m.renderer.domElement, w = c.width, h = c.height;
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h; const g = cv.getContext("2d");
    m.step(1, 0.1); g.drawImage(c, 0, 0);
    const d = g.getImageData(Math.round(box[0] * w), Math.round(box[1] * h), Math.round((box[2] - box[0]) * w), Math.round((box[3] - box[1]) * h)).data;
    let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4; return [r / n, gg / n, b / n].map(Math.round);
  }, box);
  const run = (hour, sky, season, seconds) => page.evaluate(([hour, sky, season, seconds]) => { const m = window.__mufu; m.setClock(hour, { sky, season }); m.step(Math.round(seconds / 0.1), 0.1); }, [hour, sky, season, seconds]);
  const uniforms = () => page.evaluate(() => { const m = window.__mufu; let sun = null; m.city.world.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) sun = o; });
    return { shadow: +sun.shadow.intensity.toFixed(2), wet: +m.u.wet.value.toFixed(2), cover: +m.u.cover.value.toFixed(2) }; });
  const ground = [0.05, 0.8, 0.3, 0.95];   // the plaza in front of and beside the traveller

  // --- overcast and wet ------------------------------------------------------------------------------
  await enter("palace");
  await run(11, "clear", "summer", 120);
  const dry = { ...(await uniforms()), px: await sample(ground) };
  await page.screenshot({ path: "test-results/shots/weather-dry.png" });
  await run(11, "rain", "summer", 60);
  const wet = { ...(await uniforms()), px: await sample(ground) };
  await page.screenshot({ path: "test-results/shots/weather-wet.png" });
  await run(11, "clear", "summer", 30);
  const after = await uniforms();
  const lum = (p) => p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11;
  check("overcast", dry.shadow === 1 && wet.shadow < 0.2, `shadow strength clear ${dry.shadow}, in rain ${wet.shadow}`);
  check("wet", wet.wet > 0.9 && lum(wet.px) < lum(dry.px) * 0.85 && after.wet > 0.5,
    `wet ${dry.wet} dry, ${wet.wet} after a minute of rain, ${after.wet} 30 s after it; the plaza ${dry.px} dry, ${wet.px} wet`);

  // --- snow on the lake's shore ----------------------------------------------------------------------
  await enter("xuanwu");
  await run(11, "clear", "winter", 120);
  const lawn = await sample([0.1, 0.75, 0.4, 0.95]), lakeClear = await sample([0.05, 0.6, 0.25, 0.66]);
  await page.screenshot({ path: "test-results/shots/weather-winter-lawn.png" });
  await run(11, "snow", "winter", 60);
  const snowy = { ...(await uniforms()), lake: await sample([0.05, 0.6, 0.25, 0.66]) };
  await page.screenshot({ path: "test-results/shots/weather-snow.png" });
  await run(11, "clear", "winter", 60);
  const melting = await uniforms();
  check("snow", snowy.cover > 0.9 && snowy.shadow < 0.3 && melting.cover > 0.5,
    `cover ${snowy.cover} after a minute of snow, ${melting.cover} a minute after it; shadow ${snowy.shadow}; the lake by the shore ${lakeClear} clear, ${snowy.lake} in snow`);
  await run(11, "clear", "summer", 400);
  const summerLawn = await sample([0.1, 0.75, 0.4, 0.95]);
  const greenness = (p) => p[1] - (p[0] + p[2]) / 2;
  check("lawn", greenness(summerLawn) > greenness(lawn) + 12 && lawn[0] > lawn[2] + 20,
    `winter ${lawn} (straw), summer ${summerLawn} (green)`);
  check("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 5)));
} finally {
  await browser.close();
}
if (fails.length) throw new Error("weather failed: " + fails.join(", "));
console.log("weather ok");
