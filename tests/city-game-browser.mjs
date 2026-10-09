// Browser check for the explorable-city layer: the drop-in arrival, arrivals that
// face the road, lanterns -> facts -> seal, the passport, the Wind Run and the
// baked street network. Time is driven with __mufu.step, never the wall clock.
//
//   npm run build && npx vite preview --port 4184 &   (or point MUFU_TEST_URL at a server)
//   node tests/city-game-browser.mjs
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {surfaceClearance} from './surface-clearance.mjs';

const browser = await chromium.launch({channel: 'chrome', headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist']});
const errors = [], report = {};
await fs.mkdir('test-results', {recursive: true});
try {
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  await page.addInitScript(() => localStorage.setItem('mufu-quality', 'smooth'));
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_CERT|PointerLock|pointer lock/i.test(m.text())) errors.push(m.text()); });
  await page.goto(process.env.MUFU_TEST_URL || 'http://127.0.0.1:4184', {waitUntil: 'domcontentloaded', timeout: 120000});
  await page.waitForFunction(() => window.__mufu?.city?.active, null, {timeout: 180000});
  await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.step(2, .1); });

  // The shipped roads file must be in use, not recomputed on every load.
  const network = await page.evaluate(() => window.__mufu.city.network);
  report.network = network;
  assert.equal(network.source, 'baked', 'roads.json is stale: run node tools/research/build-roads.mjs');
  assert.ok(network.roads >= 8);

  // Every arrival: on the ground, facing along the road rather than at the scenery beside it.
  report.arrivals = await page.evaluate(() => {
    const m = window.__mufu, out = [];
    // Mountains are viewed from a ridge on purpose, so the road-facing rule is for the rest.
    for (const p of m.city.places.filter(q => q.kind !== 'mount')) {
      m.city.enter(p.id); m.step(3, .1);
      const cam = m.camera, dir = cam.getWorldDirection(cam.position.clone());
      const route = m.city.routes[p.route];
      let best = 0, bd = Infinity;
      route.points.forEach((q, i) => { const d = Math.hypot(q[0] - cam.position.x, q[2] - cam.position.z); if (d < bd) { bd = d; best = i; } });
      const ahead = route.points[Math.min(route.points.length - 1, best + 12)], behind = route.points[Math.max(0, best - 12)];
      let tx = ahead[0] - behind[0], tz = ahead[2] - behind[2];
      const len = Math.hypot(tx, tz) || 1; tx /= len; tz /= len;
      const h = Math.hypot(dir.x, dir.z) || 1;
      const angle = Math.acos(Math.max(-1, Math.min(1, (dir.x * tx + dir.z * tz) / h))) * 180 / Math.PI;
      out.push({id: p.id, angle: Math.min(angle, 180 - angle) /* either way along the road */, offRoad: bd, pitch: Math.asin(dir.y) * 180 / Math.PI,
        clearance: cam.position.y - m.city.ground(cam.position.x, cam.position.z)});
    }
    return out;
  });
  for (const a of report.arrivals) {
    assert.ok(a.clearance > 1.5, `${a.id} starts underground`);
    assert.ok(a.pitch > -12 && a.pitch < 20, `${a.id} looks at the ground or sky (${a.pitch.toFixed(1)} deg)`);
  }
  // The camera must not start inside or against any model. Lantern boats once sat on Mendong's
  // spawn point and put the lens inside a bronze canopy: a screen of solid gold, found by eye.
  report.surfaceClearance = await page.evaluate(surfaceClearance);
  for (const s of report.surfaceClearance) assert.ok(s.nearest > .45, `${s.id}: the camera starts ${s.nearest.toFixed(2)} m from ${s.where}`);
  const wellAimed = report.arrivals.filter(a => a.angle <= 35).length;
  assert.ok(wellAimed >= report.arrivals.length - 3, `only ${wellAimed}/${report.arrivals.length} arrivals face the road`);

  // The drop-in ends exactly at the spawn, and a key press ends it early.
  const drop = await page.evaluate(() => {
    const m = window.__mufu, p = m.city.places.find(q => q.id === 'palace');
    m.city.enter('palace', {drop: true}); m.step(2, .1);
    const mid = m.camera.position.y - p.spawn[1];
    m.step(60, .1);
    const end = m.camera.position.toArray();
    return {mid, gap: Math.hypot(end[0] - p.spawn[0], end[1] - p.spawn[1], end[2] - p.spawn[2])};
  });
  assert.ok(drop.mid > 5, 'the drop-in starts high above the avenue');
  assert.ok(drop.gap < .6, `drop-in ended ${drop.gap} m from the spawn`);

  // Switching places from inside a walk: no trip back to the atlas.
  const places = await page.evaluate(() => {
    const m = window.__mufu;
    m.city.enter('palace'); m.step(2, .1);
    const visible = !document.querySelector('#walk-places').hidden;
    document.body.dispatchEvent(new KeyboardEvent('keydown', {code: 'KeyG', key: 'g', bubbles: true}));
    const open = document.querySelector('#city-places').open;
    const cards = [...document.querySelectorAll('.place-card')].map(c => c.dataset.id);
    const nearest = cards[1];
    document.querySelector(`.place-card[data-id="${nearest}"]`).click();
    m.step(60, .1);
    const moved = m.city.selected.id, closed = !document.querySelector('#city-places').open, stillWalking = m.city.active && !m.state.overview;
    document.body.dispatchEvent(new KeyboardEvent('keydown', {code: 'BracketRight', key: ']', bubbles: true}));
    m.step(60, .1);
    return {visible, open, cards: cards.length, first: cards[0], nearest, moved, closed, stillWalking, hopped: m.city.selected.id};
  });
  report.places = places;
  assert.ok(places.visible, 'the Places button shows while walking');
  assert.ok(places.open && places.cards === 18, 'G opens a list of every destination');
  assert.equal(places.first, 'palace', 'the current place leads the list');
  assert.equal(places.moved, places.nearest, 'choosing a card enters that place');
  assert.ok(places.closed && places.stillWalking, 'and goes straight there, still walking');
  assert.notEqual(places.hopped, places.moved, ']' + ' hops to the next landmark');

  // Lanterns -> fact cards -> seal, then persistence across a reload.
  await page.evaluate(() => { localStorage.removeItem('mufu-city-game-v1'); });
  await page.reload({waitUntil: 'domcontentloaded', timeout: 240000});
  await page.waitForFunction(() => window.__mufu?.city?.active, null, {timeout: 180000});
  await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.step(2, .1); });
  const sealed = await page.evaluate(() => {
    const m = window.__mufu, v = m.city.gameView;
    m.city.enter('qinhuai'); m.step(2, .1);
    const mine = v.lanterns.filter(l => l.id === 'qinhuai');
    const cards = [];
    for (const l of mine) {
      m.camera.position.set(l.position[0], l.position[1], l.position[2]); m.step(2, .05);
      cards.push(document.querySelector('#fact-card')?.textContent?.trim().slice(0, 40));
    }
    return {lanterns: mine.length, cards, snap: v.game.snapshot()};
  });
  assert.equal(sealed.lanterns, 3);
  assert.ok(sealed.cards.every(Boolean), 'each lantern shows a fact card');
  assert.equal(sealed.snap.lanterns.qinhuai.length, 3);
  assert.ok(await page.evaluate(() => window.__mufu.city.gameView.game.stamped('qinhuai')), 'three lanterns earn the seal');
  await page.evaluate(() => window.__mufu.city.passport(true));
  assert.equal(await page.locator('#city-passport').evaluate(d => d.open), true);
  await page.screenshot({path: 'test-results/nanjing-passport.png'});
  await page.evaluate(() => window.__mufu.city.passport(false));
  await page.reload({waitUntil: 'domcontentloaded', timeout: 240000});
  await page.waitForFunction(() => window.__mufu?.city?.active, null, {timeout: 180000});
  assert.ok(await page.evaluate(() => window.__mufu.city.gameView.game.stamped('qinhuai')), 'progress survives a reload');

  // Wind Run: fly the course ring by ring.
  await page.evaluate(() => { window.__mufu.paused = true; window.__mufu.step(2, .1); });
  const run = await page.evaluate(() => {
    const m = window.__mufu, v = m.city.gameView;
    m.city.startWindRun(); m.step(30, .1);
    const rings = v.course.rings.length;
    for (const r of v.course.rings) {
      const f = r.facing;
      m.camera.position.set(r.position[0] - f[0] * 3, r.position[1], r.position[2] - f[1] * 3); m.step(1, .02);
      m.camera.position.set(r.position[0] + f[0] * 3, r.position[1], r.position[2] + f[1] * 3); m.step(1, .02);
    }
    return {rings, result: v.run.result, best: v.game.snapshot().run};
  });
  assert.equal(run.rings, 11);
  assert.ok(run.result, 'the run finished');

  report.errors = errors;
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('Arrivals, drop-in, lanterns, passport, persistence and Wind Run checks passed');
} finally {
  await fs.writeFile('test-results/city-game-browser.json', JSON.stringify(report, null, 2));
  await browser.close();
}
