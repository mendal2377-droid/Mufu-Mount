import * as THREE from 'three';
import {buildGraph, shortest, nearestNode, nearestReachable, offRoute, waysFrom} from './nav-graph.js';

// The map: a round minimap in the lower left that turns with the traveller (a click on it opens the big
// map, src/atlas-map.js), with the buses and metro marked, and a route to a waypoint on the mapped roads and paths, led on the
// ground by gold chevrons (design/TAXI-PLAN.md). The routes are src/nav-graph.js's; the roads and
// paths are OSM's (streets.json, paths.json); water and walkable ground are the world's own grids.

const OFF = 35;            // metres off the route before it is worked out again
const AHEAD = 320;         // chevrons along the next metres of the route
const GAP = 7;             // metres between chevrons
const MINI = 190;          // minimap size, CSS pixels
const ROAD_W = {motorway: 5, trunk: 4.5, primary: 4, secondary: 3.4, tertiary: 2.8, motorway_link: 3, trunk_link: 3, primary_link: 3, secondary_link: 2.6, tertiary_link: 2.4};
const C = {land: '#ebe3cf', water: '#8fb8d6', park: '#cfdcae', road: '#ffffff', roadEdge: '#c9bea6', path: '#d9cdb2', route: '#e2a93b', me: '#c0392b'};

