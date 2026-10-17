import * as THREE from 'three';

// The visitor's traveller, a magpie companion and the paraglider they arrive under. Built from
// primitives with banded toon materials so they sit in the painted scenes without new downloads.
// Sizes are true metres (the traveller is 1.72 m tall). Each part pivots at its joint so walk,
// sit and glide poses are plain rotations: no skeleton, no animation files.

const toon = (bands, color, opts = {}) => new THREE.MeshToonMaterial({color, gradientMap: bands, ...opts});

function capsule(r, len, mat) {
  // Hangs down from its pivot: the joint is at y = 0.
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 8), mat);
  m.position.y = -len / 2 - r * .3;
  const pivot = new THREE.Group();
  pivot.add(m);
  return pivot;
}

export const OUTFITS = {
  ochre: {jacket: 0xc9873a, trousers: 0x34405a, pack: 0xb8432f, hat: 0xe2c47a, band: 0x2b3f9e},
  teal: {jacket: 0x3e7d72, trousers: 0x4a3b30, pack: 0xd6a640, hat: 0xece0c0, band: 0xb8432f},
  rose: {jacket: 0xc76a6a, trousers: 0x2f3b4a, pack: 0x5e8f3a, hat: 0xe9d7b0, band: 0x34405a},
};

export function createTraveller(bands, outfit = OUTFITS.ochre) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const skin = toon(bands, 0xe8c4a0), jacket = toon(bands, outfit.jacket), trousers = toon(bands, outfit.trousers);
  const shoe = toon(bands, 0x5a4030), pack = toon(bands, outfit.pack), hat = toon(bands, outfit.hat), band = toon(bands, outfit.band);
  // Legs from the hips.
  const legL = capsule(.075, .72, trousers), legR = capsule(.075, .72, trousers);
  for (const [leg, x] of [[legL, -.1], [legR, .1]]) {
    leg.position.set(x, .9, 0);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(.11, .07, .24), shoe);
    foot.position.set(0, -.86, .05);
    leg.add(foot);
    body.add(leg);
  }
  // Torso, backpack, arms, head and sun hat.
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(.17, .38, 3, 10), jacket);
  torso.position.y = 1.2; torso.scale.set(1.08, 1, .78);
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(.32, .42, .18), pack);
  backpack.position.set(0, 1.22, -.19);
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(.07, .07, .34, 8), toon(bands, 0x6e9a3e));
  roll.rotation.z = Math.PI / 2; roll.position.set(0, 1.47, -.2);
  body.add(torso, backpack, roll);
  const armL = capsule(.055, .5, jacket), armR = capsule(.055, .5, jacket);
  for (const [arm, x] of [[armL, -.24], [armR, .24]]) {
    arm.position.set(x, 1.42, 0);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), skin);
    hand.position.y = -.64;
    arm.add(hand);
    body.add(arm);
  }
  const head = new THREE.Group();
  head.position.y = 1.58;
  const face = new THREE.Mesh(new THREE.SphereGeometry(.12, 14, 10), skin);
  face.position.y = .02;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.27, .27, .018, 20), hat);
  brim.position.y = .1;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(.12, .14, .11, 16), hat);
  crown.position.y = .16;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(.142, .142, .03, 16), band);
  ribbon.position.y = .125;
  head.add(face, brim, crown, ribbon);
  body.add(head);
  root.traverse(o => { if (o.isMesh) o.castShadow = false; });

  let phase = 0, sitK = 0, glideK = 0;
  return {
    root, height: 1.72,
    // speed in m/s; mode: 'walk' | 'sit' | 'glide'
    update(dt, speed, mode, t) {
      sitK = THREE.MathUtils.damp(sitK, mode === 'sit' ? 1 : 0, 6, dt);
      glideK = THREE.MathUtils.damp(glideK, mode === 'glide' ? 1 : 0, 4, dt);
      const stride = Math.min(1, speed / 1.7), run = THREE.MathUtils.clamp((speed - 2) / 2.6, 0, 1);
      phase += dt * (speed > .05 ? 2.1 + speed * 1.9 : 0);
      const swing = Math.sin(phase) * (.45 + run * .35) * stride * (1 - sitK) * (1 - glideK);
      legL.rotation.x = swing - sitK * 1.45 + glideK * Math.sin(t * 1.3) * .15;
      legR.rotation.x = -swing - sitK * 1.45 + glideK * Math.sin(t * 1.3 + 1) * .15;
      armL.rotation.x = -swing * .8 - glideK * 2.7 + sitK * .3;
      armR.rotation.x = swing * .8 - glideK * 2.7 + sitK * .3;
      armL.rotation.z = -glideK * .25; armR.rotation.z = glideK * .25;
      // Bob while walking; lower onto the seat; lean into a run.
      body.position.y = Math.abs(Math.cos(phase)) * .045 * stride * (1 - sitK) - sitK * .42;
      body.position.z = sitK * -.12;
      body.rotation.x = run * .14 * (1 - sitK);
      head.rotation.x = sitK * -.08 + Math.sin(t * .6) * .02;
      head.rotation.y = speed < .05 && !glideK ? Math.sin(t * .35) * .35 : 0;
    },
  };
}

