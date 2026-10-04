import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import fs from "node:fs";
import { flightStep, landingPoint, createGroundSampler } from "../src/kite.js";
import { nearestOnRoute } from "../src/navigation.js";
import { scatterAlongRoutes } from "../src/life.js";
const bounds=new THREE.Box3(new THREE.Vector3(-100,0,-100),new THREE.Vector3(100,1000,100));
test("Kite moves forward, sideways and vertically, including faster travel",()=>{
  const input={forward:1,side:0,up:0,fast:false};
  assert.deepEqual(flightStep([0,50,0],[0,0,-1],input,1,bounds),[0,50,-34]);
  assert.equal(flightStep([0,50,0],[0,0,-1],{...input,fast:true},1,bounds)[2],-95);
  assert.deepEqual(flightStep([0,50,0],[0,0,-1],{...input,forward:0,side:1,up:1},1,bounds),[34,76,0]);
});
test("Kite stays inside flight boundaries, above ground and below altitude ceiling",()=>{
  const p=flightStep([99,990,-99],[1,0,-1],{forward:1,side:0,up:1,fast:true},1,bounds,180);
  assert.deepEqual(p,[100,1000,-100]);
  assert.equal(flightStep([0,12,0],[0,0,-1],{forward:0,side:0,up:-1,fast:false},1,bounds,180)[1],198);
});
test("Flight clearance samples terrain height while ignoring tree canopies",()=>{
  const scene=new THREE.Scene();
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));
  ground.rotation.x=-Math.PI/2; ground.position.y=180; ground.name="Mufu limestone"; scene.add(ground);
  const tree=new THREE.Mesh(new THREE.BoxGeometry(10,10,10),new THREE.MeshBasicMaterial());
  tree.position.y=200; tree.name="Leaf green 0"; scene.add(tree);
  const sample=createGroundSampler(scene);
  assert.ok(Math.abs(sample(0,0)-180)<1e-6);
  assert.equal(sample(500,500),0);
});
test("Landing chooses the path beneath the flyer, independent of high ridge altitude",()=>{
  const routes=[{width:2,points:[[0,0,0],[100,0,0]]},{width:2,points:[[0,180,40],[100,180,40]]}];
  assert.deepEqual(landingPoint([50,500,2],routes),{route:0,position:[50,1.7,0]});
});
test("Every model landing is a valid route-centre walking spawn",()=>{
  const routes=JSON.parse(fs.readFileSync(new URL("../public/world/routes.json",import.meta.url)));
  for(const r of routes) for(const point of r.points.filter((_,i)=>i%80===0)) {
    const land=landingPoint([point[0]+40,800,point[2]-35],routes);
    const n=nearestOnRoute(land.position,routes[land.route]);
    assert.ok(n.distance<1e-6);
    assert.ok(Math.abs(land.position[1]-n.position[1]-1.7)<1e-6);
  }
});
test("Promenade planting is inland beyond the paving; the terrace has no tufts",()=>{
  const promenade={width:5.5,points:[[0,8,0],[100,8,0]]};
  const spots=scatterAlongRoutes([promenade,promenade,promenade,promenade,{width:2.4,points:[[0,8,80],[50,8,80]]}]);
  const riverside=scatterAlongRoutes([{width:1,points:[]},{width:1,points:[]},{width:1,points:[]},promenade]);
  assert.ok(riverside.length>0);
  riverside.forEach(s=>assert.ok(s[2]>=14 && s[2]<=23));
  assert.ok(spots.every(s=>s[2]<24));
});
