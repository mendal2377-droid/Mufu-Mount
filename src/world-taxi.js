import * as THREE from 'three';
import {loadCarModels, carModel} from './traffic-models.js';
import {fare, tip} from './taxi-fare.js';

// Nanjing's lemon-yellow taxis, to drive (design/TAXI-PLAN.md). Parked ones at the OSM taxi rank at
// Xinjiekou; H hails one to the nearest kerb; F gets in and out. In the taxi, fares
// wait at the real bus stops and metro stations (transit.json): stop beside the waving passenger, take
// them where they ask, stop there and be paid the metered fare (src/taxi-fare.js), and a tip for a
// quick trip. Nothing is ever hit: the taxi slows behind a car, a rider or a walker ahead.

export const YELLOW = 0xf2cf3a;           // 柠檬黄 lemon yellow, Nanjing's taxis since July 2014
export const SAVE_KEY = 'mufu-taxi-v1';
// Where taxis stand at first, [x east, north]: the one taxi rank OSM maps in the core (way 1511458439,
// amenity=taxi, on Zhongshan South Road at Xinjiekou by the Xinbai store; the middle of its outline),
// two taxis there, one behind the other.
const RANKS = {core: [[-434, 53], [-434, 41]]};
const NEAR = 4.5;          // metres from the taxi's middle to get in
const BOARD = 9;           // metres from a passenger to stop for them
const ARRIVE = 25;         // metres from the destination to stop there
const FARE_MIN = 600, FARE_MAX = 2000;   // straight-line metres of a trip (ours: a few minutes' drive)

