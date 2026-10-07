# Nanjing landmark and landscape study — 5 October 2026

This pass compares public photographs with the actual game geometry. It uses
official tourism galleries, municipal archives, the bridge construction authority,
park management, and the architect's own project gallery. Map anchors continue
to use the provenance in `SOURCES.md` and `public/city/nanjing.json`.

## What the evidence establishes

- **Nanjing Eye:** the construction authority explicitly describes two inclined
  elliptical pylons and two cable planes. Replace the generic sine arches with
  two closed, tilted oval rings and radiating stays.
- **Zhonghua Gate:** municipal archives show three rectangular barbican
  courtyards and successive gates. The wooden tower was destroyed in 1937.
  Replace the invented roof towers with four pierced walls, three open courts,
  side ramps, vault-like openings and battlements. Model dimensions are artistic.
- **Third Yangtze bridge:** the municipal transport bureau identifies the
  Dashengguan **road** bridge, formerly the Third Yangtze Bridge, as a curved
  steel-pylon cable-stayed bridge. It is distinct from the nearby railway arch
  bridge. Keep the existing road anchor and model curved A-shaped cable towers.
- **Zifeng:** the architect's original Nanjing project page and photographs
  show interlocking forms, angled glass modules and a triangular plan. Search
  results for the similarly named **Nanchang** tower are a different building
  and were excluded. Use an asymmetric stepped glass silhouette with a spire.
- **Jiming:** the tourism photograph shows warm yellow walls, red timber,
  dark projecting eaves and an octagonal multi-storey pagoda. Give it a distinct
  silhouette and ochre temple cluster rather than a square generic tower.
