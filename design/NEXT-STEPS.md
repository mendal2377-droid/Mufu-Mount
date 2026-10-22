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
| qixia | qixia | `blender/build_qixia.py` | Built: temple halls facing west over the pond, relic pagoda, Thousand Buddha Cliff, red boardwalk through maples (autumn) |
| skyline | (all worlds) | `tools/research/skyline-prep.py` + `blender/build_skyline.py` | OSM 3D parts of every 60 m+ tower; loaded into each world by origin |

Rebuild one world: `./tools/export-scene.sh <id> [--render]`. The skyline: run its two commands, then gltf-transform (see the build_skyline.py docstring).

## Resume here

All ten landmarks now have worlds: Zhongshan (with Ming Xiaoling), North (Jiming, Xuanwu), Old South (Qinhuai, Zhonghua), Palace, Bridge, Niushou and Qixia. Each passes `tests/worlds-browser.mjs` (run it against `vite preview` on localhost:4190). Niushou and Qixia have been seen only in the Blender look-dev renders, not in the web view, so check them by eye in the browser.

## Next

- The illustrated floor-plan map, the season dial, the 2016 / today skyline toggle, and a real-phone benchmark.
- Train rumble sound on the bridge deck: the camera shakes now, but there is no audio yet.

Nothing is pushed. `main` (production) is untouched.
