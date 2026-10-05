import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
import {cityPoint,inRing,ribbon,distanceToLine} from "./city-geography.js";
import {createCityTerrain} from './city-terrain.js';
import {createCityLandscape} from './city-landscape.js';
import {paintCityWater} from './city-art.js';
import {randomSeed} from "./forest-geometry.js";

export function buildCityScene(data, shared, makeMaterial) {
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xc4d5c4,.00003);
  const places=data.landmarks.map(p=>({...p,position:cityPoint(p.coord,data)}));
  const rings=data.boundary.map(r=>r.map(p=>cityPoint(p,data)));
  const riverLines=data.rivers.map(r=>({...r,points:r.points.map(p=>cityPoint(p,data)),width:r.name==='长江'?110:5}));
  const lakes=data.lakes.map(l=>({...l,outer:l.outer.map(r=>r.map(p=>cityPoint(p,data))),inner:l.inner.map(r=>r.map(p=>cityPoint(p,data)))}));
  const terrain=createCityTerrain(places,riverLines,lakes,rings),{hills,ground,wet}=terrain;
  const materials={
    terrain:makeMaterial('City relief paper',[1,1,1]),
    stone:makeMaterial('City warm stone',[.76,.72,.60]),
    white:makeMaterial('City lime plaster',[.92,.88,.76]),
    roof:makeMaterial('City dark tiled roof',[.29,.38,.40]),
    red:makeMaterial('City red timber',[.56,.25,.16]),
    blue:makeMaterial('City blue glazed roof',[.24,.39,.51]),
    bronze:makeMaterial('City bronze fixture',[.55,.43,.23]),
    glass:makeMaterial('City blue glass',[.32,.47,.49]),
    bark:makeMaterial('City bark',[.34,.27,.19]),
    leaf:makeMaterial('City foliage',[1,1,1]),
    canopy:makeMaterial('City distant canopy',[.43,.58,.49]),
    sage:makeMaterial('City meadow sage',[.51,.61,.39]),
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
  function block(x,y,z,w,h,d,mat='stone',yaw=0){add(box,mat,[x,y+h*.5,z],[w,h,d],yaw);}
  function beam(a,b,r,mat='stone'){
    const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a));
    const g=new THREE.CylinderGeometry(r,r,v.length(),5);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize()));
    g.translate(...new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5).toArray());
    add(g,mat);g.dispose();
  }
  const roof=primitive('roof',()=>{
    const g=new THREE.BufferGeometry(),vertices=[];
    const xs=[-.62,-.34,.34,.62],zs=[-.58,-.28,0,.28,.58];
    const height=(x,z)=>.42*(1-Math.abs(z)/.58)*(Math.abs(x)>.34?(.62-Math.abs(x))/.28:1)
      +.065*(Math.abs(x)/.62)**4*(Math.abs(z)/.58)**4;
    for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
      const a=[xs[i],height(xs[i],zs[j]),zs[j]],b=[xs[i+1],height(xs[i+1],zs[j]),zs[j]],
        c=[xs[i],height(xs[i],zs[j+1]),zs[j+1]],d=[xs[i+1],height(xs[i+1],zs[j+1]),zs[j+1]];
      vertices.push(...a,...c,...b,...b,...c,...d);
    }g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
  });
  function hall(x,y,z,w=20,d=14,h=8,tiles='roof'){
    block(x,y-.2,z,w+1.8,.65,d+1.8,'stone');
    block(x,y,z,w,h,d,'white');
    const front=z+d*.505;
    block(x,y+.25,front,w*.92,.5,.35,'red');block(x,y+h-.6,front,w,.45,.35,'red');
    for(let i=-2;i<=2;i++){
      const xx=x+i*w*.18;
      block(xx,y,front+.4,.4,h,.4,'red');
      if(i){block(xx,y+h*.23,front+.16,w*.12,h*.46,.2,'roof');
        for(let bar=-1;bar<=1;bar++)block(xx+bar*w*.035,y+h*.23,front+.31,.1,h*.46,.12,'red');
        block(xx,y+h*.45,front+.31,w*.12,.12,.12,'red');}
    }
    block(x,y+.25,front+.15,w*.13,h*.7,.25,'red');
    block(x,y,front+1.2,w*.23,.25,2.6,'stone');
    for(const side of [-1,1])for(let i=-1;i<=1;i++){
      block(x+side*w*.505,y+h*.3,z+i*d*.25,.2,h*.35,d*.16,'roof');
      block(x+side*w*.51,y+h*.48,z+i*d*.25,.25,.12,d*.16,'red');
    }
    add(roof,tiles,[x,y+h,z],[w+4,8,d+4]);
    block(x,y+h+3.4,z,w*.65,.35,.55,tiles);
    for(const side of [-1,1])add(sphere,tiles,[x+side*w*.32,y+h+3.65,z],[.45,.45,.45]);
    // Raised tile ribs and a second eave read as brush strokes from above.
    for(let i=-5;i<=5;i++)for(const side of [-1,1])beam(
      [x+i*w*.085,y+h+3.3,z],[x+i*w*.085,y+h+.18,z+side*(d+4)*.52],.075,tiles);
    block(x,y+h-.16,front+.65,w+2,.22,.55,tiles);
  }
  function pagoda(x,y,z,levels=7,tiles='bronze'){
    for(let i=0;i<levels;i++){
      const w=12-i*.85;
      block(x,y+i*4,z,w*.7,3.7,w*.7,'red');
      for(const side of [-1,1]){block(x+side*w*.354,y+i*4+1,z,.15,1.4,w*.24,'roof');
        block(x,y+i*4+1,z+side*w*.354,w*.24,1.4,.15,'roof');}
      add(roof,tiles,[x,y+i*4+3,z],[w,4,w]);
    }beam([x,y+levels*4,z],[x,y+levels*4+5,z],.25,'bronze');
  }
  const planting=[];
  function tree(x,z,scale=1){planting.push({x,z,scale});}
  function flatPolygon(ring,mat,y=1.2,holes=[]){
    const shape=new THREE.Shape(ring.map(p=>new THREE.Vector2(p[0],-p[2])));
    holes.forEach(r=>shape.holes.push(new THREE.Path(r.map(p=>new THREE.Vector2(p[0],-p[2])))));
    const g=new THREE.ShapeGeometry(shape);g.rotateX(-Math.PI/2);g.translate(0,y,0);add(g,mat);g.dispose();
  }
  materials.terrain.vertexColors=true;
  const terrainCompile=materials.terrain.onBeforeCompile;
  materials.terrain.onBeforeCompile=shader=>{
    terrainCompile(shader);
    shader.vertexShader='varying vec3 cityGroundPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ncityGroundPoint=position;');
    shader.fragmentShader='varying vec3 cityGroundPoint;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 fieldCell=floor(cityGroundPoint.xz/145.);
      vec2 fieldUV=fract(cityGroundPoint.xz/145.);
      float fieldSeed=fract(sin(dot(fieldCell,vec2(27.13,19.71)))*43758.54);
      float country=smoothstep(900.,1400.,length(cityGroundPoint.xz))*(1.-smoothstep(8.,22.,cityGroundPoint.y));
      float fieldEdge=smoothstep(.07,.11,min(min(fieldUV.x,fieldUV.y),min(1.-fieldUV.x,1.-fieldUV.y)));
      float field=country*fieldEdge*step(.48,fieldSeed);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.43,.41,.20),field*.26);
      float hatchPhase=(fieldSeed>.7?cityGroundPoint.x:cityGroundPoint.z)*1.1;
      float hatch=pow(max(0.,sin(hatchPhase)),9.)*(1.-smoothstep(.4,1.5,fwidth(hatchPhase)));
      diffuseColor.rgb*=1.-field*hatch*.12;
      float contourPhase=cityGroundPoint.y*.5;
      float contour=pow(max(0.,cos(contourPhase)),24.)*(1.-smoothstep(.2,1.5,fwidth(contourPhase)));
      diffuseColor.rgb*=1.-contour*smoothstep(14.,55.,cityGroundPoint.y)*.055;
      float fleckPhase=cityGroundPoint.x*6.+sin(cityGroundPoint.z*4.);
      float fleck=sin(fleckPhase)*cos(cityGroundPoint.z*8.)*(1.-smoothstep(.4,1.4,fwidth(fleckPhase)));
      diffuseColor.rgb*=1.+fleck*.045;`);
  };
  const terrainMesh=new THREE.Mesh(terrain.geometry,materials.terrain);
  terrainMesh.name='Nanjing continuous relief';terrainMesh.castShadow=false;terrainMesh.receiveShadow=true;scene.add(terrainMesh);
  // Paper-coloured surroundings distinguish the municipality from its neighbours.
  const background=new THREE.Mesh(new THREE.PlaneGeometry(100000,100000),
    new THREE.MeshStandardMaterial({color:0xe8e1cd,roughness:1}));
  background.rotation.x=-Math.PI/2;background.position.set(0,-10,1700);scene.add(background);
  rings.forEach(r=>{
    const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(r.map(p=>new THREE.Vector3(p[0],ground(p[0],p[2])+.45,p[2]))),
      new THREE.LineBasicMaterial({color:0xe3ddbd}));scene.add(line);
  });
  const water=new THREE.MeshStandardMaterial({color:0x4d898a,roughness:.36,metalness:.22,side:THREE.DoubleSide});
  paintCityWater(water,shared);
  materials.water=water;
  riverLines.forEach(r=>{const g=ribbon(r.points,r.width,1.31);add(g,'water');g.dispose();});
  lakes.forEach(l=>l.outer.forEach(r=>flatPolygon(r,'water',1.35,l.inner.filter(h=>inRing(h[0][0],h[0][2],r)))));
  function route(points,width=7){return {name:'Scenic walking route',width,points};}
  function loop(x,z,r=38,count=48){return Array.from({length:count+1},(_,i)=>{
    const a=(i/count)*Math.PI*2;return [x+Math.sin(a)*r,Math.max(1.7,ground(x+Math.sin(a)*r,z+Math.cos(a)*r))+.3,z+Math.cos(a)*r];});}
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
      walk=Array.from({length:61},(_,i)=>[x-65+i*2.1,Math.max(1.7,ground(x-65+i*2.1,z))+.3,z]);
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
      const deck=Math.max(p.kind==='eye'?10:14,...Array.from({length:21},(_,i)=>ground(a[0]+(b[0]-a[0])*i/20,b[2]+(a[2]-b[2])*(1-i/20))+3));
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
      for(let i=0;i<24;i++){const yy=base+i*.45,zz=z+58-i*2.1;block(x,yy,zz,16,.5,2.2,'white');
        for(const side of [-1,1]){block(x+side*8.4,yy,zz,.4,1.8,.4,'white');
          add(sphere,'white',[x+side*8.4,yy+1.9,zz],[.35,.35,.35]);
          if(i)beam([x+side*8.4,yy+1.6,zz],[x+side*8.4,yy+1.15,zz+2.1],.16,'white');}}
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
      }walk=Array.from({length:55},(_,i)=>[x,ground(x,z+75-i*1.25)+.35,z+75-i*1.25]);
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
      // Sample the same relief as the bank, so this walk stays above the water.
      const r=lakes.find(l=>l.id===p.id)?.outer[0];
      if(r?.length){
        const start=Math.floor(r.length*.18),end=Math.max(start+2,Math.floor(r.length*.40));
        const shore=[];
        for(let i=start;i<=end;i++){
          const a=r[i%r.length],b=r[(i+1)%r.length],length=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
          let nx=-(b[2]-a[2])/length,nz=(b[0]-a[0])/length;
          if(wet(a[0]+nx*10,a[2]+nz*10)){nx=-nx;nz=-nz;}
          const xx=a[0]+nx*10,zz=a[2]+nz*10;
          if(wet(xx,zz))continue;
          shore.push([xx,Math.max(1.7,ground(xx,zz))+.3,zz]);
        }
        if(shore.length>1)walk=shore;
        const centre=walk[Math.floor(walk.length*.55)];p.position=centre.slice();
        const [sx,,sz]=centre;hall(sx+25,Math.max(1.7,ground(sx+25,sz+20)),sz+20,13,10,7);
        // A scenic balustrade follows the public shoreline's dry side. Its
        // shape is artistic; the paving remains a clear six-unit corridor.
        for(let i=1;i<walk.length;i++){
          const a=walk[i-1],b=walk[i],length=Math.hypot(b[0]-a[0],b[2]-a[2])||1;
          const nx=-(b[2]-a[2])/length,nz=(b[0]-a[0])/length;
          const count=Math.ceil(length/3.5);
          for(let j=0;j<count;j++){
            const f=j/count,g=(j+1)/count,xx=a[0]+(b[0]-a[0])*f+nx*4.2,zz=a[2]+(b[2]-a[2])*f+nz*4.2;
            const bx=a[0]+(b[0]-a[0])*g+nx*4.2,bz=a[2]+(b[2]-a[2])*g+nz*4.2;
            const yy=Math.max(a[1]+(b[1]-a[1])*f,ground(xx,zz)+.1),by=Math.max(a[1]+(b[1]-a[1])*g,ground(bx,bz)+.1);
            block(xx,yy,zz,.42,1.35,.42,'stone');add(sphere,'white',[xx,yy+1.45,zz],[.3,.28,.3]);
            beam([xx,yy+1.05,zz],[bx,by+1.05,bz],.13,'white');beam([xx,yy+.5,zz],[bx,by+.5,bz],.1,'stone');
          }
        }
      }
    }else if(p.kind==='mount'){
      hall(x,y,z,15,12,7);
      walk=Array.from({length:161},(_,i)=>{const t=i/160,a=t*Math.PI*3,r=160*(1-t)+38;
        const xx=x+Math.sin(a)*r,zz=z+Math.cos(a)*r;return [xx,Math.max(1.7,ground(xx,zz))+.35,zz];});
    }
    walk.forEach(pt=>{if(!Number.isFinite(pt[1]))pt[1]=1.5;});
    p.route=routes.length;routes.push({...route(walk),name:p.name});
    const spawnIndex=p.kind==='mount'?walk.reduce((best,pt,i)=>pt[1]>walk[best][1]?i:best,0):Math.floor(walk.length*.18);
    p.spawn=walk[spawnIndex].slice();p.spawn[1]+=1.7;
    const headingIndex=spawnIndex>walk.length-7?spawnIndex-6:spawnIndex+6;
    p.look=p.kind==='mount'?walk[headingIndex].slice():p.position.slice();
    // A downhill bend can be far below the eye. Enter looking along its heading
    // with a level horizon, rather than staring into the immediate ground.
    if(p.kind==='mount')p.look[1]=p.spawn[1]-.3;else p.look[1]+=p.kind==='skyline'?25:5;
    if(p.kind!=='mausoleum'){const path=ribbon(walk,6,.04),vertices=path.attributes.position;
      if(!['wall','truss','cable','eye'].includes(p.kind))for(let i=0;i<vertices.count;i++)vertices.setY(i,Math.max(vertices.getY(i),ground(vertices.getX(i),vertices.getZ(i))+.16));
      path.computeVertexNormals();add(path,'stone');path.dispose();}
    if(!['truss','cable','eye','wall','mausoleum'].includes(p.kind))for(let i=7;i<walk.length;i+=18){
      const [px,py,pz]=walk[i],next=walk[Math.min(walk.length-1,i+1)],yaw=Math.atan2(next[0]-px,next[2]-pz);
      const bx=px+Math.cos(yaw)*5.4,bz=pz-Math.sin(yaw)*5.4,by=Math.max(1.7,ground(bx,bz));
      block(bx,by+.7,bz,2.6,.18,.7,'bark',yaw);
      for(const side of [-1,1])block(bx+Math.cos(yaw)*side*.9,by,bz-Math.sin(yaw)*side*.9,.16,.7,.5,'glass');
      block(bx,by+1.2,bz,2.6,.55,.13,'bark',yaw);
      const lx=px-Math.cos(yaw)*6,lz=pz+Math.sin(yaw)*6,ly=Math.max(1.7,ground(lx,lz));
      block(lx,ly,lz,.15,4,.15,'glass');add(sphere,'glow',[lx,ly+4,lz],[.32,.4,.32]);
    }
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
  for(let i=0;i<1800;i++){
    const gx=Math.floor((random()-.5)*15)*100,gz=Math.floor((random()-.5)*13)*100;
    const x=gx+18+random()*65,z=gz+18+random()*65;
    if(wet(x,z)||terrain.relief(x,z)>8||places.some(p=>Math.hypot(x-p.position[0],z-p.position[2])<95))continue;
    const h=5+random()**2*22,w=8+random()*9,d=8+random()*9,base=ground(x,z);
    block(x,base,z,w,h,d,i%4?'white':'glass');
    if(h<14){
      block(x,base-.1,z,w+1,.3,d+1,'stone');add(roof,'roof',[x,base+h,z],[w+2,3.2,d+2]);
      block(x,base+h+1.3,z,w*.66,.22,.32,'roof');
      for(const side of [-1,1]){block(x+side*w*.25,base+1.7,z+d*.51,w*.15,1.6,.15,'glass');
        block(x+side*w*.25,base+2.5,z+d*.52,w*.17,.12,.18,'white');}
      block(x,base,z+d*.51,1.2,2.6,.2,'red');
      if(i%3===0){
        const xx=x+w+5,bz=z+d*.2;
        if(!wet(xx,bz)&&terrain.relief(xx,bz)<8){
          const yy=ground(xx,bz);block(xx,yy,bz,w*.65,5,d*.85,'white');
          add(roof,'roof',[xx,yy+5,bz],[w*.65+2,3,d*.85+2]);
          block(x+w*.8,base,z-d*.5,w,.85,.35,'stone');tree(x+w*.65,z+d*.8,.55);
        }
      }
    }
    else{block(x,base+h,z,w+1,.45,d+1,'stone');
      for(let level=2;level<h-1;level+=3)block(x,base+level,z+d*.505,w*.8,.55,.1,'glass');}
  }
  for(let i=-6;i<=6;i++){
    const a=[[i*100,1.25,-650],[i*100,1.25,650]],b=[[-700,1.25,i*100],[700,1.25,i*100]];
    for(const line of [a,b]){
      const pieces=[];for(let j=0;j<=80;j++){
        const f=j/80,x=line[0][0]+(line[1][0]-line[0][0])*f,z=line[0][2]+(line[1][2]-line[0][2])*f;
        if(wet(x,z)||terrain.relief(x,z)>10||places.some(p=>Math.hypot(x-p.position[0],z-p.position[2])<75)){
          if(pieces.length>1){const g=ribbon(pieces,4,.08);add(g,'stone');g.dispose();}pieces.length=0;
        }else pieces.push([x,ground(x,z)+.35,z]);
      }if(pieces.length>1){const g=ribbon(pieces,4,.08);add(g,'stone');g.dispose();}
    }
  }
  const landscape=createCityLandscape({terrain,places,routes,riverLines,materials,planting,shared,scene});
  const meshes=[];
  batches.forEach((geos,key)=>{
    const merged=mergeGeometries(geos);geos.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(merged,materials[key]);mesh.name=`Nanjing atlas | ${key}`;
    mesh.receiveShadow=key!=='water';mesh.castShadow=false;scene.add(mesh);meshes.push(mesh);
    if(['roof','blue','white','red'].includes(key)){
      const strokes=new THREE.LineSegments(new THREE.EdgesGeometry(merged,38),
        new THREE.LineBasicMaterial({color:0x344f48,transparent:true,opacity:.28}));
      strokes.name='Illustration contour | '+key;scene.add(strokes);
    }
  });geometryCache.forEach(g=>g.dispose());
  return {scene,places,routes,ground,rings,riverLines,materials,
    terrain,landscape,
    triangleCount:terrain.stats.terrainTriangles+meshes.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0)+landscape.stats.totalTriangles};
}
