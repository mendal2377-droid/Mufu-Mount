# Mufu · A little further

A browser 3D walk adapted from the photo-informed Mount Mufu / Yangtze Blender scene, hung with twenty photographs from a single morning — 06:16 to 08:26 on 26 September 2026. Walk the rainbow road, the ridge, the forest stairs and the riverside; find the frames where they were taken; change the weather, or let the morning carry you from first light to mid-morning.

**Play:** [mufu-mount.vercel.app](https://mufu-mount.vercel.app)

## Run locally

Requires Node.js 22.12+ or 24 LTS.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. `npm run build` creates the static site in `dist`; `npm run preview` serves that build. No backend, API keys, database, or account is required to play.

## Play

- Click **Enter the mountain**. WASD moves; mouse looks; Shift moves faster; Esc releases the mouse.
- If mouse capture is unavailable, drag the scene to look and use WASD or the on-screen arrows. Touch users can drag and use the arrows.
- **Walk the morning** (or **M**) follows the twenty photographs in the order they were taken and moves the light from 06:16 towards 08:26 as it goes.
- **Guided walk** follows the selected path. **Wander somewhere** jumps to one of five starting points.
- **Overview** switches to an orbit view of the mountain and river. Drag to orbit, scroll to zoom; return to the path to resume walking.
- First light, morning, sunset, storm and snow blend gradually. Sound starts after your click and can be muted.
- **Save this moment** adds a field note. Notes and the frames you have reached persist in local browser storage; Help includes a reset button.
- **Photo** (or **P**) clears the interface and letterboxes the view; **Postcard** downloads the current frame as a PNG.
- **Picture quality** under **?** switches between Smooth, Balanced and Cinematic. The site picks one on first load and steps down once if the frame rate will not hold; choosing a setting fixes it.

## The morning

Twenty photographs from a single walk on **26 September 2026, 06:16 to 08:26** stand beside the path as lit frames. Far off, a memory is only a warm light between the trees; walk up to one and it resolves into the photograph and opens with its time, its Chinese place name and a line about it. The strip on the right jumps to any of them.

The frames sit in the order the walk happened, spaced along the modelled routes. They are **not** placed by GPS. Of the 153 original photographs only 18 carry GPS-labelled fixes; 132 are network fixes with kilometre-scale jumps and zero altitudes, and three have no position at all. Nothing in this app should be read as a surveyed route or a measured camera station.

The published images are resized copies (1600 px long edge) rewritten pixel-by-pixel so that **no EXIF, GPS, camera model or timestamp survives in the files**; `tests/memories.test.js` asserts this. The full-resolution originals and the research package that holds their metadata stay private and are not part of this repository. Captions and times come from `public/memories/memories.json`, which is written by hand from the hike record.
- **Watch river & beacon** takes you to the waterside viewing spot. Four cargo ships follow river-side lanes with animated wakes, gentle rocking and navigation lamps. A rotating beacon, circling birds, wind-driven leaves, distant engines and occasional directional ship horns bring movement to the scene.

The water uses layered advected wave normals, view-dependent sky reflection, sunlight glints, current streaks and vessel wakes. The beacon includes a rotating beam, pulsing lens and water glimmer; storm conditions strengthen the waves. Ships and the beacon are artistic additions, not a live maritime data feed or surveyed landmark reconstruction. Engine and horn sounds are synthesized in the browser.

## How it is rendered

Everything is drawn into one linear HDR buffer and tone mapped exactly once, at the end, so the sky dome, the water and the lit scene agree with each other:

1. **Scene pass** — a sun with a 140 m shadow frustum that follows the walker and is snapped to the shadow-map grid so the edges do not crawl. Nearby trees are replaced in the shadow pass by forty-triangle proxies drawn with no colour or depth writes; terrain and road slabs do not cast at all.
2. **Atmosphere pass** — sun shafts marched from the depth buffer towards the sun, plus a short-range depth ambient occlusion. Both read depth only, so nothing is drawn twice.
3. **Bloom**, then **AgX tone mapping and sRGB encoding**.
4. **Grade pass** — per-weather lift/gain, saturation and contrast, vignette, corner chromatic aberration, film grain and the photo-mode letterbox.

The sky is a single shader: a scattering-style gradient, a sun disc with limb glow, two parallaxed cloud decks lit from the sun's side, stars and a moon for the 06:16 end of the walk, and a horizon haze band. Path-side grass, pollen and falling leaves are instanced around the camera; the camera itself has a footfall bob, a lean into strafing, breathing at rest and a field of view that opens when you run.

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
```

`npm test` covers route constraint maths, shipping-lane geometry, and the memory data: that every published frame has an image and a thumbnail, that none of them still carries an EXIF segment, that the times run in order from 06:16 to 08:26, and that each frame stands outside the walkable corridor but within reach of it.

The browser checks expect the preview server on `http://127.0.0.1:4173` (or `MUFU_TEST_URL`) and installed Chrome. `browser-check` covers WASD movement, note collection, viewpoints, weather, overview, guided movement, audio initialization, postcard download and mobile layout. `river-browser` confirms four moving vessels and a rotating beacon. `memory-browser` confirms the frame strip, that a photograph loads and opens with the right time as you reach it, and that the guided morning walk advances at first light. Screenshots and JSON reports go into ignored `test-results/`.

## Deployment

Vercel project: `mufu-mount`, scope: `mendal2377-2948s-projects`.

```sh
npx vercel link --project mufu-mount --scope mendal2377-2948s-projects
npx vercel deploy --prod --scope mendal2377-2948s-projects
```

`vercel.json` configures Vite, `npm run build`, and the `dist` output. Credentials and local Vercel configuration are ignored. When connected to the GitHub repository, pushes to `main` can deploy automatically through Vercel's Git integration.