export async function createWorldTaxi({world, nav, toast = () => {}, storage = null}) {
  const transit = await fetch(`/scenes/${world.id}/transit.json`).then(r => (r.ok ? r.json() : null)).catch(() => null);
  const stops = [];
  for (const l of transit?.lines || []) for (const st of l.stops) {
    if (!stops.some(s => s.name === st.name && Math.hypot(s.x - st.at[0], s.z + st.at[1]) < 60))
      stops.push({en: st.en, name: st.name, x: st.at[0], z: -st.at[1], metro: l.kind === 'metro'});
  }

  // --- The model: the traffic's taxi body (Kenney's Car Kit) in lemon yellow --------------------------
  const toon = (c, vc = false) => new THREE.MeshToonMaterial({color: c, gradientMap: world.bands || null, vertexColors: vc});
  const models = await loadCarModels().catch(() => null);
  const m = models?.taxi || carModel('taxi');
  const paint = toon(YELLOW), trim = toon(0xffffff, true), plate = toon(0x2457b8);
  // The roof sign: white, "TAXI" in blue (2014: ordinary taxis' signs white with blue lettering).
  const sign = (() => {
    const c = document.createElement('canvas'); c.width = 128; c.height = 40;
    const x = c.getContext('2d'); x.fillStyle = '#f7f5ee'; x.fillRect(0, 0, 128, 40);
    x.fillStyle = '#1f4fa8'; x.font = '700 26px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('TAXI 出租', 64, 21);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshBasicMaterial({map: tex, fog: true});
  })();
  const roof = m.paint.boundingBox || (m.paint.computeBoundingBox(), m.paint.boundingBox);
  function makeTaxi() {
    const gr = new THREE.Group();
    gr.add(new THREE.Mesh(m.paint, paint), new THREE.Mesh(m.trim, trim), new THREE.Mesh(m.plates, plate));
    const s = new THREE.Mesh(new THREE.BoxGeometry(.62, .22, .26), [sign, sign, toon(0xf7f5ee), toon(0xf7f5ee), sign, sign]);
    s.position.set(0, roof.max.y + .1, (roof.max.z + roof.min.z) / 2 - .2);
    gr.add(s);
    gr.traverse(o => { if (o.isMesh) o.castShadow = true; });
    gr.name = 'Taxi';
    world.scene.add(gr);
    return gr;
  }

  // Taxis standing: {x, z, heading, mesh}; the one being driven is `mine`.
  const parked = [];
  let mine = null, was = world.vehicle;
  // A road point moved out to the kerb on its right (traffic keeps right): the road's edge, less 1.3 m,
  // out of the moving lanes.
  function toKerb(x, z, heading) {
    const rx = -Math.cos(heading), rz = Math.sin(heading);
    let d = 0;
    while (d < 14 && world.grid.road(x + rx * (d + .5), z + rz * (d + .5)) !== null) d += .5;
    const k = Math.max(0, d - 1.3);
    return [x + rx * k, z + rz * k];
  }
  function park(x, z, heading, mesh = makeTaxi()) {
    [x, z] = toKerb(x, z, heading);
    const y = world.grid.road(x, z) ?? world.grid.height(x, z) ?? 0;
    mesh.position.set(x, y, z); mesh.rotation.set(0, heading, 0); mesh.visible = true;
    const t = {x, z, heading, mesh};
    parked.push(t);
    return t;
  }
  for (const [x, n] of RANKS[world.id] || []) {
    const r = nav.nearestRoad(x, -n, {maxD: 60});
    if (r) park(r.x, r.z, r.heading);
  }

  // --- Fares ---------------------------------------------------------------------------------------
  const MAN = (() => {
    const gr = new THREE.Group();
    const coat = toon(0x3b5e8c), skin = toon(0xe8c39e), dark = toon(0x2b2b30);
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(.24, .7, 3, 8), coat); body.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(.15, 12, 10), skin); head.position.y = 1.65;
    const hair = new THREE.Mesh(new THREE.SphereGeometry(.155, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), dark); hair.position.y = 1.68;
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .55, 3, 6), dark); legs.position.y = .4; legs.scale.x = 2;
    const arm = new THREE.Group(); arm.position.set(.26, 1.38, 0);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(.06, .5, 3, 6), coat); a.position.y = .3; arm.add(a);
    gr.add(body, head, hair, legs, arm);
    gr.userData.arm = arm;
    gr.traverse(o => { if (o.isMesh) o.castShadow = true; });
    gr.visible = false; gr.name = 'Taxi fare';
    world.scene.add(gr);
    return gr;
  })();
  // A column of light over the passenger and over the destination, seen from far off.
  const beam = (color) => {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 60, 20, 1, true),
      new THREE.MeshBasicMaterial({color, transparent: true, opacity: .28, depthWrite: false, side: THREE.DoubleSide, fog: false}));
    b.geometry.translate(0, 30, 0); b.visible = false; b.renderOrder = 3; b.name = 'Taxi beacon';
    world.scene.add(b);
    return b;
  };
  const pickBeam = beam(0xffd84a), dropBeam = beam(0x6fd38a);

  let job = null;       // {stage: 'pickup' | 'ride', from, to, man: [x, z], km, t0, route}
  let nextOffer = 0;
  const book = (() => { try { return JSON.parse(storage?.getItem(SAVE_KEY) || 'null') || {fares: 0, takings: 0, tips: 0, best: 0}; } catch { return {fares: 0, takings: 0, tips: 0, best: 0}; } })();
  const save = () => { try { storage?.setItem(SAVE_KEY, JSON.stringify(book)); } catch { /* storage blocked: kept for this visit */ } };

  // A stop's kerb: walkable ground off the carriageway, beside the road point nearest the stop.
  function kerb(st) {
    const r = nav.nearestRoad(st.x, st.z, {maxD: 60});
    if (!r) return null;
    const sx = Math.cos(r.heading), sz = -Math.sin(r.heading);
    for (const d of [4, 5.5, 7, -4, -5.5, -7]) {
      const x = r.x + sx * d, z = r.z + sz * d;
      if (world.grid.height(x, z) !== null && world.grid.road(x, z) === null) return {road: r, man: [x, z]};
    }
    return {road: r, man: [r.x + sx * 4, r.z + sz * 4]};
  }
  function offer(t) {
    const b = world.body;
    const near = stops.map(s => ({s, d: Math.hypot(s.x - b.x, s.z - b.z)})).filter(o => o.d > 150 && o.d < 800).sort(() => Math.random() - .5);
    for (const {s} of near.slice(0, 8)) {
      const k = kerb(s);
      if (!k || !nav.driveRoute(b.x, b.z, k.road.x, k.road.z)) continue;
      job = {stage: 'pickup', from: s, k, t0: t};
      MAN.position.set(k.man[0], world.grid.height(...k.man) ?? k.road.y ?? b.y, k.man[1]);
      MAN.rotation.y = Math.atan2(k.road.x - k.man[0], k.road.z - k.man[1]);
      MAN.visible = true;
      pickBeam.position.copy(MAN.position); pickBeam.visible = true;
      nav.markers.length = 0; nav.markers.push({x: k.man[0], z: k.man[1], color: '#e9b821'});
      const r = nav.setWaypoint(k.road.x, k.road.z, {label: `Fare at ${s.en}`, car: true}); if (r) r.keep = true;
      toast(`A fare is waving at ${s.en} ${s.name} · ${nav.fmt(Math.hypot(s.x - b.x, s.z - b.z))} · follow the gold arrows`);
      return true;
    }
    return false;
  }
  function board(t) {
    const b = world.body, from = job.from;
    const far = stops.map(s => ({s, d: Math.hypot(s.x - from.x, s.z - from.z)})).filter(o => o.d > FARE_MIN && o.d < FARE_MAX && o.s.name !== from.name).sort(() => Math.random() - .5);
    for (const {s} of far.slice(0, 10)) {
      const k = kerb(s);
      if (!k) continue;
      const r = nav.driveRoute(b.x, b.z, k.road.x, k.road.z);
      if (!r) continue;
      MAN.visible = false; pickBeam.visible = false;
      job = {stage: 'ride', from, to: s, k, km: 0, t0: t, routeM: r.length, last: [b.x, b.z]};
      dropBeam.position.set(k.road.x, world.grid.road(k.road.x, k.road.z) ?? b.y, k.road.z); dropBeam.visible = true;
      nav.markers.length = 0; nav.markers.push({x: k.road.x, z: k.road.z, color: '#3fae63'});
      const w = nav.setWaypoint(k.road.x, k.road.z, {label: `${s.en} ${s.name}`, car: true}); if (w) w.keep = true;
      toast(`"${s.en}${s.metro ? ' metro station' : ''}, please." ${s.name} · ${nav.fmt(r.length)} by road · the meter is running`);
      return true;
    }
    toast('The passenger changes their mind and waves you on');
    cancel();
    return false;
  }
  function pay(t, hour) {
    const km = job.km / 1000, f = fare(km, hour), tp = tip(f, t - job.t0, job.routeM);
    book.fares++; book.takings = Math.round((book.takings + f + tp) * 10) / 10; book.tips += tp; book.best = Math.max(book.best, f + tp);
    save();
    toast(`Thank you! ¥${f.toFixed(1)} for ${km.toFixed(1)} km${tp ? ` and a ¥${tp} tip` : ''} · ${book.fares} fare${book.fares > 1 ? 's' : ''}, ¥${book.takings.toFixed(1)} taken`);
    cancel();
    nextOffer = t + 6;
  }
  function cancel() {
    job = null; MAN.visible = false; pickBeam.visible = false; dropBeam.visible = false;
    nav.markers.length = 0;
    if (nav.route?.keep) nav.clear();
  }

  // --- The meter ------------------------------------------------------------------------------------
  const meter = document.createElement('div');
  meter.id = 'taxi-meter'; meter.hidden = true; meter.setAttribute('role', 'status');
  document.body.append(meter);
  function showMeter(hour) {
    if (world.vehicle !== 'car') { meter.hidden = true; return; }
    meter.hidden = false;
    const b = world.body;
    if (job?.stage === 'ride') {
      const left = Math.hypot(job.k.road.x - b.x, job.k.road.z - b.z);
      meter.innerHTML = `<b>¥${fare(job.km / 1000, hour).toFixed(1)}</b><span>${(job.km / 1000).toFixed(2)} km</span><small>To ${job.to.en} ${job.to.name} · ${nav.fmt(left)}</small>`;
    } else if (job?.stage === 'pickup') {
      meter.innerHTML = `<b>空车</b><span>For hire</span><small>Fare waiting at ${job.from.en} · ${nav.fmt(Math.hypot(job.k.road.x - b.x, job.k.road.z - b.z))}</small>`;
    } else meter.innerHTML = `<b>空车</b><span>For hire</span><small>${book.fares ? `${book.fares} fares · ¥${book.takings.toFixed(1)}` : 'Looking for a fare…'}</small>`;
  }

  // --- Not hitting anything ---------------------------------------------------------------------------
  let obstacles = [], obsT = -1;
  function gather(t) {
    if (t - obsT < .09) return;   // every frame at 10 frames a second and up
    obsT = t;
    const b = world.body, out = [];
    // [x, z, half its width]: a car 0.9 m, an e-bike or a cyclist 0.35 m, a walker 0.25 m.
    for (const src of [world.traffic, world.people, world.cyclists]) {
      if (!src?.positions) continue;
      const walkers = src === world.people;
      for (const p of src.positions()) {
        const x = p.length === 4 ? p[1] : p.length === 3 ? p[0] : p[1], z = p.length === 4 ? p[3] : p.length === 3 ? p[2] : p[3];
        const half = walkers ? .25 : p.length === 4 && p[0] === 'car' ? .9 : .35;
        // Walkers only on the carriageway (crossing it): the taxi waited for good for people standing
        // on a pavement that came within 2 m of its line by a stop.
        if (Math.abs(x - b.x) < 45 && Math.abs(z - b.z) < 45 && (!walkers || world.grid.road(x, z) !== null)) out.push([x, z, half]);
      }
    }
    if (MAN.visible) out.push([MAN.position.x, MAN.position.z, .25]);
    obstacles = out;
  }
  // The most the taxi may go: what stops it 5.5 m (middle to middle) behind anything on its line ahead,
  // braking at 6 m/s2. On its line: within the taxi's half width (0.9 m), the other's own half width and
  // 0.3 m to spare (an e-bike 2 m aside in its lane held the taxi for good at a junction, 27 Nov).
  // One that has stood still in front for 4 s (an e-bike that cut in under the taxi's nose, held by
  // the taxi as the taxi is held by it) is let be: the taxi creeps past it, as a driver would.
  let holder = null, heldSince = 0, ignore = [];
  world.carLimit = (x, z, h, v) => {
    if (v <= 0) return Infinity;
    const fx = Math.sin(h), fz = Math.cos(h), now = clock;
    let lim = Infinity, by = null;
    for (const [ox, oz, half] of obstacles) {
      if (ignore.some(q => now < q.until && Math.hypot(q.x - ox, q.z - oz) < 1)) continue;
      const dx = ox - x, dz = oz - z, f = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (f < 0 || f > 45 || side > 1.2 + half) continue;
      const l = Math.sqrt(12 * Math.max(0, f - 5.5));
      if (l < lim) { lim = l; by = [ox, oz]; }
    }
    // (Only one already under the nose, within 3.5 m middle to middle: a car queued ahead is waited for;
    // at 4.5 m the taxi crept into a stopped e-bike.)
    if (lim < .5 && by && Math.hypot(by[0] - x, by[1] - z) < 3.5) {
      if (!holder || Math.hypot(holder[0] - by[0], holder[1] - by[1]) > .5) { holder = by; heldSince = now; }
      else if (now - heldSince > 4) { ignore.push({x: by[0], z: by[1], until: now + 10}); holder = null; return 2; }
    } else holder = null;
    ignore = ignore.filter(q => now < q.until);
    return lim;
  };
  let clock = 0;

  const taxi = {
    get parked() { return parked; },
    get job() { return job; },
    get book() { return book; },
    /** A taxi to get into within NEAR m of the traveller. */
    near() {
      const b = world.body;
      return parked.find(p => Math.hypot(p.x - b.x, p.z - b.z) < NEAR) || null;
    },
    /** Hail: a taxi pulls in at the nearest kerb 10-60 m away. */
    hail() {
      if (world.vehicle === 'car') return 'You are driving one';
      const b = world.body;
      const r = nav.nearestRoad(b.x, b.z, {minD: 8, maxD: 70});
      if (!r) return 'No road near here to hail a taxi from';
      // One hailed taxi at a time: an earlier one drives off.
      const old = parked.find(p => p.hailed);
      if (old) { parked.splice(parked.indexOf(old), 1); world.scene.remove(old.mesh); }
      const t = park(r.x, r.z, r.heading);
      t.hailed = true;
      return `A taxi pulls in ${Math.round(r.d)} m away · walk to it and press F`;
    },
    enter(p) {
      const msg = world.setVehicle('car', {x: p.x, z: p.z, heading: p.heading});
      if (!msg) return null;
      parked.splice(parked.indexOf(p), 1);
      mine = p.mesh; was = 'car';
      nextOffer = 0;
      return msg;
    },
    exit() {
      const msg = world.setVehicle('walk');
      return msg;
    },
    stats: {ms: 0},
    update(t, dt, hour) {
      const t0 = performance.now();
      clock = t;
      // The traveller got out (F, a number key, or arriving somewhere): the taxi is left parked.
      if (was === 'car' && world.vehicle !== 'car') {
        if (mine) { parked.push({x: mine.position.x, z: mine.position.z, heading: mine.rotation.y, mesh: mine}); mine = null; }
        if (job) { toast(job.stage === 'ride' ? 'The passenger gets out and walks on: no fare' : 'The fare finds another taxi'); cancel(); }
      }
      was = world.vehicle;
      if (world.vehicle === 'car' && mine) {
        const b = world.body;
        mine.position.set(b.x, b.y, b.z); mine.rotation.set(0, world.heading, 0);
        gather(t);
        if (!job && t > nextOffer) { if (!offer(t)) nextOffer = t + 5; }
        const v = Math.abs(world.vspeed);
        if (job?.stage === 'pickup' && Math.hypot(MAN.position.x - b.x, MAN.position.z - b.z) < BOARD && v < 1.5) board(t);
        else if (job?.stage === 'ride') {
          job.km += Math.hypot(b.x - job.last[0], b.z - job.last[1]); job.last = [b.x, b.z];
          if (Math.hypot(job.k.road.x - b.x, job.k.road.z - b.z) < ARRIVE && v < 1.5) pay(t, hour);
        }
      } else if (job) cancel();
      if (world.traffic) world.traffic.obstacle = world.vehicle === 'car' ? {x: world.body.x, z: world.body.z, v: world.vspeed, heading: world.heading} : null;
      if (MAN.visible) MAN.userData.arm.rotation.z = -2.4 + Math.sin(t * 7) * .45;
      pickBeam.material.opacity = dropBeam.material.opacity = .22 + Math.sin(t * 2.4) * .06;
      showMeter(hour);
      taxi.stats.ms = performance.now() - t0;
    },
    show(on) { if (!on) meter.hidden = true; },
  };
  return taxi;
}
