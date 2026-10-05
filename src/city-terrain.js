import * as THREE from 'three';
import {cityHills,inRing} from './city-geography.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t);};
function noise(x,z){
  const hash=(a,b)=>{const v=Math.sin(a*127.1+b*311.7+47.2)*43758.5453;return v-Math.floor(v);};
  const ix=Math.floor(x),iz=Math.floor(z),u=smooth(0,1,x-ix),v=smooth(0,1,z-iz);
  return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix,iz),hash(ix+1,iz),u),
    THREE.MathUtils.lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v);
}

// Spatial water queries also shape floodplains, not just decide where to plant.
// The map supplies anchors/centerlines; every elevation is an artistic choice.
export function createCityTerrain(places,riverLines,lakes,rings){
  const hills=cityHills(places);
  const config={mufu:[138,285,115,-.18],zijin:[240,385,280,.45],niushou:[165,235,165,-.5],
    qixia:[150,255,165,.3],tangshan:[118,420,230,-.3],yuejiang:[36,105,80,0]};
  hills.forEach(h=>{const p=places.find(p=>p.position[0]===h.x&&p.position[2]===h.z),c=config[p.id];
    [h.height,h.rx,h.rz,h.yaw]=c;h.radius=Math.max(h.rx,h.rz);
    if(p.id==='mufu')h.z+=95;});
  // Secondary scenic ridges give the outskirts relief without inventing labels
  // or claiming surveyed mountain boundaries.
  const outlying=[[-1100,-750,92,470,260,-.5],[-1450,-2150,116,670,310,.5],
    [650,-2500,82,720,340,-.3],[450,1800,72,470,350,.6],
    [1300,2750,100,520,280,-.4],[1250,4700,78,630,370,.3],[-850,3600,65,560,360,-.2]];
  const ridges=[...hills,...outlying.map(([x,z,height,rx,rz,yaw])=>({x,z,height,rx,rz,yaw,radius:Math.max(rx,rz),secondary:true}))];
  const buckets=new Map(),lakeBounds=[];
  const cell=96;
  function index(a,b,width){
    const rec={a,b,width,dx:b[0]-a[0],dz:b[2]-a[2]};rec.den=rec.dx*rec.dx+rec.dz*rec.dz;
    const margin=width?100:280;
    for(let x=Math.floor((Math.min(a[0],b[0])-width-margin)/cell);x<=Math.floor((Math.max(a[0],b[0])+width+margin)/cell);x++)
      for(let z=Math.floor((Math.min(a[2],b[2])-width-margin)/cell);z<=Math.floor((Math.max(a[2],b[2])+width+margin)/cell);z++){
        const key=`${x},${z}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(rec);
      }
  }
  riverLines.forEach(r=>{for(let i=1;i<r.points.length;i++)index(r.points[i-1],r.points[i],r.width*.5);});
  lakes.forEach(l=>l.outer.forEach(r=>{
    lakeBounds.push({ring:r,holes:l.inner.filter(h=>inRing(h[0][0],h[0][2],r)),
      xmin:Math.min(...r.map(p=>p[0])),xmax:Math.max(...r.map(p=>p[0])),zmin:Math.min(...r.map(p=>p[2])),zmax:Math.max(...r.map(p=>p[2]))});
    for(let i=1;i<r.length;i++)index(r[i-1],r[i],0);
    l.inner.forEach(h=>{for(let i=1;i<h.length;i++)index(h[i-1],h[i],0);});
  }));
  function shore(x,z,lakeOnly=false){
    let bank=Infinity,river=Infinity;
    for(const r of buckets.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)||[]){
      const t=r.den?clamp(((x-r.a[0])*r.dx+(z-r.a[2])*r.dz)/r.den):0;
      const d=Math.hypot(x-r.a[0]-t*r.dx,z-r.a[2]-t*r.dz);
      if(r.width)river=Math.min(river,d-r.width);else bank=Math.min(bank,d);
    }
    const inside=lakeBounds.some(b=>x>=b.xmin&&x<=b.xmax&&z>=b.zmin&&z<=b.zmax&&inRing(x,z,b.ring)&&!b.holes.some(h=>inRing(x,z,h)));
    return Math.min(lakeOnly?Infinity:river,inside?-Math.min(bank,100):bank);
  }
  function relief(x,z){
    let height=0;
    for(const h of ridges){
      const dx=x-h.x,dz=z-h.z,c=Math.cos(h.yaw),s=Math.sin(h.yaw);
      const a=(dx*c+dz*s)/h.rx,b=(-dx*s+dz*c)/h.rz,r=a*a+b*b;
      if(r>12)continue;
      const envelope=Math.exp(-r*1.6);
      // Broad linked peaks, folded shoulders, and asymmetric gullies.
      const folds=.82+.16*Math.sin(a*7+b*2)+.12*(noise(x/48,z/48)-.5);
      height+=h.height*envelope*folds;
    }return height;
  }
  function raw(x,z){
    const outskirts=smooth(700,1700,Math.hypot(x,z));
    return 1.2+relief(x,z)+(noise(x/95,z/95)*.8+noise(x/230,z/230)*.6)*(.9+outskirts*9);
  }
  const terraces=places.filter(p=>!['mount','truss','cable','eye','lake'].includes(p.kind)).map(p=>{
    const [x,,z]=p.position,kind=p.kind;
    return {x,z,kind,y:raw(x,z+(kind==='mausoleum'?65:0)),rx:kind==='oldtown'?110:kind==='domes'?82:30,
      rz:kind==='oldtown'?70:kind==='domes'?82:kind==='mausoleum'?85:30,offset:kind==='mausoleum'?20:0};
  });
  function ground(x,z){
    let y=raw(x,z);
    for(const p of terraces){
      const d=Math.max(Math.abs(x-p.x)-p.rx,Math.abs(z-p.z-p.offset)-p.rz),weight=1-smooth(0,70,d);
      if(weight)y=THREE.MathUtils.lerp(y,p.y,weight);
    }
    const d=shore(x,z);
    // A real bed below the water removes the overlapping flat layers that
    // caused striped patches during flight. The banks climb smoothly inland.
    if(d<0)return -.8;
    if(d<36)y=THREE.MathUtils.lerp(.2,y,smooth(0,36,d));
    // The compressed atlas puts mountains close to lakes. Give the lake a
    // broad park shoulder instead of a near-vertical wall at the waterline.
    const lakeBank=shore(x,z,true);
    if(lakeBank>0&&lakeBank<240){
      const shoulder=.2+lakeBank*.22+Math.max(0,lakeBank-90)*.5;
      y=THREE.MathUtils.lerp(y,Math.min(y,shoulder),1-smooth(160,240,lakeBank));
    }
    return y;
  }
  function slope(x,z){return Math.hypot(ground(x+2,z)-ground(x-2,z),ground(x,z+2)-ground(x,z-2))/4;}
  const bounds=new THREE.Box3().setFromPoints(rings.flat().map(p=>new THREE.Vector3(...p)));
  const ringBounds=rings.map(r=>({ring:r,xmin:Math.min(...r.map(p=>p[0])),xmax:Math.max(...r.map(p=>p[0])),
    zmin:Math.min(...r.map(p=>p[2])),zmax:Math.max(...r.map(p=>p[2]))}));
  const contains=(x,z)=>ringBounds.some(b=>x>=b.xmin&&x<=b.xmax&&z>=b.zmin&&z<=b.zmax&&inRing(x,z,b.ring));
  const tileSize=64,border=new Set();
  rings.forEach(r=>{for(let i=1;i<r.length;i++){
    const a=r[i-1],b=r[i],n=Math.ceil(Math.hypot(b[0]-a[0],b[2]-a[2])/16);
    for(let j=0;j<=n;j++)border.add(`${Math.floor(THREE.MathUtils.lerp(a[0],b[0],j/(n||1))/tileSize)},${Math.floor(THREE.MathUtils.lerp(a[2],b[2],j/(n||1))/tileSize)}`);
  }});
  const positions=[],colors=[],indices=[],uv=[],cache=new Map();
  const palette=[new THREE.Color('#a4b289'),new THREE.Color('#567d72'),new THREE.Color('#8d9f80'),new THREE.Color('#c0b998'),new THREE.Color('#8a9386')];
  function vertex(x,z){
    const key=`${x},${z}`;if(cache.has(key))return cache.get(key);
    const y=ground(x,z),s=slope(x,z),f=noise(x/85,z/85),d=shore(x,z);
    const shade=palette[0].clone().lerp(palette[1],smooth(15,120,y)*.65).lerp(palette[2],f*.35);
    if(s>.55)shade.lerp(palette[4],smooth(.55,1.1,s)*.5);
    if(d<12)shade.lerp(palette[3],.65);
    const n=positions.length/3;positions.push(x,y,z);colors.push(...shade.toArray());uv.push(x*.035,z*.035);cache.set(key,n);return n;
  }
  const xmin=Math.floor(bounds.min.x/tileSize),xmax=Math.ceil(bounds.max.x/tileSize),zmin=Math.floor(bounds.min.z/tileSize),zmax=Math.ceil(bounds.max.z/tileSize);
  const tileRecords=new Map();
  for(let tx=xmin;tx<xmax;tx++)for(let tz=zmin;tz<zmax;tz++){
    const x=tx*tileSize,z=tz*tileSize,cx=x+32,cz=z+32,edge=border.has(`${tx},${tz}`);
    if(!edge&&!contains(cx,cz))continue;
    const close=places.some(p=>Math.hypot(cx-p.position[0],cz-p.position[2])<155);
    const mountain=ridges.some(h=>Math.hypot((cx-h.x)/h.rx,(cz-h.z)/h.rz)<1.8);
    const bank=Math.abs(shore(cx,cz))<64;
    tileRecords.set(`${tx},${tz}`,{tx,tz,x,z,edge,divisions:edge||close||bank?8:mountain?4:1});
  }
  // Split coarse boundary edges to match their finer neighbour. These shared
  // vertices eliminate cracks between the city grid and detailed hill tiles.
  for(const {tx,tz,x,z,edge,divisions} of tileRecords.values()){
    const step=tileSize/divisions;
    for(let i=0;i<divisions;i++)for(let j=0;j<divisions;j++){
      const ax=x+i*step,az=z+j*step;
      if(edge&&!contains(ax+step*.5,az+step*.5))continue;
      const a=vertex(ax,az),b=vertex(ax+step,az),c=vertex(ax,az+step),d=vertex(ax+step,az+step);
      const outline=[],sides=[[[ax,az],[ax,az+step],i===0?`${tx-1},${tz}`:null],
        [[ax,az+step],[ax+step,az+step],j===divisions-1?`${tx},${tz+1}`:null],
        [[ax+step,az+step],[ax+step,az],i===divisions-1?`${tx+1},${tz}`:null],
        [[ax+step,az],[ax,az],j===0?`${tx},${tz-1}`:null]];
      for(const [from,to,key] of sides){
        const subdivisions=Math.max(1,(tileRecords.get(key)?.divisions||divisions)/divisions);
        for(let n=0;n<subdivisions;n++)outline.push(vertex(THREE.MathUtils.lerp(from[0],to[0],n/subdivisions),THREE.MathUtils.lerp(from[1],to[1],n/subdivisions)));
      }
      if(outline.length===4)indices.push(a,c,b,b,c,d);
      else{const centre=vertex(ax+step*.5,az+step*.5);for(let k=0;k<outline.length;k++)indices.push(centre,outline[k],outline[(k+1)%outline.length]);}
    }
  }
  const tiles=tileRecords.size;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  // Analytic ground and mesh interpolation must agree for walking/planting.
  // Sampling the rendered grid prevents trees floating at coarse terrain joins.
  const samples=new Map(),surfacePositions=geometry.attributes.position.array,surfaceIndices=geometry.index.array;
  for(let i=0;i<surfaceIndices.length;i+=3){
    const p=[surfaceIndices[i],surfaceIndices[i+1],surfaceIndices[i+2]].map(id=>[surfacePositions[id*3],surfacePositions[id*3+1],surfacePositions[id*3+2]]);
    const loX=Math.floor(Math.min(...p.map(v=>v[0]))/64),hiX=Math.floor(Math.max(...p.map(v=>v[0]))/64);
    const loZ=Math.floor(Math.min(...p.map(v=>v[2]))/64),hiZ=Math.floor(Math.max(...p.map(v=>v[2]))/64);
    // Store index offsets, not copies of every triangle's vertices. A city
    // should not keep hundreds of thousands of nested JS arrays on a phone.
    for(let x=loX;x<=hiX;x++)for(let z=loZ;z<=hiZ;z++){const key=`${x},${z}`;if(!samples.has(key))samples.set(key,[]);samples.get(key).push(i);}
  }
  function surface(x,z){
    for(const i of samples.get(`${Math.floor(x/64)},${Math.floor(z/64)}`)||[]){
      const a=surfaceIndices[i]*3,b=surfaceIndices[i+1]*3,c=surfaceIndices[i+2]*3,p=surfacePositions;
      const ax=p[a],az=p[a+2],bx=p[b],bz=p[b+2],cx=p[c],cz=p[c+2];
      const den=(bz-cz)*(ax-cx)+(cx-bx)*(az-cz);
      const u=((bz-cz)*(x-cx)+(cx-bx)*(z-cz))/den,v=((cz-az)*(x-cx)+(ax-cx)*(z-cz))/den;
      if(u>=-1e-6&&v>=-1e-6&&u+v<=1+1e-6)return u*p[a+1]+v*p[b+1]+(1-u-v)*p[c+1];
    }return ground(x,z);
  }
  return {hills,ridges,ground:surface,analytic:ground,relief,shore,wet:(x,z)=>shore(x,z)<.8,slope,contains,bounds,geometry,
    stats:{terrainTriangles:indices.length/3,terrainVertices:positions.length/3,tiles,singleSurface:true}};
}
