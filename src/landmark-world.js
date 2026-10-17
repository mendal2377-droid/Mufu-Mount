import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {createSkyDome} from './sky.js';

// A landmark scene modelled in Blender (blender/build_<id>.py, exported by blender/export_web.py)
// and streamed on arrival. Unlike the atlas it is in true metres: the walker's eye is 1.65 m, the
// 392 steps are real steps, and walking is free over a ray-cast walk grid instead of corridors.

const EYE = 1.65, SIT_EYE = 1.15, STEP_UP = .65, WALK = 1.7, RUN = 4.6;

// Palette names from design/ART-BIBLE.md; the GLB carries them as material names.
const PAINT = {
  lawn: {mottle: .10, scale: .18}, forest_floor: {mottle: .14, scale: .09}, paving: {mottle: .05, scale: .7, joints: 1},
  paving_joint: {mottle: .05, scale: .7}, granite: {mottle: .04, scale: .5, joints: .6}, granite_shade: {mottle: .05, scale: .5},
  hedge: {mottle: .12, scale: 1.2}, vine: {mottle: .16, scale: 1.4}, water: {mottle: 0, scale: 1},
};

// Look-dev tree kinds (blender/kit.py tree_prototypes) drawn as soft painted balls: a few crown
// lobes with normals pointing out of the crown's centre, so banded toon light reads as gouache.
const TREES = {
  broadleaf: {crown: '#5E8F3A', trunk: '#5A4636', h: 14, r: 5.0, lobes: 5},
  broadleaf_sun: {crown: '#A7C24A', trunk: '#5A4636', h: 12, r: 4.2, lobes: 4},
  broadleaf_shade: {crown: '#2F5A3A', trunk: '#5A4636', h: 16, r: 5.5, lobes: 6},
  plane_autumn: {crown: '#E2B233', trunk: '#B9B39A', h: 18, r: 5.5, lobes: 5},
  maple_autumn: {crown: '#D0622E', trunk: '#5A4636', h: 9, r: 3.6, lobes: 4},
  cedar: {crown: '#3D5E3F', trunk: '#5A4636', h: 18, r: 4.2, cone: 5},
  cypress: {crown: '#3D5E3F', trunk: '#5A4636', h: 9, r: 1.6, cone: 4},
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
  const trunk = new THREE.CylinderGeometry(spec.r * .06, spec.r * .09, spec.h * .62, 5, 1, true).toNonIndexed();
  trunk.translate(0, spec.h * .31, 0);
  parts.push(colour(trunk, spec.trunk));
  if (spec.cone) {
    for (let k = 0; k < spec.cone; k++) {
      const t = k / spec.cone, g = new THREE.ConeGeometry(spec.r * (1 - t * .75), spec.h * .42, 8, 1).toNonIndexed();
      g.translate(0, spec.h * (.32 + .6 * t), 0);
      parts.push(colour(g, spec.crown));
    }
  } else {
    const centre = new THREE.Vector3(0, spec.h * .74, 0);
    for (let k = 0; k <= spec.lobes; k++) {
      const top = k === spec.lobes, a = 6.283 * k / spec.lobes + rand();
      const rr = top ? spec.r * .72 : spec.r * (.5 + .22 * rand());
      // Detail 0 lobes (20 triangles) under a detail 1 top: ~150 triangles a tree, 6,800 trees.
      const g = new THREE.IcosahedronGeometry(rr, top ? 1 : 0).toNonIndexed();
      const c = top ? new THREE.Vector3(0, spec.h * .82, 0)
        : new THREE.Vector3(Math.cos(a) * spec.r * .45, spec.h * (.62 + .16 * rand()), Math.sin(a) * spec.r * .45);
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
  const cache = new Map();
  function paint(src) {
    const name = (src.name || 'granite').replace(/\.\d+$/, '');
    if (cache.has(name)) return cache.get(name);
    const style = PAINT[name] || {mottle: .05, scale: .6};
    const mat = new THREE.MeshToonMaterial({color: src.color.clone(), gradientMap: bands, side: THREE.FrontSide});
    mat.name = name;
    if (name === 'water') { mat.color.multiplyScalar(1.05); mat.emissive = new THREE.Color(0x0b2f3a); }
    mat.onBeforeCompile = s => {
      s.uniforms.citySnow = shared.snow; s.uniforms.worldMottle = {value: style.mottle}; s.uniforms.worldScale = {value: style.scale};
      s.uniforms.worldJoints = {value: style.joints || 0};
      s.vertexShader = 'varying vec3 vWorldPos;varying float vUp;\n' + s.vertexShader.replace('#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWorldPos=(modelMatrix*vec4(transformed,1.)).xyz;vUp=normalize(mat3(modelMatrix)*objectNormal).y;');
      s.fragmentShader = 'uniform float citySnow,worldMottle,worldScale,worldJoints;varying vec3 vWorldPos;varying float vUp;\n' +
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
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.9,.86),citySnow*.7*smoothstep(.4,.9,vUp));`);
    };
    mat.customProgramCacheKey = () => 'landmark-paint-v2';
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
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, t[4]); sc.setScalar(t[5]); pos.set(t[1], t[2], t[3]);
      inst.setMatrixAt(i, m4.compose(pos, q, sc));
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
  function cellOf(x, z) {
    const i = Math.floor((x - walk.x0) / walk.cell), j = Math.floor((-z - walk.y0) / walk.cell);
    return (i < 0 || j < 0 || i >= walk.nx || j >= walk.ny) ? -1 : j * walk.nx + i;
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

  let seated = null;
  const world = {
    id, meta, scene, sky, seats, staticTriangles, treeTriangles,
    spawn(name = 'axis') {
      const s = meta.spawns[name] || Object.values(meta.spawns)[0];
      const h = surface(s.position[0], s.position[2]) ?? s.position[1];
      return {position: [s.position[0], h + EYE, s.position[2]], look: s.look};
    },
    ground: (x, z) => surface(x, z),
    nearestSeat(p, radius = 3) {
      let best = null;
      for (const s of seats) { const d = Math.hypot(s.position[0] - p.x, s.position[2] - p.z); if (d < radius && (!best || d < best.d)) best = {s, d}; }
      return best?.s || null;
    },
    get seated() { return seated; },
    sit(camera, seat) {
      seated = {seat, from: camera.position.clone(), t: 0};
    },
    stand() { seated = null; },
    // Free walking: forward/side in the camera's ground plane, sliding along walls.
    walk(camera, keys, dt) {
      const forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown'));
      const side = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const fast = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const p = camera.position;
      if (seated) {
        if (forward || side) { seated = null; return false; }
        seated.t = Math.min(1, seated.t + dt * .8);
        const s = seated.seat, k = THREE.MathUtils.smootherstep(seated.t, 0, 1);
        const sh = (heightAt(s.position[0], s.position[2]) ?? s.position[1]) + SIT_EYE;
        p.lerpVectors(seated.from, new THREE.Vector3(s.position[0], sh, s.position[2]), k);
        return false;
      }
      let moved = false;
      if (forward || side) {
        const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
        const right = new THREE.Vector3().crossVectors(dir, up);
        dir.multiplyScalar(forward).addScaledVector(right, side).normalize().multiplyScalar((fast ? RUN : WALK) * dt);
        const from = {x: p.x, z: p.z};
        if (canStep(from, p.x + dir.x, p.z + dir.z)) { p.x += dir.x; p.z += dir.z; moved = true; }
        else if (canStep(from, p.x + dir.x, p.z)) { p.x += dir.x; moved = true; }
        else if (canStep(from, p.x, p.z + dir.z)) { p.z += dir.z; moved = true; }
      }
      const h = surface(p.x, p.z);
      if (h !== null) p.y = THREE.MathUtils.damp(p.y, h + EYE, 14, dt);
      return moved;
    },
    frame(dt, t, weather, direction, camera, state) {
      sun.position.copy(camera.position).addScaledVector(direction, 600); sun.target.position.copy(camera.position);
      sun.intensity = (2.1 - weather.storm * 1.5 - weather.snow * .6) * (1 - weather.dawn * .6);
      sun.color.setRGB(1, 1 - weather.sunset * .3, 1 - weather.sunset * .55);
      hemi.intensity = 1.05 - weather.storm * .35 - weather.dawn * .55;
      scene.fog.color.setRGB(.66 + weather.sunset * .26 - weather.storm * .30, .80 - weather.sunset * .2 - weather.storm * .36, .93 - weather.sunset * .32 - weather.storm * .40);
      scene.fog.density = (state.flying ? .0006 : .0011) + weather.storm * .004 + weather.snow * .003;
      sky.position.copy(camera.position);
      worldRain.position.copy(camera.position); worldSnow.position.copy(camera.position);
      worldRain.visible = weather.storm > .02; worldSnow.visible = weather.snow > .02;
      updatePigeons(t, dt, !!seated);
    },
    stats() {
      return {id, staticTriangles, treeTriangles, trees: trees.length, walkCells: walk.walkableCells, seats: seats.length,
        seated: !!seated, materials: cache.size};
    },
  };
  return world;
}
