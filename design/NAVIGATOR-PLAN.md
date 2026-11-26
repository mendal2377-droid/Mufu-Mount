# One map to every place: plan (the owner's notes 1, 2 and 7, 27 November 2026)

The owner: "Redesign the navigator to each place. There are a lot of entrances to each place and it's
confusing. There should be a 2D map option. Make the bus and metro system more easy and obvious to take."

## Today: six ways in, none of them the obvious one

1. **The home page's 3D overview**, with a pin for each landmark ("Choose a pin to enter").
2. **The Places panel** beside it, with four tabs (Hills, Waters, City, Heritage).
3. **G in the city**: the Places dialog, "nearest first", where choosing one drops the visitor in on its road.
4. **[ and ]**: hop to the previous or next landmark.
5. **The moon gates** in the city: walk through one and glide to another scene.
6. **N** (new on 27 Nov): the big map, where a click sets a route.

Each says "go somewhere" its own way, and the buses and metro sit beside them all, hidden behind a stop
or an entrance you must find first.

## Proposed: one 2D map, the same everywhere

- **One map, flat, north up**, drawn from the city's own data (roads, water, parks, the wall, the metro
  lines in their colours, the landmarks as named pins with a small picture). The same map on the home
  page and in the city (N, G or the pin button). The 3D overview stays as a "3D view" switch on the home
  page, for the look of it.
- **Choosing a place on the map** shows a card for it: its name in English and Chinese, a line about it,
  and up to three ways to go, nearest first:
  - **Go now:** glide in, as today (the one quick way, replacing the Places dialog and [ ]).
  - **By metro:** the nearest station to you and to it, the line and where to change. Pressing it walks
    you to the entrance with the gold arrows, then the train takes you, as today's rides do.
  - **By taxi or on foot:** the route with the arrows, as N gives today.
- **Buses and metro on the map:** stations and stops drawn on it. Clicking a station gives its lines and
  "ride from here". In the city, stops and entrances within 300 m are marked on the minimap, and a small
  "Metro 2 min · F" hint appears when you are near one.
- **Removed:** the Places dialog's grid, the four tabs and [ ]; the moon gates stay (they are part of the
  city), and so do the journeys.

## Order

1. The 2D map's drawing for the whole map area (it exists for the core city; the other worlds need theirs
   from their walk grids and streets), landmarks and stations on it.
2. The place card and "Go now"; the home page opens on the map; the 3D view switch.
3. "By metro": station-to-station routes from transit.json (lines, changes), walking to the entrance.
4. Stops and stations on the minimap; the "near a stop" hint.
5. Remove the old ways in; the tests that used them move to the map.

## Not decided

- Whether the home page opens on the 2D map (proposed) or the 3D view.
- Whether "Go now" should exist at all in a keepsake about travelling the city (proposed: yes, it is the
  one quick way, and the owner's friend may only have a few minutes).
