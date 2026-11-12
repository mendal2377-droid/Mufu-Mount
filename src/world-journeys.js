// Journeys: a short list of real trips to make in the city, each ticked off when done
// (design/THINGS-TO-DO-PLAN.md, step 2). Every one is a trip the journey tests prove possible
// (tests/mufu-journey-browser.mjs, tests/zhongshan-journey-browser.mjs, tests/xuanwu-browser.mjs,
// tests/transit-browser.mjs).
//
// This file is pure: no THREE, no DOM. The app feeds it one sample a frame while the traveller is on
// the ground or aboard something: {x east, n north, y height, way: 'walk' | 'bike' | 'boat',
// bus: line id or null, metro: line id or null, s: metres along the metro line}. Flying, gliding and
// arriving by the Places menu are not travelling: the app calls interrupt(), and a jump of more than
// JUMP metres between samples counts the same. That clears the progress of the ordered journeys
// (a climb must be climbed), never a finished step of the unordered ones or a finished journey.
//
// The places are the model's own coordinates, read from the scene's transit file, the journey tests
// and src/world-lanterns.js; the radii are ours. None is a surveyed boundary.
export const SAVE_KEY = 'mufu-journeys-v1';
export const JUMP = 120;

const near = (s, x, n, r) => Math.hypot(s.x - x, s.n - n) < r;
const afoot = s => s.way === 'walk' && !s.bus && !s.metro;
const wheels = s => s.way === 'bike' && !s.bus && !s.metro;
const ground = s => (s.way === 'walk' || s.way === 'bike') && !s.bus && !s.metro;
const VIADUCT = [5887, 8122];    // Metro Line 1's elevated stretch, metres along the line (transit.json)

export const JOURNEYS = {
  core: [
    {id: 'bus34', en: 'Bus 34 across the city', zh: '34路公交',
      about: 'The real Bus 34, from the Yangtze wharf along the Zhongshan Road axis and out through Zhongshan Gate. Ride any part; each stop below ticks when you pass it aboard.',
      steps: [
        {en: 'Be aboard at Zhongshan Wharf, by the Yangtze', test: s => s.bus === 'bus-34' && near(s, -5107, 5310, 250)},
        {en: 'Ride past the Drum Tower (Gulou)', test: s => s.bus === 'bus-34' && near(s, -644, 2312, 200)},
        {en: 'Ride out to Zhongshan Gate', test: s => s.bus === 'bus-34' && near(s, 3526, -124, 200)},
      ]},
    {id: 'metro1', en: 'Metro Line 1 over its viaduct', zh: '地铁1号线高架',
      about: 'North of Nanjing Railway Station, Line 1 leaves its tunnel and runs above the streets. Ride between Nanjing Railway Station and Xiaozhuang, three stops, without getting off.',
      ordered: true,
      steps: [
        {en: 'Ride Line 1 out onto the viaduct', test: s => s.metro === 'subway-1' && s.s > VIADUCT[0] && s.s < VIADUCT[1]},
        {en: 'Stay aboard for its whole length', test(s, m) {
          if (s.metro !== 'subway-1' || !(s.s > VIADUCT[0] && s.s < VIADUCT[1])) return false;
          m.lo = Math.min(m.lo ?? s.s, s.s); m.hi = Math.max(m.hi ?? s.s, s.s);
          return m.hi - m.lo > 2000;
        }},
      ]},
    {id: 'steps392', en: 'The 392 steps', zh: '三百九十二级台阶',
      about: 'The great stair of the Sun Yat-sen Mausoleum, on foot from its foot to the Sacrificial Hall.',
      ordered: true,
      steps: [
        // By height as much as by place: the walkable way up swings off the axis (tests/journeys-browser.mjs),
        // so the foot is the terrace below the stair (100-135 m in the model) and the top is the hall's own (over 150 m).
        {en: 'Start below the great stair', test: s => afoot(s) && near(s, 6093, 2389, 90) && s.y > 100 && s.y < 135},
        {en: 'Climb to the Sacrificial Hall', test: s => afoot(s) && near(s, 6086, 2470, 40) && s.y > 150},
      ]},
    {id: 'summit', en: 'Purple Mountain’s summit', zh: '紫金山头陀岭',
      about: 'From the Bo’ai arch at the Mausoleum’s gate up to the top of Purple Mountain, the highest ground in Nanjing.',
      ordered: true,
      steps: [
        {en: 'Set out from the Bo’ai arch', test: s => ground(s) && near(s, 6120, 1857, 45)},
        {en: 'Reach the summit', test: s => ground(s) && near(s, 5444, 3388, 150) && s.y > 430},
      ]},
    {id: 'xuanwu', en: 'Xuanwu Lake’s five islands', zh: '玄武湖五洲',
      about: 'In through Xuanwu Gate in the Ming wall, then to each of the lake’s five islands, on foot, by bike or by boat.',
      steps: [
        {en: 'Walk through Xuanwu Gate to the lake', test(s, m) {
          if (ground(s) && near(s, -185, 3405, 35)) m.street = true;
          return !!m.street && ground(s) && near(s, -82, 3418, 25);
        }},
        {en: 'Huanzhou, the island of mists and willows', test: s => !s.bus && !s.metro && near(s, 447, 3616, 28)},
        {en: 'Yingzhou, the cherry island', test: s => !s.bus && !s.metro && near(s, 474, 3568, 28)},
        {en: 'Liangzhou, the old imperial garden', test: s => !s.bus && !s.metro && near(s, 544, 4086, 90)},
        {en: 'Cuizhou, the island of pines', test: s => !s.bus && !s.metro && near(s, 1003, 4007, 90)},
        {en: 'Lingzhou, facing Purple Mountain', test: s => !s.bus && !s.metro && near(s, 916, 3132, 90)},
      ]},
    {id: 'mufu', en: 'Over Mufu Mountain to the river', zh: '幕府山到长江',
      about: 'The morning hike this project began with: from Wutang Square up the south side of Mufu Mountain, over the top and down to the Yangtze.',
      ordered: true,
      steps: [
        {en: 'Start at Wutang Square', test: s => afoot(s) && near(s, -1065, 7860, 70)},
        {en: 'Reach the top of Mufu Mountain', test: s => afoot(s) && s.x > -1700 && s.x < 3000 && s.n > 8200 && s.n < 10600 && s.y > 180},
        {en: 'Come down to the Yangtze', test: s => afoot(s) && s.x > -400 && s.x < 1400 && s.n > 10150 && s.y < 14},
      ]},
    {id: 'riverbike', en: 'By bike along the river', zh: '江边骑行',
      about: 'The riverside road under Mufu Mountain, by bike, to Shangyuanmen station on Metro Line 3.',
      ordered: true,
      steps: [
        {en: 'Take the bike on the riverside road', test: s => wheels(s) && s.x > -1500 && s.x < 1500 && s.n > 10000 && s.y < 20},
        {en: 'Ride to Shangyuanmen station', test: s => wheels(s) && near(s, -1803, 8434, 90)},
      ]},
  ],
};

