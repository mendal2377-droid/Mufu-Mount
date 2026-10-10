// Render the film's frames: node tools/film/render.mjs [--preview] [--from=N] [--to=N]
// Frames go to film-out/frames/NNNNN.jpg at 48 fps; assemble.py blends them to 24 for motion blur.
import fs from 'node:fs/promises';
import {openApp} from './lib.mjs';
import {timeline, FPS, TOTAL_SECONDS} from './storyboard.mjs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const preview = !!args.preview;
const shots = timeline();
const total = shots.reduce((n, s) => n + s.frames, 0);
console.log(`${shots.length} shots, ${TOTAL_SECONDS.toFixed(1)} s, ${total} frames at ${FPS} fps`);
await fs.writeFile('film-out/timeline.json', JSON.stringify({fps: FPS, total, shots: shots.map(({id, index, start, seconds, frames, frame0, weather, kind, montage, changes, lightning, label}) =>
  ({id, index, start, seconds, frames, frame0, weather, kind, montage: !!montage, changes, lightning, label}))}, null, 1));

const dir = preview ? 'film-out/preview' : 'film-out/frames';
await fs.mkdir(dir, {recursive: true});
const {browser, page} = await openApp({width: preview ? 960 : 1920, height: preview ? 540 : 1080});
const from = +(args.from ?? 0), to = +(args.to ?? total - 1);
const started = Date.now();
let done = 0;
for (const shot of shots) {
  if (shot.frame0 + shot.frames - 1 < from || shot.frame0 > to) continue;
  const spec = JSON.parse(JSON.stringify(shot));
  const ks = preview ? [Math.round(shot.frames * .08), Math.round(shot.frames * .5), Math.round(shot.frames * .92)].filter((k, i, a) => a.indexOf(k) === i) : [...Array(shot.frames).keys()];
  // Start of shot: snap weather, then every frame in order (the weather settle and time must run in sequence).
  for (const k of (preview ? [0, ...ks] : ks)) {
    const index = shot.frame0 + k, file = `${dir}/${preview ? `${String(shot.index).padStart(2, '0')}-${k}` : String(index).padStart(5, '0')}.jpg`;
    if (!preview && (index < from || index > to)) { await page.evaluate(({spec, k, fps}) => { window.film.shotFrame(spec, k, fps); }, {spec, k, fps: FPS}); continue; }
    const b64 = await page.evaluate(({spec, k, fps}) => window.film.shotFrame(spec, k, fps), {spec, k, fps: FPS});
    if (preview && k === 0) continue;
    await fs.writeFile(file, Buffer.from(b64, 'base64'));
    done++;
    if (!preview && done % 100 === 0) console.log(`${done} frames, ${((Date.now() - started) / 1000).toFixed(0)} s, shot ${shot.index} ${shot.id}`);
  }
}
console.log(`done: ${done} frames in ${((Date.now() - started) / 1000).toFixed(0)} s`);
await browser.close();
