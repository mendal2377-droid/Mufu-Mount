# Current project handoff — 7 October 2026

Start here when continuing in Codex, Claude Code, or another editor. This is the current snapshot; older sections of HANDOFF.md describe earlier releases.

## Release and ownership

- Repository: https://github.com/mendal2377-droid/Mufu-Mount
- Live app: https://mufu-mount.vercel.app/?correction=ae6b554
- Runtime release: `ae6b5541122aceeed746885cd135256e0b2bac5d` (5 October 2026).
- Local active checkout: `E:/vibe-coding/Codex/mufu/web-current`.
- Vercel: project `mufu-mount`, scope `mendal2377-2948s-projects`.
- GitHub `main` deploys directly to production. Read AGENTS.md before editing.
- This handoff is a documentation update over that runtime release; use `git log -1` for the checkout revision.

The app is a static Vite / Three.js website. There is no backend, database, login requirement for visitors, or runtime API key. The old sibling `web/` folder and September project ZIP contain earlier web versions.

## What the visitor gets

The home screen is an illustrated 3D atlas of central Nanjing. Eighteen destination pins open walking scenes; the Mufu pin opens a separate detailed mountain/riverside scene with six access points and twenty photo memories.

Destinations: Mufu, Nanjing Yangtze Bridge, Yuejiang Tower, Xuanwu Lake, Jiming Temple, Zifeng Tower, Purple Mountain, Sun Yat-sen Mausoleum, Ming Xiaoling, Presidential Palace, Fuzimiao/Qinhuai, Zhonghua Gate, Laomendong, Mochou Lake, Nanjing Eye, Third Yangtze Bridge, Niushou Mountain, and Qixia Mountain. Gaochun and Tangshan are excluded from the current view.

- Plan: drag to orbit, scroll to zoom, click a world-anchored pin or use the destination list.
- Walk: WASD / arrows, drag to look, Shift to move faster. Double-click for mouse capture; Esc releases it.
- Bird kite: bird icon or K; WASD flies, E/Space climbs, Q/Ctrl descends, Shift accelerates, K lands on the nearest route.
- Walking UI stays brief: time/weather, kite and menu. Sound, destinations, tours, photos and postcards live in the menu.
- First light, morning, sunset, storm and snow blend gradually. Sound requires a visitor gesture.
- The detailed Mufu scene also includes four moving cargo ships, wakes, a rotating beacon, birds, synthesized engines/horns, ambient audio, guided walks and the morning photo tour. City ships use a separate simpler implementation.

## Most recent completed changes

Release `ae6b554` corrected Xuanwu Lake's shoreline and seven island rings using OSM relation 2138994. Jiajiang/western Yangtze banks use relation 2538928, preserving Jiangxinzhou. Nanjing Eye's crossing follows OSM way 321392362; its point anchor remains node 3281370485. Mapped river polygons take priority over the earlier centreline strips.

Camera entry clears movement keys, drag, orbit inertia, roll and zoom, then sets a fresh upright pose. Lake approaches avoid buildings; the invented pavilion enclosing an arrival was removed. Zhongshan has a white three-portal memorial hall, blue roof tiers and graded stair-side terrain. Hip roofs have curved profiles and lifted corners. Nanjing Eye has opposite inclined rings, submerged bases and cable fans without a row of generic main-span piers.

The city uses generated gouache foliage/material assets on 3D geometry. The detailed Mufu scene uses its own forest, water, ships and beacon systems. Keep these two worlds distinct.

## Explorable layer (7 October 2026)

