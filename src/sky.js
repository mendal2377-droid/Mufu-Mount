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
  vec3 zenithDay   = vec3(0.115, 0.318, 0.556);
  vec3 zenithGold  = vec3(0.176, 0.184, 0.372);
  vec3 zenithDawn  = vec3(0.071, 0.122, 0.263);
  vec3 lowDay      = vec3(0.706, 0.816, 0.827);
  vec3 lowGold     = vec3(1.020, 0.475, 0.212);
  vec3 lowDawn     = vec3(0.541, 0.404, 0.435);

  vec3 zenith = mix(mix(zenithDay, zenithDawn, dawn), zenithGold, sunset);
  vec3 low    = mix(mix(lowDay,    lowDawn,   dawn), lowGold,    sunset);
  vec3 col = mix(low, zenith, pow(h, 0.42));

  // Overcast and snow flatten the whole dome towards grey.
  col = mix(col, mix(vec3(0.322, 0.376, 0.396), vec3(0.070, 0.113, 0.145), h), storm * 0.9);
  col = mix(col, mix(vec3(0.812, 0.855, 0.859), vec3(0.506, 0.612, 0.671), h), snow * 0.82);

  // --- stars, then the moon, only while it is still nearly night ---------
  float night = dawn * (1.0 - storm) * (1.0 - snow);
  if (night > 0.001) {
    vec2 grid = d.xz / max(abs(d.y) + 0.12, 0.12) * 46.0;
    float star = pow(hash(floor(grid)), 220.0);
    float twinkle = 0.65 + 0.35 * sin(time * 2.1 + hash(floor(grid)) * 90.0);
    col += vec3(0.82, 0.87, 1.0) * star * twinkle * night * smoothstep(0.02, 0.4, h) * 2.4;

    vec3 moonDir = normalize(vec3(0.72, 0.42, 0.55));
    float moon = dot(d, moonDir);
    col += vec3(0.95, 0.95, 0.9) * smoothstep(0.99955, 0.99975, moon) * night * 1.6;
    col += vec3(0.55, 0.62, 0.78) * pow(max(0.0, moon), 320.0) * night * 0.5;
  }

  // --- sun ---------------------------------------------------------------
  vec3 sd = normalize(uSunDir);
  float cosSun = dot(d, sd);
  float clarity = (1.0 - storm * 0.94) * (1.0 - snow * 0.78);
  vec3 sunTint = mix(vec3(1.0, 0.88, 0.68), vec3(1.0, 0.44, 0.18), max(sunset, dawn * 0.75));
  col += sunTint * pow(max(0.0, cosSun), 4200.0) * 9.0 * clarity;            // disc
  col += sunTint * pow(max(0.0, cosSun), 128.0) * 0.55 * clarity;            // inner glow
  col += sunTint * pow(max(0.0, cosSun), 7.0) * 0.14 * clarity * horizon;    // scatter into haze

  // --- cloud decks -------------------------------------------------------
  float mask = smoothstep(0.0, 0.10, d.y);
  vec2 hi = deck(d, 1.05, 0.0052);
  float high = fbm(hi * 0.62);
  high = smoothstep(0.46 - storm * 0.20, 0.82, high);

  vec2 lo = deck(d, 2.30, 0.0135);
  float low2 = fbm(lo * 0.95 + vec2(high * 0.4));
  float body = smoothstep(0.44 - storm * 0.22, 0.80, low2);
  // Light leaks through the thin edge of a cloud from the sun's direction.
  float rim = smoothstep(0.40 - storm * 0.22, 0.62, low2) - body;

  vec3 cloudLit  = mix(vec3(0.98, 0.96, 0.90), vec3(1.0, 0.72, 0.44), max(sunset, dawn * 0.6));
  vec3 cloudDark = mix(vec3(0.42, 0.46, 0.50), vec3(0.13, 0.15, 0.18), storm);
  float towardSun = smoothstep(-0.2, 0.95, cosSun);
  vec3 cloud = mix(cloudDark, cloudLit, 0.30 + towardSun * 0.62);

  col = mix(col, cloud * 0.92, high * mask * (0.30 + storm * 0.34));
  col = mix(col, cloud, body * mask * (0.58 + storm * 0.34));
  col += sunTint * rim * mask * towardSun * 0.9 * clarity;

  // --- horizon haze and the ground half of the dome ----------------------
  vec3 haze = mix(vec3(0.75, 0.80, 0.80), vec3(1.0, 0.62, 0.38), sunset);
  haze = mix(haze, vec3(0.34, 0.39, 0.41), storm);
  haze = mix(haze, vec3(0.28, 0.30, 0.42), dawn * 0.7);
  col = mix(col, haze, horizon * (0.26 + storm * 0.22));
  col = mix(col, haze * 0.55, smoothstep(0.0, -0.22, d.y));

  col += flash * 0.85;
  gl_FragColor = vec4(col, 1.0);
}`;

export function createSkyDome(scene, shared) {
  const uniforms = {
    ...shared,
    uSunDir: { value: new THREE.Vector3(-0.8, 0.55, -0.6).normalize() },
  };
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

export function sunDirectionForMinutes(minutes, out = new THREE.Vector3()) {
  const t = THREE.MathUtils.clamp(
    (minutes - WALK_START_MINUTES) / (WALK_END_MINUTES - WALK_START_MINUTES),
    0,
    1,
  );
  // Late-September Nanjing: sun rises a little south of east and climbs fast.
  const elevation = THREE.MathUtils.lerp(0.035, 0.36, t);
  const azimuth = THREE.MathUtils.lerp(-1.02, -0.72, t);
  return out
    .set(Math.sin(azimuth), Math.sin(elevation), Math.cos(azimuth))
    .normalize();
}
