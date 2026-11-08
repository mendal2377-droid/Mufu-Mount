import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {createSkyDome} from './sky.js';
import {flightStep} from './kite.js';
import {createTraveller, createMagpie, createGlider} from './traveller.js';
import {loadTransit} from './transit.js';
import {paintedTree} from './painted-trees.js';
import {createXuanwuLife, shoreField} from './xuanwu-life.js';

// A landmark scene modelled in Blender (blender/build_<id>.py, exported by blender/export_web.py)
// and streamed on arrival. Unlike the atlas it is in true metres: the walker's eye is 1.65 m, the
// 392 steps are real steps, and walking is free over a ray-cast walk grid instead of corridors.

// Materials that only receive the sun's shadow (see the static mesh loop).
const GROUND_MATERIALS = new Set(['lawn', 'forest_floor', 'city_ground', 'river_bed', 'water', 'canal_stone', 'paving_joint',
  'far_ground', 'city_paving', 'pitch', 'road_city', 'sidewalk']);
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
  // Qixia's Japanese maples: the deep red of the boardwalk photographs.
  maple_red: {crown: '#C8321E', trunk: '#4A3A34', h: 8, r: 3.8, lobes: 5},
  // Nanjing's researched street and park trees (research/plants/FACTS.md).
  camphor: {crown: '#3F6B35', trunk: '#5A4636', h: 13, r: 5.6, lobes: 7},
  ginkgo: {crown: '#8DB34A', trunk: '#6B5A48', h: 15, r: 3.4, lobes: 4},
  metasequoia: {crown: '#7FA65A', trunk: '#7A4E36', h: 20, r: 3.0, cone: 6},
  scholar: {crown: '#6E9A46', trunk: '#4E4036', h: 11, r: 4.8, lobes: 5},
  privet: {crown: '#3E5E34', trunk: '#4E4036', h: 7, r: 2.8, lobes: 4},
  wingnut: {crown: '#7FA548', trunk: '#5A4636', h: 14, r: 5.2, lobes: 5},
  plum: {crown: '#6E8F48', trunk: '#3E302A', h: 5, r: 2.6, lobes: 4},
  // Tiny Nanjing's street lamps ride the tree instancing: a dark pole and a warm head that glows
  // at night (lampMat); far away, a glowing dot.
  lamp: {lamp: true, crown: '#FFE7B4', trunk: '#3A3F44', h: 8, r: .6},
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

// Each kind's crown through the year: spring, summer, autumn, winter (bare branches read as a
// thin grey-brown crown). Autumn picks per tree among `fall` so a park is never one colour.
const BROAD = {year: ['#A4CB5C', null, '#D9A93A', '#9A8E7E'], fall: ['#E08A33', '#C4652E', '#D9A93A', '#9BAA45']};
const SEASONS = {
  broadleaf: BROAD, broadleaf_sun: BROAD, broadleaf_shade: BROAD, plane_autumn: {year: ['#A4CB5C', '#86A84A', '#E2B233', '#9A8E7E']},
  far: {year: ['#7DA34A', null, '#B98A3A', '#8E8676'], fall: ['#A86A34', '#8E9A44', '#C2993C']},
  maple_autumn: {year: ['#A8C860', '#5E9E3E', null, '#8E7E72']}, maple_red: {year: ['#A8C860', '#5E9E3E', null, '#8E7E72']},
  cherry: {year: ['#F2B8C6', '#6E9E46', '#D9783A', '#8E7E72']}, willow: {year: ['#B8D86A', null, '#C9B84A', '#A79A70']},
  cedar: {year: [null, null, null, '#36513A']}, cypress: {year: [null, null, null, '#36513A']},
  // Lotus (research/xuanwu/FACTS.md): new leaves in spring, flowers June to August, seed heads in
  // autumn, brown stalks in winter.
  lotus: {year: ['#8DBE5A', null, '#9A9048', '#7A6448']}, lotus_flower: {year: ['#C9D98A', null, '#8E7A4E', '#6E5A44']},
  // From research/plants/FACTS.md: ginkgo gold in late November, metasequoia fiery red in early
  // December, plane yellowing late; camphor, privet and cedar evergreen (camphor's lighter spring
  // flush is an assumption); plum flowers in late February, so its "winter" is the blossom.
  plane: {year: ['#A4CB5C', '#86A84A', '#D8B040', '#9A8E7E']},
  camphor: {year: ['#5E8A3E', null, null, '#3A6232']},
  ginkgo: {year: ['#A9CC5C', '#7EA84A', '#E6BE2E', '#9C8F80']},
  metasequoia: {year: ['#A7C96A', '#6E9A50', '#B9562A', '#8E7262']},
  scholar: {year: ['#A4CB5C', null, '#C9B24A', '#9A8E7E']},
  privet: {year: [null, null, null, '#36513A']},
  wingnut: {year: ['#A4CB5C', null, '#C2A548', '#9A8E7E']},
  plum: {year: ['#8FB45A', '#6E8F48', '#B98A48', '#F3CFD8']},
};

