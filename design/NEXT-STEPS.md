# Where the rebuild stopped (19 October 2026, 23:40)

Branch `rebuild/blender-city`. Plan: [REBUILD-PLAN.md](REBUILD-PLAN.md). Art: [ART-BIBLE.md](ART-BIBLE.md).

## Done and committed

- **Zhongshan** (`blender/build_zhongshan.py` + `zhongshan_meiling.py` → `public/scenes/zhongshan/`): Mausoleum axis, Music Stage, Meiling Palace with its necklace, moon gates, paraglide arrival, traveller and magpie, seats with generative music. Verified in the browser.
- **North** (`blender/build_north.py` → `public/scenes/north/`): Jiming Temple, Taicheng, Xuanwu Lake, lotus, cherry road, temple bell, petals. Exported and loaded in the browser; spawns checked by screenshot.
- **Shared tooling:** `tools/research/area-prep.py <area>` (DEM crop + OSM to local metres); `blender/area_common.py`; `blender/kit_oldcity.py`; `tools/export-scene.sh <id> [--render]`.

## In progress (code written, not yet built or tested)

1. **Old South** (`blender/build_oldsouth.py`): Fuzimiao, the Qinhuai with embankments, lanterns and bridges, OSM-footprint houses with horse-head walls, Laomendong, Zhonghua Gate, Bao'en, boat route markers.
   - **The first build ran more than 13 minutes and was stopped.** Next: add `time` laps to `main()` and run `blender -b --factory-startup --python blender/build_oldsouth.py -- --no-render` to find the slow step. Suspects: `build_houses` (many `add_box` calls per house), `river_line()`, or `plant()` over all water polygons.
   - Then run `./tools/export-scene.sh oldsouth --render`, review `design/oldsouth/lookdev-*.jpg`, and fix what looks wrong.
2. **Web, written but untested:** pleasure boats and the boat ride in `src/landmark-world.js` (`board`, `leaveBoat`, `rides`, `docks`); the Old South pins in `src/nanjing.js` `WORLDS` (qinhuai, zhonghua, mendong → `oldsouth`, sunset). **Entering those pins fails until `public/scenes/oldsouth/` exists.**
3. **Tests:** `tests/worlds-browser.mjs` (new) is not run yet. `tests/city-browser.mjs` and `city-game-browser.mjs` now skip world pins via `city.worldPins`.

## After that

- The remaining batch B landmarks: Ming Xiaoling, Presidential Palace, Yangtze Bridge, Niushou, Qixia.
- The illustrated floor-plan map, the season dial, and a real-phone benchmark.
- Nothing is pushed. `main` (production) is untouched.
