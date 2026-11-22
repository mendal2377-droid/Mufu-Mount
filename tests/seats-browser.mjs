// Places to sit and look in the city (item 44, step 3; design/THINGS-TO-DO-PLAN.md), audited in the browser:
//   placed     every bench of src/world-seats.js found walkable ground (none skipped)
//   reachable  each bench can be walked to from the nearest spawn
//   first      F beside a bench sits on it: no gate, stop, dock or bell within 4 m to take F first
//   sit        F sits the traveller on the plank, facing the bench's way; a step stands up again
//   hint       beside a bench, the hint names the view
// Shots of the seated view to test-results/shots/bench-<id>.png. Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/seats-browser.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { installJourney } from "./journey-kit.mjs";

const gpu = process.env.MUFU_SWIFTSHADER ? ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: gpu });
await fs.mkdir("test-results/shots", { recursive: true });
const errors = [], fails = [];
const check = (name, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); if (!ok) fails.push(name); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "warning" && /Benches/.test(m.text())) console.log("     console:", m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
  await page.goto(process.env.MUFU_TEST_URL || "http://localhost:4190/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
  await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
  await page.waitForFunction(() => window.__mufu.city.world?.id === "core" && window.__mufu.city.world.benches !== undefined, null, { timeout: 600000 });
  await installJourney(page);

  const placed = await page.evaluate(() => { const b = window.__mufu.city.world.benches;
    return { skipped: b.skipped, list: b.placed.map((s) => ({ id: s.id, p: s.position.map((v) => +v.toFixed(1)), face: +Math.atan2(s.look[0] - s.position[0], s.look[2] - s.position[2]).toFixed(2) })) }; });
  for (const s of placed.list) console.log("     bench", JSON.stringify(s));
  check("placed", placed.list.length >= 11 && placed.skipped.length === 0, `${placed.list.length} benches, skipped ${JSON.stringify(placed.skipped)}`);

  const crowded = await page.evaluate(() => { const w = window.__mufu.city.world, m = w.meta, out = [];
    const others = [...Object.values(m.gates || {}).map((g) => ["gate", g.position]), ...Object.values(m.bells || {}).map((g) => ["bell", g.position]), ...Object.values(m.docks || {}).map((g) => ["dock", g.position])];
    for (const s of w.benches.placed) {
      for (const [k, p] of others) if (p && Math.hypot(p[0] - s.position[0], p[2] - s.position[2]) < 4) out.push(`${s.id}:${k}`);
      w.placeAt({ feet: s.position, look: s.look });
      if (w.nearestTransit?.()) out.push(`${s.id}:transit`);
    }
    return out; });
  check("first", crowded.length === 0, `${crowded.length} benches share F with something else ${JSON.stringify(crowded)}`);

  const lost = [];
  for (const s of placed.list) {
    const r = await page.evaluate(([x, z]) => {
      const w = window.__mufu.city.world; let best = null;
      for (const [name, s] of Object.entries(w.meta.spawns)) { const d = Math.hypot(s.position[0] - x, s.position[2] - z); if (!best || d < best.d) best = { name, d, p: [s.position[0], s.position[2]] }; }
      let out = window.__journey.route(best.p, [x, z], "walk");
      if (!out.path) out = window.__journey.route(best.p, [x, z], "walk", 2);
      return { from: best.name, metres: Math.round(best.d), found: !!out.path, closest: out.closest };
    }, [s.p[0], s.p[2]]);
    if (!r.found) lost.push({ id: s.id, ...r });
  }
  for (const l of lost) console.log("     unreachable", JSON.stringify(l));
  check("reachable", lost.length === 0, `${placed.list.length - lost.length} of ${placed.list.length} reachable on foot from the nearest spawn`);

  // Sit on each: stand 1.5 m in front, press F, let the settle finish, look from behind and above.
  const sat = [];
  for (const s of placed.list) {
    await page.evaluate((id) => {
      const m = window.__mufu, w = m.city.world, b = w.benches.placed.find((p) => p.id === id);
      const a = Math.atan2(b.look[0] - b.position[0], b.look[2] - b.position[2]);
      const fx = b.position[0] + Math.sin(a) * 1.5, fz = b.position[2] + Math.cos(a) * 1.5;
      if (w.seated) w.stand();
      m.setClock(16.5, { sky: "clear", season: "summer" });
      w.placeAt({ feet: [fx, w.ground(fx, fz) ?? b.position[1], fz], look: b.position });
      m.step(2, 0.05);
    }, s.id);
    await page.keyboard.press("KeyF");
    const r = await page.evaluate((id) => {
      const m = window.__mufu, w = m.city.world, b = w.benches.placed.find((p) => p.id === id);
      m.step(40, 0.05);
      const body = w.body, want = Math.atan2(b.look[0] - b.position[0], b.look[2] - b.position[2]);
      return { id, seated: w.seated?.seat?.id === id, off: +Math.hypot(body.x - b.position[0], body.z - b.position[2]).toFixed(2),
        lift: +(body.y - b.position[1]).toFixed(2), turn: +Math.abs(Math.atan2(Math.sin(w.heading - want), Math.cos(w.heading - want))).toFixed(2) };
    }, s.id);
    sat.push(r);
    // What the game shows while seated: its own chase camera, which steps in front of trunks.
    await page.screenshot({ path: `test-results/shots/bench-${s.id.replace("bench-", "")}.png` });
  }
  for (const r of sat) console.log("     sat", JSON.stringify(r));
  check("sit", sat.every((r) => r.seated && r.off < 0.3 && Math.abs(r.lift - 0.42) < 0.03 && r.turn < 0.1), `${sat.filter((r) => r.seated).length} of ${sat.length} sat on`);

  // The hint: standing beside a bench names the view.
  const hint = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, b = w.benches.placed.find((p) => p.id === "bench-liangzhou");
    if (w.seated) w.stand();
    const a = Math.atan2(b.look[0] - b.position[0], b.look[2] - b.position[2]), fx = b.position[0] + Math.sin(a) * 1.5, fz = b.position[2] + Math.cos(a) * 1.5;
    w.placeAt({ feet: [fx, w.ground(fx, fz), fz], look: b.position });
    m.step(160, 0.05);
    return document.querySelector("#toast").textContent;
  });
  check("hint", /A bench at Liangzhou/.test(hint), JSON.stringify(hint));

  // Standing up again with a step.
  const stood = await page.evaluate(() => { const m = window.__mufu, w = m.city.world; w.stand(); m.step(4, 0.05); return !w.seated; });
  check("stand", stood, `standing: ${stood}`);
  check("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 3)));
} finally {
  await browser.close();
}
if (fails.length) { console.error(`seats FAILED: ${fails.join(", ")}`); process.exit(1); }
console.log("seats ok");
