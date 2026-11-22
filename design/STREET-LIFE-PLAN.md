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

Not modelled: turning at junctions, traffic lights, cars stopping for each other, the traveller or
the buses (they pass through); the elevated roads and the tunnels; lamps lit at night; parked cars.

## Later slices

People on the squares and lake paths, cyclists in the parks, rowing boats on Xuanwu Lake (600 at
the holiday peak, from 11 piers), birds; each with its own audit.
