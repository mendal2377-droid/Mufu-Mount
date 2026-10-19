# North world: Jiming Temple, Taicheng, Xuanwu Lake

19 October 2026. Local frame: metres from the Jiming atlas anchor (32.0630502 N, 118.79003095 E),
x east, y north. Data: `data/osm-north.json` (Overpass, ODbL), Copernicus GLO-30 crop
(`tools/research/area-prep.py north`).

| Fact | Value | Source | Confidence |
| --- | --- | --- | --- |
| Yaoshi Pagoda 药师佛塔 | **7 storeys**, 8 faces, 44.8 m | [ctrip](https://gs.ctrip.com/html5/you/sight/nanjing9/1484707.html); OSM way 957807762 `height=44.8` | High (two sources agree). The atlas's 7 October change to "nine" was wrong and is superseded |
| Pagoda footprint | Centre (−11.5, 19.5) | OSM | Measured |
| Temple stair axis | Gate (36, −96) → pagoda; OSM steps way at (3..55, −104..−87) | OSM | Measured direction; terrace heights (+6, +11 m) assumed |
| Halls | Peach-pink halls with grey roofs either side of a stone axis; yellow walls; dark red main hall | Owner's photos `D:\blender\nanjing\jimingshi` | Visual |
| Jiming Road cherries | Peak late March; road and temple form the classic view | [yzwb 2026](https://www.yzwb.net/news/jiangsu/nanjing/202603/t20260323_334415.html) | High |
| Taicheng and lakeside wall | 20–25 m from ground to parapet (Taiping Gate–Xuanwu Gate stretch, "longest and best preserved") | ctrip travel note | Low; model uses 14–15 m above the graded ground |
| Wall lines | Taicheng way 89637327, lakeside 95918075, east 237044575 | OSM | Measured |
| Jiefang Gate / wall access | Gate ways 1061607219/1061610836; 解放门登城口 steps at (100..107, 189..202) | OSM | Measured |
| Xuanwu Gate 玄武门 | (−721, 1058); formerly Fengrun Gate, renamed 1928 | OSM; [wanderinchina](https://www.wanderinchina.com/zh/destinations/nanjing/city-wall/) | Measured position; two pavilions on top from the owner's photo |
| Lake | OSM relation 2138994; five islands 环洲 樱洲 梁洲 翠洲 菱洲 | OSM; [wanderinchina](https://www.wanderinchina.com/zh/destinations/nanjing/xuanwu-lake/) | Measured |
| Lotus | June–July; south-west shallows, Huanzhou | [bendibao](https://m.bendibao.com/show624654.html) | Medium |
| Zifeng Tower | ~450 m with spire, at (−1137, −40) | atlas anchor (OSM way 140809508) | Height approximate |

Assumptions: bare ground is a 150 m minimum filter of the DSM; the lake surface is the median of
that over open water; temple terraces are designed; all city blocks are OSM footprints extruded to
tagged height or 14 m.
