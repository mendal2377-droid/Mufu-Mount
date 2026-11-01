# Tiny Nanjing: city systems

The owner's rule (1 November 2026): rebuild the city "with an engineering mind". Every system rests
on researched real data, and an automated audit proves the result. This file is the map. Each
system's data, where it is built, and what checks it.

Run the audits after every city export (`./tools/export-scene.sh core`):

    python -P tests/road-audit.py core      # roads open; writes test-results/road-blocks-core.json
    python -P tests/city-audit.py core      # water, waterways, trees, walkability
    D:/soft/blender/blender.exe -b art-src/core.blend --python tools/road-blockers.py -- core   # name what blocks a road
    D:/soft/blender/blender.exe -b art-src/core.blend --python tools/scene-audit.py -- core     # trees in buildings, buildings in water, heights
    python -P tests/transit-audit.py core   # bus on roads, stops, stations, continuity, viaduct

## Systems

| System | Real data | Built in | Rules | Audit |
| --- | --- | --- | --- | --- |
| **Terrain** | Copernicus GLO-30 DSM (bare ground = 150 m minimum, blurred) | `area_common.Area`, `build_core.ground` | Water beds lie below their water level | `city-audit` banks |
| **Roads** | OSM highways: class, lanes, width, bridge, tunnel, layer | `build_core.build_roads` | Widths by class or lanes; tunnels left out; bridges rise 7 m; pavements beside avenues; road cells marked by odd centimetres in walk.bin | `road-audit` (< 1 % of centreline samples blocked); `road-blockers` names causes |
| **Buildings** | OSM buildings and 3D parts: height, min_height, levels, colours; 南京新百 and the rest by name | `build_core.build_buildings` | Outlines with parts are replaced by the parts; underground (layer < 0) and construction plots skipped; parts 3 m+ up are Overhead (walkable beneath) | `road-audit` (nothing on roads); `city-audit` markers; `scene-audit` heights (2–460 m) |
| **Infill** | Where OSM maps no buildings: the typical compound of 6–7 storey slabs (**assumption**, stated in provenance) | `build_core.build_infill` | Whole footprint probed every 4 m against buildings, roads, water and green | `road-audit` |
| **Water** | OSM water polygons (multipolygons stitched in `area-prep.py`), waterway centrelines | `build_core` water section | One level per water body from its banks' bare ground; line-only rivers and canals buffered to width (river 14, canal 10, stream 4 m) | `city-audit` water, banks, waterways; `scene-audit` buildings in water |
| **Plants** | `research/plants/FACTS.md`: 2026 street-tree census (camphor 26 %, plane 17 %), named plane avenues, ginkgo and cherry places, phenology | `build_core` trees section; `SEASONS` in `src/landmark-world.js` | Named plane roads; one species per street by census share; zones by OSM polygon; willows on lake shores; crowns clear of buildings; seasons by researched dates; trunks 3 m clear of water | `city-audit` trees; `scene-audit` trees in buildings |
| **Street lamps** | Lamps along every avenue's pavement (spacing 28 m: **assumption**) | `build_core.build_roads` | Pools of light drawn on the same 28 m rhythm | `city-audit` trees (lamps on bridges allowed) |
| **Walkability** | The exported walk grid | `export_web.walk_grid` | Walkable materials; trunks stamped out; Overhead skipped | `city-audit` markers, reachable |
| **Metro and buses** | `research/transit/FACTS.md`: OSM route relations for Metro Lines 1, 2, 3, 4 and Buses 1, 25 (representative lines through Xinjiekou and Gulou), stations and stops, line colours; Line 1's viaduct (OSM bridge=yes); speeds and headways | `tools/research/transit-prep.py`, `tools/transit-heights.py`, `src/transit.js` | Buses on the right, 18 km/h, 12 s at stops; metro underground shown from above; Line 1 trains on the viaduct at 65 km/h, about 3 minutes apart | `tests/transit-audit.py`; `tests/transit-browser.mjs` |
| **Transport** | Roads (bike), water.bin (boat), the walk grid (on foot) | `src/landmark-world.js` drive() | The bike keeps to road cells; the boat to water | `tests/ways-browser.mjs` |
| **Time, weather, seasons** | Sunrise and sunset by season for Nanjing; window lights through the night | `src/main.js` clock | Moods are presets of the clock | `tests/world-shots.mjs` (by eye) |

## Found and fixed by the audits (1 November 2026)

- An infill slab stood across Zhongshan Road; corner probes missed the 11 m carriageway.
- The Zhujiang Road metro station (layer −1) was drawn above ground on Zhongshan Road.
- `Mask` combined overlapping polygons with XOR, so road junctions and dual carriageways became holes where slabs and trees were placed.
- Construction plots mapped over Yunnan Road, Zhongfu Road and Jianning Road.
- A water surface took its level from rooftops and floated 8 m up over Jiefang South Road.
- The inner Qinhuai (运渎) and the Pearl River existed only as lines and were never drawn.
- A pond's bed came out above its own water.
- The Xinjiekou spawn stood inside 南京新百.
- The 12–24 m terrain grid rose through canals narrower than a cell; ground within one cell of water now drops just under its level as a stone bank.
- Shore willows stood on the water's edge, in the cells the boat uses; trunks keep 3 m from water.
- The Zhongshan Road spawn stood on a street tree's trunk.
- 21 OSM waterway lines are culverts (`tunnel=culvert`); drawn open they ran under houses. A river under a mapped building is culverted there.
- Lake outlines ear-clipped across their own shores laid water over the land; lakes are now scanfilled and clipped to the outline.
- 465 street lamps and 50 trees stood inside building footprints; a final pass culls anything under a roof, or on a carriageway or water.
- The paraglider's bounds read single-grid fields that multi-grid worlds no longer have, so flying in the city went to NaN (a black screen).
