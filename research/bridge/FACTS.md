# Nanjing Yangtze River Bridge world (research; not built yet)

21 October 2026. Atlas anchor: OSM way 756599299 (32.1156029 N, 118.7385325 E).

| Fact | Value | Source |
| --- | --- | --- |
| Opened | Railway 1968; road deck 1968 | [maigoo](https://m.maigoo.com/citiao/154488.html), [12371](https://www.12371.cn/2021/06/26/VIDE1624668600444790.shtml) |
| Main bridge | ~1,577 m over the river, steel truss, 9 piers and 10 spans (main spans 160 m) | maigoo; zdic |
| Road deck (upper) | 4,589 m long overall; 15 m carriageway (4 lanes) plus 2.25 m walkways each side | maigoo design parameters |
| Railway (lower) | Double track inside the truss, 6,772 m overall | same |
| Bridgehead towers | "Three red flags" sculpture design by Zhong Xunzheng, chosen by Zhou Enlai; towers over 70 m | [chinawriter 2021](https://www.chinawriter.com.cn/n1/2021/0506/c437437-32095617.html) |
| Look | Paired cream-yellow towers crowned with red flags; lower bridgehead with tall arches; worker-peasant-soldier statue groups on red plinths along the deck; long grey truss on concrete piers | Commons *南京长江大桥·东北*, *Statue-of-Yangtze* |
| Visiting | Pedestrian walkways open; glass walkway near the south bridgehead popular at night | travel notes (unverified) |

Interaction ideas: a train passing beneath your feet on the lower deck (sound and rumble), the
riverside park at dusk with the Nanjing Eye lit.

## As built (blender/build_bridge.py)

Local frame: metres from the south end of the OSM outline, on its centreline (32.1117707 N,
118.7461623 E). The axis (yaw 2.609 rad) is the outline's, from the south end to the north end.
OSM's road ways sit about 20 m off it; the railway runs true. Data: `data/osm-bridge.json`
(Overpass, ODbL), with the Yangtze multipolygon stitched into rings by `area-prep.py`, plus a
Copernicus crop.

| Element | As modelled | Basis |
| --- | --- | --- |
| Main bridge | 1,671 m abutment to abutment (OSM outline); truss 1,568 m = nine 160 m spans and one 128 m span | outline; published spans (which end has the 128 m span is assumed) |
| Levels | water 0.5 (DSM); truss bottom chord +27.5, top +43.5; road 45.6; walkways +0.25 | 24 m clearance; truss depth 16 m assumed |
| Deck | 15 m road, 2.25 m walkways, parapets with relief panels, magnolia lamps every 32 m | published widths; lamp spacing assumed |
| Bridgeheads | 40 × 52 m cream block up to the deck; twin towers 12 × 8 m to deck +23 m; three red flags each; statue group of five on a balcony | "about 70 m" overall; plan and detail assumed |
| Approaches | south: OSM southbound road at 3.5 %; north: straight at 6 %; arches every 30 m | grades and arch spacing assumed (the north is steepened to fit the crop) |
| Railway | straight on the axis; viaduct falling 0.8 % south, 3 % north | OSM; grades assumed |

Assumptions: pier shapes, park planting, and city blocks drawn as plain extrusions of OSM footprints.
