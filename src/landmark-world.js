import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {createSkyDome} from './sky.js';
import {flightStep} from './kite.js';
import {createTraveller, createMagpie, createGlider} from './traveller.js';

// A landmark scene modelled in Blender (blender/build_<id>.py, exported by blender/export_web.py)
// and streamed on arrival. Unlike the atlas it is in true metres: the walker's eye is 1.65 m, the
// 392 steps are real steps, and walking is free over a ray-cast walk grid instead of corridors.

const EYE = 1.65, SIT_EYE = 1.15, STEP_UP = .65, WALK = 1.7, RUN = 4.6;

// Palette names from design/ART-BIBLE.md; the GLB carries them as material names.
const PAINT = {
  lawn: {mottle: .10, scale: .18}, forest_floor: {mottle: .14, scale: .09}, paving: {mottle: .05, scale: .7, joints: 1},
  paving_joint: {mottle: .05, scale: .7}, granite: {mottle: .04, scale: .5, joints: .6}, granite_shade: {mottle: .05, scale: .5},
  hedge: {mottle: .12, scale: 1.2}, vine: {mottle: .16, scale: 1.4}, water: {mottle: 0, scale: 1},
  // Skyline towers: painted floor bands and mullions, windows that light up at dusk.
  tower_glass: {mottle: .03, scale: .3, windows: 1}, tower_glass_dark: {mottle: .03, scale: .3, windows: 1},
  tower_stone: {mottle: .04, scale: .3, windows: .7}, city_glass: {mottle: .03, scale: .3, windows: 1},
};

// The shared skyline (blender/build_skyline.py), fetched once and placed in every world by origin.
let skylinePromise = null;
function loadSkyline(loader) {
  skylinePromise ||= Promise.all([
    fetch('/scenes/skyline/skyline.json').then(r => r.ok ? r.json() : null),
    loader.loadAsync('/scenes/skyline/skyline.glb'),
  ]).then(([meta, gltf]) => (meta ? {meta, scene: gltf.scene} : null)).catch(e => { console.warn('skyline', e); return null; });
  return skylinePromise;
}

// Look-dev tree kinds (blender/kit.py tree_prototypes) drawn as soft painted balls: a few crown
// lobes with normals pointing out of the crown's centre, so banded toon light reads as gouache.
const TREES = {
  broadleaf: {crown: '#5E8F3A', trunk: '#5A4636', h: 14, r: 5.0, lobes: 5},
  broadleaf_sun: {crown: '#A7C24A', trunk: '#5A4636', h: 12, r: 4.2, lobes: 4},
  broadleaf_shade: {crown: '#2F5A3A', trunk: '#5A4636', h: 16, r: 5.5, lobes: 6},
  plane_autumn: {crown: '#E2B233', trunk: '#B9B39A', h: 18, r: 5.5, lobes: 5},
  maple_autumn: {crown: '#D0622E', trunk: '#5A4636', h: 9, r: 3.6, lobes: 4},
  // Far canopy beyond the walkable area: one crown, no trunk, ~20 triangles.
  far: {crown: '#5A8A3C', trunk: '#5A4636', h: 12, r: 4.6, lobes: 0, far: true},
  cedar: {crown: '#3D5E3F', trunk: '#5A4636', h: 18, r: 4.2, cone: 5},
  cypress: {crown: '#3D5E3F', trunk: '#5A4636', h: 9, r: 1.6, cone: 4},
  // Old-city kinds (blender/kit_oldcity.py extra_prototypes).
  cherry: {crown: '#F2B8C6', trunk: '#4A3A34', h: 8, r: 3.8, lobes: 5},
  willow: {crown: '#9DBF4A', trunk: '#5A4636', h: 10, r: 4.2, lobes: 6, hang: true},
  lotus: {crown: '#5E9B4A', lotus: true},
  lotus_flower: {crown: '#F4A6B8', flower: true},
};

function treeGeometry(spec, seed) {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const parts = [], colour = (g, hex) => {
    const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
  };
  if (spec.lotus || spec.flower) return lotusGeometry(spec, colour);
  if (!spec.far) {
    const trunk = new THREE.CylinderGeometry(spec.r * .06, spec.r * .09, spec.h * .62, 5, 1, true).toNonIndexed();
    trunk.translate(0, spec.h * .31, 0);
    parts.push(colour(trunk, spec.trunk));
  }
  if (spec.far) {
    const g = new THREE.IcosahedronGeometry(spec.r, 0).toNonIndexed();
    g.scale(1, .8, 1); g.translate(0, spec.h * .75, 0);
    const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3(0, spec.h * .75, 0);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).sub(c).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
    parts.push(colour(g, '#ffffff'));
  } else if (spec.cone) {
    for (let k = 0; k < spec.cone; k++) {
      const t = k / spec.cone, g = new THREE.ConeGeometry(spec.r * (1 - t * .75), spec.h * .42, 8, 1).toNonIndexed();
      g.translate(0, spec.h * (.32 + .6 * t), 0);
      parts.push(colour(g, spec.crown));
    }
  } else {
    const centre = new THREE.Vector3(0, spec.h * .74, 0);
    for (let k = 0; k <= spec.lobes; k++) {
      const top = k === spec.lobes, a = 6.283 * k / spec.lobes + rand();
      if (spec.hang && top) continue;
      const rr = top ? spec.r * .72 : spec.r * (.5 + .22 * rand());
      // Detail 0 lobes (20 triangles) under a detail 1 top: ~150 triangles a tree, 6,800 trees.
      const g = new THREE.IcosahedronGeometry(rr, top ? 1 : 0).toNonIndexed();
      const c = top ? new THREE.Vector3(0, spec.h * .82, 0)
        : new THREE.Vector3(Math.cos(a) * spec.r * .45, spec.h * (.62 + .16 * rand()), Math.sin(a) * spec.r * .45);
      // Willows: long lobes hanging from the crown, like curtains of leaves.
      if (spec.hang) { g.scale(.55, 2.1, .55); c.y = spec.h * .52; }
      g.translate(c.x, c.y, c.z);
      // Spherical normals about the whole crown: lobes shade as one soft mass.
      const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).sub(centre).normalize();
        n.setXYZ(i, v.x, v.y, v.z);
      }
      parts.push(colour(g, spec.crown));
    }
  }
  // Manual merge (all non-indexed, same attributes).
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0);
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const arr = new Float32Array(total * 3);
    let o = 0;
    for (const g of parts) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}

