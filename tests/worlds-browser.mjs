// Browser check for the Blender-built landmark worlds (public/scenes/*): each loads without
// errors; every spawn, seat, gate, bell and dock stands on walkable ground; a gate glide lands
// on its target; the Qinhuai boat ride sails and brings the visitor back. Time is driven with
// __mufu.step, never the wall clock.
//
//   npx vite preview --port 4190 &   (or point MUFU_TEST_URL at a server)
//   node tests/worlds-browser.mjs
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const PINS = [['zhongshan', 'zhongshan'], ['jiming', 'north'], ['qinhuai', 'oldsouth']];
const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
const errors = [], report = {};
await fs.mkdir('test-results', {recursive: true});
try {
  const page = await browser.newPage({viewport: {width: 1100, height: 760}});
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await page.addInitScript(() => localStorage.setItem('mufu-quality', 'smooth'));
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_CERT|PointerLock|pointer lock/i.test(m.text())) errors.push(m.text()); });
  await page.goto(process.env.MUFU_TEST_URL || 'http://127.0.0.1:4190', {waitUntil: 'domcontentloaded', timeout: 120000});
  await page.waitForFunction(() => window.__mufu?.city?.active, null, {timeout: 180000});
  await page.evaluate(() => { window.__mufu.paused = true; });

  for (const [pin, id] of PINS) {
    await page.evaluate(p => window.__mufu.city.enter(p), pin);
    await page.waitForFunction(w => window.__mufu.city.world?.id === w, id, {timeout: 240000});
    const r = await page.evaluate(() => {
      const m = window.__mufu, w = m.city.world, meta = w.meta, bad = [];
      const onGround = (kind, name, p) => { const h = w.ground(p[0], p[2]); if (h === null || Math.abs(h - p[1]) > 2.5) bad.push(`${kind} ${name} ${h}`); };
      for (const [k, s] of Object.entries(meta.spawns)) onGround('spawn', k, s.position);
      for (const s of w.seats) onGround('seat', s.id, s.position);
      (meta.gates || []).forEach((g, i) => onGround('gate', `${i}->${g.target}`, g.position));
      for (const [k, b] of Object.entries(meta.bells || {})) onGround('bell', k, b.position);
      for (const [k, d] of Object.entries(meta.docks || {})) { const h = w.ground(d.position[0], d.position[2] + 2); if (h === null) bad.push(`dock ${k}`); }
      // Glide through the first gate and check the landing is on its target's ground.
      let glide = null;
      if (meta.gates?.length) {
        const g = meta.gates[0];
        w.placeAt({feet: [g.position[0], g.position[1], g.position[2] + .5], look: [g.position[0], 0, g.position[2] - 10]});
        m.step(2, .05); m.city.interact();
        const started = w.gliding;
        m.step(600, .05);
        const t = w.spawn(g.target).feet;
        glide = {started, landed: !w.gliding, miss: +Math.hypot(w.body.x - t[0], w.body.z - t[2]).toFixed(2), onGround: w.ground(w.body.x, w.body.z) !== null};
      }
      return {stats: w.stats(), bad, glide};
    });
    report[id] = r;
    assert.deepEqual(r.bad, [], `${id}: markers off the walkable ground`);
    if (r.glide) { assert.ok(r.glide.started && r.glide.landed && r.glide.onGround, `${id}: gate glide`); assert.ok(r.glide.miss < 3); }
    await page.evaluate(() => window.__mufu.step(4, .05));
    await page.screenshot({path: `test-results/world-${id}.png`}).catch(() => {});
  }

  // The Qinhuai boat ride: board at the dock, sail out and back, step ashore at the dock.
  report.boat = await page.evaluate(() => {
    const m = window.__mufu, w = m.city.world, d = Object.values(w.meta.docks)[0];
    w.placeAt({feet: [d.position[0], w.ground(d.position[0], d.position[2] + 2) ?? d.position[1], d.position[2] + 2], look: [d.position[0], 0, d.position[2] + 20]});
    m.step(2, .05); m.city.interact();
    const aboard = w.riding;
    m.step(400, .05);
    const sailed = Math.hypot(w.body.x - d.position[0], w.body.z - d.position[2]);
    m.step(12000, .05);
    return {aboard, sailed: +sailed.toFixed(1), back: !w.riding, music: m.city.stats().world.music};
  });
  assert.ok(report.boat.aboard && report.boat.sailed > 20 && report.boat.back, 'boat ride');
  assert.deepEqual(errors, []);
  console.log('worlds ok', JSON.stringify(report, null, 1));
} finally {
  await fs.writeFile('test-results/worlds-report.json', JSON.stringify({report, errors}, null, 2));
  await browser.close();
}
