# Change log

## 2026-10-04 — enter from the landscape

Home opens on an oblique 3D plan of Mount Mufu and the Yangtze. Six anchored
entrance pins lead to the rainbow road, ridge, lookout, promenade, forest
stairs and river/beacon view. Labels follow orbit and zoom, spread apart for
touch targets, and remain linked to their model positions. A compact route
panel provides another keyboard-accessible way to enter.

The large welcome headline, prose and promotional copy have been removed.
Walking controls, photographs and field notes stay in the walking view;
instructions and credits remain in Help. Map returns from walking or a tour
to the entrance plan. Weather selected on the plan carries into walking.
The aerial view uses a clearer water palette and less grain/vignette, while
walking keeps the existing river material and lighting. Portrait screens use
an orientation that fits the long riverfront.

Added framing/label unit checks and a browser check for every entrance,
movement, orbit/zoom/reset, weather persistence, tour exit and mobile layout.
Existing browser checks now enter through a pin.

## 2026-09-27 (third pass) — a camera on rails

`src/tour.js` adds one piece of machinery used twice: a list of legs, each
either a glide along a stretch of an exported route at eye height, a lift off
it to show where you have been, or a stand-and-look, with each leg fading up
from black and back down so the cuts are cuts rather than jumps.

**The loop behind the title now reaches the river.** It was a single slow drift
along the rainbow road. It is now four legs — the road in morning light, the
riverside promenade at golden hour, the ridge at first light, and the Yangtze
again — and the mood moves with them.

**A hands-free circuit.** `Whole circuit`, or `T`: about five minutes up
through the woods at first light, out over the ridge, along the ridge trail,
onto the river terrace, down the coloured road and the green-barrier road,
down to the water, and then the long riverside into the evening. Two of the
ten legs are aerial, to give the overview across the mountain and the river.
A caption names each stretch with a progress bar, the interface clears itself
away, and Esc or any movement key steps off wherever you are and puts you back
on the nearest corridor.

`tests/tour.test.js` checks both tours are actually playable: every leg names
a route that exists, ground legs move at a walking pace rather than a sprint,
aerial legs stay over the modelled world and look downwards, the circuit
touches all five corridors and runs dawn to sunset, and the title loop reaches
the river. `tests/tour-browser.mjs` drives the real thing.

## 2026-09-27 (later) — a way onto the terrace, and a real sky

Follow-up to the same day's work, after looking at the result and at three of
the user's own sunset photographs of this bank.

**A way onto the river terrace.** The square-spiral lookout could be seen but
not reached: the ridge trail's balustrade sealed it off, and the walking
corridors were islands with no way between them. `RAIL_OPENINGS` in
`src/main.js` now cuts a gate in that balustrade at load — a browser-side edit
by world-space box, so the export and the Blender scene keep their rail
unbroken — and a short `River terrace` spur route runs through the gate, along
the west edge of the deck, clear of the two benches, to the open river side.
Walking into a junction now hands you to whichever corridor you are actually
heading down, so the whole network is connected rather than a set of rails.
`03 · River lookout` puts you on the terrace instead of outside it.

**Far fewer things in the sky.** Pollen went from 900 motes in a 54 × 16 × 54
box to 240 in a 26 × 7 × 26 one, leaves from 260 to 80 and smaller; both now
fade out above the eye and very close to the camera. They were reading as a
field of specks on the sky.

**The sun was in the wrong place.** The scene's compass can be solved from its
own geometry — see the README — and with it fixed, the sky now follows real
NOAA solar positions for Nanjing on 26 September 2026. The old arc put the
*morning* sun in the west; every shadow on the walk fell the wrong way. Sunset
moved to azimuth 265°, low over the water, which is what 燕矶夕照 means and
what the user's photographs show.

**A sky built from those photographs.** Blue overhead with the warmth held in
a shallow band along the horizon, widest towards the sun, instead of a pink
wash over everything. Cirrus on a stretched noise grid so it streaks. Cloud
only takes the sunset's colour where the sunset can reach it. A crescent moon
with an evening star. A low dark far shore — Bagua Island and the north bank —
with pylons, and after sunset a scatter of shore lights and a lit crossing.

**A glitter path on the water.** A low sun over broken water makes a column of
highlights running back to the observer, not one blob. Narrow across the sun's
bearing, long along it, breaking into sparks on the chop. The riverside beacon
drags one too. The water body colour also moved from blue-green to the turbid
brown-green the Yangtze actually is here.

Bloom was blowing out sunlit foliage: threshold 0.86 → 1.15, per-mood strengths
cut by roughly a third, sun shafts from 1.5 to 0.85, and the sun disc
tightened from about 1.25° across to about 0.5°.

Still not verified: frame rates anywhere but one Intel Iris Xe laptop and
headless Chrome. Still not done: the barges are tall cargo vessels rather than
the low flat sand carriers in the photographs, and there are no people on the
bank.

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
