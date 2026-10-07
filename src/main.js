import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  nearestOnRoute,
  closestRoute,
  constrainToRoute,
} from "./navigation.js";
import { NatureAudio } from "./audio.js";
import { createLivingRiver } from "./river-life.js";
import { createPostFX, TIERS } from "./postfx.js";
import {
  createSkyDome,
  sunDirectionForMinutes,
  SUNSET_DIRECTION,
  WALK_START_MINUTES,
  WALK_END_MINUTES,
} from "./sky.js";
import { createMemories, createMemoryWalk } from "./memories.js";
import { createUndergrowth, createMotes, createFallingLeaves } from "./life.js";
import { createForest } from "./forest.js";
import { createMeadow } from "./meadow.js";
import { createCameraFeel } from "./camera-feel.js";
import { createCinematic, wholeCircuit } from "./tour.js";
import { createPlan, planPose } from "./plan.js";
import { createBirdKite, createGroundSampler } from "./kite.js";
import { createNanjing } from "./nanjing.js";
import "./style.css";

const $ = (s) => document.querySelector(s),
  canvas = $("#world");
const state = {
  ready: false,
  playing: false,
  auto: false,
  memoryWalk: false,
  tour: false,
  overview: false,
  photoMode: false,
  weather: "morning",
  quality: "cinematic",
  route: 2,
  place: 0,
  distance: 0,
  moving: false,
  frames: 0,
  flying: false,
};
const audio = new NatureAudio(),
  keys = new Set();
let saved = [],
  foundMemories = [];
try {
  saved = JSON.parse(localStorage.getItem("mufu-notes") || "[]");
  if (!Array.isArray(saved)) saved = [];
} catch {}
try {
  foundMemories = JSON.parse(localStorage.getItem("mufu-memories") || "[]");
  if (!Array.isArray(foundMemories)) foundMemories = [];
} catch {}
let storedQuality = null;
try {
  storedQuality = localStorage.getItem("mufu-quality");
} catch {}

const places = [
  {
    name: "Rainbow road",
    copy: "Three colours threading through green.",
    bookmark: 10,
  },
  {
    name: "Ridge trail",
    copy: "A pale stone path. A little closer to the sky.",
    bookmark: 2,
  },
  {
    name: "River lookout",
    copy: "Pause where the mountain meets the horizon.",
    bookmark: 4,
  },
  {
    name: "Yangtze promenade",
    copy: "The river moves. You don’t have to.",
    bookmark: 5,
  },
  {
    name: "Forest stairs",
    copy: "One step, then another. Listen to the leaves.",
    bookmark: 1,
  },
];
let renderer,
  scene,
  camera,
  controls,
  orbit,
  routes,
  world,
  sun,
  fill,
  hemi,
  sky,
  water,
  riverLife,
  kite,
  plan,
  city,
  memories,
  memoryWalk,
  undergrowth,
  meadow,
  motes,
  leaves,
  postfx,
  feel,
  cinematic,
  particles,
  rainLines,
  forest,
  returnPose,
  geometryBytes = 0;
const weather = { dawn: 0, sunset: 0, storm: 0, snow: 0 };
// One sun for everything. The sky draws its disc here, the water lays its
// glitter path along it, and the directional light casts from it.
const sunDirection = new THREE.Vector3(-0.8, 0.55, -0.6).normalize();
const u = {
  time: { value: 0 },
  dawn: { value: 0 },
  sunset: { value: 0 },
  storm: { value: 0 },
  snow: { value: 0 },
  flash: { value: 0 },
  planView: { value: 0 },
  uSunDir: { value: sunDirection },
  // Elevation of the water plane's far edge for the current eye height, so
  // the far bank can be drawn where the water actually ends.
  uHorizon: { value: 0 },
};
const clock = new THREE.Clock(),
  dummy = new THREE.Object3D();
const sunsetDirection = SUNSET_DIRECTION.clone(),
  sunScreen = new THREE.Vector3();
let toastTimer,
  simTime = 0,
  cinematicFade = 0,
  lastTourLeg = -1,
  flashTimer = 0,
  lastTreeUpdate = -10,
  lastMap = -10,
  lastLightning = 0,
  lastGrowth = -10,
  walkTimeBlend = 0,
  fadeIn = 1,
  qualitySamples = [],
  qualityLocked = false;

// The morning this walk happened, and the moods layered on top of it.
const GRADES = {
  morning: {
    lift: [0.004, 0.008, 0.014],
    gain: [1.02, 1.01, 0.99],
    saturation: 1.12,
    contrast: 1.16,
    bloom: 0.30,
    exposure: 1.16,
  },
  dawn: {
    lift: [0.014, 0.014, 0.034],
    gain: [1.04, 0.96, 0.95],
    saturation: 1.0,
    contrast: 1.2,
    bloom: 0.52,
    exposure: 0.9,
  },
  sunset: {
    lift: [0.014, 0.008, 0.006],
    gain: [1.04, 1.0, 0.97],
    saturation: 1.14,
    contrast: 1.15,
    bloom: 0.55,
    exposure: 1.12,
  },
  storm: {
    lift: [0.014, 0.018, 0.026],
    gain: [0.93, 0.96, 1.0],
    saturation: 0.74,
    contrast: 1.2,
    bloom: 0.22,
    exposure: 0.86,
  },
  snow: {
    lift: [0.03, 0.033, 0.038],
    gain: [0.99, 1.0, 1.03],
    saturation: 0.68,
    contrast: 1.04,
    bloom: 0.40,
    exposure: 1.1,
  },
};
const WEATHER_LABEL = {
  dawn: "06:16 · FIRST LIGHT",
  morning: "MORNING LIGHT",
  sunset: "GOLDEN HOUR",
  storm: "A STORM PASSES",
  snow: "WINTER STILLNESS",
};

function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3600);
}
function progress(value, text) {
  $("#load-bar").style.width = `${value}%`;
  $("#load-status").textContent = text;
}

// Surfaces are grouped by the material names the Blender export carries, so a
// railing behaves like metal and a road behaves like wet asphalt in the rain.
function material(name, color) {
  const metal = /metal|railing|rail |silver|steel|picket|fixture|barrier|bronze/i.test(name);
  const stone = /limestone|granite|flagstone|paver|paving|stone|brick|terrace/i.test(name);
  const road = /asphalt|avenue|road|promenade|lane|stripe/i.test(name);
  const noSnow = /water|blue|pink|yellow line|stripe/i.test(name);
  const sway = /leaf|foliage/i.test(name);
  const grassy = /Woodland floor|Grass \| summer|Hike \| earth|Field \| leaf litter/i.test(name);
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color().fromArray(color),
    roughness: metal ? 0.36 : road ? 0.82 : stone ? 0.88 : 0.91,
    metalness: metal ? 0.72 : 0,
    side: THREE.DoubleSide,
  });
  const detail = stone || road ? 1 : 0;
  m.customProgramCacheKey = () =>
    `mufu-${Number(noSnow)}-${Number(sway)}-${detail}-${Number(metal)}-${Number(grassy)}`;
  m.userData.baseColor = m.color.clone();
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSnow = u.snow;
    shader.uniforms.uRain = u.storm;
    shader.uniforms.windTime = u.time;
    shader.uniforms.leafSun = u.uSunDir;
    shader.vertexShader =
      "uniform float windTime; uniform float uRain; varying vec3 vWorldPoint; varying vec3 vWorldUp;\n" +
      shader.vertexShader;
    if (sway)
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nvec3 windOrigin=vec3(0.);\n#ifdef USE_INSTANCING\nwindOrigin=instanceMatrix[3].xyz;\n#endif\nfloat gust=sin(windTime*1.1+windOrigin.x*.035+windOrigin.z*.021);float twig=max(0.,position.y-2.);transformed.x+=gust*twig*.024*(1.+uRain*2.);transformed.z+=cos(windTime*.8+windOrigin.z*.04)*twig*.015;transformed.x+=sin(windTime*6.+position.x*9.+position.z*7.+windOrigin.x)*twig*.003*(1.+uRain);",
      );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <worldpos_vertex>",
      "#include <worldpos_vertex>\nvec4 wp=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\nwp=instanceMatrix*wp;\n#endif\nvWorldPoint=(modelMatrix*wp).xyz;vWorldUp=normalize(mat3(modelMatrix)*objectNormal);",
    );
    shader.fragmentShader =
      "uniform float uSnow;uniform float uRain;varying vec3 vWorldPoint;varying vec3 vWorldUp;\nfloat mufuHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}\nfloat mufuNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mufuHash(i),mufuHash(i+vec2(1,0)),f.x),mix(mufuHash(i+vec2(0,1)),mufuHash(i+1.),f.x),f.y);}\n" +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>\nfloat grain=fract(sin(dot(floor(vWorldPoint.xz*8.0),vec2(12.9898,78.233)))*43758.5453);diffuseColor.rgb*=.92+grain*.13;\nfloat blotch=mufuNoise(vWorldPoint.xz*0.21)*0.55+mufuNoise(vWorldPoint.xz*0.83)*0.3;diffuseColor.rgb*=0.86+blotch*0.3;\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.79,.86,.86),uSnow*${noSnow ? "0.18" : "0.92"}*smoothstep(.05,.6,vWorldUp.y));diffuseColor.rgb*=1.0-uRain*.17;`,
    );
    if (grassy)
      // Fine clover/grass mottling continues beyond the near plant meshes.
      // World coordinates keep the pattern consistent across exported slabs.
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>",
        `#include <color_fragment>
         float meadowPatch=mufuNoise(vWorldPoint.xz*.35);
         float meadowFine=mufuNoise(vWorldPoint.xz*5.5);
         float meadowBlade=mufuNoise(vWorldPoint.xz*vec2(18.,2.));
         float meadowDetail=1.-smoothstep(.12,.65,max(length(dFdx(vWorldPoint.xz)),length(dFdy(vWorldPoint.xz))));
         diffuseColor.rgb*=mix(.92,1.2,meadowPatch);
         diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.22,1.18,.85),
           meadowDetail*smoothstep(.56,.8,meadowFine)*(.16+.22*meadowBlade));`);
    if (detail)
      // Break up the large flat exported faces with a shallow procedural bump.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>\nvec2 np=vWorldPoint.xz*1.7;float n0=mufuNoise(np);float nx=mufuNoise(np+vec2(0.12,0.));float nz=mufuNoise(np+vec2(0.,0.12));normal=normalize(normal+vec3((nx-n0)*0.9,0.0,(nz-n0)*0.9));`,
      );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,.22,uRain*.75*smoothstep(.2,.75,vWorldUp.y));",
    );
    if (sway)
      // A cheap stand-in for light coming through a leaf from behind.
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "float mufuBack=max(0.,dot(normalize(vWorldPoint-cameraPosition),normalize(leafSun)));outgoingLight+=diffuseColor.rgb*pow(mufuBack,3.)*.65*(1.-uRain*.8);\n#include <opaque_fragment>",
      );
    if(sway) shader.fragmentShader="uniform vec3 leafSun;\n"+shader.fragmentShader;
  };
  return m;
}

