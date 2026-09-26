import * as THREE from 'three';
import {PointerLockControls} from 'three/addons/controls/PointerLockControls.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {nearestOnRoute,closestRoute,constrainToRoute} from './navigation.js';
import {NatureAudio} from './audio.js';
import './style.css';

const $=s=>document.querySelector(s),canvas=$('#world');
const state={ready:false,playing:false,auto:false,overview:false,weather:'morning',route:2,place:0,distance:0,moving:false,frames:0};
const audio=new NatureAudio(),keys=new Set();let saved=[];
try{saved=JSON.parse(localStorage.getItem('mufu-notes')||'[]');if(!Array.isArray(saved))saved=[];}catch{}
const places=[{name:'Rainbow road',copy:'Three colours threading through green.',bookmark:10},{name:'Ridge trail',copy:'A pale stone path. A little closer to the sky.',bookmark:2},{name:'River lookout',copy:'Pause where the mountain meets the horizon.',bookmark:4},{name:'Yangtze promenade',copy:'The river moves. You don’t have to.',bookmark:5},{name:'Forest stairs',copy:'One step, then another. Listen to the leaves.',bookmark:1}];
let renderer,scene,camera,controls,orbit,routes,world,sun,hemi,sky,water,particles,treeMeshes=[],nearTrees=[],returnPose,geometryBytes=0;
const weather={sunset:0,storm:0,snow:0};const u={time:{value:0},sunset:{value:0},storm:{value:0},snow:{value:0},flash:{value:0}};
const clock=new THREE.Clock(),dummy=new THREE.Object3D();let toastTimer,flashTimer=0,lastTreeUpdate=-10,lastMap=-10,lastLightning=0;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3600);}
function progress(value,text){$('#load-bar').style.width=`${value}%`;$('#load-status').textContent=text;}
function material(name,color){
  const m=new THREE.MeshStandardMaterial({color:new THREE.Color().fromArray(color),roughness:.91,side:THREE.DoubleSide});
  const noSnow=/water|blue|pink|yellow line/i.test(name);m.userData.baseColor=m.color.clone();
  m.onBeforeCompile=shader=>{
    shader.uniforms.uSnow=u.snow;shader.uniforms.uRain=u.storm;
    shader.vertexShader='varying vec3 vWorldPoint; varying vec3 vWorldUp;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvec4 wp=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nwp=instanceMatrix*wp;\n#endif\nvWorldPoint=(modelMatrix*wp).xyz;vWorldUp=normalize(mat3(modelMatrix)*objectNormal);');
    shader.fragmentShader='uniform float uSnow;uniform float uRain;varying vec3 vWorldPoint;varying vec3 vWorldUp;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>\nfloat grain=fract(sin(dot(floor(vWorldPoint.xz*8.0),vec2(12.9898,78.233)))*43758.5453);diffuseColor.rgb*=.92+grain*.13;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.79,.86,.86),uSnow*${noSnow?'0.18':'0.92'}*smoothstep(.05,.6,vWorldUp.y));diffuseColor.rgb*=1.0-uRain*.17;`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.28,uRain*.7);');
  };return m;
}
function createSky(){
  const vs='varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
  const fs=`uniform float time,sunset,storm,snow,flash;varying vec3 vDir;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){return noise(p)*.55+noise(p*2.1)*.27+noise(p*4.2)*.12;}
  void main(){vec3 d=normalize(vDir);float h=max(0.,d.y);vec3 top=mix(vec3(.23,.47,.63),vec3(.26,.26,.43),sunset);vec3 horizon=mix(vec3(.80,.87,.80),vec3(1.,.51,.27),sunset);vec3 col=mix(horizon,top,pow(h,.45));col=mix(col,mix(vec3(.36,.43,.44),vec3(.075,.13,.16),h),storm*.9);col=mix(col,mix(vec3(.79,.84,.83),vec3(.52,.63,.68),h),snow*.82);vec2 uv=d.xz/(max(.08,d.y)+.25)*1.8+vec2(time*.007,0.);float n=fbm(uv);float c=smoothstep(.40-storm*.12,.7,n)*smoothstep(0.,.12,d.y);col=mix(col,mix(vec3(.97,.96,.86),vec3(.26,.30,.31),storm),c*.7);vec3 sd=normalize(vec3(-.8,mix(.55,.08,sunset),-.6));float sun=pow(max(0.,dot(d,sd)),900.);col+=vec3(1.,.75,.37)*sun*1.2*(1.-storm)*(1.-snow);col+=flash*.7;gl_FragColor=vec4(col,1.);}`;
  sky=new THREE.Mesh(new THREE.SphereGeometry(18000,24,16),new THREE.ShaderMaterial({uniforms:u,vertexShader:vs,fragmentShader:fs,side:THREE.BackSide,depthWrite:false}));sky.renderOrder=-10;scene.add(sky);
  water=new THREE.Mesh(new THREE.PlaneGeometry(70000,70000),new THREE.ShaderMaterial({uniforms:u,vertexShader:'varying vec3 p;void main(){vec4 w=modelMatrix*vec4(position,1.);p=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',fragmentShader:`uniform float time,sunset,storm,snow,flash;varying vec3 p;void main(){vec3 v=normalize(cameraPosition-p);float wave=sin(p.x*.22+time*.9+sin(p.z*.12))*sin(p.z*.5-time*.65);float fine=sin(p.x*1.5+p.z*2.5+time*2.);vec3 col=mix(vec3(.24,.39,.38),vec3(.49,.32,.25),sunset);col=mix(col,vec3(.14,.23,.25),storm);col=mix(col,vec3(.36,.46,.48),snow*.6);col+=(wave*.017+fine*.012)*(1.+storm);float reflection=pow(max(0.,dot(normalize(vec3(v.x,0.,v.z)),normalize(vec3(-.8,0.,-.6)))),90.);col+=vec3(.9,.53,.2)*reflection*(.22+.2*wave)*sunset;float fog=1.-exp(-distance(cameraPosition,p)*.0002);col=mix(col,mix(vec3(.68,.79,.78),vec3(.35,.42,.42),storm),fog*.7);col+=flash*.2;gl_FragColor=vec4(col,1.);}`}));water.rotation.x=-Math.PI/2;water.position.set(2300,.1,-1800);scene.add(water);
}
function buildTrees(trees,buffer){
  // Shared low-poly crowns, with full-height trunks. Placements come from Blender.
  const trunkGeo=new THREE.CylinderGeometry(.11,.2,5.7,5);trunkGeo.translate(0,2.85,0);
  const crownGeo=new THREE.IcosahedronGeometry(1,1);crownGeo.scale(2.4,3.6,2.4);crownGeo.translate(0,6.9,0);
  const trunk=new THREE.InstancedMesh(trunkGeo,material('Bark',[.14,.095,.055]),trees.length);
  const crown=new THREE.InstancedMesh(crownGeo,material('Leaves',[.19,.33,.08]),trees.length);
  trees.forEach((t,i)=>{dummy.position.set(t[0],t[1],t[2]);dummy.scale.set(t[3],t[4],t[3]);dummy.rotation.y=i*2.39;dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);crown.setMatrixAt(i,dummy.matrix);crown.setColorAt(i,new THREE.Color().setRGB(.7+(i%5)*.07,.8+(i%3)*.06,.65+(i%7)*.045));});
  trunk.frustumCulled=false;crown.frustumCulled=false;scene.add(trunk,crown);treeMeshes=[trunk,crown];
  nearTrees=(world.treePrototype||[]).map(rec=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buffer,rec.positions.offset,rec.positions.count),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(buffer,rec.normals.offset,rec.normals.count),3));g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,rec.indices.offset,rec.indices.count),1));const m=new THREE.InstancedMesh(g,material(rec.name,rec.color),220);m.frustumCulled=false;m.count=0;scene.add(m);return m;});
}
function updateTrees(){let far=0,near=0;for(let i=0;i<world.trees.length;i++){const t=world.trees[i],d=Math.hypot(t[0]-camera.position.x,t[2]-camera.position.z);if(!state.overview&&d>1900)continue;dummy.position.set(t[0],t[1],t[2]);dummy.scale.set(t[3],t[4],t[3]);dummy.rotation.y=i*2.39;dummy.updateMatrix();if(!state.overview&&d<115&&near<220&&nearTrees.length){nearTrees.forEach(m=>m.setMatrixAt(near,dummy.matrix));near++;}else{treeMeshes.forEach(m=>m.setMatrixAt(far,dummy.matrix));far++;}}treeMeshes.forEach(m=>{m.count=far;m.instanceMatrix.needsUpdate=true;});nearTrees.forEach(m=>{m.count=near;m.instanceMatrix.needsUpdate=true;});}
function createParticles(){
  const count=1800,positions=new Float32Array(count*3);for(let i=0;i<count;i++){positions[i*3]=(Math.random()-.5)*90;positions[i*3+1]=Math.random()*42;positions[i*3+2]=(Math.random()-.5)*90;}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));
  particles=new THREE.Points(g,new THREE.ShaderMaterial({uniforms:u,transparent:true,depthWrite:false,vertexShader:`uniform float time,storm,snow;varying float alpha;void main(){vec3 p=position;float speed=mix(2.1,23.,storm);p.y=mod(p.y-time*speed,42.)-9.;p.x+=sin(time*.5+p.z)*snow*1.2;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((snow*2.3+storm)*140./max(3.,-mv.z),1.,snow>storm?8.:3.);alpha=max(storm,snow)*.65;}`,fragmentShader:`varying float alpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.88,.94,.97,alpha*(1.-d));}`}));particles.frustumCulled=false;scene.add(particles);
}
async function load(){
  try{
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,preserveDrawingBuffer:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
    scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0xadbdb3,.00026);camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.12,25000);camera.rotation.order='YXZ';
    hemi=new THREE.HemisphereLight(0xd9ebff,0x4b5b30,2.3);scene.add(hemi);sun=new THREE.DirectionalLight(0xffedc4,2.5);sun.position.set(-800,650,-600);scene.add(sun);
    controls=new PointerLockControls(camera,canvas);controls.pointerSpeed=.7;controls.addEventListener('lock',()=>{document.body.classList.add('locked');$('#resume').hidden=true;});controls.addEventListener('unlock',()=>{keys.clear();document.body.classList.remove('locked');$('#resume').hidden=state.auto||state.overview;});
    orbit=new OrbitControls(camera,canvas);orbit.enabled=false;orbit.enableDamping=true;orbit.maxDistance=12000;orbit.minDistance=200;orbit.maxPolarAngle=Math.PI*.47;
    progress(10,'Finding the trails');
    [world,routes]=await Promise.all([fetch('/world/scene.json').then(checkJSON),fetch('/world/routes.json').then(checkJSON)]);
    const response=await fetch('/world/geometry.bin');if(!response.ok)throw Error('The landscape could not be downloaded.');const reader=response.body.getReader(),chunks=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;progress(Math.min(83,15+size/20543220*68),'Bringing the landscape into view');}
    const bytes=new Uint8Array(size);let offset=0;chunks.forEach(c=>{bytes.set(c,offset);offset+=c.length;});const buffer=bytes.buffer;geometryBytes=size;
    for(const rec of world.meshes){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buffer,rec.positions.offset,rec.positions.count),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(buffer,rec.normals.offset,rec.normals.count),3));g.setIndex(new THREE.BufferAttribute(new Uint32Array(buffer,rec.indices.offset,rec.indices.count),1));g.computeBoundingSphere();const mesh=new THREE.Mesh(g,material(rec.name,rec.color));mesh.name=rec.name;scene.add(mesh);}
    buildTrees(world.trees,buffer);createSky();createParticles();progress(97,'Your quiet place is ready');
    goTo(0,false);state.ready=true;updateNotes();$('#enter').disabled=false;$('#enter').innerHTML='Enter the mountain <span>↗</span>';progress(100,'Ready · Headphones recommended');animate();
    window.__mufu={state,weather,places,routes,camera,renderer,goTo,setWeather,getStats:()=>({...state,position:camera.position.toArray(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometryBytes,treeCount:world.trees.length,audioReady:audio.started,audioEnabled:audio.enabled,saved:[...saved]})};
  }catch(e){console.error(e);$('#load-status').textContent=`Unable to open the 3D scene: ${e.message}. Try a browser with WebGL enabled.`;$('#enter').textContent='Reload the landscape';$('#enter').disabled=false;$('#enter').onclick=()=>location.reload();}
}
async function checkJSON(r){if(!r.ok)throw Error('Scene data unavailable');return r.json();}
function goTo(index,notify=true){
  if(state.overview)toggleOverview();state.place=index;const place=places[index],mark=world.bookmarks[place.bookmark];
  const near=closestRoute([mark.position[0],mark.position[1]-1.7,mark.position[2]],routes);state.route=near.route;
  camera.position.fromArray(near.position);camera.position.y+=1.7;camera.lookAt(camera.position.clone().add(new THREE.Vector3().fromArray(mark.direction)));camera.rotation.z=0;
  $('#destination').value=String(index);$('#place-title').textContent=place.name;$('#place-copy').textContent=place.copy;$('#height').textContent=`${Math.round(camera.position.y-1.7)} m`;updateNotes();drawMap();lastTreeUpdate=-10;if(notify)toast(place.name+' · You’re on the path');
}
function updateNotes(){
  $('#found').textContent=`${saved.length} / 5`;$('#stamps').innerHTML=places.map((p,i)=>`<i class="${saved.includes(i)?'saved':''}" title="${p.name}">${saved.includes(i)?'✓':i+1}</i>`).join('');$('#collect').textContent=saved.includes(state.place)?'✓ Moment saved':'＋ Save this moment';
}
function setWeather(name){state.weather=name;document.querySelectorAll('[data-weather]').forEach(b=>b.classList.toggle('active',b.dataset.weather===name));$('#weather-label').textContent={morning:'MORNING LIGHT',sunset:'GOLDEN HOUR',storm:'A STORM PASSES',snow:'WINTER STILLNESS'}[name];if(state.playing)toast({morning:'Birdsong returns to the mountain.',sunset:'Stay a while. Watch the light turn gold.',storm:'Rain on the path. Thunder across the river.',snow:'The forest becomes a little quieter.'}[name]);}
function lock(){if(state.overview)return;try{const promise=canvas.requestPointerLock?.();promise?.catch(()=>toast('Drag the scenery to look; use WASD or the arrows to walk.'));}catch{toast('Drag to look; use WASD or the arrows to walk.');}}
function start(){if(!state.ready)return;state.playing=true;$('#welcome').hidden=true;$('#hud').hidden=false;document.body.classList.add('playing');lock();audio.start().then(()=>{audio.toggle(true);$('#sound').textContent='Sound on';$('#sound').setAttribute('aria-label','Mute nature sound');}).catch(()=>toast('Sound could not load. You can still explore.'));}
function toggleOverview(){
  if(!state.ready)return;state.overview=!state.overview;
  if(state.overview){returnPose={position:camera.position.clone(),quaternion:camera.quaternion.clone()};controls.unlock();state.auto=false;$('#auto').classList.remove('active');$('#auto').textContent='▷ Guided walk';camera.position.set(1100,2900,1100);orbit.target.set(2450,90,-1600);orbit.enabled=true;camera.lookAt(orbit.target);$('#overview').textContent='Back to path ↙';$('#resume').hidden=true;toast('Drag to orbit · Scroll to zoom · Back to path to walk');}
  else{orbit.enabled=false;camera.position.copy(returnPose.position);camera.quaternion.copy(returnPose.quaternion);$('#overview').textContent='Overview ↗';$('#resume').hidden=false;}
}
function drawMap(){if(!routes)return;const c=$('#map').getContext('2d'),w=256,h=170;c.clearRect(0,0,w,h);const map=p=>[18+p[0]/5700*220,155+p[2]/4500*140];
  c.fillStyle='#79a8a322';c.beginPath();c.moveTo(0,0);c.lineTo(256,0);c.lineTo(245,18);for(const p of [...routes[3].points].reverse()){const [x,y]=map(p);c.lineTo(x,y);}c.lineTo(0,170);c.fill();
  routes.forEach((r,i)=>{c.beginPath();r.points.forEach((p,j)=>{const [x,y]=map(p);j?c.lineTo(x,y):c.moveTo(x,y);});c.strokeStyle=i===state.route?'#e2edb0':'#8da58177';c.lineWidth=i===state.route?1.5:.8;c.stroke();});
  places.forEach((p,i)=>{const [x,y]=map(world.bookmarks[p.bookmark].position);c.fillStyle=saved.includes(i)?'#e4eec0':'#839e80';c.beginPath();c.arc(x,y,2.6,0,7);c.fill();});const [x,y]=map(state.overview?returnPose.position.toArray():camera.position.toArray());c.fillStyle='#fffbe3';c.shadowColor='#effbbb';c.shadowBlur=7;c.beginPath();c.arc(x,y,3.3,0,7);c.fill();c.shadowBlur=0;
}
const direction=new THREE.Vector3(),right=new THREE.Vector3();
function animate(){
  requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),t=clock.elapsedTime;state.frames++;u.time.value=t;
  for(const key of ['sunset','storm','snow']){weather[key]=THREE.MathUtils.damp(weather[key],state.weather===key?1:0,.75,dt);u[key].value=weather[key];}
  hemi.intensity=2.3-weather.storm*1.5;sun.intensity=2.5-weather.storm*2.3-weather.snow*1.6;sun.color.setRGB(1,1-weather.sunset*.42,1-weather.sunset*.7);sun.position.y=650-weather.sunset*550;
  scene.fog.color.setRGB(.67+weather.sunset*.12-weather.storm*.40,.76-weather.sunset*.17-weather.storm*.40,.72-weather.sunset*.22-weather.storm*.33);scene.fog.density=.00026+weather.storm*.0007+weather.snow*.0004;
  sky.position.copy(camera.position);particles.position.copy(camera.position);particles.visible=weather.storm+weather.snow>.02&&!state.overview;
  if(weather.storm>.8&&t-lastLightning>17){lastLightning=t;flashTimer=.22;setTimeout(()=>{if(state.weather==='storm')audio.thunder();},1400);}
  flashTimer=Math.max(0,flashTimer-dt);u.flash.value=flashTimer>0?.65:0;sun.intensity+=u.flash.value*3;
  state.moving=false;
  if(state.playing&&!state.overview&&!$('#info').open){
    const f=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')?1:0),s=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')?1:0);
    if(f||s||state.auto){
      const before=camera.position.clone();let proposed=before.clone();
      if(state.auto){const n=nearestOnRoute([before.x,before.y-1.7,before.z],routes[state.route]);const target=routes[state.route].points[Math.min(n.index+3,routes[state.route].points.length-1)];direction.fromArray(target).sub(before);direction.y=0;if(direction.length()<.4){state.auto=false;$('#auto').classList.remove('active');$('#auto').textContent='▷ Guided walk';toast('End of this path. Choose another place to keep exploring.');}direction.normalize();proposed.addScaledVector(direction,2.2*dt);const desired=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(before,before.clone().add(direction),camera.up));camera.quaternion.slerp(desired,1-Math.exp(-dt*2));}
      else{camera.getWorldDirection(direction);direction.y=0;direction.normalize();right.crossVectors(direction,camera.up);direction.multiplyScalar(f).addScaledVector(right,s).normalize();proposed.addScaledVector(direction,(keys.has('ShiftLeft')||keys.has('ShiftRight')?5.2:2.1)*dt);}
      const safe=constrainToRoute([proposed.x,before.y-1.7,proposed.z],routes[state.route]);camera.position.fromArray(safe.position);const travel=Math.hypot(before.x-camera.position.x,before.z-camera.position.z);state.distance+=travel;state.moving=travel>.0005;
    }
  }
  if(state.overview)orbit.update();
  if(t-lastTreeUpdate>.8){lastTreeUpdate=t;updateTrees();}
  audio.update(weather,state.route===3?1:.03,state.moving);
  if(t-lastMap>.25){lastMap=t;drawMap();$('#distance').textContent=Math.floor(state.distance);$('#height').textContent=`${Math.round((state.overview?returnPose.position.y:camera.position.y)-1.7)} m`;}
  renderer.render(scene,camera);
}
$('#enter').addEventListener('click',start);$('#resume').onclick=lock;
$('#destination').onchange=e=>goTo(Number(e.target.value));
$('#overview').onclick=toggleOverview;
document.querySelectorAll('[data-weather]').forEach(b=>b.onclick=()=>setWeather(b.dataset.weather));
$('#sound').onclick=async()=>{try{await audio.start();audio.toggle(!audio.enabled);$('#sound').textContent=audio.enabled?'Sound on':'Sound off';$('#sound').setAttribute('aria-label',audio.enabled?'Mute nature sound':'Enable nature sound');}catch{toast('Audio unavailable. Please try again.');}};
$('#auto').onclick=()=>{if(state.overview)toggleOverview();state.auto=!state.auto;controls.unlock();$('#auto').classList.toggle('active',state.auto);$('#auto').textContent=state.auto?'Ⅱ Pause guided walk':'▷ Guided walk';$('#resume').hidden=state.auto;keys.clear();};
$('#collect').onclick=()=>{if(state.overview){toast('Return to the path to save this moment.');return;}if(!saved.includes(state.place)){saved.push(state.place);try{localStorage.setItem('mufu-notes',JSON.stringify(saved));}catch{}updateNotes();toast(saved.length===5?'Five moments collected. The mountain is yours to wander.':`${places[state.place].name} added to your field notes.`);}else toast('This moment is already in your field notes.');};
$('#postcard').onclick=()=>{renderer.render(scene,camera);canvas.toBlob(blob=>{if(!blob)return;const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`Mufu-${places[state.place].name.replaceAll(' ','-')}-${state.weather}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000);toast('Postcard saved. A small piece of the mountain.');});};
$('#help').onclick=()=>{controls?.unlock();keys.clear();$('#info').showModal();};$('#close-info').onclick=()=>$('#info').close();$('#reset-notes').onclick=()=>{saved=[];try{localStorage.removeItem('mufu-notes');}catch{}if(state.ready)updateNotes();toast('A fresh notebook for your next walk.');};
window.addEventListener('keydown',e=>{if(e.code==='Escape'){controls?.unlock();keys.clear();}if(e.target.matches('input,select,textarea')||$('#info').open)return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)){keys.add(e.code);e.preventDefault();}});window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>keys.clear());document.addEventListener('visibilitychange',()=>{keys.clear();if(document.hidden){audio.ctx?.suspend();}else if(audio.enabled)audio.ctx?.resume();});
let drag=null;canvas.addEventListener('pointerdown',e=>{if(!state.playing||state.overview||controls.isLocked)return;drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture(e.pointerId);});canvas.addEventListener('pointermove',e=>{if(!drag||controls.isLocked||state.overview)return;camera.rotation.y-=(e.clientX-drag.x)*.003;camera.rotation.x=THREE.MathUtils.clamp(camera.rotation.x-(e.clientY-drag.y)*.003,-1.3,1.3);drag.x=e.clientX;drag.y=e.clientY;});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);
const moveKeys={forward:'KeyW',back:'KeyS',left:'KeyA',right:'KeyD'};document.querySelectorAll('[data-move]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);keys.add(moveKeys[b.dataset.move]);};b.onpointerup=b.onpointercancel=()=>keys.delete(moveKeys[b.dataset.move]);});
document.addEventListener('pointerlockerror',()=>{toast('Mouse capture is unavailable. Drag to look and use the arrows.');});
window.addEventListener('resize',()=>{if(!renderer)return;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();toast('Graphics paused. Reload this page to restart the scene.');});
load();
