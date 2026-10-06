// 金陵拾遗 — Jinling Keepsakes.
//
// A small collecting game laid over the atlas, with three loops that feed each
// other: walk a landmark's approach and pick up its three paper lanterns, each of
// which tells you one true thing about the place; three lanterns earn that
// landmark's seal; fly the kite through the ring run to cross the whole city.
// Nothing here changes what the city *is* — it gives a reason to look.
//
// This file is pure: no THREE, no DOM. State goes through an injected storage
// so tests can run it, and so a blocked localStorage degrades to a session game
// instead of throwing.

export const SAVE_KEY = 'mufu-city-game-v1';

// Every fact below was read from the cited page (or the search summary of it) in
// the October 2026 research pass; see research/nanjing/GAME-FACTS.md. `look`
// entries are observations about the model, not claims about the real place.
export const FACTS = {
  bridge: [
    { t: 'Opened in 1968 as the first heavy bridge over the Yangtze designed and built with Chinese expertise.', src: 'https://en.wikipedia.org/wiki/Nanjing_Yangtze_River_Bridge' },
    { t: 'A double-deck steel truss: four road lanes above, twin railway tracks below. The main bridge runs 1,576 m.', src: 'https://en.wikipedia.org/wiki/Nanjing_Yangtze_River_Bridge' },
    { t: 'Each 70 m bridgehead tower carries three steel red flags and sculptures of workers, peasants and soldiers.', src: 'https://www.tour-beijing.com/blog/jiangsu-travel/nanjing-travel/how-to-visit-nanjing-yangtze-river-bridge' },
  ],
  yuejiang: [
    { t: 'Zhu Yuanzhang planned a tower here in 1374 after his victory at Lion Hill. It stayed on paper for over 600 years.', src: 'https://www.ourchinastory.com/en/11907/Legend-of-the-first-tower-in-Jiangnan%E2%80%94Yuejiang-Tower' },
    { t: 'Built 1999–2001 in Ming style: 52 m tall and seven levels, though only four show from outside.', src: 'https://www.trip.com/moments/poi-yuejiang-tower-86069/' },
    { t: 'Red pillars, glazed tiles and gilded ridges. Look for the red balcony on every tier.', src: 'https://www.trip.com/moments/poi-yuejiang-tower-86069/', look: true },
  ],
  xuanwu: [
    { t: 'About 444 hectares with a 15 km shoreline, and five islets joined by bridges.', src: 'https://en.wikipedia.org/wiki/Xuanwu_Lake' },
    { t: 'The largest imperial lake garden in Chinese history, with over 2,300 years of recorded past.', src: 'https://en.wikipedia.org/wiki/Xuanwu_Lake' },
    { t: 'Each island has its season: willows on Huan, cherry blossom on Ying, chrysanthemums on Liang.', src: 'https://en.wikipedia.org/wiki/Xuanwu_Lake' },
  ],
  jiming: [
    { t: 'First built in AD 527; the temple you see dates from the Ming, in 1387.', src: 'https://en.wikipedia.org/wiki/Jiming_Temple' },
    { t: 'The Medicine Buddha Pagoda is 44.8 m tall: seven octagonal levels, double eaves and copper roof tiles.', src: 'https://en.wikipedia.org/wiki/Jiming_Temple' },
    { t: 'A cherry-blossom avenue climbs beside it, and the old city wall at Taicheng looks over Zifeng and Xuanwu Lake.', src: 'https://www.chinaeducationaltours.com/guide/nanjing-jiming-temple.htm' },
  ],
  zifeng: [
    { t: '450 m tall, designed by Skidmore, Owings & Merrill and completed in 2010.', src: 'https://www.som.com/projects/zifeng_tower' },
    { t: 'Its stepped, triangular form shows what is inside: offices and shops below, a hotel, restaurant and public observatory above.', src: 'https://www.som.com/projects/zifeng_tower' },
    { t: 'Look for the thin mast on top: the shaft narrows in set-back steps, each shifted off-centre.', src: 'https://www.skyscrapercenter.com/building/zifeng-tower/165', look: true },
  ],
  zijin: [
    { t: 'At 448.9 m it is the highest mountain in Nanjing.', src: 'https://en.wikipedia.org/wiki/Purple_Mountain_(Nanjing)' },
    { t: 'Purple and golden clouds often wrap its peaks at dawn and dusk, which is where the name comes from.', src: 'https://en.wikipedia.org/wiki/Purple_Mountain_(Nanjing)' },
    { t: 'Its observatory, built to Sun Yat-sen’s last wish, was the first designed by Chinese people.', src: 'https://www.agatetravel.com/mausoleum-of-dr-sun-yat-sen.html' },
  ],
  zhongshan: [
    { t: 'Exactly 392 stone steps climb from the memorial archway to the sacrificial hall.', src: 'https://www.chinaeducationaltours.com/guide/nanjing-sun-yat-sen-mausoleum.htm' },
    { t: 'Blue glazed roofs over white granite: “blue sky, white sun”.', src: 'https://www.chinaeducationaltours.com/guide/nanjing-sun-yat-sen-mausoleum.htm' },
    { t: 'Lü Yanzhi won the commission from more than forty entries; building ran from 1926 to 1929.', src: 'https://www.chinaeducationaltours.com/guide/nanjing-sun-yat-sen-mausoleum.htm' },
  ],
  xiaoling: [
    { t: 'The tomb of the Hongwu Emperor, founder of the Ming: begun in 1381, finished in 1405, with about 100,000 labourers.', src: 'https://en.wikipedia.org/wiki/Xiao_Mausoleum' },
    { t: 'A 1.8 km Sacred Way is lined with twelve pairs of stone guardians, from lions and camels to elephants and qilin.', src: 'https://www.chinaeducationaltours.com/guide/nanjing-ming-xiaoling-mausoleum.htm' },
    { t: 'A UNESCO World Heritage Site since 3 July 2003, and the pattern for Ming and Qing imperial tombs.', src: 'https://en.wikipedia.org/wiki/Xiao_Mausoleum' },
  ],
  palace: [
    { t: 'The site was a Ming prince’s mansion, then the Qing viceroy’s office, then the Taiping “Heavenly King’s Mansion”.', src: 'https://en.wikipedia.org/wiki/Presidential_Palace_(Nanjing)' },
    { t: 'Sun Yat-sen’s government used it as presidential offices in 1912, and the Kuomintang from 1927 to 1949.', src: 'https://en.wikipedia.org/wiki/Presidential_Palace_(Nanjing)' },
    { t: 'The gatehouse has eight Ionic columns on its south face and three arched iron gates; the stone lions came from the viceroy’s old gate.', src: 'https://www.islamichinatravel.com/destination-guide/nanjing/nanjing-attractions/presidential-palace/' },
  ],
  qinhuai: [
    { t: 'The Confucius Temple was rebuilt in 1034 after a fire and has long been tied to the imperial university.', src: 'https://en.wikipedia.org/wiki/Nanjing_Fuzimiao' },
    { t: 'Dacheng Hall stands 16.22 m high on a 1.5 m pedestal.', src: 'https://www.travelchinaguide.com/attraction/jiangsu/nanjing/fuzimiao.htm' },
    { t: 'Burned in 1937 and rebuilt from 1984, it now sits among lantern-lit shops on the Qinhuai River.', src: 'https://en.wikipedia.org/wiki/Nanjing_Fuzimiao' },
  ],
  zhonghua: [
    { t: 'Three closed courtyards and four arched gates: an enemy that broke the first door could be trapped inside.', src: 'https://en.wikipedia.org/wiki/Zhonghua_Gate,_Nanjing' },
    { t: 'Built between 1366 and 1387, it is the largest castle-style city gate in China.', src: 'https://www.travelchinaguide.com/attraction/jiangsu/nanjing/zhonghua_gate.htm' },
    { t: 'The barbican is an oblique rectangle with a perimeter of about 199 m.', src: 'https://www.travelchinaguide.com/attraction/jiangsu/nanjing/zhonghua_gate.htm' },
  ],
  mendong: [
    { t: 'Laomendong’s lanes are marked by a stone paifang gateway.', src: 'https://dfz.nanjing.gov.cn/gzdt/202411/t20241101_4998828.html' },
    { t: 'Stepped “horsehead” gables rise above the whitewashed walls.', src: 'https://dfz.nanjing.gov.cn/gzdt/202411/t20241101_4998828.html' },
    { t: 'Compare it with Qinhuai next door: no canal here, just stone, lanes and white walls.', src: 'https://dfz.nanjing.gov.cn/gzdt/202411/t20241101_4998828.html', look: true },
  ],
  mochou: [
    { t: 'About 47 hectares and over 1,500 years old; it was once part of the Yangtze.', src: 'https://en.wikipedia.org/wiki/Mochou_Lake' },
    { t: 'Named for Mochou, “no worries”, a young woman from Luoyang in a Liang-dynasty poem.', src: 'https://en.wikipedia.org/wiki/Mochou_Lake' },
    { t: 'Legend says Zhu Yuanzhang and Xu Da played chess at Shengqi Pavilion; the stones spelled “long live” and the lake became Xu Da’s.', src: 'https://www.travelchinaguide.com/attraction/jiangsu/nanjing/mochou.htm' },
  ],
  eye: [
    { t: '827.5 m long with a 531.5 m main span: the first sightseeing footbridge on the Yangtze.', src: 'https://baike.baidu.com/en/item/Nanjing%20Eye%20Footbridge/928561' },
    { t: 'Two white elliptical towers, tilted 35° to the shore, carry the whole bridge.', src: 'https://baike.baidu.com/en/item/Nanjing%20Eye%20Footbridge/928561' },
    { t: 'It opened on 16 August 2014 and links Jiangxinzhou with Hexi.', src: 'https://baike.baidu.com/en/item/Nanjing%20Eye%20Footbridge/928561' },
  ],
  third: [
    { t: 'Officially the Dashengguan road bridge, formerly called the Third Yangtze Bridge.', src: 'https://jtj.nanjing.gov.cn/bmdt/202402/t20240226_4174172.html' },
    { t: 'Its steel towers curve into an A shape, with fans of cables reaching down to the deck.', src: 'https://jtj.nanjing.gov.cn/bmdt/202402/t20240226_4174172.html' },
    { t: 'It is not the high-speed railway arch bridge beside it: a different structure with a different job.', src: 'https://jtj.nanjing.gov.cn/bmdt/202402/t20240226_4174172.html' },
  ],
  niushou: [
    { t: 'Named for twin peaks that look like a bull’s horns.', src: 'https://en.wikipedia.org/wiki/Niushoushan' },
    { t: 'The Buddha’s Usnisa Palace is a golden hemispherical dome, said to echo a lotus rising from water.', src: 'https://www.chinadiscovery.com/jiangsu/nanjing/niushoushan.html' },
    { t: 'Niutou Chan, which began here, was an early step in making Chan Buddhism Chinese.', src: 'https://en.wikipedia.org/wiki/Niushoushan' },
  ],
  qixia: [
    { t: 'Founded by the monk Ming Sengshao in the Southern Qi dynasty (479–502).', src: 'https://en.wikipedia.org/wiki/Qixia_Temple' },
    { t: 'The five-storey octagonal Sheli Pagoda was first built in 601 and rebuilt in 945 under Southern Tang.', src: 'https://en.wikipedia.org/wiki/Qixia_Temple' },
    { t: 'Behind the temple, the Thousand Buddha Cliff carries grottoes from the Qi dynasty to the Ming; maples turn crimson in November.', src: 'https://www.travelchinaguide.com/attraction/jiangsu/nanjing/qixia_temple.htm' },
  ],
  // Mufu is a separate, photograph-driven scene; its seal comes from the morning walk.
  mufu: [
    { t: 'The Muyan riverside runs about 5.7 km along the south bank, its decks facing Bagua Island.', src: 'https://www.njqxq.gov.cn/lydt/202211/t20221128_3767167.html' },
    { t: 'Yanji Evening Glow, one of the Forty-Eight Scenes of Jinling, belongs to this shore.', src: 'https://www.njqxq.gov.cn/lydt/202211/t20221128_3767167.html' },
    { t: 'The ridge’s historic peak once reached 205 m before decades of limestone quarrying cut it down.', src: 'https://zh.wikipedia.org/zh-tw/%E5%B9%95%E5%BA%9C%E5%B1%B1' },
  ],
};

