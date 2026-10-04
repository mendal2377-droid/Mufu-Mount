# Mufu · A little further

A browser 3D walk adapted from the photo-informed Mount Mufu / Yangtze Blender scene, hung with twenty photographs from a single morning — 06:16 to 08:26 on 26 September 2026. Walk the rainbow road, the ridge, the forest stairs and the riverside; find photo frames along the paths; change the weather, or let the morning carry you from first light to mid-morning.

**Play:** [mufu-mount.vercel.app](https://mufu-mount.vercel.app)

**Working on it?** Start with [HANDOFF.md](HANDOFF.md) — how it is put
together, which parts will bite you, what is actually verified, and what is
worth doing next. [CHANGELOG.md](CHANGELOG.md) has the history.

## Run locally

Requires Node.js 22.12+ or 24 LTS.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates the static site in `dist`; `npm run preview` serves that build. No backend, API keys, database, or account is required to play.

## Play

- The home page is an aerial 3D plan. Drag to orbit, scroll to zoom, and choose one of six entrance pins to walk in. The compact route panel also provides keyboard-accessible entrance buttons. **Map** returns to the plan.
- Walking shows scene time/weather and two discreet kite/menu icons. Destinations, tours, photos, sound and postcards are in the menu. On small screens, **Choose a path** lists every entrance even when world markers overlap.
- WASD moves; drag looks; Shift moves faster. Double-click the scenery for mouse capture; Esc releases it. Weather carries into the walk.
- The bird icon or **K** launches a swallow kite from the plan or a path. **WASD** flies, **Space/E** climbs, **Ctrl/Q** descends, and **Shift** flies faster. **K** again lands on the nearest walking path. Touch arrows and **+ / -** also work. Flight is bounded to the model area, up to 1,000 m, with sampled terrain clearance; it is not a physics simulation.
- If mouse capture is unavailable, drag the scene to look and use WASD or the on-screen arrows. Touch users can drag and use the arrows.
- **Whole circuit** (or **T**) hands the camera over and walks the entire place for you in about five minutes — up through the woods at first light, out over the ridge, along the ridge trail, onto the river terrace, down the coloured road, and then the long riverside into the evening. **Esc** or any movement key steps off wherever you are.
- **Walk the morning** (or **M**) follows the twenty photographs in the order they were taken and moves the light from 06:16 towards 08:26 as it goes.
- **Guided walk** follows the selected path. **Wander somewhere** jumps to one of five starting points.
- **Map** opens the aerial view of the mountain and river, where another pin starts a new walk. The lower-right weather button cycles the light and seasons without leaving the plan.
- First light, morning, sunset, storm and snow blend gradually. Sound starts after your click and can be muted.
- **Save this moment** adds a field note. Notes and the frames you have reached persist in local browser storage; Help includes a reset button.
- **Photo** (or **P**) clears the interface and letterboxes the view; **Postcard** downloads the current frame as a PNG.
- **Picture quality** in the menu switches between Smooth, Balanced and Cinematic. The site picks one on first load and steps down once if the frame rate will not hold; choosing a setting fixes it.

## The morning

Twenty photographs from a single walk on **26 September 2026, 06:16 to 08:26** stand beside the path as lit frames. Far off, a memory is only a warm light between the trees; walk up to one and it resolves into the photograph. The photo album in the menu jumps to any of them. Photo panels no longer cover the walking view.

The frames sit in the order the walk happened, spaced along the modelled routes. They are **not** placed by GPS. Of the 153 original photographs only 18 carry GPS-labelled fixes; 132 are network fixes with kilometre-scale jumps and zero altitudes, and three have no position at all. Nothing in this app should be read as a surveyed route or a measured camera station.

The published images are resized copies (1600 px long edge) rewritten pixel-by-pixel so that **no EXIF, GPS, camera model or timestamp survives in the files**; `tests/memories.test.js` asserts this. The full-resolution originals and the research package that holds their metadata stay private and are not part of this repository. Captions and times come from `public/memories/memories.json`, which is written by hand from the hike record.
- **Watch river & beacon** takes you to the waterside viewing spot. Four cargo ships follow river-side lanes with animated wakes, gentle rocking and navigation lamps. A rotating beacon, circling birds, wind-driven leaves, distant engines and occasional directional ship horns bring movement to the scene.

A camera-centred geometric wave patch adds moving swells near the viewer. Twelve dispersed, crossing wave bands combine long swells with fine ripples and current-driven turbulence. Screen-space filtering prevents distant ripples from flickering; reflection colours follow the scene's sky. Procedural foam lace breaks up bank wash, wind whitecaps and vessel wakes, with stronger waves in a storm. Layered leaf sprays, forked twigs and veined leaf textures give the planting open silhouettes and wind movement; distant canopy masses preserve the wooded hills. Promenade planting stays beyond the paving, on the inland side. The beacon includes a rotating beam, pulsing lens and water glimmer. Ships and the beacon are artistic additions, not a live maritime data feed or surveyed landmark reconstruction. Engine and horn sounds are synthesized in the browser.

The [Point Lookout reference supplied by the user](https://claude-creative-xbmc.vercel.app/) informed this pass's broken foam, water detail and fine foliage. Mufu uses its own shaders, procedural textures and existing geometry. The reference's Australian coastline, source code and assets were not imported. This is a lightweight analytic river surface, not an FFT ocean or a measured river simulation.

## How it is rendered

Everything is drawn into one linear HDR buffer and tone mapped exactly once, at the end, so the sky dome, the water and the lit scene agree with each other:

1. **Scene pass** — a sun with a 140 m shadow frustum that follows the walker and is snapped to the shadow-map grid so the edges do not crawl. Nearby trees are replaced in the shadow pass by forty-triangle proxies drawn with no colour or depth writes; terrain and road slabs do not cast at all.
2. **Atmosphere pass** — sun shafts marched from the depth buffer towards the sun, plus a short-range depth ambient occlusion. Both read depth only, so nothing is drawn twice.
3. **Bloom**, then **AgX tone mapping and sRGB encoding**.
4. **Grade pass** — per-weather lift/gain, saturation and contrast, vignette, corner chromatic aberration, film grain and the photo-mode letterbox.

The sky is a single shader: a gradient that stays blue overhead, a warm band held tight to the horizon and widest towards the sun, a sun disc with limb glow, high cirrus drawn on a stretched noise grid so it streaks rather than blobs, a lower overcast deck that keeps out of the way in clear weather, a crescent moon with an evening star beside it, and the dark far shore. Path-side grass, pollen and falling leaves are instanced around the camera — kept low, few and below the eye, because a sky full of drifting specks reads as dirt on the lens rather than as weather. The camera itself has a footfall bob, a lean into strafing, breathing at rest and a field of view that opens when you run.

## Where the sun is

The scene's compass is recoverable from its own geometry. The promenade bookmark faces along the bank with the water to its left, and the Muyan riverside sits on the **south** bank of the Yangtze with its decks looking north across to Bagua Island — so that heading is about 060°. Solving from that puts model north at `(-0.3377, -0.9412)` and east at `(0.9412, -0.3377)`, and the whole promenade then runs at 072°, ENE, which is how the river actually lies here.

With the compass fixed, `src/sky.js` carries NOAA solar positions for 32.1161° N, 118.7771° E on **26 September 2026**, converted into model space: sunrise at azimuth 93.6° and altitude 3.5° at 06:16, climbing to 30.2° by 08:26. Sunset that day is azimuth 265°, low over the water to the west — this bank's classic view is 燕矶夕照, *Yanji evening glow*, because the sun goes down over the river and not behind the mountain.

Before this the sun followed a hand-waved arc that put the **morning sun in the west**. Every shadow on the walk fell the wrong way.

Beyond the water the sky draws a low far shore — Bagua Island and the north bank — with an occasional pylon or mast, and after sunset a scatter of shore lights and the lit line of a crossing. Those are generic. The real view includes the Second Bridge, but nothing here is a surveyed skyline.

Sources: [Qixia District — 幕燕滨江风貌区](https://www.njqxq.gov.cn/lydt/202211/t20221128_3767167.html) (south bank; observation decks facing north to Bagua Island and the north bank; Second Bridge visible from the ridge viewpoints), [幕府山 — 维基百科](https://zh.wikipedia.org/zh-tw/%E5%B9%95%E5%BA%9C%E5%B1%B1) (a ridge on the south bank running about 5.8 km west to east; the historic 204–205 m main peak was cut down by decades of limestone quarrying, which is why the modelled ridge tops out near 190 m).

`src/postfx.js` pins the composer's buffer roles each frame: `RenderPass` writes into the composer's *read* buffer without swapping, so the depth texture has to live on that target, and only that target — sampling a depth texture attached to the pass's own render target is a framebuffer feedback loop.

## Model and sound

The static `public/world` assets contain geometry exported from `Mufu_Mountain_Hike_Photo_Updated.blend`, spatially grouped to allow view culling, shared near-tree geometry, tree placements and route polylines. The original photographs and their GPS metadata are **not included**; `public/memories` holds only the twenty stripped web copies described above. Browser materials, weather and far trees are simplified for real-time use. Paths constrain movement to a safe corridor with interpolated walking height; this is not general-purpose physics or a surveyed trail map.

Terrain and geographic alignment remain a photo-informed approximation. The seasonal transitions are artistic. The 3D game is not a real-world navigation guide.

Audio excerpts are credited in [SOUND_CREDITS.md](public/SOUND_CREDITS.md) and in the game's Help panel. Reusable recordings are trimmed, faded, encoded and mixed interactively. They were not recorded at Mount Mufu. Keep the credits and licence links when redistributing the audio or game.

## Validation

```sh
npm test
npm run build && npm run preview     # serves the build on 127.0.0.1:4173
node tests/browser-check.mjs
node tests/river-browser.mjs
node tests/memory-browser.mjs
node tests/tour-browser.mjs
node tests/plan-browser.mjs
MUFU_TEST_URL=http://127.0.0.1:4173 node tests/immersion-browser.mjs
MUFU_TEST_URL=http://127.0.0.1:4173 node tests/riverside-visual.mjs
```

`npm test` includes 32 checks: wave gradients/filtering/bounds/time evolution, flight movement/bounds/ground clearance/landing, anchored pin projection, promenade planting, route constraint maths, shipping-lane geometry, the two camera tours (every leg names a route that exists, ground legs move at a walking pace rather than a sprint, aerial legs stay over the modelled world and look downwards, the circuit touches all five corridors and runs from dawn to sunset, and the title loop reaches the river), and the memory data: that every published frame has an image and a thumbnail, that none of them still carries an EXIF segment, that the times run in order from 06:16 to 08:26, and that each frame stands outside the walkable corridor but within reach of it.

`riverside-visual` captures the plan, near water, forest and all four weather moods using deterministic scene time, checks shader/browser errors, and verifies shipping and beacon motion. It defaults to port 4182 and can target production with `MUFU_PUBLIC=1` and `MUFU_TEST_URL`. These are software-GPU Chrome checks; physical-phone and hardware-GPU performance have not been benchmarked.

The browser checks expect the preview server on `http://127.0.0.1:4173` (or `MUFU_TEST_URL`) and installed Chrome. `plan-browser` checks all six entrances, walking movement, orbit/zoom/reset, weather carry-over, keyboard entry, tour return and mobile layout. `browser-check` covers field notes, weather, guided movement and postcards. `river-browser` checks moving vessels and a rotating beacon. `memory-browser` checks photographs and the morning walk. `tour-browser` checks plan entry and the full circuit. `immersion-browser` verifies anchored icon centres during orbit, all six quiet walking entrances, menu photos/tours, flight and landing, weather, all six touch entrances and touch climb/landing; it defaults to preview port 4182. Browser QA may set `window.__mufu.paused = true` and drive `step()` to avoid queuing real-time frames on a software GPU. Screenshots and JSON reports go into ignored `test-results/`.

## Deployment

Vercel project: `mufu-mount`, scope: `mendal2377-2948s-projects`.

```sh
npx vercel link --project mufu-mount --scope mendal2377-2948s-projects
npx vercel deploy --prod --scope mendal2377-2948s-projects
```

`vercel.json` configures Vite, `npm run build`, and the `dist` output. Credentials and local Vercel configuration are ignored. When connected to the GitHub repository, pushes to `main` can deploy automatically through Vercel's Git integration.
