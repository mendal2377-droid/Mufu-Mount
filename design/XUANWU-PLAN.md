# Xuanwu Lake, more real: plan

The owner, 1 November 2026: research the Xuanwu Lake data to make it more real ("the hottest
natural park"). Then the priorities: **"The core of the xuanwu lake are entrance buildings, plants
on the earth and water, trees, walkable roads, waters, fishes."** The evidence is in
[research/xuanwu/FACTS.md](../research/xuanwu/FACTS.md).

## Today

- **In the city:** the lake and five islands come from OSM, with generic shore willows. The islands
  are unnamed, the entrances unmarked, and there is nothing alive in the water.
- **In the North world** (`blender/build_north.py`), a hand-built version: the Taicheng wall, Xuanwu
  Gate with its pavilions, lotus, bridges and willow shores, made for a separate scene.

## The six cores, in order of work

| # | Core | Plan | Basis |
| --- | --- | --- | --- |
| 1 | **Water** | The lake surface at its real managed level (9.8 m), clear and shallow-coloured near the shores, darker in open water. Ripples, and reflections of the wall and Purple Mountain. Boats from the 10 OSM piers | Hohai 2023 water levels; OSM piers |
| 2 | **Walkable roads** | All 29.9 km of footways, the pedestrian streets and the 39 bridges walkable, at real widths. Bridges arched or flat by type, named on approach. Every island reachable from every entrance | OSM, in the park polygon |
| 3 | **Entrance buildings** | Xuanwu Gate (three arches through the Ming wall, pavilions on top) and Jiefang Gate, from the North world's models, placed on their OSM ways with the wall top walkable. The modern east gates (Lovers' Garden, Ten-li Embankment) and the six OSM entrance points as gateways, simple until photos show their real look. Each with a name board, in English first | OSM ways 940335843, 1061607219; entrance nodes |
| 4 | **Trees** | By island character: Huanzhou willows all round its shore; Yingzhou cherries; Liangzhou's ginkgo avenue; Cuizhou pine, cypress and bamboo; Lingzhou open lawns with scattered trees so Purple Mountain shows. Willows along the city shore and the embankments | Official island pages; research/plants |
| 5 | **Plants on land and water** | On land: flower beds (the rose garden on Huanzhou, chrysanthemums on Liangzhou in autumn, the cherry flower sea in spring). In water: lotus beds covering no more than about 13% of the lake, in sheltered bays between the islands; water lilies at the Liangzhou garden and waterfall pools; caltrop off Lingzhou; a few reed edges. Lotus flowers June to August, leaves brown in winter | Hohai 2023 (13.2% coverage); yzwb 2025 (water lilies) |
| 6 | **Fish** | Schools of silver and bighead carp moving under the surface, seen from bridges and boats, with now and then a jumping culter. They scatter from boats; none in winter's cold shallows | Journal of Lake Sciences 1997 (species); annual releases |

Landmarks on the islands (Lama Temple, Nuona Pagoda, Lansheng Building, Guo Pu Pier) come after
the six cores, **placed from descriptions** and labelled approximate.

### Audits