- **Arrival**: `src/city-arrival.js` plans a straight avenue at each landmark's framing distance; `city-scene.js` prefixes it to loop walks and sets spawn/look. Keep the camera within about 25 degrees of the road and never below the eye (`tests/city-game-browser.mjs` checks this for every destination).
- **Streets**: `src/city-network.js` finds roads between landmarks. They are baked into `public/city/roads.json`. **Re-run `node tools/research/build-roads.mjs` after changing `nanjing.json`, any landmark walk, or the two modules above**; a stale file is detected and recomputed at load (slow, not wrong). The browser check fails if the page is not using the baked file.
- **Game 金陵拾遗**: pure rules and facts in `src/city-game.js` (tests in `tests/city-game.test.js`), in-world view in `src/city-game-view.js`, passport and arrival wiring in `src/nanjing.js`. Progress key `mufu-city-game-v1`. Facts and sources: `research/nanjing/GAME-FACTS.md` (cited, not independently verified).
- Landmark builders have a headless harness: `tests/city-landmark-build.test.js`. Add a landmark detail there first; a missing helper otherwise costs a ten-second browser reload.
- **Composed views.** Ten places have their own set (`src/city-sets.js`, `-town`, `-nature`, shared bits in `-kit`) that returns a walk, first-frame look, weather and season; `research/nanjing/BEST-VIEWS.md` says what each is modelled on. Run `node --test tests/city-views.test.js` after changing one (it builds the real scene, about 30 s) and **load the page once**: a syntax error in a set breaks the whole app and the unit tests that do not import it will not notice.
- **Autumn.** A set can return `autumn:{x,z,r}`; trees planted without a species inside it become maple or plane (`seasonal()` in `src/city-landscape.js`).
- **Composed views.** Ten places have their own set (`src/city-sets.js`, `-town`, `-nature`, shared bits in `-kit`) that returns a walk, first-frame look, weather and season; `research/nanjing/BEST-VIEWS.md` says what each is modelled on. Run `node --test tests/city-views.test.js` after changing one (it builds the real scene, about 30 s) and **load the page once**: a syntax error in a set breaks the whole app and the unit tests that do not import it will not notice.
- **Autumn.** A set can return `autumn:{x,z,r}`; trees planted without a species inside it become maple or plane (`seasonal()` in `src/city-landscape.js`).
- **Ground first.** Every landmark has a level pad (`PADS`, `src/city-terrain.js`). When you add or enlarge a building, enlarge its pad, then run `node --test tests/city-foundations.test.js`. Pads are applied after the lake shoulders and before the Mausoleum ramp; the Xiaoling pad and the Mausoleum terrace are only 85 m apart, so widen either with care.
- **Do not name an API member `places`.** `createNanjing()` spreads the scene's `places` array into its API, and a method of that name once silently replaced it (breaking the browser tests). The Places panel is `openPlaces()`.
- **Style.** `design/city/STYLE-GUIDE.md`. The painted sky is `uPainted` in `src/sky.js`; Mufu leaves it at 0.
- **Camera safety.** `tests/surface-clearance.mjs` measures the lens-to-surface distance in the page; `tests/city-game-browser.mjs` fails any arrival closer than 0.45 m.
- Walkways are laid by `bedRibbon` (level across the width). Do not clamp each edge to the terrain: on a slope that makes a tilted slab.

## Files to change for each task

| Task | Entry files |
| --- | --- |
| City UI, entry, weather, movement and map lifecycle | `src/nanjing.js`, `src/city-camera.js`, `index.html`, `src/style.css` |
| City landmark shapes | `src/city-landmarks.js`, `src/city-scene.js` |
| City ground, shore grading and height sampling | `src/city-terrain.js` |
| City trees, grass, flowers and detail budgets | `src/city-landscape.js`, `src/city-art.js` |
| Coordinates, ribbons and mapped water priority | `src/city-geography.js`, `public/city/nanjing.json` |
| Reproduce geographic data / scope | `tools/research/prepare-nanjing.mjs`, `tools/research/central-scope.mjs` |
| Detailed Mufu scene and UI assembly | `src/main.js`, `public/world/` |
| Mufu waves, ships, beacon | `src/river-surface.js`, `src/river-life.js` |
| Mufu forest / meadow | `src/forest.js`, `src/forest-geometry.js`, `src/meadow.js` |
| Sky / rendering / camera feel | `src/sky.js`, `src/postfx.js`, `src/camera-feel.js` |
| Movement / flight / tours / photo memories | `src/navigation.js`, `src/kite.js`, `src/tour.js`, `src/memories.js` |
| Photo index and sanitized images | `public/memories/memories.json`, `public/memories/` |

## Evidence, style assets and geography limits

Read `research/nanjing/SOURCES.md`, `LANDMARKS.md`, `PHOTO-REFERENCES.json` and `CORRECTION-STATUS.md`. Downloaded OSM snapshots are committed in that directory. The public-photo register has nineteen records: sixteen images were inspected in the earlier research pass; three endpoints were unavailable. Downloaded reference photos and screenshots are in ignored `test-results/`, so a fresh clone does not contain them. The source register provides their URLs.

`design/city/PROMPTS.md` and `LANDMARK-PROMPTS.md` record imagegen prompts and generated concepts. Source PNGs are committed under `design/city/`; usable runtime maps are under `public/city/art/`. Forest concepts/prompts are under `design/forest/`. Concepts are design references, not captures of the playable app.

The coordinate pipeline uses public WGS84 map anchors. Do not mix GCJ-02 / BD-09 coordinates directly with them. The rectangular central extent is a viewing window, not Nanjing's administrative boundary. Elevations, architecture scale, generic neighborhoods, routes and some water widths are artistic approximations. This is an illustrated atlas rather than a surveyed digital twin.

The original Mufu/Blender world has its own model coordinates. Its photo memories follow hike chronology, not GPS. Do not connect the city coordinates directly to those original model coordinates.

Rebuild the published city data from committed snapshots, offline:

```sh
node tools/research/prepare-nanjing.mjs
```

`fetch-nanjing.mjs` and `fetch-corrections.py` are optional source refresh tools. Review their proxy configuration and respect upstream rate limits. Source refreshes can change the geometry; review the resulting JSON and views before publishing.

## Run and verify

