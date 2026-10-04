import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { fernGeometry, foliagePatch } from "./forest-geometry.js";

function seededRandom(seed) {
  return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}

export function canopyTexture(distant = false) {
  const c=document.createElement("canvas"); c.width=c.height=512;
  const g=c.getContext("2d"), rand=seededRandom(7391);
  // Leaves grow along forked sprays, separated by sky holes. A denser atlas
  // for distant points keeps fine alpha details from dissolving the hillside.
  for(let i=0;i<(distant?52:30);i++) {
    const angle=i*2.39996, r=Math.sqrt(rand())*180;
    const x=256+Math.cos(angle)*r,y=268+Math.sin(angle)*r*.88;
    const direction=angle+(rand()-.5),length=35+rand()*51;
    if(distant) {
      // At one-to-three screen pixels individual leaves are below the sampling
      // limit. Retain crown masses underneath the fine sprays at this LOD.
      g.fillStyle=`rgba(${96+i%7*4},${131+i%5*5},${57+i%4*5},.96)`;
      g.beginPath();g.ellipse(x,y,35+rand()*18,29+rand()*14,angle,0,Math.PI*2);g.fill();
    }
    g.strokeStyle="rgba(103,93,64,.8)";g.lineWidth=1.4;
    g.beginPath();g.moveTo(x-Math.cos(direction)*length*.4,y-Math.sin(direction)*length*.4);
    g.lineTo(x+Math.cos(direction)*length*.6,y+Math.sin(direction)*length*.6);g.stroke();
    for(let j=0;j<24;j++) {
      const along=(rand()-.4)*length,side=(rand()-.5)*32;
      const lx=x+Math.cos(direction)*along-Math.sin(direction)*side;
      const ly=y+Math.sin(direction)*along+Math.cos(direction)*side;
      const shade=.55+rand()*.45;
      g.fillStyle=`rgb(${Math.round(167*shade)},${Math.round(191*shade)},${Math.round(112*shade)})`;
      g.beginPath();g.ellipse(lx,ly,3+rand()*6,1.5+rand()*3,direction+side*.05,0,Math.PI*2);g.fill();
    }
  }
  const t=new THREE.CanvasTexture(c); t.anisotropy=4;
  return t;
}

export function leafTexture() {
  const c=document.createElement("canvas");c.width=c.height=128;
  const g=c.getContext("2d");
  const fill=g.createLinearGradient(16,112,112,16);
  fill.addColorStop(0,"#789452");fill.addColorStop(.45,"#d1deac");fill.addColorStop(1,"#8eaf59");
  g.fillStyle=fill;g.beginPath();g.moveTo(9,119);
  g.bezierCurveTo(2,45,51,11,119,9);g.bezierCurveTo(111,78,75,126,9,119);g.fill();
  g.strokeStyle="rgba(232,239,180,.55)";g.lineWidth=1.6;
  g.beginPath();g.moveTo(12,116);g.lineTo(116,12);g.stroke();
  for(let i=0;i<6;i++) {
    const v=25+i*13;
    g.beginPath();g.moveTo(v,128-v);g.lineTo(v-15,128-v-23);g.stroke();
    g.beginPath();g.moveTo(v,128-v);g.lineTo(v+23,128-v+15);g.stroke();
  }
  const t=new THREE.CanvasTexture(c);t.anisotropy=4;
  return t;
}

export function twigGeometry(height = 1.9, spread = .85, base = 0) {
  const segments=[],up=new THREE.Vector3(0,1,0),rand=seededRandom(582);
  function segment(a,b,r0,r1) {
    const delta=b.clone().sub(a);
    const g=new THREE.CylinderGeometry(r1,r0,delta.length(),4);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up,delta.normalize()));
    g.translate(...a.clone().add(b).multiplyScalar(.5).toArray());segments.push(g);
  }
  for(let i=0;i<6;i++) {
    const angle=i*2.4;
    const a=new THREE.Vector3(0,base,0);
    const b=new THREE.Vector3(Math.cos(angle)*spread*.45,base+height*.55,Math.sin(angle)*spread*.45);
    const tip=new THREE.Vector3(Math.cos(angle)*spread,base+height*(.8+rand()*.2),Math.sin(angle)*spread);
    segment(a,b,height*.014,height*.008);segment(b,tip,height*.008,height*.002);
    const fork=tip.clone().add(new THREE.Vector3(Math.cos(angle+1)*spread*.35,-height*.15,Math.sin(angle+1)*spread*.35));
    segment(b,fork,height*.006,height*.001);
  }
  const merged=mergeGeometries(segments);segments.forEach(g=>g.dispose());return merged;
}

