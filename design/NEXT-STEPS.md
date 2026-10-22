# Where the rebuild stands (21 October 2026)

Branch `rebuild/blender-city`. Plan: [REBUILD-PLAN.md](REBUILD-PLAN.md). Art: [ART-BIBLE.md](ART-BIBLE.md). Shapes: [SHAPE-AUDIT.md](SHAPE-AUDIT.md).

## Worlds (public/scenes/*)

| World | Pins | Build | State |
| --- | --- | --- | --- |
| zhongshan | zhongshan | `blender/build_zhongshan.py` (+ `zhongshan_meiling.py`) | Done: Mausoleum, Music Stage, Meiling necklace, gates, music |
| north | jiming, xuanwu | `blender/build_north.py` | Done: temple, Taicheng, lake, lotus, cherries, bell |
| oldsouth | qinhuai, zhonghua, mendong | `blender/build_oldsouth.py` | Built: Fuzimiao, Qinhuai boats and ride, Laomendong, Zhonghua Gate, Bao'en |
| palace | palace | `blender/build_palace.py` | Built: 1929 gate (walk-through arch), great hall, Zichao Building, West Garden and marble boat |
| bridge | bridge | `blender/build_bridge.py` | Built: truss, piers, bridgeheads with red flags, deck walkways (diagonal walk grid), park, trains/barges/cars |
| niushou | niushou | `blender/build_niushou.py` | Built: lattice robe, gold dome on its arcaded drum and moat, Foding Pagoda (88 m), plaza, Chan park |
| skyline | (all worlds) | `tools/research/skyline-prep.py` + `blender/build_skyline.py` | OSM 3D parts of every 60 m+ tower; loaded into each world by origin |

Rebuild one world: `./tools/export-scene.sh <id> [--render]`. The skyline: run its two commands, then gltf-transform (see the build_skyline.py docstring).

## Resume here

1. Niushou passes the worlds test; check it by eye in the browser (only the Blender look-dev renders have been seen).
2. Qixia: the OSM extract and area prep are done (`research/qixia/data`). Write `build_qixia.py`: the temple, the five-storey relic pagoda, the Thousand Buddha Cliff, autumn maples.
3. All other worlds pass the worlds test (21 October).

## Next

- Batch B: Niushou (`research/niushou/FACTS.md`) and Qixia (`research/qixia/FACTS.md`). OSM extracts are not downloaded yet.
- The illustrated floor-plan map, the season dial, the 2016 / today skyline toggle, and a real-phone benchmark.
- Train rumble sound on the bridge deck: the camera shakes now, but there is no audio yet.

Nothing is pushed. `main` (production) is untouched.