function createSky() {
  const built = createSkyDome(scene, u);
  sky = built.dome;
  riverLife = createLivingRiver(scene, u, routes[3].points);
  water = riverLife.water;
}

/**
 * Gaps cut into the exported railings so that a place you can see can also be
 * reached. Each one is a world-space box; triangles whose centre falls inside
 * it are collapsed to nothing. The export itself is untouched — this is a
 * browser-side edit, and the Blender scene still has the rail unbroken.
 */
const RAIL_OPENINGS = [
  {
    // The ridge trail runs along the back of the square-spiral river terrace,
    // and its balustrade sealed the terrace off. This is the way in.
    name: /pale weathered balustrade/i,
    min: [2627.4, 187.4, -973.6],
    max: [2632.4, 191.5, -969.9],
  },
];

function carveOpenings(mesh) {
  const cuts = RAIL_OPENINGS.filter((o) => o.name.test(mesh.name));
  if (!cuts.length) return 0;
  const position = mesh.geometry.attributes.position;
  const index = mesh.geometry.index;
  if (!index) return 0;
  const array = index.array;
  const inside = (cut, x, y, z) =>
    x >= cut.min[0] && x <= cut.max[0] &&
    y >= cut.min[1] && y <= cut.max[1] &&
    z >= cut.min[2] && z <= cut.max[2];
  let removed = 0;
  for (let t = 0; t < array.length; t += 3) {
    const a = array[t],
      b = array[t + 1],
      c = array[t + 2];
    const xs = [position.getX(a), position.getX(b), position.getX(c)];
    const ys = [position.getY(a), position.getY(b), position.getY(c)];
    const zs = [position.getZ(a), position.getZ(b), position.getZ(c)];
    for (const cut of cuts) {
      // Either the triangle sits in the gap, or it reaches into it — a rail
      // span two metres long has its centre outside but still bars the way.
      const hit =
        inside(cut, (xs[0] + xs[1] + xs[2]) / 3, (ys[0] + ys[1] + ys[2]) / 3, (zs[0] + zs[1] + zs[2]) / 3) ||
        inside(cut, xs[0], ys[0], zs[0]) ||
        inside(cut, xs[1], ys[1], zs[1]) ||
        inside(cut, xs[2], ys[2], zs[2]);
      if (hit) {
        array[t + 1] = a;
        array[t + 2] = a;
        removed++;
        break;
      }
    }
  }
  if (removed) index.needsUpdate = true;
  return removed;
}

/** Concatenate a few small geometries, indexed or not, into one. */
async function buildTrees(trees) {
  forest = await createForest(scene, u, trees, material);
}

function updateTrees() {
  forest.update(camera, state, renderer);
}

function createParticles() {
  const count = 1800,
    positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 90;
    positions[i * 3 + 1] = Math.random() * 42;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 90;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  particles = new THREE.Points(
    g,
    new THREE.ShaderMaterial({
      uniforms: u,
      transparent: true,
      depthWrite: false,
      vertexShader: `uniform float time,storm,snow;varying float alpha;void main(){vec3 p=position;p.y=mod(p.y-time*2.1,42.)-9.;p.x+=sin(time*.5+p.z)*snow*1.2;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(snow*2.3*140./max(3.,-mv.z),1.,8.);alpha=snow*.65;}`,
      fragmentShader: `varying float alpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.88,.94,.97,alpha*(1.-d));}`,
    }),
  );
  particles.frustumCulled = false;
  scene.add(particles);
  const rainPos = new Float32Array(count * 6),
    ends = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    for (let end = 0; end < 2; end++) {
      rainPos.set(positions.subarray(i * 3, i * 3 + 3), i * 6 + end * 3);
      ends[i * 2 + end] = end;
    }
  }
  const rg = new THREE.BufferGeometry();
  rg.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  rg.setAttribute("end", new THREE.BufferAttribute(ends, 1));
  rainLines = new THREE.LineSegments(
    rg,
    new THREE.ShaderMaterial({
      uniforms: u,
      transparent: true,
      depthWrite: false,
      vertexShader:
        "uniform float time;attribute float end;void main(){vec3 p=position;p.y=mod(p.y-time*24.,42.)-9.-end*.9;p.x+=end*.15;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}",
      fragmentShader:
        "uniform float storm;void main(){gl_FragColor=vec4(.72,.83,.88,storm*.38);}",
    }),
  );
  rainLines.frustumCulled = false;
  scene.add(rainLines);
}

function pickInitialQuality() {
  if (storedQuality && TIERS[storedQuality]) return storedQuality;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  if (coarse || cores <= 4 || memory <= 4) return "balanced";
  return "cinematic";
}

