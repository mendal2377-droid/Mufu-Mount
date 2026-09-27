import * as THREE from "three";

// Twenty frames from one morning, standing beside the path where they happened
// in the walk's order. Each one is a lantern first and a photograph second:
// you see a warm light through the trees long before you can see the picture.

const FRAME_HEIGHT = 2.45;

// The whole scene is tone mapped once, at the end. A photograph pushed
// straight through AgX comes out milky, so the frames pre-compensate: a
// little more saturation and contrast going in, so what lands on screen still
// looks like the picture that was taken.
const photoShader = {
  vertex: `
    varying vec2 vUvs;
    void main(){ vUvs = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragment: `
    uniform sampler2D uMap; uniform float uOpacity, uHasMap, uGlow;
    varying vec2 vUvs;
    void main(){
      if (uHasMap < 0.5) discard;
      vec3 c = texture2D(uMap, vUvs).rgb;
      float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(luma), c, 1.45);
      c = (c - 0.5) * 1.18 + 0.5;
      c = pow(max(c, 0.0), vec3(0.95)) * 1.1;
      // A warm edge, as if the frame itself were lit, without fogging the print.
      vec2 d = vUvs - 0.5;
      float edge = smoothstep(0.16, 0.26, dot(d, d));
      c += vec3(1.0, 0.72, 0.38) * uGlow * 0.05 * edge;
      gl_FragColor = vec4(max(c, 0.0), uOpacity);
    }`,
};
const OPEN_RANGE = 20;
const SOLID_RANGE = 32;
const DETAIL_RANGE = 130;
const GLOW_RANGE = 900;

function radialTexture(stops) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([at, color]) => grad.addColorStop(at, color));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const shaftShader = {
  vertex: `
    varying float vH; varying vec2 vUvs;
    void main(){ vH = uv.y; vUvs = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragment: `
    uniform vec3 uColor; uniform float uPower, uTime;
    varying float vH; varying vec2 vUvs;
    void main(){
      float edge = sin(vUvs.x * 3.14159);
      float rise = pow(vH, 1.6) * (1.0 - vH * 0.15);
      float shimmer = 0.82 + 0.18 * sin(uTime * 1.7 + vUvs.x * 12.0 + vH * 5.0);
      gl_FragColor = vec4(uColor, rise * edge * uPower * 0.30 * shimmer);
    }`,
};

