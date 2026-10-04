import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import fs from "node:fs";
import { planPose, layoutPins } from "../src/plan.js";

const routes = JSON.parse(fs.readFileSync(new URL("../public/world/routes.json", import.meta.url)));
test("The aerial camera fits the walking landscape on desktop and portrait screens", () => {
  const points = routes.flatMap(r => r.points);
  for (const aspect of [1440 / 900, 390 / 844]) {
    const pose = planPose(points, aspect);
    const camera = new THREE.PerspectiveCamera(pose.fov, aspect, 2, 50000);
    camera.position.copy(pose.position);
    camera.lookAt(pose.target);
    camera.updateMatrixWorld();
    for (const point of points) {
      const p = new THREE.Vector3(...point).project(camera);
      assert.ok(Math.abs(p.x) < .9 && Math.abs(p.y) < .9 && p.z < 1,
        `Route point outside aerial view: ${p.toArray()}`);
    }
  }
});

test("Nearby entrance labels have separate touch targets within the screen", () => {
  for (const [width, height] of [[1440, 900], [390, 844]]) {
    const labels = layoutPins(Array.from({ length: 6 }, (_, index) => ({ index, x: width / 2, y: height / 2 })), width, height);
    for (let i = 0; i < labels.length; i++) {
      const a = labels[i];
      assert.ok(a.x - a.width / 2 >= 0 && a.x + a.width / 2 <= width);
      assert.ok(a.y - a.height / 2 >= 0 && a.y + a.height / 2 <= height);
      for (const b of labels.slice(i + 1)) {
        assert.ok(Math.abs(a.x - b.x) >= a.width || Math.abs(a.y - b.y) >= a.height,
          `Overlapping entrance targets ${a.index}, ${b.index}`);
      }
    }
  }
});