function applyQuality(name, announce = false) {
  if (!TIERS[name]) return;
  state.quality = name;
  const hadShadows = renderer.shadowMap.enabled;
  const tier = postfx.setTier(name);
  renderer.shadowMap.enabled = tier.shadow > 0;
  if (tier.shadow > 0) {
    sun.castShadow = true;
    if (sun.shadow.mapSize.x !== tier.shadow) {
      sun.shadow.mapSize.set(tier.shadow, tier.shadow);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
  } else {
    sun.castShadow = false;
  }
  // Turning shadows on or off changes the shader defines. Recompiling every
  // material for anything else is a good way to make a laptop GPU give up.
  if (hadShadows !== renderer.shadowMap.enabled) {
    scene.traverse((o) => {
      if (o.isMesh && o.material?.needsUpdate !== undefined)
        o.material.needsUpdate = true;
    });
  }
  document
    .querySelectorAll("[data-quality]")
    .forEach((b) => b.classList.toggle("active", b.dataset.quality === name));
  try {
    localStorage.setItem("mufu-quality", name);
  } catch {}
  if (announce)
    toast(
      {
        smooth: "Smooth: effects off, frame rate first.",
        balanced: "Balanced: shafts, bloom and soft shadows.",
        cinematic: "Cinematic: shadows, shafts, bloom and grain.",
      }[name],
    );
}

async function load() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xadbdb3, 0.00026);
    camera = new THREE.PerspectiveCamera(
      68,
      innerWidth / innerHeight,
      0.12,
      25000,
    );
    camera.rotation.order = "YXZ";
    feel = createCameraFeel(camera, 68);

    hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3f5228, 1.25);
    scene.add(hemi);
    sun = new THREE.DirectionalLight(0xffeccb, 3.6);
    sun.position.set(-800, 650, -600);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 2600;
    sun.shadow.camera.left = -70;
    sun.shadow.camera.right = 70;
    sun.shadow.camera.top = 70;
    sun.shadow.camera.bottom = -70;
    sun.shadow.bias = -0.0009;
    sun.shadow.normalBias = 0.05;
    scene.add(sun, sun.target);
    // A dim opposing light so shadowed faces keep some shape.
    fill = new THREE.DirectionalLight(0x9fc0d8, 0.35);
    fill.position.set(700, 380, 620);
    scene.add(fill);

    controls = new PointerLockControls(camera, canvas);
    controls.pointerSpeed = 0.7;
    controls.addEventListener("lock", () => {
      document.body.classList.add("locked");
      $("#resume").hidden = true;
    });
    controls.addEventListener("unlock", () => {
      keys.clear();
      document.body.classList.remove("locked");
      $("#resume").hidden = state.auto || state.memoryWalk || state.overview;
    });
    orbit = new OrbitControls(camera, canvas);
    orbit.enabled = false;
    orbit.enableDamping = true;
    orbit.maxDistance = 40000;
    orbit.minDistance = 200;
    orbit.maxPolarAngle = Math.PI * 0.47;

    progress(10, "Finding the trails");
    let memoryData;
    [world, routes, memoryData] = await Promise.all([
      fetch("/world/scene.json").then(checkJSON),
      fetch("/world/routes.json").then(checkJSON),
      fetch("/memories/memories.json")
        .then(checkJSON)
        .catch(() => ({ memories: [] })),
    ]);
    const response = await fetch("/world/geometry.bin");
    if (!response.ok) throw Error("The landscape could not be downloaded.");
    const reader = response.body.getReader(),
      chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.length;
      progress(
        Math.min(78, 15 + (size / 20543220) * 63),
        "Bringing the landscape into view",
      );
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    chunks.forEach((c) => {
      bytes.set(c, offset);
      offset += c.length;
    });
    const buffer = bytes.buffer;
    geometryBytes = size;
    let railsRemoved = 0;
    for (const rec of world.meshes) {
      const g = new THREE.BufferGeometry();
      g.setAttribute(
        "position",
        new THREE.BufferAttribute(
          new Float32Array(buffer, rec.positions.offset, rec.positions.count),
          3,
        ),
      );
      g.setAttribute(
        "normal",
        new THREE.BufferAttribute(
          new Float32Array(buffer, rec.normals.offset, rec.normals.count),
          3,
        ),
      );
      g.setIndex(
        new THREE.BufferAttribute(
          new Uint32Array(buffer, rec.indices.offset, rec.indices.count),
          1,
        ),
      );
      g.computeBoundingSphere();
      const mesh = new THREE.Mesh(g, material(rec.name, rec.color));
      mesh.name = rec.name;
      mesh.receiveShadow = true;
      // Only compact built objects — railings, pavilions, planters, fixtures —
      // are worth a second pass. Terrain and road slabs are large, nearly flat
      // and would double the cost of every frame for almost no shadow.
      const radius = g.boundingSphere?.radius ?? Infinity;
      mesh.castShadow =
        radius < 55 && !/floor|grass|asphalt|promenade|avenue|lane|stripe/i.test(rec.name);
      railsRemoved += carveOpenings(mesh);
      scene.add(mesh);
    }
    if (railsRemoved) console.info(`Mufu: opened ${railsRemoved} rail triangles`);
    await buildTrees(world.trees);
    createSky();
    createParticles();

    progress(86, "Letting the grass back in");
    const groundHeight = createGroundSampler(scene);
    kite = createBirdKite(camera, scene, u, routes, groundHeight);
    meadow = await createMeadow(scene, routes, u, renderer.capabilities.getMaxAnisotropy?.() || 4);
    undergrowth = createUndergrowth(scene, routes, u, 1400, groundHeight, forest.atlas, meadow.atlas);
    motes = createMotes(scene, u);
    leaves = createFallingLeaves(scene, u);

    progress(92, "Hanging twenty mornings on the path");
    memories = createMemories(scene, memoryData, {
      found: foundMemories,
      anisotropy: renderer.capabilities.getMaxAnisotropy?.() || 4,
    });
    memoryWalk = createMemoryWalk(memories, routes);
    buildMemoryStrip();

    cinematic = createCinematic(routes);

    postfx = createPostFX(renderer, scene, camera, pickInitialQuality());
    applyQuality(postfx.tier);

    progress(97, "Your quiet place is ready");
    goTo(0, false);
    setWeather("morning");
    state.ready = true;
    updateNotes();
    progress(100, "Ready");
    const accessPoints = places.map((p) => ({
      name: p.name,
      position: closestRoute(world.bookmarks[p.bookmark].position, routes).position,
    }));
    accessPoints.push({ name: "River & beacon", position: riverLife.watchView().position.toArray() });
    plan = createPlan({
      container: $("#access-points"), list: $("#plan-destinations"), points: accessPoints,
      onEnter: (index) => {
        start(index < places.length ? index : 3);
        if (index === places.length) $("#river-watch").click();
      },
    });
    showPlan();
    city = await createNanjing({camera,orbit,controls,postfx,state,shared:u,baseScene:scene,kite,keys,
      reset:()=>{stopWalks();feel.unapply();feel.reset();drag=null;keys.clear();},onMufu:showPlan,onWeather:setWeather,toast,
      rain:rainLines,snow:particles});
    city.game.noteMufu(foundMemories.length);
    city.showPlan();
    animate();
    window.__mufu = {
      state,
      weather,
      places,
      routes,
      camera,
      renderer,
      scene,
      city,
      postfx,
      goTo,
      showPlan,
      toggleKite,
      kite,
      setWeather,
      startTour,
      endTour,
      cinematic: () => cinematic,
      circuitLegs: wholeCircuit,
      step: (count = 1, dt = 1 / 60) => {
        for (let i = 0; i < count; i++) frame(dt);
      },
      setQuality: (name) => applyQuality(name, false),
      startMemoryWalk,
      memories,
      getStats: () => ({
        ...state,
        position: camera.position.toArray(),
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometryBytes,
        treeCount: world.trees.length,
        vegetation: forest.getStats(),
        audioReady: audio.started,
        audioEnabled: audio.enabled,
        audioState: audio.ctx?.state,
        saved: [...saved],
        river: riverLife.getStats(),
        memory: memories.getStats(),
        quality: state.quality,
        shadows: renderer.shadowMap.enabled,
        undergrowth: undergrowth.mesh.count,
        ferns: undergrowth.ferns.count,
        meadow: meadow.getStats(),
      }),
    };
  } catch (e) {
    console.error(e);
    $("#load-status").textContent =
      `Unable to open the 3D scene: ${e.message}. Try a browser with WebGL enabled.`;
    $("#enter").textContent = "Reload the landscape";
    $("#enter").hidden = false;
    $("#enter").disabled = false;
    $("#enter").onclick = () => location.reload();
  }
}

async function checkJSON(r) {
  if (!r.ok) throw Error("Scene data unavailable");
  return r.json();
}

function goTo(index, notify = true) {
  if (city?.active) { city.leave(); showPlan(); }
  if (state.flying) stopFlight(false);
  if (state.overview) toggleOverview();
  // Asking to be somewhere else ends whatever was walking you around;
  // otherwise the guided walk drags you straight back off the destination.
  stopWalks();
  state.place = index;
  const place = places[index],
    mark = world.bookmarks[place.bookmark];
  const near = closestRoute(
    [mark.position[0], mark.position[1] - 1.7, mark.position[2]],
    routes,
  );
  state.route = near.route;
  feel.reset();
  camera.position.fromArray(near.position);
  camera.position.y += 1.7;
  camera.lookAt(
    camera.position.clone().add(new THREE.Vector3().fromArray(mark.direction)),
  );
  camera.rotation.z = 0;
  $("#destination").value = String(index);
  $("#place-title").textContent = place.name;
  $("#place-copy").textContent = place.copy;
  $("#height").textContent = `${Math.round(camera.position.y - 1.7)} m`;
  updateNotes();
  drawMap();
  memories?.preloadNear(camera.position, 3);
  lastTreeUpdate = -10;
  lastGrowth = -10;
  if (notify) toast(place.name + " · You’re on the path");
}

