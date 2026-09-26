export function nearestOnRoute(point,route){
  let best={distance:Infinity};const p=route.points;
  for(let i=0;i<p.length-1;i++){
    const a=p[i],b=p[i+1],dx=b[0]-a[0],dz=b[2]-a[2],den=dx*dx+dz*dz;
    const t=den?Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[2]-a[2])*dz)/den)):0;
    const pos=[a[0]+dx*t,a[1]+(b[1]-a[1])*t,a[2]+dz*t];
    const distance=Math.hypot(point[0]-pos[0],point[2]-pos[2]);
    const score=distance+Math.abs(point[1]-pos[1])*.3;
    if(score<(best.score??Infinity))best={position:pos,distance,score,index:i,t,direction:[dx,0,dz]};
  }return best;
}
export function constrainToRoute(point,route){
  const near=nearestOnRoute(point,route);const max=route.width*.38;
  const ratio=near.distance>max?max/near.distance:1;
  return {position:[near.position[0]+(point[0]-near.position[0])*ratio,near.position[1]+1.7,near.position[2]+(point[2]-near.position[2])*ratio],near};
}
export function closestRoute(point,routes){let best;routes.forEach((route,i)=>{const n=nearestOnRoute(point,route);if(!best||n.score<best.score)best={...n,route:i};});return best;}
