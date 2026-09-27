import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { FXAAPass } from "three/addons/postprocessing/FXAAPass.js";

// Three quality tiers. "smooth" still goes through the composer so that the
// raw-ShaderMaterial sky and water are tone mapped exactly once, by OutputPass.
export const TIERS = {
  smooth: { bloom: false, shafts: false, ao: false, smaa: false, pixelRatio: 1.0, shadow: 0 },
  balanced: { bloom: true, shafts: true, ao: true, smaa: true, pixelRatio: 1.0, shadow: 1024 },
  cinematic: { bloom: true, shafts: true, ao: true, smaa: true, pixelRatio: 1.25, shadow: 2048 },
};

const fullscreenVertex = `
varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

// Sun shafts plus a short-range depth ambient occlusion, both read from the
// depth buffer so nothing has to be drawn a second time. Runs in linear HDR,
// before bloom, so the shafts bloom and roll off with everything else.
const AtmosphereShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uSun: { value: new THREE.Vector2(0.5, 0.8) },
    uSunVisible: { value: 0 },
    uSunColor: { value: new THREE.Color(1, 0.86, 0.6) },
    uShafts: { value: 1 },
    uAO: { value: 1 },
    uAspect: { value: 1 },
    uNear: { value: 0.12 },
    uFar: { value: 25000 },
    uTexel: { value: new THREE.Vector2() },
  },
  vertexShader: fullscreenVertex,
  fragmentShader: `
  uniform sampler2D tDiffuse, tDepth;
  uniform vec2 uSun, uTexel;
  uniform vec3 uSunColor;
  uniform float uSunVisible, uShafts, uAO, uAspect, uNear, uFar;
  varying vec2 vUv;

  float linearDepth(vec2 uv){
    float d = texture2D(tDepth, uv).x;
    if (d >= 1.0) return uFar;
    float ndc = d * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - ndc * (uFar - uNear));
  }
  float sky(vec2 uv){ return step(0.9995, texture2D(tDepth, uv).x); }

  void main(){
    vec4 base = texture2D(tDiffuse, vUv);

    // --- contact darkening -------------------------------------------------
    if (uAO > 0.001) {
      float here = linearDepth(vUv);
      if (here < 320.0) {
        float radius = mix(3.5, 22.0, clamp(here / 320.0, 0.0, 1.0));
        float occlusion = 0.0;
        for (int i = 0; i < 8; i++) {
          float a = float(i) * 0.7853981634 + vUv.x * 9.0 + vUv.y * 13.0;
          vec2 o = vec2(cos(a), sin(a)) * uTexel * radius * (0.45 + 0.55 * fract(sin(float(i) * 51.3 + vUv.x * 91.0) * 4373.1));
          float diff = here - linearDepth(vUv + o);
          occlusion += smoothstep(0.06, 1.4, diff) * (1.0 - smoothstep(1.4, 7.0, diff));
        }
        occlusion /= 8.0;
        float fade = 1.0 - smoothstep(120.0, 320.0, here);
        base.rgb *= 1.0 - occlusion * 0.46 * uAO * fade;
      }
    }

    // --- sun shafts --------------------------------------------------------
    if (uShafts > 0.001 && uSunVisible > 0.001) {
      vec2 delta = (uSun - vUv);
      float spread = length(delta * vec2(uAspect, 1.0));
      if (spread < 1.15) {
        vec2 step = delta / 22.0;
        vec2 uv = vUv;
        float weight = 1.0;
        float gathered = 0.0;
        float dither = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
        uv += step * dither;
        for (int i = 0; i < 22; i++) {
          uv += step;
          gathered += sky(uv) * weight;
          weight *= 0.935;
        }
        gathered /= 22.0;
        float falloff = pow(1.0 - clamp(spread / 1.15, 0.0, 1.0), 2.2);
        base.rgb += uSunColor * gathered * falloff * uSunVisible * uShafts * 0.85;
      }
    }

    gl_FragColor = base;
  }`,
};

// Everything that belongs in display space: grade, halation, vignette,
// chromatic aberration at the very edge, grain, and the photo-mode letterbox.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uVignette: { value: 1 },
    uGrain: { value: 1 },
    uAberration: { value: 1 },
    uLift: { value: new THREE.Vector3(0, 0, 0) },
    uGain: { value: new THREE.Vector3(1, 1, 1) },
    uSaturation: { value: 1.05 },
    uContrast: { value: 1.04 },
    uLetterbox: { value: 0 },
    uFade: { value: 0 },
  },
  vertexShader: fullscreenVertex,
  fragmentShader: `
  uniform sampler2D tDiffuse;
  uniform float uTime, uVignette, uGrain, uAberration, uSaturation, uContrast, uLetterbox, uFade;
  uniform vec3 uLift, uGain;
  varying vec2 vUv;

  void main(){
    vec2 centred = vUv - 0.5;
    float r2 = dot(centred, centred);

    // Lenses disagree with themselves most at the corners.
    float shift = uAberration * r2 * 0.0035;
    vec3 col;
    col.r = texture2D(tDiffuse, vUv - centred * shift).r;
    col.g = texture2D(tDiffuse, vUv).g;
    col.b = texture2D(tDiffuse, vUv + centred * shift).b;

    col = clamp(col + uLift * (1.0 - col), 0.0, 4.0) * uGain;
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma), col, uSaturation);
    col = clamp((col - 0.5) * uContrast + 0.5, 0.0, 4.0);

    col *= 1.0 - uVignette * smoothstep(0.12, 0.78, r2) * 0.62;

    float grain = fract(sin(dot(vUv * vec2(1920.0, 1080.0) + uTime * 37.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    col += grain * uGrain * 0.032 * (1.0 - 0.6 * smoothstep(0.35, 0.9, luma));

    if (uLetterbox > 0.001) {
      float bar = uLetterbox * 0.115;
      col *= smoothstep(bar - 0.004, bar, vUv.y) * smoothstep(bar - 0.004, bar, 1.0 - vUv.y);
    }
    col *= 1.0 - uFade;

    gl_FragColor = vec4(col, 1.0);
  }`,
};

export function createPostFX(renderer, scene, camera, tierName = "cinematic") {
  const size = new THREE.Vector2();
  renderer.getDrawingBufferSize(size);

  const depthTexture = new THREE.DepthTexture(size.x, size.y);
  depthTexture.type = THREE.UnsignedIntType;
  const target = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    depthTexture,
    depthBuffer: true,
    samples: 0,
  });

  const composer = new EffectComposer(renderer, target);
  // EffectComposer clones the target for its second buffer, and the clone
  // keeps the same DepthTexture object. Sampling a depth texture that is also
  // attached to the pass's own render target is a framebuffer feedback loop,
  // so only one of the two buffers carries it.
  composer.renderTarget2.depthTexture = null;

  const renderPass = new RenderPass(scene, camera);
  const atmosphere = new ShaderPass(AtmosphereShader);
  atmosphere.uniforms.tDepth.value = depthTexture;
  // A high threshold: only the sun, the water glitter and the lit frames
  // should bloom. Lower than this and a sunlit tree canopy turns to soup.
  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.45, 0.55, 1.15);
  const output = new OutputPass();
  const grade = new ShaderPass(GradeShader);
  const antialias = new FXAAPass();

  composer.addPass(renderPass);
  composer.addPass(atmosphere);
  composer.addPass(bloom);
  composer.addPass(output);
  composer.addPass(grade);
  composer.addPass(antialias);

  const api = {
    composer,
    bloom,
    grade,
    atmosphere,
    tier: tierName,
    setTier(name) {
      const tier = TIERS[name] || TIERS.balanced;
      api.tier = name;
      bloom.enabled = tier.bloom;
      antialias.enabled = tier.smaa;
      atmosphere.enabled = tier.shafts || tier.ao;
      atmosphere.uniforms.uShafts.value = tier.shafts ? 1 : 0;
      atmosphere.uniforms.uAO.value = tier.ao ? 1 : 0;
      renderer.setPixelRatio(Math.min(devicePixelRatio, tier.pixelRatio));
      api.resize();
      return tier;
    },
    resize() {
      composer.setSize(innerWidth, innerHeight);
      renderer.getDrawingBufferSize(size);
      atmosphere.uniforms.uAspect.value = innerWidth / innerHeight;
      atmosphere.uniforms.uTexel.value.set(1 / size.x, 1 / size.y);
    },
    render() {
      // RenderPass draws into the composer's *read* buffer and does not swap,
      // so the scene — and its depth — always lands in the target that owns
      // the DepthTexture. Pinning the roles each frame also stops the buffers
      // alternating when the number of enabled passes is odd.
      composer.readBuffer = composer.renderTarget1;
      composer.writeBuffer = composer.renderTarget2;
      composer.render();
    },
  };

  api.setTier(tierName);
  return api;
}