function updateNotes() {
  $("#found").textContent = `${saved.length} / 5`;
  $("#stamps").innerHTML = places
    .map(
      (p, i) =>
        `<i class="${saved.includes(i) ? "saved" : ""}" title="${p.name}">${saved.includes(i) ? "✓" : i + 1}</i>`,
    )
    .join("");
  $("#collect").textContent = saved.includes(state.place)
    ? "✓ Moment saved"
    : "＋ Save this moment";
}

// --- memories ---------------------------------------------------------------

function buildMemoryStrip() {
  const strip = $("#memory-strip");
  if (!strip || !memories) return;
  strip.innerHTML = memories.items
    .slice()
    .sort((a, b) => a.record.minutes - b.record.minutes)
    .map(
      (item) =>
        `<button type="button" class="memory-chip${foundMemories.includes(item.record.id) ? " seen" : ""}" data-memory="${item.record.id}" title="${item.record.time} · ${item.record.en}"><img src="${item.record.thumb}" alt="" loading="lazy" /><span>${item.record.time}</span></button>`,
    )
    .join("");
  strip.querySelectorAll("[data-memory]").forEach((b) => {
    b.onclick = () => goToMemory(b.dataset.memory);
  });
  updateMemoryCount();
}

function updateMemoryCount() {
  const stats = memories.getStats();
  $("#memory-count").textContent = `${stats.found} / ${stats.total}`;
}

function goToMemory(id) {
  const item = memories.byId(id);
  if (!item) return;
  if (state.overview) toggleOverview();
  stopWalks();
  const ri = item.record.route;
  state.route = ri;
  const target = new THREE.Vector3().fromArray(item.record.position);
  const safe = constrainToRoute([target.x, target.y, target.z], routes[ri]);
  feel.reset();
  camera.position.fromArray(safe.position);
  camera.lookAt(item.node.position);
  camera.rotation.z = 0;
  memories.preloadNear(camera.position, 3);
  lastTreeUpdate = -10;
  lastGrowth = -10;
  drawMap();
}

function showMemoryCard(item) {
  const card = $("#memory-card");
  // The memory takes over the field-notes slot while you are standing at it,
  // rather than covering it up.
  document.body.classList.toggle("memory-open", !!item);
  if (!item) {
    card.classList.remove("show");
    return;
  }
  const r = item.record;
  $("#memory-time").textContent = r.time;
  $("#memory-zh").textContent = r.zh;
  $("#memory-en").textContent = r.en;
  $("#memory-note").textContent = r.note;
  $("#memory-photo").src = r.src;
  card.classList.add("show");
}

function startMemoryWalk() {
  if (!state.ready) return;
  if (state.flying) stopFlight(true);
  if (!state.playing) start(4, false);
  if (state.overview) toggleOverview();
  state.auto = false;
  $("#auto").classList.remove("active");
  $("#auto").textContent = "▷ Guided walk";
  state.memoryWalk = !state.memoryWalk;
  $("#memory-walk").classList.toggle("active", state.memoryWalk);
  $("#memory-walk").textContent = state.memoryWalk
    ? "Ⅱ Pause the morning"
    : "❍ Walk the morning";
  if (state.memoryWalk) {
    memoryWalk.reset();
    const first = memoryWalk.target;
    if (first) {
      state.route = first.record.route;
      const safe = constrainToRoute(
        [
          first.record.position[0] - first.record.along[0] * 26,
          first.record.position[1],
          first.record.position[2] - first.record.along[1] * 26,
        ],
        routes[state.route],
      );
      feel.reset();
      camera.position.fromArray(safe.position);
      camera.lookAt(first.node.position);
      camera.rotation.z = 0;
    }
    controls.unlock();
    keys.clear();
    $("#resume").hidden = true;
    setWeather("dawn");
    toast("06:16. Twenty frames between here and the river.");
  } else {
    $("#resume").hidden = controls.isLocked;
  }
}

// --- the whole circuit ------------------------------------------------------

function startTour() {
  if (!state.ready) return;
  if (state.flying) stopFlight(true);
  if (!state.playing) start(4, false);
  if (state.tour) {
    endTour(false);
    return;
  }
  if (state.overview) toggleOverview();
  stopWalks();
  state.tour = true;
  lastTourLeg = -1;
  controls.unlock();
  keys.clear();
  feel.reset();
  const legs = wholeCircuit();
  cinematic.play(legs);
  // Set the opening light now rather than a frame later, so the circuit does
  // not start on whatever mood happened to be showing.
  if (legs[0].mood) setWeather(legs[0].mood);
  $("#tour-label").textContent = legs[0].label;
  $("#tour-bar").style.width = "0%";
  document.body.classList.add("touring");
  $("#tour-button").classList.add("active");
  $("#tour-button").textContent = "■ Leave the circuit";
  $("#resume").hidden = true;
  toast("The whole circuit: woods, ridge, terrace, road, river. Press Esc to step off.");
}

function endTour(completed) {
  if (!state.tour) return;
  state.tour = false;
  cinematic.stop();
  cinematicFade = 0;
  document.body.classList.remove("touring");
  $("#tour-button").classList.remove("active");
  $("#tour-button").textContent = "⛰ Whole circuit";
  $("#resume").hidden = controls.isLocked;
  feel.reset();
  // Put the walker back on the nearest corridor so free walking just works.
  const near = closestRoute(
    [camera.position.x, camera.position.y - 1.7, camera.position.z],
    routes,
  );
  state.route = near.route;
  camera.position.set(near.position[0], near.position[1] + 1.7, near.position[2]);
  drawMap();
  toast(
    completed
      ? "That is the whole circuit. Wander it yourself now."
      : "Back on your own feet.",
  );
}

function stopWalks() {
  if (state.tour) endTour(false);
  state.auto = false;
  state.memoryWalk = false;
  $("#auto").classList.remove("active");
  $("#auto").textContent = "▷ Guided walk";
  $("#memory-walk").classList.remove("active");
  $("#memory-walk").textContent = "❍ Walk the morning";
}

// --- weather ----------------------------------------------------------------

function setWeather(name) {
  if (!["dawn", "morning", "sunset", "storm", "snow"].includes(name)) return;
  state.weather = name;
  $("#walk-weather").value = name;
  document
    .querySelectorAll("[data-weather]")
    .forEach((b) => b.classList.toggle("active", b.dataset.weather === name));
  $("#weather-label").textContent = WEATHER_LABEL[name];
  const planWeather = {
    dawn: "✦ Dawn", morning: "☀ Morning", sunset: "◒ Sunset", storm: "ϟ Storm", snow: "❄ Snow",
  }[name];
  $("#plan-weather").textContent = planWeather;
  $("#city-weather").textContent = planWeather;
  $("#plan-weather").setAttribute("aria-label", `Change weather: ${planWeather.slice(2)}`);
  if (state.playing)
    toast(
      {
        dawn: "The light the morning actually started in.",
        morning: "Birdsong returns to the mountain.",
        sunset: "Stay a while. Watch the light turn gold.",
        storm: "Rain on the path. Thunder across the river.",
        snow: "The forest becomes a little quieter.",
      }[name],
    );
}

function lock() {
  if (state.overview || matchMedia("(pointer: coarse)").matches) return;
  try {
    const promise = canvas.requestPointerLock?.();
    promise?.catch(() =>
      toast("Drag the scenery to look; use WASD or the arrows to walk."),
    );
  } catch {
    toast("Drag to look; use WASD or the arrows to walk.");
  }
}

function start(index = 0, capture = false) {
  if (!state.ready) return;
  state.playing = true;
  cinematic.stop();
  cinematicFade = 0;
  $("#welcome").hidden = true;
  $("#hud").hidden = false;
  document.body.classList.add("playing");
  goTo(index, false);
  toast("WASD to walk · Drag to look · K to fly");
  if (capture) lock();
  audio
    .start()
    .then(() => {
      audio.toggle(true);
      $("#sound").textContent = "Sound on";
      $("#sound").setAttribute("aria-label", "Mute nature sound");
    })
    .catch(() => toast("Sound could not load. You can still explore."));
}

function framePlan() {
  // Clear orbit momentum before resetting, otherwise labels keep drifting
  // while someone tries to choose an entrance on a slow device.
  orbit.enableDamping = false;
  orbit.update();
  const pose = planPose(routes.flatMap((r) => r.points), camera.aspect);
  camera.fov = pose.fov;
  camera.far = 50000;
  camera.position.copy(pose.position);
  orbit.target.copy(pose.target);
  camera.lookAt(orbit.target);
  camera.updateProjectionMatrix();
  orbit.update();
  orbit.enableDamping = true;
  plan?.update(camera);
}

