# Nanjing rebuild plan: Blender landmarks, explorable scenes, paraglide arrival

Draft, 17 October 2026. This is a plan only: nothing has been built or changed yet.
Comments marked **Advice** are where I think the brief should be adjusted.

---

## 0. Where we start from (facts checked in this workspace)

| What exists | Where | Reuse? |
| --- | --- | --- |
| Live app: illustrated 3D atlas of central Nanjing, 18 pins, walking, bird-kite flight, weather, the 金陵拾遗 collecting game | `Mufu-Mount/` (release `ae6b554`, working tree clean, 12 recent commits after it) | **Yes.** Keep the shell: weather/sky, postfx, kite flight, game, audio, tests. Replace the JS-generated city geometry. |
| City geometry is **generated in JavaScript** (`city-landmarks.js`, `city-scene.js`, `city-sets*.js`), not modelled | `src/` | This is why it looks "brutal": procedural boxes and prisms can't reach the detail you want. Blender replaces this layer. |
| Ten "best view" compositions already researched | `research/nanjing/BEST-VIEWS.md` | Yes, as the starting shot list. |
| Landmark evidence register, OSM snapshots (ODbL), corrected Xuanwu and Yangtze shorelines | `research/nanjing/` | Yes. Footprints, water and roads for the Blender base. |
| Painted gouache textures and style guide ("Spirited Away"-inspired, own interpretation) | `design/city/`, `public/city/art/` | Yes. Extend into a full art bible. |
| Your reference photos per landmark (~42 images, 10 folders) | `D:\blender\nanjing\` | Reference only (several have watermarks, unclear licence). |
| Detailed Mufu mountain scene (Blender export) and 153 private hike photos | `public/world/`, `Mufu_Project_2026-09-27/` | Keep as the 11th, personal scene. Photos stay private. |
| **Blender → web pipeline already proven** | `D:\blender\test0910\SmallVillage\scripts\export_web_models.py`, `export_navigation.py`, `compress_models.py` | **Yes.** Material-batched Draco GLB export, collision/stair navigation export. Adapt rather than write from scratch. |
| Blender 5.1.2 | `D:\soft\blender\blender.exe` | Works. The Blender MCP add-on is installed in the tooling but Blender isn't running now; I can also drive Blender headless from scripts. |

---

## 1. Advice on the brief (fact checks)

1. **"three.js has limits for detailed models": partly true.** three.js itself can draw millions of triangles. The real limits are **download size, GPU memory and draw calls on phones**. Blender fixes the *authoring* problem: hand-shaped roofs, brackets, stone animals and terrain that code can't produce. But a Blender city exported as one file would be hundreds of MB and would crash phones.
   → **Architecture:** one light **city atlas** (overview, ~8–12 MB) plus **one streamed GLB per scene** (~3–8 MB each), loaded only when you arrive. This is how Mufu already works as a separate world, so it's a proven pattern in this repo.
2. **The paraglide descent is also a loading screen.** The scene's GLB downloads during the 8–15 s descent, so the visitor never sees a progress bar. That makes your idea a technical win as well as a beautiful one.
3. **Satellite, map and photo data: use it for geometry and reference only.** OSM (ODbL, attribution already in the app) gives footprints, roads and water. The DEM gives terrain (see §5). Public photos and videos guide shape and composition, but can't become textures or be traced. All painted textures should be generated or painted by us, which the art style needs anyway.
4. **Coordinates:** keep WGS84. Chinese map sites (Gaode/Baidu) use GCJ-02/BD-09 offsets of several hundred metres. Don't mix them in. The repo already documents this.
5. **Miyazaki style:** keep it as *our own interpretation* of a hand-painted animated-film look: no frames, characters or claims of affiliation. This matches the existing style guide.
6. **Scope reality: 10 landmarks × 2–3 scenes ≈ 25 scenes.** Each needs modelling, painting, export, walk routes and interactions. Doing it all at once would mean shallow work everywhere. **Build one landmark completely first (vertical slice)**, measure it on a real phone, then roll out the rest in batches.
7. **Distance:** Niushou (~15 km south) and Qixia (~20 km northeast) are outside the walled core. On the illustrated map they become **edge vignettes** joined by a painted "journey" line rather than true-scale positions. Everything else fits inside or beside the Ming wall.
8. **Seasons make it unforgettable.** Each place has a season people travel for (cherry blossom at Jiming in late March, lotus at Xuanwu in June–July, golden plane trees in November, red maples at Qixia in autumn, plum blossom at Meihuashan in Feb–Mar). A season dial costs much less than new geometry and multiplies the explorable content.
9. **Hosting:** `*.vercel.app` is widely reported as unreliable or blocked from mainland China (not verified here). If Chinese visitors matter, plan a custom domain plus a CDN reachable in China. Decide before launch, not after.

---

## 2. The landmarks and scenes

The selection is based on travel-platform rankings (Trip.com 2025 Top 20; China Tourism Academy holiday data, where Confucius Temple–Qinhuai ranks #1 nationally and Zhongshan ranks #3) and on what makes the skyline recognisable at first sight. Opening hours and ticket details from blogs are unverified and irrelevant to the model.

| # | Landmark | Scenes (2–3) | Signature interaction | Best season/light |
| --- | --- | --- | --- | --- |
| 1 | **Zhongshan Mausoleum & Purple Mountain** 中山陵·钟山 | ① Bo'ai archway → cedar axis → the great stair to the blue-roofed hall ② **Music Stage** 音乐台: semicircular terraces, curved screen, pigeons ③ **Meiling Palace "necklace"** 美龄宫 seen from the air: the plane-tree ring with the palace as its emerald | **Sit on the terraces**: camera settles, pigeons wheel and land, nature sounds plus generative music (your example) | Golden plane trees in Nov; sunset |
| 2 | **Ming Xiaoling** 明孝陵 | ① Stone Elephant Road 石象路: paired animals ② Wengzhong Road: officials and generals ③ Plum Blossom Hill 梅花山 | Collect stone-animal stamps into the existing 金陵拾遗 passport | Autumn leaves; plum in Feb–Mar |
| 3 | **Confucius Temple & Qinhuai** 夫子庙·秦淮河 | ① Night canal from a **painted pleasure boat** 画舫 ② Panchi pool, screen wall, Kuixing pavilion under lantern strings ③ Wuyi Lane 乌衣巷 / Jiangnan Examination Hall 江南贡院 | **Ride the boat** on rails; release a river lantern | Night, lanterns |
| 4 | **Zhonghua Gate, City Wall & Laomendong** 中华门·城墙·老门东 | ① Through the three barbican courts ② **Walk the wall top** ③ Laomendong lanes: horse-head gables, teahouses | Fly the kite from the wall top | Morning |
| 5 | **Grand Bao'en Temple** 大报恩寺 | ① The glass-and-steel **porcelain pagoda glowing at night** ② Ruins and the underground palace corridor | Pagoda colours shift; light show at set times of day | Dusk to night |
| 6 | **Xuanwu Lake & Taicheng** 玄武湖·台城 | ① Ten-li Long Embankment 十里长堤 with the skyline and Zifeng at dusk ② Lotus at Huanzhou ③ Taicheng wall-top cherry walk | **Row a small boat** among lotus; skyline lights come on | Lotus in summer; dusk |
| 7 | **Jiming Temple** 鸡鸣寺 | ① **Cherry-blossom road** 鸡鸣寺路 with the yellow temple wall ② Yaoshi Pagoda balcony overlooking Xuanwu | **Ring the temple bell**; petals drift and can be caught | Late March |
| 8 | **Presidential Palace** 总统府 | ① Neoclassical gatehouse and axis ② Xu Garden 煦园 with the stone boat 不系舟 ③ Zichao Building 子超楼 | Feed koi at the stone boat; period postcard mode | Morning |
| 9 | **Nanjing Yangtze River Bridge** 长江大桥 | ① Bridgehead tower with red flag sculptures ② **Walk the deck** with the river below ③ Riverside park at dusk with Nanjing Eye lit | **A train rumbles through the lower deck** beneath your feet | Dusk |
| 10 | **Niushou Mountain** 牛首山 | ① Usnisha Palace dome 佛顶宫 and its mirror pool ② Foding Pagoda at sunset ③ Metasequoia forest trail | Interior light reveal inside the dome (stylised, no copied artworks) | Sunset; autumn forest |
| 11 | **Qixia Mountain** 栖霞山 | ① **Red-maple boardwalk** ② Sheli stone pagoda and Thousand-Buddha Cliff | Catch falling red leaves, which become postcards | Autumn |
| ★ | **Mufu Mountain** (existing, personal) | Six entrances, river, ships, beacon, photo memories | Keep as is | Morning |

**Skyline elements without walk-in scenes** (modelled for the atlas and as backdrops): Zifeng Tower, Nanjing Eye, Yuejiang Tower, Xinjiekou towers, the Ming wall circuit, the Yangtze and Qinhuai, Purple Mountain's ridge.

**Advice: 11 + Mufu is already a lot.** If you want to trim, I'd fold Grand Bao'en Temple into landmark 4 as a scene, which gives exactly 10.

### Transfer gates
When a scene is small, its far end gets a **themed gate**: a moon gate 月洞门 in gardens, a glowing lantern arch at Qinhuai, a stone door in the wall. Walking through it fades to a sibling scene of the same landmark, or to "next landmark" by paraglide. This is better than a sci-fi portal because it fits the painted world. The repo already has "switching places in a walk", so this extends that system.

---

## 3. Main page: two map modes

| Mode | Content | How it's made |
| --- | --- | --- |
| **Illustrated floor plan** (default) | A hand-painted Nanjing map: wall circuit, rivers, mountains, small painted vignettes of each landmark, pins, season dial | One large painted image (generated from our own Blender top-down render as composition guide, then overpainted), plus SVG/HTML pins on top. Cheap, instant, works on any phone, looks like a storybook endpaper. |
| **3D map view** | Orbitable city atlas: terrain, water, skyline, the 11 landmarks in mid-detail | The Blender **city atlas GLB** (replaces the current JS city). Reuses the existing camera, pins and weather. |

**Arrival:** click a pin (in either mode) → the camera rises → **paraglide** in a gentle spiral over the landmark (scene loads meanwhile) → flare and land at the scene's spawn point → the walk begins. This reuses `kite.js` flight physics and landing, with the swallow kite replaced by a paraglider.

---

## 4. Avatar: yes, recommended

You need one now: paragliding, sitting at the Music Stage, rowing and riding the boat all look empty without a body.

- A small, stylised traveller in the same painted style. A soft-shaded low-poly character (~8–15k triangles) with idle, walk, run, sit, glide, row and wave animations.
- **Third person by default** while exploring; first person stays one key away (the existing walk feel).
- Source: model and rig in Blender (Rigify), or start from a **CC0** animated base (for example Quaternius or KayKit packs, licence to be confirmed per pack) and repaint.
- Optional: choose outfit colours on the start screen.

---

## 5. Production pipeline (Blender → web)

```
Research pack per landmark (photos, OSM footprint, DEM patch, shot list)
   ↓
