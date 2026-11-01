# Purple Mountain in the city: plan

The owner, 1 November 2026: Purple Mountain should come from real data, since it is the
backdrop of most of the skyline. The landmarks already built beyond the map should stay at
their real places, reached by road, and be detailed to the current standard. The owner said
"Yes, start it", with this phase first.

## Where it stands

- The ridge is real but only a backdrop. It is the Copernicus GLO-30 surface model in the far
  ring round the city (`core_far`, lon 118.70–118.905), with a 60 m step, plain far ground,
  scattered low trees, and no roads.
- The Zhongshan world (`blender/build_zhongshan.py`, `zhongshan_meiling.py`,
  `zhongshan_xiaoling.py`) is a separate scene, reached by a jump from Zhongshan Gate. Its frame
  is metres from the Bo'ai arch (OSM node 12345226894; 32.0587677, 118.8486466). Inside it:
  - the Mausoleum axis (arch, Tomb Gate, Stele Pavilion, the stair, the Sacrificial Hall);
  - the Music Stage;
  - Meiling Palace and its ring;
  - Ming Xiaoling;
  - Lingyuan Road.

## Phase 1: the city grows east over Purple Mountain

| Part | Plan | Data |
| --- | --- | --- |
| Extent | Core bbox east from lon 118.822 to 118.867, about 4.2 km more (x to about 7,600 m) | `research/core/data/osm-core-zijin.json`, fetched 1 Nov: 13,030 elements, 5,909 buildings, 4,011 highways |
| Terrain | GLO-30 is a surface model, but checked on 1 Nov it sits *below* the mapped summits, not above: Purple Mountain 438.8 m against 448.2 m, Toutuo Ridge 412.9 against 425, Tianbao 240.6 against 250, the north peak 116.0 against 123. The 30 m cells smooth the summits more than the canopy lifts them. So there is no blanket canopy correction; the peaks audit holds it to 12 m. **The city's bare-ground filter must not run here.** Its 5×5-cell minimum (150 m), which strips buildings from the streets, would cut Purple Mountain to 388.3 m, Toutuo Ridge to 377.8, Tianbao to 197.5 and the Sacrificial Hall's ground by 19 m. Inside the mountain's OSM wood the ground is instead max(city bare, DSM − 4 m). Landmark pads are levelled to their own surveyed heights | OSM peak `ele`; the arch DSM 87.8 m in research/zhongshan/FACTS.md |
| Landmarks | A `zhongshan_merge` like `mufu_merge.py`: the Zhongshan world's models, moved from the arch frame to the city frame, on pads cut into the terrain, with city ground hidden beneath | The OSM outlines: hall way 483693967, Tomb Gate 1334432181, Stele Pavilion 1334432182, Music Stage 141915419, Ming Xiaoling 380923041 |
| Roads and paths | OSM roads at their real widths (Lingyuan Road's planes are already in PLANE_ROADS); the Stone Elephant Road (石象路) with its statues; hiking paths and steps draped like the Mufu paths | OSM highways in the band |
| Trees | Mountain forest from research/plants (pine, sweetgum, oak, maple; cedar on the Mausoleum axis) | research/plants/FACTS.md, to extend |
| Transport | Bus 34's real route runs on past Zhongshan Gate: 卫桥 Weiqiao, 卫岗 Weigang, 下马坊 Xiamafang, 博爱园 Bo'ai Garden, and its terminus 中山陵停车场 Zhongshan Mausoleum Car Park (32.0501, 118.8444). Today it is trimmed at the map's edge; once the map is extended it ends where the real one does. Metro 2 stations in the band come in through transit-prep. The jump from Zhongshan Gate goes | osm-core-bus34.json (stop nodes, OSM survey/GPS) |
| Walking | A new 4 m walk grid over the mountain, with finer grids at the Mausoleum and the Music Stage; a paraglider take-off on the summit ridge | n/a |

### Audits (added to the existing four)

- **Peaks:** the built ground at each OSM peak is within 12 m of its `ele`.
- **Landmarks:** each placed model lies within 5 m of its OSM outline.
- **Reachable:** you can walk from Zhongshan Gate along Lingyuan Road to the Sacrificial Hall, and
  from the Mausoleum to the summit.
- **Transit:** Bus 34 and Metro 2 stops in the band sit on roads and entrances.

## Later phases

2. **South:** the Old South (Confucius Temple, Zhonghua Gate), bbox lat 32.006–32.028, joined at
   the Qinhuai.
3. **Niushou and Qixia:** too far for one continuous map (about 15 km). They are reached by their
   real roads as corridors (bus or bike), with the full detail at the destination.

## Order of work

1. Let the running core rebuild finish and pass its audits (road widths, pavements).
2. Widen the bbox, merge the band, re-run area-prep and transit-prep.
3. Canopy correction plus the peaks audit.
4. Run the build without the merge; check roads, trees and audits over the mountain.
5. `zhongshan_merge`, plus the landmarks audit.
6. Walk grids, spawns and transit; then the browser journey: Zhongshan Gate → Lingyuan Road →
   Mausoleum → summit.