export function createMemories(scene, data, options = {}) {
  const loader = new THREE.TextureLoader();
  const glowTexture = radialTexture([
    [0, "rgba(255,226,170,1)"],
    [0.32, "rgba(255,189,110,0.55)"],
    [1, "rgba(255,170,90,0)"],
  ]);
  const moteTexture = radialTexture([
    [0, "rgba(255,240,205,1)"],
    [1, "rgba(255,220,160,0)"],
  ]);

  const shaftGeometry = new THREE.CylinderGeometry(0.06, 1.45, 3.6, 14, 1, true);
  shaftGeometry.translate(0, -1.8, 0);

  const group = new THREE.Group();
  group.name = "Memories";
  scene.add(group);

  const items = data.memories.map((record, index) => {
    const node = new THREE.Group();
    node.position.fromArray(record.position);
    node.position.y += 2.35;

    const aspect = 4 / 3;
    const width = FRAME_HEIGHT * aspect;

    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture,
        color: 0xffc98a,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      }),
    );
    glow.scale.set(9, 9, 1);
    // Sit the halo behind the print, and pin the draw order: these four
    // surfaces are all at the same distance, so sorting alone would let the
    // additive glow land on top and wash the photograph out.
    glow.position.z = -0.05;
    glow.renderOrder = 1;
    node.add(glow);

    const border = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.22, FRAME_HEIGHT + 0.22),
      new THREE.MeshBasicMaterial({
        color: 0xf8e7c2,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    border.position.z = -0.014;
    border.renderOrder = 3;
    node.add(border);

    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 0.34, FRAME_HEIGHT + 0.34),
      new THREE.MeshBasicMaterial({
        color: 0x1a1509,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
        fog: false,
      }),
    );
    backing.position.z = -0.026;
    backing.renderOrder = 2;
    node.add(backing);

    const photo = new THREE.Mesh(
      new THREE.PlaneGeometry(width, FRAME_HEIGHT),
      new THREE.ShaderMaterial({
        uniforms: {
          uMap: { value: null },
          uOpacity: { value: 0 },
          uHasMap: { value: 0 },
          uGlow: { value: 0 },
        },
        vertexShader: photoShader.vertex,
        fragmentShader: photoShader.fragment,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        fog: false,
      }),
    );
    photo.renderOrder = 4;
    node.add(photo);

    const shaft = new THREE.Mesh(
      shaftGeometry,
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0xffc177) },
          uPower: { value: 0 },
          uTime: { value: 0 },
        },
        vertexShader: shaftShader.vertex,
        fragmentShader: shaftShader.fragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    shaft.position.y = -FRAME_HEIGHT * 0.5;
    node.add(shaft);

    // A handful of embers that hang around the frame and never quite settle.
    const moteCount = 26;
    const motePositions = new Float32Array(moteCount * 3);
    for (let i = 0; i < moteCount; i++) {
      motePositions[i * 3] = (Math.random() - 0.5) * width * 1.7;
      motePositions[i * 3 + 1] = (Math.random() - 0.5) * 3.4;
      motePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
    }
    const moteGeometry = new THREE.BufferGeometry();
    moteGeometry.setAttribute("position", new THREE.BufferAttribute(motePositions, 3));
    const motes = new THREE.Points(
      moteGeometry,
      new THREE.PointsMaterial({
        map: moteTexture,
        color: 0xffd9a0,
        size: 0.13,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
        fog: false,
      }),
    );
    node.add(motes);

    group.add(node);
    return {
      record,
      index,
      node,
      glow,
      border,
      backing,
      photo,
      shaft,
      motes,
      basePositions: motePositions.slice(),
      loaded: false,
      loading: false,
      reveal: 0,
      distance: Infinity,
      seen: false,
    };
  });

  function ensureTexture(item) {
    if (item.loaded || item.loading) return;
    item.loading = true;
    loader.load(
      item.record.src,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = options.anisotropy || 4;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        item.photo.material.uniforms.uMap.value = texture;
        item.photo.material.uniforms.uHasMap.value = 1;
        item.loaded = true;
        item.loading = false;
      },
      undefined,
      () => {
        item.loading = false;
      },
    );
  }

  function releaseTexture(item) {
    const map = item.photo.material.uniforms.uMap.value;
    if (!map) return;
    item.photo.material.uniforms.uMap.value = null;
    item.photo.material.uniforms.uHasMap.value = 0;
    item.photo.material.uniforms.uOpacity.value = 0;
    item.loaded = false;
    item.reveal = 0;
    map.dispose();
  }

  const found = new Set(options.found || []);
  let active = null;

  const api = {
    group,
    items,
    data,
    get found() {
      return [...found];
    },
    get active() {
      return active;
    },
    /** Nearest memory the walker is close enough to actually read. */
    update(time, camera, dt) {
      let nearest = null;
      for (const item of items) {
        const node = item.node;
        item.distance = camera.position.distanceTo(node.position);

        if (item.distance > GLOW_RANGE) {
          node.visible = false;
          continue;
        }
        node.visible = true;

        // Face the walker, but only turn about the vertical axis so the frames
        // stay upright and keep their footing on the path.
        const angle = Math.atan2(
          camera.position.x - node.position.x,
          camera.position.z - node.position.z,
        );
        node.rotation.y = angle;

        node.position.y =
          item.record.position[1] + 2.35 + Math.sin(time * 0.7 + item.index * 1.9) * 0.075;

        if (item.distance < DETAIL_RANGE) ensureTexture(item);
        // Twenty 1600px photographs will not all fit in an integrated GPU at
        // once, so a frame that is well out of range gives its texture back.
        else if (item.loaded && item.distance > DETAIL_RANGE * 2) releaseTexture(item);

        // Solid once you are inside SOLID_RANGE, then fading back to a bare
        // light by the edge of DETAIL_RANGE.
        const target = item.loaded
          ? THREE.MathUtils.clamp(
              (DETAIL_RANGE - item.distance) / (DETAIL_RANGE - SOLID_RANGE),
              0,
              1,
            )
          : 0;
        item.reveal = THREE.MathUtils.damp(item.reveal, target, 3.2, dt);

        const shown = item.reveal;
        item.photo.material.uniforms.uOpacity.value = shown;
        item.photo.material.uniforms.uGlow.value =
          0.4 + 0.6 * THREE.MathUtils.clamp(1 - item.distance / 30, 0, 1);
        item.border.material.opacity = shown * 0.85;
        item.backing.material.opacity = shown * 0.5;
        item.motes.material.opacity = THREE.MathUtils.clamp(1 - item.distance / 42, 0, 1) * 0.85;
        item.shaft.material.uniforms.uTime.value = time;
        item.shaft.material.uniforms.uPower.value =
          THREE.MathUtils.clamp(1 - item.distance / 70, 0, 1) * (0.55 + shown * 0.45);

        // Far away a memory is only a warm light; up close the halo steps
        // aside so the photograph can be read.
        const pulse = 0.82 + 0.18 * Math.sin(time * 1.1 + item.index);
        const far = THREE.MathUtils.clamp(item.distance / 260, 0, 1);
        glowScale(item, 7 + far * 16, pulse * (1 - shown * 0.82));

        const motePos = item.motes.geometry.attributes.position;
        for (let i = 0; i < motePos.count; i++) {
          const bx = item.basePositions[i * 3];
          const by = item.basePositions[i * 3 + 1];
          const bz = item.basePositions[i * 3 + 2];
          motePos.setXYZ(
            i,
            bx + Math.sin(time * 0.5 + i * 1.7) * 0.22,
            ((by + time * 0.16 + i * 0.13) % 3.4) - 1.7,
            bz + Math.cos(time * 0.42 + i * 2.3) * 0.18,
          );
        }
        motePos.needsUpdate = true;

        if (item.distance < OPEN_RANGE && (!nearest || item.distance < nearest.distance)) {
          nearest = item;
        }
      }

      const changed = nearest !== active;
      active = nearest;
      if (active && !found.has(active.record.id)) {
        found.add(active.record.id);
        active.seen = true;
        return { active, changed, firstTime: true };
      }
      return { active, changed, firstTime: false };
    },
    /** Warm the textures for the frames a walker is about to reach. */
    preloadNear(position, count = 3) {
      [...items]
        .sort(
          (a, b) =>
            position.distanceToSquared(a.node.position) -
            position.distanceToSquared(b.node.position),
        )
        .slice(0, count)
        .forEach(ensureTexture);
    },
    byId(id) {
      return items.find((i) => i.record.id === id);
    },
    reset() {
      found.clear();
    },
    setFound(ids) {
      found.clear();
      ids.forEach((id) => found.add(id));
    },
    getStats() {
      return {
        total: items.length,
        found: found.size,
        loaded: items.filter((i) => i.loaded).length,
        active: active ? active.record.id : null,
        visible: items.filter((i) => i.node.visible).length,
      };
    },
  };

  function glowScale(item, size, intensity) {
    item.glow.scale.set(size, size, 1);
    item.glow.material.opacity = 0.34 * intensity;
  }

  return api;
}