/** Seals, in the order the passport lists them. Mufu comes first: it is where this started. */
export const STAMPS = ['mufu', 'bridge', 'yuejiang', 'xuanwu', 'jiming', 'zifeng', 'zijin', 'zhongshan', 'xiaoling',
  'palace', 'qinhuai', 'zhonghua', 'mendong', 'mochou', 'eye', 'third', 'niushou', 'qixia'];

/** How many of the twenty Mufu morning photographs earn its seal. */
export const MUFU_PHOTOS_NEEDED = 5;

export const RANKS = [
  { at: 0, zh: '游人', en: 'Wanderer' },
  { at: 3, zh: '行者', en: 'Pilgrim' },
  { at: 7, zh: '掌灯人', en: 'Lamp-bearer' },
  { at: 12, zh: '金陵客', en: 'Friend of Jinling' },
  { at: 18, zh: '金陵守', en: 'Warden of Jinling' },
];

export function rankFor(stamps) {
  let r = RANKS[0];
  for (const rank of RANKS) if (stamps >= rank.at) r = rank;
  const next = RANKS.find(x => x.at > stamps) || null;
  return { ...r, next, toNext: next ? next.at - stamps : 0 };
}

// ---------------------------------------------------------------------------
// Lanterns

/** Where a lantern hangs relative to the road. Inside the corridor, so a walker reaches it. */
export const PICKUP_RADIUS = 3.4;

