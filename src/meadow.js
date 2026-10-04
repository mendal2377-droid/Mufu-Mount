import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { foliagePatch, randomSeed } from "./forest-geometry.js";

export function pathMask(routes) {
  const grid=new Map(),size=16;
  routes.forEach(route=>{
    for(let i=1;i<route.points.length;i++){
      const a=route.points[i-1],b=route.points[i],r=route.width*.5+.6;
      const seg={a,b,r};
      for(let x=Math.floor((Math.min(a[0],b[0])-r)/size);x<=Math.floor((Math.max(a[0],b[0])+r)/size);x++)
        for(let z=Math.floor((Math.min(a[2],b[2])-r)/size);z<=Math.floor((Math.max(a[2],b[2])+r)/size);z++){
          const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(seg);
        }
    }
  });
  return (x,z)=>{
    for(const {a,b,r} of grid.get(`${Math.floor(x/size)},${Math.floor(z/size)}`)||[]){
      const dx=b[0]-a[0],dz=b[2]-a[2],d=dx*dx+dz*dz;
      const t=d?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[2])*dz)/d)):0;
      if((x-a[0]-t*dx)**2+(z-a[2]-t*dz)**2<r*r)return true;
    }
    return false;
  };
}

// Reproducible loose patches, not rows of flowers. Sampling the visible
// surface later rejects paving, cliff faces and the river's stone armour.
export function scatterMeadow(routes, seed = 48271) {
  const random = randomSeed(seed), spots = [], paved=pathMask(routes);
  routes.forEach((route, routeIndex) => {
    if (routeIndex === 4) return;
    let carried = 0;
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i];
      const dx = b[0] - a[0], dz = b[2] - a[2], length = Math.hypot(dx, dz);
      if (length < .001) continue;
      carried += length;
      while (carried >= 7) {
        carried -= 7;
        const f = 1 - carried / length;
        const x = a[0] + dx * f, z = a[2] + dz * f;
        const y = a[1] + (b[1] - a[1]) * f;
        if (y > 125) continue;
        const nx = -dz / length, nz = dx / length;
        for (const side of routeIndex === 3 ? [1] : [-1, 1]) {
          // The promenade's inland grass includes a narrow verge and wider
          // lower slopes. Actual surface checks keep the road between clear.
          for (let band = 0; band < 3; band++) {
            if (random() < .16) continue;
            const out = routeIndex === 3
              ? (band === 0 ? 5.5 + random() * 5 : 20 + random() * 70)
              : route.width * .5 + 1.3 + band * 12 + random() * 8;
            const cx = x + nx * out * side, cz = z + nz * out * side;
            const radius = 2.5 + random() * 4, bloom = random();
            for (let j = 0; j < 20; j++) {
              const angle = random() * Math.PI * 2, r = Math.sqrt(random()) * radius;
              const sx = cx + Math.cos(angle) * r, sz = cz + Math.sin(angle) * r;
              // Reject the source corridor even when a patch's edge reaches it.
              if (Math.abs((sx - x) * nx + (sz - z) * nz) < route.width * .5 + .7 || paved(sx,sz)) continue;
              spots.push({ x:sx, z:sz, scale:.6 + random() * .8, angle:random() * Math.PI * 2,
                flower:bloom > .35 && random() < .35, tile:bloom > .7 ? 0 : 1, bank:routeIndex === 3 });
            }
          }
        }
      }
    }
  });
  return spots;
}

export function meadowGeometry(tile) {
  const width = tile < 2 ? .72 : .95, height = tile < 2 ? .85 : .72;
  const patches = Array.from({length:3}, (_,i) => {
    const g = foliagePatch(width,height,tile,2,.11);
    g.translate(0,height*.5,0); g.rotateY(i * 2.39996);
    g.translate(Math.cos(i*2.4)*.08,0,Math.sin(i*2.4)*.08); return g;
  });
  const g = mergeGeometries(patches); patches.forEach(p=>p.dispose());
  g.computeBoundingBox(); return g;
}

export function plantableSurface(hit) {
  return !!hit && /Woodland floor|Grass \| summer|Hike \| earth|Field \| leaf litter/i.test(hit.name)
    && hit.height > 3 && hit.height < 130 && hit.normalY > .62;
}

function plantingSampler(scene) {
  const names = /floor|grass|earth|limestone|promenade|asphalt|paving|paver|flagstone|terrace|deck|shoulders/i;
  const records = scene.children.filter(m=>m.isMesh && !m.isInstancedMesh && names.test(m.name)).map(mesh=>{
    mesh.geometry.computeBoundingBox(); mesh.updateMatrixWorld();
    return {mesh,box:mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld)};
  });
  const ray = new THREE.Raycaster(); ray.ray.direction.set(0,-1,0);
  return (x,z) => {
    ray.ray.origin.set(x,1200,z);
    const candidates = records.filter(r=>x>=r.box.min.x && x<=r.box.max.x && z>=r.box.min.z && z<=r.box.max.z);
    const hit = ray.intersectObjects(candidates.map(r=>r.mesh),false)[0];
    return hit ? {name:hit.object.name,height:hit.point.y,normalY:Math.abs(hit.face.normal.y)} : null;
  };
}