function stopFlight(land = true) {
  if (!state.flying) return;
  if (land) state.route = kite.land().route;
  else kite.stop();
  state.flying = false;
  document.body.classList.remove("flying");
  $("#kite-toggle").setAttribute("aria-pressed", "false");
  $("#kite-toggle").setAttribute("aria-label", "Launch bird kite (K)");
  $("#kite-toggle").title = "Fly the bird kite · K";
  $("#menu-kite").textContent = "Fly bird kite · K";
  $("#flight-touch").hidden = true;
  keys.clear(); feel.reset(); lastTreeUpdate = lastGrowth = -10;
}

function toggleKite() {
  if (city?.active) { city.toggleFlight(); return; }
  if (!state.ready) return;
  $("#info").close();
  if (state.flying) {
    stopFlight(true);
    toast("Landed on the nearest path · WASD to walk");
    return;
  }
  if (state.overview) start(state.place, false);
  stopWalks(); feel.unapply(); feel.reset(); keys.clear();
  state.flying = true;
  kite.launch();
  document.body.classList.add("flying");
  $("#kite-toggle").setAttribute("aria-pressed", "true");
  $("#kite-toggle").setAttribute("aria-label", "Land on nearest path (K)");
  $("#kite-toggle").title = "Land on nearest path · K";
  $("#menu-kite").textContent = "Land on nearest path · K";
  $("#flight-touch").hidden = false;
  lastTreeUpdate = -10;
  toast("Bird kite · WASD to fly · Space / E up · Q down · K to land");
}

function showPlan() {
  if (city?.active) city.leave();
  if (!state.ready) return;
  if (state.flying) stopFlight(true);
  stopWalks();
  clearTimeout(toastTimer);
  $("#toast").classList.remove("show");
  if (!state.overview) {
    feel.unapply();
    returnPose = { position: camera.position.clone(), quaternion: camera.quaternion.clone() };
  }
  state.playing = false;
  state.overview = true;
  state.photoMode = false;
  cinematic.stop();
  cinematicFade = 0;
  keys.clear();
  controls.unlock();
  orbit.enabled = true;
  camera.near = 2;
  document.body.classList.remove("playing", "locked", "focus-mode", "photo-mode");
  document.body.classList.add("plan-mode");
  $("#focus-view").setAttribute("aria-pressed", "false");
  $("#focus-view").textContent = "Focus view";
  $("#photo-mode").setAttribute("aria-pressed", "false");
  $("#welcome").hidden = true;
  $("#hud").hidden = true;
  $("#walk-environment").hidden = true;
  $("#walk-menu").hidden = true;
  $("#plan-home").hidden = false;
  $("#back-to-plan").hidden = true;
  $("#resume").hidden = true;
  showMemoryCard(null);
  framePlan();
  drawMap();
  lastTreeUpdate = lastGrowth = -10;
}

function toggleOverview() {
  if (!state.ready) return;
  if (!state.overview) { showPlan(); return; }
  state.overview = false;
  state.playing = true;
  orbit.enabled = false;
  camera.near = 0.12;
  camera.far = 25000;
  camera.fov = feel.baseFov;
  camera.updateProjectionMatrix();
  camera.position.copy(returnPose.position);
  camera.quaternion.copy(returnPose.quaternion);
  feel.reset();
  document.body.classList.remove("plan-mode");
  document.body.classList.add("playing");
  $("#plan-home").hidden = true;
  $("#hud").hidden = false;
  $("#walk-environment").hidden = false;
  $("#walk-menu").hidden = false;
  $("#back-to-plan").hidden = false;
  $("#overview").textContent = "Map ↗";
  $("#resume").hidden = false;
  lastTreeUpdate = lastGrowth = -10;
}

function drawMap() {
  if (!routes) return;
  const c = $("#map").getContext("2d"),
    w = 256,
    h = 170;
  c.clearRect(0, 0, w, h);
  if (!state.playing) {
    c.fillStyle = "#b3bd85";
    c.fillRect(0, 0, w, h);
  }
  const map = (p) => [18 + (p[0] / 5700) * 220, 155 + (p[2] / 4500) * 140];
  c.fillStyle = state.playing ? "#79a8a322" : "#81baba";
  c.beginPath();
  c.moveTo(0, 0);
  c.lineTo(256, 0);
  c.lineTo(245, 18);
  for (const p of [...routes[3].points].reverse()) {
    const [x, y] = map(p);
    c.lineTo(x, y);
  }
  c.lineTo(0, 170);
  c.fill();
  routes.forEach((r, i) => {
    c.beginPath();
    r.points.forEach((p, j) => {
      const [x, y] = map(p);
      j ? c.lineTo(x, y) : c.moveTo(x, y);
    });
    c.strokeStyle = state.playing ? (i === state.route ? "#e2edb0" : "#8da58177") : "#56724b";
    c.lineWidth = i === state.route ? 1.5 : 0.8;
    c.stroke();
  });
  if (memories) {
    const seen = new Set(memories.found);
    memories.items.forEach((item) => {
      const [x, y] = map(item.record.position);
      c.fillStyle = seen.has(item.record.id) ? "#ffd79a" : "#c99a5a88";
      c.beginPath();
      c.arc(x, y, 1.9, 0, 7);
      c.fill();
    });
  }
  places.forEach((p, i) => {
    const [x, y] = map(world.bookmarks[p.bookmark].position);
    c.fillStyle = saved.includes(i) ? "#e4eec0" : "#839e80";
    c.beginPath();
    c.arc(x, y, 2.6, 0, 7);
    c.fill();
  });
  if (state.playing) {
    const [x, y] = map(camera.position.toArray());
    c.fillStyle = "#fffbe3";
    c.shadowColor = "#effbbb";
    c.shadowBlur = 7;
    c.beginPath();
    c.arc(x, y, 3.3, 0, 7);
    c.fill();
    c.shadowBlur = 0;
  }
  const home = $("#plan-map").getContext("2d");
  home.fillStyle = "#b3bd85";
  home.fillRect(0, 0, w, h);
  home.drawImage($("#map"), 0, 0);
}

// --- frame ------------------------------------------------------------------

/**
 * Corridors used to be islands: you could only ever walk the one path you
 * arrived on. Where two of them touch at the same height — the spur onto the
 * river terrace, or the places the ridge trail meets the road — walking into
 * the junction now hands you over to whichever corridor you are actually
 * heading down.
 */
let lastJunction = -10;
function takeJunction(before, proposed, t) {
  if (t - lastJunction < 0.2) return proposed;
  lastJunction = t;
  const here = [proposed.x, before.y - 1.7, proposed.z];
  const current = nearestOnRoute(here, routes[state.route]);
  let best = null;
  for (let i = 0; i < routes.length; i++) {
    if (i === state.route) continue;
    const n = nearestOnRoute(here, routes[i]);
    if (Math.abs(n.position[1] - (before.y - 1.7)) > 1.4) continue;
    if (n.distance > routes[i].width * 0.5 + 0.6) continue;
    if (n.distance > current.distance - 0.25) continue;
    if (!best || n.distance < best.distance) best = { ...n, route: i };
  }
  if (best) {
    state.route = best.route;
    drawMap();
  }
  return proposed;
}

const direction = new THREE.Vector3(),
  right = new THREE.Vector3(),
  grade = { lift: new THREE.Vector3(), gain: new THREE.Vector3(1, 1, 1) },
  blendedGrade = {
    lift: new THREE.Vector3(),
    gain: new THREE.Vector3(1, 1, 1),
    saturation: 1.08,
    contrast: 1.05,
    bloom: 0.5,
    exposure: 1.08,
  };

