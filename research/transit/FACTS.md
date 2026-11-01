# Nanjing's metro and buses: what Tiny Nanjing runs

Research for the transit system (1 November 2026). The owner asked for automatic metro and bus
lines on fixed routes, "no need to add all the route lines, choose some representatives". The
owner's rule still holds: real data, cited, with assumptions marked **assumption**.

## The lines chosen, and why

All geometry, stops and colours come from OpenStreetMap route relations (Overpass, 1 November 2026,
`research/core/data/osm-core-transit.json`; ODbL). `tools/research/transit-prep.py` turns them into
`public/scenes/core/transit.json`.

| Line | OSM relation | Colour (OSM `colour`) | Why |
| --- | --- | --- | --- |
| Metro Line 1 | 1533791 (八卦洲大桥南 → 中国药科大学) | #00a2df | The city's first line (2005), straight under Zhongshan Road: Nanjing Station, Xuanwumen, Gulou, Xinjiekou |
| Metro Line 2 | 1529762 (鱼嘴 → 经天路) | #c7003f | East–west under Zhongshan East Road; crosses Line 1 at Xinjiekou; Daxinggong and Xi'anmen by the Ming Palace |
| Metro Line 3 | 5454532 (林场 → 秣陵) | #009651 | Added at the owner's ask: the line that ties the others together, meeting Line 1 at Nanjing Station, Line 4 at Jiming Temple and Line 2 at Daxinggong; crosses under Xuanwu Lake |
| Metro Line 4 | 9588281 (龙江 → 仙林湖) | #a513c0 | Crosses Line 1 at Gulou; Yunnan Road and Jiming Temple |
| Bus 1 | 1929972 | none mapped | One of the oldest routes; Zhongshan Road from Xuanwu Lake through Gulou to Xinjiekou |
| Bus 25 | 1929975 | none mapped | The same avenue, a second bus so the street feels served |

Stations are the OSM `railway=station` + `station=subway` nodes within 120 m of the line; bus stops
are the `highway=bus_stop` nodes within 25 m of the route. Where a bus relation's ways are missing,
the route follows the city's own mapped streets between its stops.

## Line 3 and Mufu Mountain

Line 3's Shangyuanmen station (上元门) stands about 40 m from OSM's mapped Mufu Mountain wood
(幕府山, OSM 62344629), at the mountain's foot; Wutang Square (五塘广场) is about 370 m from it
(measured in `public/scenes/core/transit.json` against `research/core/data/features.json`). Both
lie north of the walkable city, so a Line 3 ride to Shangyuanmen ends on the Mufu Mountain
morning walk, the walk this project began with.

## How they run

| Fact | Value | Source |
| --- | --- | --- |
| Line 1 trains | six-car Alstom Metropolis sets (2005) | [Wikipedia: Line 1](https://en.wikipedia.org/wiki/Line_1_(Nanjing_Metro)) |
| Line 1 speed | 65 km/h operating, 80 km/h maximum | same |
| Metro headway | about 3–4 minutes | [UrbanRail.net Nanjing review, 2018](https://www.urbanrail.net/as/cn/nanj/Nanjing_Views_CMoore.pdf) |
| City-centre bus speed | target at least 18 km/h at peak (2014 policy); buses held to 20 km/h through junctions since 2022 | [China News 2014](https://www.chinanews.com/sh/2014/08-14/6492596.shtml); [The Nanjinger](https://thenanjinger.com/?p=21232) |
| Core metro | underground through the old city | OSM (`tunnel=yes`, `layer=-1` and below on the tracks) |

## How Tiny Nanjing uses this

- **Buses** drive their routes on the road surface at 5 m/s (18 km/h, the city's target speed) and
  wait 12 s at each stop. Several buses per route, spaced about 900 m apart, so the street always
  has one in sight: real headways are minutes apart, so the spacing is an **assumption** for the
  small world. The visitor boards at a stop (F) and rides; F again gets off at the next stop.
- **Metro** runs underground, so the ride is shown from above: the line drawn in its colour, a
  train gliding along it, the city below. The train runs at about 65 km/h, sped up ten times for
  the visitor (**assumption**: a ride of half a minute, not five). Station entrances stand at the
  OSM station nodes; F at one opens the line's stations.
- **Looks:** buses white with a green band, metro trains white with a band in the line's colour
  (**assumption**; the line colours themselves are OSM's).