function treeGeometry(spec, seed) {
  let s = seed;
  const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const parts = [], colour = (g, hex) => {
    const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.toArray(a, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    // 1 on leaves, 0 on trunks and lamp poles: the season recolours leaves only.
    g.setAttribute('crown', new THREE.BufferAttribute(new Float32Array(n).fill(hex === spec.trunk ? 0 : 1), 1));
    return g;
  };
  if (spec.lotus || spec.flower) return lotusGeometry(spec, colour);
  if (spec.lamp) {
    const pole = new THREE.CylinderGeometry(.08, .12, spec.h, 5, 1, true).toNonIndexed();
    pole.translate(0, spec.h / 2, 0);
    const arm = new THREE.BoxGeometry(.08, .08, 1.3).toNonIndexed();
    arm.translate(0, spec.h - .1, .6);
    const head = new THREE.BoxGeometry(.42, .2, .9).toNonIndexed();
    head.translate(0, spec.h - .2, 1.1);
    parts.push(colour(pole, spec.trunk), colour(arm, spec.trunk), colour(head, spec.crown));
  } else
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
  for (const [name, size] of [['position', 3], ['normal', 3], ['color', 3], ['crown', 1]]) {
    const arr = new Float32Array(total * size);
    let o = 0;
    for (const g of parts) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

// Distant trees: one low crown in the tree's colour, no trunk (an octahedron for broadleaf crowns,
// a six-sided cone for conifers). A few triangles each, so a whole forest costs little.
function silhouetteGeometry(spec) {
  let g;
  if (spec.lamp) { g = new THREE.OctahedronGeometry(.5, 0).toNonIndexed(); g.translate(0, spec.h - .2, 1.1); }
  else if (spec.cone) { g = new THREE.ConeGeometry(spec.r * .9, spec.h * .9, 6, 1).toNonIndexed(); g.translate(0, spec.h * .55, 0); }
  else {
    g = new THREE.OctahedronGeometry(spec.r * (spec.hang ? .95 : 1.05), 0).toNonIndexed();
    g.scale(1, spec.hang ? 1.25 : .85, 1); g.translate(0, spec.h * (spec.hang ? .55 : .72), 0);
    const p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3(), c = new THREE.Vector3(0, spec.h * .72, 0);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).sub(c).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
  }
  const c = new THREE.Color(spec.crown), a = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < g.attributes.position.count; i++) c.toArray(a, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.setAttribute('crown', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(spec.lamp ? 0 : 1), 1));
  return g;
}

// Lotus: a few cupped round leaves held at different heights above the water (the photographs
// show a crowd of raised leaves, not flat pads); a flower is a pink cup on its own leaf.
function lotusGeometry(spec, colour) {
  const parts = [];
  // crown 1 takes the season's colour (SEASONS: leaves brown in winter, the flower a bud in spring
  // and a seed head in autumn); a flower's own leaf keeps its green.
  const crowns = [];
  const leaf = (r, x, y, z, hex, crown = 1) => {
    const g = new THREE.ConeGeometry(r, r * .28, 9, 1, true).toNonIndexed();
    g.rotateX(Math.PI); g.translate(x, y + r * .14, z);
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * .3, 1, n.getZ(i) * .3);
    parts.push(colour(g, hex)); crowns.push(crown);
  };
  if (spec.flower) {
    leaf(.5, .1, .05, 0, '#5E9B4A', 0);
    const cup = new THREE.ConeGeometry(.2, .32, 6, 1, true).toNonIndexed();
    cup.rotateX(Math.PI); cup.translate(0, .55, 0);
    parts.push(colour(cup, spec.crown)); crowns.push(1);
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
  const crown = new Float32Array(total);
  let o = 0;
  parts.forEach((g, i) => { crown.fill(crowns[i], o, o + g.attributes.position.count); o += g.attributes.position.count; });
  out.setAttribute('crown', new THREE.BufferAttribute(crown, 1));
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
  // The near plane follows the camera's height above the ground, a hundredth of it, 0.1-4 m: at
  // 0.1 m the depth buffer could not tell surfaces a metre apart 1.5 km off, and from high over
  // Xuanwu Lake the lake bed (under 1 m of water) fought the water in grey lines across it. 4 m at
  // most: the glide camera trails the glider by 11 m. Here, not in frame(): every render of the
  // world passes through, the test shots' too.
  scene.onBeforeRender = (renderer, s, camera) => {
    const p = camera.position, near = Math.min(4, Math.max(.1, (p.y - (surface(p.x, p.z) ?? 0)) * .01));
    if (Math.abs(camera.near - near) > 1e-3) { camera.near = near; camera.updateProjectionMatrix(); }
  };
  const walk = meta.walk, heights = new Int16Array(walkBuf);
  // cellZ: the whole metres the last cellOf's grid stores its heights above (zOff, for ground over
  // the Int16 centimetres' 320 m: Purple Mountain). Declared here: cellOf runs while the world loads.
  let cellZ = 0;
  // Water surfaces (same layout as the walk grid), where a boat can be steered.
  const waterBuf = walk.water ? await fetch(base + 'water.bin').then(r => (r.ok ? r.arrayBuffer() : null)).catch(() => null) : null;
  const waterHeights = waterBuf ? new Int16Array(waterBuf) : null;

  // The water's distance from its shores (src/xuanwu-life.js), made when the water's shader first
  // compiles: the walk grids are loaded by then.
  const NO_SHORE = {tex: new THREE.DataTexture(new Uint8Array([255]), 1, 1, THREE.RedFormat), box: new THREE.Vector4(0, 0, 0, 0)};
  NO_SHORE.tex.needsUpdate = true;
  let shoreMap = null;
  const shore = () => (shoreMap ??= id === 'core' && waterHeights ? shoreField(waterAt) : NO_SHORE);

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
    // Tiny Nanjing: buildings carry their colours in the vertices and wall UVs in metres (along,
    // up); roads carry metres (along, across). Shaders below draw windows and lanes from those.
    const facade = name === 'facade', road = name === 'road_city', walkway = name === 'sidewalk';
    if (facade || name === 'roof_city') mat.vertexColors = true;
    if (facade || road || walkway) mat.defines = {...mat.defines, USE_UV: ''};
    if (facade) mat.defines.FACADE_TOP = '';
    if (name === 'water') { mat.color.multiplyScalar(1.05); mat.emissive = new THREE.Color(0x0b2f3a); }
    // Lanterns and lit windows glow; the bloom pass turns them into soft lights at dusk.
    if (name === 'lantern') { mat.emissive = new THREE.Color(0xe8473a); mat.emissiveIntensity = .9; }
    if (name === 'lantern_glow') { mat.emissive = new THREE.Color(0xffb347); mat.emissiveIntensity = .75; }
    // The Bao'en tower's glass: a pale green-white glow, as it is lit at night.
    if (name === 'glass_glow') { mat.emissive = new THREE.Color(0xbfe8d2); mat.emissiveIntensity = .55; }
    // The bridge's magnolia lamps (玉兰花灯): white globes.
    if (name === 'lamp_white') { mat.emissive = new THREE.Color(0xfff4dc); mat.emissiveIntensity = .8; }
    mat.onBeforeCompile = s => {
      s.uniforms.citySnow = shared.snow; s.uniforms.worldMottle = {value: style.mottle}; s.uniforms.worldScale = {value: style.scale};
      s.uniforms.worldJoints = {value: style.joints || 0}; s.uniforms.cityTime = shared.time;
      s.uniforms.worldWater = {value: name === 'water' ? 1 : 0};
      // Distance from the shore, for the water's shallows; the lotus beds' season.
      const sh = name === 'water' ? shore() : NO_SHORE;
      s.uniforms.shoreTex = {value: sh.tex}; s.uniforms.shoreBox = {value: sh.box};
      s.uniforms.worldLotus = {value: name === 'lotus' ? 1 : 0}; s.uniforms.citySeason = shared.season || {value: 1};
      s.uniforms.worldWindows = {value: style.windows || 0};
      s.uniforms.citySunset = shared.sunset || {value: 0}; s.uniforms.cityDawn = shared.dawn || {value: 0};
      s.uniforms.worldFar = {value: far ? 1 : 0}; s.uniforms.hazeColor = hazeColor;
      s.uniforms.worldFacade = {value: facade ? 1 : 0}; s.uniforms.worldRoad = {value: road ? 1 : 0}; s.uniforms.worldWalk = {value: walkway ? 1 : 0};
      s.uniforms.cityNight = shared.night || {value: 0}; s.uniforms.cityLit = shared.litShare || {value: 0};
      s.uniforms.cityShops = shared.shopsOpen || {value: 0};
      s.uniforms.skyClip = {value: new THREE.Vector4(...(meta.skyline_clip || [1, -1, 1, -1]))};
      s.vertexShader = 'varying vec3 vWorldPos;varying float vUp;\n#ifdef FACADE_TOP\nattribute float wallTop;varying float vTop;\n#endif\n' + s.vertexShader.replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorldPos=(modelMatrix*vec4(transformed,1.)).xyz;vUp=normalize(mat3(modelMatrix)*objectNormal).y;\n#ifdef FACADE_TOP\nvTop=wallTop;\n#endif\n');
      s.fragmentShader = 'uniform float citySnow,worldMottle,worldScale,worldJoints,cityTime,worldWater,worldWindows,citySunset,cityDawn,worldFar,worldFacade,worldRoad,worldWalk,cityNight,cityLit,cityShops,worldLotus,citySeason;uniform vec3 hazeColor;uniform vec4 skyClip,shoreBox;uniform sampler2D shoreTex;varying vec3 vWorldPos;varying float vUp;\n#ifdef FACADE_TOP\nvarying float vTop;\n#endif\n' +
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
            // Shallows paler and greener within a few tens of metres of the bank, open water deeper blue.
            float sd=1.;
            if(shoreBox.z>0.){vec2 su=vec2((vWorldPos.x-shoreBox.x)/shoreBox.z,(vWorldPos.z-shoreBox.y)/shoreBox.w);
              if(su.x>0.&&su.x<1.&&su.y>0.&&su.y<1.)sd=texture2D(shoreTex,su).r;}
            diffuseColor.rgb*=mix(vec3(1.08,1.12,.94),vec3(.8,.88,1.),smoothstep(.05,.9,sd));
            diffuseColor.rgb=mix(diffuseColor.rgb*(.9+rip*.22),vec3(.78,.88,.96),fres*.35);
            diffuseColor.rgb+=smoothstep(.78,.86,rip)*.08;
          }
          // Lotus beds: green through the summer, yellowing in autumn, brown in winter.
          if(worldLotus>.5){float s4=mod(citySeason,4.);
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.6,.56,.3),smoothstep(1.4,2.4,s4)*(1.-smoothstep(3.,3.6,s4))*.6);
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.45,.38,.28),smoothstep(2.5,3.,s4)*(1.-smoothstep(3.7,4.,s4)));}
          // Towers: 3.8 m floor bands and 2.4 m mullions on the walls.
          float winLit=0.;
          if(worldWindows>0.){
            float side=1.-smoothstep(.2,.4,abs(vUp));
            vec2 cell=vec2((vWorldPos.x+vWorldPos.z)/2.4,vWorldPos.y/3.8);
            vec2 f=fract(cell);float fw2=max(fwidth(cell.x),fwidth(cell.y));
            float frame=max(smoothstep(.82,.9,f.y),smoothstep(.9,.96,f.x))*(1.-smoothstep(.2,.6,fw2));
            diffuseColor.rgb*=1.-frame*.12*side*worldWindows;
            // Lit windows only where they read: they fade out with distance and with the skyline haze,
            // or far towers become specks of light floating in the sky.
            float dist=length(vViewPosition);
            winLit=step(.8,lwHash(floor(cell)))*side*(1.-frame)*(1.-smoothstep(500.,1800.,dist))*(1.-smoothstep(.35,1.,fw2));
          }
          float pool=0.;
          // The skyline's towers inside the city core are drawn by the city itself.
          if(worldFar>.5&&vWorldPos.x>skyClip.x&&vWorldPos.x<skyClip.y&&vWorldPos.z>skyClip.z&&vWorldPos.z<skyClip.w)discard;
          #ifdef USE_UV
          if(worldFacade>.5){
            // Façades: floors, windows and shop fronts from wall metres. Vertex alpha is the style:
            // 0 flats, .35 office glass, .7 old low houses, 1 blank. Far away the pattern fades to
            // its average so it never shimmers.
            #ifdef USE_COLOR_ALPHA
            float st=vColor.a;
            #else
            float st=0.;
            #endif
            diffuseColor.a=1.;
            float h=1.-vUv.y,u=vUv.x;     // glTF stores v as 1 - v
            bool walkup=st>.13&&st<.3;
            if(h>=0.&&st<.9){
              // Homes vary building by building (the owner: no repeated streets on a bus tour). The
              // building's own height and wall colour pick a variant: bay width, window size, a
              // shade of its paint, and one of three looks (below). Offices and old houses keep theirs.
              bool homes=st<.3;
              #ifdef FACADE_TOP
              float bh=lwHash(vec2(vTop*1.37+vColor.r*17.,vColor.g*23.+vColor.b*5.));
              #else
              float bh=.5;
              #endif
              float bh2=fract(bh*7.13), look=floor(bh*3.);
              if(homes)diffuseColor.rgb*=.9+.18*bh2;
              float fh=st>.6?3.0:st>.3?3.3:walkup?2.9:3.0, sp=st>.6?3.6:st>.3?1.6:walkup?2.7+bh2*.8:2.8+bh2*1.3;
              // Only whole floors under the roof get windows; what is left above is a blank parapet.
              // Without it the last row was cut by the roof line and read as windows standing up
              // past the top of the building (the owner saw it).
              #ifdef FACADE_TOP
              float roomy=step((floor(h/fh)+1.)*fh,vTop+.15);
              #else
              float roomy=1.;
              #endif
              float fv=fract(h/fh), fu=fract(u/sp);
              float ww=st>.6?.32:st>.3?.9:.36+.26*fract(bh*13.7), wb=st>.6?.36:st>.3?.12:.3, wt=st>.6?.74:st>.3?.92:.78;
              float win=step(abs(fu-.5),ww*.5)*step(wb,fv)*step(fv,wt)*roomy;
              bool shop=h<4.2&&(st<.04||st>.22&&st<.3);
              if(shop){float su=fract(u/4.6);win=step(abs(su-.5),.4)*step(.12,h/4.2)*step(h/4.2,.86);}
              float fw=max(fwidth(u/sp),fwidth(h/fh));
              float k=1.-smoothstep(.12,.38,fw);
              vec3 glass=mix(vec3(.16,.22,.27),vec3(.42,.52,.6),.35+.3*lwHash(vec2(floor(u/sp),floor(h/fh))));
              if(shop)glass=vec3(.28,.24,.2);
              diffuseColor.rgb=mix(diffuseColor.rgb,mix(diffuseColor.rgb*.82,glass,win*.8),k);
              diffuseColor.rgb*=1.-(1.-smoothstep(0.,.08,fv))*.12*k*(st>.6?0.:1.);
              if(walkup&&!shop&&roomy>.5){
                // Balconies on every other bay: a pale slab and railing across the window's foot,
                // the room behind darker. And an air conditioner's grey box beside each window.
                float bay=mod(floor(u/sp),2.);
                if(bay<.5&&fv>.06&&fv<.34&&abs(fu-.5)<.47)diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.12+.03,k);
                if(bay<.5&&fv>.31&&fv<.36&&abs(fu-.5)<.47)diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.55,.56,.55),k);
                if(fu>.8&&fu<.94&&fv>.42&&fv<.58)diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.86,.84),k*.9);
                // Old render streaked by rain under each sill.
                diffuseColor.rgb*=1.-k*.06*smoothstep(.5,0.,fv)*step(abs(fu-.5),.25);
                // Some compounds put steel security grilles over every window (防盗窗, anti-theft
                // cages); others a darker tiled ground floor.
                if(look>1.5&&win>.5)diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.30,.31,.30),k*.7*step(fract(fu*sp/.14),.22));
                if(look>.5&&look<1.5&&h<fh)diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.72+vec3(.03,.02,0.),k);
              }
              if(homes&&!walkup&&!shop&&roomy>.5){
                float bay=floor(u/sp);
                if(look<.5){
                  // Glazed-in balconies on every third bay: a band of pale glass across the floor
                  // with a slab under it, as on so many 2000s towers.
                  if(mod(bay,3.)<1.&&fv>.12&&fv<.84)diffuseColor.rgb=mix(diffuseColor.rgb,mix(glass,vec3(.62,.70,.74),.35),k*.85);
                  if(mod(bay,3.)<1.&&fv<.12)diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.1+.04,k);
                }else if(look<1.5){
                  // A stair core every fifth bay: blank wall, a small window at each half landing.
                  if(mod(bay,5.)>1.5&&mod(bay,5.)<2.5){
                    float small=step(abs(fu-.5),.1)*step(.45,fract(fv+.5))*step(fract(fv+.5),.62);
                    diffuseColor.rgb=mix(diffuseColor.rgb,mix(diffuseColor.rgb*.88,glass,small*.8),k);
                  }else if(fu>.82&&fu<.95&&fv>.4&&fv<.56)diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.86,.84),k*.9);
                }else{
                  // A coloured tile band under each row of windows, and a top in that colour.
                  vec3 accent=mix(vec3(.62,.36,.30),vec3(.36,.46,.58),step(.5,bh2));
                  #ifdef FACADE_TOP
                  bool crown=vTop-h<fh*2.;
                  #else
                  bool crown=false;
                  #endif
                  if(fv<.2||crown&&win<.5)diffuseColor.rgb=mix(diffuseColor.rgb,accent,k*.75);
                }
              }
              // Each window has its own bedtime: the clock's lit share falls through the night
              // and windows go dark one by one. Shops close at ten. Far windows fade (they fizz),
              // less so at night, when the lit city should sparkle into the distance.
              float lit=(shop?cityShops:step(1.-cityLit,lwHash(vec2(floor(u/sp)+3.,floor(h/fh)))))*win*k;
              winLit=max(winLit,lit*(1.-smoothstep(300.+cityNight*700.,900.+cityNight*3200.,length(vViewPosition))));
              // A lit window at night is the room's warm light, not the glass: darken under the glow.
              diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.10,.08,.06),lit*cityNight*.85);
            }
          }
          if(worldWalk>.5){
            // Pools of lamplight on the pavement: the lamps stand every 28 m along it, from 14 m.
            float du=(fract((vUv.x-14.)/28.+.5)-.5)*28., dv=(1.-vUv.y)*1.6;
            pool=exp(-(du*du+dv*dv)/40.);
          }
          if(worldRoad>.5){
            // Lanes: a double centre line, dashed lane lines every 3.5 m, faded where they alias.
            float v=abs(1.-vUv.y),u=vUv.x;
            float fw=max(fwidth(v),fwidth(u)*.1), k=1.-smoothstep(.15,.5,fw);
            float centre=step(.08,v)*step(v,.22);
            float lane=step(abs(fract(v/3.5+.5)-.5)*3.5,.07)*step(1.,v)*step(fract(u/9.),.45);
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.72,.3),centre*k);
            diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.88,.84),lane*k*.9);
            // Lamplight spills onto the outer lanes, on the pavement lamps' 28 m rhythm.
            float du=(fract((u-14.)/28.+.5)-.5)*28.;
            pool=exp(-du*du/45.)*smoothstep(1.5,6.,v)*.14;
          }
          #endif`).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          // At dusk and dawn a third of the windows glow warm.
          totalEmissiveRadiance+=winLit*max(worldWindows,worldFacade)*clamp(citySunset+cityDawn+cityNight*1.3,0.,1.3)*vec3(1.,.50,.16)*.85;
          totalEmissiveRadiance+=pool*cityNight*vec3(1.,.62,.28)*1.8;`)
        .replace('#include <dithering_fragment>', `#include <dithering_fragment>
          // Skyline haze: towers fade toward the sky colour with distance, never to nothing.
          if(worldFar>.5){float d=length(vViewPosition);gl_FragColor.rgb=mix(gl_FragColor.rgb,hazeColor,smoothstep(800.,9000.,d)*.45);}`);
    };
    mat.customProgramCacheKey = () => 'landmark-paint-v11' + (facade ? 'f' : road ? 'r' : walkway ? 'w' : '');
    cache.set(name, mat);
    return mat;
  }
  let staticTriangles = 0;
  // Wall UVs are metres along and above the ground, roofs v = -1 (blender/build_core.py extrude).
  // Each wall triangle of a quad holds a roof-line corner, so the highest h among a vertex's
  // triangles is its building's roof height: the façade shader stops windows under it.
  function wallTops(g) {
    const uv = g.attributes.uv, n = g.attributes.position.count;
    if (!uv) return;
    const top = new Float32Array(n).fill(-1), idx = g.index ? g.index.array : null, end = idx ? idx.length : n;
    for (let t = 0; t < end; t += 3) {
      const a = idx ? idx[t] : t, b = idx ? idx[t + 1] : t + 1, c = idx ? idx[t + 2] : t + 2;
      const m = 1 - Math.min(uv.getY(a), uv.getY(b), uv.getY(c));
      if (m > top[a]) top[a] = m; if (m > top[b]) top[b] = m; if (m > top[c]) top[c] = m;
    }
    g.setAttribute('wallTop', new THREE.BufferAttribute(top, 1));
  }
  gltf.scene.traverse(o => {
    if (!o.isMesh) return;
    // Blender's exporter writes a blank COLOR_0 beside the real colours (COLOR_1): use the real ones.
    if (o.geometry.attributes.color_1) { o.geometry.setAttribute('color', o.geometry.attributes.color_1); o.geometry.deleteAttribute('color_1'); }
    o.material = Array.isArray(o.material) ? o.material.map(paint) : paint(o.material);
    if ([o.material].flat().some(m => m.name === 'facade')) wallTops(o.geometry);
    // Sun shadows: everything receives; buildings, walls, stairs and bridges cast. Ground sheets do
    // not: they only shade themselves, and the terrain is most of the triangles.
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    o.castShadow = !GROUND_MATERIALS.has(mat.name); o.receiveShadow = true;
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
  // Metro and buses on real lines (src/transit.js; Tiny Nanjing only), loaded before the trees: its
  // stops and entrances need clear ground round them, its buses a clear path.
  const transit = meta.transit ? await loadTransit(base, {scene, bands, heightAt, roadAt, surface, nearest}) : null;
  // A tree taken out: the ground its trunk was stamped out of the walk grid becomes walkable again,
  // at the height of the ground round it, and road (an odd centimetre) where the ground round it is.
  function uproot(t) {
    for (let dz = -1.75; dz <= 1.75; dz += .5) for (let dx = -1.75; dx <= 1.75; dx += .5) {
      const c = cellOf(t[1] + dx, t[3] + dz), z0 = cellZ;
      if (c < 0 || heights[c] !== walk.noWalk) continue;
      const ring = [[3, 0], [-3, 0], [0, 3], [0, -3]].map(([ox, oz]) => [heightAt(t[1] + ox, t[3] + oz), roadAt(t[1] + ox, t[3] + oz)]).filter(([h]) => h !== null);
      if (ring.length < 2) continue;
      const cm = Math.round((ring.reduce((a, [h]) => a + h, 0) / ring.length - z0) * 100) & ~1;
      heights[c] = ring.filter(([, r]) => r !== null).length >= 2 ? cm | 1 : cm;
    }
  }
  const clear = transit ? transit.clearings() : [];
  const inClearing = t => clear.some(([x, z, r]) => Math.abs(t[1] - x) < r && Math.abs(t[3] - z) < r && Math.hypot(t[1] - x, t[3] - z) < r);
  // A trunk in the edge of a carriageway: road on two sides of it within 2 m. The Mufu model's trees
  // along Yongji Avenue stood so, and stopped the bike dead (tests/mufu-journey-browser.mjs).
  const inRoad = t => t[0] !== 'lamp' && [[2, 0], [-2, 0], [0, 2], [0, -2]].filter(([dx, dz]) => roadAt(t[1] + dx, t[3] + dz) !== null).length >= 2;
  let uprooted = 0;
  for (let i = trees.length - 1; i >= 0; i--) {
    const t = trees[i];
    if (t[0] === 'far') continue;
    // The owner found stops and entrances behind trees, and trees in the road.
    if (inClearing(t) || inRoad(t)) { uproot(t); trees.splice(i, 1); uprooted++; }
  }
  const byKind = {};
  for (const t of trees) (byKind[t[0]] ||= []).push(t);
  // Trunks in a 10 m hash, so the chase camera can step in front of a tree instead of staring at
  // its bark (an avenue every 9 m puts one behind you constantly).
  const trunks = new Map();
  for (const t of trees) {
    const spec = TREES[t[0]];
    if (!spec || spec.far || spec.lotus || spec.flower) continue;
    const key = `${Math.floor(t[1] / 10)},${Math.floor(t[3] / 10)}`;
    (trunks.get(key) || trunks.set(key, []).get(key)).push([t[1], t[3], (spec.lamp ? .15 : spec.r * .09 * t[5]) + .45]);
  }
  const eyeTmp = new THREE.Vector3();
  // Move `eye` towards `target` until no trunk stands between them, lifting it a little when it
  // has to come close.
  function clearOfTrunks(eye, target) {
    const dx = eye.x - target.x, dz = eye.z - target.z, len = Math.hypot(dx, dz);
    if (len < .5) return eye;
    let nearest = len;
    const x0 = Math.floor(Math.min(eye.x, target.x) / 10) - 1, x1 = Math.floor(Math.max(eye.x, target.x) / 10) + 1;
    const z0 = Math.floor(Math.min(eye.z, target.z) / 10) - 1, z1 = Math.floor(Math.max(eye.z, target.z) / 10) + 1;
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) for (const [tx, tz, r] of trunks.get(`${i},${j}`) || []) {
      const k = ((tx - target.x) * dx + (tz - target.z) * dz) / (len * len);
      if (k <= 0 || k >= 1) continue;
      const px = target.x + dx * k - tx, pz = target.z + dz * k - tz;
      if (px * px + pz * pz < r * r) nearest = Math.min(nearest, k * len - r);
    }
    if (nearest >= len) return eye;
    const keep = Math.max(1.2, nearest) / len;
    eyeTmp.set(target.x + dx * keep, eye.y + (1 - keep) * 1.6, target.z + dz * keep);
    return eye.copy(eyeTmp);
  }
  // One material per kind: the crowns follow the season (SEASONS), sway harder in a storm, and take
  // snow. Brightness variation within a crown and between trees survives the recolouring.
  const treeMats = new Map();
  function treeMaterial(kind, spec) {
    if (treeMats.has(kind)) return treeMats.get(kind);
    const m = new THREE.MeshToonMaterial({vertexColors: true, gradientMap: bands});
    const plan = SEASONS[kind] || {year: []};
    const base = new THREE.Color(kind === 'far' ? '#5A8A3C' : spec.crown);
    const year = [0, 1, 2, 3].map(i => new THREE.Color(plan.year[i] || '#' + base.getHexString()));
    const fall = (plan.fall || ['#' + year[2].getHexString()]).map(h => new THREE.Color(h));
    while (fall.length < 4) fall.push(fall[fall.length - 1]);
    m.onBeforeCompile = s => {
      s.uniforms.cityTime = shared.time; s.uniforms.citySnow = shared.snow; s.uniforms.cityStorm = shared.storm || {value: 0};
      s.uniforms.citySeason = shared.season || {value: 1};
      s.uniforms.seasonCol = {value: year}; s.uniforms.fallCol = {value: fall}; s.uniforms.crownBase = {value: base};
      s.vertexShader = 'uniform float cityTime,cityStorm;attribute float crown;varying float vCrown,vTreeHash;\n' + s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float sway=smoothstep(2.,14.,transformed.y)*(1.+cityStorm*2.5);
        vec3 o=instanceMatrix[3].xyz;
        vCrown=crown;vTreeHash=fract(sin(dot(o.xz,vec2(12.9898,78.233)))*43758.5453);
        transformed.x+=sin(cityTime*(.9+cityStorm*1.6)+o.x*.05+o.z*.07)*.18*sway;transformed.z+=cos(cityTime*(.7+cityStorm*1.4)+o.x*.06)*.12*sway;`);
      s.fragmentShader = 'uniform float citySnow,citySeason;uniform vec3 seasonCol[4],fallCol[4],crownBase;varying float vCrown,vTreeHash;\n' + s.fragmentShader.replace('#include <color_fragment>',
        `#include <color_fragment>
        float s4=mod(citySeason,4.);int si=int(floor(s4));float sf=s4-float(si);int sj=(si+1)-4*((si+1)/4);
        vec3 fallPick=fallCol[int(vTreeHash*3.999)];
        vec3 ca=si==2?fallPick:seasonCol[si], cb=sj==2?fallPick:seasonCol[sj];
        float shade=clamp(dot(diffuseColor.rgb,vec3(.3,.59,.11))/max(dot(crownBase,vec3(.3,.59,.11)),.02),.7,1.3);
        diffuseColor.rgb=mix(diffuseColor.rgb,mix(ca,cb,sf)*shade,vCrown);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.9,.92,.9),citySnow*.45);`);
    };
    m.customProgramCacheKey = () => 'landmark-trees-v2-' + kind;
    treeMats.set(kind, m);
    return m;
  }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3(), pos = new THREE.Vector3();
  const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
  const shadowOnly = new THREE.MeshBasicMaterial({colorWrite: false, depthWrite: false});
  // Lamps: no sway, and the warm head (its bright vertex colour) glows once the night comes.
  const lampMat = new THREE.MeshToonMaterial({vertexColors: true, gradientMap: bands});
  lampMat.onBeforeCompile = s => {
    s.uniforms.cityNight = shared.night || {value: 0};
    s.fragmentShader = 'uniform float cityNight;\n' + s.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      totalEmissiveRadiance+=vec3(1.,.70,.36)*step(.9,vColor.r)*step(.8,vColor.g)*cityNight*2.0;`);
  };
  lampMat.customProgramCacheKey = () => 'landmark-lamps-v1';
  // Level of detail: near trees (within NEAR_R of the traveller, at most NEAR_CAP of them) get the
  // full painted crown; every other tree is a silhouette of a few triangles in the same colour. All
  // trees at full detail were ~2.6 M triangles in Zhongshan, too heavy for a phone.
  const NEAR_R = 280, NEAR_CAP = 2500;
  const lodKinds = [];
  let treeTriangles = 0;
  // Street lamps on a carriageway (dual carriageways: one side's pavement lamps fell on the other
  // carriageway) are left out: three of four road cells round the post.
  if (byKind.lamp) byKind.lamp = byKind.lamp.filter(t => [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]]
    .filter(([dx, dz]) => roadAt(t[1] + dx, t[3] + dz) !== null).length < 3 && !transit?.onBusPath(t[1], t[3]));
  for (const [kind, list] of Object.entries(byKind)) {
    const spec = TREES[kind] || TREES.broadleaf, geo = treeGeometry(spec, 101 + kind.length * 17);
    // Per-tree tint: far crowns pick from the canopy palette so the forest reads as painted
    // patches, near trees vary a little in value. Far crowns are white in the geometry, so the
    // instance colour is the colour.
    const tints = spec.far ? ['#5A8A3C', '#6E9B3E', '#47733A', '#86A84A', '#3E6A3E'].map(h => new THREE.Color(h)) : null;
    const tint = new THREE.Color(), mats = [], cols = [];
    list.forEach(t => {
      // On the ground the walker stands on, where a walk grid knows it (and it is near: a tree on
      // a roof garden or a bridge keeps its own height).
      // The trunk's own cell is stamped unwalkable, so the ground just round it: the lowest of a
      // ring of samples, so no side of the trunk floats.
      if (!spec.far && !spec.lamp) {
        let g = null;
        for (const [dx, dz] of [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5], [4, 0], [-4, 0], [0, 4], [0, -4]]) {
          const h = heightAt(t[1] + dx, t[3] + dz);
          if (h !== null && Math.abs(h - t[2]) < 6) g = g === null ? h : Math.min(g, h);
        }
        if (g !== null) t[2] = g;
      }
      q.setFromAxisAngle(up, t[4]); sc.setScalar(t[5]); pos.set(t[1], t[2], t[3]);
      mats.push(new THREE.Matrix4().compose(pos, q, sc));
      const r = Math.abs(Math.sin(t[1] * 12.9898 + t[3] * 78.233)) % 1;
      if (tints) tint.copy(tints[Math.floor(r * tints.length) % tints.length]); else tint.setScalar(.9 + r * .2);
      cols.push(tint.clone());
    });
    const lod = !spec.far && !spec.lotus && !spec.flower && list.length > 60;
    // Up close, the painted tree where there is one (src/painted-trees.js; the plane first).
    const painted = !spec.far && !spec.lamp ? paintedTree(kind, spec, {bands, shared, seasons: SEASONS}) : null;
    const near = new THREE.InstancedMesh(painted ? painted.geometry : geo, painted ? painted.materials : spec.lamp ? lampMat : treeMaterial(kind, spec),
      lod ? Math.min(list.length, NEAR_CAP) : list.length);
    near.name = `trees ${kind}`;
    if (!lod) {
      mats.forEach((m, i) => { near.setMatrixAt(i, m); near.setColorAt(i, cols[i]); });
      near.computeBoundingSphere(); near.receiveShadow = true; scene.add(near);
      if (!spec.lotus && !spec.flower && !spec.lamp) {
        const caster = new THREE.InstancedMesh(silhouetteGeometry(spec), shadowOnly, list.length);
        caster.instanceMatrix = near.instanceMatrix; caster.castShadow = true; caster.frustumCulled = false; scene.add(caster);
      }
      treeTriangles += geo.attributes.position.count / 3 * list.length;
      continue;
    }
    near.count = 0; near.frustumCulled = false; near.receiveShadow = true; scene.add(near);
    // Shadows: never from the full crowns (HANDOFF 4.2: millions of triangles through the shadow map
    // lost the GPU). An invisible silhouette shares the near trees' instance matrices and casts.
    const caster = new THREE.InstancedMesh(silhouetteGeometry(spec), shadowOnly, near.instanceMatrix.count);
    caster.instanceMatrix = near.instanceMatrix; caster.count = 0; caster.castShadow = true; caster.frustumCulled = false;
    scene.add(caster);
    const farGeo = silhouetteGeometry(spec), far = new THREE.InstancedMesh(farGeo, spec.lamp ? lampMat : treeMaterial(kind, spec), list.length);
    mats.forEach((m, i) => { far.setMatrixAt(i, m); far.setColorAt(i, cols[i]); });
    far.computeBoundingSphere(); far.name = `trees ${kind} far`; scene.add(far);
    lodKinds.push({list, mats, cols, near, far, caster, shown: new Set()});
    treeTriangles += farGeo.attributes.position.count / 3 * list.length;
  }
  let lodAt = -1, lodX = 1e9, lodZ = 1e9;
  function updateTreeLod(t, centre) {
    // Every half second, or sooner after a long move (a glide or a gate).
    if (t - lodAt < .5 && Math.hypot(centre.x - lodX, centre.z - lodZ) < 40) return;
    lodAt = t; lodX = centre.x; lodZ = centre.z;
    const r2 = NEAR_R * NEAR_R;
    for (const k of lodKinds) {
      const now = new Set();
      for (let i = 0; i < k.list.length && now.size < NEAR_CAP; i++) {
        const tr = k.list[i], dx = tr[1] - centre.x, dz = tr[3] - centre.z;
        if (dx * dx + dz * dz < r2) now.add(i);
      }
      for (const i of k.shown) if (!now.has(i)) k.far.setMatrixAt(i, k.mats[i]);
      for (const i of now) if (!k.shown.has(i)) k.far.setMatrixAt(i, ZERO);
      let n = 0;
      for (const i of now) { k.near.setMatrixAt(n, k.mats[i]); k.near.setColorAt(n, k.cols[i]); n++; }
      k.near.count = n; k.caster.count = n;
      k.near.instanceMatrix.needsUpdate = true; if (k.near.instanceColor) k.near.instanceColor.needsUpdate = true;
      k.far.instanceMatrix.needsUpdate = true;
      k.shown = now;
    }
  }

  // --- Light, sky, weather --------------------------------------------------------------------------
  // Tiny Nanjing is lit like a diorama: a stronger sun against a dimmer sky fill, so long shadows
  // carve the blocks (the Tiny Warsaw look). The landmark worlds keep their softer light.
  const NIGHT_FOG = new THREE.Color(.07, .085, .15);
  const LIGHT = id === 'core' ? {sun: 1.35, sky: .7} : {sun: 1, sky: 1};
  const sky = createSkyDome(scene, skyShared).dome;
  // Softer than the atlas: at true scale the pale granite and paving fill the frame and glare.
  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x6d8a4a, 1.1), sun = new THREE.DirectionalLight(0xffe7b8, 2.0);
  scene.add(hemi, sun, sun.target);
  // A shadow box that follows the traveller: 240 m across, so a building's long evening shadow
  // stays in view. Its centre snaps to whole shadow texels or the shadow edges crawl as you walk.
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {left: -120, right: 120, top: 120, bottom: -120, near: 10, far: 1600});
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.6;
  const SHADOW_TEXEL = 240 / 2048, lightRight = new THREE.Vector3(), lightUp = new THREE.Vector3(), focus = new THREE.Vector3();
  const worldRain = rain.clone(), worldSnow = snow.clone();
  scene.add(worldRain, worldSnow);

  // --- Walk grid ------------------------------------------------------------------------------------
  // One grid per scene area (the Mausoleum and Music Stage, Meiling), concatenated in walk.bin.
  // A grid with a yaw is laid along a diagonal (the Yangtze Bridge deck): x0/y0 are then in its
  // own frame, turned by yaw (Blender radians, anticlockwise) about the world origin.
  function cellOf(x, z) {
    for (const g of walk.grids) {
      let u = x, v = -z;
      if (g.yaw) { const c = Math.cos(g.yaw), s = Math.sin(g.yaw); u = x * c - z * s; v = -x * s - z * c; }
      const c = g.cell || walk.cell, i = Math.floor((u - g.x0) / c), j = Math.floor((v - g.y0) / c);
      if (i >= 0 && j >= 0 && i < g.nx && j < g.ny) { cellZ = g.zOff || 0; return g.offset + j * g.nx + i; }
    }
    return -1;
  }
  function heightAt(x, z) {
    const c = cellOf(x, z);
    if (c < 0 || heights[c] === walk.noWalk) return null;
    return heights[c] / 100 + cellZ;
  }
  // Road cells carry an odd centimetre in the walk grid (blender/export_web.py).
  function roadAt(x, z) {
    const c = cellOf(x, z);
    return c >= 0 && heights[c] !== walk.noWalk && (heights[c] & 1) ? heights[c] / 100 + cellZ : null;
  }
  const hasRoads = heights.some(h => h !== walk.noWalk && (h & 1));
  function waterAt(x, z) {
    if (!waterHeights) return null;
    const c = cellOf(x, z);
    if (c < 0 || waterHeights[c] === walk.noWalk) return null;
    return waterHeights[c] / 100 + cellZ;
  }
  // The nearest point (a spiral of rings) where test(x, z) holds, within r metres; null if none.
  function nearest(test, x, z, r) {
    for (let d = 0; d <= r; d += 2) {
      const n = Math.max(1, Math.round(d * 1.2));
      for (let k = 0; k < n; k++) {
        const a = 2 * Math.PI * k / n, px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
        if (test(px, pz) !== null) return [px, pz];
      }
    }
    return null;
  }
  // The traveller's height: the walk grid read between its cell centres, as the drawn ground runs,
  // not cell by cell. Each cell is flat, and on a 4 m grid up a 10 % road (by Zhongshan Gate) the
  // bike's wheels sank 20 cm into the asphalt at a cell's uphill edge (the owner saw it). Where
  // the four cells round a point are not one surface (a drop, no walk), the nearest cell's height
  // averaged over half a step round it, so stairs feel like a steady climb rather than a camera
  // that judders on every riser.
  function between(x, z, h0) {
    for (const g of walk.grids) {
      let u = x, v = -z;
      if (g.yaw) { const c = Math.cos(g.yaw), s = Math.sin(g.yaw); u = x * c - z * s; v = -x * s - z * c; }
      const c = g.cell || walk.cell, fi = (u - g.x0) / c - .5, fj = (v - g.y0) / c - .5;
      if (fi < -.5 || fj < -.5 || fi >= g.nx - .5 || fj >= g.ny - .5) continue;
      const i = Math.floor(fi), j = Math.floor(fj), a = fi - i, b = fj - j;
      if (i < 0 || j < 0 || i + 1 >= g.nx || j + 1 >= g.ny) return null;
      const q = [heights[g.offset + j * g.nx + i], heights[g.offset + j * g.nx + i + 1],
        heights[g.offset + (j + 1) * g.nx + i], heights[g.offset + (j + 1) * g.nx + i + 1]];
      if (q.includes(walk.noWalk)) return null;
      // Within an ordinary step only: a grid's taller step (Purple Mountain's 1.6 m terraces) read
      // between would float the traveller beside a wall.
      const [h00, h10, h01, h11] = q.map((h) => h / 100 + (g.zOff || 0));
      if ([h00, h10, h01, h11].some((h) => Math.abs(h - h0) >= STEP_UP)) return null;
      return (h00 * (1 - a) + h10 * a) * (1 - b) + (h01 * (1 - a) + h11 * a) * b;
    }
    return null;
  }
  function surface(x, z) {
    const h0 = heightAt(x, z);
    if (h0 === null) return null;
    const smooth = between(x, z, h0);
    if (smooth !== null) return smooth;
    let sum = 0, n = 0;
    for (const [dx, dz] of [[0, 0], [.7, 0], [-.7, 0], [0, .7], [0, -.7]]) {
      const h = heightAt(x + dx, z + dz);
      if (h !== null && Math.abs(h - h0) < STEP_UP) { sum += h; n++; }
    }
    return sum / n;
  }
  // A grid may allow a taller step than STEP_UP: Mufu Mountain's 3 m grid climbs stairs and slopes
  // a finer grid would take in several steps (blender/export_web.py, stepUp).
  function stepAt(x, z) {
    const c = cellOf(x, z);
    if (c < 0) return STEP_UP;
    for (const g of walk.grids) if (c >= g.offset && c < g.offset + g.nx * g.ny) return g.stepUp || STEP_UP;
    return STEP_UP;
  }
  function canStep(from, x, z) {
    const h0 = heightAt(from.x, from.z), h1 = heightAt(x, z);
    return h1 !== null && (h0 === null || Math.abs(h1 - h0) <= stepAt(x, z));
  }

  // --- Pigeons over the Music Stage: circle, glide, settle on the lawn, take off again ---------------
  // In Tiny Nanjing the Music Stage is the Zhongshan world merged onto Purple Mountain (zs-).
  const musicSpawn = meta.spawns.music || meta.spawns['zs-music'], seats = Object.entries(meta.seats).map(([k, v]) => ({id: k, ...v}));
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
    // Blossom falls in spring (season 0, fading by summer); a rung bell still shakes some loose.
    const spring = Math.max(0, 1 - Math.min((shared.season?.value ?? 0) % 4, 4 - (shared.season?.value ?? 0) % 4));
    const rate = active ? (petals.burst > 0 ? 400 : 60 * spring) : 0;
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
  // Xuanwu Lake: its carp, a jumping culter and the name boards at its gates and islands.
  const xuanwu = id === 'core' && waterHeights ? createXuanwuLife(scene, {waterAt, heightAt, nearest, shared}) : null;
  scene.add(traveller.root, magpie.root);
  traveller.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const body = new THREE.Vector3(), lastBody = new THREE.Vector3();
  let heading = 0, speed = 0, seated = null, glide = null, view = 'third', mode = 'walk', ride = null;
  // Ways to explore: on foot, by bike (wherever one can walk: roads, pavements, plazas) or by boat
  // (anywhere on water.bin). Bike and boat steer like vehicles: W forward, A/D turn.
  let vehicle = 'walk', vspeed = 0, steerLean = 0;
  const skiff = (() => {
    const g = new THREE.Group(), wood = new THREE.MeshToonMaterial({color: 0x8a5a36, gradientMap: bands});
    const hull = new THREE.Mesh(new THREE.BoxGeometry(1.5, .5, 4.2), wood);
    const bow = new THREE.Mesh(new THREE.ConeGeometry(.75, 1.1, 4), wood);
    bow.rotation.set(Math.PI / 2, Math.PI / 4, 0); bow.scale.set(1, 1, .6); bow.position.set(0, .05, 2.6);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(1.3, .08, .5), new THREE.MeshToonMaterial({color: 0xc9a46a, gradientMap: bands}));
    hull.position.y = .05; seat.position.set(0, .32, -.4);
    g.add(hull, bow, seat); g.visible = false;
    return g;
  })();
  scene.add(skiff);

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
  // --- Traffic (meta.traffic): trains on the bridge's lower deck, barges on the river, cars on the
  // road. Each route runs one way and wraps; vehicles off either end are hidden. -------------------
  const skin = (c, e = 0, ei = .6) => new THREE.MeshToonMaterial({color: c, gradientMap: bands, emissive: e, emissiveIntensity: ei});
  function trainCar(i) {
    const g = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(3.1, 3.6, 22.5), skin(i === 0 ? 0xb8432f : 0x2f6b4a));
    const band = new THREE.Mesh(new THREE.BoxGeometry(3.16, .9, 21), skin(0xf3e6c4, 0xffd28a, .35));
    const roof = new THREE.Mesh(new THREE.BoxGeometry(2.7, .5, 22), skin(0x59605c));
    shell.position.y = 2.3; band.position.y = 2.8; roof.position.y = 4.3;
    g.add(shell, band, roof);
    return g;
  }
  function barge() {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(11, 2.2, 62), skin(0x3d3a36));
    const deck = new THREE.Mesh(new THREE.BoxGeometry(9.6, .6, 44), skin(0x8a6a48));   // cargo of sand or coal
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(8.5, 5.5, 7), skin(0xeae6dc));
    const glow = new THREE.Mesh(new THREE.BoxGeometry(8.6, 1, 6), skin(0xffd28a, 0xffb347, .8));
    hull.position.y = .6; deck.position.set(0, 1.9, 6); cabin.position.set(0, 4.2, -25); glow.position.set(0, 5.4, -25);
    g.add(hull, deck, cabin, glow);
    return g;
  }
  const traffic = [];
  const carPaint = [0xd9d4c8, 0x2b3f9e, 0xb8432f, 0x3e7d5a, 0x5d6670, 0xe2b04a, 0xf3f0e8];
  for (const t of meta.traffic || []) {
    const curve = new THREE.CatmullRomCurve3(t.pts.map(p => new THREE.Vector3(...p)), false, 'centripetal'), length = curve.getLength();
    const r = {kind: t.kind, curve, length, speed: t.speed || 10, units: []};
    if (t.kind === 'train') {
      // One train per route, its carriages trailing along the curve.
      r.cars = Array.from({length: t.cars || 12}, (_, i) => { const m = trainCar(i); scene.add(m); return m; });
      r.units.push({u: t.phase || 0});
      r.gap = t.gap || 600;   // metres of empty track between trains
    } else if (t.kind === 'ship') {
      for (let i = 0; i < (t.n || 3); i++) { const m = barge(); scene.add(m); r.units.push({u: (i + (t.phase || 0)) / (t.n || 3), mesh: m}); }
    } else {
      // A painted body and a dark glass cabin: two instanced draws sharing each car's matrix.
      const n = t.n || 30, body = new THREE.BoxGeometry(1.85, .95, 4.5), cabin = new THREE.BoxGeometry(1.6, .7, 2.4);
      body.translate(0, .62, 0); cabin.translate(0, 1.43, -.2);
      r.inst = new THREE.InstancedMesh(body, skin(0xffffff), n);
      r.cabin = new THREE.InstancedMesh(cabin, skin(0x2e3a44, 0xffd28a, .08), n);
      for (let i = 0; i < n; i++) { r.inst.setColorAt(i, new THREE.Color(carPaint[i % carPaint.length])); r.units.push({u: (i + Math.random() * .6) / n}); }
      r.inst.frustumCulled = r.cabin.frustumCulled = false; scene.add(r.inst, r.cabin);
    }
    traffic.push(r);
  }
  const trafficDummy = new THREE.Object3D();
  let rumble = 0;
  function updateTraffic(dt) {
    rumble = 0;
    for (const r of traffic) {
      if (r.kind === 'train') {
        const u = r.units[0], span = r.length + r.gap, carLen = 23;
        u.u = (u.u * span + r.speed * dt) % span / span;
        const head = u.u * span;
        r.cars.forEach((m, i) => {
          const s = head - i * carLen;
          m.visible = s > 0 && s < r.length;
          if (!m.visible) return;
          const p = r.curve.getPointAt(s / r.length), tan = r.curve.getTangentAt(s / r.length);
          m.position.copy(p); m.rotation.y = Math.atan2(tan.x, tan.z);
          // The bridge hums underfoot as the train passes beneath the walkway.
          const d = Math.hypot(p.x - body.x, p.z - body.z);
          if (d < 30 && body.y > p.y) rumble = Math.max(rumble, 1 - d / 30);
        });
      } else if (r.kind === 'ship') {
        for (const s of r.units) {
          s.u = (s.u + r.speed * dt / r.length) % 1;
          const p = r.curve.getPointAt(s.u), tan = r.curve.getTangentAt(s.u);
          s.mesh.position.copy(p); s.mesh.rotation.y = Math.atan2(tan.x, tan.z);
        }
      } else {
        r.units.forEach((c, i) => {
          c.u = (c.u + r.speed * dt / r.length) % 1;
          const p = r.curve.getPointAt(c.u), tan = r.curve.getTangentAt(c.u);
          trafficDummy.position.copy(p); trafficDummy.rotation.set(0, Math.atan2(tan.x, tan.z), 0);
          trafficDummy.updateMatrix(); r.inst.setMatrixAt(i, trafficDummy.matrix); r.cabin.setMatrixAt(i, trafficDummy.matrix);
        });
        r.inst.instanceMatrix.needsUpdate = r.cabin.instanceMatrix.needsUpdate = true;
      }
    }
  }
  const camDir = new THREE.Vector3(), tmp = new THREE.Vector3();
  // Metro and buses on real lines (src/transit.js; Tiny Nanjing only).
  const seatPose = {};

  // Bike and boat: a speed that builds and coasts, steering that tightens with speed; the bike keeps
  // to walkable ground (the walk grid's own steps), the boat to water.
  function drive(keys, dt) {
    const fwd = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
    const steer = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
    const fast = keys.has('ShiftLeft') || keys.has('ShiftRight'), bike = vehicle === 'bike';
    const top = bike ? (fast ? 9 : 5.5) : (fast ? 5 : 3);
    vspeed = THREE.MathUtils.damp(vspeed, fwd > 0 ? top : fwd < 0 ? (bike ? 0 : -1.2) : 0, fwd ? 1.4 : bike ? .9 : .5, dt);
    heading -= steer * dt * (bike ? 1.8 : .9) * THREE.MathUtils.clamp(Math.abs(vspeed) / 2.5, .25, 1);
    steerLean = THREE.MathUtils.damp(steerLean, -steer * .22 * Math.min(1, Math.abs(vspeed) / 4), 6, dt);
    const nx = body.x + Math.sin(heading) * vspeed * dt, nz = body.z + Math.cos(heading) * vspeed * dt;
    let moved = false;
    if (bike) {
      // On a map with roads the bike keeps to the carriageway; elsewhere (temple courts, mountain
      // paths) any walkable ground will do.
      // Junctions: a crossing road's pavement lies over the carriageway, so a short gap is fine
      // when there is road again within 12 m ahead.
      const fits = (h) => {
        const sx = Math.sin(h), sz = Math.cos(h), px = body.x + sx * vspeed * dt, pz = body.z + sz * vspeed * dt;
        // Road here, ahead, or within 3 m to either side: on the 4 m grids a road crossing at a slant
        // is a one-cell diagonal, and the bike fell off its corners.
        const onRoad = !hasRoads || roadAt(px, pz) !== null || roadAt(px + sx * 6, pz + sz * 6) !== null || roadAt(px + sx * 12, pz + sz * 12) !== null
          || roadAt(px + sz * 3, pz - sx * 3) !== null || roadAt(px - sz * 3, pz + sx * 3) !== null;
        return canStep({x: body.x, z: body.z}, px, pz) && onRoad ? [px, pz] : null;
      };
      // Straight on; or, blocked by a trunk or post, veer a little round it rather than stop dead.
      let to = fits(heading);
      for (const d of [.26, -.26, .52, -.52, 1.05, -1.05, 1.57, -1.57]) if (!to) to = fits(heading + d);
      if (to) { body.x = to[0]; body.z = to[1]; moved = true; } else vspeed *= .3;
      const h = surface(body.x, body.z);
      if (h !== null) body.y = THREE.MathUtils.damp(body.y, h, 14, dt);
    } else {
      const w = waterAt(nx, nz);
      if (w !== null) { body.x = nx; body.z = nz; moved = true; body.y = w; } else vspeed *= -.2;
    }
    return moved && Math.abs(vspeed) > .2;
  }

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
    overview: false,     // set while this world is the home page's aerial view
    spawn(name = 'axis') {
      const s = meta.spawns[name] || Object.values(meta.spawns)[0];
      const h = surface(s.position[0], s.position[2]) ?? s.position[1];
      return {position: [s.position[0], h + EYE, s.position[2]], feet: [s.position[0], h, s.position[2]],
        look: [s.look[0], h + EYE, s.look[2]]};
    },
    ground: (x, z) => surface(x, z),
    // For route-finding in tests (tests/mufu-journey-browser.mjs): the walk grid as it is.
    grid: {height: (x, z) => heightAt(x, z), road: (x, z) => roadAt(x, z), stepUp: (x, z) => stepAt(x, z)},
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
      // Arriving anywhere is on foot: a boat kept from before hovered over the new place's ground.
      if (vehicle === 'boat') { vehicle = 'walk'; vspeed = 0; }
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
    transit,
    // Bus and metro (src/transit.js): what is near, and the rides. Messages come back through
    // the callbacks for the toast.
    nearestTransit(radius = 6) { return transit?.nearest(body.x, body.z, radius) || null; },
    waitForBus(stop, boarded, line = null) {
      // At the terminus everyone gets off: onto the stop's pavement, and the page is told (world.onAlight).
      transit.setAlight((st, last, line) => {
        body.set(st.spot[0], heightAt(st.spot[0], st.spot[1]) ?? body.y, st.spot[1]); mode = 'walk';
        world.onAlight?.(st, last, line);
      });
      return transit.waitAt(stop, b => { seated = null; boarded(b); }, line);
    },
    getOffBus(off) {
      transit.requestStop(stop => {
        body.set(stop.spot[0], heightAt(stop.spot[0], stop.spot[1]) ?? body.y, stop.spot[1]);
        mode = 'walk'; off(stop);
      });
    },
    // Stay aboard until a chosen stop, then off onto its pavement.
    rideTo(dest, off) {
      transit.setDestination(dest, stop => {
        body.set(stop.spot[0], heightAt(stop.spot[0], stop.spot[1]) ?? body.y, stop.spot[1]);
        mode = 'walk'; off(stop);
      });
    },
    rideMetro(line, from, to, {onStation, arrive} = {}) {
      if (glide || ride) return null;
      world.setVehicle('walk'); seated = null; mode = 'sit';
      return transit.rideMetro(line, from, to, {onStation, arrive: e => {
        // Out of the entrance's open end, onto the pavement in front of it.
        const r = e.line.route, k = Math.round(THREE.MathUtils.clamp(e.stop.s / 2, 0, r.n - 1)), h = r.hs[k];
        const out = nearest(heightAt, e.spot[0] + Math.sin(h) * 4.5, e.spot[1] + Math.cos(h) * 4.5, 12) || e.spot;
        body.set(out[0], heightAt(out[0], out[1]) ?? e.y, out[1]); lastBody.copy(body); mode = 'walk';
        heading = h;
        arrive?.(e);
      }});
    },
    get vehicle() { return vehicle; },
    get canBike() { return true; },
    get canBoat() { return !!waterHeights; },
    get xuanwu() { return xuanwu; },
    // Switch the way of moving. Returns a short message for the toast, or null if it cannot.
    setVehicle(v) {
      if (glide || ride || mode === 'glide') return null;
      seated = null; mode = 'walk';
      if (v === 'boat') {
        if (!waterHeights) return null;
        const at = waterAt(body.x, body.z) !== null ? [body.x, body.z] : nearest(waterAt, body.x, body.z, 90);
        if (!at) return 'No water near here: walk to the shore first';
        body.set(at[0], waterAt(at[0], at[1]), at[1]); vehicle = 'boat'; vspeed = 0;
        return 'Boat · W row · A / D turn · Shift faster · 1 to step ashore';
      }
      if (vehicle === 'boat') {
        const at = nearest(heightAt, body.x, body.z, 60);
        if (!at) return 'Too far from the shore';
        body.set(at[0], heightAt(at[0], at[1]), at[1]);
      }
      if (v === 'bike' && hasRoads && roadAt(body.x, body.z) === null) {
        const at = nearest(roadAt, body.x, body.z, 80);
        if (!at) return 'No road near here';
        body.set(at[0], roadAt(at[0], at[1]), at[1]);
      }
      vehicle = v === 'bike' ? 'bike' : 'walk'; vspeed = 0; steerLean = 0;
      return vehicle === 'bike' ? 'Bike · W pedal · S brake · A / D steer · Shift faster' : 'On foot';
    },
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
      if (transit?.busRide || transit?.metroRide) return false;
      if (transit?.waiting && (forward || side)) transit.cancelWait();
      if (vehicle !== 'walk') return drive(keys, dt);
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
        // Blocked: slide along whichever way is free, at least half the step, so a walker brushing a
        // trunk's corner slips past instead of creeping to a stop (the slide shrank to nothing as
        // the way ahead turned parallel to the blocked edge).
        const len = Math.hypot(dir.x, dir.z), sx = Math.sign(dir.x) * Math.max(Math.abs(dir.x), len * .5), sz = Math.sign(dir.z) * Math.max(Math.abs(dir.z), len * .5);
        if (canStep(from, body.x + dir.x, body.z + dir.z)) { body.x += dir.x; body.z += dir.z; moved = true; }
        else if (Math.abs(dir.x) >= Math.abs(dir.z) && canStep(from, body.x + sx, body.z)) { body.x += sx; moved = true; }
        else if (dir.z !== 0 && canStep(from, body.x, body.z + sz)) { body.z += sz; moved = true; }
        else if (dir.x !== 0 && canStep(from, body.x + sx, body.z)) { body.x += sx; moved = true; }
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
      if (transit?.metroCamera(camera, dt, view)) return;
      if (transit?.busRide && view === 'third') {
        // On the bus: behind and above its roof, looking along the street.
        camera.getWorldDirection(camDir);
        const eye = body.clone().add(new THREE.Vector3(0, 4.2, 0)).addScaledVector(camDir, -13);
        camera.position.lerp(eye, 1 - Math.exp(-dt * 8));
        return;
      }
      const sitting = mode === 'sit' && !ride && vehicle === 'walk', flyingNow = mode === 'glide';
      if (vehicle !== 'walk' && view === 'third') {
        if (Math.abs(vspeed) > 1) {
          const want = heading + Math.PI;
          let dy = want - camera.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          camera.rotation.y += dy * (1 - Math.exp(-dt * 2.2));
        }
        camera.getWorldDirection(camDir);
        const eye = body.clone().add(new THREE.Vector3(0, vehicle === 'boat' ? 2.6 : 2.2, 0)).addScaledVector(camDir, vehicle === 'boat' ? -7 : -5.5);
        clearOfTrunks(eye, body);
        const g = surface(eye.x, eye.z);
        if (g !== null) eye.y = Math.max(eye.y, g + .6);
        camera.position.lerp(eye, 1 - Math.exp(-dt * 12));
        return;
      }
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
      if (!flyingNow) clearOfTrunks(eye, body);
      const g = surface(eye.x, eye.z);
      if (g !== null) eye.y = Math.max(eye.y, g + .45);
      camera.position.lerp(eye, 1 - Math.exp(-dt * 18));
      if (rumble > 0) camera.position.y += Math.sin(performance.now() * .09) * .025 * rumble;
    },
    frame(dt, t, weather, direction, camera) {
      if (glide) {
        glide.t += dt;
        const k = Math.min(glide.t / glide.seconds, 1), e = k * k * (3 - 2 * k) * .25 + k * .75;
        const tan = glide.curve.getTangentAt(e);
        body.copy(glide.curve.getPointAt(e)); heading = Math.atan2(tan.x, tan.z);
        if (k >= 1) world.endGlide();
      }
      if (transit) {
        transit.update(dt, weather.night || 0, camera.position.y - (surface(camera.position.x, camera.position.z) ?? (mode === 'glide' ? 10 : body.y)), body, camera);
        if (transit.seat(seatPose)) { body.set(seatPose.x, seatPose.y, seatPose.z); heading = seatPose.h; mode = 'sit'; }
      }
      speed = dt > 0 ? Math.hypot(body.x - lastBody.x, body.z - lastBody.z) / dt : 0;
      lastBody.copy(body);
      traveller.root.position.copy(body);
      traveller.root.rotation.y = heading;
      traveller.root.visible = (view === 'third' || !!glide) && !transit?.busRide && !transit?.metroRide;
      glider.visible = mode === 'glide';
      traveller.update(dt, mode === 'glide' ? 0 : speed, vehicle === 'bike' && mode !== 'glide' ? 'bike' : vehicle === 'boat' ? 'sit' : mode, t);
      // Lean into a turn on the bike; a boat bobs.
      traveller.root.rotation.z = vehicle === 'bike' ? steerLean : 0;
      // The boat only on water: anywhere else the traveller steps ashore (the owner saw it in the air).
      if (vehicle === 'boat' && waterAt(body.x, body.z) === null) {
        vehicle = 'walk'; vspeed = 0;
        const at = nearest(heightAt, body.x, body.z, 40);
        if (at) body.set(at[0], heightAt(at[0], at[1]), at[1]);
      }
      skiff.visible = vehicle === 'boat';
      if (skiff.visible) {
        skiff.position.set(body.x, body.y + Math.sin(t * 1.4) * .05, body.z); skiff.rotation.set(Math.sin(t * 1.1) * .03, heading, 0);
        traveller.root.position.y = body.y + .55;
      }
      magpie.update(dt, t, body, heading, speed, mode, surface);
      xuanwu?.update(dt, t, body, vehicle);
      // The shadow box centres on the traveller (or the camera while gliding), snapped to texels
      // along the light's own axes.
      focus.copy(glide || mode === 'glide' ? camera.position : body);
      lightRight.crossVectors(direction, up).normalize(); lightUp.crossVectors(lightRight, direction).normalize();
      const r = focus.dot(lightRight), u = focus.dot(lightUp);
      focus.addScaledVector(lightRight, Math.round(r / SHADOW_TEXEL) * SHADOW_TEXEL - r).addScaledVector(lightUp, Math.round(u / SHADOW_TEXEL) * SHADOW_TEXEL - u);
      sun.position.copy(focus).addScaledVector(direction, 600); sun.target.position.copy(focus);
      // At night the directional light is the moon: faint and blue.
      const night = weather.night || 0;
      sun.intensity = (2.1 - weather.storm * 1.5 - weather.snow * .6) * (1 - weather.dawn * .6) * (1 - night * .86) * LIGHT.sun;
      sun.color.setRGB(1 - night * .45, 1 - weather.sunset * .3 - night * .3, 1 - weather.sunset * .55);
      hemi.intensity = (1.05 - weather.storm * .35 - weather.dawn * .55) * (1 - night * .84) * LIGHT.sky;
      hemi.color.setRGB(.81 - night * .45, .9 - night * .4, 1);
      scene.fog.color.setRGB(.66 + weather.sunset * .26 - weather.storm * .30, .80 - weather.sunset * .2 - weather.storm * .36, .93 - weather.sunset * .32 - weather.storm * .40)
        .lerp(NIGHT_FOG, night * .92);
      // Per-world haze: the lake needs a kilometre of view, the forest slice much less.
      const haze = meta.fog ?? .0011;
      // From the home page's height the street haze would bury the city: a fifth of it up there.
      scene.fog.density = (world.overview ? haze * .2 : mode === 'glide' ? haze * .45 : haze) + weather.storm * .004 + weather.snow * .003;
      // In the metro carriage: the tunnel's own dark, whatever the weather above.
      if (transit?.inCarriage) { scene.fog.color.setRGB(.07, .08, .085); scene.fog.density = .006; }
      sky.position.copy(camera.position);
      hazeColor.value.copy(scene.fog.color);
      worldRain.position.copy(camera.position); worldSnow.position.copy(camera.position);
      worldRain.visible = weather.storm > .02; worldSnow.visible = weather.snow > .02;
      updatePigeons(t, dt, !!seated);
      updatePetals(t, dt, body);
      updateTreeLod(t, glide || mode === 'glide' ? camera.position : body);
      updateTraffic(dt);
      // A metro train passing under the walker shakes the view a little.
      if (transit && !glide && mode !== 'glide' && !transit.metroRide) rumble = Math.max(rumble, transit.rumbleAt(body.x, body.z) * .6);
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
      return {id, staticTriangles, treeTriangles, trees: trees.length, uprooted, walkCells: walk.walkableCells, seats: seats.length,
        seated: !!seated, gliding: !!glide, view, mode, body: body.toArray().map(v => +v.toFixed(2)), materials: cache.size};
    },
  };
  return world;
}
