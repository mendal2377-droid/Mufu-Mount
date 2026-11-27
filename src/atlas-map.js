// One map to every place (the owner's notes 1, 2 and 7; design/NAVIGATOR-PLAN.md): a flat map of
// Nanjing, north up, the same on the home page and in the city. Choosing a place gives its card and
// the ways to go: now (glide in), by metro, or on foot and by taxi along the gold route.
//
// Drawn from the city's own data: the rivers and lakes of public/city/nanjing.json (OSM), the core's
// roads (streets.json) and metro lines (transit.json), the world's water and walkable ground where its
// grid is loaded, and the landmarks at their OSM positions. Frame: the core's metres, x east,
// z = -north, from its origin (32.0418 N, 118.7838 E).

const LAT0 = 32.0418, LON0 = 118.7838, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
export const toXZ = ([lon, lat]) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];

const C = {land: '#ece4d0', walk: '#f3ecda', water: '#9cc2dc', river: '#8fb8d6', road: '#ffffff', edge: '#cfc4ab', major: '#f6e2a8',
  pin: '#2e3b33', ink: '#2e3b33', me: '#c0392b', route: '#e2a93b'};
const RIVER_W = {'长江': 1300};          // metres across: the Yangtze here (ours, from the map); the Qinhuai's arms 40
const ICON = {mount: '△', oldtown: '⌂', truss: '≋', cable: '≋', eye: '∞', lake: '≈', domes: '◉', tower: '♜', pagoda: '♜', temple: '♜',
  mausoleum: '▤', wall: '▥', skyline: '▥', tomb: '◇', palace: '⌂', springs: '♧'};
const MAJOR = /^(motorway|trunk|primary)/;

// --- The metro, as a graph of stations: one node per line and stop ----------------------------------
const SPEED = 12, DWELL = 30, CHANGE = 180;        // m/s between stations, s a stop, s to change lines (ours)
export function metroGraph(transit) {
  const nodes = [], byName = new Map();
  for (const l of transit?.lines || []) if (l.kind === 'metro') l.stops.forEach((st, i) => {
    const n = {line: l, stop: st, i, x: st.at[0], z: -st.at[1], out: []};
    nodes.push(n);
    (byName.get(st.name) || byName.set(st.name, []).get(st.name)).push(n);
    if (i) { const p = nodes[nodes.length - 2], t = Math.abs(st.s - p.stop.s) / SPEED + DWELL; p.out.push([n, t]); n.out.push([p, t]); }
  });
  for (const list of byName.values()) for (const a of list) for (const b of list) if (a !== b) a.out.push([b, CHANGE]);
  return {nodes, byName};
}
/** The nearest station to (x, z): {name, en, x, z, d}. */
export function nearestStation(g, x, z) {
  let best = null;
  for (const [name, list] of g.byName) { const n = list[0], d = Math.hypot(n.x - x, n.z - z); if (!best || d < best.d) best = {name, en: n.stop.en, x: n.x, z: n.z, d}; }
  return best;
}
/** The quickest ride between two stations by name: legs [{line, from, to, stops}] and seconds, or null. */
export function metroRide(g, fromName, toName) {
  if (fromName === toName) return null;
  const dist = new Map(), prev = new Map(), open = [];
  for (const n of g.byName.get(fromName) || []) { dist.set(n, 0); open.push(n); }
  while (open.length) {
    open.sort((a, b) => dist.get(a) - dist.get(b));
    const n = open.shift();
    if (n.stop.name === toName) {
      const path = [];
      for (let q = n; q; q = prev.get(q)) path.push(q);
      path.reverse();
      // Rides along one line become one leg; a step between two lines at one station is a change.
      const legs = [];
      for (let i = 1; i < path.length; i++) {
        const a = path[i - 1], b = path[i];
        if (a.line !== b.line) continue;
        const last = legs.at(-1);
        if (last && last.line === b.line && last.to === a.stop) { last.to = b.stop; last.stops++; }
        else legs.push({line: b.line, from: a.stop, to: b.stop, stops: 1});
      }
      return {legs, seconds: dist.get(n)};
    }
    for (const [m, t] of n.out) { const c = dist.get(n) + t; if (c < (dist.get(m) ?? Infinity)) { dist.set(m, c); prev.set(m, n); if (!open.includes(m)) open.push(m); } }
  }
  return null;
}