// Lotus: a few cupped round leaves held at different heights above the water (the photographs
// show a crowd of raised leaves, not flat pads); a flower is a pink cup on its own leaf.
function lotusGeometry(spec, colour) {
  const parts = [];
  const leaf = (r, x, y, z, hex) => {
    const g = new THREE.ConeGeometry(r, r * .28, 9, 1, true).toNonIndexed();
    g.rotateX(Math.PI); g.translate(x, y + r * .14, z);
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * .3, 1, n.getZ(i) * .3);
    parts.push(colour(g, hex));
  };
  if (spec.flower) {
    leaf(.5, .1, .05, 0, '#5E9B4A');
    const cup = new THREE.ConeGeometry(.2, .32, 6, 1, true).toNonIndexed();
    cup.rotateX(Math.PI); cup.translate(0, .55, 0);
    parts.push(colour(cup, spec.crown));
  } else {
    leaf(.55, 0, .05, 0, spec.crown); leaf(.42, .5, .45, .2, '#6FAE52'); leaf(.38, -.35, .7, -.4, '#4E8A44');
  }
  const total = parts.reduce((n, g) => n + g.attributes.position.count, 0), out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'color']) {
    const arr = new Float32Array(total * 3);
    let o = 0;
    for (const g of parts) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, 3));
  }
  return out;
}

