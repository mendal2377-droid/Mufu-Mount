# Handoff

For whoever picks this up next. The README says what the thing *is* and how to
run it; this says how it is put together, which parts will bite you, what is
actually verified, and what is worth doing next.

Deployment: [mufu-mount.vercel.app](https://mufu-mount.vercel.app/).
Use `git log` for the current revision.

**5 October 2026: illustrated Nanjing atlas.** Home now opens a separate city
scene with twenty map anchors and a central / whole-municipality selector.
`src/city-geography.js` projects public lon/lat into a compressed east/north map;
`src/city-scene.js` builds merged landmark silhouettes, lakes, river ribbons,
generic urban blocks, meadow plots, hills and trees. `src/nanjing.js` controls
map pins, destination walks, weather, ships and bird-kite travel. Toon bands,
paper grain, restrained contour lines and mixed rounded/pine trees follow the
user's illustration references. No illustration screenshot assets are copied.

The map database (`public/city/nanjing.json`) and raw OSM snapshots are ODbL 1.0.
Visible map attribution links to OSM and the public dataset. Sources, fetch /
preparation commands, inferred shores and neighborhood entries are documented in
[research/nanjing/SOURCES.md](research/nanjing/SOURCES.md). Buildings, streets,
river widths, bridge geometry, vegetation and terrain remain artistic.

Mufu is a portal to the original detailed scene, retaining its own coordinate
system, six entrances, photo frames and meadow/forest assets. Never stitch its
raw coordinates into the public city projection. `postfx.setScene` swaps only
the RenderPass scene; pinned composer buffers and depth rules are unchanged.
The camera and kite visual transfer between scenes. City walking uses its own
routes; city flight / landing never use the Mufu ground sampler or bounds.

Debug: `window.__mufu.city` exposes `showPlan('central'|'all')`, `enter(id)`,
`toggleFlight()`, `stats()`, scene / places / routes / ground. Existing
`__mufu.showPlan()` and `goTo()` deliberately enter the original Mufu experience.
City weather shares time uniforms; sun direction converts into atlas east/north.
The city sky shrinks for walking to stay inside the camera far plane. Map near
clip follows orbit distance to prevent river/ground depth fighting at atlas scales.

`tests/city.test.js` checks projection, source provenance and finite geometry.
`tests/city-browser.mjs` checks map anchors, five representative walking entries,
kite climb/landing, snow, whole-city view, mobile list and the Mufu portal.
The original immersion regression explicitly opens Mufu before its assertions.
Verification: 43 unit checks and production build pass. City browser checks
pass for projected anchors, terrain clearance on all routes, five walking
destinations, kite altitude / landing, snow, sound, municipal view and mobile
list navigation. Mufu regression passes for six entrances, quiet UI, photos,
weather, flight / landing and touch controls, with no browser errors.
Hardware / physical-phone performance remains unbenchmarked.

**4 October 2026: lower-ground meadow planting.** `src/meadow.js` scatters
seeded loose patches beside low routes and across the inland riverbank,
including its narrow grass verge. A spatial path mask excludes all route
corridors; a downward surface check accepts only woodland/grass/earth below
130 m with normal Y above .62. It rejects missing ground, water, paving,
stone armour and cliffs. These are artistic planting additions.

`public/vegetation/meadow-atlas-v1.png` is a generated RGBA 2×2 atlas:
mixed pink/blue/white flowers, yellow/white seed grass, low grass, riverbank
sedge. It preserves original alpha; supplied references are not redistributed.
Exact built-in imagegen prompt: `design/forest/MEADOW-PROMPT.md`.
Three curved intersecting patches give each clump depth. Grass/clover mottling
also enriches the ground material, and path-side grass uses the same atlas.

The near meadow uses 16 m spatial buckets, cached surface samples (at most
100 new raycasts per update), a 60 m grass / 42 m flower radius, and caps of
700 flower / 2,000 grass clumps. No meadow plants cast shadows. Growth is
hidden in the aerial plan. Wind/storm and snow use shared weather uniforms.
Debug stats expose `meadow`; `tests/meadow-browser.mjs` checks bank, lower
woodland, storm, snow, portrait and plan cleanup. Unit checks cover seeded
placement, corridor exclusion, surface rejection, 3D geometry and PNG alpha.

Verification: all 40 unit checks and the production build pass. Meadow browser
checks pass for bank/side/lower woodland, storm, snow, portrait and plan cleanup.
The full immersion check passes for six entrances, map anchors, quiet walking,
menu/photos, kite flight/weather/landing and touch controls, with no browser
errors. Screenshots were reviewed. Chrome uses a software GPU; physical-phone
and hardware-GPU performance remain unbenchmarked.

**4 October 2026: imagegen-inspired forest volume.** The user's mountain-tree
reference informed an imagegen concept and a transparent foliage atlas. The
concept is `design/forest/forest-concept-v1.png`; exact prompts/provenance are in
`design/forest/PROMPTS.md`. The concept is design art, not an implemented-game
screenshot. `public/vegetation/forest-atlas-v1.png` is the runtime RGBA atlas:
broadleaf / open broadleaf / pine / fern in a 2×2 grid. The original generated
alpha is preserved. The user's reference screenshot is not redistributed.

`src/forest-geometry.js` makes curved foliage patches, branching broadleaf/pine
trees, fern fronds and the forty-triangle shadow proxy. `src/forest.js` owns the
shared atlas, instancing and distance budgets: at most 160 detailed trees and
900 middle trees, selected nearest first; the rest are cheap distant sprites.
Detailed crowns never cast shadows. Each detailed tree stays below 2,000
triangles and middle trees below 300. Curved normals and clustered positions
give depth from different viewing directions. The near/middle instance colours
are repacked with their transforms, avoiding the old colour/placement mismatch.

Tree placements still come from Blender; their rendered shapes now use these
procedural meshes instead of the exported prototype. Pine variation is an
artistic subset of wooded placements, not a species survey; planted promenade
trees remain broadleaf with painted bases. Hills, paths, original Blender file
and geometry export are not changed. Atlas-mapped ferns and fuller shrubs use
existing sampled path-margin placements outside the paving. Wind/snow continue
through the shared weather materials.

36 unit checks and a production build pass. The forest browser check covers
rainbow road, a woodland stair section, side view, sunset and portrait layout;
it clears the grade's entry fade for capture before judging lighting. Riverside weather checks and
the immersion checks cover rendering and walking/kite regressions. Tests use
software-GPU Chrome; physical-phone/hardware-GPU performance is unbenchmarked.

**4 October 2026: riverside reference refinement.** The user supplied
[Point Lookout](https://claude-creative-xbmc.vercel.app/) as a visual reference.
It was inspected in Chrome, including its public rendering modules. Only visual
principles were adapted: no reference code, textures, models or location were
imported. Terrain/routes, private photo handling and the quiet UI remain intact.

`src/river-surface.js` defines twelve analytic wave trains with dispersion,
crossing bearings, shared CPU/GLSL height/slopes and a procedural repeating foam
texture. The near mesh filters waves to its 6.25 m vertex spacing. Fragment
normals filter each wave by its directional screen footprint, keeping detail at
grazing angles without horizon moire. Small noise-derived slopes break up the
trains. Reflection palettes follow the sky; bank wash, crests and shipping wakes
use foam lace. The circular 450 m seam, cheap overview branch and single final
tone map remain. This is an artistic river spectrum, not an FFT or survey.

Foliage uses reproducible branching sprays, a denser far canopy atlas, forked
twig geometry and alpha-masked veined leaves on the exported near-tree quads.
Their positions remain unchanged. The near leaf quads have consecutive groups
of four vertices/six indices; a new exporter must preserve that or regenerate
their UV assignment. Backlighting now patches Three's `opaque_fragment` chunk
and uses the actual sun direction. Near crowns still never cast shadows; proxy
geometry still uses the cheap plain trunk and crown.

32 unit checks and the build pass. `tests/riverside-visual.mjs` captures plan,
water, forest and four weather moods, checking rendering errors and vessel/
beacon motion. Use the existing immersion check for walking/menu/map/kite/touch
regressions. Browser captures use software-GPU Chrome; no physical phone or
hardware GPU performance benchmark is claimed. Reports/screenshots remain in
ignored `test-results/`.

**4 October 2026: anchored markers, quiet walking and bird-kite flight.**
The home remains an orbitable 3D entrance plan. `src/plan.js` now projects
icons directly onto their world positions without collision-driven relocation
or clamping. Crowded names appear on hover/focus; the route panel and small-screen
Choose a path menu keep every entrance accessible when icons overlap.

Walking shows scene time/weather and discreet kite/menu icons. Tours, sound,
postcards, destinations and the 20-photo album live in the menu. Drag looks;
double-click opts into pointer lock on a desktop. Entry never captures the
mouse, and touch users never enter pointer lock.

`src/kite.js` owns the swallow kite, bounded free flight, terrain sampling and
nearest-path landing. K or the bird icon launches/lands; WASD steers, Space/E
climbs, Ctrl/Q descends, Shift accelerates; touch has arrows and +/- buttons.
Flight stops tours/guided walks; Map lands before returning to the plan. The
clearance sampler raycasts only ground meshes after filtering their bounding
boxes. It is approximate collision clearance, not a physics engine. Wind audio
rises in flight; floating leaf/pollen layers are disabled above the canopy.

The river has a 1.1 km camera-centred displaced wave mesh with a flat horizon
plane. Both share the same wave shading; a 450 m circular seam fades height to
zero. Nearby bank wash and storm whitecaps are procedural scenic effects.
Raw shaders still write linear HDR. Middle-distance trees use layered textured
leaf sprays; far forest uses canopy sprites. Detailed near crowns still do not
cast shadows. Grass/shrubs follow cached ground samples, stay beyond promenade
paving and sway in wind. Terrain/routes and the Blender export are unchanged.

Verification: 28/28 unit tests and a production build pass. The immersion
browser check passes for all six desktop entrances, anchor projection during
orbit, hidden walking panels, menu photos/tours, kite flight/weather/landing,
all six touch entrances and touch climb/landing, with no browser errors.
Screenshots were reviewed. Touch checks emulate a phone in Chrome; no physical
phone or hardware GPU was benchmarked. The older focused browser scripts have
updated menu selectors but were not all rerun for this revision.
For software-GPU browser QA set `window.__mufu.paused = true`, then call
`step(frames, dt)`. Leave requestAnimationFrame intact: browser capture uses it.
The previous title-loop preset remains in tour.js but does not run on home.

---

## 1. What this is, in one paragraph

A browser walk on Mount Mufu (幕府山) and the Yangtze in Nanjing, built from a
photo-informed Blender reconstruction. Twenty photographs from a single real
morning — 26 September 2026, 06:16 to 08:26 — stand beside the path as lit
frames you can walk up to. There is no goal. The repository root **is** the web
app; there is no server, no API, no database, no account.

**Nothing here is surveyed.** Terrain, route alignment, pavilion placement, the
ships and the beacon are approximations or artistic additions. Say so in any
copy you write. Section 6 explains exactly how far the accuracy goes.

---

## 2. Getting going

```sh
npm ci
npm run dev          # Vite dev server
npm test             # 40 unit tests, no browser needed
npm run build        # static site into dist/
npm run preview      # serves dist on 127.0.0.1:4173
```

Node 22.12+ or 24 LTS. The browser checks additionally need Chrome installed.

First useful thing to do: open the site, press **T**, and watch the whole
circuit for five minutes. It visits every part of the world in order and will
teach you the geography faster than reading code.

---

## 3. How the code is laid out

| File | Lines | What it owns |
| --- | ---: | --- |
| `src/main.js` | 1845 | Scene assembly, materials, trees, the frame loop, all UI wiring, movement |
| `src/style.css` | 1032 | Everything visual outside the canvas |
| `src/memories.js` | 455 | The twenty photo frames: placement, reveal, texture budget, the morning walk |
| `src/river-life.js` | 450 | Water shader, ships, wakes, beacon, birds |
| `src/river-surface.js` | — | Dispersed wave bands, CPU/GLSL surface sampling, procedural foam lace |
| `src/forest.js`, `src/forest-geometry.js` | — | Mixed tree meshes, curved foliage, atlas materials, distance budgets and shadow proxies |
| `src/meadow.js` | — | Lower-ground flower/grass patches, planting checks, spatial buckets and weather materials |
| `src/tour.js` | 348 | Camera on rails — the whole circuit and a retained legacy title preset |
| `src/plan.js` | — | Aerial camera framing, direct world-projected entrance icons and shortcuts |
| `src/kite.js` | — | Swallow kite, bounded free flight, ground sampling and path landing |
| `src/life.js` | 319 | Path-side grass, pollen, falling leaves |
| `src/sky.js` | 260 | Sky shader, the real solar path, the far shore |
| `src/postfx.js` | 229 | The post-processing chain and the three quality tiers |
| `src/audio.js` | 178 | Ambience mixing, footsteps, chime, ship engines and horns |
| `src/camera-feel.js` | 85 | Head bob, strafe lean, breathing, run FOV |
| `src/navigation.js` | 51 | Route constraint maths — the oldest and most-tested file |

`main.js` is far too big and is the obvious refactor. If you split it, the
natural seams are: scene/material construction, the movement block, and the UI
wiring. Do it as its own change with the tests green before and after.

### The frame loop

`animate()` only calls `requestAnimationFrame` and `frame(dt)`. **All the work
is in `frame(dt)`**, which is deliberately callable by hand:

```js
window.__mufu.step(200, 0.05)   // 200 frames at 50 ms — ten seconds of world time
```

This exists because a headless software renderer cannot produce frames fast
enough to test anything by wall-clock time. Use it in every browser check.
`frame()` clamps `dt` to 0.1 s, so `step(n, dt)` advances at most `n × 0.1` s.

### The debug surface

`window.__mufu` is the seam the browser checks drive, and it is worth keeping:

```
state weather places routes camera renderer scene postfx
goTo setWeather setQuality startMemoryWalk startTour endTour
cinematic circuitLegs memories step getStats
```

`state` holds `ready playing auto memoryWalk tour overview photoMode weather
quality route place distance moving frames`.

---

## 4. The five things that will bite you

These each cost real debugging time. They are all commented at the site, but
read them before you touch the renderer.

### 4.1 The composer's buffer roles are pinned on purpose

`RenderPass` writes into the composer's **read** buffer and does not swap. So
the depth texture must live on that target and **only** that one:

- attach it to both buffers → framebuffer feedback loop, the scene goes black;
- attach it to the other buffer → the scene renders with no depth.

Both failures were hit while building this. `postfx.js` therefore pins
`readBuffer`/`writeBuffer` every frame, which also stops them alternating when
the number of enabled passes is odd. Do not "simplify" that.

### 4.2 Shadow cost killed the GPU

Letting the detailed near-tree crowns cast shadows pushed roughly two million
triangles through the shadow map each frame and **lost the WebGL context
outright** on an Intel Iris Xe. They are stood in for by forty-triangle proxies
drawn with `colorWrite: false, depthWrite: false` — invisible in the beauty
pass, present in the shadow pass. Do not re-enable `castShadow` on `nearTrees`.
Large terrain and road slabs do not cast either (`radius < 55` gate).

### 4.3 Everything is tone mapped exactly once, at the end

The sky dome and the water are raw `ShaderMaterial`s writing **linear HDR**.
`OutputPass` applies AgX and the sRGB encode for the whole frame. If you add a
raw shader, do not include `<tonemapping_fragment>` in it. If you need
something to survive tone mapping looking like itself — the photographs do —
pre-compensate, as `photoShader` in `memories.js` does.

### 4.4 Texture budget for the photographs

Twenty 1600 px photographs will not fit in an integrated GPU alongside a 21 MB
geometry buffer. `memories.js` loads a frame's texture within 130 m and
**disposes it again** beyond 260 m. If you raise the resolution or the count,
check `renderer.info.memory` on an integrated GPU before shipping.

### 4.5 Rail openings are a runtime edit, not an export change

The exported balustrade sealed off the river terrace. `RAIL_OPENINGS` in
`main.js` collapses triangles inside a world-space box to degenerate at load
time, so **the committed `geometry.bin` and the Blender scene still have the
rail unbroken.** That is deliberate: the export stays the source of truth. If
you re-export geometry, the opening still applies as long as the mesh name
still matches `/pale weathered balustrade/i` and the box still covers it —
*verify that, it is not automatic.*

---

## 5. Systems worth understanding before changing them

### Movement and routes

Walking is constrained to corridors, not physics. `public/world/routes.json`
holds five polylines; `navigation.js` snaps the walker to within
`width * 0.38` of the centreline and interpolates the walking height.

| # | Name | Length | Notes |
| ---: | --- | ---: | --- |
| 0 | Ridge trail | 5556 m | Tops out at `t = 0.4965`, which **is** the lookout terrace |
| 1 | Forest stairs | 386 m | The ascent |
| 2 | Rainbow road | 1748 m | |
| 3 | Yangtze promenade | 6001 m | |
| 4 | River terrace | 15 m | Hand-authored spur onto the lookout |

`takeJunction()` hands the walker between corridors where two touch at the same
height, throttled to 5 Hz. Without it each corridor is an island. Note that
route 4 is the only route **not** exported from Blender — it was written by
hand. If you regenerate `routes.json`, re-append it.

### The sun is real, and the compass was solved from the geometry

The promenade bookmark faces along the bank with the water to its left, and the
site is on the **south** bank looking north to Bagua Island — so that heading is
about 060°. That gives model north `(-0.3377, -0.9412)` and east
`(0.9412, -0.3377)`, and the whole promenade then runs at 072° ENE, which is
how the river actually lies. `sky.js` carries NOAA solar positions for
32.1161° N, 118.7771° E on 26 September 2026, converted into model space.

An earlier hand-waved arc put the **morning sun in the west**; every shadow fell
the wrong way. If you change the sun, keep it derived rather than eyeballed.

### Quality tiers

```
smooth     no bloom/shafts/AO/AA, dpr 1.00, no shadows
balanced   all effects,            dpr 1.00, 1024 shadow map
cinematic  all effects,            dpr 1.25, 2048 shadow map
```

Picked on first load from `deviceMemory`/`hardwareConcurrency`/pointer type,
with **one** automatic step down if the median frame time is poor. A manual
choice under **?** is sticky in `localStorage`. On WebGL context loss the app
drops to `smooth` and reloads **once** — guarded by `sessionStorage`, because
reloading in a loop makes the browser block WebGL for the page entirely.

### Tours

`tour.js` drives `wholeCircuit()` for the hands-free circuit. `titleLoop()` is
a retained legacy preset; the home now uses the interactive entrance plan.
A leg is a `walk` along a route
fraction, an `air` move between two points, or a `hold`. Legs carry a `mood`
that drives the weather and a `label` for the caption, and each fades up from
black and back down. `lookAt` overrides the look direction with an absolute
world point — needed for shots that must face something specific.

Adding a leg is cheap, and `tests/tour.test.js` will catch the usual mistakes
(route that does not exist, a "walk" at sprint speed, an aerial shot pointing
off the map or upwards).

---

## 6. What is true, and what only looks true

Be careful here. The project's whole point is that it is somebody's actual
morning, so overclaiming is worse than usual.

**Verified / derived:** the solar positions; the compass solve; that the site is
on the south bank facing Bagua Island with the Second Bridge visible from the
ridge ([Qixia District](https://www.njqxq.gov.cn/lydt/202211/t20221128_3767167.html));
that the ridge runs ~5.8 km west to east and its historic 204–205 m peak was cut
down by limestone quarrying ([Wikipedia](https://zh.wikipedia.org/zh-tw/%E5%B9%95%E5%BA%9C%E5%B1%B1)),
which is why the modelled ridge tops out near 190 m.

**Inferred, and labelled as such in the app:** terrain, route alignment,
pavilion placement and dimensions, bridge location.

**Artistic:** the ships, the beacon, the weather moods, the far-shore light
line, all the audio (reusable recordings, not recorded at Mufu — keep the
credits in `public/SOUND_CREDITS.md` and the help panel).

**The frames are not placed by GPS.** They are spaced in chronological order
along the modelled routes. Of the 153 original photographs only 18 carry
GPS-labelled fixes; 132 are network fixes with kilometre-scale jumps and zero
altitudes, and three have no position. Do not "improve" this by connecting the
raw coordinates — that would invent a route that was never surveyed.

### Privacy — read before touching `public/memories`

The twenty published images are **resized copies rewritten pixel by pixel**: no
EXIF, no GPS, no camera model, no timestamps survive in the files.
`tests/memories.test.js` scans every JPEG for an APP1 segment and fails if one
ever appears. **Do not disable that test.**

The 153 full-resolution originals and the research package that holds their
metadata are private, are not in this repository, and must stay out of it.
Captions and times in `public/memories/memories.json` were written by hand from
the hike record.

`tools/make-memories.py` regenerates the web copies from a private originals
directory, if you have one. It never writes metadata and never touches the
originals. Each record in `memories.json` carries an `original` field naming
its source file so the rebuild is reproducible — running the tool against the
private package reproduces the committed JPEGs byte for byte.

```sh
pip install pillow
python tools/make-memories.py --originals /path/to/photos/originals --dry-run
python tools/make-memories.py --originals /path/to/photos/originals --ids 094
python tools/make-memories.py --originals /path/to/photos/originals --add 160 IMG_xxx.jpg
npm test        # the EXIF scan runs here
```

---

## 7. Testing

```sh
npm test                                   # 28 unit tests — fast, no browser
npm run build && npm run preview           # then, against 127.0.0.1:4173:
node tests/browser-check.mjs               # movement, notes, weather, overview, postcard
node tests/river-browser.mjs               # four moving vessels, rotating beacon
node tests/memory-browser.mjs              # frame strip, a photo opening, the morning walk
node tests/tour-browser.mjs                # plan entry, circuit start→finish, stepping off
node tests/plan-browser.mjs                # six entrances, plan controls, keyboard and mobile
```

The browser checks also accept `MUFU_TEST_URL`, so they can be pointed at a
preview deployment or at production.

Two conventions that matter:

- **Drive time with `step()`, never `waitForTimeout`.** Under SwiftShader
  against a remote host you get a frame or two per second; anything measured in
  wall-clock time will spuriously fail.
- **Screenshots are evidence, not assertions.** They are best-effort and a
  capture timeout does not fail a run.

`tests/check-deployment.mjs`, `forest-check.mjs` and `live-smoke.mjs` predate
this work. They still reference an API that exists, but **I have not run them**
— treat them as unverified.

### What has actually been verified

20/20 unit tests, a clean build, and `memory-browser` passing against
production with no console errors. The river and tour checks passed against a
local production build. Everything visual was reviewed by hand in a real
browser.

**Not verified: performance on any GPU other than one Intel Iris Xe laptop, and
headless Chrome under SwiftShader.** The tier auto-detection has never been
exercised on a real phone. This is the single biggest hole; if you have other
hardware, measuring it is the most useful hour you could spend.

---

## 8. Where the assets come from

`public/world/` is exported from `Mufu_Mountain_Hike_Photo_Updated.blend`, which
lives in a **private** handoff package along with the photographs, the research
notes and the Blender scenes. It is not in this repository and this repository
does not need it to build or run.

- `geometry.bin` (21 MB) — interleaved positions/normals/indices
- `scene.json` — mesh records with byte offsets into the above, 25,861 tree
  placements, bookmarks, and a shared near-tree prototype
- `routes.json` — the five walking corridors

If you re-export: keep the Blender→web axis convention `(x, z, −y)`, keep the
metre scale, update geometry and route data **together**, re-append route 4, and
re-check the rail opening in §4.5.

---

## 9. Suggested next work

Roughly in order of value for effort.

1. **Measure performance on other hardware.** Discrete GPU, a mid-range Android
   phone, Safari on iOS. Everything in §4 is tuned against a single laptop.
   Safari in particular has never been opened.
2. **The barges are wrong.** The reference photographs show long, low, flat sand
   and coal carriers riding deep; the model has tall cargo vessels. Hull
   proportions in `river-life.js`, a contained change with a clear reference.
3. **Nobody is on the bank.** The dusk photographs are full of people walking
   the promenade. Even low-poly silhouettes at the riverside would change how
   the place feels more than any shader will.
4. **Split `main.js`.** 1845 lines doing scene assembly, the frame loop and all
   UI wiring.
5. **The named pavilions are still generic.** 白云亭, 怀德亭 and 环翠轩 are
   placeholders; photographs 008, 016 and 031 show the real roof silhouettes,
   lattice and plinths. This is Blender work, then a re-export.
6. **Accessibility.** No keyboard path to the memory frames, no reduced-motion
   handling for the camera bob, no screen-reader story for the 3D view.
7. **Test the legacy scripts in §7 or delete them.**

---

## 10. Deployment

Vercel project `mufu-mount`, scope `mendal2377-2948s-projects`, connected to
GitHub. **Pushing to `main` deploys to production.** Branch pushes get a preview
deployment; preview URLs sit behind Vercel's login.

`vercel.json` configures Vite, `npm run build` and the `dist` output.
`.vercelignore` keeps `tests/` and `test-results/` out of the deploy.

There is no staging environment and no rollback automation beyond Vercel's own
deployment history. Given that, build and run at least `npm test` before you
push to `main`.