export async function createWorldNav({world, toast = () => {}}) {
  const [streets, paths] = await Promise.all(['streets', 'paths'].map(n =>
    fetch(`/scenes/${world.id}/${n}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null)));
  if (!streets) return null;
  const g = world.grid;

  // The car's graph at once (half a second); the walker's, with the paths, when first asked for.
  // Bridges: a road's loose end is joined across when the walk grid carries road all the way.
  const drivable = (x0, z0, x1, z1) => {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2);
    for (let i = 1; i < n; i++) if (g.road(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n) === null) return false;
    return true;
  };
  // Each road edge as the world built it: carriageway along it, with no stretch over 8 m without (a
  // junction's crossing is paved over the road in places).
  const carCheck = (x0, z0, x1, z1) => {
    const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 2));
    let gap = 0;
    for (let i = 0; i <= n; i++) {
      if (g.road(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n) === null) { gap += L / n; if (gap > 8) return false; } else gap = 0;
    }
    return true;
  };
  const carGraph = buildGraph(waysFrom(streets, null), {drivable, carCheck});
  let walkGraph = null;
  const graphFor = (car) => car ? carGraph : (walkGraph ||= buildGraph(waysFrom(streets, paths), {drivable}));

  // Roads and paths for drawing, by 100 m cell: [x0, z0, x1, z1, width, isPath].
  const cells = new Map();
  const addLine = (pts, w, isPath) => {
    for (let i = 1; i < pts.length; i++) {
      const [ax, az] = pts[i - 1], [bx, bz] = pts[i];
      const k = `${Math.floor((ax + bx) / 200)},${Math.floor((az + bz) / 200)}`;
      (cells.get(k) || cells.set(k, []).get(k)).push([ax, az, bx, bz, w, isPath]);
    }
  };
  for (const [cls, , , f] of streets.ways) { const p = []; for (let i = 0; i < f.length; i += 2) p.push([f[i], f[i + 1]]); addLine(p, ROAD_W[streets.classes[cls]] || 2, false); }
  for (const [, , f] of paths?.ways || []) { const p = []; for (let i = 0; i < f.length; i += 2) p.push([f[i], f[i + 1]]); addLine(p, 1.2, true); }

  // --- The route -------------------------------------------------------------------------------
  let route = null;   // {pts, length, target: [x, z], label, car}
  let checkAt = 0;
  function plan(tx, tz, {label = 'Waypoint', car = world.vehicle === 'car'} = {}) {
    const gr = graphFor(car), b = world.body;
    const a = nearestNode(gr, b.x, b.z, {car, radius: 150}), e = nearestNode(gr, tx, tz, {car, radius: 300});
    // A goal the ways do not reach (in the lake, a courtyard): the nearest point they do.
    let r = shortest(gr, a, e, {car});
    if (!r && a !== null) r = shortest(gr, a, nearestReachable(gr, a, tx, tz, {car}), {car});
    if (!r) { route = {pts: [[b.x, b.z], [tx, tz]], length: Math.hypot(tx - b.x, tz - b.z), target: [tx, tz], label, car, straight: true}; return route; }
    const pts = [[b.x, b.z], ...r.pts], lanes = [r.lanes[0] ?? 0, ...r.lanes];
    if (Math.hypot(tx - r.pts.at(-1)[0], tz - r.pts.at(-1)[1]) > 3) { pts.push([tx, tz]); lanes.push(0); }
    route = {pts, lanes, length: r.length + Math.hypot(r.pts[0][0] - b.x, r.pts[0][1] - b.z), target: [tx, tz], label, car, straight: false};
    return route;
  }

  // --- Chevrons on the ground ---------------------------------------------------------------------
  const chevGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(-1.1, -.5); s.lineTo(0, .55); s.lineTo(1.1, -.5); s.lineTo(1.1, -1.05); s.lineTo(0, 0); s.lineTo(-1.1, -1.05); s.closePath();
    return new THREE.ShapeGeometry(s).rotateX(-Math.PI / 2);   // pointing +z... rotated below
  })();
  const chevMat = new THREE.MeshBasicMaterial({color: 0xf2b640, transparent: true, opacity: .85, depthWrite: false, fog: true});
  const MAXC = Math.ceil(AHEAD / GAP) + 2;
  const chevrons = new THREE.InstancedMesh(chevGeo, chevMat, MAXC);
  chevrons.name = 'Route chevrons'; chevrons.frustumCulled = false; chevrons.count = 0; chevrons.renderOrder = 2;
  world.scene.add(chevrons);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), P = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const ground = (x, z) => g.road(x, z) ?? g.height(x, z) ?? world.body.y;
  function drawChevrons(t) {
    if (!route) { chevrons.count = 0; return; }
    const b = world.body, {at} = offRoute(route.pts, b.x, b.z);
    let n = 0, left = AHEAD, carry = GAP * .6;
    // From the nearest point on the route onward.
    let [px, pz] = route.pts[at];
    for (let i = at + 1; i < route.pts.length && left > 0 && n < MAXC; i++) {
      const [qx, qz] = route.pts[i], L = Math.hypot(qx - px, qz - pz);
      if (L < 1e-6) continue;
      const ux = (qx - px) / L, uz = (qz - pz) / L;
      // Start where the traveller is along the first segment.
      let s = i === at + 1 ? Math.max(0, (b.x - px) * ux + (b.z - pz) * uz) + carry : carry;
      for (; s < L && n < MAXC && left > 0; s += GAP, left -= GAP) {
        // By car, in the lane a car keeps to (traffic keeps right): route.lanes, metres right of the line.
        const k = route.car ? route.lanes?.[i - 1] ?? 0 : 0, x = px + ux * s - uz * k, z = pz + uz * s + ux * k;
        P.set(x, ground(x, z) + .18 + Math.sin(t * 3 + n * .6) * .04, z);
        Q.setFromAxisAngle(UP, Math.atan2(ux, uz) + Math.PI);
        M.compose(P, Q, S); chevrons.setMatrixAt(n++, M);
      }
      carry = s - L; px = qx; pz = qz;
    }
    chevrons.count = n; chevrons.instanceMatrix.needsUpdate = true;
  }

  // --- The minimap ---------------------------------------------------------------------------------
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const mini = document.createElement('canvas');
  mini.id = 'minimap'; mini.width = mini.height = MINI * dpr; mini.title = 'Map · N'; mini.setAttribute('aria-label', 'Map (N)');
  mini.hidden = true;
  document.body.append(mini);
  const mc = mini.getContext('2d');
  // Water under the minimap: the world's water grid sampled round the traveller every half second.
  const WATER_R = 260, WATER_CELL = 6, wn = Math.ceil(WATER_R * 2 / WATER_CELL);
  const water = document.createElement('canvas'); water.width = water.height = wn;
  const wc = water.getContext('2d'), wimg = wc.createImageData(wn, wn);
  let waterAt = {x: Infinity, z: Infinity}, waterT = -1;
  function sampleWater(cx, cz) {
    const d = wimg.data;
    for (let j = 0; j < wn; j++) for (let i = 0; i < wn; i++) {
      const x = cx - WATER_R + (i + .5) * WATER_CELL, z = cz - WATER_R + (j + .5) * WATER_CELL, k = (j * wn + i) * 4;
      const wet = g.water(x, z) !== null, land = !wet && g.height(x, z) !== null;
      // Water blue; walkable ground a shade lighter than the land (parks, squares, pavements).
      const c = wet ? [143, 184, 214, 255] : land ? [241, 234, 214, 255] : [226, 217, 196, 255];
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = c[3];
    }
    wc.putImageData(wimg, 0, 0); waterAt = {x: cx, z: cz};
  }
  function linesIn(x0, z0, x1, z1, fn) {
    for (let i = Math.floor(x0 / 100); i <= Math.floor(x1 / 100); i++) for (let j = Math.floor(z0 / 100); j <= Math.floor(z1 / 100); j++)
      for (const l of cells.get(`${i},${j}`) || []) fn(l);
  }
  // Draw the world round (cx, cz) into ctx: `toScreen` maps world metres to the canvas.
  function drawRoads(ctx, x0, z0, x1, z1, scale) {
    ctx.lineCap = 'round';
    for (const pass of [0, 1, 2]) {
      linesIn(x0, z0, x1, z1, ([ax, az, bx, bz, w, isPath]) => {
        if (pass === 0 && isPath) return;
        if (pass === 2 && isPath) return;
        if (pass === 1 && !isPath) return;
        ctx.strokeStyle = pass === 0 ? C.roadEdge : pass === 1 ? C.path : C.road;
        ctx.lineWidth = Math.max((pass === 1 ? .8 : pass === 0 ? 2.4 : 1.4) * dpr / scale, pass === 0 ? w + 1.6 : w);
        ctx.beginPath(); ctx.moveTo(ax, az); ctx.lineTo(bx, bz); ctx.stroke();
      });
    }
  }
  function drawRoute(ctx, scale) {
    if (!route) return;
    ctx.strokeStyle = C.route; ctx.lineWidth = Math.max(4 * dpr / scale, 6); ctx.lineJoin = 'round';
    ctx.setLineDash(route.straight ? [8 * dpr / scale, 6 * dpr / scale] : []);
    ctx.beginPath(); route.pts.forEach(([x, z], i) => (i ? ctx.lineTo(x, z) : ctx.moveTo(x, z))); ctx.stroke();
    ctx.setLineDash([]);
  }
  function pin(ctx, x, z, scale, color, rot = 0) {
    ctx.save(); ctx.translate(x, z); ctx.rotate(rot); ctx.scale(dpr / scale, dpr / scale);
    ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, -14, 7, 0, Math.PI * 2); ctx.moveTo(-6, -11); ctx.lineTo(0, 0); ctx.lineTo(6, -11); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  const markers = [];   // extra pins from the taxi: {x, z, color}
  let miniT = 0;
  function drawMini(t) {
    if (mini.hidden) return;
    const b = world.body, R = world.vehicle === 'car' ? 230 : 150, scale = MINI * dpr / (R * 2);
    if (t - waterT > .5 || Math.hypot(b.x - waterAt.x, b.z - waterAt.z) > 60) { sampleWater(b.x, b.z); waterT = t; }
    const ctx = mc, W = MINI * dpr;
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.beginPath(); ctx.arc(W / 2, W / 2, W / 2 - 2 * dpr, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = C.land; ctx.fillRect(0, 0, W, W);
    // Heading up: the view turns with the traveller (the camera, when walking).
    // The map's up: the travelling direction (the camera's on foot), as a heading (atan2(x, z)).
    const cam = world.vehicle === 'walk' ? camYaw() - Math.PI : world.heading;
    ctx.translate(W / 2, W / 2); ctx.scale(scale, scale); ctx.rotate(cam - Math.PI); ctx.translate(-b.x, -b.z);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(water, waterAt.x - WATER_R, waterAt.z - WATER_R, WATER_R * 2, WATER_R * 2);
    const span = R * 1.5;
    drawRoads(ctx, b.x - span, b.z - span, b.x + span, b.z + span, scale);
    drawRoute(ctx, scale);
    for (const m of markers) pin(ctx, m.x, m.z, scale, m.color, -(cam - Math.PI));
    // Buses and the metro (the owner: make them obvious to take): each stop a blue square, each metro
    // entrance a ring in its line's colour, upright as the map turns.
    const tr = world.transit;
    if (tr) {
      const up = -(cam - Math.PI), near = (x, z) => Math.abs(x - b.x) < span && Math.abs(z - b.z) < span;
      for (const st of tr.stops || []) if (near(st.spot[0], st.spot[1])) {
        ctx.save(); ctx.translate(st.spot[0], st.spot[1]); ctx.rotate(up); ctx.scale(dpr / scale, dpr / scale);
        ctx.fillStyle = '#2f6fc0'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.fillRect(-5, -5, 10, 10); ctx.strokeRect(-5, -5, 10, 10);
        ctx.fillStyle = '#fff'; ctx.font = '700 8px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('B', 0, .5);
        ctx.restore();
      }
      for (const e of tr.entrances || []) if (near(e.spot[0], e.spot[1])) {
        ctx.save(); ctx.translate(e.spot[0], e.spot[1]); ctx.rotate(up); ctx.scale(dpr / scale, dpr / scale);
        ctx.fillStyle = '#fff'; ctx.strokeStyle = e.line.colour; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = e.line.colour; ctx.font = '800 8px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('M', 0, .5);
        ctx.restore();
      }
    }
    if (route) pin(ctx, route.target[0], route.target[1], scale, C.route, -(cam - Math.PI));
    ctx.restore();
    // The traveller: an arrow in the middle, pointing up; north marked on the rim.
    ctx.save(); ctx.translate(W / 2, W / 2);
    // The arrow: the traveller's heading against the map's up (the owner saw it point backwards on foot:
    // the camera's yaw is half a turn from a heading).
    const rel = world.vehicle === 'walk' ? world.heading - (camYaw() - Math.PI) : 0;
    ctx.save(); ctx.rotate(-rel + Math.PI - Math.PI);
    ctx.fillStyle = C.me; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * dpr;
    ctx.beginPath(); ctx.moveTo(0, -9 * dpr); ctx.lineTo(7 * dpr, 8 * dpr); ctx.lineTo(0, 4 * dpr); ctx.lineTo(-7 * dpr, 8 * dpr); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    const nAng = cam - Math.PI;   // where north (-z, heading pi) lies on the turned map, from up
    const r = W / 2 - 12 * dpr;
    ctx.fillStyle = '#2e3b33'; ctx.font = `700 ${12 * dpr}px system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('N', Math.sin(nAng) * r, -Math.cos(nAng) * r);
    ctx.restore();
    // The route's length left, under the map.
    miniT = t;
  }
  let camera = null;
  // On foot within 60 m of a metro entrance or a bus stop: a chip by the minimap says which, how far, and
  // that F rides from there (the owner: make the buses and metro obvious to take).
  const chip = document.createElement('div');
  chip.id = 'transit-hint'; chip.hidden = true; chip.setAttribute('role', 'status');
  document.body.append(chip);
  let chipKey = '';
  function transitHint() {
    const tr = world.transit, b = world.body;
    const n = !mini.hidden && tr && world.vehicle === 'walk' && !tr.busRide && !tr.metroRide ? tr.nearest(b.x, b.z, 60) : null;
    if (!n) { if (!chip.hidden) { chip.hidden = true; chipKey = ''; } return; }
    const here = n.d < 6, key = `${n.kind}${n.stop.name}${here}${Math.round(n.d / 10)}`;
    if (key === chipKey) return;
    chipKey = key; chip.hidden = false;
    chip.className = n.kind;
    chip.style.setProperty('--c', n.kind === 'metro' ? n.line.colour : '#2f6fc0');
    chip.innerHTML = n.kind === 'metro'
      ? `<i>M</i><span><b>${n.stop.en} ${n.stop.name}</b> ${n.line.en}<small>${here ? 'F to choose a station and ride' : `entrance ${Math.round(n.d / 5) * 5} m away`}</small></span>`
      : `<i>B</i><span><b>${n.stop.en} ${n.stop.name}</b> bus stop<small>${here ? 'F to choose a bus and ride' : `${Math.round(n.d / 5) * 5} m away`}</small></span>`;
  }
  const camYaw = () => (camera ? camera.rotation.y : world.heading + Math.PI);

  const fmt = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);

  const nav = {
    get route() { return route; },
    graphs: {car: carGraph, get walk() { return graphFor(false); }},
    markers,
    /** Set a waypoint and plan the route there (by road in the taxi, on foot otherwise). */
    setWaypoint(x, z, opts = {}) { return plan(x, z, opts); },
    clear() { route = null; chevrons.count = 0; },
    /** The nearest drivable road point to (x, z) between minD and maxD metres away: {x, z, heading}. */
    nearestRoad(x, z, {minD = 0, maxD = 80} = {}) {
      let best = null;
      const r = Math.ceil(maxD / 50);
      for (let i = Math.floor(x / 50) - r; i <= Math.floor(x / 50) + r; i++) for (let j = Math.floor(z / 50) - r; j <= Math.floor(z / 50) + r; j++)
        for (const n of carGraph.grid.get(`${i},${j}`) || []) {
          if (!carGraph.road[n]) continue;
          const d = Math.hypot(carGraph.x[n] - x, carGraph.z[n] - z);
          if (d < minD || d > maxD || (best && d >= best.d)) continue;
          const e = carGraph.out[n].find(q => q[2]);
          if (!e || g.road(carGraph.x[n], carGraph.z[n]) === null) continue;
          best = {d, n, x: carGraph.x[n], z: carGraph.z[n], heading: Math.atan2(carGraph.x[e[0]] - carGraph.x[n], carGraph.z[e[0]] - carGraph.z[n])};
        }
      return best;
    },
    /** A car route between two points: {pts, length} or null. */
    driveRoute(ax, az, bx, bz) {
      return shortest(carGraph, nearestNode(carGraph, ax, az, {car: true, radius: 150}), nearestNode(carGraph, bx, bz, {car: true, radius: 150}), {car: true});
    },
    // The big map is src/atlas-map.js's: src/nanjing.js sets openMap to open it.
    openMap() {},
    show(on) { mini.hidden = !on; if (!on) { chevrons.count = 0; chip.hidden = true; chipKey = ''; } },
    stats: {ms: 0},
    update(t, cam) {
      const t0 = performance.now();
      camera = cam;
      transitHint();
      if (route && t - checkAt > 1) {
        checkAt = t;
        const b = world.body;
        if (Math.hypot(b.x - route.target[0], b.z - route.target[1]) < 15 && !route.keep) { toast(`Arrived · ${route.label}`); route = null; }
        else if (offRoute(route.pts, b.x, b.z).d > OFF) { const keep = route.keep; plan(route.target[0], route.target[1], {label: route.label, car: world.vehicle === 'car'}).keep = keep; }
      }
      drawChevrons(t);
      drawMini(t);
      nav.stats.ms = performance.now() - t0;
    },
    fmt,
    /** Where (x, z) is drawn on the minimap, CSS pixels from its middle (+y down), and the arrow's turn
     *  from straight up: for the audit (tests/taxi-browser.mjs). */
    toMini(x, z) {
      const b = world.body, R = world.vehicle === 'car' ? 230 : 150, scale = MINI / (R * 2);
      const cam = world.vehicle === 'walk' ? camYaw() - Math.PI : world.heading, a = cam - Math.PI;
      const dx = (x - b.x) * scale, dz = (z - b.z) * scale;
      return {x: dx * Math.cos(a) - dz * Math.sin(a), y: dx * Math.sin(a) + dz * Math.cos(a),
        arrow: world.vehicle === 'walk' ? -(world.heading - (camYaw() - Math.PI)) : 0};
    },
  };
  return nav;
}
