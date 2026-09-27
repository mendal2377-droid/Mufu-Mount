import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { titleLoop, wholeCircuit } from "../src/tour.js";

const routes = JSON.parse(
  fs.readFileSync(new URL("../public/world/routes.json", import.meta.url)),
);

function length(route) {
  let total = 0;
  const p = route.points;
  for (let i = 1; i < p.length; i++) {
    total += Math.hypot(p[i][0] - p[i - 1][0], p[i][2] - p[i - 1][2]);
  }
  return total;
}

function bounds() {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const route of routes) {
    for (const [x, , z] of route.points) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
  }
  return { minX, maxX, minZ, maxZ };
}

const box = bounds();
const inWorld = ([x, y, z]) =>
  x > box.minX - 1200 &&
  x < box.maxX + 1200 &&
  z > box.minZ - 1200 &&
  z < box.maxZ + 1200 &&
  y > -10 &&
  y < 1200;

for (const [name, legs] of [
  ["title loop", titleLoop()],
  ["whole circuit", wholeCircuit()],
]) {
  test(`${name}: every leg names a route that exists`, () => {
    for (const leg of legs) {
      assert.ok(leg.seconds > 0, `${leg.label}: no duration`);
      assert.ok(leg.label, "a leg with no label");
      if (leg.kind === "air") continue;
      assert.ok(routes[leg.route], `${leg.label}: route ${leg.route} missing`);
      if (leg.lookAt) {
        assert.ok(inWorld(leg.lookAt), `${leg.label}: lookAt is off the map`);
      }
      for (const key of ["from", "to"]) {
        assert.ok(
          leg[key] >= 0 && leg[key] <= 1,
          `${leg.label}: ${key} is outside 0..1`,
        );
      }
    }
  });

  test(`${name}: ground legs move at a believable pace`, () => {
    for (const leg of legs) {
      if (leg.kind === "air") continue;
      const metres = Math.abs(leg.to - leg.from) * length(routes[leg.route]);
      const speed = metres / leg.seconds;
      assert.ok(
        speed < 9,
        `${leg.label}: ${speed.toFixed(1)} m/s is a sprint, not a walk`,
      );
    }
  });

  test(`${name}: aerial legs stay over the modelled world`, () => {
    for (const leg of legs) {
      if (leg.kind !== "air") continue;
      for (const key of ["from", "to", "look", "lookTo"]) {
        if (!leg[key]) continue;
        assert.ok(inWorld(leg[key]), `${leg.label}: ${key} is off the map`);
      }
      const drop = leg.from[1] - leg.look[1];
      assert.ok(drop > 0, `${leg.label}: the camera is below what it looks at`);
    }
  });
}

test("The circuit covers the mountain and the river, and runs a few minutes", () => {
  const legs = wholeCircuit();
  const used = new Set(legs.filter((l) => l.route !== undefined).map((l) => l.route));
  for (const route of [1, 0, 4, 2, 3]) {
    assert.ok(used.has(route), `the circuit never walks route ${route}`);
  }
  const seconds = legs.reduce((sum, l) => sum + l.seconds, 0);
  assert.ok(seconds > 180 && seconds < 600, `circuit runs ${seconds}s`);
  assert.equal(legs[0].mood, "dawn");
  assert.equal(legs.at(-1).mood, "sunset");
});

test("The title loop visits the riverside", () => {
  const legs = titleLoop();
  assert.ok(
    legs.some((l) => l.route === 3),
    "nothing behind the title goes to the river",
  );
});
