# Taxi, map and radio: plan (owner request, 26 November 2026)

The owner asked for "elements of interaction, interesting, like GTA", and chose three of four offered:
drive a taxi, a map with a waypoint and a route, and radio stations. The fourth (talking to people)
waits. The city stays a calm keepsake: no damage, no crashes, nobody hurt. A taxi that meets a car
or a walker ahead slows and stops behind it.

## What is real, and what is ours

- **The taxis are lemon yellow.** Nanjing repainted its 11,732 metered taxis 柠檬黄 lemon yellow in July
  2014 (China News Service, 2 July 2014; The Paper). Ordinary taxis carry a white roof sign with blue
  lettering. Nanjing has 9,168 metered taxis today (src/traffic-models.js). The body is the traffic's own
  taxi model (Kenney's Car Kit, CC0) painted that yellow.
- **The fare is Nanjing's metered tariff:** ¥11 for the first 3 km, then ¥2.4 a kilometre, with 20 % on
  the kilometre rate from 23:00 to 05:00. This is the base tariff from the 2017 fare reform (Jiangsu news,
  August 2017, and its reports), the latest we found. The waiting charge for slow traffic is left out.
  Whether the 2017 rates still hold in 2026 is not confirmed: the credits say "the 2017 tariff".
- **Pickups and destinations are the model's real stops:** the 58 bus stops and 43 metro stations
  in `public/scenes/core/transit.json` (OSM), with their English and Chinese names. Who waits where,
  and where they ask to go, is ours: a random stop 0.6 to 2 km away as the crow flies, so a fare
  is a few minutes' drive.
- **The route follows the mapped roads** (`streets.json`, OSM), one-way streets one way, when
  driving. On foot it also uses the mapped paths (`paths.json`).
- **The radio stations are invented**, and so is their music: four stations composed live in the
  browser, like the bench music. No recordings, no real station.

## Pieces

1. **Driving** (`src/landmark-world.js`, vehicle `car`): on the carriageway only (the bike's road
   rule), about 50 km/h, 70 with Shift, slow reverse. Steering by a bicycle model: the turn tightens
   at low speed and eases at speed. The camera sits higher and further back. F gets in and out; out
   is onto the pavement beside the car.
2. **The taxi** (`src/world-taxi.js`): two taxis at the one taxi rank OSM maps,
   on Zhongshan South Road at Xinjiekou. H hails one to the nearest kerb. Fares: a waving passenger at a stop, marked by a
   column of light; stop beside them and they get in and name a destination, which becomes the
   waypoint. The meter runs in the corner (¥, km). Stop at the destination and they pay the metered
   fare, plus a tip for a quick trip. Takings are kept in the browser (`mufu-taxi-v1`).
3. **The map** (`src/world-nav.js`): a round minimap in the lower left, turning with the traveller.
   It shows roads, water, the route, the waypoint and a fare. N or a click opens the big map; click
   it to set a waypoint and a route. On the ground, gold chevrons lead along the route for the next
   few hundred metres. Leave it by more than 35 m and it is worked out again.
4. **The radio** (`src/radio.js`): R changes the station in the taxi, on the bike and in the boat.
   Each station's name shows large at the top for a moment, with a short sting. Leaving the vehicle
   turns it off.
   - 秦淮丝弦 Qinhuai Strings (the bench music's guzheng)
   - 金陵夜色 Jinling Night Jazz (electric piano chords, bass, brushes)
   - 钟山雨 Purple Mountain Rain (pads, rain, bells)
   - 鼓楼节拍 Drum Tower Beats (an easy hip-hop beat under pentatonic keys)

## Audits

- `npm test` (tests/taxi.test.js): the fare by the tariff (3 km, 10 km, at night); the road graph's
  shortest route on a small grid, one-way streets kept.
- `tests/taxi-browser.mjs`: hail a taxi and get in; take a fare to its stop by the route on the
  carriageway (never off the road, never through a car), and be paid the tariff; the big map sets a
  waypoint and a route appears; the radio turns its stations and stops on leaving the car; the
  minimap draws; no page errors. Its cost a frame.

## Built (27 November 2026)

All four pieces as above. What the browser audit taught, and the rules it led to:
- **Routes:** streets.json leaves out the bridges (off layer 0) and OSM's roads cross without shared
  vertices, so the road graph joins level crossings (not motorways and trunk roads), loose road ends
  across a bridge where the walk grid has road all the way, and footpath ends to the nearest way. A
  mapped road the world did not build as carriageway (by the Ming Palace) is no road for the car.
- **Lanes:** a route keeps 1.6 m right of a two-way road's line, on the line of a one-way road.
- **Traffic and the taxi:** each lane follows the taxi like the car in front, at its middle, nose,
  tail and where its nose will be in 1.2 s; whatever the lanes say, a car or e-bike closing within
  a metre of its outline holds still; no new car is placed within 25 m of it, nor turns into a lane
  whose start is against it. A stopped taxi is waited for only along its own road. The taxi brakes
  for anything within 2 m of its line ahead (walkers only on the carriageway), and creeps past one
  that has stood under its nose for 4 s.
- **Known limits:** walkers do not avoid a stopped taxi and can pass through it; on a one-way road of
  two lanes the route runs between them and a car overtaking may brush the taxi's side (counted by
  the audit, about 7 in a 2 km ride). The audit's ride: no frame off the road, nothing driven into,
  no car through the taxi, the fare and tip as the meter says.