function updateGrade(dt) {
  const clear = 1 - weather.dawn - weather.sunset - weather.storm - weather.snow;
  const mix = {
    morning: Math.max(0, clear),
    dawn: weather.dawn,
    sunset: weather.sunset,
    storm: weather.storm,
    snow: weather.snow,
  };
  let total = 0;
  grade.lift.set(0, 0, 0);
  grade.gain.set(0, 0, 0);
  let saturation = 0,
    contrast = 0,
    bloom = 0,
    exposure = 0;
  for (const [key, amount] of Object.entries(mix)) {
    if (amount <= 0) continue;
    const g = GRADES[key];
    total += amount;
    grade.lift.x += g.lift[0] * amount;
    grade.lift.y += g.lift[1] * amount;
    grade.lift.z += g.lift[2] * amount;
    grade.gain.x += g.gain[0] * amount;
    grade.gain.y += g.gain[1] * amount;
    grade.gain.z += g.gain[2] * amount;
    saturation += g.saturation * amount;
    contrast += g.contrast * amount;
    bloom += g.bloom * amount;
    exposure += g.exposure * amount;
  }
  if (total <= 0.0001) return;
  grade.lift.divideScalar(total);
  grade.gain.divideScalar(total);
  blendedGrade.lift.lerp(grade.lift, 1 - Math.exp(-dt * 3));
  blendedGrade.gain.lerp(grade.gain, 1 - Math.exp(-dt * 3));
  blendedGrade.saturation = THREE.MathUtils.damp(blendedGrade.saturation, saturation / total, 3, dt);
  blendedGrade.contrast = THREE.MathUtils.damp(blendedGrade.contrast, contrast / total, 3, dt);
  blendedGrade.bloom = THREE.MathUtils.damp(blendedGrade.bloom, bloom / total, 3, dt);
  blendedGrade.exposure = THREE.MathUtils.damp(blendedGrade.exposure, exposure / total, 3, dt);

  const gu = postfx.grade.uniforms;
  gu.uLift.value.copy(blendedGrade.lift);
  gu.uGain.value.copy(blendedGrade.gain);
  gu.uSaturation.value = blendedGrade.saturation;
  gu.uContrast.value = blendedGrade.contrast;
  postfx.bloom.strength = blendedGrade.bloom;
  renderer.toneMappingExposure = blendedGrade.exposure;
}

function updateSunPosition() {
  // The memory walk carries its own clock; otherwise the sky sits at the
  // hour the mood implies.
  const minutes = state.memoryWalk
    ? THREE.MathUtils.lerp(WALK_START_MINUTES, WALK_END_MINUTES, walkTimeBlend)
    : THREE.MathUtils.lerp(WALK_END_MINUTES + 94, WALK_START_MINUTES, weather.dawn);
  const displayMinutes = Math.round(THREE.MathUtils.lerp(minutes, 18 * 60 + 15, weather.sunset));
  $("#scene-time").textContent = `${String(Math.floor(displayMinutes / 60)).padStart(2,"0")}:${String(displayMinutes % 60).padStart(2,"0")}`;
  sunDirectionForMinutes(minutes, sunDirection);
  sunDirection.lerp(sunsetDirection, weather.sunset).normalize();

  // Where the 70 km water plane ends for this eye height. The far bank is
  // drawn just above it, so it has to move as you climb the mountain.
  u.uHorizon.value = -(camera.position.y - 0.1) / 35000;

  const anchor = state.overview ? orbit.target : camera.position;
  sun.position.copy(anchor).addScaledVector(sunDirection, 900);
  // Snap the shadow centre to the shadow map grid so edges stop crawling.
  const texel = 140 / (sun.shadow.mapSize.x || 2048);
  sun.target.position.set(
    Math.round(anchor.x / texel) * texel,
    Math.round(anchor.y / texel) * texel,
    Math.round(anchor.z / texel) * texel,
  );
  sun.target.updateMatrixWorld();

  // project() folds points behind the camera back onto the screen, so test
  // the view direction before trusting the projected position.
  camera.getWorldDirection(direction);
  const ahead = direction.dot(sunDirection);
  sunScreen.copy(camera.position).addScaledVector(sunDirection, 6000).project(camera);
  const onScreen = ahead > 0.12 && sunScreen.z < 1;
  postfx.atmosphere.uniforms.uSun.value.set(
    sunScreen.x * 0.5 + 0.5,
    sunScreen.y * 0.5 + 0.5,
  );
  const clarity =
    (1 - weather.storm * 0.95) *
    (1 - weather.snow * 0.7) *
    THREE.MathUtils.smoothstep(ahead, 0.12, 0.55);
  postfx.atmosphere.uniforms.uSunVisible.value =
    onScreen && !state.overview ? clarity : 0;
  postfx.atmosphere.uniforms.uSunColor.value
    .setRGB(1, 0.86, 0.62)
    .lerp(new THREE.Color(1, 0.48, 0.2), Math.max(weather.sunset, weather.dawn * 0.8));
}

function trackQuality(dt) {
  if (qualityLocked || storedQuality || state.overview || !state.playing) return;
  qualitySamples.push(dt);
  if (qualitySamples.length < 150) return;
  const sorted = qualitySamples.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  qualitySamples = [];
  if (median > 1 / 26 && state.quality === "cinematic") {
    applyQuality("balanced");
    toast("Lowered to Balanced so the walk stays smooth. Change it under ?");
  } else if (median > 1 / 20 && state.quality === "balanced") {
    applyQuality("smooth");
    qualityLocked = true;
    toast("Lowered to Smooth for frame rate. Change it under ?");
  } else if (median < 1 / 58 && state.quality === "balanced") {
    applyQuality("cinematic");
    qualityLocked = true;
  } else {
    qualityLocked = true;
  }
}

function animate() {
  requestAnimationFrame(animate);
  // Browser QA can hold real-time rendering while it advances the simulation
  // explicitly. Do not replace requestAnimationFrame: browser capture needs it.
  if (window.__mufu?.paused) return;
  frame(clock.getDelta());
}

