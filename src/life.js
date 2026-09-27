import * as THREE from "three";

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
    const h = 52 + Math.random() * 68;
    const lean = (Math.random() - 0.5) * 34;
    const w = 2.2 + Math.random() * 2.6;
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
  for (const route of routes) {
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
          if (Math.random() > 0.72) continue;
          const out = half + 0.25 + Math.random() * 3.1;
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

export function createUndergrowth(scene, routes, shared, limit = 1400) {
  const spots = scatterAlongRoutes(routes);
  const blade = new THREE.PlaneGeometry(0.62, 0.62);
  blade.translate(0, 0.31, 0);
  const crossed = [];
  for (let i = 0; i < 3; i++) {
    const g = blade.clone();
    g.rotateY((i * Math.PI) / 3);
    crossed.push(g);
  }
  const geometry = mergePlanes(crossed);

  const material = new THREE.MeshStandardMaterial({
    map: grassTexture(),
    transparent: true,
    alphaTest: 0.32,
    side: THREE.DoubleSide,
    roughness: 0.95,
    color: 0xa9c27d,
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

  const dummy = new THREE.Object3D();
  return {
    mesh,
    spots,
    update(camera, range = 34) {
      let n = 0;
      const r2 = range * range;
      for (let i = 0; i < spots.length && n < limit; i++) {
        const s = spots[i];
        const dx = s[0] - camera.position.x;
        const dz = s[2] - camera.position.z;
        if (dx * dx + dz * dz > r2) continue;
        dummy.position.set(s[0], s[1], s[2]);
        dummy.rotation.set(0, s[4], 0);
        dummy.scale.set(s[3], s[3] * (0.85 + (i % 7) * 0.05), s[3]);
        dummy.updateMatrix();
        mesh.setMatrixAt(n++, dummy.matrix);
      }
      mesh.count = n;
      mesh.instanceMatrix.needsUpdate = true;
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

/** Pollen and dust that only really shows when the sun is low and clear. */
export function createMotes(scene, shared, count = 900) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 54;
    positions[i * 3 + 1] = Math.random() * 16;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 54;
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
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: `
        uniform float time, storm, snow, sunset;
        attribute float seed;
        varying float vAlpha;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + time * (0.15 + seed * 0.25), 16.0);
          p.x += sin(time * 0.31 + seed * 25.0) * 1.6;
          p.z += cos(time * 0.27 + seed * 31.0) * 1.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float near = 1.0 - smoothstep(6.0, 34.0, -mv.z);
          vAlpha = near * (0.30 + sunset * 0.55) * (1.0 - storm * 0.85) * (1.0 - snow * 0.6);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = clamp((2.0 + seed * 3.4) * 90.0 / max(2.0, -mv.z), 1.0, 9.0);
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

/** A slow drift of leaves, heavier when the wind picks up. */
export function createFallingLeaves(scene, shared, count = 260) {
  const geometry = new THREE.PlaneGeometry(0.19, 0.13);
  const offsets = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    offsets[i * 3] = (Math.random() - 0.5) * 60;
    offsets[i * 3 + 1] = Math.random() * 22;
    offsets[i * 3 + 2] = (Math.random() - 0.5) * 60;
    seeds[i] = Math.random();
  }
  geometry.setAttribute("offset", new THREE.InstancedBufferAttribute(offsets, 3));
  geometry.setAttribute("seed", new THREE.InstancedBufferAttribute(seeds, 1));

  const instanced = new THREE.InstancedMesh(
    geometry,
    new THREE.ShaderMaterial({
      uniforms: { ...shared },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      vertexShader: `
        uniform float time, storm, snow;
        attribute vec3 offset; attribute float seed;
        varying float vShade; varying float vAlpha;
        void main(){
          float fall = 0.55 + seed * 0.7 + storm * 1.9;
          vec3 base = offset;
          base.y = mod(offset.y - time * fall, 22.0);
          float swirl = time * (0.7 + seed * 1.3) + seed * 40.0;
          base.x += sin(swirl) * (1.5 + storm * 2.4);
          base.z += cos(swirl * 0.8) * (1.5 + storm * 2.4);
          // Spin each leaf about its own centre before placing it.
          float a = swirl * 1.4;
          vec3 local = position;
          local = vec3(local.x * cos(a) - local.y * sin(a), local.x * sin(a) + local.y * cos(a), local.z);
          local = vec3(local.x, local.y * cos(a * 0.7), local.y * sin(a * 0.7) + local.z);
          vec4 mv = modelViewMatrix * vec4(base + local, 1.0);
          vShade = 0.55 + 0.45 * abs(sin(a));
          vAlpha = (1.0 - smoothstep(18.0, 32.0, -mv.z)) * (1.0 - snow * 0.8);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform float sunset;
        varying float vShade; varying float vAlpha;
        void main(){
          vec3 leaf = mix(vec3(0.42, 0.40, 0.14), vec3(0.62, 0.34, 0.11), vShade);
          leaf = mix(leaf, leaf * vec3(1.2, 0.9, 0.7), sunset);
          gl_FragColor = vec4(leaf * (0.5 + vShade * 0.7), vAlpha * 0.85);
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
