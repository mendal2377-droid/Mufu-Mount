# The owner's requests — 1 November 2026

Every request from the day, in the order given, with where it stands. "Verified" means checked in
the browser or by an audit; "built" means in the code but not yet checked; "pending rebuild" means it
takes effect with the next city build (`./tools/export-scene.sh core`).

## Open work, in order (updated 13 November 2026)

1. **Item 40, real buildings and park trees** (CMAB, canopy map): built (build 11) and every test passes; committed locally. The screenshots show a gap: CMAB finds only about half the buildings OSM maps (66 % of their area), so blocks near Mochou Lake that the made-up slabs filled are now partly empty. **The owner chose real outlines only (9 Nov):** the outlines are now grown by the measured 0.3–1.4 m (median size now 1.00 of OSM's), and the gaps stay. Takes effect in build 12, with the gate (design/CMAB-CANOPY-PLAN.md, "Results").
2. **Item 43, Xuanwu Gate as it really looks:** in the city (build 12, gate re-exported 12 Nov) and checked: three round arches in blue-green rings, plaque board, balustrade, green-roofed tower; the walk through a side arch passes (704 m). First export was broken twice over (details shattered inside the city-wide mesh; no way through), fixed by giving the gate its own meshes. **Still unlike the photographs:** the plaque has no characters, the wall beside it is plain grey with a wobbling top, the road runs into the shut middle doors, the arch soffits show strip lines.
3. **Item 44, things to do in the city:** step 1 done (12 Nov): 27 keepsake lanterns. **Step 2 done and checked (13 Nov): Journeys** in the menu, seven real trips ticked off as they are made (Bus 34, Metro Line 1's viaduct, the 392 steps, Purple Mountain's summit, Xuanwu Lake's five islands, Mufu Mountain to the river, the riverside bike ride); src/world-journeys.js. Checked in the browser (tests/journeys-browser.mjs): the list, every step's place walkable, the stair climbed with the real controls, the viaduct ridden, progress saved. Not driven end to end in that test: Bus 34, the summit, the islands, Mufu and the bike ride (their routes are proven by the older journey tests; their ticks by the unit test). Next: seats, street life (design/THINGS-TO-DO-PLAN.md).
4. **Item 38, Xuanwu Lake, phase 2:** the Ming wall's look, lotus colour in autumn, the lake's water level against the plan's 9.8 m (which datum), then the island landmarks (Lama Temple, Nuona Pagoda, Lansheng Building, Guo Pu Pier).
5. **Item 37, Purple Mountain, phases 2–3** (design/PURPLE-MOUNTAIN-PLAN.md).
6. **Item 21:** review the rest of the app's text for English first (the place cards still lead with Chinese).
7. **Visual checks not yet done:** item 22 (the bus's glass and seats), item 27 (Wutang Square's old homes: seen from the air in item 40's shot, not yet at street level).
8. **Known faults:** the city audit's banks (2 of 21 samples below their water); Bus 34 runs about 900 m off road at y ≈ 5,200 m in the north-west; broadleaf crowns are sparse.
9. **Publishing:** everything since the last deploy is committed locally on the branch rebuild/blender-city; nothing is pushed. Pushing to main deploys to the live site, so it waits for the owner's go-ahead.

| # | Request | Status |
| --- | --- | --- |
| 1 | Build every city system from real data, with an engineering mind, and audit it (roads, rivers, trees, buildings) | Done: four audits (road, city, scene, transit). The city audit still fails "banks" (2 of 21 bank samples below their water) |
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
| 14 | Real journey test: walk from Wutang Square up the south side, down to the river, bike to Shangyuanmen and back | **Passes** (3 Nov): summit 190 m, river, Shangyuanmen and back. Fixes on the way: walker and bike slip past posts and trunks; Yongji Avenue's last 200 m to Shangyuanmen restored and joined to the Mufu model's road with a graded ramp |
| 15 | Landmarks outside the walkable areas | Built: four new walk areas (west, east, riverside, viaduct) |
| 16 | Painted, more real trees from the plant research | Verified: plane pilot approved; all species rolled out |
| 17 | Leaves floating beyond branches; trees floating in the air | Fixed in the browser; the build-side ground snap is in every build since 7 Nov, not checked separately |
| 18 | Take the bus to view the street; Bus 34 from the Yangtze to Zhongshanling | Verified: Bus 34 on its real route, window seat (V) |
| 19 | Connect a bus destination to the Zhongshanling landmark | Verified: Zhongshan Gate → the Mausoleum scene |
| 20 | Live bus info LED board at each stop | Verified |
| 21 | Speak English; Chinese only where necessary | Done for messages and all transit text. **Open**: review the rest of the app's text (the place cards still lead with Chinese) |
| 22 | A more real bus: glass on four sides, real seats | Built (in the browser code); **not yet seen in a screenshot** |
| 23 | Street lamps blocking the road; buses off the road among lamps | Fixed and verified: 24 of 24,835 lamps in a carriageway (was 11,581); buses 99 % on the road |
| 24 | Buses intersecting each other | Fixed: following distance; 0 overlaps in 3 simulated minutes |
| 25 | The same street views again — is the route real? | Answered (route is real; the bus turned back); fixed: everyone off at the terminus |
| 26 | Both directions sharing one stop | Fixed: a stop on each side of the road |
| 27 | Residential districts look like the commercial ones (Wutang Square: old homes) | Built: building types from OSM land use; old walk-up façades. In every build since 7 Nov; **not yet seen in a screenshot** (due with item 40's Wutang Square shot) |
| 28 | Some windows drawn outside the buildings | Fixed: the top row of windows was cut by the roof line; now only whole floors get windows, with a plain parapet above. Checked in close-ups |
| 29 | Leaves still outside the branches | Fixed: every leaf cluster now hangs on a limb or twig; checked on plane, ginkgo, camphor, cedar, willow |
| 30 | The boat: only on water; it can float in the air | Fixed: the boat launches only beside water; off water you step ashore |
| 31 | More real clouds (rain, sun and snow are good) | Fixed: soft cumulus lit from the sun (bright tops, grey bases, silver edges) and a thin high layer; rain and snow untouched. Checked in screenshots |
| 32 | Buses still leave the road and pass through lamps | Fixed: the whole bus width must be on the road; lamps on a bus path removed (99.3–99.8 % on the road) |
| 33 | Two lines at a stop, but only one F to board | Fixed: a chooser lists each line, its direction and the next bus, plus "Whichever comes first" |
| 34 | Stops and metro entrances hidden behind trees | Fixed: trees cleared within 6 m of stops and 7 m of entrances |
| 35 | Residential buildings: real data for the whole map, or copies of representative ones; no repeated streets on a bus tour | Whole map from real data: each building typed from its OSM tag (3,690 apartments) and the land use round it; each home varies by its own height and colour (bay width, window size, paint shade; glazed balconies, stair cores, tile bands, security grilles, darker ground floors). In every build since 7 Nov; with item 40, the infill homes become CMAB's real rooftops |
| 36 | Wrong blocks cut across the road; lamps in the middle of the road | Fixed and verified (3 Nov): divided avenues at each half's real width, pavements stop at carriageways; screenshots of Zhongshan, Beijing East, Hanzhong roads and Gulou |
| 37 | Purple Mountain from real data; landmarks beyond the map stay in their real places, reached by road, with full detail | **Phase 1 verified** (4 Nov): the Zhongshan world (the Mausoleum, Music Stage, Meiling Palace, Ming Xiaoling) stands in the city at its real place; a journey test walks from Bus 34's Zhongshan Gate stop to the Bo'ai arch, up the stair to the Sacrificial Hall and on to the summit (444 m), then rides back to the gate by road (tests/zhongshan-journey-browser.mjs). Fixes on the way: Xiaoling's paving no longer pierced by the city's ground; Bus 34's road kept by Meiling (93 % on a carriageway, was 91 %); roads never laid under the drawn terrain (the bike lost them on slopes and at Yongji Avenue's join with Mufu). Earlier: the ridge is real (Copernicus 30 m elevation) but only a 60 m backdrop with no roads. **Planned**, in phases: (1) extend the city east over Purple Mountain to Zhongshan Mausoleum, with real roads, paths and terrain, joined to Bus 34 and Metro 2; (2) south to the Old South and Zhonghua Gate; (3) Niushou and Qixia, linked by their real roads |
| 38 | Research Xuanwu Lake's data and make it more real ("the hottest natural park") | Researched: research/xuanwu/FACTS.md (the five islands' official areas against OSM, signature scenes, landmarks, gates, 14 named bridges, piers). Plan: design/XUANWU-PLAN.md. **Phase 1 verified** (8 Nov): every island reachable on foot from Xuanwu, Jiefang and Cuizhou gates (15 of 15 routes), a walk through Xuanwu Gate onto the lake, 26 of 26 park bridges walkable, 6 of 6 entrances on walkable ground, name boards, island trees by character, lotus on 8% of the lake, fish (tests/xuanwu-browser.mjs). Not yet: the wall's look, the gate's three arches, autumn lotus colour, the water level against 9.8 m, the island landmarks |
| 39 | The traveller as a cute cartoon duck (Nanjing is famous for its duck) | Done: a round white duck with orange bill and webbed feet, wings for arms, a waddle; keeps the sun hat, scarf and backpack; walks, runs, sits, rides the bike and glides. Checked in screenshots |
| 40 | Get any tool that builds 3D from the map (3 Nov); use the E: disk | Fetched to E:/nanjing-geodata: **CMAB** rooftops with estimated height, use and year (Zhang et al., Scientific Data 2025, CC BY 4.0) and **Meta/WRI 1 m canopy height** (CC BY 4.0); modelling tools were not used, since they only reuse our OSM. Not used: Google 3D Tiles (its terms forbid redistribution); FABDEM (non-commercial), kept in reserve. **Built (build 11, 9 Nov); every test passes; committed locally.** Measured first (tests/cmab-check.py, design/CMAB-CANOPY-PLAN.md): CMAB's heights are no better than a constant here (median 8.4 m off OSM's mapped heights, towers capped near 100 m) and its years are mostly a filler, so neither is used. Its use labels are: they cut the error of our guessed heights from 7.0 m to 4.7 m. In the build: (1) the 26,600 made-up infill slabs replaced by CMAB rooftops that no OSM building covers (24,260 in the data); (2) untagged OSM buildings take CMAB's use label; (3) park trees where the canopy map has trees, at its heights (was 9,000 at random in the centre only). Counts: 20,198 CMAB rooftops built, 3,664 OSM buildings given CMAB's use, 26,288 park trees. Screenshots (test-results/shots/cmab-*.png): Xinjiekou and Wutang Square as dense as before on real outlines; around Mochou Lake blocks are partly empty, because CMAB finds only 53 % of the buildings OSM maps (66 % of their area) and its outlines run 0.3–1.4 m small. **The owner chose real outlines only (9 Nov):** outlines grown by the measured offset (sizes now a median 1.00 of OSM's), the gaps stay; in build 12 |
| 41 | The bike's wheels sink into the road (4 Nov) | Fixed and checked in a screenshot: the traveller's height is read smoothly between the walk grid's cells, not flat per 4 m cell (20 cm off on the 10 % road at Zhongshan Gate) |
| 42 | A bus stop board in the middle of the road (4 Nov) | Fixed: each shelter on the first pavement out from the bus's right with no carriageway beyond, up to 50 m; a probe found 25 of 70 shelters on a carriageway or between two (Zhongshan Road, Zhongshan East Road), now 0 on one; Zhongshan Gate's checked in a screenshot |
| 43 | Xuanwu Gate is far too different from the real gate (9 Nov, with a screenshot) | **Researched** (photographs, Nanjinger, Yangtse Evening Post 2025): three equal round arches with blue-green cloud rings, red doors on the middle one, Cai Yuanpei's plaque, a pale balustrade, and a 1984 green-roofed gallery tower with two-storey end pavilions. Ours: one square hole and two small dark-roofed pavilions. Plan: design/XUANWU-PLAN.md, "Phase 2, first". **Built and checked (12 Nov)**: see the open-work list for what still differs from the photographs |
| 44 | Things to do in the city (10 Nov) | **Planned** (design/THINGS-TO-DO-PLAN.md): the city has 18 seats (all at Zhongshan), no bells or docks, no street life, and the lantern game does not run inside it. Order: lanterns in the city (**done, 12 Nov**), journeys, seats, life, landmark moments |

## Also owed

- Browser tests: `transit` (x-ray check from the paraglider), `city` and `city-game` (time-outs loading the larger city) — **open**.
- The five morning-walk tests (stale since the 22 October home page) — **open**, a separate follow-up.
- Visual checks still to do: camphor, privet, scholar tree, wingnut, maples, cypress; the new bus inside and out; the old walk-ups after the rebuild.
- Screenshots for the owner of the day's work.
- Commit everything. Push or deploy only with the owner's approval.
