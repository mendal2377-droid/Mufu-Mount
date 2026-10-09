import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {randomSeed} from './forest-geometry.js';
import {distanceToLine} from './city-geography.js';
import {paintedCrown,canopyInterior} from './city-art.js';

// Bounded instancing keeps a whole illustrated city affordable. Close trees
// have branches and layered crowns; aerial woodland uses smaller prototypes.
export function createCityLandscape({terrain,places,routes,riverLines,materials,planting,shared,scene}){
  const random=randomSeed(83419),{ground,wet,contains,shore}=terrain;
  const matrix=new THREE.Matrix4(),quat=new THREE.Quaternion(),up=new THREE.Vector3(0,1,0);
  const groups=[],trees=[],grass=[],flowers=[],rocks=[];
  const blocked=(x,z,margin=8)=>routes.some(r=>distanceToLine(x,z,r.points)<margin);
  const occupied=(x,z)=>places.some(p=>!['mount','lake'].includes(p.kind)&&Math.hypot(x-p.position[0],z-p.position[2])<32);
  const entranceClear=(x,z)=>places.some(p=>p.spawn&&p.look&&distanceToLine(x,z,[p.spawn,p.look])<12);
  // `force` is for composed views (an avenue of statues, a boardwalk through maples): the
  // tree stands exactly where the scene put it, even beside the walk or in the entrance sight line.
  // Hillsides that look best in autumn (Qixia's maples, the Purple Mountain road) turn red and gold.
  const zones=places.filter(p=>p.vista?.autumn).map(p=>p.vista.autumn);
  function seasonal(x,z){
    for(const a of zones)if(Math.hypot(x-a.x,z-a.z)<a.r){const r=random();return r<.5?3:r<.82?4:null;}
    return null;
  }
  function placeTree(x,z,scale=1,species=null,force=false,tint=null){
    if(!contains(x,z)||wet(x,z))return;
    if(!force&&(blocked(x,z)||occupied(x,z)||entranceClear(x,z)))return;
    trees.push({x,z,y:ground(x,z),scale:scale*1.28,yaw:random()*Math.PI*2,species:species??seasonal(x,z)??(shore(x,z)<25?2:random()<.26?1:random()<.2?2:0),tint:tint??random()});
  }
  planting.forEach(p=>placeTree(p.x,p.z,p.scale,p.species,p.force,p.tint));
  terrain.ridges.forEach(h=>{
    const count=h.secondary?280:820;
    for(let i=0;i<count;i++){
      const a=random()*Math.PI*2,r=Math.sqrt(random())*1.25;
      placeTree(h.x+Math.cos(a)*h.rx*r,h.z+Math.sin(a)*h.rz*r,.75+random()*.85);
    }
  });
  // Staggered groves, rather than uniform sprinkles over every urban block.
  for(let i=0;i<100;i++){
    const cx=terrain.bounds.min.x+random()*(terrain.bounds.max.x-terrain.bounds.min.x);
    const cz=terrain.bounds.min.z+random()*(terrain.bounds.max.z-terrain.bounds.min.z);
    if(Math.hypot(cx,cz)<850||!contains(cx,cz))continue;
    for(let j=0;j<18;j++)placeTree(cx+(random()-.5)*150,cz+(random()-.5)*130,.7+random()*.7);
  }
  function tuft(x,z,bank=false){
    if(!contains(x,z)||wet(x,z)||blocked(x,z,4.5))return;
    const p={x,z,y:ground(x,z)+.07,scale:.9+random()*.65,yaw:random()*Math.PI*2,tint:random(),bank};
    grass.push(p);if(!bank&&random()<.43)flowers.push({...p,scale:p.scale*.8,tint:random()});
    if(random()<.06&&!blocked(x,z,8))rocks.push({...p,scale:.6+random()*1.9});
  }
  routes.forEach(r=>{
    for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],length=Math.hypot(b[0]-a[0],b[2]-a[2]);
      const nx=-(b[2]-a[2])/(length||1),nz=(b[0]-a[0])/(length||1);
      for(let j=0;j<length;j+=1.7)for(const side of [-1,1]){
        const f=j/(length||1),spread=side*(4.5+random()*6),x=a[0]+(b[0]-a[0])*f+nx*spread,z=a[2]+(b[2]-a[2])*f+nz*spread;
        // Elevated bridge and wall decks do not grow wildflowers underneath.
        if(a[1]-ground(x,z)>6)continue;tuft(x,z,shore(x,z)<22);
      }
    }
  });
  riverLines.filter(r=>r.name==='长江').forEach(r=>{
    for(let i=1;i<r.points.length;i++){
      const a=r.points[i-1],b=r.points[i],length=Math.hypot(b[0]-a[0],b[2]-a[2]);
      const nx=-(b[2]-a[2])/(length||1),nz=(b[0]-a[0])/(length||1);
      for(let j=0;j<length;j+=18)for(const side of [-1,1]){
        const f=j/length,offset=side*(r.width*.5+12+random()*15),x=a[0]+(b[0]-a[0])*f+nx*offset,z=a[2]+(b[2]-a[2])*f+nz*offset;
        tuft(x,z,true);if(j%3<1)placeTree(x+nx*side*18,z+nz*side*18,.75+random()*.4);
      }
    }
  });
  const ico0=new THREE.IcosahedronGeometry(1,0),ico1=new THREE.IcosahedronGeometry(1,1),parts=[];
  function part(g,position,scale,yaw=0){const copy=g.clone();copy.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...position),
    new THREE.Quaternion().setFromAxisAngle(up,yaw),new THREE.Vector3(...scale)));parts.push(copy.index?copy.toNonIndexed():copy);if(copy.index)copy.dispose();}
  function merge(){const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());parts.length=0;return g;}
  function twig(a,b,r){const v=new THREE.Vector3(...b).sub(new THREE.Vector3(...a)),g=new THREE.CylinderGeometry(r*.65,r,v.length(),5);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,v.normalize()));g.translate(...new THREE.Vector3(...a).add(new THREE.Vector3(...b)).multiplyScalar(.5).toArray());
    part(g,[0,0,0],[1,1,1]);g.dispose();}
  function prototype(species,near){
    if(near)twig([0,0,0],[0,8,0],.29);
    else{const stem=new THREE.CylinderGeometry(.18,.32,8,3);part(stem,[0,4,0],[1,1,1]);stem.dispose();}
    const branches=near?(species===1?3:7):0;
    for(let i=0;i<branches;i++){const a=i*2.399,y=3+i*.4;twig([0,y,0],[Math.cos(a)*2.3,y+2.2,Math.sin(a)*2.3],.12);}
    const trunk=merge();
    const painted=paintedCrown(species,near),crown=painted.toNonIndexed();painted.dispose();return {trunk,crown};
  }
  function instances(g,mat,capacity,name){const m=new THREE.InstancedMesh(g,mat,Math.max(1,capacity));
    m.name=name;m.count=0;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;m.castShadow=false;m.receiveShadow=false;scene.add(m);return m;}
  function write(mesh,index,p,color){quat.setFromAxisAngle(up,p.yaw);
    matrix.compose(new THREE.Vector3(p.x,p.y,p.z),quat,new THREE.Vector3(p.scale,p.scale,p.scale));mesh.setMatrixAt(index,matrix);if(color)mesh.setColorAt(index,color);}
  const leafColor=new THREE.Color(),palette=[new THREE.Color('#f4ecd4'),new THREE.Color('#bed5cf'),new THREE.Color('#e5dfb9')];
  // Autumn: the same painted crowns, re-mapped by luminance from deep red to bright orange (maple) or
  // from ochre to gold (plane tree). No new texture; the painted texture's own light and shade survive.
  function autumn(source,dark,light,key){
    const mat=source.clone(),compile=source.onBeforeCompile;
    mat.onBeforeCompile=s=>{compile(s);
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
        float autumnL=dot(diffuseColor.rgb,vec3(.3,.59,.11));
        diffuseColor.rgb=mix(vec3(${dark}),vec3(${light}),smoothstep(.08,.55,autumnL))*(.8+autumnL*.45);`);};
    mat.customProgramCacheKey=()=>'city-ink-v2-leaves-'+key;return mat;
  }
  const speciesMaterials={
    3:{leaf:autumn(materials.leaf,'.55,.07,.04','1.0,.42,.10','maple'),canopy:materials.canopyMaple,trunk:materials.bark},
    4:{leaf:autumn(materials.leaf,'.62,.36,.05','1.0,.80,.22','plane'),canopy:materials.canopyPlane,trunk:materials.paleBark},
  };
  // The near-tree budget is shared by every species: it is what bounds the cost of a walk.
  const NEAR_BUDGET=660;
  let totalTriangles=0;
  for(let species=0;species<5;species++){
    const pool=trees.filter(p=>p.species===species);
    if(species>=3&&!pool.length)continue;
    const far=prototype(species,false),near=prototype(species,true),mats=speciesMaterials[species]||{leaf:materials.leaf,canopy:materials.canopy,trunk:materials.bark};
    const core=canopyInterior(species);
    const distant={trunk:instances(far.trunk,mats.trunk,pool.length,'Atlas grove trunks'),crown:instances(far.crown,mats.leaf,pool.length,'Atlas grove crowns'),
      core:instances(core,mats.canopy,pool.length,'Painted canopy interiors')};
    const detailed={trunk:instances(near.trunk,mats.trunk,Math.min(NEAR_BUDGET,Math.max(1,pool.length)),'Close branching trunks'),crown:instances(near.crown,mats.leaf,Math.min(NEAR_BUDGET,Math.max(1,pool.length)),'Close layered crowns')};
    pool.forEach((p,i)=>{leafColor.copy(palette[0]).lerp(palette[species===1?1:2],p.tint*.65);write(distant.trunk,i,p);write(distant.crown,i,p,leafColor);write(distant.core,i,p,leafColor);});
    distant.trunk.count=distant.crown.count=pool.length;distant.trunk.instanceMatrix.needsUpdate=distant.crown.instanceMatrix.needsUpdate=true;
    distant.crown.instanceColor.needsUpdate=true;
    distant.core.count=pool.length;distant.core.instanceMatrix.needsUpdate=true;distant.core.instanceColor.needsUpdate=true;
    totalTriangles+=pool.length*((far.trunk.attributes.position.count+far.crown.attributes.position.count)/3+core.attributes.position.count/3);
    groups.push({pool,distant,detailed,species});
  }
  // Curved, upright blades and petals remain three-dimensional while orbiting.
  const blades=[],bladeUV=[];
  for(let i=0;i<15;i++){
    const a=i*2.399,r=.15+(i%5)*.16,h=.48+(i%4)*.16,w=.04;
    const x=Math.cos(a)*r,z=Math.sin(a)*r,bend=.3;
    const pts=[[x-w,0,z],[x+w,0,z],[x+Math.cos(a)*bend-w,h*.65,z+Math.sin(a)*bend],[x+Math.cos(a)*bend+w,h*.65,z+Math.sin(a)*bend],
      [x+Math.cos(a)*bend*1.5,h,z+Math.sin(a)*bend*1.5]];
    for(const id of [0,2,1,1,2,3,2,4,3]){blades.push(...pts[id]);bladeUV.push(id%2,id/4);}
  }
  const bladeGeometry=new THREE.BufferGeometry();bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(blades,3));bladeGeometry.setAttribute('uv',new THREE.Float32BufferAttribute(bladeUV,2));bladeGeometry.computeVertexNormals();
  const grassMesh=instances(bladeGeometry,materials.sage,1100,'Wind-swept ground grass');
  
  for(let stem=0;stem<3;stem++){
    const a=stem*2.4,x=Math.cos(a)*.18,z=Math.sin(a)*.18,h=.55+stem*.14;
    const stalk=new THREE.CylinderGeometry(.012,.018,h,4);part(stalk,[x,h*.5,z],[1,1,1]);stalk.dispose();
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7;part(ico0,[x+Math.cos(a)*.13,h,z+Math.sin(a)*.13],[.10,.023,.055],a);}
  }
  const flowerMesh=instances(merge(),materials.white,650,'Scattered meadow flowers');
  const rockMesh=instances(ico1,materials.stone,220,'Weathered riverbank stones');
  const groundPalette=[new THREE.Color('#d0c382'),new THREE.Color('#91ae6b'),new THREE.Color('#88a5c8'),new THREE.Color('#df98aa'),new THREE.Color('#efe0b1')];
  // Grounding washes cost no shadow pass and follow the actual relief mesh.
  // They soften the foot of each grove without floating flat discs on slopes.
  const treeCells=new Map(),cellSize=24;
  trees.forEach(p=>{const key=`${Math.floor(p.x/cellSize)},${Math.floor(p.z/cellSize)}`;
    if(!treeCells.has(key))treeCells.set(key,[]);treeCells.get(key).push(p);});
  const vertices=terrain.geometry.attributes.position,colours=terrain.geometry.attributes.color;
  for(let i=0;i<vertices.count;i++){
    const x=vertices.getX(i),z=vertices.getZ(i),cx=Math.floor(x/cellSize),cz=Math.floor(z/cellSize);let shade=0;
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const p of treeCells.get(`${cx+a},${cz+b}`)||[]){
      shade=Math.max(shade,Math.max(0,1-Math.hypot(x-p.x,z-p.z)/(8*p.scale))*.2);
    }
    colours.setXYZ(i,colours.getX(i)*(1-shade),colours.getY(i)*(1-shade*.8),colours.getZ(i)*(1-shade*.55));
  }colours.needsUpdate=true;
  // A single material keeps grass/wildflowers in a few draws and adds a soft
  // root-weighted breeze rather than moving every tuft as a rigid card.
  for(const source of [materials.sage,materials.white]){
    const mat=source.clone(),compile=source.onBeforeCompile;
    mat.onBeforeCompile=s=>{compile(s);s.uniforms.cityWindTime=shared.time;s.uniforms.cityWindStorm=shared.storm;
      s.vertexShader='uniform float cityWindTime,cityWindStorm;\n'+s.vertexShader;
      s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\ntransformed.x+=sin(cityWindTime*1.6+instanceMatrix[3].x*.2+instanceMatrix[3].z*.3)*position.y*position.y*(.07+cityWindStorm*.1);');};
    if(source===materials.sage)grassMesh.material=mat;else flowerMesh.material=mat;
  }
  let stamp=Infinity,mode=null;
  const stats={trees:trees.length,grassPatches:grass.length,flowerPatches:flowers.length,rocks:rocks.length,totalTriangles,nearTrees:0,visibleGrass:0,visibleFlowers:0,visibleRocks:0,instanced:true,paintedCanopies:true};
  function update(camera,overview){
    const x=camera.position.x,z=camera.position.z;
    if(mode===overview&&Math.hypot(x-(stamp.x||0),z-(stamp.z||0),camera.position.y-(stamp.y||0))<12)return;
    stamp={x,z,y:camera.position.y};mode=overview;let nearCount=0,nearTriangles=0,extraTriangles=0;
    let budget=NEAR_BUDGET;
    groups.forEach(({pool,distant,detailed})=>{
      let n=0,f=0;
      pool.forEach(p=>{
        const isNear=!overview&&budget>0&&Math.hypot(x-p.x,z-p.z,camera.position.y-p.y)<120&&n<detailed.trunk.instanceMatrix.count;
        if(isNear)budget--;
        leafColor.copy(palette[0]).lerp(palette[p.species===1?1:2],p.tint*.65);
        if(isNear){write(detailed.trunk,n,p);write(detailed.crown,n++,p,leafColor);}else{write(distant.core,f,p,leafColor);write(distant.trunk,f,p);write(distant.crown,f++,p,leafColor);}
      });
      for(const m of [distant.trunk,distant.crown,detailed.trunk,detailed.crown]){m.count=m===distant.trunk||m===distant.crown?f:n;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
      distant.core.count=f;distant.core.instanceMatrix.needsUpdate=true;distant.core.instanceColor.needsUpdate=true;
      nearCount+=n;nearTriangles+=n*(detailed.trunk.geometry.attributes.position.count+detailed.crown.geometry.attributes.position.count)/3;
      extraTriangles+=n*(detailed.trunk.geometry.attributes.position.count+detailed.crown.geometry.attributes.position.count-distant.trunk.geometry.attributes.position.count-distant.crown.geometry.attributes.position.count-distant.core.geometry.attributes.position.count)/3;
    });stats.nearTrees=nearCount;stats.nearTriangles=nearTriangles;
    for(const [pool,mesh,key,maxDistance] of [[grass,grassMesh,'visibleGrass',100],[flowers,flowerMesh,'visibleFlowers',90],[rocks,rockMesh,'visibleRocks',180]]){
      const close=overview?[]:pool.filter(p=>Math.hypot(p.x-x,p.z-z)<maxDistance).sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z)).slice(0,mesh.instanceMatrix.count);
      close.forEach((p,i)=>{leafColor.copy(groundPalette[key==='visibleFlowers'?2+Math.floor(p.tint*3):0]).lerp(groundPalette[1],key==='visibleFlowers'?0:p.tint*.75);write(mesh,i,p,leafColor);});
      mesh.count=close.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;stats[key]=close.length;
      extraTriangles+=close.length*(mesh.geometry.index?mesh.geometry.index.count:mesh.geometry.attributes.position.count)/3;
    }
    stats.extraTriangles=extraTriangles;
  }
  ico0.dispose(); // The merged templates own their copies; rockMesh owns ico1.
  return {update,stats};
}
