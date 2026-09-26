# Mufu · A little further

A browser 3D walking game adapted from the photo-informed Mount Mufu / Yangtze Blender scene. Explore the rainbow road, ridge, forest stairs and riverside; collect five field notes; change the weather or take a guided walk.

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
- **Guided walk** follows the selected path. **Wander somewhere** jumps to one of five starting points.
- **Overview** switches to an orbit view of the mountain and river. Drag to orbit, scroll to zoom; return to the path to resume walking.
- Morning, sunset, storm and snow blend gradually. Sound starts after your click and can be muted.
- **Save this moment** adds a field note. Notes persist in local browser storage; Help includes a reset button.
- **Postcard** downloads your current view as a PNG.

## Model and sound

The static `public/world` assets contain geometry exported from `Mufu_Mountain_Hike_Photo_Updated.blend`, spatially grouped to allow view culling, shared near-tree geometry, tree placements and route polylines. Original photos and their GPS metadata are **not included**. Browser materials, weather and far trees are simplified for real-time use. Paths constrain movement to a safe corridor with interpolated walking height; this is not general-purpose physics or a surveyed trail map.

Terrain and geographic alignment remain a photo-informed approximation. The seasonal transitions are artistic. The 3D game is not a real-world navigation guide.

Audio excerpts are credited in [SOUND_CREDITS.md](public/SOUND_CREDITS.md) and in the game's Help panel. Reusable recordings are trimmed, faded, encoded and mixed interactively. They were not recorded at Mount Mufu. Keep the credits and licence links when redistributing the audio or game.

## Validation

```sh
npm test
node tests/browser-check.mjs
```

The browser check expects the dev server on `http://127.0.0.1:4173` (or `MUFU_TEST_URL`) and installed Chrome. It checks WASD movement, note collection, viewpoints, weather, overview, guided movement, audio initialization, postcard download and mobile layout. Screenshots and a JSON report go into ignored `test-results/`.

## Deployment

Vercel project: `mufu-mount`, scope: `mendal2377-2948s-projects`.

```sh
npx vercel link --project mufu-mount --scope mendal2377-2948s-projects
npx vercel deploy --prod --scope mendal2377-2948s-projects
```

`vercel.json` configures Vite, `npm run build`, and the `dist` output. Credentials and local Vercel configuration are ignored. When connected to the GitHub repository, pushes to `main` can deploy automatically through Vercel's Git integration.
