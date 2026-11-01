# Xuanwu Lake, more real: plan

The owner, 1 November 2026: research the Xuanwu Lake data to make it more real; "the hottest
natural park". The evidence is in [research/xuanwu/FACTS.md](../research/xuanwu/FACTS.md).

## Today

- **In the city:** the lake and five islands come from OSM, with generic shore willows and the
  few OSM buildings on the islands. The islands are unnamed and have no landmarks.
- **In the North world** (`blender/build_north.py`), a hand-built version: the Taicheng wall,
  Xuanwu Gate with its pavilions, the lake, lotus, bridges and willow shores, made for a separate
  scene.

## Plan (in the city build, after the Purple Mountain extension's first build)

| Part | Plan | Basis |
| --- | --- | --- |
| Islands named | Each OSM island named by position (Huanzhou ring, Yingzhou inside it, Liangzhou north, Cuizhou east, Lingzhou southeast); labels and place cards in English first | OSM relation 2138994; areas match the official figures within 5% (Lingzhou +24%, flagged) |
| Each island's character | Huanzhou: willows all round, the misty-willow shore, rose garden, lotus square. Yingzhou: a cherry "flower sea", the flower clock of spring. Liangzhou: the ginkgo avenue, chrysanthemum beds in autumn, potted-landscape garden. Cuizhou: pine, cypress, willow and bamboo, a long green embankment. Lingzhou: open lawns facing Purple Mountain, water caltrop in the shallows | Official island pages; research/plants |
| Wall and gates | Bring the North world's Taicheng wall, Xuanwu Gate and Jiefang Gate into the city at their OSM ways, walkable on top from the stair entries | OSM ways 89637327, 940335843, 1061607219, 95918082, 1061610840 |
| Bridges | The named OSM bridges as real footbridges (arched stone or flat), walkable, with their names on approach | 14 named OSM bridges plus the boardwalk |
| Landmarks | Lama Temple and Nuona Pagoda, Guo Pu Pier (the mound, the lake's high point), Lansheng Building, Lake God Temple site, the Ming Archive hall, the Tailing Flower Stand: modelled in the illustrated style. **Placed from descriptions** (island and side): OSM, Wikidata and the official site give no coordinates. Labelled as approximate | research/xuanwu/FACTS.md |
| Water life | Lotus beds in summer, the rental boats at the OSM piers (the boat mode launches there), pleasure boats on a loop | 10 OSM piers; lotus placement an assumption |
| Seasons | Cherries in late March to April on Yingzhou; lotus June to August; ginkgo gold and chrysanthemums in November on Liangzhou | research/plants/FACTS.md |

### Audits

- **Islands:** each named island's OSM area is within 10% of the official figure; report Lingzhou
  as a known +24%.
- **Bridges:** every named bridge is walkable end to end, and each island is reachable on foot
  from Xuanwu Gate.
- **Wall:** the wall top is walkable from both stair entries.
- **Landmarks:** each stands on its island, with no building in the water.
