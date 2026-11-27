# Speed on older computers (the owner's note 3, 28 November 2026)

The owner: "The city walk is really in bad performance in old PC so optimize the performance."

## What a frame cost

Measured in the core city (tests/_perf-probe.mjs, Chrome with this PC's GPU, 1280 x 720), Balanced:

| Where | Draw calls | Triangles | CPU per frame |
| --- | --- | --- | --- |
| Xinjiekou | 343 | 11.3 M | 65-96 ms |
| Zhongshan's axis | 256 | 10.5 M | 62 ms |

The updates of the street life (traffic, people, birds, cyclists, the map) take about 4 ms of it; the
rest is drawing. Two reasons: the export joins each collection into a few huge meshes, each spanning the
whole map (the roads 1.04 M triangles in one, the terrain 1.25 M, the buildings 0.55 M), drawn whole even
behind the camera; and every one of the 330,000 trees has a far stand-in drawn at any distance (3 M
triangles), though the haze hides the city past about 2 km on foot.

## What changed

- **Tiles** (`src/mesh-tiles.js`): at load, each mesh over 40,000 triangles is cut into 800 m tiles by
  its triangles' middles (400 m tiles made 2,500 draw calls a frame). The horizon's far land and
  skyline stay whole.
- **What the haze hides is not drawn** (`src/landmark-world.js`, `viewRange`): tiles and far trees
  past the distance where the haze is 99 % thick (about 2 km on foot, 4.4 km gliding, and everything
  from the home page's height). The far trees are repacked to those in range when the walker moves.
- **Light** (`lite` in `src/postfx.js`), a new tier for older computers: Smooth's settings (no shadows,
  no effects), drawn at three quarters of the screen's pixels, the haze closing in to 1.8 km, and
  detailed trees within 150 m instead of 280 m. Chosen under ? (Picture quality), or by itself.
- **Choosing by itself, every visit:** the app lowers the tier when frames are slow (Cinematic,
  Balanced, Smooth, Light). Before, every setting was saved as if the visitor had chosen it, so it was
  never lowered again after the first visit. Now only a visitor's own choice is kept as a choice.

## After

| Where | Tier | Draw calls | Triangles | CPU per frame |
| --- | --- | --- | --- | --- |
| Xinjiekou | Balanced | 1,065 | 5.9 M | 52 ms |
| Zhongshan's axis | Balanced | 745 | 5.0 M | 49 ms |
| Xinjiekou | Light | 316 | 2.5 M | 25 ms |
| Zhongshan's axis | Light | 225 | 2.0 M | 23 ms |

Frames a second on this PC moved from 6-15 (Balanced before) to 16-20 (Balanced) and 17-31 (Light);
those readings swing with what else the PC is doing, the triangles and per-frame times less so. Not
measured: an actual old PC. The software renderer (MUFU_SWIFTSHADER) was not used for timing.

## Audit

tests/mesh-tiles.test.js (every triangle kept once, in its tile; interleaved data copied; small and kept
meshes whole). The browser checks that walk the worlds pass with the tiles: worlds, xuanwu, atlas,
traffic, people.