export function meadowMaterial(atlas, shared) {
  const m = new THREE.MeshStandardMaterial({map:atlas,color:0xffffff,alphaTest:.43,
    side:THREE.DoubleSide,roughness:.96});
  m.customProgramCacheKey=()=>"mufu-meadow-wind-v1";
  m.onBeforeCompile = shader => {
    shader.uniforms.windTime=shared.time; shader.uniforms.uStorm=shared.storm; shader.uniforms.uSnow=shared.snow;
    shader.vertexShader="uniform float windTime,uStorm;\n"+shader.vertexShader.replace("#include <begin_vertex>",
      `#include <begin_vertex>
       float tip=pow(max(0.,position.y),1.6);
       float phase=instanceMatrix[3].x*.41+instanceMatrix[3].z*.27;
       transformed.x+=sin(windTime*1.4+phase)*tip*.085*(1.+uStorm*3.);
       transformed.z+=cos(windTime*1.1+phase*.8)*tip*.05*(1.+uStorm*2.);`);
    shader.fragmentShader="uniform float uSnow;\n"+shader.fragmentShader.replace("#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.84,.89,.87),uSnow*.85);");
  };
  return m;
}

export async function createMeadow(scene,routes,shared,anisotropy=4) {
  const atlas=await new THREE.TextureLoader().loadAsync("/vegetation/meadow-atlas-v1.png");
  atlas.colorSpace=THREE.SRGBColorSpace; atlas.anisotropy=Math.min(4,anisotropy);
  const spots=scatterMeadow(routes), grid=new Map(), cellSize=16, sample=plantingSampler(scene);
  spots.forEach((s,i)=>{
    const key=`${Math.floor(s.x/cellSize)},${Math.floor(s.z/cellSize)}`;
    if(!grid.has(key)) grid.set(key,[]); grid.get(key).push(i);
  });
  const material=meadowMaterial(atlas,shared), caps=[350,350,1000,1000];
  const meshes=caps.map((cap,tile)=>{
    const m=new THREE.InstancedMesh(meadowGeometry(tile),material,cap);
    m.name=tile<2?"Lower-ground wildflowers":"Lower-ground meadow grass";
    m.count=0;m.frustumCulled=false;m.receiveShadow=true;m.castShadow=false;scene.add(m);return m;
  });
  const heights=new Map(), dummy=new THREE.Object3D(), color=new THREE.Color();
  let bankCount=0;
  return {
    atlas,meshes,
    clear(){meshes.forEach(m=>m.count=0);bankCount=0;},
    getStats(){return {flowers:meshes[0].count+meshes[1].count,grass:meshes[2].count+meshes[3].count,
      bank:bankCount,candidates:spots.length,atlas:atlas.image.width};},
    update(camera,range=60){
      const cx=Math.floor(camera.position.x/cellSize),cz=Math.floor(camera.position.z/cellSize);
      const reach=Math.ceil(range/cellSize), candidates=[];
      for(let x=cx-reach;x<=cx+reach;x++)for(let z=cz-reach;z<=cz+reach;z++){
        for(const i of grid.get(`${x},${z}`)||[]) {
          const s=spots[i],d=(s.x-camera.position.x)**2+(s.z-camera.position.z)**2;
          if(d<range*range)candidates.push({i,d});
        }
      }
      candidates.sort((a,b)=>a.d-b.d);
      const counts=[0,0,0,0];bankCount=0;let sampled=0;
      for(const {i,d} of candidates){
        const s=spots[i],tile=s.flower?s.tile:(s.bank&&i%3===0?3:2);
        if(counts[tile]>=caps[tile] || (s.flower && d>42*42))continue;
        // Gradually cache raycasts as the walker approaches; no full-mountain
        // sampling at startup or scanning every meadow point each frame.
        if(!heights.has(i)) {
          if(sampled++>=100)continue;
          const hit=sample(s.x,s.z);heights.set(i,plantableSurface(hit)?hit.height:null);
        }
        const y=heights.get(i);if(y===null)continue;
        dummy.position.set(s.x,y+.015,s.z);dummy.rotation.set(0,s.angle,0);
        dummy.scale.set(s.scale,s.scale*(.8+(i%5)*.09),s.scale);dummy.updateMatrix();
        const m=meshes[tile],n=counts[tile]++;m.setMatrixAt(n,dummy.matrix);
        color.setRGB(.85+(i%4)*.04,.89+(i%3)*.03,.79+(i%5)*.04);m.setColorAt(n,color);
        if(s.bank)bankCount++;
      }
      meshes.forEach((m,t)=>{m.count=counts[t];m.instanceMatrix.needsUpdate=true;
        if(m.instanceColor)m.instanceColor.needsUpdate=true;});
    },
  };
}
