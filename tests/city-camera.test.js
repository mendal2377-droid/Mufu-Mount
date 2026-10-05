import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {setArrivalCamera,clearOrbitMotion} from '../src/city-camera.js';
import {centralCity} from '../tools/research/central-scope.mjs';
test('arrival discards prior orbit roll and faces the destination consistently',()=>{
 const c=new THREE.PerspectiveCamera(),spawn=[23,15,-8],look=[-40,18,21];
 c.rotation.set(2,1,1);c.zoom=1;
 setArrivalCamera(c,spawn,look);const expected=c.quaternion.clone();
 c.position.set(500,700,800);c.rotation.set(-2,4,2,'ZYX');
 setArrivalCamera(c,spawn,look);
 assert.ok(c.quaternion.angleTo(expected)<1e-7);assert.equal(c.rotation.z,0);
 assert.deepEqual(c.position.toArray(),spawn);
 assert.ok(c.getWorldDirection(new THREE.Vector3()).dot(new THREE.Vector3(...look).sub(c.position).normalize())>.999);
});
test('orbit inertia is flushed before the new arrival pose',()=>{
 let flushed=false;const o={enableDamping:true,enabled:true,update(){flushed=!this.enableDamping;}};
 clearOrbitMotion(o);assert.ok(flushed);assert.equal(o.enabled,false);assert.equal(o.enableDamping,true);
});
test('central window clips river segments that cross both edges',()=>{
 const d=centralCity({landmarks:[],lakes:[],note:'test',rivers:[{points:[[118,32],[120,32]]}]});
 assert.deepEqual(d.rivers[0].points,[[118.62,32],[119,32]]);
});
