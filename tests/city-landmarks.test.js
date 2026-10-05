import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {archWall,octagonalEave,bridgeRing} from '../src/city-landmarks.js';

test('arched gate openings remain open through the full wall depth',()=>{
  const g=archWall(36,12,7,[-10,0,10].map(x=>({x,r:2.6,spring:4.5})));
  const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));mesh.updateMatrixWorld();
  const cast=(x,y)=>new THREE.Raycaster(new THREE.Vector3(x,y,10),new THREE.Vector3(0,0,-1)).intersectObject(mesh);
  for(const x of [-10,0,10]){assert.equal(cast(x,3).length,0);assert.equal(cast(x,6).length,0);}
  assert.ok(cast(5,3).length>0);assert.ok(cast(0,10).length>0);
  assert.ok(Array.from(g.attributes.position.array).every(Number.isFinite));g.dispose();mesh.material.dispose();
});
test('pagoda eaves have octagonal volume and bridge pylons are closed tilted rings',()=>{
  const g=octagonalEave(6);g.computeBoundingBox();
  assert.ok(g.boundingBox.max.y-g.boundingBox.min.y>1.5);
  assert.ok(g.boundingBox.max.x-g.boundingBox.min.x>10);
  assert.ok(g.attributes.position.count/3<100);g.dispose();
  const ring=bridgeRing((t,s,h)=>[t*140,h,s],.32);
  assert.ok(new THREE.Vector3(...ring[0]).distanceTo(new THREE.Vector3(...ring.at(-1)))<1e-8);
  assert.ok(Math.max(...ring.map(p=>p[2]))-Math.min(...ring.map(p=>p[2]))>25);
  assert.ok(Math.max(...ring.map(p=>p[0]))-Math.min(...ring.map(p=>p[0]))>15);
  assert.ok(Math.max(...ring.map(p=>p[1]))-Math.min(...ring.map(p=>p[1]))>35);
});