/**
 * Three lantern positions along a walk. Walks that start with an avenue get two
 * on the approach, where you will see them straight away, and one around the
 * loop; every other walk spreads them out along its length.
 *
 * @param {number[][]} points  the walk, [x, y, z]
 * @param {number} [avenueCount]  how many leading points are the straight avenue
 */
export function placeLanterns(points, avenueCount = 0) {
  const n = points.length;
  let picks;
  if (avenueCount > 8 && n > avenueCount + 8) {
    picks = [Math.floor(avenueCount * 0.5), Math.floor(avenueCount * 0.9), avenueCount + Math.floor((n - avenueCount) * 0.5)];
  } else {
    picks = [0.32, 0.62, 0.92].map(f => Math.floor((n - 1) * f));
  }
  return picks.map((index, k) => {
    const a = points[Math.max(0, index - 1)], b = points[Math.min(n - 1, index + 1)];
    const dx = b[0] - a[0], dz = b[2] - a[2], len = Math.hypot(dx, dz) || 1;
    const side = k % 2 ? -1 : 1, off = 1.1 * side;
    const p = points[index];
    // Perpendicular to the road, a metre or so off the centre line.
    return [p[0] + (-dz / len) * off, p[1] + 1.55, p[2] + (dx / len) * off];
  });
}

