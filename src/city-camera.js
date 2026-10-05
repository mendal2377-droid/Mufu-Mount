import * as THREE from 'three';

// Build a fresh upright arrival pose; never inherit the orbit camera's Euler
// angles, roll, zoom, or a previous walking offset.
export function setArrivalCamera(camera,spawn,look){
  const dx=look[0]-spawn[0],dy=look[1]-spawn[1],dz=look[2]-spawn[2];
  camera.up.set(0,1,0);camera.position.fromArray(spawn);
  camera.rotation.set(THREE.MathUtils.clamp(Math.atan2(dy,Math.hypot(dx,dz)),-.35,.55),Math.atan2(-dx,-dz),0,'YXZ');
  camera.zoom=1;camera.near=.12;camera.far=20000;camera.fov=68;
  camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
}
export function clearOrbitMotion(orbit){
  const damping=orbit.enableDamping;orbit.enableDamping=false;
  orbit.update();orbit.enableDamping=damping;orbit.enabled=false;
}
