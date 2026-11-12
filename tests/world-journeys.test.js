import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JOURNEYS, createJourneys, SAVE_KEY, JUMP} from '../src/world-journeys.js';

const memoryStore = (seed = {}) => { const m = {...seed}; return {getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, dump: () => m}; };
const at = (x, n, o = {}) => ({x, n, y: 10, way: 'walk', bus: null, metro: null, ...o});
// Walk a straight line in steps under JUMP, feeding every sample.
function go(j, from, to, o = {}) {
  const d = Math.hypot(to[0] - from[0], to[1] - from[1]), k = Math.max(1, Math.ceil(d / 20)), out = [];
  for (let i = 0; i <= k; i++) out.push(...j.update(at(from[0] + (to[0] - from[0]) * i / k, from[1] + (to[1] - from[1]) * i / k, o)));
  return out;
}

test('every journey has a name, an account and at least two steps', () => {
  for (const [world, list] of Object.entries(JOURNEYS)) {
    assert.equal(new Set(list.map(j => j.id)).size, list.length, `${world}: ids unique`);
    for (const j of list) {
      assert.ok(j.en && j.zh && j.about.length > 30, j.id);
      assert.ok(j.steps.length >= 2 && j.steps.every(s => s.en && typeof s.test === 'function'), j.id);
    }
  }
});

test('the transit journeys name lines and places the scene really has', () => {
  const t = JSON.parse(fs.readFileSync(new URL('../public/scenes/core/transit.json', import.meta.url)));
  const bus = t.lines.find(l => l.id === 'bus-34'), metro = t.lines.find(l => l.id === 'subway-1');
  assert.ok(bus && metro);
  const j = createJourneys('core', null);
  // Aboard Bus 34 at each of its three stops.
  for (const en of ['Zhongshan Wharf', 'Gulou', 'Zhongshan Gate']) {
    const s = bus.stops.find(q => q.en === en);
    assert.ok(s, en);
    j.interrupt();
    assert.equal(j.update(at(s.at[0], s.at[1], {bus: 'bus-34'})).length, 1, en);
  }
  assert.ok(j.view().find(v => v.id === 'bus34').finished);
  // The viaduct is where the line's data says it is elevated.
  const [a, b] = metro.elevated[0];
  const k = createJourneys('core', null);
  assert.equal(k.update(at(0, 5000, {metro: 'subway-1', s: a - 50})).length, 0, 'still in the tunnel');
  let ev = [];
  for (let s = a + 10; s < b; s += 100) ev.push(...k.update(at(0, 5000, {metro: 'subway-1', s})));
  assert.deepEqual(ev.map(e => e.step), [0, 1]);
  assert.ok(ev[1].finished);
});

test('an ordered journey needs its steps in order and in one go', () => {
  const j = createJourneys('core', null);
  // Arriving at the Sacrificial Hall without the stair's foot counts for nothing.
  const foot = {y: 120}, top = {y: 158};
  assert.equal(j.update(at(6086, 2470, top)).length, 0);
  assert.equal(go(j, [6093, 2360], [6093, 2389], foot).filter(e => e.journey.id === 'steps392').length, 1);
  // Dropping in elsewhere (a jump) starts it again.
  j.update(at(6093 + JUMP + 50, 2389));
  assert.equal(j.view().find(v => v.id === 'steps392').done, 0);
  const ev = [...go(j, [6093, 2360], [6093, 2389], foot), ...go(j, [6093, 2400], [6086, 2470], top)].filter(e => e.journey.id === 'steps392');
  assert.deepEqual(ev.map(e => [e.step, e.finished]), [[0, false], [1, true]]);
  // On the bike the stair does not count.
  const k = createJourneys('core', null);
  assert.equal([...go(k, [6093, 2360], [6093, 2389], {way: 'bike', ...foot}), ...go(k, [6093, 2400], [6086, 2470], {way: 'bike', ...top})].filter(e => e.journey.id === 'steps392').length, 0);
});

test('flying interrupts; the summit needs the height', () => {
  const j = createJourneys('core', null);
  go(j, [6120, 1830], [6120, 1857]);
  assert.equal(j.view().find(v => v.id === 'summit').done, 1);
  j.interrupt();
  assert.equal(j.view().find(v => v.id === 'summit').done, 0);
  go(j, [6120, 1830], [6120, 1857]);
  assert.equal(go(j, [6120, 1857], [5444, 3388]).filter(e => e.finished).length, 0, 'at the place but not at the height');
  assert.equal(j.update(at(5444, 3388, {y: 444})).filter(e => e.finished && e.journey.id === 'summit').length, 1);
});

test('the islands tick in any order, survive a jump, and are saved', () => {
  const store = memoryStore();
  const j = createJourneys('core', store);
  assert.equal(j.update(at(916, 3132, {way: 'boat'})).length, 1, 'Lingzhou by boat');
  assert.equal(j.update(at(544, 4086)).length, 1, 'Liangzhou after a jump');
  // Huanzhou and Yingzhou are 55 m apart: each its own tick.
  assert.equal(j.update(at(447, 3616)).length, 1);
  assert.equal(j.update(at(474, 3568)).length, 1);
  // The gate: from the street side, through.
  assert.equal(j.update(at(-82, 3418)).length, 0, 'the lake side alone is not through the gate');
  assert.equal(go(j, [-185, 3405], [-82, 3418]).filter(e => e.journey.id === 'xuanwu').length, 1);
  const again = createJourneys('core', store);
  assert.equal(again.view().find(v => v.id === 'xuanwu').done, 5);
  const ev = again.update(at(1003, 4007));
  assert.ok(ev[0].finished);
  assert.equal(again.count(), 1);
  assert.ok(JSON.parse(store.dump()[SAVE_KEY]).core.xuanwu.length === 6);
  again.reset();
  assert.equal(createJourneys('core', store).count(), 0);
});

test('a half-made ordered journey is not saved; a world without journeys has none', () => {
  const store = memoryStore();
  const j = createJourneys('core', store);
  go(j, [-1065, 7840], [-1065, 7860]);
  assert.equal(j.view().find(v => v.id === 'mufu').done, 1);
  assert.equal(createJourneys('core', store).view().find(v => v.id === 'mufu').done, 0);
  assert.equal(createJourneys('nowhere', store), null);
});
