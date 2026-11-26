// The taxi, the map and the radio in the city (design/TAXI-PLAN.md), audited in the browser:
//   rank      the taxis at the OSM rank stand on the road
//   hail      H brings one to a kerb within 70 m, on the road
//   enter     F beside it gets in: the minimap and the meter show
//   fare      a passenger waits at a real stop; driven there along the route, they get in and name
//             a stop; driven there, they pay the metered fare and the tip by src/taxi-fare.js. On the
//             way the taxi never leaves the road and never runs into a car, a rider or a walker ahead
//             (outlines overlapping, the taxi moving); no car passes through it (a car's middle within
//             its outline). Grazes in lane changes are counted, not failed. Checked every other frame.
//   exit      F gets out onto the nearest pavement (within 16 m on a wide road); the taxi stays parked
//   map       N opens the big map; a click sets a waypoint and a route on foot appears
//   radio     R turns through the four stations and off, in the taxi; out of it, the radio is off
//   cost      the median frame while driving
// Shots to test-results/shots/taxi-*.png. Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/taxi-browser.mjs
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import { fare, tip } from "../src/taxi-fare.js";

const gpu = process.env.MUFU_SWIFTSHADER ? ["--use-angle=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] : ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11"];
const browser = await chromium.launch({ channel: "chrome", headless: true, args: [...gpu, "--autoplay-policy=no-user-gesture-required"] });
await fs.mkdir("test-results/shots", { recursive: true });
const errors = [], fails = [];
const check = (name, ok, detail) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}: ${detail}`); if (!ok) fails.push(name); };
const DT = 0.1;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: "text/css", body: "" }));
  await page.addInitScript(() => { localStorage.setItem("mufu-quality", "balanced"); localStorage.removeItem("mufu-taxi-v1"); });
  await page.goto(process.env.MUFU_TEST_URL || "http://localhost:4190/", { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForFunction(() => window.__mufu?.city?.active !== undefined, null, { timeout: 180000 });
  await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.city.enter("zifeng"); });
  await page.waitForFunction(() => window.__mufu.city.world?.id === "core", null, { timeout: 600000 });
  await page.waitForFunction(() => window.__mufu.city.world?.taxi && window.__mufu.city.world.traffic, null, { timeout: 180000 });
  // Keys as the visitor presses them; a driver that follows the route's points.
  await page.evaluate(() => {
    const key = (code, down) => document.body.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code, key: code, bubbles: true }));
    const held = new Set();
    window.__hold = (codes) => {
      for (const c of held) if (!codes.includes(c)) { key(c, false); held.delete(c); }
      for (const c of codes) if (!held.has(c)) { key(c, true); held.add(c); }
    };
    window.__press = (code) => { key(code, true); key(code, false); };
    // Drive along pts ([x, z]) until done(): look 9 m ahead on the line, ease off in a tight turn.
    window.__driveTo = (pts, done, frames, dt, lanes = null) => {
      const m = window.__mufu, w = m.city.world, g = w.grid, dense = [];
      // In the lane the chevrons show (route.lanes: metres right of the mapped line, per stretch).
      for (let i = 1; i < pts.length; i++) {
        const [ax, az] = pts[i - 1], [bx, bz] = pts[i], L = Math.hypot(bx - ax, bz - az) || 1, n = Math.max(1, Math.ceil(L / 2)), k = lanes?.[i - 1] ?? 0;
        for (let q = 0; q < n; q++) dense.push([ax + (bx - ax) * q / n - (bz - az) / L * k, az + (bz - az) * q / n + (bx - ax) / L * k]);
      }
      dense.push(pts.at(-1));
      let i = 0, offRoad = 0, offAt = [], into = 0, closest = 0, grazes = 0, trace = [], through = [], lastV = 0, f = 0, ms = [], stuck = 0, reversed = 0, touches = [];
      for (; f < frames; f++) {
        const b = w.body;
        for (let q = i; q < Math.min(dense.length, i + 30); q++) if (Math.hypot(dense[q][0] - b.x, dense[q][1] - b.z) < Math.hypot(dense[i][0] - b.x, dense[i][1] - b.z)) i = q;
        let t = i; while (t < dense.length - 1 && Math.hypot(dense[t][0] - b.x, dense[t][1] - b.z) < 9) t++;
        let err = Math.atan2(dense[t][0] - b.x, dense[t][1] - b.z) - w.heading; err = Math.atan2(Math.sin(err), Math.cos(err));
        if (done()) { window.__hold(["KeyS"]); for (let s = 0; s < 40 && Math.abs(w.vspeed) > .3; s++) m.step(1, dt); window.__hold([]); m.step(3, dt); return { done: true, frames: f, offRoad, offAt, into, closest, grazes, ms, reversed, touches, through }; }
        const v = w.vspeed, slow = Math.abs(err) > .45 && v > 5;
        // Stuck against a kerb, as a driver would: back up a few metres, wheel turned the other way.
        const held = w.carLimit ? w.carLimit(w.body.x, w.body.z, w.heading, 1) < 2 : false;   // waiting behind traffic is not stuck
        stuck = Math.abs(v) < .3 && !held ? stuck + 1 : 0;
        if (stuck > 15) { for (let k = 0; k < 18; k++) { window.__hold(["KeyS", ...(err < 0 ? ["KeyA"] : ["KeyD"])]); m.step(1, dt); } stuck = 0; reversed++; continue; }
        window.__hold([...(slow ? [] : ["KeyW"]), ...(err < -.05 ? ["KeyD"] : err > .05 ? ["KeyA"] : [])]);
        lastV = w.vspeed; m.step(1, dt); ms.push(w.taxi.stats.ms + w.nav.stats.ms);
        if (f % 250 === 0) trace.push([f, Math.round(w.body.x), Math.round(w.body.z), +w.vspeed.toFixed(1), +Math.min(99, w.carLimit(w.body.x, w.body.z, w.heading, 1)).toFixed(1), i, dense.length]);
        // On the carriageway: a road cell within 3 m of the car's middle, or road on both sides of it
        // within 8 m (crossing a junction's paved crossing).
        const sx = Math.sin(w.heading), sz = Math.cos(w.heading), x = w.body.x, z = w.body.z;
        let near = false;
        for (let a = 0; a < 16 && !near; a++) for (const r of [0, 1.5, 3]) if (g.road(x + Math.cos(a * Math.PI / 8) * r, z + Math.sin(a * Math.PI / 8) * r) !== null) { near = true; break; }
        if (!near) { let fore = false, aft = false; for (let d = 2; d <= 8; d += 1) { fore ||= g.road(x + sx * d, z + sz * d) !== null; aft ||= g.road(x - sx * d, z - sz * d) !== null; } near = fore && aft; }
        if (!near) { offRoad++; if (offAt.length < 6) offAt.push([Math.round(x), Math.round(z)]); }
        // The taxi driving into something: a car, rider or walker within 2.5 m ahead on its line while it
        // moves. Traffic coming into the taxi: a car's middle within 2 m of the taxi's.
        if (f % 2 === 0) for (const src of [w.traffic, w.people]) for (const p of src?.positions() || []) {
          const px = p.length === 4 ? p[1] : p[0], pz = p.length === 4 ? p[3] : p[2], dx = px - x, dz = pz - z, d = Math.hypot(dx, dz);
          // Touching: their outlines overlap, taken side by side (the taxi 4.65 x 1.8 m; a car the same, an
          // e-bike 1.8 x 0.7, a walker 0.5 across). The taxi driving into one: it ahead, the taxi moving.
          const fw = dx * sx + dz * sz, lat = dx * sz - dz * sx, kind = p.length === 4 ? p[0] : "walker";
          const [L2, W2] = kind === "car" ? [4.65, 1.8] : kind === "bike" ? [1.8, .7] : [.5, .5];
          const touch = Math.abs(fw) < (4.65 + L2) / 2 && Math.abs(lat) < (1.8 + W2) / 2;
          // Its fault: the taxi running into one ahead at more than a walking pace. Traffic's: a car's middle
          // deep in the taxi's outline (more than a graze from a lane change, which is counted apart).
          if (touch && fw > 0 && Math.abs(lat) < 1.2 && w.vspeed > 3 && w.vspeed >= lastV - .05) into++;   // squarely ahead, faster than a jog, not braking
          if (kind === "car" && Math.abs(fw) < 3.5 && Math.abs(lat) < 1.2) { closest++; if (through.length < 6) through.push({ f, fw: +fw.toFixed(1), lat: +lat.toFixed(1), v: +w.vspeed.toFixed(1), at: [Math.round(x), Math.round(z)] }); }
          if (touch) grazes++;
          if (touch && touches.length < 8) touches.push({ f, kind, fw: +fw.toFixed(1), lat: +lat.toFixed(1), v: +w.vspeed.toFixed(1) });
        }
      }
      window.__hold([]);
      const ahead = []; { const sx = Math.sin(w.heading), sz = Math.cos(w.heading); for (const [src, k] of [[w.traffic, ""], [w.people, "walker"], [w.cyclists, "cyclist"]]) for (const p of src?.positions() || []) {
        const px = p.length === 3 ? p[0] : p[1], pz = p.length === 3 ? p[2] : p[3], dx = px - w.body.x, dz = pz - w.body.z, fw = dx * sx + dz * sz, lat = dx * sz - dz * sx;
        if (fw > -1 && fw < 15 && Math.abs(lat) < 2.5) ahead.push([k || p[0], +fw.toFixed(1), +lat.toFixed(1), g.road(px, pz) !== null]); } }
      return { done: false, frames: f, offRoad, offAt, into, closest, grazes, ms, reversed, touches, through, trace, ahead, at: [w.body.x, w.body.z], lim: w.carLimit(w.body.x, w.body.z, w.heading, 1) };
    };
  });

  // --- rank, hail, enter -------------------------------------------------------------------------------
  const rank = await page.evaluate(() => { const w = window.__mufu.city.world; return w.taxi.parked.map((p) => [Math.round(p.x), Math.round(p.z), w.grid.road(p.x, p.z) !== null]); });
  check("rank", rank.length >= 2 && rank.every((r) => r[2]), JSON.stringify(rank));

  const hail = await page.evaluate(() => { const m = window.__mufu, w = m.city.world;
    const s = w.spawn("zhongshan"); w.placeAt(s); m.camera.rotation.set(-.15, w.heading + Math.PI, 0, "YXZ"); m.step(5, .1);
    window.__press("KeyH"); m.step(2, .1);
    const t = w.taxi.parked.find((p) => p.hailed), b = w.body;
    return t && { d: Math.hypot(t.x - b.x, t.z - b.z), road: w.grid.road(t.x, t.z) !== null, x: t.x, z: t.z, heading: t.heading }; });
  check("hail", hail && hail.d < 70 && hail.road, JSON.stringify(hail));

  const enter = await page.evaluate((h) => { const m = window.__mufu, w = m.city.world;
    // Walk up to it: stand on the pavement beside it.
    const sx = Math.cos(h.heading), sz = -Math.sin(h.heading);
    let spot = null; for (const d of [3, 4, -3, -4, 2.5]) { const x = h.x + sx * d, z = h.z + sz * d; if (w.grid.height(x, z) !== null) { spot = [x, z]; break; } }
    spot = spot || [h.x + sx * 2.5, h.z + sz * 2.5];
    w.placeAt({ feet: [spot[0], w.grid.height(...spot) ?? w.body.y, spot[1]], look: [h.x, 0, h.z] }); m.step(2, .1);
    window.__press("KeyF"); m.step(10, .1);
    return { vehicle: w.vehicle, mini: !document.querySelector("#minimap").hidden && getComputedStyle(document.querySelector("#minimap")).display !== "none",
      meter: getComputedStyle(document.querySelector("#taxi-meter")).display !== "none", meterText: document.querySelector("#taxi-meter").textContent }; }, hail);
  check("enter", enter.vehicle === "car" && enter.mini && enter.meter, JSON.stringify(enter));

  // The minimap turns with the traveller: what lies ahead is drawn above the middle, the arrow points up
  // (the owner saw it reversed on foot, 27 Nov). On foot the camera's way is ahead; in the taxi its heading.
  const mini = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, n = w.nav, out = {};
    const b = w.body, h = w.heading, ahead = [b.x + Math.sin(h) * 60, b.z + Math.cos(h) * 60];
    out.car = n.toMini(...ahead);
    return out; });

  await page.screenshot({ path: "test-results/shots/taxi-enter.png" });

  // --- a fare -----------------------------------------------------------------------------------------
  const offer = await page.evaluate(() => { const m = window.__mufu, w = m.city.world;
    for (let i = 0; i < 80 && !w.taxi.job; i++) m.step(1, .1);
    const j = w.taxi.job; return j && { stage: j.stage, from: j.from.en, man: j.k.man, route: w.nav.route && { n: w.nav.route.pts.length, len: Math.round(w.nav.route.length), keep: w.nav.route.keep } }; });
  check("offer", offer?.stage === "pickup" && offer.route?.n > 1, JSON.stringify(offer));
  await page.evaluate(() => window.__mufu.step(3, .1));
  await page.screenshot({ path: "test-results/shots/taxi-offer.png" });

  const toPick = await page.evaluate((DT) => { const w = window.__mufu.city.world;
    const r = window.__driveTo(w.nav.route.pts, () => w.taxi.job?.stage !== "pickup" || Math.hypot(w.taxi.job.k.man[0] - w.body.x, w.taxi.job.k.man[1] - w.body.z) < 7, 6000, DT, w.nav.route.lanes);
    for (let i = 0; i < 20 && w.taxi.job?.stage === "pickup"; i++) window.__mufu.step(1, DT);
    const j = w.taxi.job; r.ms = r.ms.sort((a, b) => a - b)[r.ms.length >> 1];
    return { ...r, stage: j?.stage, to: j?.to && `${j.to.en} ${j.to.name}`, routeM: j?.routeM }; }, DT);
  check("pickup", toPick.stage === "ride" && toPick.offRoad === 0 && toPick.into === 0 && toPick.closest === 0,
    `${toPick.done ? "reached" : "did not reach"} the passenger in ${toPick.frames} frames; off the road ${toPick.offRoad} ${JSON.stringify(toPick.offAt)}; driven into something ${toPick.into}; a car through it ${toPick.closest} ${JSON.stringify(toPick.through)}; grazes ${toPick.grazes}; now ${toPick.stage}, to ${toPick.to}; ${toPick.done ? '' : `reversed ${toPick.reversed}, trace ${JSON.stringify(toPick.trace)}, held by ${JSON.stringify(toPick.ahead)}; `}touches ${JSON.stringify(toPick.touches)}`);
  await page.screenshot({ path: "test-results/shots/taxi-ride.png" });

  const before = await page.evaluate(() => ({ ...window.__mufu.city.world.taxi.book }));
  const ride = await page.evaluate((DT) => { const m = window.__mufu, w = m.city.world, j = w.taxi.job, t0 = performance.now();
    if (!j || j.stage !== "ride") return null;
    let km = 0, last = [w.body.x, w.body.z], frames = 0;
    const done = () => { km += Math.hypot(w.body.x - last[0], w.body.z - last[1]); last = [w.body.x, w.body.z]; frames++; return Math.hypot(j.k.road.x - w.body.x, j.k.road.z - w.body.z) < 18; };
    const routeM = j.routeM, hour = m.city.world && (window.__mufu.weather?.hour ?? 12);
    const r = window.__driveTo(w.nav.route.pts, done, 12000, DT, w.nav.route.lanes);
    for (let i = 0; i < 30 && w.taxi.job; i++) m.step(1, DT);
    r.ms = r.ms.sort((a, b) => a - b)[r.ms.length >> 1];
    return { ...r, paidNow: !w.taxi.job, km: j.km, routeM, seconds: (frames + 3 + 40) * DT, hour, toast: document.querySelector("#toast").textContent, wall: performance.now() - t0 }; }, DT);
  const after = await page.evaluate(() => ({ ...window.__mufu.city.world.taxi.book }));
  if (!ride) check("ride", false, "no ride");
  else {
    const f = fare(ride.km / 1000, ride.hour), paid = Math.round((after.takings - before.takings) * 10) / 10, tp = after.tips - before.tips;
    check("ride", ride.paidNow && after.fares === before.fares + 1 && Math.abs(paid - (f + tp)) < .05 && tp >= 0 && tp <= Math.round(f * .2) && ride.offRoad === 0 && ride.into === 0 && ride.closest === 0,
      `${(ride.km / 1000).toFixed(2)} km by the meter (route ${(ride.routeM / 1000).toFixed(2)} km) in ${ride.frames} frames; paid ¥${paid} = fare ¥${f} + tip ¥${tp}; off the road ${ride.offRoad} ${JSON.stringify(ride.offAt)}; driven into something ${ride.into}; a car through it ${ride.closest} ${JSON.stringify(ride.through)}; grazes ${ride.grazes}; ${ride.done ? '' : `stopped at ${JSON.stringify(ride.at)}, held to ${ride.lim} by ${JSON.stringify(ride.ahead)}; `} "${ride.toast}"; touches ${JSON.stringify(ride.touches)}`);
    check("cost", ride.ms < 4, `median ${ride.ms.toFixed(2)} ms a frame for the taxi and the map while driving`);
  }
  await page.screenshot({ path: "test-results/shots/taxi-paid.png" });

  // --- radio, in the taxi ---------------------------------------------------------------------------
  // The sound starts with the first press (a real wait: the browser's audio starting, not the city's time).
  const seen = [];
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => { window.__press("KeyR"); window.__mufu.step(4, .1); });
    await page.waitForTimeout(i ? 100 : 900);
    seen.push(await page.evaluate(() => window.__mufu.city.radioStation));
  }
  const radio = { seen: seen.slice(0, 5), playing: seen[5], sign: await page.evaluate(() => document.querySelector("#radio-sign").textContent) };
  const radioIds = radio.seen.join(",");
  check("radio", radioIds === "strings,jazz,rain,beats," && radio.playing === "strings", `${radioIds} then ${radio.playing}; sign "${radio.sign}"`);
  await page.screenshot({ path: "test-results/shots/taxi-radio.png" });

  // --- exit -------------------------------------------------------------------------------------------
  const exit = await page.evaluate(() => { const m = window.__mufu, w = m.city.world, n0 = w.taxi.parked.length;
    window.__press("KeyF"); m.step(5, .1);
    const b = w.body, near = w.taxi.parked.at(-1);
    return { vehicle: w.vehicle, onFoot: w.grid.height(b.x, b.z) !== null, offRoad: w.grid.road(b.x, b.z) === null, parked: w.taxi.parked.length - n0,
      gap: near && Math.hypot(near.x - b.x, near.z - b.z), radio: m.city.radioStation, meter: getComputedStyle(document.querySelector("#taxi-meter")).display }; });
  check("exit", exit.vehicle === "walk" && exit.onFoot && exit.parked === 1 && exit.gap < 16 && exit.radio === null && exit.meter === "none", JSON.stringify(exit));

  // On foot, looking north and walking a few steps: north is drawn straight up, the arrow up.
  const miniWalk = await page.evaluate(() => { const m = window.__mufu, w = m.city.world;
    m.camera.rotation.set(-.15, 0, 0, "YXZ"); window.__hold(["KeyW"]); m.step(12, .1); window.__hold([]); m.step(2, .1);
    const b = w.body; return { ahead: w.nav.toMini(b.x, b.z - 60), heading: w.heading }; });
  const turn = Math.abs(Math.atan2(Math.sin(miniWalk.ahead.arrow), Math.cos(miniWalk.ahead.arrow)));
  check("minimap", mini.car.y < -20 && Math.abs(mini.car.x) < 3 && miniWalk.ahead.y < -20 && Math.abs(miniWalk.ahead.x) < 3 && turn < .5,
    `in the taxi the way ahead is drawn at ${JSON.stringify(mini.car)}; on foot looking north, north is at ${JSON.stringify(miniWalk.ahead)}, the arrow turned ${turn.toFixed(2)} rad from up`);

  // --- the big map ------------------------------------------------------------------------------------
  const map = await page.evaluate(() => { const m = window.__mufu, w = m.city.world; w.nav.clear(); window.__press("KeyN"); m.step(2, .1);
    const d = document.querySelector("#city-map"); return { open: d.open }; });
  const box = await page.locator("#city-map canvas").boundingBox();
  // Click 150 px up and right of the middle: about 450 m away at the map's 3 m a pixel.
  await page.mouse.click(box.x + box.width / 2 + 110, box.y + box.height / 2 - 110);
  await page.screenshot({ path: "test-results/shots/taxi-map.png" });
  const way = await page.evaluate(() => { const w = window.__mufu.city.world, r = w.nav.route; document.querySelector("#city-map").close(); window.__mufu.step(30, .1);
    return r && { n: r.pts.length, len: Math.round(r.length), straight: r.straight, car: r.car, chevrons: w.scene.getObjectByName("Route chevrons").count }; });
  check("map", map.open && way && way.n > 2 && !way.straight && !way.car && way.chevrons > 5, JSON.stringify({ map, way }));
  await page.screenshot({ path: "test-results/shots/taxi-route.png" });

  // The Mausoleum's six inscriptions laid on their boards (src/inscriptions.js).
  const ins = await page.evaluate(() => { const out = []; window.__mufu.city.world.scene.traverse((o) => { if (/^Inscription /.test(o.name)) out.push(o.name.slice(12)); }); return out; });
  check("inscriptions", ins.length === 6, ins.join(", "));

  check("no page errors", errors.length === 0, JSON.stringify(errors.slice(0, 5)));
} finally {
  await browser.close();
}
if (fails.length) throw new Error("taxi failed: " + fails.join(", "));
console.log("taxi ok");
