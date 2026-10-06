import * as THREE from 'three';
import {
  createGame, placeLanterns, buildCourse, throughRing, medalFor, FACTS, STAMPS,
  PICKUP_RADIUS, RING_RADIUS, RUN_COURSE,
} from './city-game.js';
import {EXTENT} from './city-arrival.js';

// The in-world half of 金陵拾遗: paper lanterns to find, a beacon over every
// landmark, and a course of rings for the kite. Everything is instanced or a
// handful of meshes, so the whole layer costs a few dozen draw calls at most.

const beamShader = {
  vertex: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
  fragment: `uniform vec3 uColor; uniform float uTime, uPower, uSeed; varying vec2 vUv;
    void main(){
      float rise = pow(1. - vUv.y, 1.7);
      float edge = 1. - abs(vUv.x - .5) * 0.; // the cylinder is open and viewed from outside
      float pulse = .78 + .22 * sin(uTime * 1.3 + uSeed * 6.28);
      float shimmer = .9 + .1 * sin(vUv.y * 38. - uTime * 2.2 + uSeed * 9.);
      gl_FragColor = vec4(uColor, rise * uPower * pulse * shimmer * .55 * edge);
    }`,
};

const COLOURS = {
  fresh: new THREE.Color(2.0, 1.25, 0.5),   // unvisited: warm gold
  partial: new THREE.Color(2.1, 0.85, 0.32), // some lanterns found: ember
  sealed: new THREE.Color(0.45, 1.7, 1.25), // sealed: jade
};

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,236,190,1)');
  grad.addColorStop(0.3, 'rgba(255,170,90,.55)');
  grad.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCityGame({scene, places, routes, ground, camera, shared, toast, storage, onChange}) {
  const game = createGame(storage);
  const $ = s => document.querySelector(s);
  const city = places.filter(p => p.id !== 'mufu');

  // --- lanterns -------------------------------------------------------------
  const lanterns = [];
  for (const p of city) {
    const walk = routes[p.route].points;
    placeLanterns(walk, p.avenue?.count || 0).forEach((position, index) => lanterns.push({id: p.id, index, position, phase: Math.random() * 6.28}));
  }
  const bodyGeo = new THREE.SphereGeometry(0.62, 14, 10); bodyGeo.scale(0.82, 1.1, 0.82);
  const capGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 10);
  const tasselGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5);
  const bodyMat = new THREE.MeshBasicMaterial({color: new THREE.Color(2.5, 0.95, 0.4)});
  const darkMat = new THREE.MeshBasicMaterial({color: new THREE.Color(0.32, 0.2, 0.1)});
  const bodies = new THREE.InstancedMesh(bodyGeo, bodyMat, lanterns.length);
  const caps = new THREE.InstancedMesh(capGeo, darkMat, lanterns.length * 2);
  const tassels = new THREE.InstancedMesh(tasselGeo, darkMat, lanterns.length);
  const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: haloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }), lanterns.length);
  for (const m of [bodies, caps, tassels, halos]) { m.frustumCulled = false; m.name = 'Keepsake lanterns'; scene.add(m); }
  const dummy = new THREE.Object3D(), halo = new THREE.Object3D();
  const picked = new Set();
  const key = l => `${l.id}:${l.index}`;
  lanterns.forEach(l => { if (game.has(l.id, l.index)) picked.add(key(l)); });

  function drawLanterns(t) {
    camera.updateMatrixWorld();
    lanterns.forEach((l, i) => {
      const gone = picked.has(key(l));
      const bob = Math.sin(t * 1.6 + l.phase) * 0.12, sway = Math.sin(t * 0.9 + l.phase) * 0.05;
      const s = gone ? 0 : 1;
      dummy.position.set(l.position[0], l.position[1] + bob, l.position[2]);
      dummy.rotation.set(sway, t * 0.4 + l.phase, 0); dummy.scale.setScalar(s); dummy.updateMatrix();
      bodies.setMatrixAt(i, dummy.matrix);
      for (const [k, dy] of [[0, 0.62], [1, -0.62]]) {
        dummy.position.set(l.position[0], l.position[1] + bob + dy, l.position[2]); dummy.updateMatrix(); caps.setMatrixAt(i * 2 + k, dummy.matrix);
      }
      dummy.position.set(l.position[0], l.position[1] + bob - 1.15, l.position[2]); dummy.updateMatrix(); tassels.setMatrixAt(i, dummy.matrix);
      halo.position.set(l.position[0], l.position[1] + bob, l.position[2]);
      halo.quaternion.copy(camera.quaternion);
      halo.scale.setScalar(gone ? 0 : 5.2 + Math.sin(t * 2.1 + l.phase) * 0.5); halo.updateMatrix();
      halos.setMatrixAt(i, halo.matrix);
    });
    for (const m of [bodies, caps, tassels, halos]) m.instanceMatrix.needsUpdate = true;
  }

  // --- beacons --------------------------------------------------------------
  const beams = city.map((p, i) => {
    const h = Math.min(150, Math.max(60, (EXTENT[p.id]?.h || 30) + 42));
    const geo = new THREE.CylinderGeometry(1.5, 1.5, h, 18, 1, true); geo.translate(0, h / 2, 0);
    const mat = new THREE.ShaderMaterial({
      uniforms: {uColor: {value: COLOURS.fresh.clone()}, uTime: shared.time, uPower: {value: 1}, uSeed: {value: i / city.length}},
      vertexShader: beamShader.vertex, fragmentShader: beamShader.fragment,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.position[0], Math.max(ground(p.position[0], p.position[2]), p.position[1]) - 1, p.position[2]);
    mesh.name = `Beacon | ${p.id}`; mesh.renderOrder = 4; scene.add(mesh);
    return {id: p.id, mesh, mat};
  });
  function tintBeams() {
    for (const b of beams) {
      const target = game.stamped(b.id) ? COLOURS.sealed : game.count(b.id) ? COLOURS.partial : COLOURS.fresh;
      b.mat.uniforms.uColor.value.copy(target);
      b.mat.uniforms.uPower.value = game.stamped(b.id) ? 0.55 : 1;
    }
  }

  // --- pickup bursts --------------------------------------------------------
  const bursts = [];
  const burstGeo = new THREE.BufferGeometry();
  burstGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
  function burst(position) {
    const pts = new THREE.Points(burstGeo.clone(), new THREE.PointsMaterial({
      color: new THREE.Color(2.4, 1.5, 0.6), size: 0.7, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false,
    }));
    pts.position.fromArray(position); pts.frustumCulled = false; pts.userData = {age: 0, dirs: Array.from({length: 14}, () => new THREE.Vector3(Math.random() - .5, Math.random() * .8, Math.random() - .5).normalize().multiplyScalar(2 + Math.random() * 3))};
    scene.add(pts); bursts.push(pts);
  }
  function updateBursts(dt) {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.userData.age += dt;
      const a = b.userData.age, p = b.geometry.attributes.position;
      b.userData.dirs.forEach((d, k) => p.setXYZ(k, d.x * a, d.y * a - a * a * 0.8, d.z * a));
      p.needsUpdate = true; b.material.opacity = Math.max(0, 1 - a / 0.9);
      if (a > 0.9) { scene.remove(b); b.geometry.dispose(); b.material.dispose(); bursts.splice(i, 1); }
    }
  }

  // --- HUD ------------------------------------------------------------------
  let factTimer = 0, sealTimer = 0, currentId = null;
  const placeById = new Map(places.map(p => [p.id, p]));
  function hud() {
    const total = STAMPS.length;
    $('#game-seals').textContent = `印 ${game.stampCount()}/${total}`;
    const here = currentId && STAMPS.includes(currentId) && currentId !== 'mufu' ? currentId : null;
    $('#game-lanterns').textContent = here ? `灯 ${game.count(here)}/3` : '灯 ·';
    $('#game-lanterns').classList.toggle('done', !!here && game.stamped(here));
    $('#game-chip').hidden = false;
  }
  function showFact(id, index, fact, count, seal) {
    const p = placeById.get(id);
    $('#fact-title').textContent = `${p.zh} · ${p.name}`;
    $('#fact-text').textContent = fact.t;
    let host = '';
    try { host = new URL(fact.src).hostname.replace(/^www\./, ''); } catch { host = ''; }
    $('#fact-source').textContent = fact.look ? 'Look for this' : `Source · ${host}`;
    $('#fact-dots').innerHTML = [0, 1, 2].map(i => `<i class="${game.has(id, i) ? 'on' : ''}"></i>`).join('');
    const card = $('#fact-card'); card.hidden = false; card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
    factTimer = 7.5;
  }
  function showSeal(id) {
    const p = placeById.get(id), rank = game.rank();
    $('#seal-name').textContent = p.zh;
    $('#seal-sub').textContent = `${p.name} · seal ${game.stampCount()} of ${STAMPS.length}${rank.toNext === 0 ? '' : ''}`;
    const el = $('#seal-moment'); el.hidden = false; el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    sealTimer = 4.2;
  }
  game.on(e => {
    // "Clear my progress" must bring every lantern back, not leave them hidden
    // until the next reload because the view still thinks they are collected.
    if (e.type === 'reset') {
      picked.clear();
      if (run.active) api.cancelRun('Progress cleared');
    }
    if (e.type === 'seal') setTimeout(() => showSeal(e.id), 900);
    if (e.type === 'lantern' || e.type === 'seal' || e.type === 'run' || e.type === 'reset') { tintBeams(); onChange?.(e); }
  });

  // --- the ring run ---------------------------------------------------------
  const heights = Object.fromEntries(Object.entries(EXTENT).map(([k, v]) => [k, v.h]));
  const course = buildCourse(places, ground, heights);
  const ringGroup = new THREE.Group(); ringGroup.visible = false; ringGroup.name = 'Wind run rings'; scene.add(ringGroup);
  const ringGeo = new THREE.TorusGeometry(RING_RADIUS, 0.9, 10, 56);
  const ringMeshes = course.rings.map((r, i) => {
    const mat = new THREE.MeshBasicMaterial({color: new THREE.Color(0.5, 0.6, 0.6), transparent: true, opacity: 0.55, depthWrite: false, fog: false});
    const m = new THREE.Mesh(ringGeo, mat);
    m.position.fromArray(r.position); m.rotation.y = Math.atan2(r.facing[0], r.facing[1]);
    m.renderOrder = 5; ringGroup.add(m); return m;
  });
  const run = {active: false, next: 0, start: 0, elapsed: 0, countdown: 0, result: null};
  function paintRings(t) {
    ringMeshes.forEach((m, i) => {
      const done = i < run.next, active = i === run.next, mat = m.material;
      if (done) { mat.color.setRGB(0.3, 1.2, 0.9); mat.opacity = 0.18; m.scale.setScalar(0.92); }
      else if (active) { mat.color.setRGB(2.4, 1.6, 0.6); mat.opacity = 0.95; m.scale.setScalar(1 + Math.sin(t * 4) * 0.045); }
      else { mat.color.setRGB(0.7, 0.8, 0.8); mat.opacity = 0.42; m.scale.setScalar(1); }
    });
  }
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
  function runHud() {
    const chip = $('#game-run');
    chip.hidden = !run.active;
    if (run.active) chip.textContent = run.countdown > 0 ? `◎ ${Math.ceil(run.countdown)}` : `◎ ${run.next}/${course.rings.length} · ${fmt(run.elapsed)}`;
  }

  const api = {
    game, course, lanterns, beams, run,
    get currentId() { return currentId; },
    setCurrent(id) { if (id !== currentId) { currentId = id; hud(); } },
    refresh() { hud(); tintBeams(); },
    startRun() {
      const first = course.rings[0], dir = first.facing;
      run.active = true; run.next = 0; run.elapsed = 0; run.countdown = 2.4; run.result = null;
      ringGroup.visible = true;
      // Start 80 units before the first ring, climbing towards it.
      const start = [first.position[0] - dir[0] * 80, first.position[1] + 4, first.position[2] - dir[1] * 80];
      toast('Wind run · fly through the glowing rings · Shift for speed');
      return {position: start, look: first.position};
    },
    cancelRun(message = 'Wind run ended') { if (!run.active) return; run.active = false; ringGroup.visible = false; runHud(); toast(message); },
    nearestLantern(pos, radius = PICKUP_RADIUS * 4) {
      let best = null;
      for (const l of lanterns) {
        if (picked.has(key(l))) continue;
        const d = Math.hypot(l.position[0] - pos[0], l.position[1] - pos[1], l.position[2] - pos[2]);
        if (d < radius && (!best || d < best.d)) best = {l, d};
      }
      return best;
    },
    update(dt, t, {flying}) {
      drawLanterns(t);
      updateBursts(dt);
      if (factTimer > 0 && (factTimer -= dt) <= 0) $('#fact-card').classList.remove('show');
      if (sealTimer > 0 && (sealTimer -= dt) <= 0) $('#seal-moment').classList.remove('show');
      const pos = camera.position;
      if (!flying) {
        // Lanterns hang at chest height on the road; reach them on foot.
        for (const l of lanterns) {
          if (picked.has(key(l))) continue;
          const dx = l.position[0] - pos.x, dz = l.position[2] - pos.z;
          if (dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS && Math.abs(l.position[1] - pos.y) < 4) {
            const r = game.collect(l.id, l.index);
            picked.add(key(l));
            if (r.fresh) { burst(l.position); showFact(l.id, l.index, r.fact, r.count, r.seal); hud(); }
          }
        }
      }
      if (run.active) {
        if (run.countdown > 0) { run.countdown -= dt; if (run.countdown <= 0) { run.start = t; run.elapsed = 0; toast('Go!'); } }
        else {
          run.elapsed = t - run.start;
          const ring = course.rings[run.next];
          if (flying && ring && throughRing(pos.toArray(), ring)) {
            burst(ring.position); run.next++;
            if (run.next >= course.rings.length) {
              run.active = false;
              const result = game.recordRun(run.elapsed, course.length);
              run.result = result;
              toast(`Wind run complete · ${fmt(run.elapsed)}${result.medal ? ' · ' + result.medal : ''}${result.personalBest ? ' · best' : ''}`);
              setTimeout(() => { ringGroup.visible = false; }, 1800);
            }
          }
        }
        paintRings(t);
      }
      runHud();
    },
    destroy() { scene.remove(bodies, caps, tassels, halos, ringGroup, ...beams.map(b => b.mesh)); },
  };
  tintBeams(); hud();
  return api;
}
