import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  FACTS, STAMPS, RANKS, rankFor, createGame, placeLanterns, buildCourse, throughRing, medalFor,
  RUN_COURSE, RING_RADIUS, PICKUP_RADIUS, SAVE_KEY, MUFU_PHOTOS_NEEDED,
} from '../src/city-game.js';
import {cityPoint} from '../src/city-geography.js';
import {EXTENT} from '../src/city-arrival.js';

const data = JSON.parse(fs.readFileSync(new URL('../public/city/nanjing.json', import.meta.url)));
const places = data.landmarks.map(p => ({...p, position: cityPoint(p.coord, data)}));
const memoryStore = (seed = {}) => { const m = {...seed}; return {getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; }, dump: () => m}; };

test('every landmark has three facts, each short and tied to a public source', () => {
  for (const id of STAMPS) {
    assert.equal(FACTS[id]?.length, 3, `${id} needs three facts`);
    for (const f of FACTS[id]) {
      assert.match(f.src, /^https:\/\//, `${id}: fact without an https source`);
      assert.ok(f.t.length >= 25 && f.t.length <= 175, `${id}: ${f.t.length} characters — a card that long will not be read`);
      assert.ok(!/[<>]/.test(f.t), `${id}: markup in a fact`);
    }
  }
});

test('the passport covers exactly the atlas destinations', () => {
  assert.deepEqual([...STAMPS].sort(), data.landmarks.map(p => p.id).sort());
});

test('three lanterns earn the seal, once, and a repeat pickup is not counted twice', () => {
  const game = createGame(memoryStore());
  assert.equal(game.collect('palace', 0).fresh, true);
  assert.equal(game.collect('palace', 0).fresh, false);
  assert.equal(game.count('palace'), 1);
  game.collect('palace', 1);
  const third = game.collect('palace', 2);
  assert.equal(third.seal, true);
  assert.equal(third.fact.src.startsWith('https://'), true);
  assert.equal(game.stamped('palace'), true);
  assert.equal(game.stampCount(), 1);
  assert.equal(game.collect('palace', 2).fresh, false);
  assert.equal(game.stampCount(), 1);
});

test('events report each lantern and each seal exactly once', () => {
  const game = createGame(memoryStore()), seen = [];
  game.on(e => seen.push(e.type));
  [0, 1, 2, 2, 1].forEach(i => game.collect('eye', i));
  assert.deepEqual(seen, ['lantern', 'lantern', 'lantern', 'seal']);
});

test('invalid pickups are ignored rather than corrupting the save', () => {
  const game = createGame(memoryStore());
  assert.equal(game.collect('nowhere', 0).fresh, false);
  assert.equal(game.collect('palace', 3).fresh, false);
  assert.equal(game.collect('palace', -1).fresh, false);
  assert.equal(game.collect('palace', NaN).fresh, false);
  assert.equal(game.stampCount(), 0);
});

test('progress survives a reload, and a corrupt or hostile save is repaired, not trusted', () => {
  const store = memoryStore();
  const a = createGame(store);
  a.collect('zifeng', 0); a.collect('zifeng', 1); a.collect('zifeng', 2); a.collect('qixia', 1);
  a.recordRun(88.5, 2100);
  const b = createGame(store);
  assert.equal(b.stamped('zifeng'), true);
  assert.deepEqual(b.lanterns('qixia'), [1]);
  assert.equal(b.run.best, 88.5);
  for (const bad of ['not json', '{"lanterns":{"palace":[9,-1,"x",1,1]},"stamps":{"fake":true,"palace":true},"run":{"best":-4}}', 'null', '[]']) {
    const g = createGame(memoryStore({[SAVE_KEY]: bad}));
    assert.ok(g.count('palace') <= 3);
    assert.equal(g.stamped('fake'), false);
    assert.equal(g.run.best, null);
    assert.doesNotThrow(() => g.collect('palace', 0));
  }
});

test('a storage that throws costs persistence but never the game', () => {
  const hostile = {getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); }};
  const game = createGame(hostile);
  assert.doesNotThrow(() => game.collect('eye', 0));
  assert.equal(game.count('eye'), 1);
  assert.doesNotThrow(() => createGame(undefined).collect('eye', 1));
});

