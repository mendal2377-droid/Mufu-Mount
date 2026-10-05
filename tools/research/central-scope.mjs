// Deliberate central-city viewing window, not an administrative boundary.
export const centralBounds=[118.62,31.88,119.00,32.19];
export function clipRing(ring){
 let out=ring.slice(0,-1);const [w,s,e,n]=centralBounds;
 for(const [axis,edge,sign] of [[0,w,1],[0,e,-1],[1,s,1],[1,n,-1]]){
  const input=out;out=[];if(!input.length)break;
  for(let i=0;i<input.length;i++){
   const a=input[(i+input.length-1)%input.length],b=input[i];
   const ai=sign*(a[axis]-edge)>=0,bi=sign*(b[axis]-edge)>=0;
   if(ai!==bi){const t=(edge-a[axis])/(b[axis]-a[axis]);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
   if(bi)out.push(b);
  }
 }return out.length>2?[...out,out[0]]:[];
}
export function centralCity(data){
 const [w,s,e,n]=centralBounds;
 const inside=p=>p[0]>=w&&p[0]<=e&&p[1]>=s&&p[1]<=n;
 const rivers=[];
 for(const r of data.rivers){let run=[];
  const flush=()=>{if(run.length>1)rivers.push({...r,points:run});run=[];};
  for(let i=1;i<r.points.length;i++){
   const a=r.points[i-1],b=r.points[i];let lo=0,hi=1,valid=true;
   for(const [p,q] of [[-(b[0]-a[0]),a[0]-w],[b[0]-a[0],e-a[0]],[-(b[1]-a[1]),a[1]-s],[b[1]-a[1],n-a[1]]]){
    if(p===0){if(q<0)valid=false;}else if(p<0)lo=Math.max(lo,q/p);else hi=Math.min(hi,q/p);
   }
   if(!valid||lo>hi){flush();continue;}
   const at=t=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
   const start=at(lo),end=at(hi);
   if(run.length&&Math.hypot(run.at(-1)[0]-start[0],run.at(-1)[1]-start[1])>1e-8)flush();
   if(!run.length)run.push(start);run.push(end);if(hi<1)flush();
  }flush();
 }
 return {...data,landmarks:data.landmarks.filter(p=>inside(p.coord)&&!['gaochun','tangshan'].includes(p.id)),rivers,
  lakes:data.lakes.filter(l=>['xuanwu','mochou','jiajiang-water'].includes(l.id)).map(l=>({...l,outer:l.outer.map(clipRing).filter(r=>r.length),inner:l.inner.map(clipRing).filter(r=>r.length)})),
  boundary:[[[w,s],[e,s],[e,n],[w,n],[w,s]]],
  extent:{kind:'central-city viewing window, not municipal boundary',bounds:centralBounds},
  note:data.note+' Display restricted to central Nanjing; rectangle is a viewing window.'};
}
