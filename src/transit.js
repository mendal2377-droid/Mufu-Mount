import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createCarriage} from './carriage.js';

// Tiny Nanjing's metro and buses (research/transit/FACTS.md): a few real lines from OpenStreetMap,
// written by tools/research/transit-prep.py to public/scenes/core/transit.json in Blender's frame
// (x east, y north); here x stays x and z is -y.
//
// Buses drive their routes on the road surface, out and back on the right-hand side, and wait at
// each stop; the visitor boards at a stop (F) and gets off at the next. The metro runs underground,
// so its ride is shown from above: the line in its colour drawn through the city, the train on it.

const BUS_SPEED = 5;            // m/s: the city's 18 km/h target speed
const BUS_DWELL = 12;           // seconds at a stop
const BUS_SPACING = 900;        // metres between buses on a route (assumption: real headways are minutes)
const BUS_SIDE = 3.4;           // metres right of the route centreline: China drives on the right
const METRO_SPEED = 180;        // m/s: 65 km/h sped up ten times (assumption: a ride of seconds)
const SAMPLE = 2;               // metres between precomputed route samples

// One geometry with baked vertex colours from boxes [w, h, l, x, y, z, colour].
function boxes(list) {
  return mergeGeometries(list.map(([w, h, l, x, y, z, c]) => {
    const g = new THREE.BoxGeometry(w, h, l).toNonIndexed();
    g.translate(x, y, z);
    const col = new THREE.Color(c), arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) { arr[i] = col.r; arr[i + 1] = col.g; arr[i + 2] = col.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    return g;
  }));
}

