# Nanjing illustrated atlas — evidence and limits

Research / public data retrieved 5 October 2026. User-supplied illustration
screenshots guided the palette and simplified tree/building forms. No external
photographs, videos or screenshot textures are redistributed in the game.

## Public map data

Raw `osm-*.json` snapshots and derived `public/city/nanjing.json` are ©
[OpenStreetMap contributors](https://www.openstreetmap.org/copyright), under
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

- Municipal outline: [OSM relation 2131524](https://www.openstreetmap.org/relation/2131524).
- Yangtze / Qinhuai centerlines: recorded Overpass query. Centerlines do not establish river widths.
- Shijiu, Gucheng, Mochou lake rings: relations 14305804, 18018554, 18231223.
- Landmarks: approximate centers of mapped buildings, parks and historic sites. Matching stations were rejected when landmark features existed. Gaochun and Tangshan are excluded from the published central-city window. Original source snapshots are retained.
- Third Yangtze bridge: [Wikidata Q3540210](https://www.wikidata.org/wiki/Q3540210), CC0.
- Xuanwu Lake: [OSM relation 2138994](https://www.openstreetmap.org/relation/2138994), full shoreline and seven island rings downloaded 2026-10-05. The published outline is simplified from these nodes and is marked `inferred: false`.
- Jiajiang / western Yangtze water surface: [OSM relation 2538928](https://www.openstreetmap.org/relation/2538928), clipped to the central viewing window, with river islands preserved.
- Nanjing Eye alignment: [OSM way 321392362](https://www.openstreetmap.org/way/321392362), using its mapped straight crossing; public node 3281370485 remains the landmark anchor. Ring foundations and cable geometry follow the [architect interview](https://www.chinaasc.org.cn/news/104499.html); structural dimensions remain exaggerated for the atlas.
- Laomendong: anchor inferred within official district bounds, from the [Nanjing local-history office](https://dfz.nanjing.gov.cn/gzdt/202411/t20241101_4998828.html).

Reproduce retained snapshots: `node tools/research/fetch-nanjing.mjs`, then
`node tools/research/prepare-nanjing.mjs`. The fetch tool retains reviewed files
and respects HTTP errors. Review feature types and record a new retrieval date
before replacing the published map database.

## Landmark and photo references

- [Nanjing municipal scenic areas](https://english.nanjing.gov.cn/ThisisNanjing/WelcometoNanjing/Scenicspot/): destination selection.
- [Yangtze bridge photographs, Jiangsu local-history office](https://jssdfz.jiangsu.gov.cn/n97/20240220/i31329.html): twin bridgehead towers, red flags, steel truss.
- [Zhongshan photographs, Nanjing municipality](https://english.nanjing.gov.cn/WhatsNew/Latest/202504/t20250427_5136541.html): blue roof and pale stairs.
- [Niushou official park](https://eng.niushoushan.net/) and [public landmark photographs](https://www.jsstb.gov.cn/special/jidi/photo/201701/t20170122_11684686.htm): twin domes, lattice and pagoda.
- [Qinhuai photo reference](https://kr.people.com.cn/n3/2016/0926/c207555-9119562.html): white walls, tiled roofs, water and lanterns.
- [Nanjing City Wall official history](https://english.njcitywall.cn/?obj=lishi): gates and wall character.
- [Gaochun Old Street official introduction](https://www.njgclj.cn/en/mobile/aboutinfo.asp?id=1): Chunxi old street beside the Guanxi River.
- [Tourism video index](https://www.gonanjingchina.com/explore-nanjing-china/nanjing-travel-map-photos-videos/nanjing-videos): public promotional-video listings were discovered. Playback could not be accessed; full videos were **not watched** and geometry is not claimed to be reconstructed from them.

## Interpretation

Twenty destinations follow approximate public-map anchors in a compressed
east/north atlas (scale .065). Landmark silhouettes are exaggerated. Generic
blocks, road grids, paths, vegetation, river widths, bridge spans and hill
elevations are artistic. The atlas is not a complete building inventory, DEM,
survey or street-level digital twin.

Walking routes are compact destination vignettes; kite flight traverses the
atlas. The detailed Mufu model opens through a portal and retains its separate,
photo-informed, non-surveyed coordinate system. Raw private photos / GPS are
not added to this public repository.

## 5 October 2026: landmark photography and illustration

See [LANDMARKS.md](LANDMARKS.md) for the place-by-place visual evidence, implementation mapping, access limits and research corrections. [PHOTO-REFERENCES.json](PHOTO-REFERENCES.json) records public photo URLs and which image pixels were actually inspected. Generated design/artifact provenance and exact prompts are in `design/city/LANDMARK-PROMPTS.md`.
