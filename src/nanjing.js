import * as THREE from 'three';
import {buildCityScene} from './city-scene.js';
import {planPose,projectPin} from './plan.js';
import {constrainToRoute} from './navigation.js';
import {setArrivalCamera,clearOrbitMotion} from './city-camera.js';
import {flightStep,landingPoint} from './kite.js';
import {createSkyDome} from './sky.js';
import {arrivalFlight} from './city-arrival.js';
import {createCityGame} from './city-game-view.js';
import {STAMPS,FACTS,rankFor,MUFU_PHOTOS_NEEDED} from './city-game.js';

// A separate illustrated atlas: its compressed map coordinates must never be
// confused with the photo-informed, unregistered Mufu reconstruction.
export async function createNanjing({camera,orbit,controls,postfx,state,shared,baseScene,kite,keys,reset,onMufu,onWeather,toast,rain,snow}) {
  const response=await fetch('/city/nanjing.json');
  if(!response.ok)throw Error('Nanjing map unavailable');
  const data=await response.json();
  // Optional: roads baked offline. Missing or stale, the scene computes them instead.
  const roads=await fetch('/city/roads.json').then(r=>r.ok?r.json():null).catch(()=>null);
  const loader=new THREE.TextureLoader();
  const [foliage,meadow,tiles,brick,ochre,glass]=await Promise.all([
    loader.loadAsync('/city/art/foliage-gouache-v1.png'),loader.loadAsync('/city/art/meadow-gouache-v1.webp'),
    ...['tiles','brick','ochre','glass'].map(name=>loader.loadAsync(`/city/art/${name}-gouache-v1.webp`))]);
  for(const t of [foliage,meadow,tiles,brick,ochre,glass]){t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;}
  meadow.wrapS=meadow.wrapT=THREE.RepeatWrapping;
  for(const t of [tiles,brick,ochre,glass])t.wrapS=t.wrapT=THREE.MirroredRepeatWrapping;
  const bands=new THREE.DataTexture(new Uint8Array([90,122,154,184,211,237,255]),7,1,THREE.RedFormat);
  bands.minFilter=bands.magFilter=THREE.NearestFilter;bands.needsUpdate=true;
  const grain=document.createElement('canvas');grain.width=grain.height=128;
  const ctx=grain.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,128,128);
  let seed=1357;for(let i=0;i<1400;i++){seed=(seed*16807)%2147483647;const x=seed%128;seed=(seed*16807)%2147483647;
    ctx.fillStyle=i%3?'#e5e3d4':'#c8cfb9';ctx.fillRect(x,seed%128,1,i%5===0?3:1);}
  const paper=new THREE.CanvasTexture(grain);paper.wrapS=paper.wrapT=THREE.RepeatWrapping;paper.repeat.set(1,1);
  function inkMaterial(name,color){
    const leaves=/foliage/.test(name),land=/relief/.test(name),stone=/warm stone/.test(name),wood=/bark/.test(name);
    const architectural=/tiled roof|glazed roof/.test(name)?tiles:stone?brick:/ochre/.test(name)?ochre:/glass/.test(name)?glass:null;
    const mat=new THREE.MeshToonMaterial({color:new THREE.Color(...color).convertSRGBToLinear(),gradientMap:bands,
      map:leaves?foliage:land?meadow:architectural||paper,side:THREE.DoubleSide,alphaTest:leaves?.38:0});
    mat.name=name;
    mat.onBeforeCompile=s=>{
      s.uniforms.citySnow=shared.snow;s.uniforms.cityTime=shared.time;
      s.fragmentShader='uniform float citySnow;\n'+s.fragmentShader;
      s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.89,.84),citySnow*.65);');
      if(architectural)s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace(
        'diffuseColor *= sampledDiffuseColor;','diffuseColor *= mix(vec4(1.),sampledDiffuseColor,.45);'));
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
    };mat.customProgramCacheKey=()=>`city-ink-v2-${leaves?'leaves':land?'terrain':stone?'stone':wood?'wood':architectural?'architecture':'paper'}`;return mat;
  }
  const built=buildCityScene(data,shared,inkMaterial,{roads}),{scene,places,routes,ground}=built;
  const cityDirection=new THREE.Vector3(),skyShared={...shared,uSunDir:{value:cityDirection},uPainted:{value:1}};
  const sky=createSkyDome(scene,skyShared).dome;sky.scale.setScalar(5);
  const hemi=new THREE.HemisphereLight(0xcfe6ff,0x7d9456,2.2),sun=new THREE.DirectionalLight(0xffe7b8,2.0);
  scene.add(hemi,sun,sun.target);
  const cityRain=rain.clone(),citySnow=snow.clone();scene.add(cityRain,citySnow);
  const bounds=new THREE.Box3().setFromPoints(built.rings.flat().map(p=>new THREE.Vector3(...p))).expandByScalar(500);
  const $=s=>document.querySelector(s),records=[];
  const storage=(()=>{try{return window.localStorage;}catch{return null;}})();
  const gameView=createCityGame({scene,places,routes,ground,camera,shared,toast,storage,onChange:()=>refreshPins()});
  const game=gameView.game;
  let arrival=null,currentRoute=0,lastNearest=-1;
  // Routes now include the streets between landmarks, so a walker can pass from
  // one corridor to another where they meet. Boxes keep the per-frame test cheap.
  const boxes=routes.map(r=>{let a=1e9,b=1e9,c=-1e9,d=-1e9;for(const q of r.points){a=Math.min(a,q[0]);c=Math.max(c,q[0]);b=Math.min(b,q[2]);d=Math.max(d,q[2]);}
    const pad=r.width;return {x0:a-pad,z0:b-pad,x1:c+pad,z1:d+pad};});
  function stepNetwork(point,current){
    let best=null;
    for(let i=0;i<routes.length;i++){
      const b=boxes[i];if(point[0]<b.x0||point[0]>b.x1||point[2]<b.z0||point[2]>b.z1)continue;
      const c=constrainToRoute(point,routes[i]);
      const moved=Math.hypot(c.position[0]-point[0],c.position[2]-point[2]);
      // A corridor on a different level (a bridge deck over a road) is not a neighbour.
      if(Math.abs(c.near.position[1]-(point[1]-2.05))>5)continue;
      const score=moved-(i===current?.2:0);
      if(!best||score<best.score)best={score,route:i,position:c.position};
    }
    return best||{route:current,position:constrainToRoute(point,routes[current]).position};
  }
  function nearestPlace(position,radius=150){
    let best=null;
    for(const p of places){if(p.id==='mufu')continue;
      const d=Math.hypot(p.position[0]-position.x,p.position[2]-position.z);
      if(d<radius&&(!best||d<best.d))best={p,d};}
    return best?.p||null;
  }
  let active=false,scope='central',selected=places.find(p=>p.id==='qinhuai'),lastFootstep=0;
  const icons={mount:'△',oldtown:'⌂',truss:'≋',cable:'≋',eye:'∞',lake:'≈',domes:'◉',tower:'♜',pagoda:'♜',temple:'♜',mausoleum:'▤',wall:'▥',skyline:'▥',tomb:'◇',palace:'⌂',springs:'♧'};
  for(const p of places){
    const pin=document.createElement('button');pin.className='city-pin';pin.dataset.city=p.id;
    pin.innerHTML=`<span class="city-label">${p.zh}<small>${p.name}</small></span><span class="city-dot">${icons[p.kind]||'◇'}</span>`;
    pin.title=`Explore ${p.name}`;pin.setAttribute('aria-label',pin.title);pin.onclick=()=>api.enter(p.id,{drop:true});
    $('#city-pins').append(pin);records.push({p,pin});
    const link=document.createElement('button');link.innerHTML=`<span>${icons[p.kind]||'◇'}</span><span>${p.zh}<small>${p.name}</small></span>`;
    link.dataset.city=p.id;link.onclick=()=>api.enter(p.id,{drop:true});$('#city-destinations').append(link);
  }
  function refreshPins(){
    for(const {p,pin} of records){
      const sealed=game.stamped(p.id);
      pin.classList.toggle('sealed',sealed);
      const lamps=p.id==='mufu'?`${Math.min(game.mufuPhotos,MUFU_PHOTOS_NEEDED)}/${MUFU_PHOTOS_NEEDED} photographs`:`${game.count(p.id)}/3 lanterns`;
      pin.title=`Explore ${p.name} · ${sealed?'seal earned':lamps}`;pin.setAttribute('aria-label',pin.title);
    }
    const total=`${game.stampCount()}/${STAMPS.length}`;
    const chip=$('#plan-seals');if(chip)chip.textContent=total;
    const passport=$('#city-passport');if(passport?.open)renderPassport();
    gameView.refresh();
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
    const points=places.map(p=>p.position);
    const pose=planPose(points,camera.aspect);camera.position.copy(pose.position);orbit.target.copy(pose.target);
    camera.fov=40;camera.near=30;camera.far=100000;camera.lookAt(orbit.target);camera.updateProjectionMatrix();
    orbit.minDistance=180;orbit.maxDistance=7000;orbit.update();orbit.enableDamping=true;updatePins();
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
  // Switching places must not mean leaving the scene, finding the atlas and
  // re-entering a pin. This lists every destination, nearest first, from inside
  // the walk; one click drops in on that place's road.
  function renderPlaces(){
    const grid=$('#places-grid');if(!grid)return;
    const here=selected?.id,pos=camera.position;
    const rows=places.map(p=>({p,d:Math.hypot(p.position[0]-pos.x,p.position[2]-pos.z)})).sort((a,b)=>(a.p.id===here?-1:b.p.id===here?1:a.d-b.d));
    grid.innerHTML='';
    for(const {p,d} of rows){
      const card=document.createElement('button');card.type='button';card.setAttribute('role','listitem');card.dataset.id=p.id;card.dataset.seal=p.zh.slice(0,1);
      card.className='place-card'+(p.id===here?' here':'')+(game.stamped(p.id)?' sealed':'');
      const lamps=p.id==='mufu'?'<span>morning walk</span>':`<span class="lamps">${[0,1,2].map(i=>`<i class="${game.has(p.id,i)?'on':''}"></i>`).join('')}</span>`;
      const dist=p.id===here?'you are here':p.id==='mufu'?'':d<1000?`${Math.round(d/10)*10} m`:`${(d/1000).toFixed(1)} km`;
      card.innerHTML=`<b>${p.zh}</b><small>${p.name}</small><span class="where">${lamps}<span>${dist}</span></span>`;
      card.onclick=()=>{$('#city-places').close();api.enter(p.id,{drop:true});};
      grid.append(card);
    }
  }
  const walkable=()=>places.filter(p=>p.id!=='mufu');
  function renderPassport(){
    const grid=$('#passport-grid');if(!grid)return;
    const rank=game.rank();
    $('#passport-rank').textContent=`${rank.zh} · ${rank.en}${rank.next?` — ${rank.toNext} more seal${rank.toNext>1?'s':''} to ${rank.next.en}`:''}`;
    $('#passport-seals').textContent=String(game.stampCount());
    grid.innerHTML='';
    for(const id of STAMPS){
      const p=places.find(q=>q.id===id);if(!p)continue;
      const card=document.createElement('button');card.type='button';card.className='stamp-card'+(game.stamped(id)?' sealed':'');card.dataset.id=id;
      card.dataset.seal=p.zh.slice(0,1);card.setAttribute('role','listitem');
      const lamps=id==='mufu'?'':`<span class="lamps">${[0,1,2].map(i=>`<i class="${game.has(id,i)?'on':''}"></i>`).join('')}</span>`;
      const note=id==='mufu'?`<small>${Math.min(game.mufuPhotos,MUFU_PHOTOS_NEEDED)}/${MUFU_PHOTOS_NEEDED} morning photographs found</small>`:'';
      card.innerHTML=`<b>${p.zh}</b><small>${p.name}</small>${lamps}${note}`;
      const facts=document.createElement('ul');facts.className='stamp-facts';facts.hidden=true;
      FACTS[id].forEach((f,i)=>{const li=document.createElement('li');const known=id==='mufu'?game.stamped(id):game.has(id,i);
        if(known){li.textContent=f.t;const a=document.createElement('a');a.href=f.src;a.target='_blank';a.rel='noopener';a.textContent='source ↗';a.onclick=e=>e.stopPropagation();li.append(a);}
        else{li.className='locked';li.textContent=id==='mufu'?'Found on the morning walk.':'A lantern on this landmark’s approach tells this one.';}
        facts.append(li);});
      card.append(facts);
      card.onclick=()=>{facts.hidden=!facts.hidden;};
      const go=document.createElement('a');go.href='#';go.className='go';go.textContent=id==='mufu'?'Open the morning walk →':'Walk there →';go.style.cssText='display:inline-block;margin-top:8px;font-size:11px;color:#ffcb7d;text-decoration:none;';
      go.onclick=e=>{e.preventDefault();e.stopPropagation();$('#city-passport').close();api.enter(id,{drop:true});};
      card.append(go);
      grid.append(card);
    }
    const run=game.run,course=gameView.course;
    $('#passport-run-best').textContent=run.best?`Best ${run.best.toFixed(1)} s${run.medal?' · '+run.medal:''} · ${run.runs} run${run.runs>1?'s':''}`:`${course.rings.length} rings · about ${Math.round(course.length/34)} s at cruising speed`;
  }
  const api={...built,data,game,gameView,refreshPins,renderPassport,renderPlaces,
    openPlaces(open=true){const d=$('#city-places');if(!d||!active||state.overview)return;
      if(open){controls.unlock();keys.clear();$('#city-menu').close();renderPlaces();if(!d.open)d.showModal();}else d.close();},
    // [ and ] hop to the previous or next landmark in the atlas order.
    hop(step){if(!active||state.overview)return;const list=walkable(),i=list.findIndex(p=>p.id===selected?.id);
      api.enter(list[(Math.max(0,i)+step+list.length)%list.length].id,{drop:true});},
    passport(open=true){const d=$('#city-passport');if(!d)return;
      if(open){controls.unlock();keys.clear();$('#city-menu').close();renderPassport();if(!d.open)d.showModal();}else d.close();},
    startWindRun(){
      // enter() cancels any run in progress, so start the run afterwards.
      api.enter('bridge');state.flying=false;
      const pose=gameView.startRun();
      // Take off at the start line, climbing towards the first ring.
      selected=places.find(q=>q.id==='bridge');
      camera.position.fromArray(pose.position);camera.lookAt(...pose.look);camera.rotation.z=0;
      state.overview=false;flying(true);keys.clear();},
    get active(){return active;},get scope(){return scope;},get selected(){return selected;},
    showPlan(){arrival=null;gameView.cancelRun();useScene();scope='central';flying(false);state.playing=false;state.overview=true;state.moving=false;state.photoMode=false;
      orbit.enabled=true;document.body.classList.remove('playing','photo-mode','locked');document.body.classList.add('plan-mode');
      $('#nanjing-home').hidden=false;$('#walk-environment').hidden=true;$('#walk-menu').hidden=true;$('#walk-places').hidden=true;$('#back-to-plan').hidden=true;
      $('#city-scope').value=scope;frameMap();},
    // `drop` plays the descent onto the avenue. Pins and menus ask for it;
    // programmatic entry (tests, the debug API) stays instant and deterministic.
    enter(id,opts={}){const p=places.find(p=>p.id===id);if(!p)throw Error('Unknown Nanjing destination');
      if(id==='mufu'){api.leave();onMufu();return;}
      useScene();reset();clearOrbitMotion(orbit);selected=p;currentRoute=p.route;flying(false);gameView.cancelRun();arrival=null;
      state.playing=true;state.overview=false;state.photoMode=false;state.moving=false;
      setArrivalCamera(camera,p.spawn,p.look);gameView.setCurrent(p.id);
      if(opts.drop){const flight=arrivalFlight(p.spawn,p.look);arrival={flight,t:0,p,look:p.look};
        camera.position.fromArray(flight.at(0));camera.lookAt(...p.look);}
      document.body.classList.remove('plan-mode','photo-mode');document.body.classList.add('playing');$('#nanjing-home').hidden=true;
      $('#walk-environment').hidden=false;$('#walk-menu').hidden=false;$('#walk-places').hidden=false;$('#back-to-plan').hidden=false;
      if(!arrival)toast(`${p.zh} · WASD to walk · Drag to look · G places · K to fly`);},
    leave(){if(!active)return;flying(false);$('#walk-places').hidden=true;$('#city-places')?.close();active=false;reset();baseScene.add(camera);postfx.setScene(baseScene);
      $('#nanjing-home').hidden=true;$('#city-menu').close();document.body.classList.remove('city-mode');
      $('.brand span').innerHTML='Mufu <small>Choose a place to wander.</small>';$('.brand').setAttribute('aria-label','Mufu home');},
    toggleFlight(){if(state.overview)api.enter(selected.id);if(!active)return;
      if(state.flying){const landing=landingPoint(camera.position.toArray(),routes);camera.position.fromArray(landing.position);
        currentRoute=landing.route;selected=nearestPlace(camera.position,1e9)||selected;flying(false);gameView.cancelRun('Wind run ended');gameView.setCurrent(selected.id);toast('Landed on the nearest path');}
      else{flying(true);camera.position.y=Math.max(camera.position.y+25,ground(camera.position.x,camera.position.z)+25);
        toast('WASD fly · E / Space up · Q down · Shift faster · K land');}},
    frame(dt,t,weather,direction){
      cityDirection.set(direction.x*.9412-direction.z*.3377,direction.y,direction.x*.3377+direction.z*.9412).normalize();
      sun.position.copy(camera.position).addScaledVector(cityDirection,900);sun.target.position.copy(camera.position);
      sun.intensity=(2.4-weather.storm*1.8-weather.snow*.8)*(1-weather.dawn*.6);
      sun.color.setRGB(1,1-weather.sunset*.3,1-weather.sunset*.55);hemi.intensity=1.35-weather.storm*.45-weather.dawn*.65;
      scene.fog.color.setRGB(.60+weather.sunset*.30-weather.storm*.30,.78-weather.sunset*.22-weather.storm*.36,.92-weather.sunset*.34-weather.storm*.40);
      scene.fog.density=state.overview?.000009:.00032+weather.storm*.0015+weather.snow*.001;
      sky.scale.setScalar(state.overview?5:1);sky.position.copy(camera.position);cityRain.position.copy(camera.position);citySnow.position.copy(camera.position);
      cityRain.visible=!state.overview&&weather.storm>.02;citySnow.visible=!state.overview&&weather.snow>.02;
      boats.forEach(({boat,line,offset})=>{const f=(t*.0008+offset)%1;boat.position.copy(line.getPointAt(f));const d=line.getTangentAt(f);boat.rotation.y=Math.atan2(-d.z,d.x);});
      built.landscape.update(camera,state.overview);
      if(arrival){
        // The drop-in: any key or a click ends it at once, never trapping the visitor.
        const interrupted=keys.size>0||arrival.skip;
        arrival.t+=dt;
        if(interrupted||arrival.t>=arrival.flight.seconds){const p=arrival.p;arrival=null;setArrivalCamera(camera,p.spawn,p.look);
          toast(`${p.zh} · WASD to walk · Drag to look · G places · K to fly`);}
        else{const pos=arrival.flight.at(arrival.t);pos[1]=Math.max(pos[1],ground(pos[0],pos[2])+6);
          camera.position.fromArray(pos);camera.lookAt(...arrival.look);camera.rotation.z=0;}
        state.moving=false;return false;
      }
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
        const hit=stepNetwork(intended.toArray(),currentRoute);currentRoute=hit.route;const next=hit.position;
        // Route interpolation gives deck height. On a hillside, the rendered
        // surface at the player's lateral offset can be higher than its centre.
        next[1]=Math.max(next[1],ground(next[0],next[2])+2.05);camera.position.fromArray(next);}
      // Which landmark is near, and anything to pick up: a few times a second is plenty.
      // On a landmark's own corridor the landmark is known; only on a street between
      // landmarks does proximity decide (an avenue can pass nearer a neighbour's centre).
      if(t-lastNearest>.25){lastNearest=t;const own=currentRoute<places.length?places[currentRoute]:null;
        const near=own&&own.id!=='mufu'?own:nearestPlace(camera.position);if(near){selected=near;gameView.setCurrent(near.id);}}
      gameView.update(dt,t,{flying:state.flying});
      const footstep=state.moving&&!state.flying&&t-lastFootstep>.52;if(footstep)lastFootstep=t;return footstep;
    },resize:frameMap,
    menu(){controls.unlock();keys.clear();$('#city-menu-title').textContent=selected.zh;
      $('#city-sound').textContent=$('#sound').textContent==='Sound on'?'Mute nature sound':'Enable nature sound';$('#city-menu').showModal();},
    stats(){return {active,scope,place:selected.id,landmarks:places.length,triangles:built.triangleCount+(built.landscape.stats.extraTriangles||0),ships:boats.length,illustrated:true,
      art:{style:'gouache-ink',foliageReady:!!foliage.image,meadowReady:!!meadow.image,architectureReady:[tiles,brick,ochre,glass].every(t=>!!t.image),landmarkDesign:'photo-informed-v2',water:'crossing-brush-ripples'},terrain:built.terrain.stats,landscape:{...built.landscape.stats}};},
  };
  $('#city-passport-open').onclick=()=>api.passport(true);$('#city-passport-plan').onclick=()=>api.passport(true);
  $('#passport-close').onclick=()=>api.passport(false);
  $('#walk-places').onclick=()=>api.openPlaces(true);$('#places-close').onclick=()=>$('#city-places').close();
  $('#places-map').onclick=()=>{$('#city-places').close();api.showPlan();};
  $('#passport-run').onclick=()=>{api.passport(false);api.startWindRun();};
  $('#passport-reset').onclick=()=>{if(confirm('Clear all lanterns, seals and your best run?'))game.reset();};
  addEventListener('pointerdown',()=>{if(arrival)arrival.skip=true;},true);
  refreshPins();
  $('#city-scope').onchange=e=>api.showPlan(e.target.value);$('#city-reset').onclick=frameMap;
  $('#city-map-return').onclick=()=>api.showPlan();$('#city-menu-close').onclick=()=>$('#city-menu').close();
  $('#city-mufu').onclick=()=>api.enter('mufu');$('#city-weather').onclick=()=>{const moods=['morning','sunset','storm','snow','dawn'];onWeather(moods[(moods.indexOf(state.weather)+1)%moods.length]);};
  $('#city-sound').onclick=()=>{$('#sound').click();$('#city-menu').close();};
  $('#nanjing-return').onclick=()=>api.showPlan();
  return api;
}
