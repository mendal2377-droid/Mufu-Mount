import test from 'node:test';
import assert from 'node:assert/strict';
import {Lane, IDM, idm, green, CYCLE, GREEN} from '../src/traffic-sim.js';

let n = 0;
const id = () => ++n;

test('IDM: a free road speeds up towards the desired speed; a close leader brakes it', () => {
  assert.ok(idm(5, 12, Infinity, 0, IDM.car) > 1);
  assert.ok(Math.abs(idm(12, 12, Infinity, 0, IDM.car)) < 1e-9);
  assert.ok(idm(10, 12, 5, 10, IDM.car) < -2, 'brakes hard for a stopped car 5 m ahead');
});

test('Signals: each direction of a crossing gets its own green, never both at once', () => {
  for (let t = 0; t < CYCLE; t += 1) assert.ok(!(green(t, 0, 0) && green(t, 0, 1)), `both green at ${t}`);
  const share = Array.from({length: CYCLE}, (_, t) => green(t, 0, 0)).filter(Boolean).length / CYCLE;
  assert.ok(Math.abs(share - GREEN) < .02);
});

test('A red light stops the lane behind its stop line, and green lets the queue go', () => {
  const lane = new Lane({length: 400, v0: 12, stops: [{at: 200, offset: CYCLE * .45, group: 0}]});   // red from t = 0
  lane.fill(0, 180, 25, 10, id);
  const gone = [];
  for (let t = 0; t < 40; t += .1) lane.step(t, .1, q => { gone.push(q); return true; });
  const heads = lane.vehicles.filter(q => q.s < 200);
  assert.ok(heads.length >= 4, 'a queue formed');
  assert.ok(heads[0].s <= 200 && heads[0].s > 190 && heads[0].v < .3, `first car stopped at the line: ${heads[0].s.toFixed(1)} m, ${heads[0].v.toFixed(2)} m/s`);
  for (let i = 1; i < lane.vehicles.length; i++) assert.ok(lane.vehicles[i - 1].s - lane.vehicles[i].s >= IDM.car.len, 'no overlap');
  // Turn green: wait out the rest of the red.
  let t = 40;
  for (; t < 120; t += .1) lane.step(t, .1, q => { gone.push(q); return true; });
  assert.ok(lane.vehicles.every(q => q.s > 200 || q.v > 1) || gone.length > 0, 'the queue moved off');
});

test('At the end of the lane a vehicle that cannot go on waits there; one that can, leaves', () => {
  const lane = new Lane({length: 100, v0: 12});
  lane.fill(0, 100, 30, 10, id);
  let left = 0;
  for (let t = 0; t < 30; t += .1) lane.step(t, .1, () => false);
  assert.ok(lane.vehicles[0].s < 100 && lane.vehicles[0].v === 0 && lane.vehicles[0].wait);
  for (let t = 30; t < 60; t += .1) lane.step(t, .1, () => { left++; return true; });
  assert.ok(left > 0);
});