- **Niushou:** the gallery photographs show domes, a ribbed triangular lattice,
  arches, a water mirror and a separate slender pagoda. Use two shallow domes,
  a dimensional rib cage and a nine-level four-sided pagoda. The [park tower description](https://tchinese.niushoushan.net/BuddhaTower.html) confirms nine levels and four sides, correcting the initial imagegen concept. These are visual
  simplifications, not fabrication drawings.
- **Presidential Palace:** the photographed entrance is a pale, restrained
  neoclassical gatehouse with three arched openings, pilasters, cornice and
  stepped centre. The entrance must not be a Chinese tiled-roof hall.
- **Sun Yat-sen Mausoleum:** stone memorial archway, a long axial staircase,
  white stone and blue glazed roofs set in forest. Preserve the staircase;
  add an open memorial archway instead of blocking the walk with a solid hall.
- **Landscape:** Xuanwu's photographed willow-lined banks, low islands and
  water/park foreground contrast with the modern skyline; Qinhuai has close
  waterfront roof clusters and lanterns. Zhongshan's park guide documents
  wooded slopes and its plane-tree avenue. These cues guide planting and
  district differentiation rather than a uniform scatter of blocks.

## Source-to-model register

“Photo inspected” means image pixels were loaded and reviewed in this session.
“Text/map” means the source informs context without claiming its photos were
visually verified. Imagegen compositions are design studies, not geographic maps.

| Game destination | Public reference and evidence | Implementation / retained interpretation |
|---|---|---|
| Mufu mountain | [Municipal water bureau, 2025](https://shuiwu.nanjing.gov.cn/bmdt/202508/t20250815_5629183.html), text; [archival landscape PDF](https://dag.nanjing.gov.cn/dawh/dags/202507/P020250701393669637907.pdf), indexed photo description | Restored woodland ridge beside broad Yangtze; original photo-informed Mufu portal retained. No new survey claim. |
| Yangtze bridge | [Tourism gallery](https://www.gotonanjing.com/gallery/attractions-gallery), photo inspected | Long double-level truss character, bridgehead towers, red accents and flags; compressed span. |
| Yuejiang tower | Same official gallery, photo inspected | Four ascending vermilion pavilion tiers, projecting blue glazed roofs, and open balcony rails; approximate proportions informed by the official photograph. |
| Xuanwu lake | Same official gallery, photo inspected; [official attractions overview](https://www.gotonanjing.com/what-to-do/attractions) | Willow bank planting replaces arbitrary species near water; low islands, garden shore and skyline context. Current lake outlines remain inferred. |
| Jiming temple | Official gallery, photo inspected | Seven-level octagonal pagoda, ochre walls, projecting grey-blue eaves. |
| Zifeng tower | [Architect's Nanjing project](https://www.smithgill.com/work/zifeng_tower/), photo inspected | Faceted interlocking/stepped glass masses, fine facade seams and slender spire; not the Nanchang tower. |
| Purple mountain | [Park management guide](https://zschina.nanjing.gov.cn/lyzx/202506/t20250623_5591074.html), text/map; tourism landscape photos | Existing wooded continuous relief and hillside walk retained. Artificial contour/forest treatment; not measured elevation. |
| Sun Yat-sen mausoleum | Official tourism gallery, photo inspected; park management guide | Open three-bay paifang, preserved axial stone steps and blue roof hall. Stair count/scale condensed. |
| Ming Xiaoling | Park guide: labelled Ming Tower and Stone Elephant Road photos identified, original image endpoint returned 403; text/map | Raised arched Ming Tower terrace and stone-animal procession. Animal species/details remain stylized, not a measured replica. |
| Presidential palace | Official gallery, photo inspected | Three-arch neoclassical entrance, pilasters, cornice, flagpole; inner Chinese garden halls retained. |
| Qinhuai / Confucius temple | Official gallery, photo inspected | Lantern waterfront, stone arched footbridge, temple screen wall and stepped gables; canal placement is artistic. |
| Zhonghua gate | [Municipal archives, pp. 2–3](https://dag.nanjing.gov.cn/dawh/dags/202507/P020250701384673287176.pdf), PDF/text; [culture bureau](https://wlj.nanjing.gov.cn/ztzl/mcq/gzqk/202302/t20230228_3838766.html) | Four arched walls, three courts, battlements, side ramps. Removed imaginary roof towers. |
| Laomendong | [Municipal local-history office](https://dfz.nanjing.gov.cn/gzdt/202411/t20241101_4998828.html), text/map | Stone paifang and stepped horsehead gables differentiate its lanes from Qinhuai; no added invented canal. |
| Mochou lake | Official gallery, photo inspected in this pass | Retain garden pavilion and shore; water-adjacent trees favour willow. Decorative lake outlines remain inferred. |
| Nanjing Eye | [Municipal construction authority](https://gjzx.nanjing.gov.cn/xmqk/qabxq/202509/t20250903_5641986.html), text; tourism photo inspected | Two closed tilted elliptical pylons and fine cable fans. Construction photo endpoint returned 403; tourism image supplies visual view. |
| Third Yangtze road bridge | [Municipal transport bureau, 2024](https://jtj.nanjing.gov.cn/bmdt/202402/t20240226_4174172.html), text/map | Curved A-shaped towers and cable fans; preserve current road-bridge anchor. |
| Niushou | Official gallery, photos inspected; [tourism attractions](https://www.gotonanjing.com/what-to-do/attractions) | Golden/cream double domes, lattice ribs, reflecting court and slender nine-level four-sided pagoda. |
| Qixia | [Farm's original photograph, 2009](https://commons.wikimedia.org/wiki/File:Pagoda_at_Qixia_Temple_Nanjing.jpg), photo inspected; [municipal protection register](https://wlj.nanjing.gov.cn/zwgk/wwbhml/202501/P020251127641809511607.pdf) | Low five-level stone relic pagoda with close eaves and temple courts, replacing generic tall timber tower. |
| Tangshan | [Municipal field account](https://dx.nanjing.gov.cn/jxpx/xydt/201904/t20190430_1921754.html), text/map | Retain artistic hot-spring garden pools in wooded terrain; no claim to reproduce a specific resort. Transit-vicinity anchor unchanged. |
| Gaochun | [Old Street official website](https://www.njgclj.cn/), text/map; [municipal literary federation photo article](https://wl.nanjing.gov.cn/wydt/wlzx_78966/202601/t20260115_5769616.html), text | Stone gateway, white stepped gables, timber market awnings; shop/canal layouts are invented. Transit-vicinity anchor unchanged. |

## Research assets and limitations

The official gallery source-image URLs are recorded in `PHOTO-REFERENCES.json`.
Research JPEGs and two temporary contact sheets are in ignored
`test-results/research/`; they are not served or redistributed. The architect
photograph credits James Steinkamp Photography. The Qixia photograph credits
Farm, CC BY-SA 3.0 / GFDL, and is used for inspection only, not in imagegen or
runtime assets. Public availability is not treated as a blanket image licence.

This pass inspected tourism/architectural photography and primary descriptions.
It does not claim to have watched every linked social-media video, accessed
private Redbook posts, or performed photogrammetry. Source endpoints returning
403/405/521 were recorded as unavailable rather than bypassed. Scene scales,
route alignment, roof modules, courtyards (including a southward compact gate vignette to avoid overlapping neighbouring old-town walks), vegetation and ground relief are
artistically compressed; landmark point provenance is unchanged.

## Design and implementation

Built-in imagegen produced `design/city/nanjing-landmarks-concept-v2.png` from
the two inspected tourism contact sheets and the prior style concept. Its
placement is illustrative. The three-courtyard gate in code follows the archive
description rather than copying the concept's incidental courtyard arrangement.
`design/city/architecture-source-v1.png` supplies four packed 512px runtime
gouache textures (tile, brick, ochre plaster, glass). Exact prompts and source
roles are in `design/city/LANDMARK-PROMPTS.md`.

`src/city-landmarks.js` builds real apertures, octagonal eaves, lattice domes,
stepped gables, architectural masses and bridge rings. `city-scene.js` batches
them by shared material. `nanjing.js` loads the generated textures, keeping
single final tone mapping and shared snow/weather. Historic Qinhuai blocks are
lower and tiled; taller glass groups concentrate near Zifeng. Nearby water-side
planting favours willow. Palace/Jiming forecourts share a graded lowland surface
to prevent lake shoulders from burying their entrances; arrival sight lines stay
clear of obstructing tree crowns. No detailed foliage casts a shadow.

## Re-check against public photographs, 7 October 2026

Photographs from Wikimedia Commons (licences in each file's metadata; inspection
only, never redistributed or used as textures) were compared with the models, and
these shapes were found wrong and changed:

| Landmark | Photograph shows | Model had | Now |
| --- | --- | --- | --- |
| Yangtze Bridge | Road rides on top of the steel truss; cream bridgehead towers with flags; multi-globe lamp posts | 22 m white pillars standing beside the deck | Pillars removed; walk down the middle of the deck |
| Ming Xiaoling | Salmon-vermilion walls, yellow-glazed coping and roof, brass-studded round-arched doors in a grey stone frame | A red box with an orange roof | Wall wings, a three-door gate house, double yellow eave |
| Zhonghua Gate | Pale grey brick, one great round arch, crenellations | Tan stone | Grey brick |
| Qixia | A five-storey carved stone relic pagoda on a stepped base is the point of the temple | A small stone octagon beside two white halls | Pagoda at the centre of its court, halls around it |
| Presidential Palace | Gold characters directly on the stone attic | A dark board | Stone-coloured board |
| Jiming | Nine storeys | Seven | Nine |
| Zifeng Tower | One smooth tapering, faceted glass blade | Four stacked prisms | A lofted, twisting blade with floor belts and four sharp edges |

Photographs compared this time: bridge, eye, third bridge, palace, qixia, jiming,
xiaoling, zhonghua, zhongshan, xuanwu, yuejiang. **No new photograph was fetched for
Zifeng, Qinhuai, Mochou, Niushou or Laomendong;** their shapes follow the earlier pass
and general knowledge, and are the least checked. Everything remains an illustrated,
compressed approximation, not a survey.
