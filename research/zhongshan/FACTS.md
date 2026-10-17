# Zhongshan vertical slice: research pack

17 October 2026. This is the evidence for the first Blender landmark. **Measured** means a published
figure (the source is named, and travel-site figures are marked lower-confidence). **Modelling
assumption** means our choice, to be checked against OSM/DEM once downloaded.

## Scene 1: the Mausoleum axis 中山陵

| Element | Published figure | Confidence | Source |
| --- | --- | --- | --- |
| Steps, Bo'ai arch → Sacrificial Hall | 392 | High (widely repeated, official narrative: 392 million citizens) | travel guides, [chinanews 2011](https://www.chinanews.com/gn/2011/10-10/3377489.shtml) |
| Steps, Stele Pavilion → Hall | 339 | Medium | [ctrip](https://you.ctrip.com/sight/nanjing9/1655.html) |
| Vertical drop, arch → hall | 70–73 m | Medium (two figures) | ctrip, toutiao |
| Horizontal length, arch → hall | ~700 m (one source says ~400 m for the stair section only) | Medium | ctrip |
| Platforms on the stair | 8 or 10 (sources disagree) | Low → **count from OSM/aerial** | travel notes |
| Bo'ai arch 博爱坊 | 11 m tall, 17.3 m wide, three bays, four posts, posts rise through the roof | Medium | [maigoo](https://m.maigoo.com/citiao/3571.html) |
| Tomb Gate 陵门 | On a platform reached by 20 granite steps, three round-arched doors, single blue hip roof | Medium + photo | ctrip; reference photo `zhongshanling/33889dad…` |
| Stele Pavilion 碑亭 | Double-eave hip-and-gable roof; stele 8.1 m × 4 m | Medium | ctrip |
| Sacrificial Hall 祭堂 | 30 m × 25 m × 29 m tall; seated statue 4.6 m | Medium | ctrip |

**What the photos show** (`D:\blender\nanjing\zhongshanling`, reference only):
- Hall: white granite, **four corner bastions** that rise above the lower roof, double blue glazed hip roof, a lower blue eave between the bastions, three arched doors with lintel inscriptions, a carved bracket frieze.
- Stair: **three parallel flights** split by two planted bands of clipped cypress/juniper hedges, with white stone balustrades. A wide landing every flight, and bronze tripod 鼎 on the posts at the top.
- Approach: a wide pale plaza, white stone lion/xiezhi-style figures flanking the gate stair, dense mixed forest on both sides (cedar 雪松, deodar, broadleaf), and mountain forest behind the hall.
- Colour: **ultramarine-cobalt roofs** (much bluer than teal: the style guide's "teal roof" rule needs an exception here), off-white granite, dark green forest.

## Scene 2: the Music Stage 音乐台

| Element | Published figure | Source |
| --- | --- | --- |
| Built | Autumn 1932 – summer 1933; designed by Kwan Sung-sing 关颂声 and Yang Tingbao 杨廷宝 | [Wikipedia](https://en.wikipedia.org/wiki/Sun_Yat-sen_Mausoleum_Music_Stage), [yzwb](https://www.yzwb.net/news/jiangsu/nanjing/202506/t20250603_216015.html) |
| Seating | Semicircular lawn/terrace, **radius 50 m**, 3,000+ people | yzwb, thepaper |
| Screen wall 照壁 | **16.67 m wide × 11.33 m tall**, five-panel "five-mountain screen" form; doubles as an acoustic reflector | same |
| Stage | ~200 m² | same |
| Crescent pool 月牙池 | Between stage and seating | same |
| Pergolas | A straight three-bay pergola on each side of the stage, steps at each end; vine-wrapped concrete columns ring the top of the bowl | same |
| Site area | ~4,200 m² | [Zhongshan park bureau](https://zschina.nanjing.gov.cn/lyzx/202607/t20260715_5877393.html) |

**What the aerial photo shows** (`zijinmount/cf30b4aa…png`):
- The bowl faces the stage at about 180°, with **four concentric tiers of terraced lawn steps** separated by pale paved walkways and **radial aisles (5–6)**. The front half is lawn and the back is stepped.
- The stage is a scalloped platform backed by the pale blue-grey screen with pilasters and a stepped crown, framed by hedges, with a dark pool crescent in front.
- A pergola colonnade with vines on white columns runs around the outer rim.
- Setting: tall dark cedars behind the stage, and an autumn canopy of maple, oak and plane trees all around in gold, orange and red.
- **Pigeons:** older travel notes describe flocks of white pigeons and buying feed. Whether the flock is still there today is unverified. For a 2016 visitor this is period-accurate, so keep it.

## Scene 3: Meiling Palace and the "necklace" 美龄宫

| Element | Published figure | Source |
| --- | --- | --- |
| Building | Three storeys + basement, double-eave hip-and-gable palace style, **green** glazed tiles, ~1,000 phoenix motifs on the roof | [qunar](https://touch.travel.qunar.com/bookElement/7858264/3795440-2), ctrip |
| Floor area / site | ~2,800 m² / ~8 ha (120 mu) | travel note (low confidence) |
| Necklace | Plane trees along Lingyuan Road form the chain; the ring road around Xiaohong Hill is the pendant, and the palace is the emerald. **It is visible only from the air in autumn gold.** The gift story is undocumented, and the trees were not planted at one time. | [chinanews 2015](https://www.chinanews.com.cn/m/cul/2015/11-09/7612203.shtml), [thepaper](https://www.thepaper.cn/newsDetail_forward_1394122) |
| Ring size | Not published → **measure from OSM ring road** | n/a |

Design consequence: Scene 3 is best entered **as the paraglide descent itself**. The visitor glides
over the gold necklace, spirals down onto the pendant ring and lands at the palace gate. This
makes the arrival the photograph.

## Plane-tree avenue 陵园路 (connector)

The 1929-planted London-plane avenue runs from Zhongshan Gate toward the Mausoleum. It shows golden
leaves in November and stays green in summer. It becomes the walking link between the three scenes,
reached through the transfer gates.

## Cross-check from OSM + Copernicus (17 October 2026)

`tools/research/zhongshan-terrain.py` crops the DEM; `data/terrain.json` holds the numbers.
Local metres, origin at the Bo'ai arch (OSM node 12345226894), east = +x, north = +y.

| Anchor (OSM) | Local x, y (m) | DSM height (m) |
| --- | --- | --- |
| Bo'ai arch, node 12345226894 | 0, 0 | 87.8 |
| Tomb Gate, way 1334432181 | −23, 383 | 114.5 |
| Stele Pavilion, way 1334432182 | −24, 428 | 119.7 |
| Sacrificial Hall, way 483693967 | −36, 619 | 158.8 |
| Music Stage, way 141915419 | 153, −158 | 64.9 |
| Meiling Palace, way 338667850 (ring road: way 338667851) | −674, −1225 | 67.4 |

- **Rise arch → hall: 71 m, which confirms the published 70–73 m.** Horizontal distance 620 m, consistent with "~700 m" measured from the plaza in front of the arch.
- The axis runs ~3.4° west of north.
- The Music Stage is 220 m southeast of the arch and 23 m lower. Meiling is 1.4 km southwest, so it really is a separate scene (paraglide or gate, not a walk).
- DSM heights on forested ground include canopy. The paved axis values look plausible because the axis is open, but the forest floor around it will be graded down in Blender.

## Open items before modelling

1. OSM: Mausoleum axis footprint, stair outline, Music Stage polygon, Meiling ring road, Lingyuan Road.
2. Copernicus GLO-30 tile N32 E118 for relief (axis slope, Xiaohong Hill, Purple Mountain behind).
3. Count stair flights/landings from an aerial reference; current photos suggest 8 landings plus the gate platform.
