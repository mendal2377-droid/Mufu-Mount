import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {scatterMeadow,pathMask,meadowGeometry,plantableSurface} from "../src/meadow.js";

const routes=JSON.parse(fs.readFileSync(new URL("../public/world/routes.json",import.meta.url)));

test("meadow patches are reproducible, mixed and clear of every walking corridor",()=>{
  const a=scatterMeadow(routes),b=scatterMeadow(routes),paved=pathMask(routes);
  assert.deepEqual(a,b);
  assert.ok(a.length>10000&&a.length<160000);
  assert.ok(a.some(s=>s.flower&&s.bank));assert.ok(a.some(s=>s.flower&&!s.bank));
  assert.ok(a.every(s=>!paved(s.x,s.z)));
  assert.ok(a.some(s=>s.tile===0)&&a.some(s=>s.tile===1));
});

test("plants require living lower ground and reject water, paving and steep faces",()=>{
  const hit={name:"Grass | summer olive",height:8,normalY:1};
  assert.equal(plantableSurface(hit),true);
  for(const h of [null,{...hit,name:"Light granite promenade"},{...hit,name:"Mufu limestone"},
    {...hit,height:0},{...hit,height:170},{...hit,normalY:.3}])assert.equal(plantableSurface(h),false);
});

test("meadow clumps retain depth, atlas gutters and modest triangle budgets",()=>{
  for(let tile=0;tile<4;tile++){
    const g=meadowGeometry(tile),uv=g.attributes.uv;
    assert.ok(g.boundingBox.max.z-g.boundingBox.min.z>.5);
    assert.ok(g.index.count/3<=30);
    for(let i=0;i<uv.count;i++){
      assert.ok(uv.getX(i)>(tile%2)*.5&&uv.getX(i)<(tile%2+1)*.5);
      assert.ok(uv.getY(i)>(1-Math.floor(tile/2))*.5&&uv.getY(i)<(2-Math.floor(tile/2))*.5);
    }
    g.dispose();
  }
});

test("meadow atlas keeps transparent PNG alpha within its asset budget",()=>{
  const b=fs.readFileSync(new URL("../public/vegetation/meadow-atlas-v1.png",import.meta.url));
  assert.equal(b.subarray(1,4).toString(),"PNG");assert.equal(b[25],6);
  assert.ok(b.readUInt32BE(16)>=1024&&b.readUInt32BE(20)>=1024);
  assert.ok(b.length<4*1024*1024);
});
