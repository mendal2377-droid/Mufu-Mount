// Jinling Keepsakes in the city (item 44; design/THINGS-TO-DO-PLAN.md), its audits in the browser:
//   hung      every lantern of src/world-lanterns.js found walkable ground (none skipped)
//   reachable each lantern can be walked to from the nearest spawn
//   off spawns no lantern within 10 m of an arrival point (it would be picked up on landing)
//   pickup    walking into Zhongshan's three shows each fact and earns the seal
// A shot to test-results/shots/lantern.png. Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/lanterns-browser.mjs
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
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.addInitScript(() => localStorage.setItem("mufu-quality", "balanced"));
  await page.goto(process.env.MUFU_TEST_URL || "http://localhost:4190/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
  await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
  await page.waitForFunction(() => window.__mufu.city.world?.id === "core" && window.__mufu.city.world.keepsakes !== undefined, null, { timeout: 600000 });
  await installJourney(page);

  const hung = await page.evaluate(() => { const k = window.__mufu.city.world.keepsakes; return { n: k.lanterns.length, skipped: k.skipped, list: k.lanterns.map((l) => [l.id, l.index, l.position[0], l.position[2]]) }; });
  check("hung", hung.n >= 27 && hung.skipped.length === 0, `${hung.n} lanterns, skipped ${JSON.stringify(hung.skipped)}`);

  // Not on an arrival point: there a lantern is picked up the moment the visitor lands, unseen.
  const onSpawn = await page.evaluate(() => { const w = window.__mufu.city.world, out = [];
    for (const l of w.keepsakes.lanterns) for (const [name, s] of Object.entries(w.meta.spawns))
      if (Math.hypot(s.position[0] - l.position[0], s.position[2] - l.position[2]) < 10) out.push(`${l.id}:${l.index}@${name}`);
    return out; });
  check("off spawns", onSpawn.length === 0, `${onSpawn.length} lanterns within 10 m of a spawn ${JSON.stringify(onSpawn)}`);

  // Reachable: from the nearest spawn, on foot.
  const lost = [];
  for (const [id, index, x, z] of hung.list) {
    const r = await page.evaluate(([x, z]) => {
      const w = window.__mufu.city.world; let best = null;
      for (const [name, s] of Object.entries(w.meta.spawns)) { const d = Math.hypot(s.position[0] - x, s.position[2] - z); if (!best || d < best.d) best = { name, d, p: [s.position[0], s.position[2]] }; }
      // 4 m lattice first; 2 m where that fails (the Mausoleum's stair and terraces, as its journey test).
      let out = window.__journey.route(best.p, [x, z], "walk");
      if (!out.path) out = window.__journey.route(best.p, [x, z], "walk", 2);
      return { from: best.name, metres: Math.round(best.d), found: !!out.path, closest: out.closest };
    }, [x, z]);
    if (!r.found) lost.push({ id, index, ...r });
  }
  for (const l of lost) console.log("     unreachable", JSON.stringify(l));
  check("reachable", lost.length === 0, `${hung.list.length - lost.length} of ${hung.list.length} reachable on foot from the nearest spawn`);

  // Pickup: stand a few metres from each of Zhongshan's lanterns, walk in, read the card.
  const seen = [];
  for (const [id, index, x, z] of hung.list.filter((l) => l[0] === "zhongshan")) {
    const r = await page.evaluate(([id, index, x, z]) => {
      const m = window.__mufu, w = m.city.world, y = w.ground(x, z);
      w.placeAt({ feet: [x, y, z], look: [x, y, z + 10] });
      m.step(4, 0.1);
      return { has: m.city.game.has(id, index), count: m.city.game.count(id), card: document.querySelector("#fact-card").classList.contains("show"), text: document.querySelector("#fact-text").textContent,
        chip: document.querySelector("#game-lanterns").textContent, sealed: m.city.game.stamped(id) };
    }, [id, index, x, z]);
    seen.push(r);
    if (index === 0) await page.screenshot({ path: "test-results/shots/lantern.png" });
  }
  const last = seen[seen.length - 1];
  check("pickup", seen.length === 3 && seen.every((r) => r.has && r.card && r.text.length > 20) && last.count === 3 && last.sealed, JSON.stringify(seen.map((r) => [r.count, r.chip, r.text.slice(0, 40)])));
  check("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 3)));
} finally {
  await browser.close();
}
if (fails.length) { console.error(`lanterns FAILED: ${fails.join(", ")}`); process.exit(1); }
console.log("lanterns ok");
