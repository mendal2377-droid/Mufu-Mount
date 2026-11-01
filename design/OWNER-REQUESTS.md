# The owner's requests — 1 November 2026

Every request from the day, in the order given, with where it stands. "Verified" means checked in
the browser or by an audit; "built" means in the code but not yet checked; "pending rebuild" means it
takes effect with the next city build (`./tools/export-scene.sh core`).

| # | Request | Status |
| --- | --- | --- |
| 1 | Build every city system from real data, with an engineering mind, and audit it (roads, rivers, trees, buildings) | Done: four audits (road, city, scene, transit). Last open item: the Yangtze bank by Mufu, pending rebuild |
| 2 | Automatic metro and buses on fixed routes; representative lines only | Verified: Metro 1, 2, 3, 4; Buses 1, 25, 34 |
| 3 | How the metro runs, and how the user interacts | Answered; station picker, ride from above |
| 4 | Inside-the-carriage view | Verified (V during a ride) |
| 5 | Trains mostly underground — show them? | Verified: x-ray trains from above; Line 1's real viaduct above ground |
| 6 | Street-level signs and rumble | Verified: next-train LED, caption, rumble |
| 7 | Add Line 3 | Verified; ends at Shangyuanmen on the south bank |
| 8 | Line 3 stations connected to Mufu Mountain | Verified: Shangyuanmen at the mountain's foot |
| 9 | Metro entrance: LED built into the entrance, open doorway, "Enter" note when near | Verified |
| 10 | The LED shows the current station's name, not "next" | Verified |
| 11 | Wutang Square station walkable | Verified (walk grid "wutang") |
| 12 | Merge the detailed Mufu Mountain model into the city map | Verified: placed between the two riverside memorials, walkable |
| 13 | OSM roads inside the mountain; the model's riverside road; connect to the city and the metro | Built and audited ("mufu reachable" passes) |
| 14 | Real journey test: walk from Wutang Square up the south side, down to the river, bike to Shangyuanmen and back | **Open**: test written; fails on the first leg (the foot of the hill too steep for the 4 m grid); fixed by 1 m steps, pending rebuild |
| 15 | Landmarks outside the walkable areas | Built: four new walk areas (west, east, riverside, viaduct) |
| 16 | Painted, more real trees from the plant research | Verified: plane pilot approved; all species rolled out |
| 17 | Leaves floating beyond branches; trees floating in the air | Fixed in the browser; the build-side ground snap pending rebuild |
| 18 | Take the bus to view the street; Bus 34 from the Yangtze to Zhongshanling | Verified: Bus 34 on its real route, window seat (V) |
| 19 | Connect a bus destination to the Zhongshanling landmark | Verified: Zhongshan Gate → the Mausoleum scene |
| 20 | Live bus info LED board at each stop | Verified |
| 21 | Speak English; Chinese only where necessary | Done for messages and all transit text. **Open**: review the rest of the app's text (the place cards still lead with Chinese) |
| 22 | A more real bus: glass on four sides, real seats | Built (in the browser code); **not yet seen in a screenshot** |
| 23 | Street lamps blocking the road; buses off the road among lamps | Fixed in the browser (4,533 lamps off carriageways; buses 94–100 % on the road); build-side pending rebuild |
| 24 | Buses intersecting each other | Fixed: following distance; 0 overlaps in 3 simulated minutes |
| 25 | The same street views again — is the route real? | Answered (route is real; the bus turned back); fixed: everyone off at the terminus |
| 26 | Both directions sharing one stop | Fixed: a stop on each side of the road |
| 27 | Residential districts look like the commercial ones (Wutang Square: old homes) | Built: building types from OSM land use; old walk-up façades. Pending rebuild |
| 28 | Some windows drawn outside the buildings | Fixed: the top row of windows was cut by the roof line; now only whole floors get windows, with a plain parapet above. Checked in close-ups |
| 29 | Leaves still outside the branches | Fixed: every leaf cluster now hangs on a limb or twig; checked on plane, ginkgo, camphor, cedar, willow |
| 30 | The boat: only on water; it can float in the air | Fixed: the boat launches only beside water; off water you step ashore |
| 31 | More real clouds (rain, sun and snow are good) | Fixed: soft cumulus lit from the sun (bright tops, grey bases, silver edges) and a thin high layer; rain and snow untouched. Checked in screenshots |
| 32 | Buses still leave the road and pass through lamps | Fixed: the whole bus width must be on the road; lamps on a bus path removed (99.3–99.8 % on the road) |
| 33 | Two lines at a stop, but only one F to board | Fixed: a chooser lists each line, its direction and the next bus, plus "Whichever comes first" |
| 34 | Stops and metro entrances hidden behind trees | Fixed: trees cleared within 6 m of stops and 7 m of entrances |
| 35 | Residential buildings: real data for the whole map, or copies of representative ones; no repeated streets on a bus tour | Whole map from real data: each building typed from its OSM tag (3,690 apartments) and the land use round it (pending rebuild). Built and screenshotted: each home varies by its own height and colour (bay width, window size, paint shade; glazed balconies, stair cores, tile bands, security grilles, darker ground floors) |
| 36 | Wrong blocks cut across the road; lamps in the middle of the road | Two causes found: pavements ran on across the roads they met, and OSM's one-way halves of divided avenues were each built at the whole avenue's width, so the halves overlapped and lamps stood on the other half. Both fixed in the build, with a new audit (lamps against the OSM centrelines: 16,257 of 38,809 failed before the fix). Pending rebuild |
| 37 | Purple Mountain from real data; landmarks beyond the map stay in their real places, reached by road, with full detail | Answered: the ridge is real (Copernicus 30 m elevation) but only a 60 m backdrop with no roads. **Planned**, in phases: (1) extend the city east over Purple Mountain to Zhongshan Mausoleum, with real roads, paths and terrain, joined to Bus 34 and Metro 2; (2) south to the Old South and Zhonghua Gate; (3) Niushou and Qixia, linked by their real roads |
| 38 | Research Xuanwu Lake's data and make it more real ("the hottest natural park") | Researched: research/xuanwu/FACTS.md (the five islands' official areas against OSM, signature scenes, landmarks, gates, 14 named bridges, piers). Plan: design/XUANWU-PLAN.md. To build after the Purple Mountain extension's first build |

## Also owed

- Browser tests: `transit` (x-ray check from the paraglider), `city` and `city-game` (time-outs loading the larger city) — **open**.
- The five morning-walk tests (stale since the 22 October home page) — **open**, a separate follow-up.
- Visual checks still to do: camphor, privet, scholar tree, wingnut, maples, cypress; the new bus inside and out; the old walk-ups after the rebuild.
- Screenshots for the owner of the day's work.
- Commit everything. Push or deploy only with the owner's approval.
