import * as THREE from 'three';
import {buildCityScene} from './city-scene.js';
import {planPose,projectPin} from './plan.js';
import {constrainToRoute} from './navigation.js';
import {flightStep,landingPoint} from './kite.js';
import {createSkyDome} from './sky.js';

// A separate illustrated atlas: its compressed map coordinates must never be
// confused with the photo-informed, unregistered Mufu reconstruction.
export async function createNanjing({camera,orbit,controls,postfx,state,shared,baseScene,kite,keys,reset,onMufu,onWeather,toast,rain,snow}) {
  const response=await fetch('/city/nanjing.json');
  if(!response.ok)throw Error('Nanjing map unavailable');
  const data=await response.json();
  const loader=new THREE.TextureLoader();
  const [foliage,meadow]=await Promise.all([
    loader.loadAsync('/city/art/foliage-gouache-v1.png'),loader.loadAsync('/city/art/meadow-gouache-v1.webp')]);
  for(const t of [foliage,meadow]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
  meadow.wrapS=meadow.wrapT=THREE.RepeatWrapping;
  const bands=new THREE.DataTexture(new Uint8Array([90,122,154,184,211,237,255]),7,1,THREE.RedFormat);
  bands.minFilter=bands.magFilter=THREE.NearestFilter;bands.needsUpdate=true;
  const grain=document.createElement('canvas');grain.width=grain.height=128;
  const ctx=grain.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,128,128);
  let seed=1357;for(let i=0;i<1400;i++){seed=(seed*16807)%2147483647;const x=seed%128;seed=(seed*16807)%2147483647;
    ctx.fillStyle=i%3?'#e5e3d4':'#c8cfb9';ctx.fillRect(x,seed%128,1,i%5===0?3:1);}
  const paper=new THREE.CanvasTexture(grain);paper.wrapS=paper.wrapT=THREE.RepeatWrapping;paper.repeat.set(1,1);
  function inkMaterial(name,color){
    const leaves=/foliage/.test(name),land=/relief/.test(name),stone=/warm stone/.test(name),wood=/bark/.test(name);
    const mat=new THREE.MeshToonMaterial({color:new THREE.Color(...color).convertSRGBToLinear(),gradientMap:bands,
      map:leaves?foliage:land?meadow:paper,side:THREE.DoubleSide,alphaTest:leaves?.38:0});
    mat.name=name;
    mat.onBeforeCompile=s=>{
      s.uniforms.citySnow=shared.snow;s.uniforms.cityTime=shared.time;
      s.fragmentShader='uniform float citySnow;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.89,.84),citySnow*.65);');
      if(land)s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace(
        'diffuseColor *= sampledDiffuseColor;','diffuseColor *= mix(vec4(1.),sampledDiffuseColor,.48);'));
      if(stone||wood){
        s.vertexShader='varying vec3 citySurface;varying float cityUp;\n'+s.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\ncitySurface=(modelMatrix*vec4(transformed,1.)).xyz;cityUp=abs(normal.y);');
        s.fragmentShader='varying vec3 citySurface;varying float cityUp;\n'+s.fragmentShader;
        s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
          vec2 surface=citySurface.xz;
          surface.x+=step(.5,fract(surface.y/2.4))*.8;
          vec2 cell=surface/vec2(1.6,1.2),edge=abs(fract(cell)-.5);
          float mortar=smoothstep(.45,.49,max(edge.x,edge.y))*(1.-smoothstep(.15,.65,max(fwidth(cell.x),fwidth(cell.y))));
          float pigment=fract(sin(dot(floor(cell),vec2(43.1,29.7)))*45718.31);
          diffuseColor.rgb*=mix(1.,.87+pigment*.16-mortar*.14,${stone?'cityUp':'0.'});
          ${wood?'diffuseColor.rgb*=.87+.13*sin(citySurface.y*.8+sin(citySurface.x*13.+citySurface.z*17.)*2.);':''}`);
      }
      if(/foliage/.test(name)){
        s.vertexShader='uniform float cityTime;\n'+s.vertexShader;
        s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\ntransformed.x+=sin(position.z*.7+cityTime)*.14;');
      }
    };mat.customProgramCacheKey=()=>`city-ink-v1-${leaves?'leaves':land?'terrain':stone?'stone':wood?'wood':'paper'}`;return mat;
  }
  const built=buildCityScene(data,shared,inkMaterial),{scene,places,routes,ground}=built;
  const cityDirection=new THREE.Vector3(),skyShared={...shared,uSunDir:{value:cityDirection}};
  const sky=createSkyDome(scene,skyShared).dome;sky.scale.setScalar(5);
  const hemi=new THREE.HemisphereLight(0xe1edf1,0x68766a,2.2),sun=new THREE.DirectionalLight(0xffecc5,2.0);
  scene.add(hemi,sun,sun.target);
  const cityRain=rain.clone(),citySnow=snow.clone();scene.add(cityRain,citySnow);
  const bounds=new THREE.Box3().setFromPoints(built.rings.flat().map(p=>new THREE.Vector3(...p))).expandByScalar(500);
  const $=s=>document.querySelector(s),records=[];
  let active=false,scope='central',selected=places.find(p=>p.id==='qinhuai'),lastFootstep=0;
  const icons={mount:'△',oldtown:'⌂',truss:'≋',cable:'≋',eye:'∞',lake:'≈',domes:'◉',tower:'♜',pagoda:'♜',temple:'♜',mausoleum:'▤',wall:'▥',skyline:'▥',tomb:'◇',palace:'⌂',springs:'♧'};
  for(const p of places){
    const pin=document.createElement('button');pin.className='city-pin';pin.dataset.city=p.id;
    pin.innerHTML=`<span class="city-label">${p.zh}<small>${p.name}</small></span><span class="city-dot">${icons[p.kind]||'◇'}</span>`;
    pin.title=`Explore ${p.name}`;pin.setAttribute('aria-label',pin.title);pin.onclick=()=>api.enter(p.id);
    $('#city-pins').append(pin);records.push({p,pin});
    const link=document.createElement('button');link.innerHTML=`<span>${icons[p.kind]||'◇'}</span><span>${p.zh}<small>${p.name}</small></span>`;
    link.dataset.city=p.id;link.onclick=()=>api.enter(p.id);$('#city-destinations').append(link);
  }
  function flying(value){state.flying=value;kite.bird.visible=value;document.body.classList.toggle('flying',value);
    $('#kite-toggle').setAttribute('aria-pressed',String(value));$('#kite-toggle').title=value?'Land on nearest path · K':'Fly bird kite · K';
    $('#kite-toggle').setAttribute('aria-label',value?'Land on nearest path (K)':'Launch bird kite (K)');$('#flight-touch').hidden=!value;keys.clear();}
  function useScene(){
    if(!active){reset();active=true;scene.add(camera);postfx.setScene(scene);document.body.classList.add('city-mode');
      $('.brand span').innerHTML='Nanjing <small>山水金陵 · An illustrated journey</small>';$('.brand').setAttribute('aria-label','Nanjing map');}
    $('#plan-home').hidden=true;$('#welcome').hidden=true;$('#hud').hidden=true;$('#resume').hidden=true;
    controls.unlock();$('#info').close();$('#city-menu').close();keys.clear();
  }
  function frameMap(){
    if(!active||!state.overview)return;
    orbit.enableDamping=false;orbit.update();
    const points=scope==='all'?built.rings.flat():places.filter(p=>p.region!=='south'&&p.region!=='east'&&!['niushou','third','eye'].includes(p.id)).map(p=>p.position);
    const pose=planPose(points,camera.aspect);camera.position.copy(pose.position);orbit.target.copy(pose.target);
    camera.fov=40;camera.near=30;camera.far=100000;camera.lookAt(orbit.target);camera.updateProjectionMatrix();
    orbit.minDistance=180;orbit.maxDistance=40000;orbit.update();orbit.enableDamping=true;updatePins();
  }
  function updatePins(){camera.updateMatrixWorld();let prior=[];
    records.forEach(({p,pin})=>{const a=projectPin(p.position,camera,innerWidth,innerHeight);
      pin.hidden=!a.visible;pin.style.left=`${a.x}px`;pin.style.top=`${a.y}px`;
      pin.classList.toggle('compact',prior.some(b=>Math.abs(b.x-a.x)<100&&Math.abs(b.y-a.y)<66));if(a.visible)prior.push(a);});}
  const boats=[];
  // Ships follow sampled public Yangtze centerlines rather than crossing land.
  built.riverLines.filter(r=>r.name==='长江'&&r.points.length>2).slice(0,8).forEach((r,i)=>{
    const boat=new THREE.Group();const hull=new THREE.Mesh(new THREE.BoxGeometry(10,1.6,3),new THREE.MeshToonMaterial({color:0x425b59,gradientMap:bands}));
    const cabin=new THREE.Mesh(new THREE.BoxGeometry(2,2,2.6),new THREE.MeshToonMaterial({color:0xece3c5,gradientMap:bands}));cabin.position.set(-2,1.5,0);boat.add(hull,cabin);
    scene.add(boat);boats.push({boat,line:new THREE.CatmullRomCurve3(r.points.map(p=>new THREE.Vector3(p[0],2.1,p[2]))),offset:i*.13});});
  const api={...built,data,
    get active(){return active;},get scope(){return scope;},get selected(){return selected;},
    showPlan(next=scope){useScene();scope=next;flying(false);state.playing=false;state.overview=true;state.moving=false;state.photoMode=false;
      orbit.enabled=true;document.body.classList.remove('playing','photo-mode','locked');document.body.classList.add('plan-mode');
      $('#nanjing-home').hidden=false;$('#walk-environment').hidden=true;$('#walk-menu').hidden=true;$('#back-to-plan').hidden=true;
      $('#city-scope').value=scope;frameMap();},
    enter(id){const p=places.find(p=>p.id===id);if(!p)throw Error('Unknown Nanjing destination');
      if(id==='mufu'){api.leave();onMufu();return;}
      useScene();selected=p;flying(false);state.playing=true;state.overview=false;state.photoMode=false;state.moving=false;
      orbit.enabled=false;camera.near=.12;camera.far=50000;camera.fov=68;camera.position.fromArray(p.spawn);
      camera.lookAt(new THREE.Vector3(...p.look));camera.rotation.order='YXZ';camera.updateProjectionMatrix();
      document.body.classList.remove('plan-mode','photo-mode');document.body.classList.add('playing');$('#nanjing-home').hidden=true;
      $('#walk-environment').hidden=false;$('#walk-menu').hidden=false;$('#back-to-plan').hidden=false;
      toast(`${p.zh} · WASD to walk · Drag to look · K to fly`);},
    leave(){if(!active)return;flying(false);active=false;reset();baseScene.add(camera);postfx.setScene(baseScene);
      $('#nanjing-home').hidden=true;$('#city-menu').close();document.body.classList.remove('city-mode');
      $('.brand span').innerHTML='Mufu <small>Choose a place to wander.</small>';$('.brand').setAttribute('aria-label','Mufu home');},
    toggleFlight(){if(state.overview)api.enter(selected.id);if(!active)return;
      if(state.flying){const landing=landingPoint(camera.position.toArray(),routes);camera.position.fromArray(landing.position);selected=places[landing.route];flying(false);toast('Landed on the nearest landmark path');}
      else{flying(true);camera.position.y=Math.max(camera.position.y+25,ground(camera.position.x,camera.position.z)+25);
        toast('WASD fly · E / Space up · Q down · Shift faster · K land');}},
    frame(dt,t,weather,direction){
      cityDirection.set(direction.x*.9412-direction.z*.3377,direction.y,direction.x*.3377+direction.z*.9412).normalize();
      sun.position.copy(camera.position).addScaledVector(cityDirection,900);sun.target.position.copy(camera.position);
      sun.intensity=(2.4-weather.storm*1.8-weather.snow*.8)*(1-weather.dawn*.6);
      sun.color.setRGB(1,1-weather.sunset*.3,1-weather.sunset*.55);hemi.intensity=1.35-weather.storm*.45-weather.dawn*.65;
      scene.fog.color.setRGB(.69+weather.sunset*.15-weather.storm*.36,.80-weather.sunset*.14-weather.storm*.38,.82-weather.sunset*.24-weather.storm*.32);
      scene.fog.density=state.overview?.000009:.00032+weather.storm*.0015+weather.snow*.001;
      sky.scale.setScalar(state.overview?5:1);sky.position.copy(camera.position);cityRain.position.copy(camera.position);citySnow.position.copy(camera.position);
      cityRain.visible=!state.overview&&weather.storm>.02;citySnow.visible=!state.overview&&weather.snow>.02;
      boats.forEach(({boat,line,offset})=>{const f=(t*.0008+offset)%1;boat.position.copy(line.getPointAt(f));const d=line.getTangentAt(f);boat.rotation.y=Math.atan2(-d.z,d.x);});
      built.landscape.update(camera,state.overview);
      if(state.overview){orbit.update();
        // Depth precision follows atlas zoom: lakes and land are close layers,
        // even when the whole municipality is thousands of units from the eye.
        camera.near=Math.max(10,camera.position.distanceTo(orbit.target)*.03);camera.updateProjectionMatrix();
        updatePins();state.moving=false;return false;}
      const forward=Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown'));
      const side=Number(keys.has('KeyD')||keys.has('ArrowRight'))-Number(keys.has('KeyA')||keys.has('ArrowLeft'));
      const up=Number(keys.has('KeyE')||keys.has('Space'))-Number(keys.has('KeyQ')||keys.has('ControlLeft')||keys.has('ControlRight'));
      const fast=keys.has('ShiftLeft')||keys.has('ShiftRight'),directionMove=new THREE.Vector3();camera.getWorldDirection(directionMove);
      state.moving=!!(forward||side||(state.flying&&up));
      if(state.flying){const next=flightStep(camera.position.toArray(),directionMove.toArray(),{forward,side,up,fast},dt,bounds);
        next[1]=Math.max(next[1],ground(next[0],next[2])+18);camera.position.fromArray(next);
        kite.bird.rotation.z=-side*.14+Math.sin(t*1.3)*.04;}
      else if(state.moving){directionMove.y=0;directionMove.normalize();const right=new THREE.Vector3().crossVectors(directionMove,new THREE.Vector3(0,1,0));
        directionMove.multiplyScalar(forward).addScaledVector(right,side).normalize();const intended=camera.position.clone().addScaledVector(directionMove,(fast?5.2:2.1)*dt);
        const next=constrainToRoute(intended.toArray(),routes[selected.route]).position;
        // Route interpolation gives deck height. On a hillside, the rendered
        // surface at the player's lateral offset can be higher than its centre.
        next[1]=Math.max(next[1],ground(next[0],next[2])+2.05);camera.position.fromArray(next);}
      const footstep=state.moving&&!state.flying&&t-lastFootstep>.52;if(footstep)lastFootstep=t;return footstep;
    },resize:frameMap,
    menu(){controls.unlock();keys.clear();$('#city-menu-title').textContent=selected.zh;
      $('#city-sound').textContent=$('#sound').textContent==='Sound on'?'Mute nature sound':'Enable nature sound';$('#city-menu').showModal();},
    stats(){return {active,scope,place:selected.id,landmarks:places.length,triangles:built.triangleCount+(built.landscape.stats.extraTriangles||0),ships:boats.length,illustrated:true,
      art:{style:'gouache-ink',foliageReady:!!foliage.image,meadowReady:!!meadow.image,water:'crossing-brush-ripples'},terrain:built.terrain.stats,landscape:{...built.landscape.stats}};},
  };
  $('#city-scope').onchange=e=>api.showPlan(e.target.value);$('#city-reset').onclick=frameMap;
  $('#city-map-return').onclick=()=>api.showPlan();$('#city-menu-close').onclick=()=>$('#city-menu').close();
  $('#city-mufu').onclick=()=>api.enter('mufu');$('#city-weather').onclick=()=>{const moods=['morning','sunset','storm','snow','dawn'];onWeather(moods[(moods.indexOf(state.weather)+1)%moods.length]);};
  $('#city-sound').onclick=()=>{$('#sound').click();$('#city-menu').close();};
  $('#nanjing-return').onclick=()=>api.showPlan();
  return api;
}
