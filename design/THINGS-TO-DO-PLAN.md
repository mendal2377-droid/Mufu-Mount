# Things to do in the city: plan (item 44)

The owner, 10 November 2026: after build 12, "things to do" comes first. The city is a sound map
with ways to move through it, but little to do once you arrive.

## What the city has today (checked 10 November)

- **Ways to move:** walk, bike, boat, paraglider, Metro 1–4, Buses 1, 25 and 34.
- **Places to act** in the city's scene file (`public/scenes/core/scene.json`): 18 seats, all at the
  Music Stage and Meiling Palace; no bells, no boat docks, no rides; 4 name labels.
- **The collecting game** (金陵拾遗 Jinling Keepsakes: three lanterns per landmark, each a sourced
  fact, 18 seals) does not run inside the city. `src/nanjing.js` leaves the frame at
  `frameWorld` before `gameView.update`, so the counter shows "0/3" with nothing to pick up. Read
  from the code; not yet confirmed in the browser.
- **Street life:** none. No people and no cars; only metro trains and buses move.
- **Mapped data to build on** (`research/core/data/features.json`): 5 viewpoints, 14 attractions,
  7 museums, 18 memorials. OSM maps no benches here.

## The plan, in order

1. **Lanterns in the city.** Browser code only, no rebuild.
   - Each game landmark that lies inside the map gets its three lanterns at real spots on its
     approach, placed by coordinates on walkable ground.
   - Walking into one shows its fact and its source, as now. Three earn the seal.
   - The landmarks outside the map (the Old South, Niushou, Qixia, the bridges) keep theirs in
     their own worlds, wired the same way.
   - **Audit:** every lantern on walkable ground, and reachable on foot from the nearest spawn or
     stop.
2. **Journeys.** A short list in the menu of real trips to make, each ticked off when done.
   Browser code only. Every one is a trip the journey tests already prove possible:
   - ride Bus 34 from the Yangtze to Zhongshan Gate;
   - ride Metro Line 1 over its viaduct;
   - climb the 392 steps to the Sacrificial Hall;
   - reach Purple Mountain's summit;
   - walk through Xuanwu Gate and visit all five islands;
   - hike Mufu Mountain from Wutang Square down to the river;
   - bike the riverside road to Shangyuanmen.
3. **Places to sit and look.** Sitting, with the camera drifting and new music each time, is the
   interaction the owner liked at the Music Stage.
   - Seats at the 5 mapped viewpoints, the summit, the lake embankment, each island, the wall top
     beside Xuanwu Gate and the Mufu riverside.
   - OSM maps no benches, so the exact spots are ours; the plan and the credits say so.
4. **Life.** People on the squares and lake paths, cyclists, cars on the avenues by road class,
   rowing boats on Xuanwu Lake, birds. The largest piece; its density rules need research first.
5. **Landmark moments,** with Xuanwu phase 2 (item 38): the island landmarks, and a bell to ring.

Steps 1 and 2 can be coded while build 12 runs and checked in the browser after it.
