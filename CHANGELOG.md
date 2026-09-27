# Change log

## 2026-09-27 — the morning, and a rebuilt renderer

Two commits on top of `1c40e2c`, the last verified production revision.

### 1. The pending river update

The working-tree snapshot recorded in the 27 September 2026 handoff, committed
as it stood: flowing river shading with sky reflection, glints and current
streaks; four cargo vessels with wakes and navigation lamps; a rotating
riverside beacon; circling birds; directional engine and horn sound; and the
focused viewing mode. It had been tested locally but never committed, so it
went in first, on its own, before anything else touched those files.

### 2. Immersion and visuals

**A memory layer.** Twenty photographs from the walk of 26 September 2026,
06:16 to 08:26, now stand beside the path as lit frames, in the order they were
taken. `src/memories.js` draws each one as a halo first and a photograph second;
`Walk the morning` follows them in sequence and moves the sky from first light
towards mid-morning as it goes. A frame strip on the right jumps to any of them.
Captions, times and placements live in `public/memories/memories.json`.

**A real post-processing chain.** `src/postfx.js` adds sun shafts and depth
ambient occlusion, bloom, AgX tone mapping and a per-weather grade with
vignette, grain and corner aberration, in three quality tiers that the site
picks between and can step down from. Sun shadows follow the walker in a 140 m
frustum snapped to the shadow-map grid.

**A new sky.** `src/sky.js` replaces the old dome: sun disc and limb glow, two
parallaxed cloud decks lit from the sun's side, stars and a moon at first light,
and a haze band at the horizon. A fifth mood, `06:16 · First light`, matches the
hour the walk actually began.

**Things at eye level.** `src/life.js` scatters grass along the routes, pollen in
the light and leaves coming down. `src/camera-feel.js` gives the camera a
footfall bob, a lean into strafing, breathing at rest and a field of view that
opens when you run; footsteps now fire on the walk cycle rather than a timer.

### Worth knowing before the next change

- **Nothing private was published.** The twenty images are resized copies
  rewritten pixel-by-pixel; no EXIF, GPS, camera model or timestamp survives in
  the files, and `tests/memories.test.js` fails if one ever does. The 153
  full-resolution originals and the research package were not touched and are
  not in this repository.
- **The frames are not placed by GPS.** They are spaced along the modelled
  routes in chronological order. That is an authored arrangement, not a survey,
  and the app says so in its Help panel and in `memories.json`.
- **The composer's buffer roles are pinned on purpose.** `RenderPass` writes
  into the composer's *read* buffer and does not swap, so the depth texture must
  live on that target and only that one. Attaching it to both is a framebuffer
  feedback loop; moving it to the other target renders the scene without depth.
  See the comment in `src/postfx.js` before changing the pass order.
- **Shadow cost was the thing that crashed the GPU.** An early version let the
  detailed near-tree crowns cast, which pushed roughly two million triangles
  through the shadow map each frame and lost the WebGL context on an Intel Iris
  Xe. They are stood in for by forty-triangle proxies drawn with no colour or
  depth writes. Do not re-enable `castShadow` on `nearTrees`.
- **Memory textures are evicted.** Twenty 1600 px photographs will not fit in an
  integrated GPU at once, so a frame more than 260 m away gives its texture back.
- **Still unverified.** Frame rates on other GPUs and browsers; how the tier
  auto-detection behaves on mobile. Everything below was checked on one Windows
  laptop with an Intel Iris Xe, and in headless Chrome under SwiftShader.

### Verified

`npm test` — 12 passing. `npm run build` — clean, with the pre-existing
three.js chunk-size warning. Against the production build on
`127.0.0.1:4173`: `tests/river-browser.mjs` reported four moving vessels, a
rotating beacon and no console errors; `tests/memory-browser.mjs` reported the
twenty-frame strip, a photograph loading and opening at 07:13 as the walker
reached it, the walk recorded, and the guided morning walk advancing at first
light with no console errors.