// Small things at eye level and below: grass at the edge of the path, pollen
// hanging in the light, and leaves coming down. None of it is load-bearing for
// the model — it is there so the walk has something close to look at.

function grassTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d");
  g.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 26; i++) {
    const x = 8 + Math.random() * 112;
    const h = 22 + Math.random() * 93;
    const lean = (Math.random() - 0.5) * 64;
    const w = .8 + Math.random() * 1.6;
    const tone = 92 + Math.random() * 74;
    g.strokeStyle = `rgba(${Math.round(tone * 0.52)},${Math.round(tone)},${Math.round(tone * 0.42)},1)`;
    g.lineWidth = w;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(x, 128);
    g.quadraticCurveTo(x + lean * 0.4, 128 - h * 0.55, x + lean, 128 - h);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function softDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.4, "rgba(255,252,236,0.5)");
  grad.addColorStop(1, "rgba(255,248,226,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/** Every place a tuft of grass could stand: a band either side of each route. */
export function scatterAlongRoutes(routes, spacingMetres = 1.15) {
  const points = [];
  for (const [routeIndex, route] of routes.entries()) {
    if (routeIndex === 4) continue; // The short terrace is entirely paved.
    const half = route.width * 0.5;
    const pts = route.points;
    let carried = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dx = b[0] - a[0];
      const dz = b[2] - a[2];
      const length = Math.hypot(dx, dz);
      if (length < 1e-4) continue;
      const nx = -dz / length;
      const nz = dx / length;
      carried += length;
      while (carried >= spacingMetres) {
        carried -= spacingMetres;
        const f = Math.random();
        for (let side = -1; side <= 1; side += 2) {
          // Promenade's river side is stone armour, not a planted lawn.
          // Its inland planting starts beyond the wider paving/road corridor.
          if (routeIndex === 3 && side === -1) continue;
          if (Math.random() > 0.72) continue;
          const out = routeIndex === 3 ? 14 + Math.random()*9 : half + .8 + Math.random()*4;
          points.push([
            a[0] + dx * f + nx * out * side,
            a[1] + (b[1] - a[1]) * f - 0.05,
            a[2] + dz * f + nz * out * side,
            0.55 + Math.random() * 0.75,
            Math.random() * Math.PI,
          ]);
        }
      }
    }
  }
  return points;
}

