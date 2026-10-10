// Location scouting: a contact sheet of every route at a few distances, in one weather.
import {openApp, saveJpeg} from './lib.mjs';
import fs from 'node:fs/promises';
const weather = process.argv[2] || 'morning';
const {browser, page} = await openApp({width: 960, height: 540});
const info = await page.evaluate(() => ({names: window.__mufu.routes.map(r => r.name), lengths: window.film.lengths()}));
console.log(JSON.stringify(info));
const dir = 'film-out/scout'; await fs.mkdir(dir, {recursive: true});
await page.evaluate(w => window.film.weather(w), weather);
let n = 0;
for (let r = 0; r < info.names.length; r++) for (const f of [.1, .3, .5, .7, .9]) {
  const b64 = await page.evaluate(({r, f}) => {
    const p = window.film.at(r, f, 1.9), q = window.film.at(r, Math.min(.999, f + .02), 1.9);
    return window.film.frame(1 / 24, {pos: p, look: [q[0], q[1], q[2]]});
  }, {r, f});
  await saveJpeg(dir, r * 10 + Math.round(f * 10), b64); n++;
}
console.log('frames', n);
await browser.close();
