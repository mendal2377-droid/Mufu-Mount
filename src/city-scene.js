import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
import {cityPoint,inRing,ribbon,distanceToLine,cityHills,cityHeight} from "./city-geography.js";
import {randomSeed} from "./forest-geometry.js";

export function buildCityScene(data, shared, makeMaterial) {
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xc4d5c4,.00003);
  const places=data.landmarks.map(p=>({...p,position:cityPoint(p.coord,data)}));
  const hills=cityHills(places),rawGround=(x,z)=>cityHeight(x,z,hills);
  const terraces=places.filter(p=>['domes','mausoleum'].includes(p.kind)).map(p=>({
    x:p.position[0],z:p.position[2],kind:p.kind,y:rawGround(p.position[0],p.position[2]+(p.kind==='mausoleum'?65:0))}));
  const ground=(x,z)=>{
    let height=rawGround(x,z);
    for(const p of terraces){
      const outside=p.kind==='domes'?Math.hypot(x-p.x,z-p.z)-80:Math.max(Math.abs(x-p.x)-32,Math.abs(z-p.z-20)-85);
      const f=THREE.MathUtils.clamp(outside/30,0,1),weight=1-f*f*(3-2*f);
      height=THREE.MathUtils.lerp(height,p.y,weight);
    }return height;
  };
  const rings=data.boundary.map(r=>r.map(p=>cityPoint(p,data)));
  const riverLines=data.rivers.map(r=>({...r,points:r.points.map(p=>cityPoint(p,data)),width:r.name==='长江'?110:5}));
  const materials={
    lawn:makeMaterial('Grass | summer olive',[.52,.63,.31]),
    stone:makeMaterial('City warm stone',[.65,.60,.45]),
    white:makeMaterial('City lime plaster',[.83,.80,.65]),
    roof:makeMaterial('City dark tiled roof',[.12,.17,.16]),
    red:makeMaterial('City red timber',[.38,.12,.08]),
    blue:makeMaterial('City blue glazed roof',[.08,.25,.42]),
    bronze:makeMaterial('City bronze fixture',[.49,.29,.09]),
    glass:makeMaterial('City blue glass',[.20,.35,.36]),
    bark:makeMaterial('City bark',[.22,.17,.1]),
    leaf:makeMaterial('City foliage',[.23,.42,.24]),
    sage:makeMaterial('City meadow sage',[.42,.49,.28]),
    wheat:makeMaterial('City meadow wheat',[.57,.54,.32]),
    glow:new THREE.MeshStandardMaterial({color:0xda6944,emissive:0xff6725,emissiveIntensity:.35,roughness:.8}),
  };
  const batches=new Map(),geometryCache=new Map(),random=randomSeed(20261005);
  function add(geometry,mat='stone',position=[0,0,0],scale=[1,1,1],yaw=0){
    const g=geometry.clone(),m=new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(...scale));
    g.applyMatrix4(m);const ready=g.index?g.toNonIndexed():g;
    if(ready!==g)g.dispose();
    const pos=ready.attributes.position,norm=ready.attributes.normal,uv=[];
    for(let i=0;i<pos.count;i++){
      const nx=Math.abs(norm.getX(i)),ny=Math.abs(norm.getY(i)),nz=Math.abs(norm.getZ(i));
      if(ny>=nx&&ny>=nz)uv.push(pos.getX(i)*.08,pos.getZ(i)*.08);
      else if(nx>=nz)uv.push(pos.getZ(i)*.08,pos.getY(i)*.08);
      else uv.push(pos.getX(i)*.08,pos.getY(i)*.08);
    }
    ready.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    if(!batches.has(mat))batches.set(mat,[]);batches.get(mat).push(ready);
  }
  function primitive(key,create){if(!geometryCache.has(key))geometryCache.set(key,create());return geometryCache.get(key);}
  const box=primitive('box',()=>new THREE.BoxGeometry(1,1,1));
  const sphere=primitive('sphere',()=>new THREE.IcosahedronGeometry(1,1));
  const cylinder=primitive('cylinder',()=>new THREE.CylinderGeometry(1,1,1,8));
  const pine=primitive('pine',()=>new THREE.ConeGeometry(1,1,9));
  function block(x,y,z,w,h,d,mat='stone',yaw=0){add(box,mat,[x,y+h*.5,z],[w,h,d],yaw);}
  function beam(a,b,r,mat='stone'){
    const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const g=new THREE.CylinderGeometry(r,r,v.length(),5);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));
    g.translate(...new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5).toArray());
    add(g,mat);g.dispose();
  }
  const roof=primitive('roof',()=>{
    const g=new THREE.BufferGeometry();
    // The eaves rise at the tips instead of making every pavilion a cone.
    g.setAttribute('position',new THREE.Float32BufferAttribute([
      -.58,0,-.58,.58,0,-.58,0,.44,0,.58,0,-.58,.58,0,.58,0,.44,0,
      .58,0,.58,-.58,0,.58,0,.44,0,-.58,0,.58,-.58,0,-.58,0,.44,0,
      -.58,0,-.58,-.5,-.08,-.5,.5,-.08,-.5,-.58,0,-.58,.5,-.08,-.5,.58,0,-.58,
      .58,0,.58,.5,-.08,.5,-.5,-.08,.5,.58,0,.58,-.5,-.08,.5,-.58,0,.58,
    ],3));g.computeVertexNormals();return g;
  });
  function hall(x,y,z,w=20,d=14,h=8,tiles='roof'){
    block(x,y,z,w,h,d,'white');
    block(x,y+h*.1,z+d*.51,w*.88,h*.72,.25,'red');
    for(let i=-2;i<=2;i++)block(x+i*w*.17,y,z+d*.52,.42,h,.42,'red');
    add(roof,tiles,[x,y+h,z],[w+4,8,d+4]);
    block(x,y+h+3.5,z,w*.6,.35,.55,tiles);
  }
  function pagoda(x,y,z,levels=7,tiles='bronze'){
    for(let i=0;i<levels;i++){
      const w=12-i*.85;
      block(x,y+i*4,z,w*.7,3.7,w*.7,'red');
      add(roof,tiles,[x,y+i*4+3,z],[w,4,w]);
    }beam([x,y+levels*4,z],[x,y+levels*4+5,z],.25,'bronze');
  }
  const planting=[];
  function tree(x,z,scale=1){planting.push({x,z,scale});}
  function sculptTree(x,z,scale=1){
    const y=ground(x,z);add(cylinder,'bark',[x,y+3*scale,z],[.35*scale,6*scale,.35*scale]);
    // Painted ground shade gives each crown weight without thousands of shadow casters.
    const shade=new THREE.CircleGeometry(3.3*scale,10);shade.rotateX(-Math.PI/2);
    add(shade,'sage',[x,y+.07,z],[1,1,.6]);shade.dispose();
    if(random()<.28)for(let i=0;i<4;i++)add(pine,'leaf',[x,y+(4+i*1.3)*scale,z],[(3-i*.5)*scale,3.5*scale,(3-i*.5)*scale]);
    else for(let i=0;i<3;i++)add(sphere,'leaf',[x+Math.cos(i*2.4)*1.5*scale,y+(6+i*.6)*scale,z+Math.sin(i*2.4)*1.5*scale],
      [2.7*scale,3.2*scale,2.5*scale],random()*6.28);
  }
  function flatPolygon(ring,mat,y=1.2,holes=[]){
    const shape=new THREE.Shape(ring.map(p=>new THREE.Vector2(p[0],-p[2])));
    holes.forEach(r=>shape.holes.push(new THREE.Path(r.map(p=>new THREE.Vector2(p[0],-p[2])))));
    const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,y,0);add(g,mat);g.dispose();
  }
  rings.forEach(r=>flatPolygon(r,'lawn'));
  // Paper-coloured surroundings distinguish the municipality from its neighbours.
  const background=new THREE.Mesh(new THREE.PlaneGeometry(100000,100000),
    new THREE.MeshStandardMaterial({color:0xd1d3be,roughness:1}));
  background.rotation.x=-Math.PI/2;background.position.set(0,-.3,1700);scene.add(background);
  rings.forEach(r=>{
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(r.map(p=>new THREE.Vector3(p[0],1.5,p[2]))),
      new THREE.LineBasicMaterial({color:0xe3ddbd}));scene.add(line);
  });
  // Gaussian park hills are scenic forms, not DEM elevations.
  {
    const xmin=Math.min(...hills.map(h=>h.x-h.radius*2.5)),xmax=Math.max(...hills.map(h=>h.x+h.radius*2.5));
    const zmin=Math.min(...hills.map(h=>h.z-h.radius*2.5)),zmax=Math.max(...hills.map(h=>h.z+h.radius*2.5));
    const cx=(xmin+xmax)/2,cz=(zmin+zmax)/2;
    // One shared surface avoids overlapping hill patches and mismatched tree bases.
    const g=new THREE.PlaneGeometry(xmax-xmin,zmax-zmin,Math.ceil((xmax-xmin)/8),Math.ceil((zmax-zmin)/8));g.rotateX(-Math.PI/2);
    const p=g.attributes.position;
    for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)+cx,ground(p.getX(i)+cx,p.getZ(i)+cz)+.04,p.getZ(i)+cz);
    g.computeVertexNormals();add(g,'lawn');g.dispose();
  }
  const water=new THREE.MeshStandardMaterial({color:0x6da5a2,roughness:.28,metalness:.35,side:THREE.DoubleSide});
  water.onBeforeCompile=shader=>{
    shader.uniforms.cityTime=shared.time;shader.uniforms.cityStorm=shared.storm;
    shader.vertexShader='varying vec3 cityWaterPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ncityWaterPoint=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader='uniform float cityTime,cityStorm;varying vec3 cityWaterPoint;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',
      `#include <normal_fragment_maps>
       float w=sin(cityWaterPoint.x*1.7+cityWaterPoint.z*.9-cityTime*1.6);
       float b=cos(cityWaterPoint.z*2.1-cityTime*1.25);
       normal=normalize(normal+vec3(w,0.,b)*(.09+cityStorm*.12));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',
      `#include <color_fragment>
       float ripple=sin(cityWaterPoint.x*.4+cityWaterPoint.z*.8-cityTime*.7)*.5+.5;
       float phase=cityWaterPoint.z*2.4+sin(cityWaterPoint.x*.6)-cityTime*.8;
       float stroke=pow(max(0.,sin(phase)),18.)*(1.-smoothstep(.2,1.,fwidth(phase)));
       diffuseColor.rgb*=.93+ripple*.13;
       diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.86,.78),stroke*.2);`);
  };
  materials.water=water;
  riverLines.forEach(r=>{const g=ribbon(r.points,r.width,1.31);add(g,'water');g.dispose();});
  const lakeRings=[];
  data.lakes.forEach(l=>{
    const outer=l.outer.map(r=>r.map(p=>cityPoint(p,data))),holes=l.inner.map(r=>r.map(p=>cityPoint(p,data)));
    outer.forEach(r=>{flatPolygon(r,'water',1.35,holes.filter(h=>inRing(h[0][0],h[0][2],r)));lakeRings.push(r);});
  });
  function wet(x,z){return riverLines.some(r=>distanceToLine(x,z,r.points)<r.width*.55)||lakeRings.some(r=>inRing(x,z,r));}
  function route(points,width=7){return {name:'Scenic walking route',width,points};}
  function loop(x,z,r=38,count=48){return Array.from({length:count+1},(_,i)=>{
    const a=(i/count)*Math.PI*2;return [x+Math.sin(a)*r,ground(x+Math.sin(a)*r,z+Math.cos(a)*r)+.16,z+Math.cos(a)*r];});}
  const routes=[];
  places.forEach(p=>{
    const [x,,z]=p.position,y=ground(x,z);p.position[1]=y;
    let walk=loop(x,z,p.kind==='mount'?70:p.kind==='oldtown'?43:36);
    if(p.kind==='oldtown'){
      // A compact district vignette exaggerates alleys and waterfront space.
      // It evokes the photo references; these are not individual surveyed homes.
      for(let row=-1;row<=1;row+=2)for(let i=-3;i<=3;i++){
        const bx=x+i*17,bz=z+row*19;hall(bx,ground(bx,bz),bz,13,11,6);
        for(const side of [-1,1])add(sphere,'glow',[bx+side*4,ground(bx,bz)+5,bz-row*6],[.45,.7,.45]);
      }
      if(p.id!=='mendong'){
        const canal=ribbon([[x-75,y,z+40],[x,y,z+44],[x+75,y,z+39]],10,.14);add(canal,'water');canal.dispose();
        block(x,y,z+28,15,.3,12,'stone');
      }
      hall(x+82,y,z-45,22,16,9,p.id==='qinhuai'?'red':'roof');
      walk=Array.from({length:61},(_,i)=>[x-65+i*2.1,ground(x-65+i*2.1,z)+.17,z]);
      const sign=document.createElement('canvas');sign.width=512;sign.height=128;
      const c=sign.getContext('2d');c.fillStyle='#d6ca9f';c.fillRect(0,0,512,128);
      c.fillStyle='#343e30';c.font='bold 74px serif';c.textAlign='center';c.fillText(p.zh,256,89);
      const texture=new THREE.CanvasTexture(sign);texture.colorSpace=THREE.SRGBColorSpace;
      const plaque=new THREE.Mesh(new THREE.PlaneGeometry(10,2.5),new THREE.MeshStandardMaterial({map:texture}));
      plaque.position.set(x+82,y+8,z-35.9);scene.add(plaque);
    }else if(['truss','cable','eye'].includes(p.kind)){
      const main=riverLines.filter(r=>r.name==='长江').sort((a,b)=>distanceToLine(x,z,a.points)-distanceToLine(x,z,b.points))[0];
      const near=main?.points.sort?main.points:[];
      let a=[x-40,0,z-55],b=[x+40,0,z+55];
      if(p.kind==='truss'){
        const e=data.landmarks.find(q=>q.id==='bridge');
        // A simplified diagonal span near the public feature anchor, not a survey.
        a=cityPoint([118.73127,32.12030],data);b=cityPoint([118.74579,32.11090],data);
        void e;void near;
      }else if(p.kind==='cable'){a=[x-95,0,z-50];b=[x+95,0,z+50];}
      const length=Math.hypot(b[0]-a[0],b[2]-a[2]),yaw=Math.atan2(b[0]-a[0],b[2]-a[2]);
      const deck=p.kind==='eye'?10:14;
      block(x,deck-1,z,10,1,length,'stone',yaw);
      function bp(t,side=0,h=deck){const px=a[0]+(b[0]-a[0])*t,pz=a[2]+(b[2]-a[2])*t;
        return [px+Math.cos(yaw)*side,h,pz-Math.sin(yaw)*side];}
      for(let i=0;i<=10;i++){
        const t=i/10,pos=bp(t);block(pos[0],1.2,pos[2],4,deck-1.2,5,'stone',yaw);
        for(const side of [-1,1]){
          beam(bp(t,side*5,deck+1),bp(Math.min(1,t+.1),side*5,deck+1),.18,'white');
          if(p.kind==='truss'&&i<10){beam(bp(t,side*4,deck-1),bp(t+.1,side*4,deck-6),.45,'glass');
            beam(bp(t,side*4,deck-6),bp(t+.1,side*4,deck-1),.45,'glass');}
        }
      }
      for(const t of [.13,.87]){
        if(p.kind==='truss')for(const side of [-1,1]){
          const pos=bp(t,side*7);block(pos[0],deck-6,pos[2],4,22,5,'white',yaw);
          for(let k=0;k<3;k++)block(pos[0]+k*.7,deck+16+k*.4,pos[2],.5,3.2,3,'red',yaw);
        }else if(p.kind==='cable'){
          const pos=bp(t);block(pos[0],deck,pos[2],3,24,3,'bronze');
          for(let i=1;i<10;i++)for(const side of [-1,1])beam(bp(t,0,deck+24),bp(i/10,side*4,deck),.12,'white');
        }
      }
      if(p.kind==='eye')for(const side of [-1,1]){
        const pts=Array.from({length:49},(_,i)=>{const t=i/48;return bp(t,side*6,deck+Math.sin(t*Math.PI)*24);});
        for(let i=1;i<pts.length;i++)beam(pts[i-1],pts[i],.55,'white');
      }
      walk=Array.from({length:81},(_,i)=>bp(i/80,3.6,deck+.03));p.position=[x,deck,z];
    }else if(p.kind==='wall'){
      for(const side of [-1,1])block(x+side*31,y,z,46,12,13,'stone');
      block(x,y+9,z,16,3,13,'stone');
      for(let i=-12;i<=12;i++)block(x+i*4,y+12,z-6,1.6,1.8,1.6,'stone');
      for(const xx of [-34,34])hall(x+xx,y+12,z,18,13,7);
      walk=Array.from({length:61},(_,i)=>[x-60+i*2,y+12.1,z]);
    }else if(p.kind==='mausoleum'){
      const base=ground(x,z+58);
      for(let i=0;i<24;i++)block(x,base+i*.45,z+58-i*2.1,16,.5,2.2,'white');
      hall(x,base+10.8,z+7,22,16,9,'blue');hall(x,base,z+65,21,8,6,'blue');
      block(x,base,z+61,16,.12,8,'white');
      // Stop outside the main hall; keep the steps visible rather than paving over them.
      walk=Array.from({length:50},(_,i)=>[x,base+Math.max(0,Math.ceil((i-7)/2.1))*.45+.18,z+65-i]);
    }else if(p.kind==='domes'){
      const dome=primitive('dome',()=>new THREE.SphereGeometry(1,28,16,0,Math.PI*2,0,Math.PI*.5));
      add(dome,'bronze',[x-15,y,z],[20,14,20]);add(dome,'stone',[x+18,y,z-8],[24,16,24]);
      for(let i=0;i<12;i++){
        const angle=i*Math.PI/6;
        const pts=Array.from({length:15},(_,j)=>{const t=j/14*Math.PI*.5;return [x+18+Math.sin(t)*24*Math.cos(angle),y+Math.cos(t)*16+.1,z-8+Math.sin(t)*24*Math.sin(angle)];});
        for(let j=1;j<pts.length;j++)beam(pts[j-1],pts[j],.17,'bronze');
      }pagoda(x+52,ground(x+52,z),z,9);
      walk=loop(x,z,63);
    }else if(p.kind==='skyline'){
      for(let i=0;i<5;i++)block(x+i*2,y+i*10,z,20-i*2,10,17-i,'glass');
      beam([x+8,y+50,z],[x+8,y+66,z],.45,'bronze');
      for(let i=1;i<40;i++)block(x+3,y+i*1.15,z+8.6,17,.12,.15,'white');
    }else if(['pagoda','tower','temple'].includes(p.kind)){
      if(p.kind==='tower')for(let i=0;i<4;i++)hall(x,y+i*7,z,28-i*4,22-i*3,6,'bronze');
      else{pagoda(x,y,z,p.kind==='temple'?5:7,p.kind==='temple'?'roof':'bronze');hall(x-20,ground(x-20,z+16),z+16,20,14,8);}
    }else if(p.kind==='tomb'){
      hall(x,y,z,25,17,10,'red');
      for(let i=0;i<8;i++){
        const xx=x+(i%2?13:-13),zz=z+25+Math.floor(i/2)*14,yy=ground(xx,zz);
        add(sphere,'stone',[xx,yy+2.3,zz],[2,2,3]);add(sphere,'stone',[xx,yy+3,zz-2],[1.2,1.4,1]);
        for(const dx of [-1,1])for(const dz of [-1,1])block(xx+dx,yy,zz+dz*1.7,.65,2,.65,'stone');
      }walk=Array.from({length:55},(_,i)=>[x,ground(x,z+75-i*1.25)+.2,z+75-i*1.25]);
    }else if(p.kind==='palace'){
      hall(x,y,z,25,16,9);hall(x-22,y,z-30,20,15,7);hall(x+22,y,z-30,20,15,7);
      for(const xx of [-10,0,10])block(x+xx,y,z+15,2,5,2,'white');
      block(x,y+5,z+15,24,2,3,'white');
    }else if(p.kind==='springs'){
      for(let i=0;i<5;i++){
        const xx=x+(i%3-1)*14,zz=z+Math.floor(i/3)*16;
        add(cylinder,'stone',[xx,ground(xx,zz)+.1,zz],[6,.3,6]);
        add(cylinder,'water',[xx,ground(xx,zz)+.3,zz],[5.5,.12,5.5]);
      }hall(x,y,z-25,25,15,7);
    }else if(p.kind==='lake'){
      // A shore entrance rather than placing the walker at a lake's centre.
      const l=data.lakes.find(l=>l.id===p.id),r=l?.outer[0].map(q=>cityPoint(q,data));
      if(r?.length){const shore=r[Math.floor(r.length*.28)];p.position=[shore[0]+6,1.6,shore[2]+6];
        const sx=p.position[0],sz=p.position[2];walk=Array.from({length:65},(_,i)=>[sx+(i-32)*1.3,1.55,sz]);
        block(sx,1.2,sz,85,.25,7,'stone');hall(sx+25,1.6,sz-12,13,10,7);}
    }else if(p.kind==='mount'){
      hall(x,y,z,15,12,7);walk=loop(x,z,75);
    }
    walk.forEach(pt=>{if(!Number.isFinite(pt[1]))pt[1]=1.5;});
    p.route=routes.length;routes.push({...route(walk),name:p.name});
    p.spawn=walk[Math.floor(walk.length*.18)].slice();p.spawn[1]+=1.7;
    p.look=p.position.slice();p.look[1]+=p.kind==='skyline'?25:5;
    if(p.kind!=='mausoleum'){const path=ribbon(walk,6,.015);add(path,'stone');path.dispose();}
    if(!['truss','cable','eye'].includes(p.kind))for(let i=0;i<35;i++){
      const angle=random()*Math.PI*2,r=55+random()*45,tx=x+Math.cos(angle)*r,tz=z+Math.sin(angle)*r;
      if(!wet(tx,tz))tree(tx,tz,.7+random()*.55);
    }
  });
  hills.forEach(h=>{for(let i=0;i<120;i++){
    const a=random()*Math.PI*2,r=(.35+random()*.8)*h.radius,x=h.x+Math.cos(a)*r,z=h.z+Math.sin(a)*r;
    if(wet(x,z)||places.some(p=>Math.hypot(x-p.position[0],z-p.position[2])<38)||routes.some(route=>distanceToLine(x,z,route.points)<8))continue;
    tree(x,z,.7+random()*1.2);
  }});
  // Generic blocks communicate the urban fabric. They are deliberately omitted
  // near landmark walks, park slopes and mapped water; no street-level claim.
  for(let i=0;i<1100;i++){
    const x=(random()-.5)*1450,z=(random()-.5)*1300;
    if(wet(x,z)||ground(x,z)>4||places.some(p=>Math.hypot(x-p.position[0],z-p.position[2])<95))continue;
    const h=5+random()**2*22;block(x,1.25,z,8+random()*9,h,8+random()*9,i%4?'white':'glass');
  }
  for(let i=-6;i<=6;i++){
    const a=[[i*100,1.25,-650],[i*100,1.25,650]],b=[[-700,1.25,i*100],[700,1.25,i*100]];
    for(const line of [a,b]){
      const pieces=[];for(let j=0;j<=80;j++){
        const f=j/80,x=line[0][0]+(line[1][0]-line[0][0])*f,z=line[0][2]+(line[1][2]-line[0][2])*f;
        if(wet(x,z)||ground(x,z)>5||places.some(p=>Math.hypot(x-p.position[0],z-p.position[2])<75)){
          if(pieces.length>1){const g=ribbon(pieces,4,.08);add(g,'stone');g.dispose();}pieces.length=0;
        }else pieces.push([x,1.25,z]);
      }if(pieces.length>1){const g=ribbon(pieces,4,.08);add(g,'stone');g.dispose();}
    }
  }
  // Sparse pastoral plots make the broad southern/northern municipal map read
  // as countryside rather than an endless empty slab.
  for(let i=0;i<450;i++){
    const x=(random()-.5)*4800,z=-4000+random()*9800;
    if(!rings.some(r=>inRing(x,z,r))||wet(x,z)||Math.abs(x)<800&&Math.abs(z)<800)continue;
    block(x,1.2,z,28+random()*50,.04,22+random()*55,i%2?'wheat':'sage',random()*.16);
    if(i%3===0)tree(x,z,1);
  }
  // Apply the complete path mask after all destinations exist, so trees from a
  // neighbouring district cannot sprout in an entrance or staircase.
  planting.forEach(({x,z,scale})=>{
    if(!routes.some(r=>distanceToLine(x,z,r.points)<8)&&!wet(x,z))sculptTree(x,z,scale);
  });
  const meshes=[];
  batches.forEach((geos,key)=>{
    const merged=mergeGeometries(geos);geos.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(merged,materials[key]);mesh.name=`Nanjing atlas | ${key}`;
    mesh.receiveShadow=key!=='water';mesh.castShadow=false;scene.add(mesh);meshes.push(mesh);
    if(['roof','blue','white','red'].includes(key)){
      const strokes=new THREE.LineSegments(new THREE.EdgesGeometry(merged,38),
        new THREE.LineBasicMaterial({color:0x344f48,transparent:true,opacity:.18}));
      strokes.name='Illustration contour | '+key;scene.add(strokes);
    }
  });geometryCache.forEach(g=>g.dispose());
  return {scene,places,routes,ground,rings,riverLines,materials,
    triangleCount:meshes.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0)};
}
