import * as THREE from "three";

// A compressed geographic atlas has its own coordinate system. It does not
// silently georeference the older, photo-informed Blender reconstruction.
export function cityPoint(coord, data) {
  const north=(coord[1]-data.origin[1])*111320*data.scale;
  const east=(coord[0]-data.origin[0])*111320*Math.cos(data.origin[1]*Math.PI/180)*data.scale;
  return [east,0,-north];
}
export function inRing(x,z,ring) {
  let inside=false;
  for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[i],b=ring[j];
    if((a[2]>z)!==(b[2]>z)&&x<(b[0]-a[0])*(z-a[2])/(b[2]-a[2])+a[0])inside=!inside;
  }return inside;
}
export function ribbon(points,width,height=.15) {
  const positions=[],indices=[];
  points.forEach((p,i)=>{
    const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];
    const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz)||1;
    const nx=-dz/length*width*.5,nz=dx/length*width*.5;
    positions.push(p[0]+nx,p[1]+height,p[2]+nz,p[0]-nx,p[1]+height,p[2]-nz);
    if(i)indices.push((i-1)*2,(i-1)*2+1,i*2,i*2,(i-1)*2+1,i*2+1);
  });
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setIndex(indices);g.computeVertexNormals();return g;
}
export function distanceToLine(x,z,points) {
  let best=Infinity;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[2]-a[2],d=dx*dx+dz*dz;
    const f=d?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/d)):0;
    best=Math.min(best,Math.hypot(x-a[0]-f*dx,z-a[2]-f*dz));
  }return best;
}

export function cityHills(places) {
  const heights={mufu:36,zijin:62,niushou:42,qixia:40,tangshan:30,yuejiang:15};
  return places.filter(p=>heights[p.id]).map(p=>({x:p.position[0],z:p.position[2],
    height:heights[p.id],radius:p.id==='zijin'?170:p.id==='mufu'?130:105}));
}
export function cityHeight(x,z,hills) {
  return 1.2+hills.reduce((h,p)=>h+p.height*Math.exp(-((x-p.x)**2+(z-p.z)**2)/(p.radius*p.radius*.42)),0);
}
