import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { treeGeometry,treeKind,foliagePatch,fernGeometry,treeShadowGeometry } from "../src/forest-geometry.js";

test("tree crowns have depth, distinct silhouettes and bounded geometry budgets",()=>{
  for(const kind of ["broadleaf","pine"])for(const detail of [true,false]) {
    const {trunk,crown}=treeGeometry(kind,detail);
    assert.ok(crown.boundingBox.max.z-crown.boundingBox.min.z>3);
    assert.ok(crown.boundingBox.max.x-crown.boundingBox.min.x>3);
    assert.ok(crown.boundingBox.max.y>(kind==="pine"?10:8));
    assert.ok((trunk.index.count+crown.index.count)/3<(detail?2000:300));
    assert.ok(crown.attributes.position.array.every(Number.isFinite));
    assert.ok(crown.attributes.normal.array.every(Number.isFinite));
    trunk.dispose();crown.dispose();
  }
  const shadow=treeShadowGeometry();
  assert.equal(shadow.attributes.position.count/3,40);
  shadow.dispose();
});

test("curved foliage patches stay inside their own atlas cell",()=>{
  for(let tile=0;tile<4;tile++) {
    const g=foliagePatch(2,2,tile);
    assert.ok(g.boundingBox.max.z>.1);
    const uv=g.attributes.uv;
    const x0=(tile%2)*.5,y0=(1-Math.floor(tile/2))*.5;
    for(let i=0;i<uv.count;i++) {
      assert.ok(uv.getX(i)>x0&&uv.getX(i)<x0+.5);
      assert.ok(uv.getY(i)>y0&&uv.getY(i)<y0+.5);
    }
    g.dispose();
  }
  const fern=fernGeometry();fern.computeBoundingBox();
  assert.ok(fern.boundingBox.max.z-fern.boundingBox.min.z>.9);fern.dispose();
});

test("pine variation stays in wooded placements, keeping promenade broadleaf",()=>{
  assert.equal(treeKind([0,0,0,1,1,0],0),"broadleaf");
  assert.equal(treeKind([0,0,0,1,1,1],0),"pine");
  assert.equal(treeKind([0,0,0,1,1,1],1),"broadleaf");
});

test("generated runtime atlas retains PNG alpha within the asset budget",()=>{
  const b=fs.readFileSync(new URL("../public/vegetation/forest-atlas-v1.png",import.meta.url));
  assert.equal(b.subarray(1,4).toString(),"PNG");
  assert.equal(b[25],6,"atlas must retain an RGBA channel");
  assert.ok(b.readUInt32BE(16)>=1024&&b.readUInt32BE(20)>=1024);
  assert.ok(b.length<3*1024*1024);
});
