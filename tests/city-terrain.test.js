import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cityPoint} from '../src/city-geography.js';
import {createCityTerrain} from '../src/city-terrain.js';

const data=JSON.parse(fs.readFileSync(new URL('../public/city/nanjing.json',import.meta.url)));
const places=data.landmarks.map(p=>({...p,position:cityPoint(p.coord,data)}));
const rivers=data.rivers.map(r=>({...r,points:r.points.map(p=>cityPoint(p,data)),width:r.name==='长江'?110:5}));
const lakes=data.lakes.map(l=>({...l,outer:l.outer.map(r=>r.map(p=>cityPoint(p,data))),inner:l.inner.map(r=>r.map(p=>cityPoint(p,data)))}));
const terrain=createCityTerrain(places,rivers,lakes,data.boundary.map(r=>r.map(p=>cityPoint(p,data))));

test('Atlas relief gives mountain walks substantial elevation without changing geographic anchors',()=>{
  for(const id of ['zijin','niushou','qixia','tangshan']){
    const p=places.find(p=>p.id===id),[x,,z]=p.position;
    assert.ok(terrain.ground(x,z)>90,id);
    assert.deepEqual(p.position,cityPoint(p.coord,data));
  }
  const mufu=terrain.hills.find(h=>h.height===138);
  assert.ok(terrain.ground(mufu.x,mufu.z)>60);
  assert.ok(terrain.ridges.length>terrain.hills.length);
});

test('A single finite terrain mesh stays bounded and walking samples match rendered triangles',()=>{
  const g=terrain.geometry,p=g.attributes.position,ids=g.index.array;
  assert.equal(terrain.stats.singleSurface,true);
  assert.ok(terrain.stats.terrainTriangles>100000&&terrain.stats.terrainTriangles<400000);
  assert.ok(Array.from(p.array).every(Number.isFinite));
  assert.ok(Array.from(g.attributes.normal.array).every(Number.isFinite));
  for(let i=0;i<ids.length;i+=Math.ceil(ids.length/900/3)*3){
    const a=ids[i],b=ids[i+1],c=ids[i+2];
    const x=(p.getX(a)+p.getX(b)+p.getX(c))/3,z=(p.getZ(a)+p.getZ(b)+p.getZ(c))/3;
    const y=(p.getY(a)+p.getY(b)+p.getY(c))/3;
    assert.ok(Math.abs(terrain.ground(x,z)-y)<.001,`surface at ${x},${z}`);
  }
});

test('Mapped river beds lie below water instead of overlapping a flat lawn',()=>{
  for(const r of rivers.filter(r=>r.width===110))for(const p of r.points.slice(1,-1)){
    assert.ok(terrain.analytic(p[0],p[2])<1.31);
    assert.equal(terrain.wet(p[0],p[2]),true);
  }
});

test('Lake islands remain dry while the surrounding basin is carved below water',()=>{
  const square=r=>[[-r,0,-r],[r,0,-r],[r,0,r],[-r,0,r],[-r,0,-r]];
  const t=createCityTerrain([],[],[{outer:[square(60)],inner:[square(20)]}],[square(128)]);
  assert.equal(t.wet(0,0),false);
  assert.equal(t.wet(40,0),true);
  assert.ok(t.analytic(40,0)<0);
  assert.ok(t.ground(0,0)>t.ground(40,0));t.geometry.dispose();
});