test('Mufu’s seal comes from the morning photographs, not from lanterns', () => {
  const game = createGame(memoryStore());
  assert.equal(game.noteMufu(MUFU_PHOTOS_NEEDED - 1), false);
  assert.equal(game.stamped('mufu'), false);
  assert.equal(game.noteMufu(MUFU_PHOTOS_NEEDED), true);
  assert.equal(game.stamped('mufu'), true);
  assert.equal(game.noteMufu(MUFU_PHOTOS_NEEDED + 3), false, 'a seal is awarded once');
  assert.equal(game.mufuPhotos, MUFU_PHOTOS_NEEDED + 3);
});

test('ranks climb with seals and say how far the next one is', () => {
  assert.equal(rankFor(0).en, 'Wanderer');
  assert.equal(rankFor(0).toNext, RANKS[1].at);
  assert.equal(rankFor(7).en, 'Lamp-bearer');
  assert.equal(rankFor(STAMPS.length).en, 'Warden of Jinling');
  assert.equal(rankFor(STAMPS.length).next, null);
  assert.ok(RANKS.at(-1).at <= STAMPS.length, 'the top rank must be reachable');
});

test('lanterns hang on the road, inside the walking corridor, and are ordered along it', () => {
  const straight = Array.from({length: 80}, (_, i) => [i * 2, 5, 0]);
  const withAvenue = placeLanterns(straight, 40);
  const without = placeLanterns(straight, 0);
  for (const set of [withAvenue, without]) {
    assert.equal(set.length, 3);
    for (const [x, y, z] of set) {
      assert.ok(Math.abs(z) <= 1.3 && Math.abs(z) >= 0.9, `lantern ${z} m off the road`);
      assert.ok(y > 5.5 && y < 8, 'hangs at chest height');
      assert.ok(Math.abs(z) < 2.66, 'inside the corridor, so a walker reaches it');
      assert.ok(PICKUP_RADIUS >= Math.abs(z), 'the pickup radius reaches the lantern');
      assert.ok(x >= 0 && x <= 158);
    }
  }
  // With an avenue, two lanterns are on the approach and one on the loop.
  assert.ok(withAvenue[0][0] < 80 && withAvenue[1][0] < 80 && withAvenue[2][0] >= 80);
  assert.ok(without[0][0] < without[1][0] && without[1][0] < without[2][0]);
});

test('the ring run crosses the city in order, every ring clear of its landmark', () => {
  const ground = () => 0;
  const heights = Object.fromEntries(Object.entries(EXTENT).map(([k, v]) => [k, v.h]));
  const {rings, length} = buildCourse(places, ground, heights);
  assert.deepEqual(rings.map(r => r.id), RUN_COURSE);
  assert.ok(length > 1500 && length < 4000, `course is ${length.toFixed(0)} units`);
  for (const r of rings) {
    const top = (heights[r.id] || 30);
    assert.ok(r.position[1] > top + 15, `${r.id}: ring at ${r.position[1].toFixed(0)} is inside a ${top} m landmark`);
    assert.ok(Math.abs(Math.hypot(...r.facing) - 1) < 1e-9);
  }
  assert.ok(throughRing(rings[0].position, rings[0]));
  assert.ok(!throughRing([rings[0].position[0] + RING_RADIUS * 2, rings[0].position[1], rings[0].position[2]], rings[0]));
});

test('medals are earned by time and a personal best replaces only a worse one', () => {
  const len = 2000;
  assert.equal(medalFor(len / 50, len), 'gold');
  assert.equal(medalFor(len / 50 + 1, len), 'silver');
  assert.equal(medalFor(len / 30, len), 'bronze');
  assert.equal(medalFor(len, len), null);
  const game = createGame(memoryStore());
  assert.equal(game.recordRun(90, len).personalBest, true);
  assert.equal(game.recordRun(120, len).personalBest, false);
  assert.equal(game.run.best, 90);
  assert.equal(game.recordRun(60, len).personalBest, true);
  assert.equal(game.run.best, 60);
  assert.equal(game.run.runs, 3);
});

test('reset forgets everything', () => {
  const store = memoryStore();
  const game = createGame(store);
  game.collect('palace', 0); game.noteMufu(10); game.recordRun(50, 2000);
  game.reset();
  assert.equal(game.stampCount(), 0);
  assert.equal(game.run.best, null);
  assert.equal(createGame(store).count('palace'), 0);
});