// ---------------------------------------------------------------------------
// The ring run

/** The kite course across the city, in the order the rings are flown. */
export const RUN_COURSE = ['bridge', 'yuejiang', 'xuanwu', 'jiming', 'zifeng', 'palace', 'qinhuai', 'zhonghua', 'mochou', 'eye', 'third'];
export const RING_RADIUS = 22;

/** Gold/silver/bronze are fractions of the course length, in seconds per model unit. */
export function medalFor(seconds, courseLength) {
  const gold = courseLength / 50, silver = courseLength / 36, bronze = courseLength / 26;
  if (seconds <= gold) return 'gold';
  if (seconds <= silver) return 'silver';
  if (seconds <= bronze) return 'bronze';
  return null;
}

/**
 * Rings float above each landmark, clear of its roof, and face the next one.
 * @param {{id:string,position:number[]}[]} places
 * @param {(x:number,z:number)=>number} ground
 * @param {Record<string,number>} heights  rough landmark heights, from EXTENT
 */
export function buildCourse(places, ground, heights) {
  const byId = new Map(places.map(p => [p.id, p]));
  const centres = RUN_COURSE.map(id => {
    const p = byId.get(id), [x, , z] = p.position;
    return { id, x, z, y: Math.max(ground(x, z), p.position[1]) + Math.max(34, (heights[id] || 30) + 22) };
  });
  const rings = centres.map((c, i) => {
    const next = centres[Math.min(centres.length - 1, i + 1)], prev = centres[Math.max(0, i - 1)];
    const ref = i === centres.length - 1 ? c : next, from = i === centres.length - 1 ? prev : c;
    const dx = ref.x - from.x, dz = ref.z - from.z, len = Math.hypot(dx, dz) || 1;
    return { id: c.id, position: [c.x, c.y, c.z], facing: [dx / len, dz / len] };
  });
  let length = 0;
  for (let i = 1; i < rings.length; i++) {
    const a = rings[i - 1].position, b = rings[i].position;
    length += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  }
  return { rings, length };
}

