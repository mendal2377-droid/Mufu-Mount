# Mufu Mountain in Tiny Nanjing: the merge

The owner (1 November 2026): "add the Wutang Square station as a walkable site, and merge the
mountains of Mufu into the big city map as explorable scenes", then "we have built a detailed
Mufu Mount model in the app, but it is in a separate entrance". So the app's own detailed model
(`public/world`, the morning walk's landscape, from `Mufu_Mountain_Hike_Photo_Updated.blend`) is
placed into the city at its real place, rather than a second Mufu being generated from map data.

## Where it goes

| Fact | Value | Source |
| --- | --- | --- |
| Western end of the riverside promenade | 草鞋峡遇难同胞纪念碑, city (−1647, 8552) m | OSM node, Overpass 1 Nov 2026 (`research/core/data/osm-core-mufu-anchors.json`) |
| Eastern end, Swallow Rock's riverside | 燕子矶江滩遇难同胞纪念碑, city (2793, 12007) m | same |
| The model's promenade | from (0, 0) to (4732, 3629 north) m in its own frame | `public/world/routes.json`, "Yangtze promenade" |
| Fit | 0.943 horizontal scale, 0.4° turn, promenade ends on the memorials | `blender/mufu_merge.py` |
| Check against OSM footpaths | model paths within 20–25 m of OSM's (median), as an artist's model | `research/mufu-merge/fit.json` (rigid fit without scale) |
| Heights | the model's metres kept; its river level (0) set on the city's Yangtze level | `mufu_merge.river_level` |
| Shangyuanmen station | 40 m from OSM's Mufu Mountain wood (幕府山, OSM 62344629) | `research/transit/FACTS.md` |

## What is whose

- The model keeps its land only where the real mountain and riverside are: inside OSM's Mufu
  Mountain wood, or north of the old map edge (8432 m north of Xinjiekou). Its woodland reached a
  kilometre further south over the streets round Wutang Square; those stay the city's (OSM).
- Inside the model's land, OSM buildings, roads, infill, street trees and lamps keep out; the
  city's ground lies 2.5 m under the model. Outside it, the city is built from OSM as everywhere.
- The model's trees stand where it put them, drawn as the Mufu Mountain wood's researched mix
  (camphor, broadleaf, cedar, wingnut; `research/plants/FACTS.md`).
- Walking: a 3 m grid over the model (steps up to 1.3 m, for its stairs and slopes) and a 4 m grid
  over Wutang Square and Xiaoshi. Line 3's Shangyuanmen, Wutang Square and Xiaoshi are walkable.
- The original morning walk, with its photographs, stays as its own entrance ("Detailed Mufu
  walk" in the menu); the home page's Mufu Mountain card now enters the city at the hike's start.

## Assumptions

- The model is an artist's model ("approximate" in its own scene file): its paths and slopes are
  close to, not the same as, the real ones.
- Where the model's land meets the city's, the two grounds are joined as they are; the seam is
  checked by eye.
