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

// The traveller is a duck (the owner: "Nanjing is famous for its duck", 盐水鸭 salted duck and
// roast duck): a round white cartoon duck with an orange bill and webbed feet, wings for arms, and
// still the traveller's sun hat, scarf and backpack. About 1.6 m to the hat's top, so cameras,
// seats and the bike fit as before.
export function createTraveller(bands, outfit = OUTFITS.ochre) {
  const root = new THREE.Group(), body = new THREE.Group();
  root.add(body);
  const feather = toon(bands, 0xf6f2e6), orange = toon(bands, 0xf09a2a), dark = toon(bands, 0x1c1c22);
  const shine = new THREE.MeshBasicMaterial({color: 0xffffff}), blush = toon(bands, 0xf2a2a0);
  const pack = toon(bands, outfit.pack), hat = toon(bands, outfit.hat), band = toon(bands, outfit.band);
  // Short orange legs from the hips, each with a flat webbed foot.
  const legL = capsule(.05, .26, orange), legR = capsule(.05, .26, orange);
  const webGeo = new THREE.BufferGeometry();
  // A three-toed paddle: a fan of triangles from the ankle forward.
  webGeo.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -.03, -.11, 0, .19, -.04, 0, .15, 0, 0, -.03, -.04, 0, .15, 0, 0, .21,
    0, 0, -.03, 0, 0, .21, .04, 0, .15, 0, 0, -.03, .04, 0, .15, .11, 0, .19], 3));
  webGeo.computeVertexNormals();
  const web = toon(bands, 0xf09a2a, {side: THREE.DoubleSide});
  for (const [leg, x] of [[legL, -.14], [legR, .14]]) {
    leg.position.set(x, .4, .02);
    const foot = new THREE.Mesh(webGeo, web);
    foot.position.set(0, -.38, .02);
    leg.add(foot);
    body.add(leg);
  }
  // A round body with a perky tail; the backpack and bedroll on its back.
  const torso = new THREE.Mesh(new THREE.SphereGeometry(.42, 20, 16), feather);
  torso.position.y = .78; torso.scale.set(1, 1.02, 1.12);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(.13, .3, 10), feather);
  tail.position.set(0, .98, -.48); tail.rotation.x = -2.1;
  const backpack = new THREE.Mesh(new THREE.BoxGeometry(.34, .34, .16), pack);
  backpack.position.set(0, .86, -.44); backpack.rotation.x = .15;
  const roll = new THREE.Mesh(new THREE.CylinderGeometry(.065, .065, .34, 8), toon(bands, 0x6e9a3e));
  roll.rotation.z = Math.PI / 2; roll.position.set(0, 1.07, -.45);
  body.add(torso, tail, backpack, roll);
  // Wings for arms: soft flattened paddles from the shoulders.
  const armL = capsule(.1, .26, feather), armR = capsule(.1, .26, feather);
  for (const [arm, x] of [[armL, -.4], [armR, .4]]) {
    arm.position.set(x, .98, 0);
    arm.children[0].scale.set(.45, 1, 1);
    body.add(arm);
  }
  // The scarf round the neck, in the hat-band colour.
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(.2, .055, 8, 18), band);
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.13;
  body.add(scarf);
  // A big round head: wide bill, bright eyes with a shine, pink cheeks; the sun hat on top.
  const head = new THREE.Group();
  head.position.y = 1.32;
  const face = new THREE.Mesh(new THREE.SphereGeometry(.27, 20, 16), feather);
  const bill = new THREE.Mesh(new THREE.SphereGeometry(.13, 14, 10), orange);
  bill.scale.set(1.25, .38, 1.15); bill.position.set(0, -.05, .27);
  head.add(face, bill);
  for (const x of [-.11, .11]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), dark);
    eye.position.set(x, .06, .23); eye.scale.set(1, 1.25, .6);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(.014, 6, 5), shine);
    glint.position.set(x + .012, .085, .255);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(.045, 10, 8), blush);
    cheek.position.set(x * 1.75, -.04, .2); cheek.scale.set(1, .6, .4);
    head.add(eye, glint, cheek);
  }
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(.32, .32, .018, 22), hat);
  brim.position.y = .2; brim.rotation.x = -.08;
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(.14, .17, .13, 16), hat);
  crown.position.y = .27;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(.172, .172, .03, 16), band);
  ribbon.position.y = .225;
  head.add(brim, crown, ribbon);
  body.add(head);
  // A bicycle for riding the avenues: two spoked wheels, a dark frame, bars and saddle. It shows
  // in 'bike' mode; the rider sits on it and pedals.
  // Bold enough to read from behind at chase-camera distance: a red frame, fat tyres.
  const bike = new THREE.Group(), steel = toon(bands, 0xb8432f), tyre = toon(bands, 0x1e1e1e), seat = toon(bands, 0x3a2a20);
  const wheels = [];
  for (const z of [-.52, .52]) {
    const w = new THREE.Group();
    w.add(new THREE.Mesh(new THREE.TorusGeometry(.33, .045, 6, 20), tyre));
    for (let k = 0; k < 3; k++) { const spoke = new THREE.Mesh(new THREE.BoxGeometry(.012, .64, .012), steel); spoke.rotation.z = k * Math.PI / 3; w.add(spoke); }
    w.rotation.y = Math.PI / 2; w.position.set(0, .34, z);
    bike.add(w); wheels.push(w);
  }
  const tube = (len, x, y, z, rx) => { const m = new THREE.Mesh(new THREE.BoxGeometry(.06, len, .06), steel); m.position.set(x, y, z); m.rotation.x = rx; bike.add(m); };
  tube(.62, 0, .62, -.08, .95);   // down tube
  tube(.52, 0, .58, -.34, -.35);  // seat tube
  tube(.56, 0, .84, .14, 1.45);   // top tube
  tube(.5, 0, .62, .42, -.3);     // fork
  const bars = new THREE.Mesh(new THREE.BoxGeometry(.56, .045, .045), steel); bars.position.set(0, 1.0, .36); bike.add(bars);
  const saddle = new THREE.Mesh(new THREE.BoxGeometry(.13, .04, .24), seat); saddle.position.set(0, .9, -.38); bike.add(saddle);
  bike.visible = false;
  root.add(bike);
  root.traverse(o => { if (o.isMesh) o.castShadow = false; });

  let phase = 0, sitK = 0, glideK = 0, bikeK = 0;
  return {
    root, height: 1.6,
    // speed in m/s; mode: 'walk' | 'sit' | 'glide' | 'bike'
    update(dt, speed, mode, t) {
      sitK = THREE.MathUtils.damp(sitK, mode === 'sit' ? 1 : 0, 6, dt);
      glideK = THREE.MathUtils.damp(glideK, mode === 'glide' ? 1 : 0, 4, dt);
      bikeK = THREE.MathUtils.damp(bikeK, mode === 'bike' ? 1 : 0, 8, dt);
      bike.visible = bikeK > .5;
      if (bike.visible) {
        // On the bike: seated on the saddle, pedalling (legs half a turn apart), hands on the bars,
        // leaning forward; the wheels turn with the speed.
        for (const w of wheels) w.rotation.x -= speed * dt / .33;
        const crank = (phase += dt * speed * 1.6);
        legL.rotation.x = -1.0 + Math.sin(crank) * .55; legR.rotation.x = -1.0 + Math.sin(crank + Math.PI) * .55;
        armL.rotation.x = armR.rotation.x = -1.25; armL.rotation.z = -.3; armR.rotation.z = .3;
        // The duck's hips are low: lift it onto the saddle.
        body.position.set(0, .5, -.3); body.rotation.set(.18, 0, 0);
        head.rotation.x = -.2; head.rotation.y = 0;
        return;
      }
      const stride = Math.min(1, speed / 1.7), run = THREE.MathUtils.clamp((speed - 2) / 2.6, 0, 1);
      phase += dt * (speed > .05 ? 3.2 + speed * 2.4 : 0);   // short legs: quicker steps
      const swing = Math.sin(phase) * (.3 + run * .2) * stride * (1 - sitK) * (1 - glideK);
      legL.rotation.x = swing - sitK * 1.45 + glideK * Math.sin(t * 1.3) * .15;
      legR.rotation.x = -swing - sitK * 1.45 + glideK * Math.sin(t * 1.3 + 1) * .15;
      // Wings swing a little and flap out when running; up on the risers when gliding.
      armL.rotation.x = -swing * .6 - glideK * 2.7 + sitK * .3;
      armR.rotation.x = swing * .6 - glideK * 2.7 + sitK * .3;
      const flap = run * (.35 + Math.sin(phase * 2) * .25);
      armL.rotation.z = -glideK * .25 - flap - .12; armR.rotation.z = glideK * .25 + flap + .12;
      // The waddle: a roll from foot to foot and a bob; settle onto a seat; lean into a run.
      body.position.y = Math.abs(Math.cos(phase)) * .05 * stride * (1 - sitK) - sitK * .2;
      body.position.z = sitK * -.1;
      body.rotation.x = run * .18 * (1 - sitK);
      body.rotation.z = Math.sin(phase) * .13 * stride * (1 - sitK) * (1 - glideK);
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
      // Folded along the back when perched, spread only in the air.
      const fold = THREE.MathUtils.damp(wingL.scale.x, flying ? 1 : .35, 8, dt);
      wingL.scale.set(fold, 1, 1); wingR.scale.set(-fold, 1, 1);
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
