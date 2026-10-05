import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cityPoint,inRing,ribbon,distanceToLine,cityHills,cityHeight} from '../src/city-geography.js';
const data=JSON.parse(fs.readFileSync(new URL('../public/city/nanjing.json',import.meta.url)));
test('Nanjing atlas keeps source provenance and separates artistic additions',()=>{
  assert.equal(data.landmarks.length,20);assert.equal(data.license,'ODbL-1.0');
  assert.equal(new Set(data.landmarks.map(p=>p.id)).size,20);
  for(const p of data.landmarks){assert.ok(/^https:\/\//.test(p.source));assert.ok(p.coord.every(Number.isFinite));
    assert.ok(p.coord[0]>118.3&&p.coord[0]<119.3&&p.coord[1]>31.2&&p.coord[1]<32.7);}
  assert.match(data.landmarks.find(p=>p.id==='gaochun').placement,/transit stop/);
  assert.equal(data.lakes.find(p=>p.id==='xuanwu').inferred,true);
  assert.match(data.note,/artistic approximations/);
});
test('Atlas projection preserves east/north orientation and landmark geography',()=>{
  assert.deepEqual(cityPoint(data.origin,data),[0,0,-0]);
  assert.ok(cityPoint([118.9,32.04],data)[0]>0);assert.ok(cityPoint([118.78,32.2],data)[2]<0);
  const get=id=>cityPoint(data.landmarks.find(p=>p.id===id).coord,data);
  assert.ok(get('mufu')[2]<get('qinhuai')[2]);assert.ok(get('gaochun')[2]>get('niushou')[2]);
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
