import * as THREE from "three";

// A layered sky: scattering-ish gradient, a real sun disc with limb glow,
// two parallaxed cloud decks, stars and a moon for the 06:16 end of the walk,
// and a haze band that keeps the far ridges from cutting a hard line.
const vertexShader = `
varying vec3 vDir;
void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const fragmentShader = `
uniform float time, sunset, storm, snow, flash, dawn;
uniform vec3 uSunDir;
uniform float uHorizon;
varying vec3 vDir;

float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
             mix(hash(i + vec2(0, 1)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += noise(p) * a; p *= 2.07; a *= 0.5; }
  return v;
}

// One cloud deck, projected onto a dome plane so it slides and shrinks
// towards the horizon instead of sitting flat across the screen.
vec2 deck(vec3 d, float height, float drift){
  return d.xz / max(d.y, 0.035) * height + vec2(time * drift, time * drift * 0.42);
}

void main(){
  vec3 d = normalize(vDir);
  float h = max(0.0, d.y);
  float horizon = 1.0 - smoothstep(0.0, 0.34, h);

  // --- base gradient -----------------------------------------------------
  // Photographs of this stretch of the Yangtze at sunset keep a blue sky
  // overhead; the warmth is a shallow band along the horizon, not a wash over
  // everything. The zenith stays blue in every clear mood.
  vec3 zenithDay   = vec3(0.115, 0.318, 0.556);
  vec3 zenithGold  = vec3(0.062, 0.204, 0.472);
  vec3 zenithDawn  = vec3(0.055, 0.106, 0.254);
  vec3 lowDay      = vec3(0.706, 0.816, 0.827);
  vec3 lowGold     = vec3(0.500, 0.560, 0.640);
  vec3 lowDawn     = vec3(0.330, 0.330, 0.420);

  vec3 zenith = mix(mix(zenithDay, zenithDawn, dawn), zenithGold, sunset);
  vec3 low    = mix(mix(lowDay,    lowDawn,   dawn), lowGold,    sunset);
  vec3 col = mix(low, zenith, pow(h, 0.42));

  // Overcast and snow flatten the whole dome towards grey.
  col = mix(col, mix(vec3(0.322, 0.376, 0.396), vec3(0.070, 0.113, 0.145), h), storm * 0.9);
  col = mix(col, mix(vec3(0.812, 0.855, 0.859), vec3(0.506, 0.612, 0.671), h), snow * 0.82);

  vec3 sd = normalize(uSunDir);
  float cosSun = dot(d, sd);
  float clarity = (1.0 - storm * 0.94) * (1.0 - snow * 0.78);
  float lowSun = 1.0 - smoothstep(0.02, 0.42, sd.y);
  vec2 sunAz = normalize(sd.xz + vec2(1e-5));
  vec2 viewAz = normalize(d.xz + vec2(1e-5));
  float towardSunAz = dot(viewAz, sunAz);

  // --- the warm band along the horizon -----------------------------------
  // Tight vertically, widest towards the sun, exactly where the light is
  // coming from. This is what carries a sunset, not a tinted whole sky.
  float dusk = max(sunset, dawn * 0.8);
  if (dusk > 0.001) {
    float band = exp(-h * 11.0);
    float arc = smoothstep(-0.55, 1.0, towardSunAz);
    vec3 nearSun = mix(vec3(0.98, 0.42, 0.13), vec3(1.0, 0.63, 0.24), lowSun);
    vec3 offSun  = mix(vec3(0.62, 0.32, 0.36), vec3(0.85, 0.47, 0.34), sunset);
    vec3 warm = mix(offSun, nearSun, arc);
    col = mix(col, warm, band * (0.30 + 0.62 * arc) * dusk * clarity);
  }

  // --- stars, moon and the evening star ----------------------------------
  float night = max(dawn, sunset * 0.55) * (1.0 - storm) * (1.0 - snow);
  if (night > 0.001) {
    vec2 grid = d.xz / max(abs(d.y) + 0.12, 0.12) * 46.0;
    float star = pow(hash(floor(grid)), 220.0);
    float twinkle = 0.65 + 0.35 * sin(time * 2.1 + hash(floor(grid)) * 90.0);
    col += vec3(0.82, 0.87, 1.0) * star * twinkle * night * smoothstep(0.06, 0.45, h) * 2.0;

    // A crescent: the lit disc with a second disc taken back out of it.
    vec3 moonDir = normalize(vec3(0.62, 0.46, 0.63));
    vec3 shadeDir = normalize(moonDir + vec3(0.0075, 0.0042, -0.0075));
    float disc = smoothstep(0.999935, 0.999965, dot(d, moonDir));
    float bite = smoothstep(0.999930, 0.999962, dot(d, shadeDir));
    col += vec3(0.98, 0.97, 0.92) * max(0.0, disc - bite) * night * 3.0;
    col += vec3(0.58, 0.64, 0.80) * pow(max(0.0, dot(d, moonDir)), 900.0) * night * 0.4;

    // The bright planet that sits near it in the dusk photographs.
    vec3 starDir = normalize(vec3(0.70, 0.52, 0.58));
    col += vec3(1.0, 0.98, 0.9) * smoothstep(0.999988, 0.999996, dot(d, starDir)) * night * 3.4;
  }

  // --- sun ---------------------------------------------------------------
  vec3 sunTint = mix(vec3(1.0, 0.88, 0.68), vec3(1.0, 0.44, 0.18), max(sunset, dawn * 0.75));
  col += sunTint * pow(max(0.0, cosSun), 17000.0) * 6.0 * clarity;           // disc
  col += sunTint * pow(max(0.0, cosSun), 128.0) * 0.45 * clarity;            // inner glow
  col += sunTint * pow(max(0.0, cosSun), 7.0) * 0.12 * clarity * horizon;    // scatter into haze

  // --- cloud decks -------------------------------------------------------
  float mask = smoothstep(0.0, 0.10, d.y);
  float towardSun = smoothstep(-0.2, 0.95, cosSun);
  // Cloud only takes the sunset's colour where the sunset can reach it.
  // Away from the sun the streaks stay white, the way they do in the
  // photographs, instead of tinting the whole dome pink.
  vec3 cloudLit = mix(
    vec3(0.96, 0.96, 0.95),
    mix(vec3(1.0, 0.72, 0.44), vec3(0.99, 0.55, 0.38), dawn),
    towardSun * dusk);
  vec3 cloudDark = mix(vec3(0.42, 0.46, 0.50), vec3(0.13, 0.15, 0.18), storm);
  cloudDark = mix(cloudDark, vec3(0.30, 0.26, 0.31), dusk * 0.7);
  vec3 cloud = mix(cloudDark, cloudLit, 0.30 + towardSun * 0.62);

  // High cirrus: the same noise, but sampled on a stretched grid so it draws
  // long fibrous streaks instead of blobs.
  vec2 hi = deck(d, 0.95, 0.0042);
  float cirrus = fbm(vec2(hi.x * 0.17 + hi.y * 0.06, hi.y * 1.35));
  // Leave plenty of clear sky between the streaks; solid cirrus reads as
  // overcast and takes the blue out of the dome.
  cirrus = smoothstep(0.56, 0.84, cirrus) * (0.30 + 0.45 * fbm(hi * 0.5));

  // The lower deck is the overcast one. It mostly stays out of the way in
  // clear weather so the streaks and the horizon band can be seen.
  vec2 lo = deck(d, 2.30, 0.0135);
  float low2 = fbm(lo * 0.95 + vec2(cirrus * 0.4));
  float body = smoothstep(0.50 - storm * 0.26, 0.84, low2);
  float rim = smoothstep(0.44 - storm * 0.24, 0.66, low2) - body;
  float bodyAmount = (0.20 + storm * 0.66 + snow * 0.45) * (1.0 - dusk * 0.45);

  col = mix(col, cloud * 0.96, cirrus * mask * (0.40 + storm * 0.34));
  col = mix(col, cloud, body * mask * bodyAmount);
  col += sunTint * rim * mask * towardSun * 0.9 * clarity;

  // --- horizon haze ------------------------------------------------------
  vec3 haze = mix(vec3(0.75, 0.80, 0.80), vec3(0.92, 0.66, 0.48), sunset);
  haze = mix(haze, vec3(0.34, 0.39, 0.41), storm);
  haze = mix(haze, vec3(0.24, 0.26, 0.38), dawn * 0.7);
  col = mix(col, haze, horizon * (0.22 + storm * 0.22));

  // --- the far bank ------------------------------------------------------
  // Across the Yangtze there is always a low dark shore: a tree line, the
  // occasional pylon or tower, and after sunset a thin string of lights. It
  // sits just above where the water plane ends for this eye height.
  float elev = d.y - uHorizon;
  float azim = atan(d.z, d.x);
  float ridge = 0.0030
              + 0.0038 * fbm(vec2(azim * 2.3, 11.0))
              + 0.0016 * noise(vec2(azim * 9.0, 3.0));
  float cell = floor(azim * 150.0);
  ridge += step(0.982, hash(vec2(cell, 7.0))) * 0.0085;   // a mast or a pylon
  float bank = (1.0 - smoothstep(-0.00035, 0.00035, elev - ridge)) * step(-0.0016, elev);
  vec3 bankCol = mix(vec3(0.17, 0.20, 0.18), vec3(0.020, 0.028, 0.045), dusk);
  bankCol = mix(bankCol, vec3(0.40, 0.45, 0.47), storm * 0.55);
  bankCol = mix(bankCol, vec3(0.62, 0.67, 0.70), snow * 0.5);
  col = mix(col, bankCol, bank * (0.52 + 0.44 * dusk) * (1.0 - storm * 0.35));

  // Shore lights, and the long lit line of a crossing, once the sun is down.
  float lamps = smoothstep(0.00055, 0.0, abs(elev - ridge * 0.42));
  float lit = step(0.66, hash(vec2(floor(azim * 620.0), 19.0)));
  col += vec3(1.0, 0.63, 0.24) * lamps * lit * dusk * 0.85 * (1.0 - storm * 0.8);
  float crossing = smoothstep(0.00030, 0.0, abs(elev - 0.0016))
                 * smoothstep(0.45, 0.9, fbm(vec2(azim * 1.3, 29.0)));
  col += vec3(1.0, 0.72, 0.30) * crossing * dusk * 0.7 * (1.0 - storm * 0.8);

  col = mix(col, haze * 0.55, smoothstep(0.0, -0.22, d.y));

  col += flash * 0.85;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSkyDome(scene, shared) {
  const uniforms = { ...shared };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(18000, 48, 32),
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  dome.name = "Sky";
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  scene.add(dome);
  return { dome, uniforms };
}

// The walk ran 06:16 to 08:26. `dawn` is 1 at the gate and 0 by the river, so
// a memory walk can carry the light of the morning it actually happened in.
export const WALK_START_MINUTES = 6 * 60 + 16;
export const WALK_END_MINUTES = 8 * 60 + 26;

/**
 * The real sun, for the real morning, in this model's coordinates.
 *
 * The scene's compass is recoverable from its own geometry: the promenade
 * bookmark faces along the bank with the water to its left, and the Muyan
 * riverside sits on the SOUTH bank of the Yangtze with its decks looking north
 * across to Bagua Island, so that heading is about 060 degrees. Solving from
 * that puts model north at (-0.3377, -0.9412) and east at (0.9412, -0.3377) —
 * and the whole promenade then runs at 072 degrees, ENE, which is how the
 * river actually lies here.
 *
 * With the compass fixed, these are NOAA solar positions for 32.1161N
 * 118.7771E on 26 September 2026, converted into model space. Sunrise that
 * morning is at azimuth 93.6 degrees, almost due east — the previous
 * hand-waved path had the morning sun in the west, so every shadow on the
 * walk fell the wrong way.
 */
const SUN_PATH = [
  [360, 0.9494, 0.0028, -0.314], // 06:00  alt  0.2  az  91.4
  [376, 0.9586, 0.0618, -0.2779], // 06:16  alt  3.5  az  93.6
  [405, 0.9634, 0.1676, -0.2089], // 06:45  alt  9.7  az  97.5
  [435, 0.9523, 0.2741, -0.1337], // 07:15  alt 15.9  az 101.7
  [465, 0.925, 0.3757, -0.056], // 07:45  alt 22.1  az 106.3
  [495, 0.8819, 0.4707, 0.023], // 08:15  alt 28.1  az 111.2
  [506, 0.8624, 0.5036, 0.052], // 08:26  alt 30.2  az 113.2
  [540, 0.7896, 0.5973, 0.1408], // 09:00  alt 36.7  az 119.8
  [585, 0.667, 0.7004, 0.2538], // 09:45  alt 44.5  az 130.6
  [630, 0.5191, 0.7762, 0.3577], // 10:30  alt 50.9  az 144.3
  [690, 0.2923, 0.8299, 0.4752], // 11:30  alt 56.1  az 168.1
];

/**
 * Sunset on the same day: azimuth 265 degrees, a hand's width above the water,
 * looking west down the channel. This bank's classic view is called Yanji
 * Evening Glow for a reason — the sun goes down over the river, not behind
 * the mountain.
 */
export const SUNSET_DIRECTION = new THREE.Vector3(-0.9077, 0.0845, 0.4109).normalize();

export function sunDirectionForMinutes(minutes, out = new THREE.Vector3()) {
  const clamped = THREE.MathUtils.clamp(
    minutes,
    SUN_PATH[0][0],
    SUN_PATH[SUN_PATH.length - 1][0],
  );
  let i = 0;
  while (i < SUN_PATH.length - 2 && SUN_PATH[i + 1][0] < clamped) i++;
  const a = SUN_PATH[i],
    b = SUN_PATH[i + 1];
  const f = (clamped - a[0]) / (b[0] - a[0] || 1);
  return out
    .set(
      a[1] + (b[1] - a[1]) * f,
      a[2] + (b[2] - a[2]) * f,
      a[3] + (b[3] - a[3]) * f,
    )
    .normalize();
}