// Split out so the walk can also be stepped by hand, frame by frame, when
// something needs to be inspected without a running animation loop.
function frame(elapsed) {
  simTime += elapsed;
  const dt = Math.min(elapsed, 0.1),
    weatherDt = Math.min(elapsed, 0.5),
    t = simTime;
  state.frames++;
  u.time.value = t;
  u.planView.value = state.overview ? 1 : 0;

  feel.unapply();

  for (const key of ["dawn", "sunset", "storm", "snow"]) {
    weather[key] = THREE.MathUtils.damp(
      weather[key],
      state.weather === key ? 1 : 0,
      0.75,
      weatherDt,
    );
    u[key].value = weather[key];
  }

  if (city?.active) {
    updateGrade(dt);updateSunPosition();
    const footstep=city.frame(dt,t,weather,sunDirection);
    if(footstep) audio.footstep(weather);
    audio.update(weather,.35,state.moving,state.flying);
    const grade=postfx.grade.uniforms;
    grade.uTime.value=t;grade.uFade.value=0;grade.uLetterbox.value=0;
    grade.uVignette.value=.18;grade.uGrain.value=.15;grade.uAberration.value=0;
    postfx.atmosphere.uniforms.uShafts.value=0;
    postfx.atmosphere.uniforms.uAO.value=0;
    postfx.render();return;
  }
  postfx.atmosphere.uniforms.uShafts.value=TIERS[state.quality].shafts?1:0;
  postfx.atmosphere.uniforms.uAO.value=TIERS[state.quality].ao?1:0;
  const daylight = 1 - weather.dawn * 0.72;
  hemi.intensity = (1.25 - weather.storm * 0.45) * daylight;
  hemi.color.setRGB(0.85 - weather.dawn * 0.35, 0.92 - weather.dawn * 0.3, 1.0);
  sun.intensity =
    Math.max(0, 3.6 - weather.storm * 3.35 - weather.snow * 2.2) *
    (1 - weather.dawn * 0.6);
  sun.color.setRGB(
    1,
    1 - weather.sunset * 0.42 - weather.dawn * 0.22,
    1 - weather.sunset * 0.7 - weather.dawn * 0.44,
  );
  fill.intensity = 0.35 * daylight * (1 - weather.storm * 0.4);

  scene.fog.color.setRGB(
    0.67 + weather.sunset * 0.12 - weather.storm * 0.4 - weather.dawn * 0.4,
    0.76 - weather.sunset * 0.17 - weather.storm * 0.4 - weather.dawn * 0.45,
    0.72 - weather.sunset * 0.22 - weather.storm * 0.33 - weather.dawn * 0.3,
  );
  scene.fog.density = state.overview
    ? 0.000035
    : 0.000155 + weather.storm * 0.00068 + weather.snow * 0.00042 + weather.dawn * 0.00014;

  sky.position.copy(camera.position);
  particles.position.copy(camera.position);
  particles.visible = weather.snow > 0.02 && !state.overview;
  rainLines.position.copy(camera.position);
  rainLines.visible = weather.storm > 0.02 && !state.overview;
  // Both drifting layers sit mostly below the eye, and each is told where the
  // eye is so it can fade out anything that would only be a speck on the sky.
  motes.position.set(camera.position.x, camera.position.y - 4.6, camera.position.z);
  motes.material.uniforms.uEyeHeight.value = camera.position.y - motes.position.y;
  motes.visible = !state.overview && !state.flying && weather.storm < 0.7;
  leaves.position.set(camera.position.x, camera.position.y - 8.5, camera.position.z);
  leaves.material.uniforms.uEyeHeight.value = camera.position.y - leaves.position.y;
  leaves.visible = !state.overview && !state.flying;

  if (weather.storm > 0.8 && t - lastLightning > 17) {
    lastLightning = t;
    flashTimer = 0.22;
    setTimeout(() => {
      if (state.weather === "storm") audio.thunder();
    }, 1400);
  }
  flashTimer = Math.max(0, flashTimer - dt);
  u.flash.value = flashTimer > 0 ? 0.65 : 0;
  sun.intensity += u.flash.value * 3;

  state.moving = false;
  let strafe = 0,
    sprinting = false;

  if (state.flying && !$("#info").open) {
    kite.update(dt, t, keys);
  } else if ((!state.playing || state.tour) && !state.overview && cinematic?.running) {
    // The loop behind the title, and the hands-free circuit, are the same
    // machinery: a camera on rails through the road, the ridge and the river.
    const shot = cinematic.update(dt, camera, t);
    if (shot) {
      cinematicFade = shot.fade;
      if (shot.leg.mood && shot.leg.mood !== state.weather) setWeather(shot.leg.mood);
      if (state.tour) {
        if (shot.index !== lastTourLeg) {
          lastTourLeg = shot.index;
          $("#tour-label").textContent = shot.leg.label;
          if (shot.leg.route !== undefined) state.route = shot.leg.route;
        }
        $("#tour-bar").style.width = `${(cinematic.progress * 100).toFixed(1)}%`;
        if (shot.finished) endTour(true);
      }
    }
  } else if (state.playing && !state.flying && !state.overview && !$("#info").open) {
    const f =
        (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) -
        (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0),
      s =
        (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) -
        (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0);
    strafe = s;
    sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const auto = state.auto || state.memoryWalk;
    if (f || s || auto) {
      const before = camera.position.clone();
      let proposed = before.clone();
      if (auto) {
        let goal = null;
        if (state.memoryWalk) {
          const phase = memoryWalk.advance(camera, dt);
          if (phase === "finished") {
            state.memoryWalk = false;
            $("#memory-walk").classList.remove("active");
            $("#memory-walk").textContent = "❍ Walk the morning";
            $("#resume").hidden = false;
            toast("08:26. That is the whole morning.");
          } else if (phase === "walking") {
            const item = memoryWalk.target;
            if (item && item.record.route !== state.route) {
              state.route = item.record.route;
            }
            goal = item ? item.node.position : null;
          }
          walkTimeBlend = THREE.MathUtils.damp(
            walkTimeBlend,
            memoryWalk.progress(),
            1.2,
            dt,
          );
        }
        if (!goal) {
          const n = nearestOnRoute(
            [before.x, before.y - 1.7, before.z],
            routes[state.route],
          );
          const target =
            routes[state.route].points[
              Math.min(n.index + 3, routes[state.route].points.length - 1)
            ];
          goal = new THREE.Vector3().fromArray(target);
        }
        direction.copy(goal).sub(before);
        direction.y = 0;
        if (direction.length() < 0.4 && state.auto) {
          state.auto = false;
          $("#auto").classList.remove("active");
          $("#auto").textContent = "▷ Guided walk";
          toast("End of this path. Choose another place to keep exploring.");
        }
        direction.normalize();
        proposed.addScaledVector(direction, (state.memoryWalk ? 2.6 : 2.2) * dt);
        const desired = new THREE.Quaternion().setFromRotationMatrix(
          new THREE.Matrix4().lookAt(
            before,
            before.clone().add(direction),
            camera.up,
          ),
        );
        camera.quaternion.slerp(desired, 1 - Math.exp(-dt * 2));
      } else {
        camera.getWorldDirection(direction);
        direction.y = 0;
        direction.normalize();
        right.crossVectors(direction, camera.up);
        direction.multiplyScalar(f).addScaledVector(right, s).normalize();
        proposed.addScaledVector(direction, (sprinting ? 5.2 : 2.1) * dt);
      }
      if (!auto) proposed = takeJunction(before, proposed, t);
      const safe = constrainToRoute(
        [proposed.x, before.y - 1.7, proposed.z],
        routes[state.route],
      );
      camera.position.fromArray(safe.position);
      const travel = Math.hypot(
        before.x - camera.position.x,
        before.z - camera.position.z,
      );
      state.distance += travel;
      state.moving = travel > 0.0005;
    }
  }

  if (state.overview) { orbit.update(); plan?.update(camera); }

  if (!state.overview && !state.flying) {
    feel.update(dt, {
      moving: state.moving,
      running: sprinting,
      strafe,
      sprinting,
    });
    if (feel.step) audio.footstep(weather);
  }

  if (t - lastTreeUpdate > 0.8) {
    lastTreeUpdate = t;
    updateTrees();
  }
  if (!state.overview && t - lastGrowth > 0.35) {
    lastGrowth = t;
    undergrowth.update(camera);
    meadow.update(camera);
  } else if (state.overview) {
    undergrowth.mesh.count = 0;
    undergrowth.shrubs.count = undergrowth.stems.count = 0;
    undergrowth.ferns.count = 0;
    meadow.clear();
  }

  if (memories) {
    const result = memories.update(t, camera, dt);
    if (state.overview) {
      showMemoryCard(null);
    } else if (result.changed) {
      showMemoryCard(result.active);
      if (result.active && result.firstTime) {
        audio.chime();
        foundMemories = memories.found;
        try {
          localStorage.setItem("mufu-memories", JSON.stringify(foundMemories));
        } catch {}
        // The atlas passport counts the morning photographs towards Mufu's seal.
        city?.game?.noteMufu(foundMemories.length);
        document
          .querySelector(`[data-memory="${result.active.record.id}"]`)
          ?.classList.add("seen");
        updateMemoryCount();
      }
    }
  }

  audio.update(weather, state.route === 3 ? 1 : 0.03, state.moving, state.flying);
  const traffic = riverLife.update(t, weather, camera);
  audio.riverTraffic(traffic, t, state.playing && !state.overview);

  updateGrade(dt);
  updateSunPosition();
  postfx.grade.uniforms.uTime.value = t;
  postfx.grade.uniforms.uLetterbox.value = THREE.MathUtils.damp(
    postfx.grade.uniforms.uLetterbox.value,
    state.photoMode ? 1 : 0,
    5,
    dt,
  );
  fadeIn = Math.max(0, fadeIn - dt * 0.7);
  postfx.grade.uniforms.uFade.value = Math.max(fadeIn, cinematicFade);
  postfx.grade.uniforms.uVignette.value = state.overview ? 0.12 : 1;
  postfx.grade.uniforms.uGrain.value = state.overview ? 0.08 : 1;
  postfx.grade.uniforms.uAberration.value = state.overview ? 0 : 1;

  if (t - lastMap > 0.25) {
    lastMap = t;
    drawMap();
    $("#distance").textContent = Math.floor(state.distance);
    $("#height").textContent =
      `${Math.round((state.overview ? returnPose.position.y : camera.position.y) - 1.7)} m`;
  }

  postfx.render();
  trackQuality(elapsed);
}

// --- wiring -----------------------------------------------------------------

