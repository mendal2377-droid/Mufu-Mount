// Birds in the city (item 44, step 4, slice 3; design/STREET-LIFE-PLAN.md), audited in the browser:
//   density    land birds round Huanzhou at 8:00 near the survey's 22 a hectare of green; none at 22:00
//   placed     every ground bird on walkable ground, none on water; every perched one in a crown
//   flushing   a feeding group takes to the trees when the walker comes up, and comes down again
//   flights    herons fly out at dusk to feed round the lake, and are away at night; cormorants come in
//              lines and are gone by evening
//   flocks     Xuanwu Lake in winter: each flock its reported size, every swimmer on the lake's water,
//              the herons on the bank; in summer only the resident herons
//   cost       birds updated in under 2 ms a frame
// Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/birds-browser.mjs
import { chromium } from "@playwright/test";

const gpu = process.env.MUFU_SWIFTSHADER ? ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: gpu });
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
  await page.waitForFunction(() => window.__mufu.city.world?.id === "core" && window.__mufu.city.world.birds, null, { timeout: 600000 });

  // Land birds: the drawn groups against the green cells round the camera.
  const land = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, b = w.birds;
    const go = (hour, x, z) => { m.setClock(hour, { sky: "clear", season: "autumn" }); w.placeAt({ feet: [x, w.ground(x, z) ?? 8, z], look: [x, 8, z - 10] }); m.step(3, 0.1); };
    // Several places, so the count is not one park's luck: Huanzhou, Liangzhou, Jiming Temple's slope, Xuanwu Gate.
    let birds = 0, cells = 0, ground = [], perch = [];
    for (const [x, z] of [[455, -3640], [544, -4086], [700, -2560], [-60, -3410]]) {
      go(8, x, z);
      const gs = [...b.groups.values()].filter(Boolean);
      // Green cells: those whose groups could exist (the cache knows each cell in range).
      for (const g of gs) for (const q of g.birds) { birds++; if (q.state === "ground") ground.push([q.x, q.y, q.z]); else if (q.state === "perch") perch.push([q.x, q.y, q.z]); }
      cells += [...b.groups.keys()].filter((k) => { const [i, j] = k.split(",").map(Number); return w.grid.crowns((i + .5) * 20, (j + .5) * 20, 14).length >= 2; }).length;
    }
    const wet = ground.filter(([x, , z]) => w.grid.water(x, z) != null).length, off = ground.filter(([x, , z]) => w.grid.height(x, z) == null).length;
    const loose = perch.filter(([x, y, z]) => !w.grid.crowns(x, z, 12).some((c) => Math.hypot(c[0] - x, c[1] - y, c[2] - z) < c[3] + .5)).length;
    go(22, 455, -3640);
    return { birds, ha: cells * .04, ground: ground.length, perch: perch.length, wet, off, loose, night: b.land().length };
  });
  const perHa = land.birds / land.ha;
  check("density", perHa > 22 * .6 && perHa < 22 * 1.5 && land.night === 0,
    `${land.birds} land birds over ${land.ha.toFixed(1)} ha of green at 8:00: ${perHa.toFixed(1)} a hectare (survey 22); ${land.night} at 22:00`);
  check("placed", land.ground > 20 && land.wet === 0 && land.off === 0 && land.perch > 5 && land.loose === 0,
    `${land.ground} on the ground (${land.wet} on water, ${land.off} off walkable ground), ${land.perch} perched (${land.loose} outside a crown)`);

  // Flushing: walk up to a feeding group; it flies to the trees; walk away and it comes down again.
  const flush = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, b = w.birds;
    m.setClock(8, { sky: "clear", season: "autumn" }); const x0 = 455, z0 = -3640; w.placeAt({ feet: [x0, w.ground(x0, z0) ?? 8, z0], look: [x0, 8, z0 - 10] }); m.step(3, .1);
    const g = [...b.groups.values()].filter(Boolean).map((q) => ({ q, n: q.birds.filter((r) => r.state === "ground").length })).filter((o) => o.n >= 2 && Math.hypot(o.q.info.spot[0] - x0, o.q.info.spot[1] - z0) > 25).sort((a, c) => c.n - a.n)[0]?.q;
    if (!g) return null;
    const [sx, sz] = g.info.spot, before = g.birds.filter((r) => r.state === "ground").length;
    w.placeAt({ feet: [sx, w.ground(sx, sz) ?? 8, sz], look: [sx, 8, sz - 10] }); m.step(30, .1);
    const up = g.birds.filter((r) => r.state !== "ground").length;
    // Away 40 m (still within the birds' range of the camera) and wait two minutes.
    const ax = sx + 40, az = sz; w.placeAt({ feet: [ax, w.ground(ax, az) ?? 8, az], look: [ax, 8, az - 10] }); m.step(1200, .1);
    return { name: g.name, before, up, n: g.birds.length, down: g.birds.filter((r) => r.state === "ground").length, same: [...b.groups.values()].includes(g) };
  });
  check("flushing", !!flush && flush.up === flush.n && flush.down >= 1 && flush.same,
    flush ? `${flush.before} ${flush.name}s feeding; ${flush.up} of ${flush.n} up when the walker came; ${flush.down} back down 2 minutes after it left` : "no feeding group found");

  // Xuanwu Lake's flocks: winter, then summer, letting the season settle each time.
  const lake = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, b = w.birds;
    const at = (season, hour) => { m.setClock(hour, { sky: "clear", season }); const x = 300, z = -4900; w.placeAt({ feet: [x, w.ground(x, z) ?? 8, z], look: [x, 8, z - 10] }); m.step(300, 0.1); m.setClock(hour, { sky: "clear", season }); m.step(2, .1);
      return Object.fromEntries(b.lake.flocks.map((f) => [f.name, f.birds.length])); };
    const winter = at("winter", 10), dusk = at("winter", 17), summer = at("summer", 10);
    m.setClock(10, { sky: "clear", season: "winter" }); m.step(300, .1); m.step(2, .1);
    let swim = 0, dry = 0, herons = 0, bank = 0;
    for (const f of b.lake.flocks) for (const q of f.birds) {
      if (f.name === "heron") { herons++; if (w.grid.water(q.x, q.z) == null && w.grid.height(q.x, q.z) != null) bank++; }
      else { swim++; if (w.grid.water(q.x, q.z) == null) dry++; }
    }
    return { winter, dusk, summer, swim, dry, herons, bank };
  });
  const W = lake.winter;
  check("flocks", W.mandarin === 150 && W.coot === 150 && lake.dusk.coot === 300 && W.cormorant === 35 && W.heron === 100 && W.mallard === 40
      && lake.summer.mandarin === 0 && lake.summer.coot === 0 && lake.summer.heron === 30 && lake.dry === 0 && lake.bank === lake.herons,
    `winter ${JSON.stringify(W)}, coots at 17:00 ${lake.dusk.coot}; summer ${JSON.stringify(lake.summer)}; ${lake.dry} of ${lake.swim} swimmers off the water, ${lake.bank} of ${lake.herons} herons on the bank`);

  // Flights: the herons' stream out at dusk and their night away; the cormorants' lines and their
  // night on Qianzhou.
  const fl = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, b = w.birds;
    const herons = b.lake.flocks.find((f) => f.name === "heron"), corms = b.lake.flocks.find((f) => f.name === "cormorant");
    const at = (hour, [x, z]) => { m.setClock(hour, { sky: "clear", season: "winter" }); w.placeAt({ feet: [x, w.ground(x, z) ?? 8, z], look: [x, 8, z - 10] }); m.step(2, .1); return { ...b.stats }; };
    m.setClock(12, { sky: "clear", season: "winter" }); m.step(300, .1);
    const home = herons.centre, station = corms.centre;
    // Herons due in the air just after the first heron's turn: those whose turn has come and whose flight is not over.
    const h = herons.birds[0].fl.out + .002, due = herons.birds.filter((q) => { const d = Math.hypot(q.fl.feed[0] - q.x, q.fl.feed[1] - q.z) / 6 / 3600; return h >= q.fl.out && h < q.fl.out + d; }).length;
    const dusk = at(h, home), noon = at(12, home), night = at(22, home);
    const evening = at(20, station);
    const team = corms.birds[0].fl, line = at(team.back + .002, station);
    return { due, dusk: dusk.flying, noonFlying: noon.flying, noonHerons: noon.heron, nightHerons: night.heron, eveningCorms: evening.cormorant, line: line.flying,
      feed: herons.birds.filter((q) => Math.hypot(q.fl.feed[0] - home[0], q.fl.feed[1] - home[1]) > 100).length };
  });
  check("flights", fl.due > 0 && fl.dusk >= fl.due && fl.noonFlying === 0 && fl.nightHerons < fl.noonHerons * .7 && fl.feed > 50 && fl.eveningCorms === 0 && fl.line >= 5,
    `dusk: ${fl.dusk} in the air (${fl.due} herons due); noon: ${fl.noonFlying} flying, ${fl.noonHerons} herons at Heping Gate; 22:00: ${fl.nightHerons} there, ${fl.feed} feed over 100 m away; `
    + `20:00: ${fl.eveningCorms} cormorants on the lake; a line coming in: ${fl.line} in the air`);

  const cost = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, ms = [];
    m.setClock(8, { sky: "clear", season: "winter" }); const x = 100, z = -4800; w.placeAt({ feet: [x, w.ground(x, z) ?? 8, z], look: [x, 8, z - 10] }); m.step(2, .1);
    for (let i = 0; i < 30; i++) { const t0 = performance.now(); w.birds.update(3000 + i * .05, 8, m.camera.position); ms.push(performance.now() - t0); }
    ms.sort((a, b) => a - b); return { median: +ms[15].toFixed(2), worst: +ms[29].toFixed(2), birds: w.birds.stats.birds }; });
  check("cost", cost.median < 2, `median ${cost.median} ms a frame for ${cost.birds} birds by Heping Gate in winter, worst ${cost.worst} ms`);
  check("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 3)));
} finally {
  await browser.close();
}
if (fails.length) { console.error(`birds FAILED: ${fails.join(", ")}`); process.exit(1); }
console.log("birds ok");