export function createUndergrowth(scene, routes, shared, limit = 1400, groundHeight = null, atlas = null, meadowAtlas = null) {
  const spots = scatterAlongRoutes(routes);
  const blade = meadowAtlas ? foliagePatch(.9,.8,2,3,.12) : new THREE.PlaneGeometry(.9, .8, 1, 4);
  blade.translate(0, .4, 0);
  const crossed = [];
  for (let i = 0; i < 3; i++) {
    const g = blade.clone();
    g.rotateY((i * Math.PI) / 3);
    crossed.push(g);
  }
  const geometry = mergePlanes(crossed);

  const material = new THREE.MeshStandardMaterial({
    map: meadowAtlas || grassTexture(),
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.95,
    color: meadowAtlas ? 0xffffff : 0xd2dba9,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.windTime = shared.time;
    shader.uniforms.uStorm = shared.storm;
    shader.uniforms.uSnow = shared.snow;
    shader.vertexShader =
      "uniform float windTime, uStorm;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vec3 tuft = vec3(0.0);
         #ifdef USE_INSTANCING
           tuft = instanceMatrix[3].xyz;
         #endif
         float bend = max(0.0, position.y) * (0.16 + uStorm * 0.42);
         transformed.x += sin(windTime * 2.1 + tuft.x * 0.5 + tuft.z * 0.3) * bend;
         transformed.z += cos(windTime * 1.7 + tuft.z * 0.42) * bend * 0.7;`,
      );
    shader.fragmentShader =
      "uniform float uSnow;\n" +
      shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
         diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.83, 0.88, 0.88), uSnow * 0.75);`,
      );
  };

  const mesh = new THREE.InstancedMesh(geometry, material, limit);
  mesh.name = "Path-side undergrowth";
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const spray = atlas ? foliagePatch(2.3,1.9,0,3,.4) : new THREE.PlaneGeometry(2.3,1.9,1,3); spray.translate(0,1.4,0);
  const sprays = Array.from({length:5},(_,i)=>spray.clone().rotateY(i*2.39996).translate(Math.cos(i)*.25,(i%2)*.2,Math.sin(i)*.25));
  const shrubMaterial = new THREE.MeshStandardMaterial({map:atlas||canopyTexture(), alphaTest:.4,
    color:0xaec48b, roughness:.95, side:THREE.DoubleSide});
  shrubMaterial.onBeforeCompile = shader => {
    shader.uniforms.windTime=shared.time; shader.uniforms.uStorm=shared.storm; shader.uniforms.uSnow=shared.snow;
    shader.vertexShader="uniform float windTime,uStorm;\n"+shader.vertexShader.replace("#include <begin_vertex>",
      `#include <begin_vertex>\ntransformed.x+=sin(windTime*1.3+instanceMatrix[3].x*.12)*pow(max(0.,position.y),2.)*.025*(1.+uStorm*3.);`);
    shader.fragmentShader="uniform float uSnow;\n"+shader.fragmentShader.replace("#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.77,.83,.81),uSnow*.65);");
  };
  const shrubs = new THREE.InstancedMesh(mergeGeometries(sprays), shrubMaterial, 100);
  shrubs.name="Wild leafy shrubs at the planted path margins";
  shrubs.frustumCulled=false; shrubs.receiveShadow=true; shrubs.count=0; scene.add(shrubs);
  const stems=new THREE.InstancedMesh(twigGeometry(),new THREE.MeshStandardMaterial({color:0x665c47,roughness:1}),100);
  stems.frustumCulled=false; stems.count=0; scene.add(stems);
  const fernMaterial=shrubMaterial.clone();fernMaterial.onBeforeCompile=shrubMaterial.onBeforeCompile;
  fernMaterial.customProgramCacheKey=()=>"mufu-fern-wind";
  const ferns=new THREE.InstancedMesh(fernGeometry(),fernMaterial,280);
  ferns.name="Layered woodland ferns";ferns.frustumCulled=false;ferns.receiveShadow=true;ferns.count=0;scene.add(ferns);
  const heights = new Map();

  const dummy = new THREE.Object3D();
  return {
    mesh,
    shrubs,
    stems,
    ferns,
    spots,
    update(camera, range = 34) {
      let n = 0, shrubCount=0, fernCount=0;
      const r2 = range * range;
      for (let i = 0; i < spots.length && n < limit; i++) {
        const s = spots[i];
        const dx = s[0] - camera.position.x;
        const dz = s[2] - camera.position.z;
        if (dx * dx + dz * dz > r2) continue;
        // Sample only nearby plants and cache the result, keeping growth
        // attached to the slope instead of floating at the route's height.
        if(groundHeight && !heights.has(i)) heights.set(i, groundHeight(s[0],s[2]));
        const y=heights.get(i) ?? s[1];
        dummy.position.set(s[0], y+.015, s[2]);
        dummy.rotation.set(0, s[4], 0);
        dummy.scale.set(s[3], s[3] * (0.85 + (i % 7) * 0.05), s[3]);
        dummy.updateMatrix();
        mesh.setMatrixAt(n++, dummy.matrix);
        mesh.setColorAt(n-1,new THREE.Color().setRGB(.7+(i%5)*.06,.78+(i%4)*.04,.63+(i%7)*.04));
        if(i%3===0 && fernCount<280 && atlas) {
          dummy.scale.setScalar(.45+s[3]*.55);dummy.updateMatrix();ferns.setMatrixAt(fernCount++,dummy.matrix);
        }
        if(i%13===0 && shrubCount<100) {
          dummy.scale.setScalar(.55+s[3]*.55); dummy.updateMatrix();
          shrubs.setMatrixAt(shrubCount,dummy.matrix); stems.setMatrixAt(shrubCount,dummy.matrix); shrubCount++;
        }
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
      if(mesh.instanceColor) mesh.instanceColor.needsUpdate=true;
      shrubs.count=stems.count=shrubCount;
      ferns.count=fernCount;ferns.instanceMatrix.needsUpdate=true;
      shrubs.instanceMatrix.needsUpdate=stems.instanceMatrix.needsUpdate=true;
      return n;
    },
  };
}

function mergePlanes(geometries) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  let offset = 0;
  for (const g of geometries) {
    const p = g.attributes.position.array;
    const nrm = g.attributes.normal.array;
    const uv = g.attributes.uv.array;
    const idx = g.index.array;
    positions.push(...p);
    normals.push(...nrm);
    uvs.push(...uv);
    for (const i of idx) indices.push(i + offset);
    offset += g.attributes.position.count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  merged.setIndex(indices);
  return merged;
}

/**
 * Pollen and dust. Real motes only read where there is something dark behind
 * them and light across them: low down, close by, and never as a field of
 * specks against open sky. The box is deliberately shallow and the alpha dies
 * off above eye level.
 */
export function createMotes(scene, shared, count = 240) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 26;
    positions[i * 3 + 1] = Math.random() * 7;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 26;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));

  const points = new THREE.Points(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: {
        ...shared,
        uMap: { value: softDot() },
        uTint: { value: new THREE.Color(0xffe6b4) },
        uEyeHeight: { value: 3.5 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float time, storm, snow, sunset, dawn;
        uniform float uEyeHeight;
        attribute float seed;
        varying float vAlpha;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + time * (0.10 + seed * 0.16), 7.0);
          p.x += sin(time * 0.31 + seed * 25.0) * 1.1;
          p.z += cos(time * 0.27 + seed * 31.0) * 1.1;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float near = smoothstep(1.5, 4.0, -mv.z) * (1.0 - smoothstep(9.0, 20.0, -mv.z));
          // Fade out as a mote rises past the eye, where it would only ever be
          // seen as a speck on the sky.
          float low = 1.0 - smoothstep(0.4, 2.6, p.y - uEyeHeight);
          vAlpha = near * low * (0.16 + sunset * 0.30 + dawn * 0.10)
                 * (1.0 - storm * 0.9) * (1.0 - snow * 0.7);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp((1.4 + seed * 1.6) * 60.0 / max(2.0, -mv.z), 1.0, 4.0);
        }`,
      fragmentShader: `
        uniform sampler2D uMap; uniform vec3 uTint;
        varying float vAlpha;
        void main(){
          vec4 t = texture2D(uMap, gl_PointCoord);
          gl_FragColor = vec4(uTint, t.a * vAlpha);
        }`,
    }),
  );
  points.name = "Pollen";
  points.frustumCulled = false;
  scene.add(points);
  return points;
}

/**
 * A slow drift of leaves, heavier when the wind picks up. Kept few, close and
 * below the canopy: a sky full of drifting flecks reads as dirt on the lens,
 * not as weather.
 */
export function createFallingLeaves(scene, shared, count = 80) {
  const geometry = new THREE.PlaneGeometry(0.125, 0.085);
  const offsets = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    offsets[i * 3] = (Math.random() - 0.5) * 34;
    offsets[i * 3 + 1] = Math.random() * 13;
    offsets[i * 3 + 2] = (Math.random() - 0.5) * 34;
    seeds[i] = Math.random();
  }
  geometry.setAttribute("offset", new THREE.InstancedBufferAttribute(offsets, 3));
  geometry.setAttribute("seed", new THREE.InstancedBufferAttribute(seeds, 1));

  const instanced = new THREE.InstancedMesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: { ...shared, uEyeHeight: { value: 3.5 } },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      vertexShader: `
        uniform float time, storm, snow;
        uniform float uEyeHeight;
        attribute vec3 offset; attribute float seed;
        varying float vShade; varying float vAlpha;
        void main(){
          float fall = 0.55 + seed * 0.7 + storm * 1.9;
          vec3 base = offset;
          base.y = mod(offset.y - time * fall, 13.0);
          float swirl = time * (0.7 + seed * 1.3) + seed * 40.0;
          base.x += sin(swirl) * (1.2 + storm * 2.0);
          base.z += cos(swirl * 0.8) * (1.2 + storm * 2.0);
          // Spin each leaf about its own centre before placing it.
          float a = swirl * 1.4;
          vec3 local = position;
          local = vec3(local.x * cos(a) - local.y * sin(a), local.x * sin(a) + local.y * cos(a), local.z);
          local = vec3(local.x, local.y * cos(a * 0.7), local.y * sin(a * 0.7) + local.z);
          vec4 mv = modelViewMatrix * vec4(base + local, 1.0);
          vShade = 0.55 + 0.45 * abs(sin(a));
          // Below the eye, and not so close that one leaf fills the frame.
          float low = 1.0 - smoothstep(-1.2, 2.0, base.y - uEyeHeight);
          float near = smoothstep(1.6, 3.6, -mv.z) * (1.0 - smoothstep(9.0, 17.0, -mv.z));
          vAlpha = low * near * (1.0 - snow * 0.8);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float sunset;
        varying float vShade; varying float vAlpha;
        void main(){
          vec3 leaf = mix(vec3(0.24, 0.23, 0.08), vec3(0.38, 0.20, 0.07), vShade);
          leaf = mix(leaf, leaf * vec3(1.2, 0.9, 0.7), sunset);
          gl_FragColor = vec4(leaf * (0.4 + vShade * 0.5), vAlpha * 0.8);
        }`,
    }),
    count,
  );
  instanced.name = "Falling leaves";
  instanced.frustumCulled = false;
  const identity = new THREE.Matrix4();
  for (let i = 0; i < count; i++) instanced.setMatrixAt(i, identity);
  scene.add(instanced);
  return instanced;
}
