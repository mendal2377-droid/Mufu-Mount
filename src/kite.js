import * as THREE from "three";
import { nearestOnRoute } from "./navigation.js";

export function landingPoint(position, routes) {
  // Choose by horizontal distance: flight altitude must not select a faraway
  // high ridge instead of the path directly beneath the flyer.
  let best;
  routes.forEach((route, index) => {
    const n = nearestOnRoute(position, route);
    if (!best || n.distance < best.distance) best = { ...n, route: index };
  });
  return { route: best.route, position: [best.position[0], best.position[1] + 1.7, best.position[2]] };
}

export function flightStep(position, forward, input, dt, bounds, floor = 0) {
  const d = new THREE.Vector3(...forward).normalize();
  const right = new THREE.Vector3().crossVectors(d, new THREE.Vector3(0, 1, 0)).normalize();
  const move = d.multiplyScalar(input.forward).addScaledVector(right, input.side);
  if (move.lengthSq() > 1) move.normalize();
  const p = new THREE.Vector3(...position).addScaledVector(move, (input.fast ? 95 : 34) * dt);
  p.y += input.up * 26 * dt;
  p.x = THREE.MathUtils.clamp(p.x, bounds.min.x, bounds.max.x);
  p.z = THREE.MathUtils.clamp(p.z, bounds.min.z, bounds.max.z);
  p.y = THREE.MathUtils.clamp(p.y, Math.min(980, floor + 18), 1000);
  return p.toArray();
}

// A bounded downward ray against terrain only, not foliage or photo frames.
// Bounding boxes avoid testing every triangle of the entire exported mountain.
export function createGroundSampler(scene) {
  const ground = scene.children.filter(m => m.isMesh && !m.isInstancedMesh &&
    /Mufu limestone|Woodland floor|Grass \| summer|promenade|asphalt|Hike \| earth/i.test(m.name));
  const records = ground.map(mesh => {
    mesh.geometry.computeBoundingBox();
    mesh.updateMatrixWorld();
    return {mesh, box: mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)};
  });
  const ray = new THREE.Raycaster();
  ray.ray.direction.set(0, -1, 0);
  return (x, z) => {
    ray.ray.origin.set(x, 1200, z);
    const candidates = records.filter(r => x >= r.box.min.x && x <= r.box.max.x && z >= r.box.min.z && z <= r.box.max.z);
    return ray.intersectObjects(candidates.map(r => r.mesh), false)[0]?.point.y ?? 0;
  };
}

export function createBirdKite(camera, scene, shared, routes, groundHeight) {
  const bounds = new THREE.Box3().setFromPoints(routes.flatMap(r => r.points.map(p => new THREE.Vector3(...p))));
  bounds.expandByScalar(1800);
  const bird = new THREE.Group();
  bird.name = "Swallow kite — painted silk, bamboo ribs and trailing ribbons";
  const silk = new THREE.MeshStandardMaterial({color: 0x233f50, roughness: .66, side: THREE.DoubleSide});
  const gold = new THREE.MeshStandardMaterial({color: 0xe1be75, roughness: .65, side: THREE.DoubleSide});
  function wing(sign) {
    const g = new THREE.BufferGeometry();
    const vertices = [0,0,-.5, sign*1.6,.5,-.8, sign*4,.8,1.2, 0,0,-.5, sign*4,.8,1.2, sign*1.7,.1,.6];
    g.setAttribute("position", new THREE.Float32BufferAttribute(vertices,3));
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, silk); bird.add(mesh);
    for(let i=0;i<6;i++) {
      const end = new THREE.Vector3(sign*(1.4+i*.43), .5+i*.045, -.55+i*.32);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.025,-.45),end]), new THREE.LineBasicMaterial({color:0xd0b07a}));
      bird.add(line);
    }
    const edge = new THREE.Mesh(new THREE.ConeGeometry(.16,1.6,3),gold);
    edge.rotation.z = sign*Math.PI/2; edge.position.set(sign*2.1,.52,.12); bird.add(edge);
  }
  wing(-1); wing(1);
  const body = new THREE.Mesh(new THREE.SphereGeometry(.32,12,8),gold);
  body.scale.set(.7,.5,2.7); body.position.z = -.25; bird.add(body);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(.11,.45,6),gold);
  beak.rotation.x = -Math.PI/2; beak.position.z=-1.2; bird.add(beak);
  const tails=[];
  for(const side of [-1,1]) {
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(.17,3.4,1,16),gold);
    tail.rotation.x = -Math.PI/2; tail.rotation.z = side*.14;
    tail.position.set(side*.25,0,2.1); bird.add(tail); tails.push(tail);
  }
  bird.position.set(0,-1.05,-7); bird.scale.setScalar(.62);
  bird.visible=false;
  camera.add(bird); scene.add(camera);
  let floor=0, sampleAt=-Infinity;
  const direction = new THREE.Vector3();
  return {
    bird, bounds,
    launch() { floor=groundHeight(camera.position.x,camera.position.z); camera.position.y=Math.max(camera.position.y+25,floor+25); camera.rotation.z=0; sampleAt=-Infinity; bird.scale.setScalar(.62*Math.min(1,camera.aspect)); bird.visible=true; },
    stop() { bird.visible=false; },
    update(dt,time,keys) {
      const f=Number(keys.has("KeyW")||keys.has("ArrowUp"))-Number(keys.has("KeyS")||keys.has("ArrowDown"));
      const side=Number(keys.has("KeyD")||keys.has("ArrowRight"))-Number(keys.has("KeyA")||keys.has("ArrowLeft"));
      const up=Number(keys.has("Space")||keys.has("KeyE"))-Number(keys.has("ControlLeft")||keys.has("ControlRight")||keys.has("KeyQ"));
      camera.getWorldDirection(direction);
      const input={forward:f, side, up, fast:keys.has("ShiftLeft")||keys.has("ShiftRight")};
      const next=flightStep(camera.position.toArray(),direction.toArray(),input,dt,bounds,0);
      // Check the intended destination before applying movement, including
      // steep cliff edges. Smooth upward clearance; descent stays user-driven.
      if(time-sampleAt>.12) { floor=groundHeight(next[0],next[2]); sampleAt=time; }
      next[1]=Math.max(next[1],floor+18);
      camera.position.fromArray(next);
      bird.scale.setScalar(.62*Math.min(1,camera.aspect));
      bird.rotation.set(Math.sin(time*1.7)*.025,Math.sin(time*.9)*.025, -side*.14+Math.sin(time*1.3)*.04);
      tails.forEach((tail,i)=>{tail.rotation.y=Math.sin(time*3+i)*.12*(1+shared.storm.value);});
      return f!==0||side!==0||up!==0;
    },
    land() { const landing=landingPoint(camera.position.toArray(),routes); camera.position.fromArray(landing.position); bird.visible=false; return landing; },
  };
}