/**
 * The map. ctx() says where the visitor is: {world (the core world, when loaded), inCity (walking
 * in it), body, heading, route}. go(id): arrive at a place now. lead(x, z, label, car): set the gold
 * route there. facts(id): a line about a place.
 */
export function createAtlasMap({data, places, walkIn, ctx, go, lead, facts = () => '', toast = () => {}}) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let streets = null, transit = null, metro = null;
  const pins = places.map(p => { const [x, z] = toXZ(p.coord); return {...p, x, z}; });
  // Each lake's outer and inner rings are lists of rings (OSM multipolygons): the first outer ring is its shore.
  const lakes = (data.lakes || []).map(l => [...(l.outer || []), ...(l.inner || [])].map(r => r.map(toXZ)));
  // A place in a lake (Xuanwu, Mochou) is reached at its shore: walks to it are measured to the ring.
  const inside = (x, z, ring) => { let c = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const [xi, zi] = ring[i], [xj, zj] = ring[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
  const toRing = (x, z, ring) => { let best = Infinity; for (let i = 1; i < ring.length; i++) { const [ax, az] = ring[i - 1], [bx, bz] = ring[i], ux = bx - ax, uz = bz - az, L2 = ux * ux + uz * uz || 1, k = Math.max(0, Math.min(1, ((x - ax) * ux + (z - az) * uz) / L2)); best = Math.min(best, Math.hypot(ax + ux * k - x, az + uz * k - z)); } return best; };
  for (const p of pins) p.shore = lakes.find(rings => inside(p.x, p.z, rings[0]))?.[0] || null;
  const walkTo = (p, x, z) => (p.shore ? toRing(x, z, p.shore) : Math.hypot(p.x - x, p.z - z));
  const rivers = (data.rivers || []).map(r => ({w: RIVER_W[r.name] ?? 40, pts: r.points.map(toXZ)}));
  const bounds = (() => { const [w, s, e, n] = data.extent?.bounds || [118.62, 31.88, 119, 32.19]; const [x0, z1] = toXZ([w, s]), [x1, z0] = toXZ([e, n]); return {x0, x1, z0, z1}; })();
  const load = Promise.all(['streets', 'transit'].map(n => fetch(`/scenes/core/${n}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null)))
    .then(([s, t]) => { streets = s; transit = t; metro = t ? metroGraph(t) : null; if (dlg.open) draw(); });

  // --- The dialog ---------------------------------------------------------------------------------
  const dlg = document.createElement('dialog');
  dlg.id = 'atlas-map'; dlg.setAttribute('aria-label', 'Map of Nanjing');
  dlg.innerHTML = `<header><strong>金陵 · Map</strong><span id="atlas-hint">Choose a place · drag to move · wheel to zoom</span>
    <button type="button" data-act="here" title="Back to where you are">◎ Here</button>
    <button type="button" data-act="all" title="All of Nanjing">⤢ All</button>
    <button type="button" data-act="view3d" title="The 3D view">3D view</button>
    <button type="button" data-act="clear">Clear route</button>
    <button type="button" data-act="close" aria-label="Close map">✕</button></header>
    <div class="atlas-body"><canvas></canvas><aside id="atlas-card" hidden></aside></div>`;
  document.body.append(dlg);
  const cv = dlg.querySelector('canvas'), g2 = cv.getContext('2d'), card = dlg.querySelector('#atlas-card');
  let view = {x: 0, z: -2000, mpp: 30}, drag = null, picked = null, mode = 'city', on3d = null;

  const S = () => dpr / view.mpp;                                   // canvas pixels per metre
  const sx = x => (x - view.x) * S() + cv.width / 2, sz = z => (z - view.z) * S() + cv.height / 2;
  const wx = px => view.x + (px - cv.width / 2) / S(), wz = py => view.z + (py - cv.height / 2) / S();

  function line(pts, w, color) {
    g2.strokeStyle = color; g2.lineWidth = w; g2.beginPath();
    pts.forEach(([x, z], i) => (i ? g2.lineTo(sx(x), sz(z)) : g2.moveTo(sx(x), sz(z)))); g2.stroke();
  }
  function draw() {
    const W = cv.width, H = cv.height, s = S(), c = ctx();
    g2.save(); g2.fillStyle = C.land; g2.fillRect(0, 0, W, H); g2.lineCap = g2.lineJoin = 'round';
    // The world's own ground and water where its grid is loaded and the map is near enough to show it.
    const grid = c.world?.grid;
    if (grid && view.mpp < 14) {
      const cell = Math.max(4, view.mpp * 3), x0 = wx(0), z0 = wz(0), x1 = wx(W), z1 = wz(H);
      for (let z = z0; z < z1; z += cell) for (let x = x0; x < x1; x += cell) {
        const wet = grid.water(x + cell / 2, z + cell / 2) !== null, walk = !wet && grid.height(x + cell / 2, z + cell / 2) !== null;
        if (!wet && !walk) continue;
        g2.fillStyle = wet ? C.water : C.walk; g2.fillRect(sx(x), sz(z), cell * s + 1, cell * s + 1);
      }
    }
    // Lakes and rivers (the whole area).
    g2.fillStyle = C.water;
    for (const rings of lakes) { g2.beginPath(); for (const r of rings) r.forEach(([x, z], i) => (i ? g2.lineTo(sx(x), sz(z)) : g2.moveTo(sx(x), sz(z)))); g2.fill('evenodd'); }
    for (const r of rivers) line(r.pts, Math.max(1.5 * dpr, r.w * s), C.river);
    // Roads: the main ones at every scale, the rest nearer in.
    if (streets) {
      const all = view.mpp < 12;
      for (const pass of [0, 1]) for (const [cls, , , f] of streets.ways) {
        const kind = streets.classes[cls], major = MAJOR.test(kind);
        if (!all && !major) continue;
        const w = (major ? 9 : 5) * s;
        g2.strokeStyle = pass ? (major ? C.major : C.road) : C.edge;
        g2.lineWidth = Math.max(pass ? (major ? 1.6 : .8) * dpr : (major ? 2.6 : 1.4) * dpr, pass ? w : w + 2 * s);
        g2.beginPath();
        for (let i = 0; i < f.length; i += 2) (i ? g2.lineTo(sx(f[i]), sz(f[i + 1])) : g2.moveTo(sx(f[i]), sz(f[i + 1])));
        g2.stroke();
      }
    }
    // The metro: lines in their colours, stations as rings.
    if (transit) for (const l of transit.lines) if (l.kind === 'metro') line(l.pts.map(([x, n]) => [x, -n]), Math.max(2.2 * dpr, 14 * s), l.colour);
    // The gold route, when there is one.
    if (c.route) { g2.setLineDash(c.route.straight ? [8 * dpr, 6 * dpr] : []); line(c.route.pts, Math.max(4 * dpr, 8 * s), C.route); g2.setLineDash([]); }
    g2.restore();
    // Stations, labelled when near enough to read.
    g2.font = `600 ${11 * dpr}px system-ui, sans-serif`; g2.textBaseline = 'middle';
    if (metro) for (const [name, list] of metro.byName) {
      const n = list[0], X = sx(n.x), Z = sz(n.z);
      if (X < -20 || Z < -20 || X > W + 20 || Z > H + 20) continue;
      g2.fillStyle = '#fff'; g2.strokeStyle = list.length > 1 ? C.ink : n.line.colour; g2.lineWidth = (list.length > 1 ? 2.5 : 2) * dpr;
      g2.beginPath(); g2.arc(X, Z, (list.length > 1 ? 5.5 : 4) * dpr, 0, Math.PI * 2); g2.fill(); g2.stroke();
      if (view.mpp < 9) { g2.fillStyle = C.ink; g2.textAlign = 'left'; g2.fillText(`${n.stop.en} ${name}`, X + 8 * dpr, Z); }
    }
    // The places: a disc with the kind's mark, the name beside it where it has room (the chosen place's
    // first, then the walk-in ones).
    const taken = [], order = [...pins].sort((a, b) => (b.id === picked?.id) - (a.id === picked?.id) || walkIn(b.id) - walkIn(a.id));
    for (const p of order) {
      const X = sx(p.x), Z = sz(p.z), r = (picked?.id === p.id ? 15 : 12) * dpr;
      if (X < -100 || Z < -40 || X > W + 100 || Z > H + 40) continue;
      g2.fillStyle = picked?.id === p.id ? '#c9873a' : C.pin; g2.strokeStyle = '#f6efd9'; g2.lineWidth = 2.5 * dpr;
      g2.beginPath(); g2.arc(X, Z, r, 0, Math.PI * 2); g2.fill(); g2.stroke();
      g2.fillStyle = '#f6efd9'; g2.textAlign = 'center'; g2.font = `700 ${12 * dpr}px system-ui, sans-serif`; g2.fillText(ICON[p.kind] || '◇', X, Z + .5 * dpr);
      g2.textAlign = 'left'; g2.font = `700 ${13 * dpr}px "Noto Serif SC", serif`;
      const label = `${p.zh}`, en = p.name;
      const tw = Math.max(g2.measureText(label).width, (g2.font = `600 ${10.5 * dpr}px system-ui, sans-serif`, g2.measureText(en).width));
      const box = [X - r, Z - 14 * dpr, X + r + tw + 13 * dpr, Z + 14 * dpr];
      if (taken.some(q => box[0] < q[2] && q[0] < box[2] && box[1] < q[3] && q[1] < box[3])) continue;
      taken.push(box);
      g2.fillStyle = '#f6efd9e6'; g2.fillRect(X + r + 3 * dpr, Z - 14 * dpr, tw + 10 * dpr, 28 * dpr);
      g2.fillStyle = C.ink; g2.font = `700 ${13 * dpr}px "Noto Serif SC", serif`; g2.fillText(label, X + r + 8 * dpr, Z - 5 * dpr);
      g2.font = `600 ${10.5 * dpr}px system-ui, sans-serif`; g2.fillText(en, X + r + 8 * dpr, Z + 8 * dpr);
    }
    // You are here.
    if (c.inCity && c.body) {
      g2.save(); g2.translate(sx(c.body.x), sz(c.body.z)); g2.rotate(Math.PI - c.heading);
      g2.fillStyle = C.me; g2.strokeStyle = '#fff'; g2.lineWidth = 2 * dpr;
      g2.beginPath(); g2.moveTo(0, -12 * dpr); g2.lineTo(9 * dpr, 10 * dpr); g2.lineTo(0, 5 * dpr); g2.lineTo(-9 * dpr, 10 * dpr); g2.closePath(); g2.fill(); g2.stroke();
      g2.restore();
    }
    // Scale bar.
    const m = [100, 200, 500, 1000, 2000, 5000].find(q => q / view.mpp > 70) || 5000, px = m * s;
    g2.fillStyle = C.ink; g2.fillRect(16 * dpr, H - 18 * dpr, px, 3 * dpr); g2.textAlign = 'left'; g2.font = `600 ${11 * dpr}px system-ui, sans-serif`;
    g2.fillText(m >= 1000 ? `${m / 1000} km` : `${m} m`, 16 * dpr, H - 28 * dpr);
  }

  // --- The card ---------------------------------------------------------------------------------------
  const fmt = (m) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m / 10) * 10} m`);
  const mins = (s) => `${Math.max(1, Math.round(s / 60))} min`;
  function showCard(p) {
    picked = p; const c = ctx();
    const b = c.inCity ? c.body : null, d = b ? Math.hypot(p.x - b.x, p.z - b.z) : null;
    const near = c.world?.grid && (c.world.grid.height(p.x, p.z) !== null || c.world.ground?.(p.x, p.z) != null);
    let html = `<button type="button" class="atlas-x" data-act="uncard" aria-label="Close">×</button>
      <h3>${p.zh}<small>${p.name}</small></h3>${d != null ? `<p class="atlas-d">${fmt(d)} from you</p>` : ''}
      <p>${facts(p.id) || ''}</p><div class="atlas-go">
      <button type="button" class="primary" data-go="now">Go now${walkIn(p.id) ? ' <i>✦ walk in</i>' : ''}</button>`;
    if (b && near && d > 120) html += `<button type="button" data-go="route">Walk or drive there <small>gold arrows · ${fmt(d)}</small></button>`;
    if (b && metro) {
      // From the station nearest the visitor to the one that gets them there soonest, ride and walk.
      const a = nearestStation(metro, b.x, b.z);
      let z = null, ride = null;
      for (const [name, list] of metro.byName) {
        const n = list[0], walk = walkTo(p, n.x, n.z);
        if (walk > 1500) continue;
        const rr = metroRide(metro, a.name, name);
        if (rr && (!ride || rr.seconds + walk / 1.3 < ride.seconds + z.d / 1.3)) { ride = rr; z = {name, en: n.stop.en, x: n.x, z: n.z, d: walk}; }
      }
      if (ride && a.d < 1500 && d > 1500) {
        const legs = ride.legs.map((l, i) => `${i ? `change at <b>${l.from.en}</b> to ` : ''}<span class="line" style="--c:${l.line.colour}">${l.line.en.replace('Metro ', '')}</span> ${l.stops} stop${l.stops > 1 ? 's' : ''} to <b>${l.to.en}</b>`).join(', ');
        html += `<div class="atlas-metro"><p><b>By metro</b>, about ${mins(ride.seconds + (a.d + z.d) / 1.3)}: walk ${fmt(a.d)} to <b>${a.en} ${a.name}</b>, ${legs}, then walk ${fmt(z.d)}.</p>
          <button type="button" data-go="metro" data-x="${a.x}" data-z="${a.z}" data-station="${a.name}" data-name="${a.en} ${a.name}">Lead me to ${a.en} station</button></div>`;
      }
    }
    card.innerHTML = html + '</div>'; card.hidden = false; draw();
  }
  function showStation(name) {
    const list = metro.byName.get(name), n = list[0], c = ctx();
    picked = null;
    card.innerHTML = `<button type="button" class="atlas-x" data-act="uncard" aria-label="Close">×</button><h3>${name}<small>${n.stop.en} station</small></h3>
      <p>${list.map(q => `<span class="line" style="--c:${q.line.colour}">${q.line.en}</span>`).join(' ')}</p>
      ${c.inCity ? `<div class="atlas-go"><button type="button" class="primary" data-go="metro" data-x="${n.x}" data-z="${n.z}" data-station="${name}" data-name="${n.stop.en} ${name}">Lead me to the entrance</button></div>` : ''}`;
    card.hidden = false; draw();
  }
  card.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.act === 'uncard') { card.hidden = true; picked = null; draw(); return; }
    const p = picked;
    if (b.dataset.go === 'now' && p) { dlg.close(); go(p.id); }
    if (b.dataset.go === 'route' && p) { const r = lead(p.x, p.z, `${p.name} ${p.zh}`); dlg.close(); if (r) toast(`${p.name} · ${fmt(r.length)} · follow the gold arrows`); }
    if (b.dataset.go === 'metro') { const x = +b.dataset.x, z = +b.dataset.z, r = lead(x, z, `${b.dataset.name} station`, false, b.dataset.station); dlg.close();
      if (r) toast(`To ${b.dataset.name} station · ${fmt(r.length)} on foot · F at the entrance to ride`); }
  });

  // --- Moving the map, choosing ---------------------------------------------------------------------
  cv.addEventListener('pointerdown', (e) => { drag = {x: e.clientX, y: e.clientY, vx: view.x, vz: view.z, moved: false}; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    view.x = drag.vx - dx * view.mpp; view.z = drag.vz - dy * view.mpp; draw();
  });
  cv.addEventListener('pointerup', (e) => {
    const d = drag; drag = null;
    if (!d || d.moved) return;
    const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) * dpr, py = (e.clientY - r.top) * dpr;
    // A place, a station, or (in the city) a spot for the gold route.
    const hit = pins.map(p => ({p, d: Math.hypot(sx(p.x) - px, sz(p.z) - py)})).sort((a, b) => a.d - b.d)[0];
    if (hit && hit.d < 22 * dpr) { showCard(hit.p); return; }
    if (metro) { let best = null; for (const [name, list] of metro.byName) { const dd = Math.hypot(sx(list[0].x) - px, sz(list[0].z) - py); if (dd < 12 * dpr && (!best || dd < best.d)) best = {name, d: dd}; } if (best) { showStation(best.name); return; } }
    const c = ctx();
    if (c.inCity) { const x = wx(px), z = wz(py), rr = lead(x, z, 'Waypoint'); card.hidden = true; picked = null; draw(); if (rr) toast(`Waypoint · ${fmt(rr.length)} ${rr.straight ? 'as the crow flies' : 'along the mapped ways'}`); }
  });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), px = (e.clientX - r.left) * dpr, py = (e.clientY - r.top) * dpr, ax = wx(px), az = wz(py);
    view.mpp = Math.min(60, Math.max(.8, view.mpp * (e.deltaY > 0 ? 1.2 : 1 / 1.2)));
    view.x = ax - (px - cv.width / 2) / S(); view.z = az - (py - cv.height / 2) / S(); draw();
  }, {passive: false});
  const fitAll = () => { const r = cv.getBoundingClientRect(); view = {x: (bounds.x0 + bounds.x1) / 2, z: (bounds.z0 + bounds.z1) / 2, mpp: Math.max((bounds.x1 - bounds.x0) / (r.width || 800), (bounds.z1 - bounds.z0) / (r.height || 600)) * 1.02}; };
  dlg.querySelector('header').addEventListener('click', (e) => {
    const act = e.target.closest('button')?.dataset.act; if (!act) return;
    const c = ctx();
    if (act === 'close') dlg.close();
    if (act === 'all') { fitAll(); draw(); }
    if (act === 'here' && c.body) { view = {x: c.body.x, z: c.body.z, mpp: 4}; draw(); }
    if (act === 'clear') { c.clear?.(); draw(); }
    if (act === 'view3d') { dlg.close(); on3d?.(); }
  });
  dlg.addEventListener('keydown', (e) => { if (['KeyN', 'KeyG', 'KeyM'].includes(e.code)) { dlg.close(); e.preventDefault(); } });

  const atlas = {
    get open() { return dlg.open; },
    get view() { return {...view}; },
    pins, ready: load,
    /** Open the map. home: the whole of Nanjing, with the 3D view switch; else round the traveller. */
    open({home = false, onView3d = null} = {}) {
      mode = home ? 'home' : 'city'; on3d = onView3d;
      dlg.classList.toggle('home', home);
      dlg.querySelector('[data-act="view3d"]').hidden = !home;
      dlg.querySelector('[data-act="here"]').hidden = home;
      dlg.querySelector('[data-act="clear"]').hidden = home;
      if (!dlg.open) dlg.showModal();
      const r = cv.getBoundingClientRect(); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      const c = ctx();
      if (home || !c.body) fitAll(); else view = {x: c.body.x, z: c.body.z, mpp: 6};
      card.hidden = true; picked = null; draw();
    },
    close() { if (dlg.open) dlg.close(); },
    /** For the audit: choose a place by id as a click would, and the card's buttons. */
    pick(id) { const p = pins.find(q => q.id === id); if (p) showCard(p); return [...card.querySelectorAll('[data-go]')].map(b => b.dataset.go); },
    draw,
  };
  return atlas;
}
