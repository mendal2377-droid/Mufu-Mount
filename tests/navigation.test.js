import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nearestOnRoute,
  constrainToRoute,
  closestRoute,
} from "../src/navigation.js";
const route = {
  width: 4,
  points: [
    [0, 0, 0],
    [0, 5, 10],
    [10, 5, 10],
  ],
};
test("Walking height follows a sloping path", () => {
  const n = constrainToRoute([0, 2, 4], route);
  assert.deepEqual(n.position, [0, 3.7, 4]);
});
test("The player cannot walk through the trail edge", () => {
  const n = constrainToRoute([-20, 2, 4], route);
  assert.equal(n.position[0], -1.52);
  assert.equal(n.position[1], 3.7);
});
test("Path ends remain bounded", () => {
  const n = nearestOnRoute([18, 5, 10], route);
  assert.deepEqual(n.position, [10, 5, 10]);
});
test("Overlapping paths choose the correct elevation", () => {
  const high = {
    width: 4,
    points: [
      [0, 30, 0],
      [0, 30, 10],
    ],
  };
  assert.equal(closestRoute([0, 30, 4], [route, high]).route, 1);
});
