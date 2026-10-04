import test from "node:test";
import assert from "node:assert/strict";
import { RIVER_WAVES, sampleRiverSurface, riverSurfaceUniforms } from "../src/river-surface.js";

test("wave normals agree with the displaced surface gradient", () => {
  const eps=.0001;
  for(const [x,z,t] of [[10,32,0],[1731,-2589,14.3],[-38,102,93]]) {
    const v=sampleRiverSurface(x,z,t,.8);
    const dx=(sampleRiverSurface(x+eps,z,t,.8).height-sampleRiverSurface(x-eps,z,t,.8).height)/(2*eps);
    const dz=(sampleRiverSurface(x,z+eps,t,.8).height-sampleRiverSurface(x,z-eps,t,.8).height)/(2*eps);
    assert.ok(Math.abs(v.dx-dx)<1e-5);
    assert.ok(Math.abs(v.dz-dz)<1e-5);
  }
});

test("unresolved wave bands fade instead of aliasing in the mesh or horizon", () => {
  assert.deepEqual(sampleRiverSurface(32,87,5,1,1000),{height:0,dx:0,dz:0,compression:0});
  const fine=sampleRiverSurface(32,87,5,0,0);
  const mesh=sampleRiverSurface(32,87,5,0,6.25);
  assert.notDeepEqual(fine,mesh);
  const uniforms=riverSurfaceUniforms();
  assert.equal(uniforms.waveTrain.value.length,12);
  assert.equal(uniforms.wavePhase.value.length,12);
  // At a grazing viewing angle one screen axis covers much more water than
  // the other. Filtering must keep waves resolved along the narrow axis.
  const grazing=sampleRiverSurface(32,87,5,0,[[.01,0],[0,3]]);
  assert.notDeepEqual(grazing,sampleRiverSurface(32,87,5,0,3));
});

test("storm waves stay below the elevated promenade and have finite slopes", () => {
  const bound=RIVER_WAVES.reduce((s,w)=>s+w.amplitude,0)*2.8;
  assert.ok(bound<3, "conservative maximum wave height must stay below the 8 m path");
  for(let i=0;i<100;i++) {
    const v=sampleRiverSurface(i*17.3,i*-11.9,i*.37,1);
    assert.ok(Math.abs(v.height)<=bound);
    assert.ok(Object.values(v).every(Number.isFinite));
  }
});

test("wave field evolves continuously and stronger wind increases energy", () => {
  const still=sampleRiverSurface(328,-214,8);
  const next=sampleRiverSurface(328,-214,8.01);
  const storm=sampleRiverSurface(328,-214,8,1);
  assert.notDeepEqual(still,next);
  assert.ok(Math.abs(still.height-next.height)<.04);
  assert.ok(Math.abs(storm.height-still.height*2.8)<1e-10);
});
