import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Inside a metro carriage (V during a ride, src/transit.js): a six-car train's middle car in a
// tunnel, deep under the city where nothing else is drawn. The tunnel's lights stream past the
// windows; each station's platform slides by with its name on the wall, and the last one stops
// alongside. Distances along the line are shrunk SCALE times so the ride, sped up to seconds, still
// passes platforms at a believable pace.
//
// Nanjing's cars: longitudinal benches, grab poles, a lit ceiling strip, a line-coloured band
// (research/transit/FACTS.md; the interior's details are an assumption).

const DEPTH = -400;            // metres below the city: the tunnel is enclosed, so nothing above shows
const SCALE = 1 / 6;           // tunnel metres per metre of line
const TUNNEL = 700;            // length of tunnel drawn
const LIGHT_GAP = 9;           // metres between tunnel lights
const PLATFORM = 120;          // a six-car platform

// Boxes with baked light (top faces brighter, sides by direction): the carriage is lit by itself,
// not by the sun far above.
function shaded(list) {
  return mergeGeometries(list.map(([w, h, l, x, y, z, c]) => {
    const g = new THREE.BoxGeometry(w, h, l).toNonIndexed();
    g.translate(x, y, z);
    const col = new THREE.Color(c), n = g.attributes.normal, arr = new Float32Array(n.count * 3);
    for (let i = 0; i < n.count; i++) {
      const k = .78 + .22 * n.getY(i) + .06 * n.getX(i) - .04 * n.getZ(i);
      arr[i * 3] = col.r * k; arr[i * 3 + 1] = col.g * k; arr[i * 3 + 2] = col.b * k;
    }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    return g;
  }));
}