Concept painting (imagegen, our prompts, logged like design/city/PROMPTS.md)
   ↓
Blender: shared kit library (.blend asset library)
   roofs/eaves/dougong · city-wall segments · gates · balustrades · lanterns ·
   stone animals · painted trees (plane, willow, cherry, maple, cedar, metasequoia) ·
   flowers/lotus · rocks · boats · people silhouettes
   ↓
Blender: one .blend per landmark (scenes as collections) + city_atlas.blend
   terrain from DEM, water/roads from OSM, landmarks from the kit
   ↓
Export script (adapted SmallVillage export_web_models.py)
   material batching → GLB → gltf-transform: meshopt geometry + KTX2 textures
   LOD0 (scene) / LOD1 (atlas) / LOD2 (far skyline)
   + navigation/collision JSON (adapted export_navigation.py) + spawn/gates/interaction anchors as glTF extras
   ↓
three.js: scene loader, streaming, existing weather/sky/postfx, interactions
   ↓
Tests: unit + browser checks (existing harness with step()), real-phone benchmark
```

**Data sources**

| Need | Source | Note |
| --- | --- | --- |
| Terrain | Copernicus GLO-30 DEM (30 m) | Free; requires DLR/Airbus attribution. It's a *surface* model including buildings and trees, so the city core must be flattened/edited by hand. Purple Mountain, Niushou, Qixia and Mufu relief come out well. |
| Footprints, roads, water, wall circuit | OpenStreetMap (already in repo, ODbL) | Add wall, Qinhuai and lake outlines where missing. |
| Satellite reference | Tianditu / Esri imagery, **viewed only** | Layout and tree-cover reference; not shipped. |
| Shape and detail | Your `D:\blender\nanjing` photos, official tourism galleries, Wikimedia Commons, travel videos | Reference only, logged in the evidence register as before. |
| Google 3D Tiles | Not usable | Mainland coverage unconfirmed; licence forbids extraction anyway. |

**Painterly look in real time:** banded toon lighting with painted gradient ramps, spherical normals on foliage, painted texture overlays, existing painted sky and cumulus, aerial perspective fog, soft outlines on architecture only. Bake ambient occlusion in Blender. Don't bake full lighting, because the weather system changes it.

**Budgets (enforced by tests, not hoped for)**

| | Download | Triangles | Draw calls |
| --- | --- | --- | --- |
| Illustrated map | ≤ 3 MB | n/a | n/a |
| 3D city atlas | ≤ 12 MB | ≤ 1.2 M | ≤ 200 |
| Each scene | ≤ 8 MB | ≤ 1.5 M visible | ≤ 250 |
| Avatar + glider | ≤ 1.5 MB | ≤ 20 k | ≤ 5 |

Large binaries: keep GLBs out of normal git history (Git LFS or a separate asset bucket/CDN), so the repo doesn't balloon.

---

## 6. Interactions and sound

- **Sit anywhere marked** (benches, terraces, the wall edge): the UI fades, the camera drifts slowly, birds or pigeons animate, sound shifts to ambient.
- **Music:** the site is static with no server or API key. Recommended: a **generative music engine in the browser** (Web Audio: pentatonic guzheng/flute/piano-like voices, a new piece each sit, seeded by place and weather) plus recorded nature beds (CC-licensed, credited like now). True AI-model music generation would need a server and API costs. It's possible later as an optional serverless add-on, or with pre-generated, licensed tracks.
- Per-scene interactions are in the table in §2. They plug into the existing 金陵拾遗 passport (stamps, facts, postcards).
- Ambient life: pigeons, egrets over Xuanwu, boats on Qinhuai, trains on the bridge, crowds as soft painted silhouettes.

---

## 7. Phases

| Phase | Output | Exit check |
| --- | --- | --- |
| **0. Decisions and art bible** | Confirmed list (§9), art bible (palette, line, foliage, roofs), budgets, one concept painting per landmark | You approve the look |
| **1. Vertical slice: Zhongshan** | Kit v1, Zhongshan three scenes in Blender, export pipeline, scene streaming, avatar, paraglide landing, Music Stage sit-and-listen, one transfer gate | Runs ≥ 30 fps on a mid-range Android and an iPhone; you say "I recognise it" |
| **2. City atlas + illustrated map** | `city_atlas.blend` (terrain, water, wall, skyline, mid-detail landmarks), painted floor-plan map, two-mode home page | Recognisable skyline from the default view; atlas within budget |
| **3. Rollout batch A** | Qinhuai, Zhonghua Gate/Laomendong/wall, Bao'en, Xuanwu/Taicheng, Jiming (the old-city cluster, sharing kit pieces) | Per-scene budgets and browser checks |
| **4. Rollout batch B** | Ming Xiaoling, Presidential Palace, Yangtze Bridge, Niushou, Qixia | Same |
| **5. Life, seasons, sound** | Season dial, generative music, ambient animals and people, all signature interactions | Interaction tests |
| **6. Polish and deploy** | Performance pass, accessibility, hosting decision, deploy | Live, verified on phones |

Phases 3 and 4 can run partly in parallel (separate landmarks, separate `.blend` files) once the kit and pipeline from Phase 1 are stable.

---

## 8. Risks

- **Time:** realistically the largest scope this project has had. The vertical slice tells us the true cost per scene before we commit to all 25.
- **Phone performance:** never measured on a real phone so far (per the handoffs). Phase 1 must fix that gap.
- **Likeness vs. style:** too stylised loses recognition, too literal loses the painted feel. Silhouette and colour must be accurate (roof shapes, wall colours, pagoda storey counts); detail can be painterly.
- **Licensing:** no public photos in textures; credit OSM and Copernicus; keep audio credits; CC0/CC-BY assets only, logged.
- **Existing app:** the current atlas stays live until the new one is better. Build on a branch, since pushing `main` deploys to production.

---

## 9. Decisions (agreed 17 October 2026)

- **Audience:** a gift for the owner's friend, a US citizen who visited Nanjing around 2016 and loved it. English-first UI with Chinese names alongside; mainland-China hosting is not a concern, Vercel stays.
- **Landmarks:** ten. Grand Bao'en Temple becomes a scene of landmark 4 (Zhonghua Gate, City Wall & Laomendong). Mufu stays as the personal bonus scene, unchanged.
- **Vertical slice:** Zhongshan first.
- **Music:** in-browser generative music plus recorded nature beds; no server.
- **Avatar:** yes, third person by default, first person one key away. A traveller character (style chosen in Phase 0).
- **Branch:** all rebuild work on `rebuild/blender-city`; `main` stays the live atlas until the new one is better.

### Original questions

1. **Landmark list:** the 11 above (+ Mufu), or fold Bao'en into Zhonghua Gate for exactly 10? Any must-haves I missed (e.g. Yihe Road 颐和路, Hongshan Zoo, Nanjing Museum)?
2. **Vertical slice:** start with Zhongshan (contains your Music Stage idea)?
3. **Avatar style:** stylised child/teen traveller, adult traveller, or an animal companion? First or third person by default?
4. **Music:** in-browser generative music (free, offline), or are you willing to run a small paid AI-music service?
5. **Audience/hosting:** are mainland-China visitors a priority (affects domain/CDN)?
6. **Mufu:** keep it as the personal bonus scene, unchanged?

---

## Sources consulted for this plan

- Trip.com Top 20 Nanjing attractions 2025: https://de.trip.com//toplist/tripbest/recommend/nanjing/best-things-to-do/100001406731
- Confucius Temple #1 / Zhongshan #3 national visitor ranking: https://www.itiger.com/news/1113687173
- Music Stage and Meiling "necklace" (and the gift myth being unsupported): https://www.toutiao.com/zixun/7533097384210761769, https://www.thepaper.cn/newsDetail_forward_1394122
- Jiming/Taicheng cherry routes 2026: https://www.yzwb.net/news/jiangsu/nanjing/202603/t20260323_334415.html
- Niushou Usnisha Palace / Foding Pagoda (68 m): https://www.fabionodariphoto.com/en/niushoushan-park-nanjing-travel-guide/
- Bao'en pagoda as a lit protective glass structure: https://m.thepaper.cn/newsDetail_forward_32713208
- Xuanwu Ten-li Embankment for skyline/dusk; lotus points: https://www.xuanwuhu.net/UploadFile/20250417122718.pdf, https://m.bendibao.com/show624654.html
- Copernicus GLO-30 licence and surface-model note: https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_DEM_GLO30_2024_1
- DEM accuracy comparison: https://air.iuav.it/handle/11578/330688
- Painted-foliage real-time technique: https://80.lv/articles/turning-a-2d-illustration-into-a-3d-environment-with-a-hand-painted-look
- Google 3D Tiles coverage (China not listed): https://developers.google.cn/maps/documentation/tile/3d-tiles-overview
