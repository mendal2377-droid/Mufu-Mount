import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {foliagePatch} from './forest-geometry.js';

// Painted sprays wrap a branched volume. They never face the camera, so the
// same canopy retains its depth when walking, orbiting or flying past it.
export function paintedCrown(species,near){
  const parts=[],pine=species===1,count=pine?(near?7:5):(near?12:6);
  for(let i=0;i<count;i++){
    const angle=i*2.39996,r=pine?2.8-i*(2.3/count):i===0?0:2.2;
    const y=pine?3+i*1.05:7.1+Math.sin(i*1.7)*1.4;
    const tile=pine?2:species===2?3:i%5===2?1:0;
    for(let j=0;j<(near?3:2);j++){
      const patch=foliagePatch(pine?r*2.3:4.4,pine?2.2:species===2?5.6:4.1,tile,near?3:1,near?.75:.45);
      patch.rotateX(pine?-.35:Math.sin(i+j)*.35);patch.rotateY(angle+j*Math.PI/3);
      patch.translate(Math.cos(angle)*r*(pine?.25:1),y,Math.sin(angle)*r*(pine?.25:1));parts.push(patch);
    }
  }
  const crown=mergeGeometries(parts);parts.forEach(g=>g.dispose());crown.computeBoundingBox();return crown;
}

// A small opaque interior stops distant leaf alpha from dissolving the grove
// into dark speckles. Painted sprays still supply its irregular outer edge.
export function canopyInterior(species){
  const parts=[],pine=species===1,count=pine?5:3;
  for(let i=0;i<count;i++){
    const g=new THREE.IcosahedronGeometry(1,0),a=i*2.39996;
    const p=g.attributes.position,n=g.attributes.normal;
    for(let v=0;v<p.count;v++){const normal=new THREE.Vector3().fromBufferAttribute(p,v).normalize();n.setXYZ(v,...normal.toArray());}
    g.scale(pine?2.4-i*.35:2.6,pine?1.3:species===2?3.1:2.6,pine?2.4-i*.35:2.6);
    g.translate(pine?0:Math.cos(a)*1.3,pine?3.4+i*1.4:7.1+Math.sin(a)*.5,pine?0:Math.sin(a)*1.3);parts.push(g);
  }
  const g=mergeGeometries(parts);parts.forEach(p=>p.dispose());return g;
}

// Incommensurate bearings and warped phases make short broken highlights,
// rather than the former evenly spaced parallel white lines. Derivative
// filtering removes high-frequency brush marks at the atlas/horizon scale.
export function paintCityWater(water,shared){
  water.onBeforeCompile=shader=>{
    shader.uniforms.cityTime=shared.time;shader.uniforms.cityStorm=shared.storm;
    shader.uniforms.citySunset=shared.sunset;shader.uniforms.citySnow=shared.snow;
    shader.vertexShader='varying vec3 cityWaterPoint;\n'+shader.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\ncityWaterPoint=(modelMatrix*vec4(position,1.)).xyz;');
    shader.fragmentShader=`uniform float cityTime,cityStorm,citySunset,citySnow;
      varying vec3 cityWaterPoint;
      float cityWave(vec2 p,vec2 d,float k,float speed){
        float phase=dot(p,d)*k-cityTime*speed;
        return sin(phase)*(1.-smoothstep(.4,2.,fwidth(phase)));
      }\n`+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      vec2 wp=cityWaterPoint.xz;
      float sx=cityWave(wp,vec2(.82,.57),1.18,1.3)+cityWave(wp,vec2(-.35,.94),2.13,1.8)*.42;
      float sz=cityWave(wp,vec2(.24,-.97),.79,.83)+cityWave(wp,vec2(.93,.37),3.67,2.1)*.27;
      // Three expects this normal in view space, even when the camera turns.
      normal=normalize(normal+mat3(viewMatrix)*vec3(sx,0.,sz)*(.12+cityStorm*.17));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec2 waterP=cityWaterPoint.xz;
      float swell=(sin(waterP.x*.037+sin(waterP.y*.061)*2.)+sin(waterP.y*.083+sin(waterP.x*.019)*1.7))*.25+.5;
      float warp=sin(waterP.x*.31+sin(waterP.y*.17))*2.1;
      float phase=waterP.y*1.83+waterP.x*.52+warp-cityTime*.85;
      float stroke=pow(max(0.,sin(phase)),12.)*(1.-smoothstep(.35,1.8,fwidth(phase)));
      float broken=smoothstep(.1,.72,sin(waterP.x*1.1+sin(waterP.y*.41))*cos(waterP.y*.37-cityTime*.19)*.5+.5);
      vec3 deep=vec3(.055,.20,.23),shallow=vec3(.17,.37,.36);
      vec3 reflected=mix(vec3(.70,.79,.71),vec3(.87,.58,.29),citySunset);
      diffuseColor.rgb=mix(deep,shallow,swell)*(.85+.15*citySnow);
      diffuseColor.rgb=mix(diffuseColor.rgb,reflected,stroke*broken*(.35+cityStorm*.12));`);
  };
}
