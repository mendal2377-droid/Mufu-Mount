// Shared by the film tools: open the app on the GPU, take it out of play mode, and give the page a
// small "director" API so a script can set any camera, weather and grade deterministically and read
// back a finished frame. Nothing here changes how the site behaves for a visitor.
import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';

export async function openApp({width = 1920, height = 1080, url = 'http://127.0.0.1:5178'} = {}) {
  const browser = await chromium.launch({channel: 'chrome', headless: true,
    args: ['--use-angle=d3d11', '--enable-gpu-rasterization', '--ignore-gpu-blocklist', '--enable-webgl']});
  const page = await browser.newPage({viewport: {width, height}, deviceScaleFactor: 1});
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({status: 200, contentType: 'text/css', body: ''}));
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await page.goto(url, {waitUntil: 'domcontentloaded', timeout: 180000});
  await page.waitForFunction(() => window.__mufu?.state?.ready, null, {timeout: 400000});
  await page.evaluate(() => {
    const m = window.__mufu, THREE_V = m.camera.position.constructor;
    m.paused = true;
    // The app opens on the Nanjing atlas; the film is shot on the Mufu mountain, so step out of the city.
    if (m.city?.active) m.city.leave();
    // The mountain's photograph frames are private memories, not part of the film.
    m.scene.traverse(o => { if (o.name === 'Memories') o.visible = false; });
    // Walk mode with nobody at the keys: the app renders the scene and leaves the camera alone.
    m.state.playing = true; m.state.overview = false; m.state.tour = false; m.state.flying = false;
    document.body.classList.add('playing');
    for (const id of ['#welcome', '#hud', '#plan-home', '#nanjing-home']) { const e = document.querySelector(id); if (e) e.hidden = true; }
    // The frame hook the director uses (see main.js): sets the grade just before the final pass.
    const d = window.__director = {fade: 0, flash: 0, letterbox: 0, lift: 0, saturation: null, contrast: null, exposure: null, fov: 62, hook: null};
    window.film = {
      d,
      route: i => m.routes[i],
      /** Position along route `i` at distance fraction f, with y from the route. */
      at(i, f, height = 1.9) {
        const pts = m.routes[i].points; let total = 0; const L = [0];
        for (let k = 1; k < pts.length; k++) { total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][2] - pts[k - 1][2]); L.push(total); }
        const s = Math.min(Math.max(f, 0), .9999) * total; let lo = 0, hi = L.length - 1;
        while (lo + 1 < hi) { const mid = (lo + hi) >> 1; if (L[mid] <= s) lo = mid; else hi = mid; }
        const a = pts[lo], b = pts[Math.min(lo + 1, pts.length - 1)], g = (s - L[lo]) / ((L[lo + 1] - L[lo]) || 1);
        return [a[0] + (b[0] - a[0]) * g, a[1] + (b[1] - a[1]) * g + height, a[2] + (b[2] - a[2]) * g];
      },
      lengths: () => m.routes.map(r => { let t = 0; for (let k = 1; k < r.points.length; k++) t += Math.hypot(r.points[k][0] - r.points[k - 1][0], r.points[k][2] - r.points[k - 1][2]); return Math.round(t); }),
      /** Snap the weather instead of letting it blend, then settle the grade, fog and sun. */
      weather(name, settle = true) {
        m.setWeather(name); this.current = name;
        for (const k of ['dawn', 'sunset', 'storm', 'snow']) { m.weather[k] = name === k ? 1 : 0; }
        if (settle) m.step(40, 1 / 12);
      },
      pose(pos, look, {fov = 62, roll = 0} = {}) {
        m.camera.position.set(pos[0], pos[1], pos[2]);
        m.camera.lookAt(look[0], look[1], look[2]);
        if (roll) m.camera.rotateZ(roll);
        d.fov = fov;
      },
      lengthOf(i) { let t = 0; const p = m.routes[i].points; for (let k = 1; k < p.length; k++) t += Math.hypot(p[k][0] - p[k - 1][0], p[k][2] - p[k - 1][2]); return t; },
      /**
       * One frame of one shot: camera (route or air), weather changes, fades, flashes, lightning. `k` is the
       * frame number within the shot; `shot` is a storyboard entry plus `frames`, `seconds`, `index`.
       */
      shotFrame(shot, k, fps) {
        const u = shot.frames > 1 ? k / (shot.frames - 1) : 0, T = k / fps, i = shot.index;
        const sm = x => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
        const e = shot.ease === 'linear' ? u : sm(u);
        const lerp = (r, x) => r[0] + (r[1] - r[0]) * x;
        if (k === 0) this.weather(shot.weather);
        for (const c of shot.changes || []) if (T >= c.at && !c._done) { c._done = true; this.weather(c.weather); }
        // Handheld: slow drifts on yaw, pitch and roll, and the soft bob of a body walking.
        const sw = shot.sway ?? 1, n = (f, ph) => Math.sin(T * f + i * 1.7 + ph);
        const dyaw = sw * (.011 * n(.9, 0) + .006 * n(2.3, 1)), dpitch = sw * (.006 * n(1.1, 2) + .003 * n(3.1, 0)), roll = sw * .004 * n(.7, 3);
        const bob = shot.kind === 'walk' ? sw * .035 * Math.sin(T * (shot.montage ? 9.5 : 6.2)) : 0;
        let pos, look;
        if (shot.kind === 'air') {
          const mix = (a, b) => [0, 1, 2].map(j => a[j] + (b[j] - a[j]) * e);
          pos = mix(shot.from, shot.to); look = mix(shot.look, shot.lookTo || shot.look);
        } else {
          const len = this.lengthOf(shot.route), h = lerp(shot.height, e), f = lerp(shot.f, e);
          pos = this.at(shot.route, f, h);
          const q = this.at(shot.route, Math.min(.9999, f + (shot.ahead || 14) / len), h);
          if (shot.lookAt) look = shot.lookAt;
          else {
            const dx = q[0] - pos[0], dz = q[2] - pos[2], run = Math.hypot(dx, dz) || 1;
            const heading = Math.atan2(dx, dz) + lerp(shot.yaw, e), pitch = Math.atan2(q[1] - pos[1], run) * .6 + lerp(shot.pitch, e);
            look = [pos[0] + Math.sin(heading) * 30, pos[1] + Math.tan(pitch) * 30, pos[2] + Math.cos(heading) * 30];
          }
        }
        pos[1] += bob;
        // Apply the drifts as small rotations of the look direction.
        const vx = look[0] - pos[0], vy = look[1] - pos[1], vz = look[2] - pos[2], dist = Math.hypot(vx, vy, vz) || 1;
        const hd = Math.atan2(vx, vz) + dyaw, pt = Math.asin(vy / dist) + dpitch;
        const L = [pos[0] + Math.sin(hd) * Math.cos(pt) * dist, pos[1] + Math.sin(pt) * dist, pos[2] + Math.cos(hd) * Math.cos(pt) * dist];
        // Grade: letterbox always; fades and flashes by the clock.
        d.letterbox = 1;
        d.lift = {storm: .075, dawn: .015}[this.current] || 0;      // the rain should be dark, not black
        d.fade = shot.fadeIn ? 1 - sm(T / shot.fadeIn) : 0;
        let flash = 0;
        if (shot.flashIn) { const fr = [1, .75, .5, .3, .15, .06][k]; if (fr) flash = Math.max(flash, fr * (shot.montage ? .85 : 1)); }
        for (const lt of shot.lightning || []) { const a = T - lt; if (a >= 0 && a < .3) flash = Math.max(flash, (a < .06 ? 1 : Math.exp(-(a - .06) * 14)) * .6); }
        for (const c of shot.changes || []) if (c.flash) { const a = T - c.at; if (a >= 0 && a < .35) flash = Math.max(flash, Math.exp(-a * 9)); }
        if (shot.fadeToWhite) flash = Math.max(flash, sm((T - (shot.seconds - shot.fadeToWhite)) / shot.fadeToWhite));
        d.flash = flash;
        return this.frame(1 / fps, {pos, look: L, fov: lerp(shot.fov, e), roll});
      },
      /** Render one frame of simulated time and return it as JPEG base64. */
      frame(dt, pose) {
        if (pose) this.pose(pose.pos, pose.look, pose);
        // The atlas view leaves the near plane at ~100 m, which would slice off everything near the lens.
        m.camera.near = .1; m.camera.far = 20000; m.camera.zoom = 1;
        m.camera.fov = d.fov; m.camera.updateProjectionMatrix();
        m.step(1, dt);
        return m.renderer.domElement.toDataURL('image/jpeg', .93).slice(23);
      },
    };
    void THREE_V;
  });
  return {browser, page};
}

export async function saveJpeg(dir, index, b64) {
  await fs.writeFile(`${dir}/${String(index).padStart(5, '0')}.jpg`, Buffer.from(b64, 'base64'));
}