// An LED panel: amber dot-matrix light on black. A large line (the station) and a small one (the
// times); the large one alone, centred, when there is no small one.
function ledTexture(big, small, accent = null) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 136;
  const g = c.getContext('2d');
  g.fillStyle = '#0b0d0e'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#16191b';
  for (let y = 3; y < c.height; y += 6) for (let x = 3; x < c.width; x += 6) g.fillRect(x, y, 3, 3);
  if (accent) { g.fillStyle = accent; g.fillRect(14, 22, 10, c.height - 44); }
  g.fillStyle = '#ffb547'; g.shadowColor = '#ff9d1f'; g.shadowBlur = 10; g.textBaseline = 'middle';
  g.textAlign = small ? 'left' : 'center';
  const x0 = small ? 44 : c.width / 2;
  g.font = `600 ${small ? 50 : 54}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
  g.fillText(big, x0, small ? 46 : 70, c.width - 64);
  if (small) { g.font = '500 30px "Noto Sans SC", "Microsoft YaHei", sans-serif'; g.fillStyle = '#ffd08a'; g.fillText(small, x0, 104, c.width - 64); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// The doorway's note: 进站 Enter · F, light on a soft dark pill.
function noteTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 144;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(16, 32, 26, .72)';
  g.beginPath(); g.roundRect(6, 6, 500, 132, 66); g.fill();
  g.fillStyle = '#fffbea'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '600 54px "Noto Sans SC", "Microsoft YaHei", sans-serif';
  g.fillText('Enter · F', 256, 74);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export async function loadTransit(base, {scene, bands, heightAt, roadAt, surface, nearest}) {
  const data = await fetch(base + 'transit.json').then(r => (r.ok ? r.json() : null)).catch(() => null);
  if (!data) return null;
  const toon = (opts) => new THREE.MeshToonMaterial({gradientMap: bands, ...opts});
  // A spot on foot beside (x, z): walkable and not carriageway, the nearest within r metres.
  // Clear of the carriageway by `room` metres all round, so a kiosk or shelter never overhangs it.
  const clear = (px, pz, room) => heightAt(px, pz) !== null && [[0, 0], [room, 0], [-room, 0], [0, room], [0, -room]]
    .every(([dx, dz]) => roadAt(px + dx, pz + dz) === null && heightAt(px + dx, pz + dz) !== null);
  const kerb = (x, z, r = 40, room = 3.5) => nearest((px, pz) => (clear(px, pz, room) ? 1 : null), x, z, r)
    || nearest((px, pz) => (clear(px, pz, 1.5) ? 1 : null), x, z, r) || [x, z];
  const groundY = (x, z, last) => surface(x, z) ?? heightAt(x, z) ?? last;

  // --- Routes, sampled every SAMPLE metres: position, ground height, heading ------------------------
  function sampled(line, side) {
    const pts = line.pts.map(([x, y]) => new THREE.Vector2(x, -y));
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    const length = cum[cum.length - 1], n = Math.floor(length / SAMPLE) + 1;
    const at = s => {
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const k = (s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]);
      return pts[i - 1].clone().lerp(pts[i], THREE.MathUtils.clamp(k, 0, 1));
    };
    // Ground baked along the line in Blender (tools/transit-heights.py), for where the walk grid
    // stops short (the north, where Line 1 rides its viaduct).
    const baked = s => {
      if (!line.z) return null;
      let i = 1;
      while (i < cum.length - 1 && cum[i] < s) i++;
      const k = THREE.MathUtils.clamp((s - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), 0, 1);
      return line.z[i - 1] + (line.z[i] - line.z[i - 1]) * k;
    };
    const xs = new Float32Array(n), zs = new Float32Array(n), ys = new Float32Array(n), hs = new Float32Array(n);
    let lastY = 10;
    for (let k = 0; k < n; k++) {
      const s = k * SAMPLE, p = at(s), a = at(Math.max(0, s - 6)), b = at(Math.min(length, s + 6));
      const h = Math.atan2(b.x - a.x, b.y - a.y);
      // Offset to the right of the direction of travel (heading h: forward is (sin h, cos h)).
      const x = p.x - Math.cos(h) * side, z = p.y + Math.sin(h) * side;
      xs[k] = x; zs[k] = z; hs[k] = h;
      ys[k] = lastY = (line.kind === 'bus' ? roadAt(x, z) : null) ?? surface(x, z) ?? heightAt(x, z) ?? baked(s) ?? lastY;
      // Through a road tunnel (left out of the city build) the bus runs below the street.
      if ((line.tunnel || []).some(([a, b]) => s > a && s < b)) ys[k] -= 9;
    }
    if (line.kind === 'bus') onCarriageway({n, xs, zs, ys, hs}, line);
    return {length, n, xs, zs, ys, hs};
  }
  // Pull a bus route onto road cells: each sample off the road moves to the nearest road cell
  // within 9 m, those to the right of the direction of travel first; then a moving average over
  // ±8 m smooths the line, and headings and heights are taken again from the smoothed line.
  function onCarriageway(r, line, pass = 0) {
    const tunnel = s => (line.tunnel || []).some(([a, b]) => s > a && s < b);
    for (let k = 0; k < r.n; k++) {
      const x = r.xs[k], z = r.zs[k];
      const rx = -Math.cos(r.hs[k]), rz = Math.sin(r.hs[k]);
      // Road under the bus's middle and under both its sides (it is 2.5 m wide): next to the kerb
      // its near side overhung the pavement, among the lamps (the owner saw it).
      const fits = (px, pz) => roadAt(px, pz) !== null && roadAt(px + rx * 1.4, pz + rz * 1.4) !== null && roadAt(px - rx * 1.4, pz - rz * 1.4) !== null;
      if (tunnel(k * SAMPLE) || fits(x, z)) continue;
      let best = null, bd = Infinity;
      // Up to 18 m: towards Zhongshan Wharf Bus 34's line runs 10-16 m off the built carriageway.
      for (let d = 1; d <= 18; d += 1) for (let a = 0; a < 16; a++) {
        const t = a / 16 * Math.PI * 2, px = x + Math.cos(t) * d, pz = z + Math.sin(t) * d;
        if (!fits(px, pz)) continue;
        const cost = d - .6 * ((px - x) * rx + (pz - z) * rz) / d;    // prefer the right-hand side
        if (cost < bd) { bd = cost; best = [px, pz]; }
      }
      if (best) { r.xs[k] = best[0]; r.zs[k] = best[1]; }
    }
    if (pass === 1) return;
    const xs = Float32Array.from(r.xs), zs = Float32Array.from(r.zs), W8 = 4;
    for (let k = 0; k < r.n; k++) {
      let sx = 0, sz = 0, c = 0;
      for (let j = Math.max(0, k - W8); j <= Math.min(r.n - 1, k + W8); j++) { sx += xs[j]; sz += zs[j]; c++; }
      r.xs[k] = sx / c; r.zs[k] = sz / c;
    }
    onCarriageway(r, line, 1);
    let last = r.ys[0];
    for (let k = 0; k < r.n; k++) {
      const a = Math.max(0, k - 3), b = Math.min(r.n - 1, k + 3);
      r.hs[k] = Math.atan2(r.xs[b] - r.xs[a], r.zs[b] - r.zs[a]);
      if (!tunnel(k * SAMPLE)) r.ys[k] = last = roadAt(r.xs[k], r.zs[k]) ?? surface(r.xs[k], r.zs[k]) ?? r.ys[k] ?? last;
    }
  }

  function pose(r, s, out) {
    const f = THREE.MathUtils.clamp(s / SAMPLE, 0, r.n - 1), k = Math.floor(f), k1 = Math.min(r.n - 1, k + 1), u = f - k;
    out.x = r.xs[k] + (r.xs[k1] - r.xs[k]) * u; out.z = r.zs[k] + (r.zs[k1] - r.zs[k]) * u;
    out.y = r.ys[k] + (r.ys[k1] - r.ys[k]) * u;
    let dh = r.hs[k1] - r.hs[k]; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
    out.h = r.hs[k] + dh * u;
    return out;
  }

  // --- Buses -----------------------------------------------------------------------------------------
  // A 12 m city bus (the owner's ask: glass all round and real seats, for the window seat). Frame
  // and panels below the windows, slim pillars between the panes, a roof; inside a floor, two-and-
  // two rows of seats, yellow grab poles and rails, and a light strip that glows at night. The
  // glass (front, back and both sides) is its own tinted, see-through mesh. Local frame: +z ahead.
  const W = 0xf4f1e8, GREEN = 0x2f8f5b, FRAME = 0x3a4046, SEAT = 0x2f6f8f, POLE = 0xe8c13a;
  const L2 = 5.8, HW = 1.25, SILL = 1.45, TOP = 2.75;                       // half length, half width
  const shell = [
    [2.5, SILL - .3, 11.6, 0, .3 + (SILL - .3) / 2, 0, W],                      // the body below the windows
    [2.52, .42, 11.62, 0, .78, 0, GREEN],                                       // the green band
    [2.5, .22, 11.6, 0, TOP + .11, 0, 0xe9e6dc],                                 // roof
    [2.2, .4, 1.4, 0, TOP + .42, -3.8, 0xc9c5b8],                                // batteries on the roof
    [2.3, .06, 11.3, 0, SILL - .02 - .55, 0, 0x6c6f6c],                          // floor inside
    [.5, .04, 9.6, 0, TOP - .04, 0, 0xfff1cc],                                   // the ceiling light strip
    ...[-3.8, 3.8].flatMap(z => [[.3, .9, .9, -1.15, .45, z, 0x22252a], [.3, .9, .9, 1.15, .45, z, 0x22252a]]),
  ];
  // Pillars between the panes, both sides, and the four corners.
  for (let z = -L2 + .05; z <= L2; z += 1.45) for (const sd of [-1, 1]) shell.push([.08, TOP - SILL, .1, sd * HW, (SILL + TOP) / 2, z, FRAME]);
  for (const [x, z] of [[-HW, L2], [HW, L2], [-HW, -L2], [HW, -L2]]) shell.push([.12, TOP - SILL + .05, .12, x, (SILL + TOP) / 2, z, FRAME]);
  // Seats: two-and-two rows (pan and back, facing ahead), the front third clear for standing.
  for (let row = 0; row < 7; row++) {
    const z = -4.9 + row * .95;
    for (const x of [-.85, -.42, .42, .85]) {
      shell.push([.4, .1, .42, x, SILL - .1, z, SEAT], [.4, .5, .08, x, SILL + .18, z - .2, SEAT]);
    }
  }
  // Grab poles at the seat rows' ends and rails along the ceiling.
  for (let z = -4.4; z <= 4.6; z += 1.9) for (const x of [-.2, .2]) shell.push([.04, TOP - SILL + .5, .04, x, (SILL - .5 + TOP) / 2, z, POLE]);
  for (const x of [-.55, .55]) shell.push([.035, .035, 10.6, x, TOP - .25, 0, POLE]);
  const busBody = boxes(shell);
  // The glass: both sides between sill and roof, the windscreen and the rear window.
  const busGlass = boxes([
    [.03, TOP - SILL, 11.5, -HW - .01, (SILL + TOP) / 2, 0, 0xffffff], [.03, TOP - SILL, 11.5, HW + .01, (SILL + TOP) / 2, 0, 0xffffff],
    [2.44, TOP - .9, .03, 0, (.9 + TOP) / 2, L2 + .01, 0xffffff], [2.44, TOP - SILL, .03, 0, (SILL + TOP) / 2, -L2 - .01, 0xffffff],
  ]);
  const buses = [], busLines = data.lines.filter(l => l.kind === 'bus');
  for (const line of busLines) {
    const out = sampled(line, BUS_SIDE), back = sampled({...line, pts: [...line.pts].reverse(), z: line.z && [...line.z].reverse()}, BUS_SIDE);
    // Stops: the shelter beside the road; on each run the bus halts at the route sample nearest it.
    line.stops.forEach(st => { st.spot = kerb(st.at[0], -st.at[1], 15); });
    const stopS = (r, run) => line.stops.map(st => {
      let bk = 0, bd = Infinity;
      for (let k = 0; k < r.n; k += 2) { const d = (r.xs[k] - st.at[0]) ** 2 + (r.zs[k] + st.at[1]) ** 2; if (d < bd) { bd = d; bk = k; } }
      if (bd > 45 * 45) return null;
      // This side's stop: on the pavement to the right of the bus (forward is (sin h, cos h)), the
      // first spot out from the route clear of the carriageway with none beyond it. The nearest
      // clear spot was at times the strip between a junction's two carriageways, and the shelter
      // stood in the middle of the road (the owner saw it at Zhongshan Gate).
      const h = r.hs[bk], x = r.xs[bk], z = r.zs[bk], rx = -Math.cos(h), rz = Math.sin(h);
      const outer = (d) => [1, 2, 3, 4, 5, 6, 8].every((e) => roadAt(x + rx * (d + e), z + rz * (d + e)) === null);
      let spot = null;
      // Out to 50 m: Zhongshan Gate's junction is over 40 m across. Failing that, the nearest clear
      // spot within 40 m of any kind; within 8 m there was often none, and the shelter stood where
      // the search began, on the carriageway (18 of 70 stops).
      for (let d = 3; d <= 50 && !spot; d += .5) if (clear(x + rx * d, z + rz * d, 2) && outer(d)) spot = [x + rx * d, z + rz * d];
      spot = spot || kerb(x + rx * 4.5, z + rz * 4.5, 40);
      return {s: bk * SAMPLE, stop: {...st, spot, run, line, h}};
    }).filter(Boolean).sort((a, b) => a.s - b.s);
    line.runs = [{r: out, stops: stopS(out, 0)}, {r: back, stops: stopS(back, 1)}];
    const count = Math.max(2, Math.round(2 * out.length / BUS_SPACING)), shift = busLines.indexOf(line) * .29;
    for (let i = 0; i < count; i++) {
      const run = i % 2, s = ((i / count + shift) % 1) * out.length;
      buses.push({line, run, s, wait: 0, next: line.runs[run].stops.findIndex(q => q.s > s), p: {}});
    }
  }
  // Double-sided: from the window seat the bus is seen from inside.
  const busMesh = new THREE.InstancedMesh(busBody, toon({vertexColors: true, side: THREE.DoubleSide}), Math.max(1, buses.length));
  // Tinted glass, see-through from both sides; at night it takes the cabin's warm light.
  const glassMat = new THREE.MeshBasicMaterial({color: 0x8fb4c2, transparent: true, opacity: .32, depthWrite: false, side: THREE.DoubleSide});
  const busWindows = new THREE.InstancedMesh(busGlass, glassMat, Math.max(1, buses.length));
  busMesh.count = busWindows.count = buses.length;
  busMesh.frustumCulled = busWindows.frustumCulled = false;
  busMesh.castShadow = true;
  scene.add(busMesh, busWindows);

  // Shelters at the stops: a roof on two posts, a glass back, and under the roof's front edge an
  // LED board of the arrivals (the owner's ask, 1 November). A stop shared by several lines (the
  // same name within 40 m) gets one shelter.
  const stopsAll = [];
  for (const st of busLines.flatMap(l => l.runs.flatMap(r => r.stops.map(q => q.stop)))) {
    // The same stop for another line: same name, near, and the same way (the two sides of a road
    // are two stops, each for its own direction).
    const twin = stopsAll.find(o => o.name === st.name && Math.hypot(o.spot[0] - st.spot[0], o.spot[1] - st.spot[1]) < 40 && Math.cos(o.h - st.h) > .3);
    if (twin) st.shelter = twin; else { st.shelter = st; stopsAll.push(st); }
  }
  const shelterGeo = boxes([[3.6, .12, 1.6, 0, 2.55, 0, 0xe8e4da], [.1, 2.5, .1, -1.6, 1.25, -.6, 0x5d6670], [.1, 2.5, .1, 1.6, 1.25, -.6, 0x5d6670],
    [3.2, 1.6, .05, 0, 1.5, -.75, 0x9fb8c4], [3.0, .36, .08, 0, 2.3, .7, 0x23282c]]);       // the LED's housing
  const shelters = new THREE.InstancedMesh(shelterGeo, toon({vertexColors: true}), Math.max(1, stopsAll.length));
  const BUS_LED = {w: 2.8, h: .3, at: new THREE.Vector3(0, 2.3, .745)};
  const busLedGeo = new THREE.PlaneGeometry(BUS_LED.w, BUS_LED.h).translate(BUS_LED.at.x, BUS_LED.at.y, BUS_LED.at.z);
  const busLeds = new THREE.InstancedMesh(busLedGeo, new THREE.MeshBasicMaterial({map: ledTexture('NANJING BUS', '')}), Math.max(1, stopsAll.length));
  const dummy = new THREE.Object3D();
  stopsAll.forEach((st, i) => {
    const r = st.line.runs[st.run].r;
    let bk = 0, bd = Infinity;
    for (let k = 0; k < r.n; k += 2) { const d = (r.xs[k] - st.spot[0]) ** 2 + (r.zs[k] - st.spot[1]) ** 2; if (d < bd) { bd = d; bk = k; } }
    dummy.position.set(st.spot[0], groundY(st.spot[0], st.spot[1], r.ys[bk]), st.spot[1]);
    // Face the road: the shelter's open side (+z) towards the route.
    dummy.rotation.set(0, Math.atan2(r.xs[bk] - st.spot[0], r.zs[bk] - st.spot[1]), 0);
    dummy.updateMatrix(); shelters.setMatrixAt(i, dummy.matrix); busLeds.setMatrixAt(i, dummy.matrix);
    st.matrix = dummy.matrix.clone();
  });
  shelters.count = busLeds.count = stopsAll.length;
  scene.add(shelters, busLeds);

  // --- Metro: entrances at the stations, the line and train shown during a ride ---------------------
  const metroLines = data.lines.filter(l => l.kind === 'metro');
  const entrances = [];
  // The entrance (the owner's design notes, 1 November): a glass pavilion open at the front, stairs
  // going down into the dark inside, the line's colour round the roof, and an LED screen set into
  // the lintel over the doorway. Local frame: the doorway faces +z (along the line).
  const steps = Array.from({length: 8}, (_, k) => {
    const c = new THREE.Color(0x9aa0a4).lerp(new THREE.Color(0x30353a), k / 7).getHex();
    return [2.9, .03, .07, 0, .19, 2.05 - k * .55, c];
  });
  const entranceGeo = boxes([
    [3.6, .16, 5.4, 0, .08, 0, 0x9a9690],                                                  // granite plinth
    [3.4, 2.6, .14, 0, 1.3, -2.53, 0xdcdfe0],                                              // back wall
    ...[-1, 1].flatMap(sd => [
      [.06, 2.16, 4.9, sd * 1.66, 1.26, -.1, 0x9fbccb],                                    // glass sides
      [.14, 2.6, .14, sd * 1.66, 1.3, 2.53, 0x5d6670], [.14, 2.6, .14, sd * 1.66, 1.3, -2.53, 0x5d6670],
      [.05, .05, 4.4, sd * 1.32, 1.0, -.05, 0xc8cdd0],                                     // handrails
      [.05, .85, .05, sd * 1.32, .58, 2.0, 0xc8cdd0], [.05, .85, .05, sd * 1.32, .58, -2.0, 0xc8cdd0],
    ]),
    [3.9, .16, 5.8, 0, 2.72, 0, 0xf2f2ee],                                                 // roof
    [3.4, .52, .16, 0, 2.38, 2.6, 0x23282c],                                               // lintel, the LED's housing
    [3.0, .02, 4.6, 0, .17, -.1, 0x30353a],                                                // stairwell floor
    [3.0, 1.0, .05, 0, .67, -2.42, 0x121518],                                              // dark at the stairs' foot
    ...steps,
  ]);
  const bandGeo = boxes([[3.94, .15, .05, 0, 2.72, 2.92, 0xffffff], [3.94, .15, .05, 0, 2.72, -2.92, 0xffffff],
    [.05, .15, 5.84, 1.97, 2.72, 0, 0xffffff], [.05, .15, 5.84, -1.97, 2.72, 0, 0xffffff],
    [.32, .32, .03, 1.42, 2.38, 2.69, 0xffffff]]);                                         // the line's badge on the lintel
  for (const line of metroLines) {
    line.colour3 = new THREE.Color(line.colour || '#888888');
    line.route = sampled(line, 0);
    line.stops.forEach(st => {
      // Lines sharing a station (Xinjiekou, Gulou) each get their own entrance, a few metres apart.
      const twin = entrances.filter(e => e.stop.osm === st.osm).length;
      const spot = kerb(st.at[0] + twin * 9, -st.at[1] + twin * 9, 60);
      entrances.push({line, stop: st, spot, y: groundY(spot[0], spot[1], 10)});
    });
  }
  const entranceMesh = new THREE.InstancedMesh(entranceGeo, toon({vertexColors: true}), Math.max(1, entrances.length));
  // Every LED shows the network's name until the walker comes near; the nearest one is overlaid
  // with its own station and times (updateBoard).
  const LED = {w: 2.7, h: .36, at: new THREE.Vector3(0, 2.38, 2.685)};
  const ledGeo = new THREE.PlaneGeometry(LED.w, LED.h).translate(LED.at.x, LED.at.y, LED.at.z);
  const ledMesh = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({map: ledTexture('NANJING METRO', '')}), Math.max(1, entrances.length));
  const bandMat = toon({color: 0xffffff, emissive: 0xffffff, emissiveIntensity: .15});
  const bandMesh = new THREE.InstancedMesh(bandGeo, bandMat, Math.max(1, entrances.length));
  entrances.forEach((e, i) => {
    const r = e.line.route, k = Math.round(THREE.MathUtils.clamp(e.stop.s / SAMPLE, 0, r.n - 1));
    dummy.position.set(e.spot[0], e.y, e.spot[1]); dummy.rotation.set(0, r.hs[k], 0); dummy.updateMatrix();
    e.matrix = dummy.matrix.clone();
    entranceMesh.setMatrixAt(i, dummy.matrix); bandMesh.setMatrixAt(i, dummy.matrix); ledMesh.setMatrixAt(i, dummy.matrix);
    bandMesh.setColorAt(i, e.line.colour3);
  });
  entranceMesh.count = bandMesh.count = ledMesh.count = entrances.length;
  scene.add(entranceMesh, bandMesh, ledMesh);

  // The line, drawn through the city during a ride (it runs underground): a ribbon in its colour
  // seen through the buildings, and a six-car train on it.
  function ribbon(line) {
    const r = line.route, pos = [], idx = [];
    for (let k = 0; k < r.n; k++) {
      const c = Math.cos(r.hs[k]), s = Math.sin(r.hs[k]);
      pos.push(r.xs[k] - c * 6, r.ys[k] + 1.5, r.zs[k] + s * 6, r.xs[k] + c * 6, r.ys[k] + 1.5, r.zs[k] - s * 6);
      if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({color: line.colour3, transparent: true, opacity: .8, depthTest: false, fog: false, side: THREE.DoubleSide}));
    m.renderOrder = 10; m.visible = false; m.frustumCulled = false;
    // Its stations: white rings on the line.
    const ring = new THREE.RingGeometry(9, 15, 28).rotateX(-Math.PI / 2), mat = new THREE.MeshBasicMaterial({color: 0xffffff, depthTest: false, fog: false, side: THREE.DoubleSide});
    for (const st of line.stops) {
      const q = pose(r, st.s, {}), o = new THREE.Mesh(ring, mat);
      o.position.set(q.x, q.y + 1.6, q.z); o.renderOrder = 10; m.add(o);
    }
    scene.add(m);
    return m;
  }
  for (const line of metroLines) line.ribbon = ribbon(line);
  // Drawn half again as large as life, so the train reads from the ride's height.
  const carGeo = boxes([[4.5, 5.0, 19, 0, 0, 0, 0xf4f4f0], [4.56, .9, 19.02, 0, -.4, 0, 0xffffff], [4.58, 1.3, 17, 0, 1.0, 0, 0x2b3a44]]);
  const trainMat = toon({vertexColors: true, depthTest: false, transparent: true, opacity: .95, fog: false});
  const train = new THREE.InstancedMesh(carGeo, trainMat, 6);
  train.renderOrder = 11; train.visible = false; train.frustumCulled = false;
  scene.add(train);
  // V during a ride: inside the carriage, in its tunnel under the city (src/carriage.js).
  const carriage = createCarriage(scene);

  // --- Line 1 on its viaduct (OSM bridge=yes north of Nanjing Station): a deck on piers, ramps down
  // into the tunnel at each end, and trains running the whole line all the time at the real speed
  // and frequency, seen only where the line is above ground. ----------------------------------------
  const DECK = 9, RAMP = 260, TRAIN_SPEED = 18, HEADWAY_M = 2950;   // 65 km/h; about 3 minutes apart
  const lift = (line, s) => {
    for (const [a, b] of line.elevated || []) {
      if (s >= a && s <= b) return DECK;
      if (s > a - RAMP && s < a) return DECK - (a - s) / RAMP * (DECK + 10);
      if (s > b && s < b + RAMP) return DECK - (s - b) / RAMP * (DECK + 10);
    }
    return -10;
  };
  const viaductLines = metroLines.filter(l => l.elevated?.length);
  const runners = [];
  for (const line of viaductLines) {
    const r = line.route, parts = [], q = {};
    for (let s = 0; s < r.length; s += 4) {
      const h = lift(line, s);
      if (h < -.5) continue;
      pose(r, s, q);
      const deck = new THREE.BoxGeometry(9.4, 1.3, 4.3).translate(0, -.65, 0).rotateY(q.h).translate(q.x, q.y + h, q.z);
      parts.push(deck);
      if (h > 3 && Math.round(s) % 32 < 4) parts.push(new THREE.BoxGeometry(2.0, h, 2.6).translate(0, h / 2 - 1.3, 0).rotateY(q.h).translate(q.x, q.y, q.z));
    }
    if (parts.length) {
      const g = mergeGeometries(parts);
      const viaduct = new THREE.Mesh(g, toon({color: 0xcfcbc2}));
      viaduct.castShadow = viaduct.receiveShadow = true;
      scene.add(viaduct);
    }
  }
  // Trains on every line, both ways, all the time: real speed, about the real headway.
  for (const line of metroLines) {
    const n = Math.max(1, Math.round(line.route.length / HEADWAY_M));
    for (const dir of [1, -1]) for (let i = 0; i < n; i++) runners.push({line, dir, s: (i + (dir < 0 ? .5 : 0)) / n * line.route.length});
  }
  const runnerCar = boxes([[3.0, 3.5, 19, 0, 1.9, 0, 0xf4f4f0], [3.04, .55, 19.02, 0, 1.5, 0, 0x00a2df], [3.06, .95, 17, 0, 2.6, 0, 0x2b3a44]]);
  const runnerMesh = new THREE.InstancedMesh(runnerCar, toon({vertexColors: true}), Math.max(1, runners.length * 6));
  runnerMesh.count = runners.length * 6; runnerMesh.frustumCulled = false; runnerMesh.castShadow = true;
  scene.add(runnerMesh);
  // X-ray (the owner's choice): from high up, the lines show as faint traces through the city and
  // the trains under it as glowing bars in their line's colour; at street level both fade away, so
  // the streets stay as they are. Each train is a six-car length (117 m).
  const xrayMat = new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthTest: false, fog: false});
  const xray = new THREE.InstancedMesh(new THREE.BoxGeometry(10, 3, 117), xrayMat, Math.max(1, runners.length));
  xray.count = runners.length; xray.frustumCulled = false; xray.renderOrder = 9; xray.visible = false;
  runners.forEach((u, i) => xray.setColorAt(i, new THREE.Color(u.line.colour3).lerp(new THREE.Color(0xffffff), .25)));
  scene.add(xray);
  const traces = metroLines.map(line => {
    const m = new THREE.Mesh(line.ribbon.geometry, new THREE.MeshBasicMaterial({color: line.colour3, transparent: true, opacity: 0, depthTest: false, fog: false, side: THREE.DoubleSide}));
    m.renderOrder = 8; m.visible = false; m.frustumCulled = false; m.scale.set(1, 1, 1);
    scene.add(m);
    return m;
  });
  let xrayFade = 0;
  const eye = new THREE.Vector3();
  // Seconds until the next bus of a line reaches a stop (by name), on each run (direction): from
  // every bus of the line, the road still to drive at BUS_SPEED plus the stops between at BUS_DWELL,
  // through the turn at the end of its run if the stop is behind it.
  function busEta(line, name) {
    const best = [Infinity, Infinity];
    for (const b of buses) {
      if (b.line !== line) continue;
      for (let lap = 0; lap < 2; lap++) {
        const runIdx = lap ? 1 - b.run : b.run, run = line.runs[runIdx];
        const q = run.stops.findIndex(x => x.stop.name === name && (lap || x.s >= b.s));
        if (q < 0) continue;
        const from = lap ? 0 : b.s, before = run.stops.filter(x => x.s > from && x.s < run.stops[q].s).length;
        const ahead = lap ? line.runs[b.run].r.length - b.s : 0;
        const t = (ahead + run.stops[q].s - from) / BUS_SPEED + (before + lap * 3) * BUS_DWELL + Math.max(0, b.wait);
        best[runIdx] = Math.min(best[runIdx], t);
        break;
      }
    }
    return best;
  }
  const busBoardMat = new THREE.MeshBasicMaterial({map: ledTexture('', '')});
  const busBoard = new THREE.Mesh(new THREE.PlaneGeometry(BUS_LED.w, BUS_LED.h).translate(BUS_LED.at.x, BUS_LED.at.y, BUS_LED.at.z + .004), busBoardMat);
  busBoard.matrixAutoUpdate = false; busBoard.visible = false; scene.add(busBoard);
  let busBoardAt = null, busBoardClock = 0;
  function updateBusBoard(dt, x, z) {
    let best = null, bd = 45;
    for (const st of stopsAll) { const d = Math.hypot(st.spot[0] - x, st.spot[1] - z); if (d < bd) { bd = d; best = st; } }
    busBoard.visible = !!best && !bus;
    if (!busBoard.visible) { busBoardAt = null; return; }
    busBoardClock -= dt;
    if (best === busBoardAt && busBoardClock > 0) return;
    busBoardAt = best; busBoardClock = 1;
    busBoard.matrix.copy(best.matrix);
    // Each line calling here, each way: "34路 → 中山门 2 min".
    const min = t => (t < 60 ? '<1' : Math.round(t / 60)) + ' min';
    const parts = [];
    for (const line of busLines) {
      const eta = busEta(line, best.name);
      for (const runIdx of [0, 1]) {
        if (!line.runs[runIdx].stops.some(q => q.stop.shelter === best) || !Number.isFinite(eta[runIdx])) continue;
        const end = runIdx === 0 ? line.stops[line.stops.length - 1] : line.stops[0];
        if (end.name === best.name) continue;
        parts.push(`${line.ref} → ${end.en || end.name} ${min(eta[runIdx])}`);
      }
    }
    busBoardMat.map.dispose();
    busBoardMat.map = ledTexture(`${best.en || best.name}  ${best.name}`, parts.length ? 'Bus  ' + parts.join('   ') : 'No bus now', '#2f8f5b');
    busBoardMat.needsUpdate = true;
  }

  // The nearest entrance's LED (within 45 m): this station's name, large, and each line's next
  // train, small, redrawn each second from the running trains. And in its open doorway, an enter
  // note that fades in as the walker comes up to it.
  const boardMat = new THREE.MeshBasicMaterial({map: ledTexture('', '')});
  const board = new THREE.Mesh(new THREE.PlaneGeometry(LED.w, LED.h).translate(LED.at.x, LED.at.y, LED.at.z + .004), boardMat);
  board.matrixAutoUpdate = false; board.visible = false; scene.add(board);
  const noteMat = new THREE.MeshBasicMaterial({map: noteTexture(), transparent: true, opacity: 0, depthWrite: false});
  const note = new THREE.Mesh(new THREE.PlaneGeometry(1.5, .42), noteMat);
  note.visible = false; note.renderOrder = 5; scene.add(note);
  const local = new THREE.Vector3(), inverse = new THREE.Matrix4();
  let boardAt = null, boardClock = 0;
  function updateBoard(dt, x, z) {
    let best = null, bd = 45;
    for (const e of entrances) { const d = Math.hypot(e.spot[0] - x, e.spot[1] - z); if (d < bd) { bd = d; best = e; } }
    board.visible = !!best && !metro && !carriage.active;
    if (!board.visible) { boardAt = null; note.visible = false; noteMat.opacity = 0; return; }
    boardClock -= dt;
    if (best !== boardAt || boardClock <= 0) {
      boardAt = best; boardClock = 1;
      board.matrix.copy(best.matrix);
      const here = entrances.filter(e => e.stop.osm === best.stop.osm);
      const times = here.map(e => { const w = nextTrain(e.line, e.stop); return `Line ${e.line.ref} · ${w < 60 ? '<1' : Math.round(w / 60)} min`; });
      boardMat.map.dispose();
      boardMat.map = ledTexture(`${best.stop.en || best.stop.name}  ${best.stop.name}`, 'Next train   ' + times.join('     '), best.line.colour);
      boardMat.needsUpdate = true;
    }
    // The enter note: in the doorway, at eye height, while the walker stands within about 8 m in
    // front of it.
    local.set(x, best.y, z).applyMatrix4(inverse.copy(best.matrix).invert());
    const near = local.z > 1.5 && Math.abs(local.x) < 4 ? THREE.MathUtils.clamp((8 - Math.hypot(local.x, local.z - 2.6)) / 3, 0, 1) : 0;
    noteMat.opacity = THREE.MathUtils.damp(noteMat.opacity, near * .92, 6, dt);
    note.visible = noteMat.opacity > .02;
    if (note.visible) {
      note.position.set(0, 1.75, 2.75).applyMatrix4(best.matrix);
      note.rotation.set(0, Math.atan2(x - note.position.x, z - note.position.z), 0);
    }
  }
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0), rq = {};
  function updateRunners(dt) {
    runners.forEach((u, i) => {
      const r = u.line.route;
      u.s = ((u.s + u.dir * TRAIN_SPEED * dt) % r.length + r.length) % r.length;
      for (let c = 0; c < 6; c++) {
        const s = u.s - u.dir * c * 19.5, h = lift(u.line, s);
        if (h < -3.6 || s < 0 || s > r.length) { runnerMesh.setMatrixAt(i * 6 + c, hidden); continue; }
        pose(r, s, rq);
        // Each direction on its own track, 2.2 m right of the centre.
        const side = 2.2, x = rq.x - Math.cos(rq.h) * side * u.dir, z = rq.z + Math.sin(rq.h) * side * u.dir;
        dummy.position.set(x, rq.y + h, z); dummy.rotation.set(0, rq.h + (u.dir < 0 ? Math.PI : 0), 0); dummy.updateMatrix();
        runnerMesh.setMatrixAt(i * 6 + c, dummy.matrix);
      }
      // Its x-ray: the train's middle, wherever it is underground.
      const mid = u.s - u.dir * 48.75;
      if (xrayFade > .01 && lift(u.line, mid) < 0 && mid > 0 && mid < r.length) {
        pose(r, mid, rq);
        const x = rq.x - Math.cos(rq.h) * 2.5 * u.dir, z = rq.z + Math.sin(rq.h) * 2.5 * u.dir;
        // Wider with distance, so a train still reads a kilometre away.
        const k = Math.max(1, Math.hypot(x - eye.x, z - eye.z) / 350);
        dummy.position.set(x, rq.y + 2, z); dummy.rotation.set(0, rq.h, 0); dummy.scale.set(k, k, 1); dummy.updateMatrix();
        dummy.scale.set(1, 1, 1);
        xray.setMatrixAt(i, dummy.matrix);
      } else xray.setMatrixAt(i, hidden);
    });
    runnerMesh.instanceMatrix.needsUpdate = true;
    xray.instanceMatrix.needsUpdate = true;
  }
  // Seconds until the next train calls at a station (either way), from the running trains.
  function nextTrain(line, stop) {
    let best = Infinity;
    for (const u of runners) {
      if (u.line !== line) continue;
      const L = u.line.route.length, d = (((stop.s - u.s) * u.dir) % L + L) % L;
      best = Math.min(best, d / TRAIN_SPEED);
    }
    return best;
  }
  // 0..1: how near a train runs beneath (x, z), for the rumble underfoot.
  function rumbleAt(x, z) {
    let best = 0;
    for (const u of runners) {
      for (const c of [0, 2.5, 5]) {
        const sc = u.s - u.dir * c * 19.5;
        if (lift(u.line, sc) > 0) continue;
        pose(u.line.route, sc, rq);
        const d = Math.hypot(rq.x - x, rq.z - z);
        if (d < 30) best = Math.max(best, 1 - d / 30);
      }
    }
    return best;
  }

  // --- State: waiting at a stop, aboard a bus, or riding the metro ----------------------------------
  let wait = null, bus = null, metro = null, alightDefault = null, pathHash = null;
  const busPose = (b, out) => pose(b.line.runs[b.run].r, b.s, out);

  // Whether another bus stands in this bus's lane less than 16 m ahead (any line: 1, 25 and 34 share
  // Zhongshan Road). Then it waits, as a bus queues at a stop or behind another at the lights.
  function blockedAhead(b) {
    if (b.p.x === undefined) return false;
    const fx = Math.sin(b.p.h), fz = Math.cos(b.p.h);
    for (const o of buses) {
      if (o === b || o.p.x === undefined) continue;
      const dx = o.p.x - b.p.x, dz = o.p.z - b.p.z, along = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if ((along > .5 || along > -.5 && buses.indexOf(o) < buses.indexOf(b)) && along < 16 && side < 2.2 && Math.cos(o.p.h - b.p.h) > .6) return true;
    }
    return false;
  }
  function updateBuses(dt) {
    buses.forEach((b, i) => {
      const run = b.line.runs[b.run];
      if (b.wait > 0) {
        b.wait -= dt;
        if (wait && b.at && b.at.shelter === (wait.stop.shelter || wait.stop) && (!wait.line || b.line === wait.line) && !bus) { bus = {b, alight: false, from: b.at}; wait.done?.(b); wait = null; }
      } else {
        if (!blockedAhead(b)) b.s += BUS_SPEED * dt * (bus?.b === b ? 1.6 : 1);    // a rider's bus is hurried along a little
        const q = run.stops[b.next];
        if (q && b.s >= q.s) {
          b.s = q.s; b.wait = BUS_DWELL; b.at = q.stop; b.next++;
          // Off here if asked, and at the end of the line everyone gets off: a bus turns at its
          // terminus and goes back the way it came.
          const last = q === run.stops[run.stops.length - 1];
          const there = bus?.b === b && bus.dest && q.stop.name === bus.dest.name;
          if (bus?.b === b && (bus.alight || last || there)) { const off = bus.off || alightDefault; bus = null; off?.(q.stop, last, b.line); }
        } else if (b.next < 0 || !q) b.next = run.stops.findIndex(q2 => q2.s > b.s);
        if (b.s >= run.r.length) { b.run = 1 - b.run; b.s = 0; b.next = b.line.runs[b.run].stops.findIndex(q2 => q2.s > 0); }
      }
      busPose(b, b.p);
      dummy.position.set(b.p.x, b.p.y, b.p.z); dummy.rotation.set(0, b.p.h, 0); dummy.updateMatrix();
      busMesh.setMatrixAt(i, dummy.matrix); busWindows.setMatrixAt(i, dummy.matrix);
    });
    busMesh.instanceMatrix.needsUpdate = busWindows.instanceMatrix.needsUpdate = true;
  }

  const trainPose = {};
  function updateMetro(dt) {
    if (!metro) return;
    metro.t += dt;
    const k = Math.min(1, metro.t / metro.seconds), e = k * k * (3 - 2 * k);
    metro.s = metro.s0 + (metro.s1 - metro.s0) * e;
    const r = metro.line.route, dir = Math.sign(metro.s1 - metro.s0) || 1;
    for (let c = 0; c < 6; c++) {
      pose(r, metro.s - dir * c * 19.5, trainPose);
      dummy.position.set(trainPose.x, trainPose.y + 3.2, trainPose.z); dummy.rotation.set(0, trainPose.h, 0); dummy.updateMatrix();
      train.setMatrixAt(c, dummy.matrix);
    }
    train.instanceMatrix.needsUpdate = true;
    carriage.update(metro);
    // Call the stations as the train passes them.
    const passed = metro.line.stops.find(st => !metro.called.has(st.name) && (metro.s - st.s) * dir >= 0 && (st.s - metro.s0) * dir > 0);
    if (passed) { metro.called.add(passed.name); metro.onStation?.(passed, passed === metro.to); }
    if (k >= 1) { const m = metro; metro = null; train.visible = false; m.line.ribbon.visible = false; carriage.show(false); m.arrive?.(m.toEntrance); }
  }

  return {
    lines: data.lines,
    entrances,
    stops: stopsAll,      // the bus stops, one per shelter (the map and the minimap draw them)
    buses,
    // Places that must stay clear: within r of these nothing should stand (trees, lamps).
    clearings() {
      const out = [];
      for (const st of stopsAll) out.push([st.spot[0], st.spot[1], 6]);
      for (const e of entrances) out.push([e.spot[0], e.spot[1], 7]);
      return out;
    },
    // Whether a point lies within r of any bus's path (a lamp there would stand in the bus).
    onBusPath(x, z, r = 2.2) {
      if (!pathHash) {
        pathHash = new Map();
        for (const line of busLines) for (const run of line.runs) {
          const R = run.r;
          for (let k = 0; k < R.n; k++) {
            const key = Math.floor(R.xs[k] / 8) * 100000 + Math.floor(R.zs[k] / 8);
            (pathHash.get(key) || pathHash.set(key, []).get(key)).push(R.xs[k], R.zs[k]);
          }
        }
      }
      const i0 = Math.floor(x / 8), j0 = Math.floor(z / 8);
      for (let i = i0 - 1; i <= i0 + 1; i++) for (let j = j0 - 1; j <= j0 + 1; j++) {
        const pts = pathHash.get(i * 100000 + j);
        if (pts) for (let q = 0; q < pts.length; q += 2) if (Math.hypot(pts[q] - x, pts[q + 1] - z) < r) return true;
      }
      return false;
    },
    runners,
    lift,
    get busRide() { return bus; },
    get metroRide() { return metro; },
    get waiting() { return wait; },
    // above: the camera's height over the ground under it, for the x-ray's fade.
    update(dt, night = 0, above = 0, walker = null, camera = null) {
      if (camera) eye.copy(camera.position);
      if (walker) { updateBoard(dt, walker.x, walker.z); updateBusBoard(dt, walker.x, walker.z); }
      xrayFade = carriage.active ? 0 : THREE.MathUtils.smoothstep(above, 45, 170);
      xray.visible = xrayFade > .01;
      xrayMat.opacity = .95 * xrayFade;
      traces.forEach((m, i) => { m.visible = xray.visible && !metroLines[i].ribbon.visible; m.material.opacity = .4 * xrayFade; });
      updateBuses(dt);
      updateMetro(dt);
      updateRunners(dt);
      glassMat.color.setRGB(.56 + night * .4, .7 + night * .12, .76 - night * .3);
      glassMat.opacity = .32 + night * .3;
      bandMat.emissiveIntensity = .15 + night * .9;
    },
    // The nearest bus stop or metro entrance within r metres of (x, z).
    nearest(x, z, r = 6) {
      let best = null;
      for (const st of stopsAll) {
        const d = Math.hypot(st.spot[0] - x, st.spot[1] - z);
        if (d < r && (!best || d < best.d)) best = {kind: 'bus', stop: st, line: st.line, d};
      }
      for (const e of entrances) {
        const d = Math.hypot(e.spot[0] - x, e.spot[1] - z);
        if (d < r && (!best || d < best.d)) best = {kind: 'metro', entrance: e, stop: e.stop, line: e.line, d};
      }
      return best;
    },
    // Wait at a bus stop for the next bus of any route that calls there; done(bus) when it boards.
    waitAt(stop, done, line = null) {
      wait = {stop, done, line};
      const here = q2 => q2.stop.shelter === (stop.shelter || stop);
      const coming = buses.filter(b => (!line || b.line === line) && b.line.runs[b.run].stops.some(here));
      const ahead = coming.map(b => b.line.runs[b.run].stops.find(here).s - b.s).filter(d => d >= 0);
      return ahead.length ? Math.min(...ahead) : null;
    },
    cancelWait() { wait = null; },
    // Aboard: where the rider sits, and their heading.
    seat(out) {
      if (!bus) return null;
      busPose(bus.b, out);
      // A window seat on the right, three rows from the back: the seat at sill height, so the view
      // (SIT_EYE above it) looks out through the glass.
      out.x += -Math.sin(out.h) * 2.1 - Math.cos(out.h) * .85;
      out.z += -Math.cos(out.h) * 2.1 + Math.sin(out.h) * .85;
      out.y += 1.25;
      return out;
    },
    // Off at the next stop; at once if the bus stands at a stop other than the one boarded at.
    linesAt(stop) {
      const shelter = stop.shelter || stop, out = [];
      for (const line of busLines) for (const runIdx of [0, 1]) {
        if (!line.runs[runIdx].stops.some(q => q.stop.shelter === shelter)) continue;
        const end = runIdx === 0 ? line.stops[line.stops.length - 1] : line.stops[0];
        if (end.name === shelter.name) continue;
        out.push({line, run: runIdx, end, eta: busEta(line, shelter.name)[runIdx]});
      }
      return out;
    },
    // The stops still ahead, with about how long to each: on the bus being ridden, or (before
    // boarding) on a line's run from this stop. The owner asked to choose where to get off.
    stopsAhead(line = null, runIdx = null, from = null) {
      let run, s0, i0;
      if (bus && !line) {
        run = bus.b.line.runs[bus.b.run]; s0 = bus.b.s;
        i0 = run.stops.findIndex(q => q.s > s0 + .5);
      } else {
        run = line.runs[runIdx];
        const k = run.stops.findIndex(q => q.stop.shelter === (from.shelter || from));
        if (k < 0) return [];
        s0 = run.stops[k].s; i0 = k + 1;
      }
      if (i0 < 0) return [];
      const fast = BUS_SPEED * 1.6;
      return run.stops.slice(i0).map((q, n) => ({stop: q.stop, seconds: (q.s - s0) / fast + n * BUS_DWELL}));
    },
    // Get off at a chosen stop further along (instead of the next one); off(stop) on arrival.
    setDestination(stop, off) { if (bus) { bus.dest = stop; bus.alight = false; bus.off = off; } },
    // Where an alighting rider goes when they did not ask to get off (the terminus).
    setAlight(fn) { alightDefault = fn; },
    requestStop(off) { if (bus) { bus.alight = true; bus.dest = null; bus.off = off; if (bus.b.wait > 0 && bus.b.at !== bus.from) { off(bus.b.at); bus = null; } } },
    // Ride the metro from one station to another on the same line. Calls onStation(stop, last) as
    // stations pass and arrive(entrance) at the end.
    rideMetro(line, from, to, {onStation, arrive} = {}) {
      const toEntrance = entrances.find(e => e.line === line && e.stop === to);
      const seconds = Math.max(6, Math.abs(to.s - from.s) / METRO_SPEED + 4);
      metro = {line, from, to, toEntrance, s0: from.s, s1: to.s, s: from.s, t: 0, seconds, called: new Set([from.name]), onStation, arrive};
      line.ribbon.visible = true; train.visible = true;
      // The train takes on its line's colour (Line 1 blue, Line 2 red, Line 4 purple).
      for (let c = 0; c < 6; c++) train.setColorAt(c, new THREE.Color(0xffffff).lerp(line.colour3, .55));
      train.instanceColor.needsUpdate = true;
      bandMat.needsUpdate = true;
      return seconds;
    },
    // The camera during a metro ride: high behind the train, looking down the line ahead.
    get inCarriage() { return carriage.active; },
    nextTrain,
    rumbleAt,
    get xray() { return xrayFade; },
    // The camera during a metro ride. First person: in the carriage (drag to look round; it starts
    // facing forward). Third person: high behind the train, looking down the line ahead.
    metroCamera(camera, dt, view = 'third') {
      if (!metro) return false;
      const inside = view === 'first';
      if (inside !== carriage.active) {
        carriage.show(inside, metro);
        metro.line.ribbon.visible = train.visible = !inside;
        if (inside) { camera.rotation.set(0, 0, 0, 'YXZ'); carriage.update(metro); }
      }
      if (inside) { camera.position.copy(carriage.eye); return true; }
      const r = metro.line.route, dir = Math.sign(metro.s1 - metro.s0) || 1, p = pose(r, metro.s, {}), a = pose(r, metro.s + dir * 160, {});
      const back = pose(r, metro.s - dir * 260, {});
      const eye = new THREE.Vector3(back.x, Math.max(p.y, back.y) + 190, back.z);
      camera.position.lerp(eye, 1 - Math.exp(-dt * 3));
      camera.lookAt(a.x, a.y, a.z);
      return true;
    },
    stats() {
      return {buses: buses.length, busLines: busLines.length, stops: stopsAll.length, entrances: entrances.length,
        busAt: buses.slice(0, 3).map(b => [+b.p.x?.toFixed(1), +b.p.z?.toFixed(1), +b.s.toFixed(1)]), riding: !!bus, metro: !!metro,
        trains: runners.length, trainsAboveGround: runners.filter(u => lift(u.line, u.s) > 0).length};
    },
  };
}
