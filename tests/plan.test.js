import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import fs from "node:fs";
import { planPose, projectPin } from "../src/plan.js";

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

test("Markers follow world projection without screen-space clamping or relocation", () => {
  const camera = new THREE.PerspectiveCamera(40, 1.6, 2, 50000);
  const anchor=[100,30,0];
  for(const x of [-800,-100,200,600]) {
    camera.position.set(x,250,500); camera.lookAt(0,0,0); camera.updateMatrixWorld();
    const expected=new THREE.Vector3(...anchor).project(camera);
    const pin=projectPin(anchor,camera,1440,900);
    assert.equal(pin.x,(expected.x*.5+.5)*1440);
    assert.equal(pin.y,(-expected.y*.5+.5)*900);
  }
});
