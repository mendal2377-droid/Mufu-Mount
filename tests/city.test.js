import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cityPoint,inRing,ribbon,distanceToLine,cityHills,cityHeight} from '../src/city-geography.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/city/nanjing.json',import.meta.url)));
test('Nanjing atlas keeps source provenance and separates artistic additions',()=>{
  assert.equal(data.landmarks.length,18);assert.equal(data.license,'ODbL-1.0');
  assert.equal(new Set(data.landmarks.map(p=>p.id)).size,18);
  for(const p of data.landmarks){assert.ok(/^https:\/\//.test(p.source));assert.ok(p.coord.every(Number.isFinite));
    assert.ok(p.coord[0]>118.3&&p.coord[0]<119.3&&p.coord[1]>31.2&&p.coord[1]<32.7);}
  assert.ok(!data.landmarks.some(p=>['gaochun','tangshan'].includes(p.id)));
  assert.match(data.extent.kind,/viewing window/);
  assert.equal(data.lakes.find(p=>p.id==='xuanwu').inferred,false);
  assert.match(data.note,/artistic approximations/);
});
test('Atlas projection preserves east/north orientation and landmark geography',()=>{
  assert.deepEqual(cityPoint(data.origin,data),[0,0,-0]);
  assert.ok(cityPoint([118.9,32.04],data)[0]>0);assert.ok(cityPoint([118.78,32.2],data)[2]<0);
  const get=id=>cityPoint(data.landmarks.find(p=>p.id===id).coord,data);
  assert.ok(get('mufu')[2]<get('qinhuai')[2]);assert.ok(get('niushou')[2]>get('qinhuai')[2]);
  assert.ok(get('zijin')[0]>get('zifeng')[0]);
  assert.ok(data.boundary.some(r=>inRing(0,0,r.map(p=>cityPoint(p,data)))));
});
test('River and path ribbons remain finite through duplicate samples and bends',()=>{
  const points=[[0,0,0],[0,0,0],[8,3,2],[12,4,10]],g=ribbon(points,5,.1);
  assert.ok(Array.from(g.attributes.position.array).every(Number.isFinite));
  assert.equal(g.index.count,18);assert.ok(distanceToLine(6,2,points)<1);g.dispose();
  const places=data.landmarks.map(p=>({...p,position:cityPoint(p.coord,data)})),hills=cityHills(places);
  assert.ok(cityHeight(...[places[0].position[0],places[0].position[2]],hills)>30);
});

test('verified shorelines and bridge alignment replace the inferred geometry',()=>{
 const lake=data.lakes.find(l=>l.id==='xuanwu'),eye=data.landmarks.find(p=>p.id==='eye');
 assert.match(lake.source,/2138994/);assert.ok(lake.outer[0].length>50);assert.ok(lake.inner.length>=5);
 assert.equal(eye.bridgePath.length,18);assert.match(eye.alignmentSource,/321392362/);
 const water=data.lakes.find(l=>l.id==='jiajiang-water'),point=cityPoint(eye.coord,data);
 assert.ok(water.outer.some(r=>inRing(point[0],point[2],r.map(c=>cityPoint(c,data)))));
 assert.ok(!water.inner.some(r=>inRing(point[0],point[2],r.map(c=>cityPoint(c,data)))));
});
