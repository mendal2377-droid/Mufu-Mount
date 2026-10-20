# Shape audit: main buildings and the skyline (20 October 2026)

The owner asked that the core city's main buildings, including the modern towers, have the right
shape, so a visitor recognises Nanjing at first sight. Each building was compared with a reference
photograph (the owner's own `D:\blender\nanjing`, or Wikimedia Commons viewed in the browser,
inspection only) and with published figures. Close-up renders: `design/<world>/lookdev-audit-*.jpg`.

| Building | Reference | Was wrong | Now |
| --- | --- | --- | --- |
| Sun Yat-sen Sacrificial Hall | Owner's photo `zhongshanling/1a1e7fe4…` | Upper roof a plain hip | **重檐歇山**: hip-and-gable upper roof (kit `gable=`); four bastions, lower eave, three arched doors as before |
| Zhongshan Stele Pavilion | Owner's aerial photo | Plain hip upper roof | Hip-and-gable |
| Meiling Palace | Published description (重檐歇山, green tiles, yellow walls, red columns, 34-post terrace) | Plain hip upper roof | Hip-and-gable |
| Jiming Yaoshi Pagoda | Owner's photos; ctrip; OSM `height=44.8` | (Atlas had nine storeys) | **7 storeys, 8 faces**, yellow walls, red balconies, dark eaves, ~45 m |
| Jiming main hall | Owner's aerial photo | Plain hip | Double-eave hip-and-gable |
| Jiming gate | Owner's aerial photo | A solid hall blocking the axis | Open three-bay timber gateway |
| Fuzimiao Dacheng Hall | Commons *The Dacheng Hall of Nanjing Confucian Temple*; ctrip 45.69 × 24.85 m, 24.8 m on a 2.1 m base | 30 × 18 m vermilion hall, plain hip | 44 × 23.5 m, dark timber front, **double-eave hip-and-gable** in dark grey tile, white stone terrace with balustrade and stair, bronze Confucius in front |
| Kuiguang Pavilion 魁光阁 | Commons *KuiGuangGe of Nanjing Confucian Temple* | Three gold-roofed tiers, glowing walls | **Three storeys, octagonal, red timber, dark grey tile**, pointed 攒尖 top with tall finial, rising behind a long single-storey riverside hall (gold in dusk photos is lamplight) |
| Lingxing Gate 棂星门 | Commons *LingXingMen…* | A timber hall | **Stone gateway**: four white posts with cloud caps, beams, carved side panels, open centre |
| Juxing Pavilion 聚星亭 | Commons *Juxing Pavilion of Fuzi Miao* | Gold roof | Hexagonal, double eave, red timber, grey tile, gold finial |
| Great Screen Wall 大照壁 | Commons *Nanjing FuziMiao DaZhaobi2* | Plain red wall | 110 × 10 m red wall, grey tile coping, **two long gold dragon reliefs** and a wave band |
| Tianxia Wenshu paifang | Owner's photos | Gold roofs | Dark timber, grey tile roofs |
| Zhonghua Gate | Commons *2004_0928 Nanjing ZhongHuaGate*; archives | 27 vaults as rows of windows on the outer face (read as an office block) | Plain outer face with one great arch and crenellations; **pale stone ashlar lower two-thirds, brick above**; vaults on the inner court walls |
| Bao'en Tower | Commons *New Nanjing Porcelain Tower illuminated at night*; OSM 78.2 m | A curved-roof pagoda | **Slim, nearly straight octagonal glass shaft**, nine storeys with thin flat ledges, small pointed cap, tall spire, glowing pale green-white |
| **Skyline** (Zifeng, Deji Plaza, Golden Eagle World, Jinling Hotel phase 2, Nanjing Center, IFC, TV Tower and ~5,500 other parts of 60 m+) | OSM Simple 3D Buildings parts (min_height..height); Wikipedia list of tallest buildings | One hand-made Zifeng blade and plain extruded blocks per world | **Shared skyline from OSM 3D parts** (Zifeng's real stepped stack and spire), TV tower modelled as a needle with a pod, Golden Eagle World's sky podium; floor bands, mullions and dusk-lit windows; seen from every world at its true position |

## Not yet checked or known gaps

- **Presidential Palace, Yangtze Bridge, Ming Xiaoling, Niushou, Qixia** are batch B and still atlas-only.
- **Xinjiekou street level** (the Sun Yat-sen statue on the roundabout, shopfronts) is not modelled; Xinjiekou appears as skyline only.
- **Towers OSM tags without parts** are plain prisms with flat tops. Crowns (for example the Jinling Hotel's revolving restaurant) are only as good as OSM's tagging.
- **Then and now:** Golden Eagle Tiandi (2019), Deji WTC (2022), Two IFC (2021) and the Financial City towers postdate a 2016 visit. A 2016 / today toggle is possible; not built.
