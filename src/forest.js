import * as THREE from "three";
import { canopyTexture } from "./life.js";
import { treeGeometry, treeKind, treeShadowGeometry } from "./forest-geometry.js";

export async function createForest(scene,shared,trees,makeMaterial) {
  const atlas=await new THREE.TextureLoader().loadAsync("/vegetation/forest-atlas-v1.png");
  atlas.colorSpace=THREE.SRGBColorSpace;atlas.anisotropy=4;
  const crownMaterial=makeMaterial("Leaf volume",[.72,.82,.62]);
  crownMaterial.map=atlas;crownMaterial.alphaTest=.4;
  crownMaterial.roughness=.92;
  const woodMaterial=makeMaterial("Forest bark",[.22,.15,.095]);
  const baseCompile=woodMaterial.onBeforeCompile;
  woodMaterial.onBeforeCompile=shader=>{
    baseCompile(shader);
    shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",
      "#include <color_fragment>\nfloat fibre=mufuNoise(vec2(vWorldPoint.x*24.+vWorldPoint.z*18.,vWorldPoint.y*.7));diffuseColor.rgb*=.65+fibre*.65;");
  };
  woodMaterial.customProgramCacheKey=()=>"mufu-forest-bark";
  const buckets=[];
  for(const detail of [true,false]) for(const kind of ["broadleaf","pine"]) {
    const geo=treeGeometry(kind,detail),capacity=detail?160:900;
    const meshes=[new THREE.InstancedMesh(geo.trunk,woodMaterial,capacity),new THREE.InstancedMesh(geo.crown,crownMaterial,capacity)];
    for(const m of meshes) {
      m.name=`${detail?"Near":"Middle"} ${kind} ${m.geometry===geo.crown?"volumetric foliage":"branches"}`;
      m.frustumCulled=false;m.count=0;m.castShadow=false;m.receiveShadow=true;scene.add(m);
    }
    buckets.push({detail,kind,meshes,count:0});
  }
  const proxyGeo=treeShadowGeometry();
  const shadows=new THREE.InstancedMesh(proxyGeo,new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false}),160);
  shadows.name="Near-tree shadow proxies";shadows.castShadow=true;shadows.frustumCulled=false;shadows.count=0;scene.add(shadows);
  // Keep the painted base on the planted promenade trunks.
  const paint=new THREE.InstancedMesh(new THREE.CylinderGeometry(.25,.25,1.4,7).translate(0,.7,0),
    makeMaterial("White painted trunk",[.62,.66,.60]),400);
  paint.name="Planted tree painted bases";paint.frustumCulled=false;paint.count=0;scene.add(paint);
  const fg=new THREE.BufferGeometry();
  fg.setAttribute("position",new THREE.Float32BufferAttribute(new Float32Array(trees.length*3),3));
  fg.setAttribute("size",new THREE.Float32BufferAttribute(new Float32Array(trees.length),1));
  fg.setAttribute("kind",new THREE.Float32BufferAttribute(new Float32Array(trees.length),1));fg.setDrawRange(0,0);
  const far=new THREE.Points(fg,new THREE.ShaderMaterial({uniforms:{...shared,viewport:{value:innerHeight},canopy:{value:canopyTexture(true)}},
    vertexShader:`attribute float size,kind;uniform float viewport;varying float shade,treeType;
      void main(){vec4 mv=modelViewMatrix*vec4(position,1.);treeType=kind;shade=fract(sin(position.x*.7+position.z)*43758.5);
      gl_Position=projectionMatrix*mv;gl_PointSize=clamp(size*projectionMatrix[1][1]*viewport*.5/max(1.,-mv.z),1.,140.);}`,
    fragmentShader:`uniform sampler2D canopy;uniform float snow,storm,sunset,dawn;uniform vec3 uSunDir;varying float shade,treeType;
      void main(){vec2 p=gl_PointCoord*2.-1.;vec4 spray=texture2D(canopy,gl_PointCoord);
      if(treeType>.5){float width=.1+gl_PointCoord.y*.84; width*=.80+.20*sin(gl_PointCoord.y*56.);
        if(abs(p.x)>width||gl_PointCoord.y<.05||gl_PointCoord.y>.96)discard;
        spray=texture2D(canopy,vec2(p.x*.3+.5,gl_PointCoord.y*.8+.1));}
      if(spray.a<.45)discard;float nz=sqrt(max(0.,1.-dot(p,p)));
      float light=.42+max(0.,dot(normalize(vec3(p.x,-p.y,nz)),normalize(vec3(uSunDir.x,uSunDir.y,.5))))*.58;
      vec3 green=mix(vec3(.08,.16,.035),vec3(.20,.30,.09),shade)*(.55+spray.g*.9);
      green*=mix(1.,.75,treeType);green=mix(green,vec3(.38,.28,.10),sunset*.3);
      green=mix(green,vec3(.69,.77,.75),snow*max(0.,-p.y)*.8);green*=light*(1.-storm*.3);
      green=mix(green,green*vec3(.30,.34,.52),dawn*.85);gl_FragColor=vec4(green,1.);}`,
  }));
  far.name="Distant mixed forest";far.frustumCulled=false;scene.add(far);
  const dummy=new THREE.Object3D(),color=new THREE.Color();let stats={};
  return {atlas,getStats:()=>stats,update(camera,state,renderer){
    const candidates=[];let forest=0,near=0,middle=0,painted=0;
    for(const bucket of buckets)bucket.count=0;
    for(let i=0;i<trees.length;i++) {
      const t=trees[i],d=Math.hypot(t[0]-camera.position.x,t[1]+6*t[4]-camera.position.y,t[2]-camera.position.z);
      if(!state.overview&&!state.flying&&d>1900)continue;
      candidates.push({t,i,d});
    }
    // Spend detail on the closest trees first, including during kite flight.
    candidates.sort((a,b)=>a.d-b.d);
    for(const {t,i,d} of candidates) {
      const kind=treeKind(t,i),detail=!state.overview&&d<105&&near<160;
      if(detail||(!state.overview&&d<430&&middle<900)) {
        const bucket=buckets.find(b=>b.detail===detail&&b.kind===kind);
        dummy.position.set(t[0],t[1],t[2]);dummy.rotation.set(0,i*2.39996,0);
        dummy.scale.set(t[3]*(.93+(i%5)*.035),t[4],t[3]*(.94+(i%3)*.05));dummy.updateMatrix();
        for(const m of bucket.meshes)m.setMatrixAt(bucket.count,dummy.matrix);
        color.setRGB(.8+(i%5)*.05,.85+(i%4)*.04,.75+(i%7)*.035);
        bucket.meshes[1].setColorAt(bucket.count,color);bucket.count++;
        if(detail){shadows.setMatrixAt(near,dummy.matrix);near++;}else middle++;
        if(!t[5]&&painted<400)paint.setMatrixAt(painted++,dummy.matrix);
      } else {
        fg.attributes.position.setXYZ(forest,t[0],t[1]+(kind==="pine"?6:6.2)*t[4],t[2]);
        fg.attributes.size.setX(forest,(kind==="pine"?13:10)*t[3]);
        fg.attributes.kind.setX(forest,kind==="pine"?1:0);forest++;
      }
    }
    for(const b of buckets)for(const m of b.meshes){m.count=b.count;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
    shadows.count=near;shadows.instanceMatrix.needsUpdate=true;paint.count=painted;paint.instanceMatrix.needsUpdate=true;
    for(const a of Object.values(fg.attributes))a.needsUpdate=true;fg.setDrawRange(0,forest);
    far.material.uniforms.viewport.value=innerHeight*renderer.getPixelRatio();
    stats={near,middle,distant:forest,pines:buckets.filter(b=>b.kind==="pine").reduce((n,b)=>n+b.count,0),volumetric:true,atlas:atlas.image?.width||0};
  }};
}