// 喜鹊, the magpie: a bird of good news. It follows at the shoulder, flies beside the glider, and
// when the traveller stops for long enough it lands on the ground nearby and hops about.
export function createMagpie(bands) {
  const root = new THREE.Group(), black = toon(bands, 0x1f2430), white = toon(bands, 0xf2f0ea), blue = toon(bands, 0x2c4f8f);
  const body = new THREE.Mesh(new THREE.SphereGeometry(.09, 10, 8), black);
  body.scale.set(.85, .8, 1.35);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), white);
  belly.position.set(0, -.025, .02); belly.scale.set(1, .8, 1.2);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.055, 10, 8), black);
  head.position.set(0, .05, .12);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(.014, .05, 6), black);
  beak.rotation.x = Math.PI / 2; beak.position.set(0, .045, .19);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(.05, .012, .26), blue);
  tail.position.set(0, .02, -.22); tail.rotation.x = -.15;
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .06, 0, 0, -.08, .24, .01, -.04], 3));
  wingGeo.computeVertexNormals();
  const wingMat = toon(bands, 0x1f2430, {side: THREE.DoubleSide});
  const wingL = new THREE.Mesh(wingGeo, wingMat), wingR = new THREE.Mesh(wingGeo, wingMat);
  wingR.scale.x = -1;
  const patch = new THREE.Mesh(new THREE.BoxGeometry(.08, .005, .05), white);
  patch.position.set(.12, .006, -.02); wingL.add(patch);
  const patchR = patch.clone(); wingR.add(patchR);
  wingL.position.x = .05; wingR.position.x = -.05;
  root.add(body, belly, head, beak, tail, wingL, wingR);
  const pos = new THREE.Vector3(), vel = new THREE.Vector3(), target = new THREE.Vector3(), ground = new THREE.Vector3();
  let still = 0, landed = false, hop = 0, initialised = false;
  return {
    root,
    // owner: feet position; heading: radians; speed m/s; groundAt(x, z) -> height|null
    update(dt, t, owner, heading, speed, mode, groundAt) {
      if (!initialised) { pos.copy(owner).add(new THREE.Vector3(.6, 2, .6)); initialised = true; }
      still = speed > .2 || mode === 'glide' ? 0 : still + dt;
      const side = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
      if (mode === 'glide') {
        // Formation flight just off the right wingtip, a little below the canopy.
        target.copy(owner).addScaledVector(side, 2.2).add(new THREE.Vector3(0, 1.4 + Math.sin(t * 1.7) * .3, 0));
        landed = false;
      } else if (still > 3.5) {
        if (!landed) {
          const a = t * 1.7 % 6.283;
          ground.set(owner.x + Math.cos(a) * 1.6, 0, owner.z + Math.sin(a) * 1.6);
          ground.y = groundAt(ground.x, ground.z) ?? owner.y;
          landed = true;
        }
        hop = (hop + dt) % 1.6;
        target.copy(ground).add(new THREE.Vector3(0, .07 + (hop < .25 ? Math.sin(hop / .25 * Math.PI) * .08 : 0), 0));
      } else {
        landed = false;
        target.copy(owner).addScaledVector(side, .9).add(new THREE.Vector3(0, 2.1 + Math.sin(t * 2.3) * .15, 0));
        target.addScaledVector(new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading)), -.4);
      }
      const k = mode === 'glide' ? 3.5 : 2.6;
      vel.lerp(target.clone().sub(pos).multiplyScalar(k), 1 - Math.exp(-dt * 4));
      pos.addScaledVector(vel, dt);
      root.position.copy(pos);
      const flying = !landed || pos.distanceTo(target) > .15;
      if (vel.lengthSq() > .02) root.rotation.y = THREE.MathUtils.lerp(root.rotation.y, Math.atan2(vel.x, vel.z), 1 - Math.exp(-dt * 6));
      const flap = flying ? Math.sin(t * (mode === 'glide' ? 9 : 16)) * .9 : -.2;
      wingL.rotation.z = flap; wingR.rotation.z = -flap;
      tail.rotation.x = flying ? -.1 : -.35 + Math.sin(t * 5) * .05;
    },
  };
}

// A ram-air canopy arcing over the pilot, with lines down to the harness. Stripes in the scene
// palette (vermilion, cream, cobalt) read clearly against painted sky and forest.
export function createGlider(bands) {
  const root = new THREE.Group();
  const span = 8.4, chord = 2.3, cells = 14, arc = 1.15, lift = 6.4;
  const cols = [0xb8432f, 0xf2e8d0, 0xb8432f, 0x2b3f9e, 0xf2e8d0, 0xd6a640, 0xf2e8d0];
  for (let i = 0; i < cells; i++) {
    const a0 = -arc / 2 + arc * i / cells, a1 = -arc / 2 + arc * (i + 1) / cells, am = (a0 + a1) / 2;
    const r = span / arc;
    const cell = new THREE.Mesh(new THREE.BoxGeometry(r * (a1 - a0) * 1.02, .32, chord * (1 - Math.abs(am) * .35)),
      toon(bands, cols[i % cols.length], {side: THREE.DoubleSide}));
    cell.position.set(Math.sin(am) * r, lift + Math.cos(am) * r - r, 0);
    cell.rotation.z = -am;
    root.add(cell);
  }
  // Lines: thin quads from both canopy tips and centre to the harness.
  const lineMat = new THREE.LineBasicMaterial({color: 0x3a3a3a, transparent: true, opacity: .55});
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const a = -arc / 2 + arc * i / 6, r = span / arc;
    for (const z of [-.6, .6]) pts.push(0, 1.45, 0, Math.sin(a) * r, lift + Math.cos(a) * r - r - .16, z);
  }
  const lines = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)), lineMat);
  root.add(lines);
  root.traverse(o => { o.castShadow = false; o.frustumCulled = false; });
  return root;
}
