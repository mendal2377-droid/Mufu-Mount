import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeRiverRoute } from "../src/river-life.js";
const points = JSON.parse(
  fs.readFileSync(new URL("../public/world/routes.json", import.meta.url)),
)[3].points;
const route = makeRiverRoute(points);
test("Shipping lanes stay on the river side and preserve the requested bank offset", () => {
  for (let s = 50; s < route.length - 50; s += 83) {
    const bank = route.sample(s),
      ship = route.sample(s, 180);
    const dx = ship.x - bank.x,
      dz = ship.z - bank.z;
    assert.ok(Math.abs(Math.hypot(dx, dz) - 180) < 1e-6);
    assert.ok(dx * bank.dz - dz * bank.dx > 179.99);
    assert.ok(Math.abs(dx * bank.dx + dz * bank.dz) < 1e-6);
  }
});
test("Vessels move continuously around route bends", () => {
  for (let s = 50; s < route.length - 50; s += 83) {
    const a = route.sample(s, 370),
      b = route.sample(s + 0.1, 370);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 8);
  }
});
test("Beacon and river viewpoint are beside the intended promenade stretch", () => {
  const b = route.sample(2440, 27),
    v = route.sample(2355);
  assert.ok(Math.hypot(b.x - v.x, b.z - v.z) < 120);
  assert.ok(v.y > 7 && v.y < 9);
});
