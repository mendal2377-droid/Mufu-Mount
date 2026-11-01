# Xuanwu Lake 玄武湖: research pack

1 November 2026. The owner: "the hottest natural park"; make it more real. **Measured** means a
published or OSM figure, with its source. **Assumption** is our choice, to be checked.

## Size

| Figure | Value | Source |
| --- | --- | --- |
| Scenic area | 5.13 km²: water 3.78 km², land 1.35 km²; "five islets, one park, one road" | Official site, [xuanwuhu.net](https://www.xuanwuhu.net/english/) |
| Lake (other measure) | 444 ha, 15 km shoreline | [Wikipedia](https://en.wikipedia.org/wiki/Xuanwu_Lake) |
| OSM lake polygon (relation 2138994) | 398 ha, the five islands as holes | research/core/data/features.json |
| Depth | Not found in sources | **Assumption**: shallow (about 1–2 m); only matters for boats and colour |

## The five islands (五洲)

In 1929 the park was called the "Five Continents Park" (五洲公园). The official site gives the
areas below. OSM's outlines are islands of relation 2138994, identified by position.

| Island | Official area | OSM area (centre, city frame) | Old name | Signature scene and planting | Landmarks (official list) |
| --- | --- | --- | --- | --- | --- |
| Huanzhou 环洲 | 12.77 ha | 13.11 ha (447, 3616): the west ring, which embraces Yingzhou "like a jade jue" | Asia | **环洲烟柳 Huanzhou Mists and Willows** | Guo Pu Pier 郭璞墩 (a mound in the northwest, the highest point in the lake area), Lama Temple 喇嘛庙, Nuona Pagoda 诺那塔, the "Boy Worshipping Guanyin" stone 童子拜观音石, the Mi Fu Worshipping Stone, Rose Garden, Lotus Square, a rockery with a waterfall and Taihu stones |
| Yingzhou 樱洲 | 6.59 ha (the site gives the same figure as Cuizhou, so it may be a copy error) | 6.78 ha (474, 3568): inside Huanzhou's ring | Europe | **樱洲花海 Yingzhou Flower Sea**: cherries. A cherry orchard since the Qing; Kangxi favoured its cherries as tribute | Yingzhou Corridor, Cherry Garden, Spring Pavilion, Friendship Woods, a lotus garden. In 1911 a temporary airfield for the Flying Corps |
| Liangzhou 梁洲 | 8.81 ha | 9.28 ha (544, 4086): north | America | **梁洲秋菊 Liangzhou Autumn Chrysanthemums** (the annual show); a ginkgo avenue (research/plants) | Lake God Temple site 湖神庙, the Ming Archive exhibition hall (the Houhu Huangce repository), Lansheng Building 览胜楼, Wenji Pavilion, Friendship Hall, Jinling Potted Landscape Garden |
| Cuizhou 翠洲 | 6.59 ha | 6.76 ha (1003, 4007): east | Africa | **翠洲 Cuizhou Trees**: pine, cypress, willow and bamboo; a long green embankment across the water | Huazi Garden, Cuizhou Boardwalk, the returned-students memorial |
| Lingzhou 菱洲 | 10.42 ha | **12.87 ha** (916, 3132): southeast, facing Purple Mountain | Australia | **菱洲山岚 Lingzhou Mountain Mists**, looking at Zhongshan; once thick with water caltrop 菱 | Tailing Flower Stand 台菱花架 (the view to Zhongshan and Xiaojiuhua), Tailing Bridge, children's playground |

**Discrepancy:** OSM's Lingzhou is 24% larger than the official figure. The other four are within
5%. Its outline probably takes in shore or causeway land; to check against imagery before trusting
its edge.

## Walls, gates and bridges (OSM)

- **The Ming wall along the west and south shore** (台城 Taicheng, way 89637327). Gates:
  - 玄武门 Xuanwu Gate, way 940335843 (32.0726, 118.7824);
  - 解放门 Jiefang Gate, way 1061607219 (32.0641, 118.7914);
  - the wall-top stair entries 95918082 and 1061610840.
- **Named bridges** in OSM: 翠桥 Cui, 樱桥 Cherry, 芳桥, 白桥 White, 月影桥 Moon-shadow, 莲桥 Lotus,
  十里桥, 观山桥 Mountain-view, 听水桥, 钟毓桥, 和平桥 Peace, 芙蓉桥 Hibiscus, 旭桥, the 七星旱桥
  dry bridge, and a boardwalk 栈道.
- **10 piers** (`man_made=pier`) for the boats.

## Not in OSM

OSM maps none of the island landmarks above (Lama Temple, Nuona Pagoda, Lansheng Building, Guo Pu
Pier). Their positions will come from the official park map, placed against the OSM island
outlines, and are to be labelled as *placed from the park map*, not surveyed.

## Sources

- [Xuanwu Lake official site (English)](https://www.xuanwuhu.net/english/), island pages
  [Liangzhou](https://www.xuanwuhu.net/english/scenic-detail.aspx?mtt=271),
  [Cuizhou](https://www.xuanwuhu.net/english/scenic-detail.aspx?mtt=272),
  [Huanzhou](https://www.xuanwuhu.net/english/scenic-detail.aspx?mtt=273),
  [Yingzhou](https://www.xuanwuhu.net/english/scenic-detail.aspx?mtt=274),
  [Lingzhou](https://www.xuanwuhu.net/english/scenic-detail.aspx?mtt=275)
- [Wikipedia: Xuanwu Lake](https://en.wikipedia.org/wiki/Xuanwu_Lake)
- [ctrip: 玄武湖](https://you.ctrip.com/sight/nanjing9/1674.html) (island scenes, Guo Pu Pier as the high point)
- research/plants/FACTS.md (the Liangzhou ginkgo avenue, about 4,300 cherries in 36 cultivars)
