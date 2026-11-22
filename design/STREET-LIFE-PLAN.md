# Street life: plan and research (item 44, step 4)

The owner's list: "people on the squares and lake paths, cyclists, cars on the avenues by road class,
rowing boats on Xuanwu Lake, birds". Until now nothing moved on the city's streets but the metro and
three bus lines. The rule for every city system: built from researched real data, with an audit.

## What the counts say (searched 23 November 2026)

**Cars by road class, peak hour.**
- Central avenues, May 2015, traffic police data: Zhongyang Road (中央路) 4,659 vehicles an hour,
  Zhongshan Road (中山路) 3,768, Zhongshan East Road (中山东路) 4,345
  ([Sina, 2015](http://doc.sina.cn/?id=gsps%3A1-1-31950867)). Read as both directions.
- Elevated and tunnel roads: Yingtian Avenue elevated about 9,000 an hour both ways at peak
  ([Tencent News, 2020](https://news.qq.com/rain/a/20200731A0M6Y400)); the Xuanwu Lake tunnel about
  9,000 an hour at peak and 120,000 a day
  ([Nanjing government reply, Nov 2024](https://www.nanjing.gov.cn/xxgkn/jytabljggk/2024njytabl/shizxta/202411/t20241120_5013968.html);
  [jschina, 2017](https://jsnews.jschina.com.cn/shms/201704/t20170418_372686.shtml)).
- A main road junction in Jianye: about 2,500 an hour both ways at the morning peak
  ([Tencent News, Jun 2026](https://news.qq.com/rain/a/20260624A0AMBJ00)).
- A narrow side road by Zhongshan Gate: 272 motor vehicles and 808 non-motor vehicles an hour at peak
  (Nanjing University of Science and Technology, in
  [Yangtse Evening Post, Jun 2026](https://www.yangtse.com/news/jiangsu/nanjing/202606/t20260614_362398.html)).

**Through the day.** Nanjing's morning peak runs from about 6:30 to 10:00 and is worst near 8:30;
the evening peak, about 16:30 to 19:30, is longer and lighter
([jschina, 2017, big-data analysis](https://jsnews.jschina.com.cn/shms/201704/t20170418_372686.shtml)).
The Xuanwu Lake tunnel's peak hour is 7.5 % of its day (9,000 of 120,000).

**E-bikes.** More than 7 million electric two-wheelers are registered in Nanjing
([Yangtse Evening Post, Dec 2025](https://www.yzwb.net/news/jiangsu/nanjing/202512/t20251230_306139.html)).
On the one road counted for both, e-bikes outnumbered cars three to one (808 to 272).

**Car colours.** In China black (28 %) and white (27 %) lead, then grey (Axalta's 2025 report, as
reported by [cars.tvbs.com.tw](https://cars.tvbs.com.tw/life/301471)); worldwide in 2024 white 31 %,
grey 23 %, black 21 %, silver 9 % ([Motor1, BASF and Axalta](https://www.motor1.com/news/750586/most-popular-car-colours-global-basf/)).

**Xuanwu Lake.** 19 million visits in 2025; on a fine weekend close to 180,000 a day, the park's
stated capacity; about 600 pleasure boats from 11 piers were all in use at Qingming 2026
([Yangtse Evening Post, Apr 2026](https://www.yzwb.net/news/yw/202604/t20260408_340059.html)).

**Not found:** an hour-by-hour count for any Nanjing road; counts for tertiary and residential
streets; footfall per metre of pavement at Xinjiekou (Deji Plaza alone had 66 million visits in 2025,
about 180,000 a day, [Yangtse Evening Post](https://www.yzwb.net/news/ch/202601/t20260101_306824.html)).

## The rules (slice 1: cars and e-bikes, 23 November)

- **Peak flow per direction, by OSM road class.** Motorway and trunk 4,500 an hour (the elevated
  roads' 9,000 halved); primary 2,130 (the three avenues' mean, halved); secondary 1,250 (the Jianye
  junction, halved); tertiary 600 (**our guess**: no count found); residential, living street and
  unclassified 136 (the side road's 272, halved). Links carry half their road's flow. Service roads,
  footways and tunnels carry none we draw; nor do the elevated roads (OSM layer above 0) yet, as
  the walk grid has no deck height for them.
- **Hour of day.** A curve with the morning peak at 8:30 (1.0) and a lighter, longer evening peak,
  night at a twentieth. The curve's shape is **ours**, timed to the 2017 report; its peak hour is
  7.9 % of its day against the tunnel's measured 7.5 %.
- **Spacing.** Vehicles per kilometre of lane = flow / speed / lanes. Speed falls from free flow
  (primary 40 km/h) to the peak (20 km/h) with the hour's flow (**our assumption**: Nanjing publishes
  peak congestion indices, not speeds by class). Lanes from OSM's `lanes` where mapped, otherwise
  by class.
- **E-bikes** keep to the right edge of every road but motorways and trunks: three for every car
  on residential and tertiary streets (the one count); as many as the cars on bigger roads, which
  have their own non-motor lanes (**our guess**). 15 to 20 km/h.
- **Drawn near the traveller only**, within 450 m; each lane a steady stream entering where its way
  begins and leaving where it ends. No junction turning, traffic lights or collisions: a deliberately
  plain model, said so in the credits.
- **Colours:** black 28, white 27, grey 17, silver 9, blue 7, red 6, other 6 in a hundred.

## Slice 1 built and checked (23 November)

src/world-traffic.js, with public/scenes/core/streets.json from tools/street-ways.py: 3,025 surface
ways (1,227 km) after leaving out 111 tunnels and 25 elevated stretches. Checked in the browser
(tests/traffic-browser.mjs) at Xinjiekou: 622 cars and 1,033 e-bikes drawn within 450 m at 8:30,
330 and 659 at 13:00, 21 and 52 at 3:00; every car on a road cell of the walk grid, none on water;
130 cars within 150 m against the 136 the flows above give; cars moving 6.4 m a second at 13:00;
2.5 ms a frame to update. Unit tests: tests/world-traffic.test.js.

**Remodelled the same day after the owner's views** ("too brutal in details", cars "stuck in the
road"): the cars stood on the ground under the road, which the road surfaces overlie by 0.3-0.4 m, so
they sank to their axles; they now stand on the road's own height, as the buses do (checked: every
car over a road cell at its height). The boxes are now rounded, bevelled saloons with a glasshouse,
wheels with hubs and lamps, and step-through e-bikes with seated, helmeted riders, under the city's
own toon shading (src/traffic-models.js). Update cost kept at about 2.5 ms a frame by working out only
the vehicles on the stretches of road within reach.

**The mix (owner, 23 Nov: "still a distance from the real traffic").** Body types by China's 2024
retail sales ([CPCA via Sina, first half](https://finance.sina.cn/2024-07-08/detail-inccmqph1405782.d.html):
SUV 4.88 M, saloon 4.48 M, MPV 0.48 M; SUVs 49.4 % for the year): SUV 47, saloon 33, hatchback 7
(**ours**: the saloons split), MPV 5, taxi 5, van 3 in a hundred. Nanjing has 9,168 metered taxis and
about 57,000 ride-hailing cars ([Nanjing transport bureau, 2025](https://jtj.nanjing.gov.cn/njsjtysj/202602/P020260211591059618560.doc));
the taxis' and vans' shares are **ours**, and no source for Nanjing's taxi colours was found, so a
taxi is any colour with a roof sign. Green plates on 12 % of cars, China's new-energy share at the
end of 2025 ([Xinhua](https://www.news.cn/politics/20260126/85ac0fb013d149569de8eacbdd3020f5/c.html));
Nanjing's is not published. Delivery riders, one e-bike in eight (**ours**: no count), Meituan
yellow and Ele.me blue two to one. Each car has a glasshouse split by pillars, mirrors, plates,
lamps; SUVs roof rails, taxis a roof sign. Checked: tests/traffic-browser.mjs "mix".

**How it moves (owner, 23 Nov).** Each lane near the camera is now simulated (src/traffic-sim.js):
vehicles follow the one ahead by the Intelligent Driver Model (Treiber, Hennecke and Helbing 2000;
its usual urban parameters, not measured in Nanjing), stop at red lights and queue behind them, and
at a way's end go on into a street leaving the same point, straight on three times as often as a
turn. Lights stand at 328 junctions: 84 hold one of the 120 signals OSM maps here (fetched from
Overpass on 23 Nov, research/core/data/osm-core-signals.json); the rest are crossings of main roads
(both secondary or bigger, or a primary and a tertiary; **our rule**: OSM's signals are far too few).
A 120 s cycle (**ours**: Nanjing publishes none; Beijing's Di'anmen Street runs 161 s), 42 % green to
each direction, offsets scattered. Checked at Xinjiekou at 8:30 (tests/traffic-browser.mjs): over a
minute 292 cars first at a red stop line and 2,420 waiting behind, 1,335 vehicles turning into
another street, none closer than a car's length to the one ahead.

**Calmer, and real car shapes (owner, 23 Nov: "less traffic and more real in shape").** The street is
drawn calmer than the counts by the owner's choice: cars at 45 % of the counted flow, e-bikes at 35 %
(CALM in src/world-traffic.js; the counts themselves unchanged). At Xinjiekou at 8:30 that is 290
cars and 357 e-bikes within 450 m. The cars are now Kenney's Car Kit (kenney.nl, CC0; downloaded with
the owner's go-ahead, public/models/kenney-car-kit with its licence): saloon, SUV, hatchback, taxi and
van, each body stretched to its type's real length, width and height and its round wheels set at the
stretched axles; the main body colour, found by hue in the kit's palette, is repainted per car from the
colour mix. Quaternius's CC0 car pack was the other candidate; its Google Drive share refused with
"Quota exceeded" on 23 Nov. No CC0 e-bike model was found (the Poly Pizza scooters are CC BY and
Western), so the e-bikes stay ours, the riders' arms now bent at the elbow.

Not modelled: lane changes and overtaking, turns across oncoming traffic waiting for a gap, the green
waves Nanjing runs on its main roads, cars stopping for the traveller or the buses (they pass through);
signal heads (the lights are not drawn); the elevated roads and the tunnels; lamps lit at night; parked
cars.

## Later slices

People on the squares and lake paths, cyclists in the parks, rowing boats on Xuanwu Lake (600 at
the holiday peak, from 11 piers), birds; each with its own audit.