$("#back-to-plan").onclick = () => city?.active ? city.showPlan() : showPlan();
$("#kite-toggle").onclick = toggleKite;
$("#menu-kite").onclick = toggleKite;
$("#menu-map").onclick = () => { $("#info").close(); showPlan(); };
$("#menu-sound").onclick = () => $("#sound").click();
$("#walk-weather").onchange = e => { setWeather(e.target.value); e.target.blur(); };
$("#walk-menu").onclick = () => city?.active ? city.menu() : $("#help").click();
$("#album-photos").append($("#memory-strip"));
// Keep tours, photos and destinations available without covering the view.
for (const id of ["destination", "memory-walk", "tour-button", "auto", "postcard", "photo-mode", "collect", "river-watch"]) {
  $("#menu-extra").append($("#" + id));
}
$("#destination").setAttribute("aria-label", "Walking destination");
for (const id of ["destination", "memory-walk", "tour-button", "auto", "river-watch"]) {
  $("#" + id).addEventListener("click", () => { if(id !== "destination") $("#info").close(); });
}
$("#destination").addEventListener("change", () => $("#info").close());
$(".brand").onclick = (e) => { e.preventDefault(); city?.active ? city.showPlan() : showPlan(); };
$("#plan-reset").onclick = framePlan;
$("#plan-weather").onclick = () => {
  const moods = ["morning", "sunset", "storm", "snow", "dawn"];
  setWeather(moods[(moods.indexOf(state.weather) + 1) % moods.length]);
};
$("#resume").onclick = lock;
$("#destination").onchange = (e) => goTo(Number(e.target.value));
$("#overview").onclick = toggleOverview;
$("#focus-view").onclick = () => {
  const active = document.body.classList.toggle("focus-mode");
  $("#focus-view").setAttribute("aria-pressed", String(active));
  $("#focus-view").textContent = active ? "Show controls" : "Focus view";
};
$("#memory-walk").onclick = startMemoryWalk;
$("#tour-button").onclick = startTour;
$("#photo-mode").onclick = () => {
  state.photoMode = !state.photoMode;
  document.body.classList.toggle("photo-mode", state.photoMode);
  $("#photo-mode").setAttribute("aria-pressed", String(state.photoMode));
  if (state.photoMode) toast("Photo mode. Press ▣ Postcard to keep the frame.");
};
$("#river-watch").onclick = () => {
  goTo(3, false); // which stops any walk in progress
  const view = riverLife.watchView(camera.aspect);
  camera.position.copy(view.position);
  camera.lookAt(view.target);
  camera.rotation.z = 0;
  feel.reset();
  $("#resume").hidden = controls.isLocked;
  lastTreeUpdate = -10;
  lastGrowth = -10;
  drawMap();
  toast("Passing ships, flowing water, and the riverside beacon. Try Sunset.");
};
document
  .querySelectorAll("[data-weather]")
  .forEach((b) => (b.onclick = () => setWeather(b.dataset.weather)));
document
  .querySelectorAll("[data-quality]")
  .forEach((b) => (b.onclick = () => {
    qualityLocked = true;
    storedQuality = b.dataset.quality;
    applyQuality(b.dataset.quality, true);
  }));
$("#sound").onclick = async () => {
  try {
    await audio.start();
    audio.toggle(!audio.enabled);
    $("#sound").textContent = audio.enabled ? "Sound on" : "Sound off";
    $("#sound").setAttribute(
      "aria-label",
      audio.enabled ? "Mute nature sound" : "Enable nature sound",
    );
  } catch {
    toast("Audio unavailable. Please try again.");
  }
};
$("#auto").onclick = () => {
  if (state.flying) stopFlight(true);
  if (state.overview) toggleOverview();
  if (state.memoryWalk) startMemoryWalk();
  state.auto = !state.auto;
  controls.unlock();
  $("#auto").classList.toggle("active", state.auto);
  $("#auto").textContent = state.auto ? "Ⅱ Pause guided walk" : "▷ Guided walk";
  $("#resume").hidden = state.auto;
  keys.clear();
};
$("#collect").onclick = () => {
  if (state.overview) {
    toast("Return to the path to save this moment.");
    return;
  }
  if (!saved.includes(state.place)) {
    saved.push(state.place);
    try {
      localStorage.setItem("mufu-notes", JSON.stringify(saved));
    } catch {}
    updateNotes();
    toast(
      saved.length === 5
        ? "Five moments collected. The mountain is yours to wander."
        : `${places[state.place].name} added to your field notes.`,
    );
  } else toast("This moment is already in your field notes.");
};
$("#postcard").onclick = () => {
  postfx.render();
  canvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Mufu-${places[state.place].name.replaceAll(" ", "-")}-${state.weather}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    toast("Postcard saved. A small piece of the mountain.");
  });
};
$("#help").onclick = () => {
  controls?.unlock();
  keys.clear();
  if(city?.active) city.menu(); else $("#info").showModal();
};
$("#close-info").onclick = () => $("#info").close();
$("#reset-notes").onclick = () => {
  saved = [];
  foundMemories = [];
  memories?.reset();
  try {
    localStorage.removeItem("mufu-notes");
    localStorage.removeItem("mufu-memories");
  } catch {}
  if (state.ready) {
    updateNotes();
    document
      .querySelectorAll(".memory-chip.seen")
      .forEach((c) => c.classList.remove("seen"));
    updateMemoryCount();
  }
  toast("A fresh notebook for your next walk.");
};
window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    controls?.unlock();
    keys.clear();
    if (state.tour) endTour(false);
  }
  // Any attempt to walk takes the circuit off the rails.
  if (
    state.tour &&
    ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
      e.code,
    )
  ) {
    endTour(false);
  }
  if (e.target.matches("input,select,textarea") || $("#info").open || $("#city-menu").open || $("#city-passport").open || $("#city-places").open) return;
  if (city?.active && !e.repeat && state.ready) {
    if (e.code === "KeyG") { city.openPlaces(true); e.preventDefault(); return; }
    if (e.code === "BracketRight" || e.code === "BracketLeft") { city.hop(e.code === "BracketRight" ? 1 : -1); e.preventDefault(); return; }
  }
  if (city && e.code === "KeyJ" && !e.repeat && state.ready) { city.passport(true); e.preventDefault(); return; }
  if(city?.active && ["KeyM","KeyT","KeyP"].includes(e.code)) {
    if(e.code==="KeyM" && !e.repeat) city.showPlan();
    e.preventDefault();return;
  }
  if (e.code === "KeyK" && !e.repeat && state.ready) { toggleKite(); e.preventDefault(); return; }
  if (e.code === "KeyP" && state.ready && state.playing) {
    $("#photo-mode").click();
    e.preventDefault();
    return;
  }
  if (e.code === "KeyM" && state.ready) {
    startMemoryWalk();
    e.preventDefault();
    return;
  }
  if (e.code === "KeyT" && state.ready) {
    startTour();
    e.preventDefault();
    return;
  }
  if (
    [
      "KeyW",
      "KeyA",
      "KeyS",
      "KeyD",
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "ShiftLeft",
      "ShiftRight",
      "Space", "KeyE", "KeyQ", "ControlLeft", "ControlRight",
    ].includes(e.code)
  ) {
    keys.add(e.code);
    e.preventDefault();
  }
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
document.addEventListener("visibilitychange", () => {
  keys.clear();
  if (document.hidden) {
    audio.ctx?.suspend();
  } else if (audio.enabled) audio.ctx?.resume();
});
let drag = null;
canvas.addEventListener("dblclick", () => { if(state.playing && !state.overview) lock(); });
canvas.addEventListener("pointerdown", (e) => {
  if (!state.playing || state.overview || controls.isLocked) return;
  drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener("pointermove", (e) => {
  if (!drag || controls.isLocked || state.overview) return;
  camera.rotation.y -= (e.clientX - drag.x) * 0.003;
  camera.rotation.x = THREE.MathUtils.clamp(
    camera.rotation.x - (e.clientY - drag.y) * 0.003,
    -1.3,
    1.3,
  );
  drag.x = e.clientX;
  drag.y = e.clientY;
});
canvas.addEventListener("pointerup", () => (drag = null));
canvas.addEventListener("pointercancel", () => (drag = null));
const moveKeys = { forward: "KeyW", back: "KeyS", left: "KeyA", right: "KeyD", up: "KeyE", down: "KeyQ" };
document.querySelectorAll("[data-move]").forEach((b) => {
  b.onpointerdown = (e) => {
    e.preventDefault();
    b.setPointerCapture(e.pointerId);
    keys.add(moveKeys[b.dataset.move]);
  };
  b.onpointerup = b.onpointercancel = () =>
    keys.delete(moveKeys[b.dataset.move]);
});
document.addEventListener("pointerlockerror", () => {
  toast("Mouse capture is unavailable. Drag to look and use the arrows.");
});
window.addEventListener("resize", () => {
  if (!renderer) return;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  postfx?.resize();
  if (state.overview && state.ready) city?.active ? city.resize() : framePlan();
});
canvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  // Come back once on the cheapest settings. Reloading in a loop makes the
  // browser block WebGL for the page altogether.
  let alreadyRecovered = "1";
  try {
    alreadyRecovered = sessionStorage.getItem("mufu-recovered");
    localStorage.setItem("mufu-quality", "smooth");
    sessionStorage.setItem("mufu-recovered", "1");
  } catch {}
  $("#welcome").hidden = false;
  $("#hud").hidden = true;
  if (alreadyRecovered) {
    $("#load-status").textContent =
      "The graphics driver dropped the scene. Reload the page to try again on the Smooth setting.";
    $("#enter").hidden = false;
    $("#enter").disabled = false;
    $("#enter").textContent = "Reload the landscape";
    $("#enter").onclick = () => location.reload();
    return;
  }
  $("#load-status").textContent =
    "The graphics driver dropped the scene. Reloading on the Smooth setting…";
  toast("Graphics were lost. Reloading on lighter settings…");
  setTimeout(() => location.reload(), 2200);
});
load();
