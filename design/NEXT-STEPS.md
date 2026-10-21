# Where the rebuild stands (20 October 2026)

Branch `rebuild/blender-city`. Plan: [REBUILD-PLAN.md](REBUILD-PLAN.md). Art: [ART-BIBLE.md](ART-BIBLE.md). Shapes: [SHAPE-AUDIT.md](SHAPE-AUDIT.md).

## Worlds (public/scenes/*)

| World | Pins | Build | State |
| --- | --- | --- | --- |
| zhongshan | zhongshan | `blender/build_zhongshan.py` (+ `zhongshan_meiling.py`) | Done: Mausoleum, Music Stage, Meiling necklace, gates, music |
| north | jiming, xuanwu | `blender/build_north.py` | Done: temple, Taicheng, lake, lotus, cherries, bell |
| oldsouth | qinhuai, zhonghua, mendong | `blender/build_oldsouth.py` | Built: Fuzimiao, Qinhuai boats and ride, Laomendong, Zhonghua Gate, Bao'en |
| skyline | (all worlds) | `tools/research/skyline-prep.py` + `blender/build_skyline.py` | OSM 3D parts of every 60 m+ tower; loaded into each world by origin |

Rebuild one world: `./tools/export-scene.sh <id> [--render]`. The skyline: run its two commands, then gltf-transform (see the build_skyline.py docstring).

## Resume here (21 October 2026)

1. Run `./tools/export-scene.sh zhongshan`. The Meiling→Xiaoling gate's height fix is in code but not yet exported; the worlds test flagged it, `gate 4->xiaoling`.
2. Run `tests/worlds-browser.mjs` against the dev server. Zhongshan and North passed before that gate was added; recheck Old South after its marker fixes.
3. Presidential Palace world: the OSM extract is downloaded (`research/palace/data/osm-palace.json`); run `tools/research/area-prep.py` after adding a `palace` entry.

## Next

- Batch B landmarks: Presidential Palace, Yangtze Bridge, Ming Xiaoling, Niushou, Qixia.
- The illustrated floor-plan map, the season dial, the 2016 / today skyline toggle, and a real-phone benchmark.
- `tests/worlds-browser.mjs`: raise its load timeout. Software WebGL needs more than 4 minutes for the first world.

Nothing is pushed. `main` (production) is untouched.
