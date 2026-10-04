import * as THREE from "three";

// A dispersed wind-wave field, in metres/seconds. Short waves contribute to
// normals, not to an undersampled mesh. Unlike a repeated sine stack, crossing
// wave trains have different periods, bearings and phases and travel with the
// current. This is an artistic river spectrum, not a measured hydrology model.
export const RIVER_CURRENT = [0.68, -0.73];
export const RIVER_WAVES = [
  [98, .27, -.42], [61, .21, .15], [37, .155, -.8],
  [24, .11, .85], [15, .075, -1.9], [8.6, .05, .3],
  [4.7, .033, 2.0], [2.8, .019, -2.7], [1.6, .012, 1.2],
  [.93, .008, -.3], [.56, .005, -1.3], [.32, .0035, 2.4],
].map(([length, amplitude, angle], i) => {
  const k = 2 * Math.PI / length;
  return Object.freeze({ x: Math.cos(angle) * k, z: Math.sin(angle) * k,
    amplitude, omega: Math.sqrt(9.81 * k), phase: i * 2.399963 });
});

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function sampleRiverSurface(x, z, time, storm = 0, footprint = 0) {
  let height = 0, dx = 0, dz = 0, compression = 0;
  const norm = Math.hypot(...RIVER_CURRENT);
  x -= RIVER_CURRENT[0] / norm * time * .9;
  z -= RIVER_CURRENT[1] / norm * time * .9;
  for (const w of RIVER_WAVES) {
    const k = Math.hypot(w.x, w.z);
    const filter = Array.isArray(footprint)
      ? Math.max(Math.abs(footprint[0][0]*w.x+footprint[0][1]*w.z),Math.abs(footprint[1][0]*w.x+footprint[1][1]*w.z))
      : footprint*Math.max(Math.abs(w.x),Math.abs(w.z));
    const a = w.amplitude * (1 + storm * 1.8)
      * (1 - smoothstep(.55, 2.4, filter));
    const phase = x * w.x + z * w.z - time * w.omega + w.phase;
    height += Math.sin(phase) * a;
    dx += Math.cos(phase) * w.x * a;
    dz += Math.cos(phase) * w.z * a;
    compression += Math.sin(phase) * k * a;
  }
  return { height, dx, dz, compression };
}

export function riverSurfaceUniforms() {
  return {
    waveTrain: { value: RIVER_WAVES.map(w => new THREE.Vector4(w.x, w.z, w.amplitude, w.omega)) },
    wavePhase: { value: RIVER_WAVES.map(w => w.phase) },
  };
}

export const riverSurfaceGLSL = `
uniform vec4 waveTrain[12]; uniform float wavePhase[12];
vec4 riverField(vec2 at, vec2 footprintX, vec2 footprintY) {
  vec2 q=at-normalize(vec2(.68,-.73))*time*.9;
  vec4 field=vec4(0.);
  for(int i=0;i<12;i++) {
    vec4 w=waveTrain[i]; float k=length(w.xy);
    float bandFootprint=max(abs(dot(footprintX,w.xy)),abs(dot(footprintY,w.xy)));
    float a=w.z*(1.+storm*1.8)*(1.-smoothstep(.55,2.4,bandFootprint));
    float phase=dot(q,w.xy)-time*w.w+wavePhase[i];
    field+=vec4(sin(phase),cos(phase)*w.xy,sin(phase)*k)*a;
  }
  return field;
}
vec4 riverField(vec2 at,float spacing) {
  return riverField(at,vec2(spacing,0.),vec2(0.,spacing));
}`;

// Small, repeatable, tileable foam lace. Multiple advected scales and a broken
// crest mask hide the repeat; black gaps remain water rather than white paint.
export function foamTexture() {
  const c=document.createElement("canvas"); c.width=c.height=512;
  const g=c.getContext("2d"); g.fillStyle="#000"; g.fillRect(0,0,512,512);
  let seed=5179;
  const rand=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  for(let i=0;i<420;i++) {
    const x=rand()*512,y=rand()*512,r=2+rand()*21;
    const alpha=.2+rand()*.65, angle=rand()*Math.PI, stretch=.5+rand()*1.6;
    g.strokeStyle=`rgba(255,255,255,${alpha})`;g.lineWidth=.7+rand()*2.4;
    for(const ox of [-512,0,512]) for(const oy of [-512,0,512]) {
      g.beginPath();g.ellipse(x+ox,y+oy,r,r*stretch,angle,0,Math.PI*2);g.stroke();
    }
  }
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;
  return t;
}