export async function loadLandmarkWorld(id, {shared, skyShared, bands, rain, snow, onProgress}) {
  const base = `/scenes/${id}/`;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const [meta, gltf, walkBuf, trees] = await Promise.all([
    fetch(base + 'scene.json').then(r => r.json()),
    loader.loadAsync(base + 'static.glb', e => onProgress?.(e.total ? e.loaded / e.total : 0)),
    fetch(base + 'walk.bin').then(r => r.arrayBuffer()),
    fetch(base + 'trees.json').then(r => r.json()),
  ]);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xa8d0ea, .0011);
  const walk = meta.walk, heights = new Int16Array(walkBuf);

  // --- Painted toon materials keyed on palette names ---------------------------------------------
  const cache = new Map(), hazeColor = {value: new THREE.Color(0xa8d0ea)};
  // far: skyline materials skip the scene fog (it would swallow towers kilometres away) and take a
  // gentler haze of their own, so the city stays recognisable on the horizon.
  function paint(src, far = false) {
    const name = (src.name || 'granite').replace(/\.\d+$/, '');
    const key = (far ? 'far:' : '') + name;
    if (cache.has(key)) return cache.get(key);
    const style = PAINT[name] || {mottle: .05, scale: .6};
    const mat = new THREE.MeshToonMaterial({color: src.color.clone(), gradientMap: bands, side: THREE.FrontSide});
    mat.name = name;
    if (far) mat.fog = false;
    if (name === 'water') { mat.color.multiplyScalar(1.05); mat.emissive = new THREE.Color(0x0b2f3a); }
    // Lanterns and lit windows glow; the bloom pass turns them into soft lights at dusk.
    if (name === 'lantern') { mat.emissive = new THREE.Color(0xe8473a); mat.emissiveIntensity = .9; }
    if (name === 'lantern_glow') { mat.emissive = new THREE.Color(0xffb347); mat.emissiveIntensity = .75; }
    // The Bao'en tower's glass: a pale green-white glow, as it is lit at night.
    if (name === 'glass_glow') { mat.emissive = new THREE.Color(0xbfe8d2); mat.emissiveIntensity = .55; }
    mat.onBeforeCompile = s => {
      s.uniforms.citySnow = shared.snow; s.uniforms.worldMottle = {value: style.mottle}; s.uniforms.worldScale = {value: style.scale};
      s.uniforms.worldJoints = {value: style.joints || 0}; s.uniforms.cityTime = shared.time;
      s.uniforms.worldWater = {value: name === 'water' ? 1 : 0};
      s.uniforms.worldWindows = {value: style.windows || 0};
      s.uniforms.citySunset = shared.sunset || {value: 0}; s.uniforms.cityDawn = shared.dawn || {value: 0};
      s.uniforms.worldFar = {value: far ? 1 : 0}; s.uniforms.hazeColor = hazeColor;
      s.vertexShader = 'varying vec3 vWorldPos;varying float vUp;\n' + s.vertexShader.replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorldPos=(modelMatrix*vec4(transformed,1.)).xyz;vUp=normalize(mat3(modelMatrix)*objectNormal).y;');
      s.fragmentShader = 'uniform float citySnow,worldMottle,worldScale,worldJoints,cityTime,worldWater,worldWindows,citySunset,cityDawn,worldFar;uniform vec3 hazeColor;varying vec3 vWorldPos;varying float vUp;\n' +
        'float lwHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\n' +
        'float lwNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(lwHash(i),lwHash(i+vec2(1,0)),f.x),mix(lwHash(i+vec2(0,1)),lwHash(i+1.),f.x),f.y);}\n' +
        s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
          // Gouache mottling: two octaves of world-space value noise, stronger on open ground.
          vec2 q=vWorldPos.xz*worldScale;
          float m=lwNoise(q)*.65+lwNoise(q*3.7)*.35;
          diffuseColor.rgb*=1.+(m-.5)*2.*worldMottle;
          // Stone slabs on level stone: staggered 1.6 x 1.1 m joints, faded out where they would alias.
          vec2 slab=vWorldPos.xz/vec2(1.6,1.1);slab.x+=step(.5,fract(slab.y*.5))*.5;
          vec2 e=abs(fract(slab)-.5);float fw=max(fwidth(slab.x),fwidth(slab.y));
          float joint=smoothstep(.46,.49,max(e.x,e.y))*(1.-smoothstep(.08,.4,fw))*smoothstep(.85,.98,vUp);
          diffuseColor.rgb*=1.-joint*.22*worldJoints;
          float tone=lwHash(floor(slab));diffuseColor.rgb*=1.+(tone-.5)*.06*worldJoints*smoothstep(.85,.98,vUp);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.9,.86),citySnow*.7*smoothstep(.4,.9,vUp));
          // Water: drifting brush ripples, and the pale sky at grazing angles.
          if(worldWater>.5){
            vec2 w=vWorldPos.xz*.08;
            float rip=lwNoise(w+vec2(cityTime*.05,cityTime*.03))*.6+lwNoise(w*3.1-vec2(cityTime*.09,0.))*.4;
            // vNormal, not normal: at color_fragment the latter is not declared yet.
            float fres=pow(1.-clamp(dot(normalize(vViewPosition),normalize(vNormal)),0.,1.),4.);
            diffuseColor.rgb=mix(diffuseColor.rgb*(.9+rip*.22),vec3(.78,.88,.96),fres*.35);
            diffuseColor.rgb+=smoothstep(.78,.86,rip)*.08;
          }
          // Towers: 3.8 m floor bands and 2.4 m mullions on the walls.
          float winLit=0.;
          if(worldWindows>0.){
            float side=1.-smoothstep(.2,.4,abs(vUp));
            vec2 cell=vec2((vWorldPos.x+vWorldPos.z)/2.4,vWorldPos.y/3.8);
            vec2 f=fract(cell);float fw2=max(fwidth(cell.x),fwidth(cell.y));
            float frame=max(smoothstep(.82,.9,f.y),smoothstep(.9,.96,f.x))*(1.-smoothstep(.2,.6,fw2));
            diffuseColor.rgb*=1.-frame*.18*side*worldWindows;
            winLit=step(.62,lwHash(floor(cell)))*side*(1.-frame);
          }`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // At dusk and dawn a third of the windows glow warm.
          totalEmissiveRadiance+=winLit*worldWindows*clamp(citySunset+cityDawn,0.,1.)*vec3(1.,.74,.42)*.9;`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          // Skyline haze: towers fade toward the sky colour with distance, never to nothing.
          if(worldFar>.5){float d=length(vViewPosition);gl_FragColor.rgb=mix(gl_FragColor.rgb,hazeColor,smoothstep(800.,9000.,d)*.62);}`);
    };
    mat.customProgramCacheKey = () => 'landmark-paint-v5';
    cache.set(name, mat);
    return mat;
  }
  let staticTriangles = 0;
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    o.material = Array.isArray(o.material) ? o.material.map(paint) : paint(o.material);
    o.castShadow = false; o.receiveShadow = false;
    staticTriangles += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
  });
  scene.add(gltf.scene);

  // The city's towers on the horizon, wherever this world is.
  const skyline = await loadSkyline(loader);
  if (skyline && meta.origin_wgs84?.length === 2) {
    const [olat, olon] = meta.origin_wgs84, [clat, clon] = skyline.meta.origin_wgs84;
    const sx = (clon - olon) * 111320 * Math.cos(olat * Math.PI / 180), sy = (clat - olat) * 110574;
    const g = skyline.scene.clone(true);
    g.position.set(sx, -(meta.base_z || 0), -sy);
    g.traverse(o => { if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(m => paint(m, true)) : paint(o.material, true); o.castShadow = o.receiveShadow = false; o.frustumCulled = false; } });
    g.name = 'skyline';
    scene.add(g);
  }

  // --- Trees: one instanced draw per kind, swaying with the shared clock --------------------------
  const byKind = {};
  for (const t of trees) (byKind[t[0]] ||= []).push(t);
  const treeMat = new THREE.MeshToonMaterial({vertexColors: true, gradientMap: bands});
  treeMat.onBeforeCompile = s => {
    s.uniforms.cityTime = shared.time; s.uniforms.citySnow = shared.snow;
    s.vertexShader = 'uniform float cityTime;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float sway=smoothstep(2.,14.,transformed.y);
      vec3 o=instanceMatrix[3].xyz;
      transformed.x+=sin(cityTime*.9+o.x*.05+o.z*.07)*.18*sway;transformed.z+=cos(cityTime*.7+o.x*.06)*.12*sway;`);
    s.fragmentShader = 'uniform float citySnow;\n' + s.fragmentShader.replace('#include <color_fragment>',
      '#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.9,.92,.9),citySnow*.45);');
  };
  treeMat.customProgramCacheKey = () => 'landmark-trees-v1';
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  let treeTriangles = 0;
  for (const [kind, list] of Object.entries(byKind)) {
    const spec = TREES[kind] || TREES.broadleaf, geo = treeGeometry(spec, 101 + kind.length * 17);
    const inst = new THREE.InstancedMesh(geo, treeMat, list.length);
    // Per-tree tint: far crowns pick from the canopy palette so the forest reads as painted
    // patches, near trees vary a little in value.
    // Far crowns are white in the geometry, so the instance colour is the colour.
    const tints = spec.far ? ['#5A8A3C', '#6E9B3E', '#47733A', '#86A84A', '#3E6A3E'].map(h => new THREE.Color(h)) : null;
    const tint = new THREE.Color();
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, t[4]); sc.setScalar(t[5]); pos.set(t[1], t[2], t[3]);
      inst.setMatrixAt(i, m4.compose(pos, q, sc));
      const r = Math.abs(Math.sin(t[1] * 12.9898 + t[3] * 78.233)) % 1;
      if (tints) tint.copy(tints[Math.floor(r * tints.length) % tints.length]); else tint.setScalar(.9 + r * .2);
      inst.setColorAt(i, tint);
    });
    inst.computeBoundingSphere(); inst.name = `trees ${kind}`;
    scene.add(inst);
    treeTriangles += geo.attributes.position.count / 3 * list.length;
  }

  // --- Light, sky, weather --------------------------------------------------------------------------
  const sky = createSkyDome(scene, skyShared).dome;
  // Softer than the atlas: at true scale the pale granite and paving fill the frame and glare.
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6d8a4a, 1.1), sun = new THREE.DirectionalLight(0xffe7b8, 2.0);
  scene.add(hemi, sun, sun.target);
  const worldRain = rain.clone(), worldSnow = snow.clone();
  scene.add(worldRain, worldSnow);

  // --- Walk grid ------------------------------------------------------------------------------------
  // One grid per scene area (the Mausoleum and Music Stage, Meiling), concatenated in walk.bin.
  function cellOf(x, z) {
    for (const g of walk.grids) {
      const c = g.cell || walk.cell, i = Math.floor((x - g.x0) / c), j = Math.floor((-z - g.y0) / c);
      if (i >= 0 && j >= 0 && i < g.nx && j < g.ny) return g.offset + j * g.nx + i;
    }
    return -1;
  }
  function heightAt(x, z) {
    const c = cellOf(x, z);
    if (c < 0 || heights[c] === walk.noWalk) return null;
    return heights[c] / 100;
  }
  // Smoothed surface for the eye: averages walkable neighbours within half a step, so stairs
  // feel like a steady climb rather than a camera that judders on every riser.
  function surface(x, z) {
    const h0 = heightAt(x, z);
    if (h0 === null) return null;
    let sum = 0, n = 0;
    for (const [dx, dz] of [[0, 0], [.7, 0], [-.7, 0], [0, .7], [0, -.7]]) {
      const h = heightAt(x + dx, z + dz);
      if (h !== null && Math.abs(h - h0) < STEP_UP) { sum += h; n++; }
    }
    return sum / n;
  }
  function canStep(from, x, z) {
    const h0 = heightAt(from.x, from.z), h1 = heightAt(x, z);
    return h1 !== null && (h0 === null || Math.abs(h1 - h0) <= STEP_UP);
  }

  // --- Pigeons over the Music Stage: circle, glide, settle on the lawn, take off again ---------------
  const musicSpawn = meta.spawns.music, seats = Object.entries(meta.seats).map(([k, v]) => ({id: k, ...v}));
  const stage = musicSpawn ? new THREE.Vector3(...musicSpawn.look) : null;
  const pigeons = [];
  if (stage) {
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -.12, 0, 0, .14, -.34, .02, 0, 0, 0, -.12, .34, .02, 0, 0, 0, .14], 3));
    wing.computeVertexNormals();
    const birdMat = new THREE.MeshToonMaterial({color: 0xf4f2ea, gradientMap: bands, side: THREE.DoubleSide});
    const flock = new THREE.InstancedMesh(wing, birdMat, 36);
    flock.frustumCulled = false; scene.add(flock);
    // The bowl centre sits ~32 m in front of the stage, between stage and seats.
    const bowl = stage.clone().lerp(new THREE.Vector3(...musicSpawn.position), .45);
    for (let i = 0; i < 36; i++) pigeons.push({phase: i * 1.7, r: 9 + (i % 7) * 2.2, h: 7 + (i % 5) * 2.5, speed: .32 + (i % 4) * .05,
      landed: 0, rest: 0, spot: new THREE.Vector3()});
    Object.assign(pigeons, {flock, bowl});
  }
  const dummy = new THREE.Object3D();
  // Falling cherry petals round the walker wherever cherries grow (Jiming Road, Taicheng).
  const cherries = trees.filter(t => t[0] === 'cherry').map(t => new THREE.Vector2(t[1], t[3]));
  const petals = cherries.length ? (() => {
    const g = new THREE.PlaneGeometry(.07, .05);
    const m = new THREE.MeshToonMaterial({color: 0xf6c3cf, gradientMap: bands, side: THREE.DoubleSide});
    const mesh = new THREE.InstancedMesh(g, m, 700); mesh.frustumCulled = false; scene.add(mesh);
    const ps = Array.from({length: 700}, (_, i) => ({p: new THREE.Vector3(), v: new THREE.Vector3(), spin: i, live: 0}));
    return {mesh, ps, burst: 0};
  })() : null;
  function nearCherry(p, r = 14) { for (const c of cherries) if (Math.abs(c.x - p.x) < r && Math.abs(c.y - p.z) < r) return true; return false; }
  function updatePetals(t, dt, centre) {
    if (!petals) return;
    const active = nearCherry(centre, 22) || petals.burst > 0;
    petals.burst = Math.max(0, petals.burst - dt);
    const rate = active ? (petals.burst > 0 ? 400 : 60) : 0;
    let spawn = rate * dt;
    petals.ps.forEach((q, i) => {
      if (q.live <= 0 && spawn > 0 && Math.random() < spawn / 20) {
        spawn -= 1;
        q.p.set(centre.x + (Math.random() - .5) * 30, centre.y + 4 + Math.random() * 6, centre.z + (Math.random() - .5) * 30);
        q.v.set(.4 + Math.random() * .4, -(.5 + Math.random() * .4), .2 * (Math.random() - .5)); q.live = 14;
      }
      if (q.live > 0) {
        q.live -= dt; q.p.addScaledVector(q.v, dt); q.p.x += Math.sin(t * 1.7 + i) * .3 * dt;
        const g = surface(q.p.x, q.p.z);
        if (g !== null && q.p.y < g + .03) { q.p.y = g + .03; q.v.set(0, 0, 0); }
      }
      dummy.position.copy(q.p); dummy.rotation.set(t * 2 + q.spin, t * 1.3 + q.spin * .7, 0);
      dummy.scale.setScalar(q.live > 0 ? 1 : 0); dummy.updateMatrix(); petals.mesh.setMatrixAt(i, dummy.matrix);
    });
    petals.mesh.instanceMatrix.needsUpdate = true;
  }
  function updatePigeons(t, dt, calm) {
    if (!pigeons.flock) return;
    pigeons.forEach((p, i) => {
      // Sitting visitors make the flock braver: more birds come down to the lawn near them.
      if (!p.landed && Math.random() < dt * (calm ? .05 : .01)) {
        p.landed = 1; p.rest = 4 + Math.random() * 10;
        const a = Math.random() * 6.283, d = 4 + Math.random() * 18;
        p.spot.set(pigeons.bowl.x + Math.cos(a) * d, 0, pigeons.bowl.z + Math.sin(a) * d);
        p.spot.y = (heightAt(p.spot.x, p.spot.z) ?? pigeons.bowl.y) + .12;
      }
      const a = t * p.speed + p.phase;
      const air = new THREE.Vector3(pigeons.bowl.x + Math.cos(a) * p.r, pigeons.bowl.y + p.h + Math.sin(a * 2.1) * 1.2,
        pigeons.bowl.z + Math.sin(a) * p.r);
      if (p.landed) { p.rest -= dt; p.landed = p.rest > 0 ? Math.min(1, p.landed + dt * .6) : Math.max(0, p.landed - dt * .8); if (p.rest <= 0 && p.landed < .02) p.landed = 0; }
      const k = THREE.MathUtils.smoothstep(p.landed, 0, 1);
      dummy.position.copy(air).lerp(p.spot, k);
      dummy.rotation.set(0, -a, 0);
      const flap = k > .95 ? 0 : Math.sin(t * 14 + i) * .9 * (1 - k);
      dummy.scale.set(1, 1 + flap, 1);
      dummy.updateMatrix(); pigeons.flock.setMatrixAt(i, dummy.matrix);
    });
    pigeons.flock.instanceMatrix.needsUpdate = true;
  }

  // --- The traveller, the magpie and the glider -------------------------------------------------------
  const traveller = createTraveller(bands), magpie = createMagpie(bands), glider = createGlider(bands);
  traveller.root.add(glider); glider.visible = false;
  scene.add(traveller.root, magpie.root);
  const body = new THREE.Vector3(), lastBody = new THREE.Vector3();
  let heading = 0, speed = 0, seated = null, glide = null, view = 'third', mode = 'walk', ride = null;

  // --- Pleasure boats (画舫) on a river route: gold roofs, red hulls, lit windows ------------------------
  function pleasureBoat() {
    const g = new THREE.Group(), skin = (c, e = 0, ei = .6) => new THREE.MeshToonMaterial({color: c, gradientMap: bands, emissive: e, emissiveIntensity: ei});
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.0, 12), skin(0x8c2a1c));
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.8, 1.8, 8.6), skin(0x5c3326));
    const glow = new THREE.Mesh(new THREE.BoxGeometry(2.86, .9, 8.0), skin(0xffd28a, 0xffb347, .9));
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.6, .3, 9.8), skin(0xd9a23a, 0x6b4a10, .35));
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(1.0, .3, 10.2), skin(0xe8b84a, 0x6b4a10, .35));
    hull.position.y = .3; cabin.position.y = 1.7; glow.position.y = 1.8; roof.position.y = 2.75; ridge.position.y = 3.0;
    g.add(hull, cabin, glow, roof, ridge);
    for (const z of [-5.2, 5.2]) { const l = new THREE.Mesh(new THREE.BoxGeometry(.35, .5, .35), skin(0xe8473a, 0xe8473a, .9)); l.position.set(0, 2.3, z); g.add(l); }
    return g;
  }
  const routes = Object.fromEntries(Object.entries(meta.rides || {}).filter(([, pts]) => pts.length > 3).map(([k, pts]) => {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    return [k, {curve, length: curve.getLength()}];
  }));
  const boats = [];
  for (const [name, r] of Object.entries(routes)) {
    const n = Math.max(2, Math.floor(r.length / 160));
    for (let i = 0; i < n; i++) { const m = pleasureBoat(); scene.add(m); boats.push({route: r, mesh: m, u: i / n, dir: i % 2 ? -1 : 1}); }
  }
  const riderBoat = Object.keys(routes).length ? pleasureBoat() : null;
  if (riderBoat) { riderBoat.visible = false; scene.add(riderBoat); }
  function placeBoat(mesh, route, u, dir) {
    const p = route.curve.getPointAt(u), t = route.curve.getTangentAt(u).multiplyScalar(dir);
    mesh.position.copy(p); mesh.rotation.y = Math.atan2(t.x, t.z);
    return {p, t};
  }
  function closestU(route, x, z) {
    let best = 0, bd = Infinity;
    for (let k = 0; k <= 200; k++) { const q = route.curve.getPointAt(k / 200), d = (q.x - x) ** 2 + (q.z - z) ** 2; if (d < bd) { bd = d; best = k / 200; } }
    return best;
  }
  const camDir = new THREE.Vector3(), tmp = new THREE.Vector3();

  function feetAt(x, z, fallback) { return surface(x, z) ?? fallback; }
  function glideCurve(feet, look, from = null) {
    // Approach from behind the arrival view: a long descending S-turn that ends running out onto
    // the spawn. Points are lifted clear of the ground under them. From a gate, the traveller
    // launches where they stand, climbs well clear of the hills between, then joins the approach.
    const f = new THREE.Vector3(look[0] - feet.x, 0, look[2] - feet.z).normalize(), side = new THREE.Vector3(-f.z, 0, f.x);
    const approach = from ? [[-140, 40, 62], [-60, -12, 22], [-18, 0, 4], [0, 0, 0]]
      : [[-420, 150, 170], [-260, -70, 115], [-140, 40, 62], [-60, -12, 22], [-18, 0, 4], [0, 0, 0]];
    const pts = approach.map(([b, sd, h]) => {
      const q = feet.clone().addScaledVector(f, b).addScaledVector(side, sd);
      q.y = Math.max(feet.y + h, (surface(q.x, q.z) ?? feet.y) + Math.min(h, 25));
      return q;
    });
    if (from) {
      const out = new THREE.Vector3(pts[0].x - from.x, 0, pts[0].z - from.z).normalize();
      const top = Math.max(from.y, feet.y) + 110;
      const lift = from.clone().addScaledVector(out, 30); lift.y = from.y + 22;
      const mid = from.clone().lerp(pts[0], .5); mid.y = top;
      pts.unshift(from.clone(), lift, mid);
    }
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  }

  const world = {
    id, meta, scene, sky, seats, staticTriangles, treeTriangles, traveller,
    spawn(name = 'axis') {
      const s = meta.spawns[name] || Object.values(meta.spawns)[0];
      const h = surface(s.position[0], s.position[2]) ?? s.position[1];
      return {position: [s.position[0], h + EYE, s.position[2]], feet: [s.position[0], h, s.position[2]],
        look: [s.look[0], h + EYE, s.look[2]]};
    },
    ground: (x, z) => surface(x, z),
    get body() { return body; },
    get heading() { return heading; },
    get view() { return view; },
    get gliding() { return !!glide; },
    get seated() { return seated; },
    toggleView() { view = view === 'third' ? 'first' : 'third'; return view; },
    // Stand at a spawn facing its look point; the caller has already set the camera's rotation.
    placeAt(s) {
      body.fromArray(s.feet); lastBody.copy(body); heading = Math.atan2(s.look[0] - s.feet[0], s.look[2] - s.feet[2]);
      seated = null; glide = null; mode = 'walk';
    },
    // from: glide from where the traveller stands (a moon gate) instead of the arrival approach.
    startGlide(s, {from = null, seconds = from ? 18 : 15} = {}) {
      const start = from ? body.clone() : null;
      world.placeAt(s);
      const curve = glideCurve(body.clone(), s.look, start);
      // Focus: what the approach turns the camera towards (the spawn's view: hall, stage, palace).
      glide = {curve, t: 0, seconds, focus: new THREE.Vector3(...s.look)}; body.copy(curve.getPointAt(0)); lastBody.copy(body); mode = 'glide';
    },
    endGlide() {
      if (!glide) return;
      body.copy(glide.curve.getPointAt(1)); body.y = feetAt(body.x, body.z, body.y);
      glide = null; mode = 'walk';
    },
    label: name => meta.labels?.[name] || name,
    nearestGate(radius = 3) {
      let best = null;
      for (const g of meta.gates || []) {
        const d = Math.hypot(g.position[0] - body.x, g.position[2] - body.z);
        if (d < radius && (!best || d < best.d)) best = {g, d};
      }
      return best?.g || null;
    },
    nearestDock(radius = 8) {   // the dock is at the water's edge; the walkable bank is a few metres back
      for (const [name, d] of Object.entries(meta.docks || {})) if (Math.hypot(d.position[0] - body.x, d.position[2] - body.z) < radius) return {name, ...d};
      return null;
    },
    get riding() { return !!ride; },
    // Board the pleasure boat at a dock: it sails the route to its far end, turns and brings the
    // visitor back to the dock. Any walking key steps ashore at once.
    board(dock) {
      const route = routes[dock.name] || Object.values(routes)[0];
      if (!route || !riderBoat) return false;
      const u0 = closestU(route, dock.position[0], dock.position[2]);
      ride = {route, u: u0, u0, dir: u0 < .5 ? 1 : -1, turned: false, dock};
      const tan = route.curve.getTangentAt(u0).multiplyScalar(ride.dir);
      heading = Math.atan2(tan.x, tan.z);
      riderBoat.visible = true; seated = null; mode = 'sit';
      return true;
    },
    leaveBoat() {
      if (!ride) return;
      body.set(ride.dock.position[0], heightAt(ride.dock.position[0], ride.dock.position[2] + 1.5) ?? ride.dock.position[1] + 1, ride.dock.position[2]);
      const h = surface(body.x, body.z); if (h !== null) body.y = h;
      ride = null; riderBoat.visible = false; mode = 'walk';
    },
    nearestBell(radius = 3.5) {
      for (const b of Object.values(meta.bells || {})) if (Math.hypot(b.position[0] - body.x, b.position[2] - body.z) < radius) return b;
      return null;
    },
    // The bell's shiver shakes petals loose for a few seconds.
    ringBell() { if (petals) petals.burst = 5; },
    nearestSeat(p, radius = 3) {
      const q = p || body;
      let best = null;
      for (const s of seats) { const d = Math.hypot(s.position[0] - q.x, s.position[2] - q.z); if (d < radius && (!best || d < best.d)) best = {s, d}; }
      return best?.s || null;
    },
    sit(seat) { seated = {seat, from: body.clone(), t: 0}; mode = 'sit'; },
    stand() { if (seated) { seated = null; mode = 'walk'; } },
    // Free walking relative to where the camera looks; the traveller turns to face the way they go.
    walk(camera, keys, dt) {
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const side = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const fast = keys.has('ShiftLeft') || keys.has('ShiftRight');
      if (glide) return false;
      if (ride) { if (forward || side) world.leaveBoat(); return false; }
      if (seated) {
        if (forward || side) { world.stand(); return false; }
        seated.t = Math.min(1, seated.t + dt * .8);
        const s = seated.seat, k = THREE.MathUtils.smootherstep(seated.t, 0, 1);
        const target = new THREE.Vector3(s.position[0], heightAt(s.position[0], s.position[2]) ?? s.position[1], s.position[2]);
        body.lerpVectors(seated.from, target, k);
        heading = Math.atan2(s.look[0] - s.position[0], s.look[2] - s.position[2]);
        return false;
      }
      let moved = false;
      if (forward || side) {
        camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
        const right = new THREE.Vector3().crossVectors(camDir, up);
        const dir = camDir.clone().multiplyScalar(forward).addScaledVector(right, side).normalize();
        const want = Math.atan2(dir.x, dir.z);
        let dh = want - heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
        heading += dh * (1 - Math.exp(-dt * 10));
        dir.multiplyScalar((fast ? RUN : WALK) * dt);
        const from = {x: body.x, z: body.z};
        if (canStep(from, body.x + dir.x, body.z + dir.z)) { body.x += dir.x; body.z += dir.z; moved = true; }
        else if (canStep(from, body.x + dir.x, body.z)) { body.x += dir.x; moved = true; }
        else if (canStep(from, body.x, body.z + dir.z)) { body.z += dir.z; moved = true; }
      }
      const h = surface(body.x, body.z);
      if (h !== null) body.y = THREE.MathUtils.damp(body.y, h, 14, dt);
      return moved;
    },
    // Paraglider free flight (K): the bird-kite controls, now carrying the traveller.
    fly(camera, keys, dt, bounds) {
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const side = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const rise = Number(keys.has('KeyE') || keys.has('Space')) - Number(keys.has('KeyQ') || keys.has('ControlLeft') || keys.has('ControlRight'));
      camera.getWorldDirection(camDir);
      const next = flightStep(body.toArray(), camDir.toArray(), {forward, side, up: rise, fast: keys.has('ShiftLeft') || keys.has('ShiftRight')}, dt, bounds);
      next[1] = Math.max(next[1], (surface(next[0], next[2]) ?? 0) + 8);
      tmp.fromArray(next).sub(body);
      if (tmp.x * tmp.x + tmp.z * tmp.z > 1e-6) heading = Math.atan2(tmp.x, tmp.z);
      body.fromArray(next); mode = 'glide';
      return !!(forward || side || rise);
    },
    takeOff() { world.stand(); body.y += 25; mode = 'glide'; },
    land() {
      const h = surface(body.x, body.z);
      if (h === null) return false;
      body.y = h; mode = 'walk'; return true;
    },
    // Camera: chase behind the traveller (third person) or at the eye (first person). The look
    // direction stays the visitor's (drag to look), except on the arrival glide.
    placeCamera(camera, dt) {
      if (glide) {
        const k = Math.min(glide.t / glide.seconds + .02, 1), tan = glide.curve.getTangentAt(k);
        camera.position.copy(body).addScaledVector(tan, -10).add(new THREE.Vector3(0, 5.2, 0));
        // Ahead along the line at first, then onto the destination as it comes into view.
        const ahead = body.clone().addScaledVector(tan, 18).add(new THREE.Vector3(0, -3, 0));
        camera.lookAt(ahead.lerp(glide.focus, THREE.MathUtils.smoothstep(k, .45, .85) * .85));
        camera.rotation.z = 0;
        return;
      }
      const sitting = mode === 'sit' && !ride, flyingNow = mode === 'glide';
      if (ride && view === 'third') {
        // On the boat: a little behind and above the cabin roof, looking down the river.
        camera.getWorldDirection(camDir);
        const eye = body.clone().add(new THREE.Vector3(0, 3.4, 0)).addScaledVector(camDir, -7.5);
        camera.position.lerp(eye, 1 - Math.exp(-dt * 10));
        return;
      }
      if (view === 'first') {
        camera.position.copy(body).add(new THREE.Vector3(0, sitting ? SIT_EYE : EYE, 0));
        return;
      }
      camera.getWorldDirection(camDir);
      const eye = body.clone().add(new THREE.Vector3(0, sitting ? 1.0 : flyingNow ? 3.2 : 1.55, 0))
        .addScaledVector(camDir, -(flyingNow ? 11 : sitting ? 3.4 : 4.4));
      const g = surface(eye.x, eye.z);
      if (g !== null) eye.y = Math.max(eye.y, g + .45);
      camera.position.lerp(eye, 1 - Math.exp(-dt * 18));
    },
    frame(dt, t, weather, direction, camera) {
      if (glide) {
        glide.t += dt;
        const k = Math.min(glide.t / glide.seconds, 1), e = k * k * (3 - 2 * k) * .25 + k * .75;
        const tan = glide.curve.getTangentAt(e);
        body.copy(glide.curve.getPointAt(e)); heading = Math.atan2(tan.x, tan.z);
        if (k >= 1) world.endGlide();
      }
      speed = dt > 0 ? Math.hypot(body.x - lastBody.x, body.z - lastBody.z) / dt : 0;
      lastBody.copy(body);
      traveller.root.position.copy(body);
      traveller.root.rotation.y = heading;
      traveller.root.visible = view === 'third' || !!glide;
      glider.visible = mode === 'glide';
      traveller.update(dt, mode === 'glide' ? 0 : speed, mode, t);
      magpie.update(dt, t, body, heading, speed, mode, surface);
      sun.position.copy(camera.position).addScaledVector(direction, 600); sun.target.position.copy(camera.position);
      sun.intensity = (2.1 - weather.storm * 1.5 - weather.snow * .6) * (1 - weather.dawn * .6);
      sun.color.setRGB(1, 1 - weather.sunset * .3, 1 - weather.sunset * .55);
      hemi.intensity = 1.05 - weather.storm * .35 - weather.dawn * .55;
      scene.fog.color.setRGB(.66 + weather.sunset * .26 - weather.storm * .30, .80 - weather.sunset * .2 - weather.storm * .36, .93 - weather.sunset * .32 - weather.storm * .40);
      // Per-world haze: the lake needs a kilometre of view, the forest slice much less.
      const haze = meta.fog ?? .0011;
      scene.fog.density = (mode === 'glide' ? haze * .45 : haze) + weather.storm * .004 + weather.snow * .003;
      sky.position.copy(camera.position);
      hazeColor.value.copy(scene.fog.color);
      worldRain.position.copy(camera.position); worldSnow.position.copy(camera.position);
      worldRain.visible = weather.storm > .02; worldSnow.visible = weather.snow > .02;
      updatePigeons(t, dt, !!seated);
      updatePetals(t, dt, body);
      for (const b of boats) {
        b.u += b.dir * 1.4 * dt / b.route.length;
        if (b.u > 1) { b.u = 1; b.dir = -1; } else if (b.u < 0) { b.u = 0; b.dir = 1; }
        placeBoat(b.mesh, b.route, b.u, b.dir);
        b.mesh.position.y += Math.sin(t * 1.3 + b.u * 40) * .04;
      }
      if (ride) {
        ride.u += ride.dir * 1.6 * dt / ride.route.length;
        if (ride.u >= 1 || ride.u <= 0) { ride.u = THREE.MathUtils.clamp(ride.u, 0, 1); ride.dir *= -1; ride.turned = true; }
        const {p, t: tan} = placeBoat(riderBoat, ride.route, ride.u, ride.dir);
        body.set(p.x, p.y + 1.2, p.z).addScaledVector(tan, -3.2);
        heading = Math.atan2(tan.x, tan.z);
        if (ride.turned && Math.abs(ride.u - ride.u0) < .004) world.leaveBoat();
      }
    },
    stats() {
      return {id, staticTriangles, treeTriangles, trees: trees.length, walkCells: walk.walkableCells, seats: seats.length,
        seated: !!seated, gliding: !!glide, view, mode, body: body.toArray().map(v => +v.toFixed(2)), materials: cache.size};
    },
  };
  return world;
}
