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

## Entrances

| Entrance | Where | Building | Source |
| --- | --- | --- | --- |
| 玄武门 Xuanwu Gate (the west gate) | 32.0726, 118.7824 (OSM way 940335843); Metro 1 Xuanwumen | Ming wall gate with **three arches**, opened 1909 (as Fengrun Gate) for the Nanyang Industrial Exposition; tower pavilions on top | OSM; [ctrip travel note](https://gs.ctrip.com/html5/you/travels/9/4098485.html) |
| 解放门 Jiefang Gate (south) | 32.0641, 118.7914 (OSM ways 1061607219 and 1061610836); Metro 3 and 4 Jimingsi, walk north beside Jiming Temple's yellow wall | Ming wall gate; the wall-top stair entry beside it (way 95918082) | OSM; [wanderinchina](https://www.wanderinchina.com/destinations/nanjing/xuanwu-lake/) |
| 情侣园 Lovers' Garden / 十里长堤 Ten-li Embankment (east) | Bus to Suojincun; Metro 4 Gangzicun to the Ten-li Embankment gate | Modern park gate: **appearance unknown**, needs photos | ctrip/qunar notes |
| Six more entrance points, unnamed in OSM | nodes 1038862155 (32.0774, 118.7987), 1685028229 (32.0795, 118.7981), 2847802716 (32.0880, 118.7880), 2847860753 (32.0799, 118.7813), 3727336388 (32.0866, 118.7838); gate 4386530450 (32.0631, 118.8045) | Unknown | research/xuanwu/osm-entrances.json (Overpass, 1 Nov 2026) |

## Water, plants in the water, fish

- **Water level:** the managed summer level is **9.8 m**, with an ecological minimum of 9.6 m and
  9.9 m at germination time. This is the height the built lake surface should match
  ([Hohai University, 2023](https://jour.hhu.edu.cn/slsdkjjz/article/abstract/20230308)).
- **Which datum (checked 25 Nov 2026).** None of the sources names one. Other reported "normal"
  levels are 9.8 to 10.2 m ([Baidu Baike](https://baike.baidu.com/item/%E7%8E%84%E6%AD%A6%E6%B9%96%E5%85%AC%E5%9B%AD/217739))
  and 10.2 to 10.3 m ([Nanjing Daily, 2016](https://news.sina.cn/2016-10-10/detail-ifxwrapv1167068.d.html)).
  - The Copernicus GLO-30 elevation model, which the city is built from, flattens the lake at
    **8.5 m above the EGM2008 geoid**. China's 1985 national datum is close to that geoid.
  - Water levels in the lower Yangtze are often given in the Wusong datum. In Shanghai,
    Wusong = 1985 + 1.68 m ([Shanghai Planning and Natural Resources Bureau](https://ghzyj.sh.gov.cn/cmsres/e6/e6d80f66205b45c8adb7a61dbca37905/636d66c646db3f56caa61dc4f1c87301.pdf));
    Nanjing's own offset was not found. A managed 10.2 m in Wusong would be about 8.5 m on the
    1985 datum, just what the elevation model shows.
  - So the park's figures are most likely Wusong heights. This is **our reading**, not stated
    anywhere.
- **Water plants:** they cover **13.2%** of the lake, submerged plants only 2.1%, against a target of
  30%. Lotus 荷花 is the emergent plant that has to be *held back* in summer (same source). So the
  lotus goes in beds along sheltered shores and between the islands, not over open water.
- **Water lilies:** nearly **40 varieties** shown at Liangzhou's Jinling Potted Landscape Garden and
  the rockery waterfall ([yzwb, June 2025](https://www.yzwb.net/news/shaonianhi/202506/t20250608_218656.html)).
- **Water caltrop 菱** gave Lingzhou its name (official site); reeds: not found in sources
  (**assumption**: a few reed beds at the quieter edges).
- **Fish:** the lake was called Nanjing's "live fish store". A 1997 study sampled **silver carp 鲢,
  bighead carp 鳙 and topmouth culter 翘嘴鲌**
  ([Journal of Lake Sciences, 1997](https://www.sciengine.com/doi/pdf/4B1FD6F85F59449DB90A186F222FB003)).
  The park releases fish every year
  ([yzwb, March 2026](https://www.yzwb.net/news/jiangsu/nanjing/202603/t20260327_335998.html)).
  Koi or red carp: not found in sources (**assumption**, only in the garden ponds if used).

## Walkable ways (OSM, inside the park polygon, way 62354287)

About **29.9 km of footway**, 1.4 km of pedestrian street, 4.9 km of service road, 0.4 km of path,
0.27 km of steps, and **39 bridges**. The trunk roads inside the polygon (7.9 km) are mostly the
tunnel and the avenue along its edge. No individual trees are mapped, so planting follows the
islands' published character.

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