- **Water:** the built lake surface is within 0.5 m of 9.8 m (in the city's height frame), and every
  pier and bridge meets the water.
- **Walk:** each island is reachable on foot from Xuanwu Gate, Jiefang Gate and an east gate, and
  every named bridge is walkable end to end.
- **Entrances:** each OSM entrance point stands on walkable ground with a gateway.
- **Water plants:** lotus and lily beds cover between 5% and 15% of the lake, none on a boat route.
- **Islands:** each named island's OSM area is within 10% of the official one; Lingzhou is reported
  as a known +24%.

## Status

**Phase 1, 8 November 2026** (build 10; `blender/core_xuanwu.py`, tests/xuanwu-browser.mjs):

- **Walk:** all 15 routes from Xuanwu Gate, Jiefang Gate and the Cuizhou gate to the five islands
  pass on the 2 m walk grid, and so does a walk through Xuanwu Gate's passage onto the lake. All 26
  OSM park bridges are walkable end to end.
- **Entrances:** all 6 OSM entrance points stand on walkable ground. Each gate and island has a name
  board, English first.
- **Trees** by island: 1213 on Huanzhou, 1042 on Yingzhou, 1183 on Liangzhou, 1221 on Cuizhou, 382
  on Lingzhou.
- **Water plants:** lotus beds cover 8% of the lake (9200 plants).
- **Fish:** schools under the surface.
- **Not done:**
  - The wall is plain grey.
  - Xuanwu Gate has one square passage; the real gate has three arches.
  - The lotus beds read as khaki flats in autumn.
  - **Water audit not met:** the lake stands at 6.45 m in the city's frame, not the plan's 9.8 m.
    Which datum each number uses is not yet known.
  - The island landmarks have not started.
- **How build 10 was made:** its last two fixes were patched into the saved scene, not built from
  scratch, and the next full build makes them from the code:
  - no trees on the lake's stone decks;
  - water bands overlapping 0.6 m.
- **The grey lines across the lake** seen from high above were the lake bed fighting the water in
  the depth buffer. The near plane now follows the camera's height (`src/landmark-world.js`).

## Phase 2, first: Xuanwu Gate as it really looks (the owner, 9 November 2026: "far too different from the real gate")

**The real gate:**
- **Sources:**
  - Photographs on Wikimedia Commons ("南京玄武门.jpg", 2013, CC BY-SA 3.0, and others of the street face).
  - [The Nanjinger](https://thenanjinger.com/?p=26004).
  - [Yangtse Evening Post, Aug 2025](https://www.yzwb.net/news/jiangsu/nanjing/202508/t20250826_255298.html).
- **History:**
  - Opened in 1908 as Fengrun Gate, with one arch.
  - Renamed Xuanwu Gate in 1928.
  - The name plaque was written by Cai Yuanpei in 1929.
  - Widened to three arches in 1931.
  - The tower on top dates from 1984.
  - Restored in 2024–25. It had green roof tiles and a cracked main arch.
- **Its face, street side:**
  - The wall is coursed stone in a warm grey-brown.
  - It has **three equal round-headed arches**. Each sits in a broad pale blue-green ring patterned with clouds. The middle arch has red doors and is usually shut; visitors use the side arches.
  - A dark plaque with gold characters, 玄武门, hangs above the middle arch.
  - A pale stone balustrade runs along the top.
- **On top:**
  - A long one-storey gallery hall with red columns and gold railings, under a green glazed roof with upturned eaves.
  - At its two ends, taller two-storey pavilions with green hip-and-gable roofs.
- **Sizes:** no published dimensions were found. These are scaled from the photograph by the guards standing at the gate face, so they are approximate:
  - arch openings about 4.4 m wide and 5.5 m high;
  - the arch rings' outer edge at about 7.3 m;
  - the wall top at about 10.2 m, plus a 1.1 m balustrade;
  - the gate block about 30 m wide.
- **The lake face:** the same as the street face (the owner, 9 Nov): plaque, rings, balustrade and the tower's colonnade on both sides.

**What the city has now (build 10):**
- one square passage through a 15 m grey wall;
- two small vermilion pavilions with dark roofs, 34 m apart.

**The build:**
1. **The gate block** (`core_xuanwu.xuanwu_gate`). It is 30 m along the wall, full thickness, at the photograph's height.
   - Three round-headed passages go through it.
   - The two side passages are walkable. The middle one has red doors and is shut, as it usually is.
   - Each passage gets a blue-green ring on both faces.
   - The plaque hangs over the middle arch, on both faces.
   - The stone is a warmer grey-brown than the Ming brick elsewhere.
2. **The wall beside the gate.** In the photograph it stands at the gate's height, so the wall within 150 m of the gate is lowered to 11 m. Beyond that it steps up to the city's 15 m (an assumption, FACTS: 14–25 m).
3. **The tower.**
   - A 26 m gallery hall: red columns, gold railings, a green glazed roof.
   - At each end, a two-storey pavilion with a green hip-and-gable roof (`kit_oldcity.hall`, `roof_green`).
4. **Checks.**
   - The Xuanwu test still walks through the gate, now by a side arch.
   - Screenshots of the street face and the lake face, compared with the photograph.
