import * as THREE from "three";
import {mergeGeometries} from "three/addons/utils/BufferGeometryUtils.js";
import {cityPoint,inRing,ribbon,distanceToLine,cityRiverSurfaces} from "./city-geography.js";
import {createCityTerrain,AXIS} from './city-terrain.js';
import {createCityLandscape} from './city-landscape.js';
import {paintCityWater} from './city-art.js';
import {landmarkDetails,bridgeDetails,archWall} from './city-landmarks.js';
import {randomSeed} from "./forest-geometry.js";
import {planAvenue,loopFrom,framingDistance,arrivalLook,EXTENT} from './city-arrival.js';
import {buildRoadNetwork,shoreWalk,bakedRoadsMatch,roadComponents} from './city-network.js';
import {buildVista} from './city-sets.js';

/**
 * A walkway laid on the terrain. Each cross-section is level at the height of its
 * centre line: following the terrain under both edges made the road a tilted slab
 * on a hillside (Xiaoling's started with one edge 5 m above the camera and filled
 * the screen). The hill beside it simply rises above the road, like a cutting.
 */
function bedRibbon(points,width,ground,lift=.16){
  const g=ribbon(points,width,.04),v=g.attributes.position;
  points.forEach((q,i)=>{const y=ground(q[0],q[2])+lift;v.setY(i*2,y);v.setY(i*2+1,y);});
  g.computeVertexNormals();return g;
}
export function buildCityScene(data, shared, makeMaterial, options = {}) {
  const buildStart=performance.now();
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xa8d0ea,.00003);
  const places=data.landmarks.map(p=>({...p,position:cityPoint(p.coord,data)}));
  const rings=data.boundary.map(r=>r.map(p=>cityPoint(p,data)));
  const riverLines=cityRiverSurfaces(data);
  const lakes=data.lakes.map(l=>({...l,outer:l.outer.map(r=>r.map(p=>cityPoint(p,data))),inner:l.inner.map(r=>r.map(p=>cityPoint(p,data)))}));
  const terrain=createCityTerrain(places,riverLines,lakes,rings),{hills,ground,wet}=terrain;
  const materials={
    terrain:makeMaterial('City relief paper',[1,1,1]),
    // A hand-painted storybook palette: warm cream plaster, verdigris-teal roofs,
    // vermilion lacquer and gold trim, under a deep blue sky.
    stone:makeMaterial('City warm stone',[.80,.74,.60]),
    white:makeMaterial('City lime plaster',[.97,.91,.76]),
    roof:makeMaterial('City dark tiled roof',[.20,.47,.43]),
    red:makeMaterial('City red timber',[.70,.20,.13]),
    blue:makeMaterial('City blue glazed roof',[.17,.42,.60]),
    ochre:makeMaterial('City ochre plaster',[.94,.70,.28]),
    gold:makeMaterial('City imperial yellow glazed roof',[.93,.72,.22]),
    brick:makeMaterial('City grey warm stone brick',[.60,.60,.55]),
    wall:makeMaterial('City vermilion wall',[.88,.33,.20]),
    bronze:makeMaterial('City bronze fixture',[.86,.64,.24]),
    glass:makeMaterial('City blue glass',[.40,.62,.70]),
    bark:makeMaterial('City bark',[.34,.27,.19]),
    leaf:makeMaterial('City foliage',[1,1,1]),
    canopy:makeMaterial('City distant canopy',[.36,.62,.42]),
    sage:makeMaterial('City meadow sage',[.50,.68,.34]),
    canopyMaple:makeMaterial('City distant canopy maple',[.86,.24,.10]),
    canopyPlane:makeMaterial('City distant canopy plane',[.92,.68,.18]),
    paleBark:makeMaterial('City pale bark',[.80,.78,.70]),
    plank:makeMaterial('City plank bark',[.58,.38,.22]),
    pink:makeMaterial('City peach plaster',[.96,.68,.56]),
    slate:makeMaterial('City slate tiled roof',[.26,.30,.33]),
    asphalt:makeMaterial('City asphalt',[.31,.32,.35]),
    lotus:makeMaterial('City lotus leaf',[.18,.54,.28]),
    blossom:makeMaterial('City lotus blossom',[.98,.58,.70]),
    glow:new THREE.MeshStandardMaterial({color:0xda6944,emissive:0xff6725,emissiveIntensity:.35,roughness:.8}),
    lamp:new THREE.MeshStandardMaterial({color:0xfff0cf,emissive:0xffd88a,emissiveIntensity:.55,roughness:.7}),
  };
  const batches=new Map(),geometryCache=new Map(),random=randomSeed(20261005);
  function add(geometry,mat='stone',position=[0,0,0],scale=[1,1,1],yaw=0){
    const g=geometry.clone(),m=new THREE.Matrix4().compose(new THREE.Vector3(...position),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(...scale));
    g.applyMatrix4(m);const ready=g.index?g.toNonIndexed():g;
    if(ready!==g)g.dispose();
    const pos=ready.attributes.position,norm=ready.attributes.normal,uv=[],density=mat==='stone'||mat==='brick'?.32:mat==='roof'||mat==='blue'||mat==='gold'||mat==='slate'?.18:.08;
    for(let i=0;i<pos.count;i++){
      const nx=Math.abs(norm.getX(i)),ny=Math.abs(norm.getY(i)),nz=Math.abs(norm.getZ(i));
      if(ny>=nx&&ny>=nz)uv.push(pos.getX(i)*density,pos.getZ(i)*density);
      else if(nx>=nz)uv.push(pos.getZ(i)*density,pos.getY(i)*density);
      else uv.push(pos.getX(i)*density,pos.getY(i)*density);
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
    const xs=[-.62,-.50,-.34,0,.34,.50,.62],zs=[-.58,-.46,-.30,-.14,0,.14,.30,.46,.58];
    const height=(x,z)=>.48*(1-Math.abs(z)/.58)**1.55*(Math.abs(x)>.34?(.62-Math.abs(x))/.28:1)
      +.13*(Math.abs(x)/.62)**6*(Math.abs(z)/.58)**4;
    for(let i=0;i<xs.length-1;i++)for(let j=0;j<zs.length-1;j++){
      const a=[xs[i],height(xs[i],zs[j]),zs[j]],b=[xs[i+1],height(xs[i+1],zs[j]),zs[j]],
        c=[xs[i],height(xs[i],zs[j+1]),zs[j+1]],d=[xs[i+1],height(xs[i+1],zs[j+1]),zs[j+1]];
      vertices.push(...a,...c,...b,...b,...c,...d);
    }g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
  });
  // Stone footing under a building: reaches down to the lowest ground under the
  // footprint, so no corner hangs in the air if the ground is not perfectly level.
  function groundRange(x,z,w,d){
    let lo=Infinity,hi=-Infinity;
    for(const u of [-.5,0,.5])for(const v of [-.5,0,.5]){const y=ground(x+u*w,z+v*d);lo=Math.min(lo,y);hi=Math.max(hi,y);}
    return [lo,hi];
  }
  // A red paper lantern with brass caps: the one prop that makes a street feel inhabited.
  function lantern(x,y,z,s=1){
    add(sphere,'glow',[x,y,z],[.4*s,.55*s,.4*s]);
    block(x,y+.5*s,z,.34*s,.1*s,.34*s,'bronze');block(x,y-.62*s,z,.3*s,.1*s,.3*s,'bronze');
  }
  function footing(x,z,w,d,top,yaw=0){
    let lo=Infinity;const c=Math.cos(yaw),s=Math.sin(yaw);
    for(let i=0;i<=4;i++)for(let j=0;j<=4;j++){const u=(i/4-.5)*w,v=(j/4-.5)*d;lo=Math.min(lo,ground(x+u*c+v*s,z-u*s+v*c));}
    if(top-lo>.25)block(x,lo-.6,z,w,top-lo+.6,d,'stone',yaw);
  }
  function hall(x,y,z,w=20,d=14,h=8,tiles='roof'){
    footing(x,z,w+1.8,d+1.8,y);
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
  function tree(x,z,scale=1,species=null,opts={}){planting.push({x,z,scale,species,force:!!opts.force,tint:opts.tint});}
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
  // Painted name boards. Gold characters on a dark ground are how these places
  // announce themselves in every photograph, and cost one small quad each.
  const plaqueTextures=new Map();
  function plaque(text,{x,y,z,w=8,h=2,yaw=0,bg='#6e2a1f',fg='#e3bd62'}){
    const key=`${text}|${bg}|${fg}|${w}x${h}`;
    let texture=plaqueTextures.get(key);
    if(!texture){
      const c=document.createElement('canvas');c.width=512;c.height=Math.max(64,Math.round(512*h/w));
      const g=c.getContext('2d');g.fillStyle=bg;g.fillRect(0,0,c.width,c.height);
      g.strokeStyle=fg;g.lineWidth=5;g.strokeRect(7,7,c.width-14,c.height-14);
      let size=Math.floor(c.height*.64);const face=n=>`bold ${n}px "Songti SC","SimSun","Noto Serif CJK SC",serif`;
      g.font=face(size);while(g.measureText(text).width>c.width-48&&size>18){size-=4;g.font=face(size);}
      g.fillStyle=fg;g.textAlign='center';g.textBaseline='middle';g.fillText(text,c.width/2,c.height/2+size*.05);
      texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;plaqueTextures.set(key,texture);
    }
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:texture,roughness:.55,side:THREE.DoubleSide}));
    mesh.position.set(x,y,z);mesh.rotation.y=yaw;mesh.name=`Plaque | ${text}`;scene.add(mesh);return mesh;
  }
  const routes=[];
  // Pagodas, towers and temples only have a loop walk when their bespoke model exists.
  const bespokeOrLoop=p=>['domes','skyline','palace'].includes(p.kind)||['yuejiang','jiming','qixia'].includes(p.id);
  places.forEach(p=>{
    const [x,,z]=p.position,y=ground(x,z);p.position[1]=y;
    let walk=loop(x,z,p.kind==='mount'?70:p.kind==='oldtown'?43:36);
    const bespoke=landmarkDetails(p,{add,block,beam,hall,roof,sphere,ground,tree,plaque,cylinder,footing});
    if(p.kind==='oldtown'&&p.id!=='qinhuai'){
      // A compact district vignette exaggerates alleys and waterfront space.
      // It evokes the photo references; these are not individual surveyed homes.
      for(let row=-1;row<=1;row+=2)for(let i=-3;i<=3;i++){
        const bx=x+i*17,bz=z+row*19;hall(bx,ground(bx,bz),bz,13,11,6);
        for(const side of [-1,1])add(sphere,'glow',[bx+side*4,ground(bx,bz)+5,bz-row*6],[.45,.7,.45]);
      }
      // Strings of red lanterns hung along the street, sagging between the eaves.
      for(const rowSide of [-1,1]){
        const zz=z+rowSide*10.5;let prev=null;
        for(let k=0;k<=20;k++){
          const lx=x-60+k*6,ly=y+6.4-(k%2?.7:0);
          if(prev)beam(prev,[lx,ly+.45,zz],.04,'bronze');
          lantern(lx,ly,zz,.9);prev=[lx,ly+.45,zz];
        }
      }
      if(p.id!=='mendong'){
        // North of the street: Mendong's street runs along this one's southern side, 41 m away,
        // and the canal used to cross it (the lantern boats sat on Mendong's spawn point).
        const canal=ribbon([[x-75,y,z-40],[x,y,z-44],[x+66,y,z-39]],10,.14);add(canal,'water');canal.dispose();
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
      else if(p.bridgePath){a=cityPoint(p.bridgePath[9],data);b=cityPoint(p.bridgePath.at(-1),data);}
      const length=Math.hypot(b[0]-a[0],b[2]-a[2]),yaw=Math.atan2(b[0]-a[0],b[2]-a[2]);
      const deck=Math.max(p.kind==='eye'?10:14,...Array.from({length:21},(_,i)=>ground(a[0]+(b[0]-a[0])*i/20,b[2]+(a[2]-b[2])*(1-i/20))+3));
      block((a[0]+b[0])/2,deck-1,(a[2]+b[2])/2,10,1,length,'stone',yaw);
      function bp(t,side=0,h=deck){const px=a[0]+(b[0]-a[0])*t,pz=a[2]+(b[2]-a[2])*t;
        return [px+Math.cos(yaw)*side,h,pz-Math.sin(yaw)*side];}
      for(let i=0;i<=10;i++){
        const t=i/10,pos=bp(t);if(p.kind!=='eye')block(pos[0],1.2,pos[2],4,deck-1.2,5,'stone',yaw);
        for(const side of [-1,1]){
          beam(bp(t,side*5,deck+1),bp(Math.min(1,t+.1),side*5,deck+1),.18,'white');
          if(p.kind==='truss'&&i<10){beam(bp(t,side*4,deck-1),bp(t+.1,side*4,deck-6),.45,'glass');
            beam(bp(t,side*4,deck-6),bp(t+.1,side*4,deck-1),.45,'glass');}
        }
      }
      // (No tall pylons beside the deck: in the photographs the road rides on top of the
      // steel truss, and the only things that rise above it are the bridgehead towers.)
      bridgeDetails(p.kind,bp,deck,{beam,block,add,roof,sphere});
      // The truss bridge is walked down its middle: the lamp posts and rails stand on both edges,
      // and a lane 3.6 m off-centre put a lamp post a metre from the lens.
      walk=Array.from({length:81},(_,i)=>bp(i/80,p.kind==='truss'?0:3.6,deck+.03));p.position=[x,deck,z];
    }else if(p.kind==='wall'){
      // Through the four gates, which is the experience: the earlier walk stood
      // on the battlements looking at crenellations. Start outside, in front of
      // the great arch, and pass under each successive gate.
      walk=Array.from({length:70},(_,i)=>{const zz=z+125-i*2;return [x,Math.max(1.7,ground(x,zz))+.3,zz];});
    }else if(p.kind==='mausoleum'){
      const mx=x+AXIS.du,mz=z+AXIS.dv;   // the axis stands on the plateau (see AXIS in city-terrain.js)
      const base=ground(mx,mz+58);
      for(let i=0;i<24;i++){const yy=base+i*.45,zz=mz+58-i*2.1;block(mx,yy,zz,16,.5,2.2,'white');
        for(const side of [-1,1]){block(mx+side*8.4,yy,zz,.4,1.8,.4,'white');
          add(sphere,'white',[mx+side*8.4,yy+1.9,zz],[.35,.35,.35]);
          if(i)beam([mx+side*8.4,yy+1.6,zz],[mx+side*8.4,yy+1.15,zz+2.1],.16,'white');}}
      // White memorial hall with three portals and blue hip roofs.
      const hallY=base+10.8;
      block(mx,hallY,mz+3,27,10,14,'white');
      const facade=archWall(27,10,2,[-8,0,8].map(v=>({x:v,r:2.3,spring:4.2})));
      add(facade,'white',[mx,hallY,mz+11.5]);facade.dispose();
      for(const dx of [-8,0,8])block(mx+dx,hallY,mz+10.1,3.8,6.4,.25,'roof');
      add(roof,'blue',[mx,hallY+10,mz+3],[32,8,21]);
      block(mx,hallY+6,mz-8,16,9,9,'white');add(roof,'blue',[mx,hallY+15,mz-8],[22,7,14]);
      block(mx,hallY+8,mz+12.6,8,1.4,.3,'blue');
      for(const dx of [-12,12])block(mx+dx,hallY,mz+12.3,1,10,1,'white');
      block(mx,base,mz+61,16,.12,8,'white');
      // Stop outside the main hall; keep the steps visible rather than paving over them.
      walk=[...Array.from({length:36},(_,i)=>{const zz=mz+100-i;return [mx,Math.max(1.7,ground(mx,zz))+.3,zz];}),
        ...Array.from({length:50},(_,i)=>[mx,base+Math.max(0,Math.ceil((i-7)/2.1))*.45+.18,mz+65-i])];
    }else if(p.kind==='domes'){
      walk=loop(x,z,85);
    }else if(p.kind==='skyline'){
      walk=loop(x,z,58);
      // Bespoke triangular glass masses replace the generic stack.
    }else if(['pagoda','tower','temple'].includes(p.kind)){
      if(bespoke){walk=loop(x,z,p.id==='jiming'?52:48);}
      else if(p.kind==='tower')for(let i=0;i<4;i++)hall(x,y+i*7,z,28-i*4,22-i*3,6,'bronze');
      else{pagoda(x,y,z,p.kind==='temple'?5:7,p.kind==='temple'?'roof':'bronze');hall(x-20,ground(x-20,z+16),z+16,20,14,8);}
    }else if(p.kind==='tomb'){
      if(!bespoke)hall(x,y,z,25,17,10,'red');
      for(let i=0;i<8;i++){
        const xx=x+(i%2?13:-13),zz=z+25+Math.floor(i/2)*14,yy=ground(xx,zz);
        add(sphere,'stone',[xx,yy+2.3,zz],[2,2,3]);add(sphere,'stone',[xx,yy+3,zz-2],[1.2,1.4,1]);
        for(const dx of [-1,1])for(const dz of [-1,1])block(xx+dx,yy,zz+dz*1.7,.65,2,.65,'stone');
      }walk=Array.from({length:55},(_,i)=>[x,ground(x,z+75-i*1.25)+.35,z+75-i*1.25]);
    }else if(p.kind==='palace'){
      walk=loop(x,z,62);
      // Arched neoclassical entrance and garden halls are emitted above.
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
        // A smoothed promenade; Xuanwu is a long lake, Mochou a small one.
        const arc=p.id==='xuanwu'?{from:.40,to:.64}:{from:.30,to:.78};
        const shore=shoreWalk(r,{...arc,offset:11,wet,ground});
        if(shore.length>1)walk=shore;
        const centre=walk[Math.floor(walk.length*.55)];p.position=centre.slice();
        // Keep the lake approach open; an invented pavilion previously enclosed the arrival.
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
            if(j%4===0){let tx=xx+nx*12,tz=zz+nz*12;if(wet(tx,tz)){tx=xx-nx*12;tz=zz-nz*12;}tree(tx,tz,.9,2);}
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
    // Composed views (city-sets.js): the place is rebuilt to the framing of its best photograph and
    // brings its own walk, so it skips the generic avenue below.
    const vista=buildVista(p,{walk,add,block,beam,hall,roof,sphere,cylinder,ground,wet,tree,plaque,lantern,footing,random,ribbon,places,shore:terrain.shore,
      pave:(pts,width,mat='stone',lift=.16)=>{const g=bedRibbon(pts,width,ground,lift);add(g,mat);g.dispose();}});
    p.vista=vista?{weather:vista.weather,season:vista.season,autumn:vista.autumn||null}:null;
    p.boats=vista?.boats||null;
    if(vista?.walk)walk=vista.walk;
    // Loop-shaped walks begin tangent to the landmark, so the camera used to
    // face 90° off the road. Prefix a straight avenue that points at it.
    const LOOP_RADIUS={domes:85,skyline:58,palace:62,pagoda:p.id==='jiming'?52:48,tower:48,temple:48};
    p.avenue=null;
    if(!vista?.walk&&LOOP_RADIUS[p.kind]&&bespokeOrLoop(p)){
      const radius=LOOP_RADIUS[p.kind],distance=framingDistance(p.id);
      const avoid=places.filter(q=>q!==p).map(q=>[q.position[0],q.position[2],(LOOP_RADIUS[q.kind]||40)+14]);
      // Prefer an approach from which the landmark is visible, not hidden behind a crest.
      const plan=planAvenue({x,z,radius,distance,ground,wet,avoid,targetY:ground(x,z)+(EXTENT[p.id]?.h||30)*.4});
      if(plan){
        const loopWalk=loopFrom({x,z,radius,bearing:plan.bearing,ground});
        walk=[...plan.points,...loopWalk.slice(1)];p.avenue={bearing:plan.bearing,length:plan.points.length*2,far:plan.far,junction:plan.junction,count:plan.points.length,visible:plan.visible};
      }
    }
    walk.forEach(pt=>{if(!Number.isFinite(pt[1]))pt[1]=1.5;});
    p.route=routes.length;routes.push({...route(walk),name:p.name});
    const frontEntry=['palace','zifeng','niushou','qixia'].includes(p.id);
    const spawnIndex=vista?.walk?(vista.spawnIndex??0):p.avenue?0:p.kind==='wall'?0:p.kind==='truss'?0:p.kind==='eye'?0:['zhongshan','xiaoling'].includes(p.id)?0:p.id==='qixia'?20:frontEntry?0:p.kind==='lake'?0:p.kind==='mount'?walk.reduce((best,pt,i)=>pt[1]>walk[best][1]?i:best,0):Math.floor(walk.length*.18);
    p.spawn=walk[spawnIndex].slice();p.spawn[1]=Math.max(p.spawn[1]+1.7,ground(p.spawn[0],p.spawn[2])+2.05);
    const headingIndex=spawnIndex>walk.length-7?spawnIndex-6:spawnIndex+6;
    p.look=p.kind==='mount'?walk[headingIndex].slice():p.position.slice();
    // A downhill bend can be far below the eye. Enter looking along its heading
    // with a level horizon, rather than staring into the immediate ground.
    if(['truss','cable','eye'].includes(p.kind)){p.look=walk[Math.min(spawnIndex+(p.kind==='eye'?50:12),walk.length-1)].slice();p.look[1]=p.spawn[1]+(p.kind==='eye'?4:.4);
      if(p.kind==='truss'){p.look=walk.at(-1).slice();p.look[1]=p.spawn[1]+18;}}
    else if(p.avenue||p.kind==='wall'){
      // The road runs straight at the landmark: look at it, at about half height.
      p.look=p.kind==='wall'?[x,y+EXTENT.zhonghua.h*.45,z+30]:arrivalLook(p.id,p.position,ground);
    }
    else if(p.kind==='lake'){p.look=walk[Math.min(spawnIndex+14,walk.length-1)].slice();p.look[1]=p.spawn[1]+.5;}
    else if(p.kind==='mount')p.look[1]=p.spawn[1]-.3;else p.look[1]+=p.kind==='skyline'?48:5;
    if(vista?.walk){
      let k=spawnIndex;while(k<walk.length-1&&Math.hypot(walk[k][0]-p.spawn[0],walk[k][2]-p.spawn[2])<(vista.lookAhead||40))k++;
      const ahead=walk[k];
      p.look=vista.lookAt?vista.lookAt.slice():[ahead[0],p.spawn[1]+(vista.lookDy??0),ahead[2]];
    }
    // An approach that descends to the landmark (Xiaoling's road starts 26 m above
    // the tomb) used to pitch the camera 15 degrees down onto bare hillside. Look
    // no more than a few metres below the eye, so the building stays in view.
    if(p.kind!=='mount')p.look[1]=Math.max(p.look[1],p.spawn[1]-3);
    if(p.kind==='mausoleum'){
      // The stairs are the path; only the approach through the archway needs one.
      const approach=bedRibbon(walk.slice(0,37),7,ground);add(approach,'stone');approach.dispose();
    }
    if(p.kind!=='mausoleum'&&!vista?.walk){
      const path=['wall','truss','cable','eye'].includes(p.kind)?ribbon(walk,6,.04):bedRibbon(walk,6,ground);
      path.computeVertexNormals();add(path,'stone');path.dispose();}
    if(!vista?.walk&&!['truss','cable','eye','wall','mausoleum'].includes(p.kind))for(let i=7;i<walk.length;i+=18){
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
  // Streets between neighbouring landmarks. The atlas is drawn at scale 0.065, so
  // the old-city landmarks are walkable neighbours; this joins them up. Added
  // before the generic blocks and hill trees so those keep clear of the roads.
  const noRoad=new Set(['truss','cable','eye']);
  const nodes=places.filter(p=>p.id!=='mufu'&&!noRoad.has(p.kind)).map(p=>{const w=routes[p.route].points[0];return {id:p.id,x:w[0],z:w[2]};});
  const cores=[];
  places.forEach(p=>{
    const [px,,pz]=p.position;
    if(p.avenue||p.kind==='mount')cores.push([px,pz,(({domes:85,skyline:58,palace:62,mount:40}[p.kind])||48)*.85]);
    else if(p.id==='qinhuai')cores.push([px+10,pz-62,46]);
    else if(p.kind==='oldtown'){for(let i=-3;i<=3;i++)for(const row of [-1,1])cores.push([px+i*17,pz+row*19,11]);cores.push([px+82,pz-45,16]);}
    else if(p.kind==='wall')cores.push([px,pz+33,52]);
    else if(p.kind==='mausoleum')cores.push([px+AXIS.du,pz+AXIS.dv+3,26]);
    else if(p.kind==='tomb'){cores.push([px,pz+5,24]);cores.push([px,pz+40,22]);}
  });
  // Baked roads (tools/research/build-roads.mjs) are used only if every node is still
  // where it was when they were made; otherwise compute them here, which is correct but
  // costs seconds of main-thread time at load.
  const roadStart=performance.now();
  let network;
  if(bakedRoadsMatch(options.roads,nodes)){
    const byId=new Map(nodes.map(n=>[n.id,n]));
    const roads=options.roads.roads.map(r=>{
      const points=r.points.map(q=>q.slice()),a=byId.get(r.a),b=byId.get(r.b);
      points[0][0]=a.x;points[0][2]=a.z;points.at(-1)[0]=b.x;points.at(-1)[2]=b.z;   // exact joins
      return {...r,points};
    });
    network={roads,components:roadComponents(nodes,roads),source:'baked'};
  }else{
    network={...buildRoadNetwork({nodes,polylines:routes.map(r=>r.points),cores,ground,wet}),source:options.roads?'computed (baked roads were stale)':'computed'};
  }
  console.info(`[city] ${network.roads.length} roads from ${network.source} in ${Math.round(performance.now()-roadStart)} ms (${network.components} components)`);
  const roadRoutes=[];
  network.roads.forEach(r=>{
    const a=places.find(q=>q.id===r.a),b=places.find(q=>q.id===r.b);
    const roadRoute={...route(r.points,7),name:`${a.name} — ${b.name}`,road:true,ends:[r.a,r.b]};
    roadRoutes.push(roadRoute);routes.push(roadRoute);
    const path=bedRibbon(r.points,5.6,ground);add(path,'stone');path.dispose();
    for(let i=9;i<r.points.length-6;i+=14){
      const [px,,pz]=r.points[i],next=r.points[i+1],yaw=Math.atan2(next[0]-px,next[2]-pz);
      const side=i%28===9?1:-1,lx=px+Math.cos(yaw)*side*3.6,lz=pz-Math.sin(yaw)*side*3.6,ly=Math.max(1.7,ground(lx,lz));
      const ex=px+Math.cos(yaw)*side*1.3,ez=pz-Math.sin(yaw)*side*1.3;
      block(lx,ly,lz,.17,4.6,.17,'red');beam([lx,ly+4.4,lz],[ex,ly+4.7,ez],.08,'red');lantern(ex,ly+4.0,ez,1);
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
    if(wet(x,z)||terrain.relief(x,z)>8||routes.some(r=>distanceToLine(x,z,r.points)<30)||places.some(p=>Math.hypot(x-p.position[0],z-p.position[2])<95))continue;
    const old=places.find(p=>p.id==='qinhuai').position,modern=places.find(p=>p.id==='zifeng').position;
    const historic=Math.hypot(x-old[0],z-old[2])<280,cbd=Math.hypot(x-modern[0],z-modern[2])<180;
    const h=historic?4+random()*5:cbd?18+random()**2*43:5+random()**2*22,w=8+random()*9,d=8+random()*9;
    // Stand on level ground only: a block placed by its centre height used to hang off one
    // corner and sink into the other on a slope.
    const [lo,hi]=groundRange(x,z,w+2,d+2);
    if(hi-lo>1.4)continue;
    const base=lo;
    block(x,base-.6,z,w+.7,.9,d+.7,'stone');
    // Warm plaster and vermilion in the old town and suburbs; glass only in the new centre.
    const fabric=cbd?(i%3?'glass':'white'):['white','white','ochre','wall','white'][i%5];
    block(x,base,z,w,h,d,fabric);
    if(h<14||!cbd){
      block(x,base-.1,z,w+1,.3,d+1,'stone');add(roof,'roof',[x,base+h,z],[w+2,3.2,d+2]);
      block(x,base+h+1.3,z,w*.66,.22,.32,'roof');
      for(const side of [-1,1]){block(x+side*w*.25,base+1.7,z+d*.51,w*.15,1.6,.15,'glass');
        block(x+side*w*.25,base+2.5,z+d*.52,w*.17,.12,.18,'white');}
      block(x,base,z+d*.51,1.2,2.6,.2,'red');
      if(i%3===0){
        const xx=x+w+5,bz=z+d*.2;
        if(!wet(xx,bz)&&terrain.relief(xx,bz)<8&&(([l,h2])=>h2-l<=1.4)(groundRange(xx,bz,w*.65+2,d*.85+2))){
          const yy=groundRange(xx,bz,w*.65+2,d*.85+2)[0];block(xx,yy-.6,bz,w*.65+.6,.8,d*.85+.6,'stone');block(xx,yy,bz,w*.65,5,d*.85,'white');
          add(roof,'roof',[xx,yy+5,bz],[w*.65+2,3,d*.85+2]);
          block(x+w*.8,base,z-d*.5,w,.85,.35,'stone');tree(x+w*.65,z+d*.8,.55);
        }
      }
    }
    else{block(x,base+h,z,w+1,.45,d+1,'stone');
      for(let level=2;level<h-1;level+=3)block(x,base+level,z+d*.505,w*.8,.55,.1,'glass');}
    if(h>=14&&!cbd){
      // A second, narrower storey under its own roof: a tiered tower house, not a slab.
      block(x,base+h,z,w*.6,4,d*.6,fabric);add(roof,'roof',[x,base+h+4,z],[w*.6+2.4,2.8,d*.6+2.4]);
      for(let level=3.2;level<h-1;level+=3.6)for(const side of [-1,1])block(x+side*w*.22,base+level,z+d*.505,w*.18,1.5,.12,'glass');
    }
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
  console.info(`[city] scene geometry ready ${Math.round(performance.now()-buildStart)} ms in`);
  const landscape=createCityLandscape({terrain,places,routes,riverLines,materials,planting,shared,scene});
  const meshes=[];
  batches.forEach((geos,key)=>{
    const merged=mergeGeometries(geos);geos.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(merged,materials[key]);mesh.name=`Nanjing atlas | ${key}`;
    mesh.receiveShadow=key!=='water';mesh.castShadow=false;scene.add(mesh);meshes.push(mesh);
    if(['roof','blue','white','red','ochre'].includes(key)){
      const strokes=new THREE.LineSegments(new THREE.EdgesGeometry(merged,38),
        new THREE.LineBasicMaterial({color:0x344f48,transparent:true,opacity:.28}));
      strokes.name='Illustration contour | '+key;scene.add(strokes);
    }
  });geometryCache.forEach(g=>g.dispose());
  return {scene,places,routes,ground,rings,riverLines,materials,
    terrain,landscape,roads:network.roads,roadRoutes,roadNodes:nodes,network:{components:network.components,roads:network.roads.length,source:network.source},
    triangleCount:terrain.stats.terrainTriangles+meshes.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0)+landscape.stats.totalTriangles};
}