/**
 * Walks the memories in the order they were photographed, following each
 * frame's own route. Returns the position to aim for and how far through the
 * morning the walker is, so the sky can move from 06:16 towards 08:26.
 */
export function createMemoryWalk(memories, routes) {
  const order = [...memories.items].sort(
    (a, b) => a.record.minutes - b.record.minutes,
  );
  let cursor = 0;
  let dwell = 0;

  return {
    order,
    get index() {
      return cursor;
    },
    get target() {
      return order[cursor];
    },
    reset() {
      cursor = 0;
      dwell = 0;
    },
    jumpTo(index) {
      cursor = THREE.MathUtils.clamp(index, 0, order.length - 1);
      dwell = 0;
    },
    /** @returns {"walking"|"pausing"|"finished"} */
    advance(camera, dt) {
      if (cursor >= order.length) return "finished";
      const item = order[cursor];
      const flat = item.node.position.clone();
      flat.y = camera.position.y;
      if (camera.position.distanceTo(flat) < 11) {
        dwell += dt;
        if (dwell > 7) {
          dwell = 0;
          cursor++;
          return cursor >= order.length ? "finished" : "walking";
        }
        return "pausing";
      }
      return "walking";
    },
    progress() {
      return order.length ? cursor / (order.length - 1) : 0;
    },
    minutes() {
      const item = order[Math.min(cursor, order.length - 1)];
      return item.record.minutes;
    },
  };
}
