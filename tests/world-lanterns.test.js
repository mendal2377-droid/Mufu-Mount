import test from 'node:test';
import assert from 'node:assert/strict';
import {WORLD_LANTERNS, snapToGround, SNAP} from '../src/world-lanterns.js';
import {FACTS, STAMPS} from '../src/city-game.js';

test('Every landmark with lanterns in a world is in the game, with one spot per fact', () => {
  for (const [world, spots] of Object.entries(WORLD_LANTERNS)) {
    for (const [id, list] of Object.entries(spots)) {
      assert.ok(STAMPS.includes(id), `${world}: ${id} has no seal`);
      assert.equal(list.length, FACTS[id].length, `${world}: ${id}`);
      for (const p of list) assert.ok(p.length === 2 && p.every(Number.isFinite), `${world}: ${id}`);
    }
  }
});

test('A lantern off the walk grid moves to the nearest walkable ground, or is left out', () => {
  const island = (x, z) => (Math.hypot(x - 100, z) < 10 ? 5 : null);
  assert.deepEqual(snapToGround(island, 100, 0), [100, 0]);
  const near = snapToGround(island, 60, 0);
  assert.ok(near && Math.hypot(near[0] - 100, near[1]) < 10);
  assert.ok(Math.hypot(near[0] - 60, near[1]) <= 40, 'the first ring that touches ground, not a farther one');
  assert.equal(snapToGround(island, 100 + SNAP + 50, 0), null);
});