Requires Node 22.12+ or a compatible newer Node; install Chrome for the current browser scripts. Python/Pillow is only needed for photo conversion. The web app itself builds without Blender or original photos.

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview -- --port 4186
```

With the preview running in another terminal, PowerShell:

```powershell
$env:MUFU_TEST_URL='http://127.0.0.1:4186'
node tests/city-browser.mjs
$env:MUFU_LANDMARK_ENTRIES='eye,xuanwu,zhongshan,mochou'
node tests/city-landmark-browser.mjs
```

These scripts use installed Chrome with software WebGL. Screenshot capture may be slow. `MUFU_LANDMARK_ENTRIES` restricts the focused landmark run; unset it for the default wider set. City browser scripts have different default preview ports, so set MUFU_TEST_URL explicitly. Some older browser scripts assume the earlier Mufu home page; adapt them to the city/Mufu portal before relying on them.

Use `window.__mufu.paused=true` and `window.__mufu.step(frames, dt)` for deterministic scene checks. Useful debug surfaces: `window.__mufu.city`, `.city.stats()`, `.city.enter(id)`, `.city.showPlan()`, `.camera`, and `.setWeather(mood)`. Inspect both screenshots and assertions: a finite camera can still be inside a wall.

### Verification snapshot

On 7 October 2026, all **58 unit checks** and the production build passed again. GitHub main and the deployed JavaScript bundle / corrected map JSON matched runtime release `ae6b554` before this documentation update.

The 5 October browser runs covered 18 pins, eight city walks, terrain clearance, pin projection, kite launch/climb/landing, sound, weather, Mufu return and portrait layout. Focused lake/bridge/landmark screenshots were reviewed. The final live run covered Eye, Xuanwu and Zhongshan, repeatable camera arrival, sunset/storm/snow and portrait, with no captured browser errors.

The prior local city report recorded approximately 0.96 million overview triangles, 70,044 terrain triangles and 5,411 trees. These are snapshot metrics, not performance guarantees. Browser reports/screenshots remain local in `test-results/`; they are not part of a clean clone or the source ZIP. A physical-phone/hardware-GPU benchmark has not been done for this city release.

## Keep these constraints

- Preserve the quiet walking UI and world-anchored map pins. Do not reintroduce panels covering the scene or relocate pins by screen-space clamping.
- Keep the central scope. Agree on additional destinations before bringing back distant areas.
- Keep one final tone-mapping pass. HANDOFF.md section 4 explains the composer depth/buffer roles and shadow traps.
- Detailed foliage must not cast shadows. Retain the existing instancing and near-detail caps.
- Walking must sample the rendered terrain and routes. New camera arrivals must reset state and stay outside buildings.
- Never weaken the EXIF test. Never commit original photos, raw GPS/EXIF, private research, credentials, node_modules or render caches.
- Build and test before pushing main: it publishes to production.

## Private photographs and Blender handoff

The repository includes twenty resized photo memories and thumbnails with metadata stripped. Their captions/times are authored in `memories.json`. Those files are enough to run the app.

The **153 original hiking photographs**, their EXIF and private research, editable Blender scenes, and film are separate private assets. They are not downloadable from GitHub. Ask the project owner for the private photo/Blender package if the next task needs photo fidelity or re-exporting geometry. The owner has a separate inventory identifying the existing archives and current local paths.

The September package contains an older web snapshot. Use this repository or the fresh October source ZIP for web development; use that package for Blender, original photos, private research and media.

Photo regeneration:

```sh
pip install pillow
python tools/make-memories.py --originals /private/photos --dry-run
```

For a Mufu re-export, read HANDOFF.md sections 4.5 and 8. Preserve Blender-to-web axes `(x, z, -y)` and metre scale; update geometry and routes together and retain the added river route / rail opening. The Nanjing city geometry is generated in JavaScript and is not exported from that Blender file.

## Recommended next work

1. Review every landmark arrival from both the pin and menu, then walk, fly, land and return to the map. Current checks cover selected routes, not every possible transition.
2. Improve landmark silhouettes and nearby approaches from the evidence register, one destination at a time. Keep anchor geography fixed; document exaggerated dimensions. The scenery remains simplified and generic buildings lack surveyed footprints.
3. Benchmark a real Android phone, iOS Safari and a hardware GPU. Tune detail budgets from measurements.
4. Refine Mufu's photo-based pavilion shapes and river-vessel proportions using the private photos. This may require Blender re-export.
5. Improve keyboard access and reduced-motion behavior; refactor the large main.js in a separate change.

## Prompt to give the next coding agent

> Continue the Nanjing / Mufu project in this checkout. Read START_HERE.md, AGENTS.md, HANDOFF.md sections 4 and 6, and research/nanjing/CORRECTION-STATUS.md first. Inspect git status and preserve existing changes. The current runtime baseline is ae6b554: 18 central destinations, corrected Xuanwu/Jiajiang geometry, stable camera arrivals, gouache 3D vegetation and landmarks, and the separate detailed Mufu experience. Keep the quiet time/weather walking UI and bird-kite flight. Use the source register and supplied private photo references for visual refinements; keep raw photos/EXIF/GPS private. Reproduce the current behavior before editing, complete the assigned change, run relevant tests/build and visually inspect the affected scenes. Do not claim surveyed fidelity or deploy without existing owner authorization. My next task is: [describe the change].