/** True when the flyer is inside the ring's disc, close enough to count. */
export function throughRing(position, ring, radius = RING_RADIUS) {
  const dx = position[0] - ring.position[0], dy = position[1] - ring.position[1], dz = position[2] - ring.position[2];
  return Math.hypot(dx, dy, dz) <= radius * 0.9;
}

// ---------------------------------------------------------------------------
// Progress

const empty = () => ({ v: 1, lanterns: {}, stamps: {}, mufuPhotos: 0, run: { best: null, medal: null, runs: 0 } });

function sanitize(raw) {
  const s = empty();
  if (!raw || typeof raw !== 'object') return s;
  for (const id of STAMPS) {
    const l = raw.lanterns?.[id];
    if (Array.isArray(l)) s.lanterns[id] = [...new Set(l.filter(i => Number.isInteger(i) && i >= 0 && i < 3))].sort();
    if (raw.stamps?.[id]) s.stamps[id] = true;
  }
  if (Number.isInteger(raw.mufuPhotos)) s.mufuPhotos = Math.min(20, Math.max(0, raw.mufuPhotos));
  const r = raw.run;
  if (r && Number.isFinite(r.best) && r.best > 0) s.run = { best: r.best, medal: ['gold', 'silver', 'bronze'].includes(r.medal) ? r.medal : null, runs: Math.max(1, r.runs | 0) };
  return s;
}

export function createGame(storage) {
  let state;
  const read = () => { try { return JSON.parse(storage?.getItem(SAVE_KEY) || 'null'); } catch { return null; } };
  const write = () => { try { storage?.setItem(SAVE_KEY, JSON.stringify(state)); } catch { /* a blocked store only costs persistence */ } };
  state = sanitize(read());
  const listeners = new Set();
  const emit = e => listeners.forEach(f => f(e));

  const api = {
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    lanterns(id) { return state.lanterns[id] || []; },
    has(id, index) { return (state.lanterns[id] || []).includes(index); },
    count(id) { return (state.lanterns[id] || []).length; },
    stamped(id) { return !!state.stamps[id]; },
    stampCount() { return STAMPS.filter(id => state.stamps[id]).length; },
    rank() { return rankFor(api.stampCount()); },
    get mufuPhotos() { return state.mufuPhotos; },
    get run() { return { ...state.run }; },

    /** Pick up lantern `index` at `id`. Reports whether it was new and what it earned. */
    collect(id, index) {
      if (!STAMPS.includes(id) || !(index >= 0 && index < 3)) return { fresh: false };
      const list = state.lanterns[id] || (state.lanterns[id] = []);
      if (list.includes(index)) return { fresh: false, count: list.length };
      list.push(index); list.sort();
      const fact = FACTS[id]?.[index];
      let seal = false;
      if (list.length === 3 && !state.stamps[id]) { state.stamps[id] = true; seal = true; }
      write();
      const result = { fresh: true, count: list.length, fact, seal, id, index };
      emit({ type: 'lantern', ...result });
      if (seal) emit({ type: 'seal', id, total: api.stampCount(), rank: api.rank() });
      return result;
    },

    /** Mufu's seal is earned in the other scene: find enough of its morning photographs. */
    noteMufu(found) {
      const n = Math.min(20, Math.max(0, found | 0));
      if (n === state.mufuPhotos) return false;
      state.mufuPhotos = n;
      let seal = false;
      if (n >= MUFU_PHOTOS_NEEDED && !state.stamps.mufu) { state.stamps.mufu = true; seal = true; }
      write();
      if (seal) emit({ type: 'seal', id: 'mufu', total: api.stampCount(), rank: api.rank() });
      return seal;
    },

    /** Record a finished ring run and report the medal and whether it is a personal best. */
    recordRun(seconds, courseLength) {
      const medal = medalFor(seconds, courseLength);
      const best = state.run.best == null || seconds < state.run.best;
      state.run = { best: best ? seconds : state.run.best, medal: best ? medal : state.run.medal, runs: state.run.runs + 1 };
      write();
      const result = { seconds, medal, personalBest: best };
      emit({ type: 'run', ...result });
      return result;
    },

    reset() { state = empty(); write(); emit({ type: 'reset' }); },
    snapshot() { return JSON.parse(JSON.stringify(state)); },
  };
  return api;
}
