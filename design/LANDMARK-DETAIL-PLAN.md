# Landmarks: detail, seasons and weather (the owner's note 8, 27 November 2026)

The owner: "some landmarks are still weak in models details, seasons, weather, etc."

## The audit (28 November 2026)

Every walk-in place (12 of the map's 18; the other six open as views from the air) was shot from
where the visitor lands, in three moods: summer at 11:00 clear, autumn at 15:00 in rain, winter at
10:00 in snow. Shots: test-results/shots/n8/ (script: tests/_n8-audit.mjs, a scratch file).

What the shots show, worst first:

**Weather (all twelve places)**
1. **Rain and snow keep the sun's hard shadows.** Under a storm sky the trees and the traveller
   still cast crisp, dark shadows (Mufu, Qixia, the Presidential Palace). Overcast light has none.
2. **Nothing gets wet.** In rain the paving, the roads and the plazas look exactly as when dry;
   only the light dims. No puddles, no sheen, no rings on the water.
3. **Snow falls on the water.** Xuanwu Lake whitens with the ground; the lotus stubble reads as
   grey shards floating on it.
4. **Snow and wet come and go in four seconds**, with the weather itself. Snow should settle and
   melt; a road should stay wet a while after the rain.

**Seasons**
5. **The lawns are summer green all year.** Nanjing's park lawns are mostly warm-season grasses
   that go straw-coloured in winter (an assumption from the grasses' habit; no Nanjing survey found).
6. **Winter willows** read as grey ladders: their hanging strands keep the leaf shape.

**Model detail and setting**
7. **Most arrivals are on a vast empty plaza** (the Mausoleum, the Presidential Palace, the Qinhuai,
   Zhonghua Gate, Niushou): no people, benches, lamps, bins or planters. Street life (item 44)
   was built for Tiny Nanjing only.
8. **The Presidential Palace** stands on a plaza; the real gate fronts Changjiang Road directly,
   with its traffic and plane trees. Its middle opening is square, not the tall arch of the photos.
9. **Qixia** lands on a lawn by a lone moon gate; the temple is a yellow wall and one hall.
10. **The Yangtze Bridge's south bridgehead park** is a bare lawn with a few shrubs; the bridgehead
    tower is a plain block with slots.
11. **Mufu's hiking path** has its rails and posts as plain grey boxes.

## Order

- **Round 1 (shared, every world): weather and seasons, items 1 to 6.** One change in the worlds'
  shared materials and light, so all twelve places gain it at once and the frame cost stays flat.
- **Round 2: people on the landmark plazas** (item 7), from the street-life work's walkers, with
  visitor numbers from each site's published figures where they exist.
- **Round 3: the weakest models one by one** (items 8 to 11), each against photographs, in
  Blender, as the landmark pass of 14 to 18 November.

## Round 1 built (28 November 2026): weather and seasons in every world

All in the worlds' shared materials and light (src/landmark-world.js, src/main.js), so the twelve
walk-in places and Tiny Nanjing gain it together; no new meshes, no new draw calls.

- **Overcast light:** in rain and in snow the sun's shadows fade to a tenth of their strength.
- **Wet ground:** rain soaks level ground within a minute (darker; hard ground darker than grass) and
  it dries over about four minutes after the rain. Puddles gather on hard ground (paving, granite,
  roads, pavements), mirroring the sky, brighter at a glance, with rings where the drops land. The
  open water greys and rings in rain. Lamplight pools are brighter on wet ground at night.
- **Settled snow:** snow whitens the ground and the tree crowns over a minute of snowfall and melts over
  about six after it (faster in rain). Open water keeps its colour; the lotus stubble keeps most of its.
- **Lawns through the year:** straw-coloured in winter, a little tawny in autumn, a fresh flush in spring
  (an assumption from the habit of warm-season lawn grasses; no Nanjing survey was found).
- The rates and amounts are ours, chosen for the look.
- **Audit:** tests/weather-browser.mjs (shadows in rain, the plaza darker when wet and still wet after,
  snow cover and its slow melt, a straw winter lawn against a green summer one). Shots:
  test-results/shots/weather-*.png; before and after: test-results/shots/n8/ and n8-after/.
- **Not done:** the winter willows still keep their leaf strands; no snow on the walls' tops beyond
  what the upward faces take; the six places seen only from the air are unchanged.
