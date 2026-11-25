// Xuanwu Lake in the city (item 38; design/XUANWU-PLAN.md), its audits in the browser:
//   walk      each island is reachable on foot from Xuanwu Gate, Jiefang Gate and the east gate
//             (Cuizhou's entrance), and a walk through Xuanwu Gate's arch from the street gets there
//   bridges   every park bridge over the lake is walkable end to end (no gap over 4 m)
//   entrances each OSM entrance point stands on walkable ground (within 8 m)
//   life      the name boards stand (gates, islands, island landmarks), and the carp swim (not in winter)
//   landmarks the island landmarks stand at their heights, the mound rises, the temple's stair is walkable
// Shots to test-results/shots/xuanwu-*.png. Time is driven with __mufu.step.
//
//   MUFU_TEST_URL=http://localhost:4191/ node tests/xuanwu-browser.mjs
import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { installJourney } from "./journey-kit.mjs";

const feats = JSON.parse(await fs.readFile("research/core/data/features.json", "utf8"));
const entrances = JSON.parse(await fs.readFile("research/xuanwu/osm-entrances.json", "utf8")).elements;
// The core frame (research/core/data/terrain.json origin): metres east and north of Xinjiekou.
const P = (lat, lon) => [(lon - 118.7838) * 111320 * Math.cos(32.0418 * Math.PI / 180), (lat - 32.0418) * 110574];
const inside = (x, y, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
const ISLANDS = { Huanzhou: [447, 3616], Yingzhou: [474, 3568], Liangzhou: [544, 4086], Cuizhou: [1003, 4007], Lingzhou: [916, 3132] };
// The lake ring: the water polygon holding the islands; its foot bridges as blender/core_xuanwu.py picks them.
const ring = feats.water.map((w) => w.pts).filter((p) => p.length > 20 && inside(447, 3616, p)).sort((a, b) => b.length - a.length)[0];
const bridges = feats.bridges.filter((b) => ["footway", "path", "pedestrian", "cycleway", "service"].includes(b.tags.highway) && b.tags.bridge !== "boardwalk"
  && b.pts.length > 1 && b.pts.some(([x, y]) => inside(x, y, ring)));
// Gates, on their lake side; and one step outside Xuanwu Gate, in the street.
const GATES = { "Xuanwu Gate": [-100, 3410], "Jiefang Gate": [752, 2522], "Cuizhou gate": P(32.0773557, 118.7987486) };
const STREET = [-185, 3405];

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
  await page.waitForFunction(() => window.__mufu.city.world?.id === "core", null, { timeout: 600000 });
  await installJourney(page);

  // --- walk: every island from every gate ------------------------------------------------------------
  const walk = await page.evaluate(([gates, isl]) => {
    const { route, nearest, g } = window.__journey;
    const spot = ([x, n], r = 40) => nearest(x, -n, r);
    const out = [];
    for (const [gn, gp] of Object.entries(gates)) {
      const from = spot(gp, 30);
      for (const [iname, ip] of Object.entries(isl)) {
        const to = spot(ip, 60);
        const r = from && to ? route(from, to, "walk", 2) : { path: null };
        out.push([gn, iname, !!from, !!to, r.path ? r.path.length * 2 : null, r.closest ? Math.round(r.closest[2]) : null]);
      }
    }
    return out;
  }, [GATES, ISLANDS]);
  const reached = walk.filter((r) => r[4] !== null);
  check("walk", reached.length === walk.length, `${reached.length} of ${walk.length} gate-to-island routes on foot`
    + walk.filter((r) => r[4] === null).map((r) => `\n       ${r[0]} -> ${r[1]}: ${!r[2] ? "gate not walkable" : !r[3] ? "island not walkable" : `no route, closest ${r[5]} m`}`).join(""));

  // Through Xuanwu Gate's arch from the street to Huanzhou, with the real controls.
  const leg = await page.evaluate(([street, hz]) => {
    const { route, drive, nearest, w, g } = window.__journey;
    const from = nearest(street[0], -street[1], 20), to = nearest(hz[0], -hz[1], 60);
    if (!from || !to) return { err: "no ground", from, to };
    w.placeAt({ feet: [from[0], g.height(from[0], from[1]), from[1]], look: [from[0] + 20, 10, from[1]] });
    window.__mufu.step(4, 0.05);
    const r = route(from, to, "walk", 2);
    if (!r.path) return { err: "no route", closest: r.closest };
    return { ...drive(r.path, "walk", 9000), metres: r.path.length * 2 };
  }, [STREET, ISLANDS.Huanzhou]);
  check("through the gate", !!leg.done, JSON.stringify(leg));
  await page.screenshot({ path: "test-results/shots/xuanwu-huanzhou-arrived.png" });

  // --- bridges -------------------------------------------------------------------------------------
  const deck = await page.evaluate((bs) => {
    const g = window.__journey.g;
    return bs.map(({ id, pts }) => {
      let n = 0, holes = 0, run = 0, worst = 0;
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, ay] = pts[k], [bx, by] = pts[k + 1], L = Math.hypot(bx - ax, by - ay);
        for (let u = 0; u <= L; u += 2) {
          const h = g.height(ax + (bx - ax) * u / L, -(ay + (by - ay) * u / L));
          n++;
          if (h === null) { holes++; run += 2; worst = Math.max(worst, run); } else run = 0;
        }
      }
      return [id, n, holes, worst];
    });
  }, bridges.map((b) => ({ id: b.id, pts: b.pts })));
  const broken = deck.filter((d) => d[3] > 4);
  check("bridges", broken.length === 0, `${deck.length - broken.length} of ${deck.length} park bridges walkable end to end`
    + broken.map((d) => `\n       way ${d[0]}: ${d[2]} of ${d[1]} samples off the deck, a gap of ${d[3]} m`).join(""));

  // --- entrances -----------------------------------------------------------------------------------
  const ents = await page.evaluate((pts) => pts.map(([id, x, n]) => [id, !!window.__journey.nearest(x, -n, 8)]),
    entrances.map((e) => [e.id, ...P(e.lat, e.lon)]));
  const off = ents.filter((e) => !e[1]);
  check("entrances", off.length === 0, `${ents.length - off.length} of ${ents.length} OSM entrance points on walkable ground` + (off.length ? `; not: ${off.map((e) => e[0]).join(", ")}` : ""));

  // --- life ----------------------------------------------------------------------------------------
  const life = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, xw = w.xuanwu;
    if (!xw) return null;
    m.step(20, 0.05);
    let fish = false;
    w.scene.traverse((o) => { if (o.isInstancedMesh && o.parent?.name === "Xuanwu life") fish = o.visible; });
    return { boards: xw.boards.map((b) => b.en), fish };
  });
  check("life", life && life.boards.length === 10 && life.fish, JSON.stringify(life));

  // The island landmarks (blender/core_xuanwu.py). The export joins each collection into one mesh,
  // so they are found by their geometry among the meshes under Buildings: how high it stands over its own foot at each
  // site. The temple's hall on its terrace, the pagoda about its 18 m, Lansheng's two storeys; the
  // mound rises over its ground and can be walked to its top; the temple's stair climbs from the
  // path (0.3 m up) to the terrace in steps the walker can take (build 15's shorter stair rose 1.1 m in one cell).
  const marks = await page.evaluate(() => { const w = window.__mufu.city.world, g = w.grid;
    const SITES = { temple: [593, 3712, 7], pagoda: [617, 3703, 3], lansheng: [525, 4238, 5] }, out = {};
    for (const k in SITES) out[k] = [Infinity, -Infinity];
    const v = new (w.scene.position.constructor)();
    w.scene.traverse((o) => { if (!o.isMesh || o.isInstancedMesh || o.parent?.name !== "Buildings") return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
        for (const k in SITES) { const [x, n, r] = SITES[k]; if (Math.hypot(v.x - x, v.z + n) < r) { out[k][0] = Math.min(out[k][0], v.y); out[k][1] = Math.max(out[k][1], v.y); } } } });
    for (const k in SITES) out[k] = out[k][1] - out[k][0];
    // The mound's top beside its pavilion (the pavilion's roof fills the centre cell, and the walker
    // goes round it), and the ground in a ring 13 m out (just past its 11 m radius).
    out.mound = [Math.max(...[[3, 0], [-3, 0], [0, 3], [0, -3]].map(([dx, dn]) => g.height(214 + dx, -3573 - dn) ?? -Infinity)), ...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => g.height(214 + 13 * Math.cos(k * Math.PI / 4), -3573 - 13 * Math.sin(k * Math.PI / 4)))];
    // Up the path north to the stair and onto the terrace, a metre at a time.
    const steps = []; for (let n = 3686; n <= 3702; n++) steps.push(g.height(591, -n));
    out.stair = steps;
    out.stepUp = g.stepUp(591, -3696);
    return out; });
  const ringed = marks.mound.slice(1).filter((v) => v != null), rise = marks.mound[0] != null && ringed.length ? marks.mound[0] - Math.max(...ringed) : null;
  const st = marks.stair.filter((v) => v != null), climb = st.length ? st.at(-1) - st[0] : 0, worst = Math.max(...st.slice(1).map((v, i) => Math.abs(v - st[i])));
  check("landmarks", marks.temple > 6 && marks.temple < 14 && marks.pagoda > 15 && marks.pagoda < 22 && marks.lansheng > 8 && marks.lansheng < 16
      && rise > 2 && rise < 3.5 && st.length === marks.stair.length && climb > 1.2 && worst <= marks.stepUp + .01,
    `temple ${marks.temple.toFixed(1)} m, pagoda ${marks.pagoda.toFixed(1)} m, Lansheng ${marks.lansheng.toFixed(1)} m over their feet; mound ${rise?.toFixed(2)} m over the highest ground round it, walkable at its top: ${marks.mound[0] > 0}; `
    + `the stair climbs ${climb.toFixed(2)} m in ${st.length} of ${marks.stair.length} walkable metres, worst step ${worst.toFixed(2)} m (limit ${marks.stepUp})`);

  // --- shots ---------------------------------------------------------------------------------------
  // [name, eye, target]: x, height above the ground, y (metres north).
  const cams = [
    ["xuanwu-gate-street", [-230, 1.8, 3400], [-134, 9, 3410]],
    ["xuanwu-gate-lake", [-40, 1.8, 3440], [-134, 10, 3410]],
    ["xuanwu-lotus-wall", [660, 2, 2960], [752, 8, 2522]],
    ["xuanwu-huanzhou", [330, 3, 3500], [447, 2, 3616]],
    ["xuanwu-lingzhou-mountain", [880, 1.8, 3120], [3200, 120, 3300]],
    ["xuanwu-aerial", [-200, 220, 2700], [650, 0, 3600]],
    ["xuanwu-top", [500, 1500, 3000], [500, 0, 3300]],
  ];
  for (const [name, e, t] of cams) {
    // The walker first, to the walkable ground nearest the eye: the trees' detail follows the
    // walker, and from a camera put down far from it the near trees showed as far silhouettes.
    await page.evaluate(([e, t]) => {
      const m = window.__mufu, { w, g, nearest } = window.__journey;
      const f = nearest(e[0], -e[2], 120) || nearest(t[0], -t[2], 120);
      // Heights are above the ground (the nearest walkable): the lake's banks stand 8-9 m up.
      const base = (x, n) => { const q = nearest(x, -n, 120); return q ? g.height(q[0], q[1]) : 7; };
      const ey = base(e[0], e[2]) + e[1], ty = base(t[0], t[2]) + t[1];
      if (f) { w.placeAt({ feet: [f[0], g.height(f[0], f[1]), f[1]], look: [t[0], ty, -t[2]] }); m.step(12, 0.05); }
      m.camera.position.set(e[0], ey, -e[2]); m.camera.lookAt(t[0], ty, -t[2]); m.camera.updateMatrixWorld(); m.renderer.render(m.city.world.scene, m.camera);
    }, [e, t]);
    await page.screenshot({ path: `test-results/shots/${name}.png` });
  }
  assert.deepEqual(errors, []);
  if (fails.length) throw new Error("xuanwu failed: " + fails.join(", "));
  console.log("xuanwu ok");
} finally {
  await browser.close();
}