/**
 * Progress through a world's journeys. `storage` is localStorage or null. update(sample) returns
 * the steps this sample completed: [{journey, step (index), finished (the whole journey)}].
 */
export function createJourneys(worldId, storage) {
  const list = JOURNEYS[worldId];
  if (!list) return null;
  const read = () => { try { return JSON.parse(storage?.getItem(SAVE_KEY) || 'null'); } catch { return null; } };
  const saved = read()?.[worldId] || {};
  // done: step indices completed. Ordered journeys keep theirs in memory until the whole is finished.
  const state = new Map(list.map(j => [j.id, {done: new Set((saved[j.id] || []).filter(i => i < j.steps.length)), mem: {}}]));
  const finished = j => state.get(j.id).done.size === j.steps.length;
  function write() {
    const all = read() || {}, mine = {};
    for (const j of list) { const d = [...state.get(j.id).done]; if (d.length && (!j.ordered || finished(j))) mine[j.id] = d; }
    all[worldId] = mine;
    try { storage?.setItem(SAVE_KEY, JSON.stringify(all)); } catch { /* a blocked store only costs persistence */ }
  }
  let last = null;
  function interrupt() {
    last = null;
    for (const j of list) { const st = state.get(j.id); st.mem = {}; if (j.ordered && !finished(j)) st.done.clear(); }
  }
  return {
    list,
    interrupt,
    /** [{id, en, zh, about, steps: [{en, done}], done, total, finished}] for the menu. */
    view: () => list.map(j => { const d = state.get(j.id).done;
      return {id: j.id, en: j.en, zh: j.zh, about: j.about, steps: j.steps.map((s, i) => ({en: s.en, done: d.has(i)})), done: d.size, total: j.steps.length, finished: finished(j)}; }),
    count: () => list.filter(finished).length,
    reset() { for (const st of state.values()) { st.done.clear(); st.mem = {}; } last = null; write(); },
    update(s) {
      if (last && Math.hypot(s.x - last.x, s.n - last.n) > JUMP) interrupt();
      last = {x: s.x, n: s.n};
      const events = [];
      for (const j of list) {
        if (finished(j)) continue;
        const st = state.get(j.id);
        // An ordered journey offers only its next step; an unordered one, every step left.
        const open = j.ordered ? [st.done.size] : j.steps.map((_, i) => i).filter(i => !st.done.has(i));
        for (const i of open) {
          if (!j.steps[i].test(s, st.mem)) continue;
          st.done.add(i); st.mem = j.ordered ? {} : st.mem;
          events.push({journey: j, step: i, finished: finished(j)});
        }
      }
      if (events.length) write();
      return events;
    },
  };
}