// A sign: Chinese name large, English below, on a coloured or white board.
export function signTexture(lines, {bg = '#1d2a33', fg = '#ffffff', accent = null, w = 512, h = 160} = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (accent) { g.fillStyle = accent; g.fillRect(0, h - 18, w, 18); }
  g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `600 ${Math.round(h * .38)}px "Noto Sans SC", "Microsoft YaHei", sans-serif`;
  g.fillText(lines[0], w / 2, h * (lines[1] ? .38 : .48), w - 24);   // long English names shrink to fit
  if (lines[1]) { g.font = `600 ${Math.round(h * .2)}px "Noto Sans", sans-serif`; g.fillText(lines[1], w / 2, h * .74, w - 20); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createCarriage(scene) {
  const group = new THREE.Group();
  group.position.set(0, DEPTH, 0);
  group.visible = false;
  scene.add(group);
  const basic = (opts) => new THREE.MeshBasicMaterial({fog: true, ...opts});

  // --- The car: floor at 1.1 m above the rails, 2.9 m wide inside, 19 m long, facing -z ----------
  const W = 1.45, FLOOR = 1.1, CEIL = 3.3, HALF = 9.5;
  const body = [
    [2.9, .1, 19, 0, FLOOR - .05, 0, 0x8a8e8c],                                    // floor
    [2.9, .1, 19, 0, CEIL + .05, 0, 0xe9ebe6],                                     // ceiling
    ...[-1, 1].flatMap(s => [
      [.08, .8, 19, s * W, FLOOR + .4, 0, 0xdfe2dc],                               // wall under the windows
      [.08, .55, 19, s * W, CEIL - .27, 0, 0xdfe2dc],                              // wall over them
      [.5, .12, 17, s * (W - .27), FLOOR + .45, 0, 0xb9c2c4],                      // stainless bench
      [.08, .5, 17, s * (W - .04), FLOOR + .7, 0, 0xb9c2c4],                       // its back
    ]),
    [2.9, 2.2, .1, 0, FLOOR + 1.1, -HALF, 0xdfe2dc], [2.9, 2.2, .1, 0, FLOOR + 1.1, HALF, 0xdfe2dc],   // end walls
  ];
  // Window pillars every 2.4 m, and grab poles down the aisle.
  for (let z = -HALF + 1.2; z < HALF; z += 2.4) for (const s of [-1, 1]) body.push([.1, .85, .18, s * W, FLOOR + 1.22, z, 0xdfe2dc]);
  for (let z = -7.5; z <= 7.5; z += 3) for (const s of [-1, 1]) body.push([.05, 2.2, .05, s * .62, FLOOR + 1.1, z, 0xd8dcdc]);
  group.add(new THREE.Mesh(shaded(body), basic({vertexColors: true})));
  const strip = new THREE.Mesh(new THREE.BoxGeometry(.5, .04, 17).translate(0, CEIL - .02, 0), basic({color: 0xfffbea}));
  // The line's colour runs along the car above the windows.
  const bandMat = basic({color: 0x00a2df});
  const bands = [-1, 1].map(s => new THREE.Mesh(new THREE.BoxGeometry(.02, .12, 19).translate(s * (W - .05), CEIL - .6, 0), bandMat));
  group.add(strip, ...bands);
  // "Next station" over the front door.
  const nextMat = basic({map: signTexture(['', ''], {w: 512, h: 128})});
  const nextSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, .4), nextMat);
  nextSign.position.set(0, CEIL - .35, -HALF + .07);
  group.add(nextSign);

  // --- The tunnel: dark walls, cable trays, lights that stream past ------------------------------
  const tunnel = new THREE.Mesh(shaded([
    [8, .3, TUNNEL, 0, -.15, 0, 0x3a3c3c], [8, .3, TUNNEL, 0, 5.4, 0, 0x2f3132],
    [.3, 5.6, TUNNEL, -4.1, 2.6, 0, 0x3d4041], [.3, 5.6, TUNNEL, 4.1, 2.6, 0, 0x3d4041],
    ...[-1, 1].flatMap(s => [[.12, .08, TUNNEL, s * 3.9, 1.6, 0, 0x1f2122], [.12, .08, TUNNEL, s * 3.9, 1.85, 0, 0x1f2122]]),
    [8, 6, .3, 0, 2.6, -TUNNEL / 2, 0x121314], [8, 6, .3, 0, 2.6, TUNNEL / 2, 0x121314],
  ]), basic({vertexColors: true}));
  group.add(tunnel);
  const nLights = Math.floor(TUNNEL / LIGHT_GAP);
  const lights = new THREE.InstancedMesh(new THREE.BoxGeometry(.12, .12, 1.2), basic({color: 0xfff1cc}), nLights * 2);
  lights.frustumCulled = false;
  group.add(lights);

  // --- Platforms: one per station, built when first needed --------------------------------------
  const platforms = new Map();
  function platform(stop, line) {
    const key = line.id + stop.name;
    if (platforms.has(key)) return platforms.get(key);
    const g = new THREE.Group();
    g.add(new THREE.Mesh(shaded([
      // Inside the tunnel's walls (x 1.6 to 4.0): the platform, its yellow edge, a tiled wall.
      [2.4, 1.1, PLATFORM, 2.8, .55, 0, 0xc9c6bd],
      [.3, .02, PLATFORM, 1.8, 1.11, 0, 0xe2c84a],
      [.1, 4.6, PLATFORM, 3.95, 3.3, 0, 0xe6e4dc],
      ...Array.from({length: 9}, (_, i) => [.45, 4.2, .45, 3.45, 3.2, -PLATFORM / 2 + 7 + i * 13.25, 0xd4d1c8]),
    ]), basic({vertexColors: true})));
    // Ceiling lights over the platform.
    g.add(new THREE.Mesh(new THREE.BoxGeometry(.4, .06, PLATFORM - 4).translate(2.8, 4.9, 0), basic({color: 0xffffff})));
    const tex = signTexture([stop.en || stop.name, stop.name], {accent: line.colour || '#888'});   // English first, the Chinese below
    for (let i = 0; i < 4; i++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.0), basic({map: tex}));
      s.position.set(3.88, 3.0, -PLATFORM / 2 + 16 + i * 29); s.rotation.y = -Math.PI / 2;
      g.add(s);
    }
    g.visible = false;
    group.add(g);
    platforms.set(key, g);
    return g;
  }

  const dummy = new THREE.Object3D();
  let scroll = 0, lastS = null, shownNext = null;
  return {
    group,
    get active() { return group.visible; },
    show(on, metro) {
      group.visible = on;
      if (on && metro) {
        bandMat.color.set(metro.line.colour || '#888');
        for (const p of platforms.values()) p.visible = false;
        lastS = null; shownNext = null;
      }
    },
    // Move the tunnel's lights and the platforms for the ride's place on the line.
    update(metro) {
      if (!group.visible || !metro) return;
      const dir = Math.sign(metro.s1 - metro.s0) || 1;
      if (lastS !== null) scroll += Math.abs(metro.s - lastS) * SCALE;
      lastS = metro.s;
      for (let k = 0; k < nLights; k++) {
        const z = ((k * LIGHT_GAP + scroll) % TUNNEL) - TUNNEL / 2;
        for (const s of [0, 1]) {
          dummy.position.set(s ? 3.8 : -3.8, 4.4, z); dummy.updateMatrix();
          lights.setMatrixAt(k * 2 + s, dummy.matrix);
        }
      }
      lights.instanceMatrix.needsUpdate = true;
      // Platforms of the stations within reach: ahead (toward -z) while the station is still to come.
      let next = null;
      for (const st of metro.line.stops) {
        const ahead = (st.s - metro.s) * dir * SCALE;
        const near = Math.abs(ahead) < TUNNEL / 2 - PLATFORM / 2;
        const passed = (st.s - metro.s0) * dir <= 0 || (st.s - metro.s1) * dir > 0;   // behind the start or past the end
        const p = near && !passed ? platform(st, metro.line) : platforms.get(metro.line.id + st.name);
        if (p) { p.visible = near && !passed; p.position.z = -ahead; }
        if (!passed && ahead > -2 && (!next || ahead < next.ahead)) next = {st, ahead};
      }
      const label = next ? next.st : metro.to;
      if (label !== shownNext) {
        shownNext = label;
        nextMat.map.dispose();
        nextMat.map = signTexture([`Next: ${label.en || label.name}`, label.name], {w: 512, h: 128, accent: metro.line.colour});
        nextMat.needsUpdate = true;
      }
    },
    // A seat by the window near the back of the car, looking forward down the aisle.
    eye: new THREE.Vector3(0, DEPTH + FLOOR + 1.55, 6.5),
  };
}
