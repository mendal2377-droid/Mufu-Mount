// Xuanwu Lake's life in the city (item 38; design/XUANWU-PLAN.md, research/xuanwu/FACTS.md):
// carp under the surface, a culter that jumps now and then, name boards at the gates, on the
// five islands and at their landmarks, and how far each patch of water lies from a shore (the water shader is paler and
// greener in the shallows, deeper blue in open water).
//
// Fish: a 1997 survey sampled silver carp, bighead carp and topmouth culter, and the park releases
// fish every year. The water is drawn opaque, so the carp are their dark backs just under it, as
// they are seen from a bridge. None in winter's cold shallows. They scatter from a boat.
import * as THREE from 'three';

// Browser frame: x east, z = -north (the core's metres). Positions from OSM (FACTS.md).
const LAKE = {x0: -260, x1: 1700, n0: 2560, n1: 4620};
const BOARDS = [
  // [English, Chinese, line, x, north, step toward (x, north)]
  ['Xuanwu Gate', '玄武门', 'Opened in 1909 for the Nanyang Exposition', -134, 3410, -95, 3410],
  ['Jiefang Gate', '解放门', 'Up the wall here; Jiming Temple behind', 739, 2489, 760, 2525],
  ['Huanzhou', '环洲', 'Mists and Willows', 447, 3616, 447, 3616],
  ['Yingzhou', '樱洲', 'The Cherry Blossom Isle', 474, 3568, 474, 3568],
  ['Liangzhou', '梁洲', 'Autumn Chrysanthemums', 544, 4086, 544, 4086],
  ['Cuizhou', '翠洲', 'Pine, Cypress and Bamboo', 1003, 4007, 1003, 4007],
  ['Lingzhou', '菱洲', 'Mountain Mists: the view to Purple Mountain', 916, 3132, 916, 3132],
  // The island landmarks (blender/core_xuanwu.py): OSM names none of them, so each board says where
  // its place came from. [.., the landmark, the board's spot in front of it]
  ['Lama Temple', '喇嘛庙', 'Built 1937 · placed from the park map', 591, 3712, 582, 3693],   // beside the stair, off its path
  ['Guo Pu Mound', '郭璞墩', 'The poet Guo Pu’s cenotaph · placed from the park map', 214, 3573, 214, 3557],
  ['Lansheng Building', '览胜楼', 'Rebuilt 1909 · placed from the park map', 524, 4239, 524, 4228],
];

function boardTexture(en, zh, line) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 420;
  const g = c.getContext('2d');
  g.fillStyle = '#5b3a26'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#f3ead6'; g.fillRect(18, 18, c.width - 36, c.height - 36);
  g.strokeStyle = '#8a5a3a'; g.lineWidth = 6; g.strokeRect(34, 34, c.width - 68, c.height - 68);
  g.fillStyle = '#2e3b33'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 108px "Playfair Display", Georgia, serif';
  g.fillText(en, c.width / 2, 132, c.width - 110);
  g.font = '500 76px "Noto Sans SC", "Microsoft YaHei", sans-serif';
  g.fillStyle = '#a3392b';
  g.fillText(zh, c.width / 2, 238);
  g.font = 'italic 46px Georgia, serif'; g.fillStyle = '#4b5a50';
  g.fillText(line, c.width / 2, 330, c.width - 110);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Distance to the nearest shore over the lake and the city's other water, in an 8 m texture:
// 0 at the bank, 1 from 60 m out. A two-pass chamfer transform over water.bin.
export function shoreField(waterAt, box = {x0: -1500, x1: 2100, n0: -1520, n1: 6000}, cell = 8) {
  const nx = Math.ceil((box.x1 - box.x0) / cell), ny = Math.ceil((box.n1 - box.n0) / cell);
  const d = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const x = box.x0 + (i + .5) * cell, n = box.n0 + (j + .5) * cell;
    d[j * nx + i] = waterAt(x, -n) === null ? 0 : 1e6;
  }
  const a = cell, b = cell * Math.SQRT2;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + a);
    if (j > 0) { v = Math.min(v, d[k - nx] + a); if (i > 0) v = Math.min(v, d[k - nx - 1] + b); if (i < nx - 1) v = Math.min(v, d[k - nx + 1] + b); }
    d[k] = v;
  }
  for (let j = ny - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; let v = d[k];
    if (i < nx - 1) v = Math.min(v, d[k + 1] + a);
    if (j < ny - 1) { v = Math.min(v, d[k + nx] + a); if (i < nx - 1) v = Math.min(v, d[k + nx + 1] + b); if (i > 0) v = Math.min(v, d[k + nx - 1] + b); }
    d[k] = v;
  }
  // Rows run north to south in texture v, as browser z: v = (z - zMin) / depth.
  const px = new Uint8Array(nx * ny);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) px[(ny - 1 - j) * nx + i] = Math.round(Math.min(d[j * nx + i] / 60, 1) * 255);
  const tex = new THREE.DataTexture(px, nx, ny, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
  // xMin, zMin (browser z of the north edge), width, depth.
  return {tex, box: new THREE.Vector4(box.x0, -box.n1, box.x1 - box.x0, box.n1 - box.n0)};
}

export function createXuanwuLife(scene, {waterAt, heightAt, nearest, shared}) {
  const root = new THREE.Group();
  root.name = 'Xuanwu life';
  scene.add(root);

  // Name boards: a board on two posts, readable from both sides, on walkable ground near each place.
  const post = new THREE.MeshToonMaterial({color: 0x5b3a26});
  const boards = [];
  for (const [en, zh, line, x, n, tx, tn] of BOARDS) {
    const at = nearest(heightAt, tx, -tn, 60);
    if (!at) continue;
    const y = heightAt(at[0], at[1]);
    const g = new THREE.Group();
    // Two faces back to back, so the words read the right way round from either side.
    const mat = new THREE.MeshBasicMaterial({map: boardTexture(en, zh, line), toneMapped: false});
    for (const turn of [0, Math.PI]) {
      const face = new THREE.Mesh(new THREE.PlaneGeometry(2.4, .98), mat);
      face.position.y = 1.75; face.rotation.y = turn;
      g.add(face);
    }
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(.12, 2.3, .12), post);
      p.position.set(s * 1.1, 1.15, -.02); g.add(p);
    }
    g.position.set(at[0], y, at[1]);
    // Facing the way a visitor arrives: from the gate's opening, or from the island's middle out.
    g.rotation.y = Math.atan2(x - at[0], -n - at[1]) + (en.endsWith('Gate') ? 0 : Math.PI);
    root.add(g);
    boards.push({en, at});
  }

  // Carp: schools of dark backs gliding just under the water, wandering inside the lake.
  const SCHOOLS = 14, PER = 12;
  const fishGeo = new THREE.SphereGeometry(.5, 8, 4).scale(.28, .06, 1.1);
  const fishMat = new THREE.MeshBasicMaterial({color: 0x23302c, transparent: true, opacity: .42, depthWrite: false});
  const fish = new THREE.InstancedMesh(fishGeo, fishMat, SCHOOLS * PER);
  fish.frustumCulled = false; fish.renderOrder = 2;
  root.add(fish);
  const rnd = mulberry(38);
  const schools = [];
  for (let s = 0; s < SCHOOLS; s++) {
    let x = 0, z = 0;
    for (let k = 0; k < 200; k++) {
      x = LAKE.x0 + rnd() * (LAKE.x1 - LAKE.x0); z = -(LAKE.n0 + rnd() * (LAKE.n1 - LAKE.n0));
      if (waterAt(x, z) !== null && waterAt(x + 20, z) !== null && waterAt(x - 20, z) !== null && waterAt(x, z + 20) !== null && waterAt(x, z - 20) !== null) break;
    }
    schools.push({x, z, h: rnd() * 6.28, v: 1.2 + rnd() * .8, turn: 0, fish: Array.from({length: PER}, () => ({dx: (rnd() - .5) * 7, dz: (rnd() - .5) * 7, ph: rnd() * 6.28, s: .75 + rnd() * .6}))});
  }
  // The culter: a silver flash out of the water now and then, near the visitor.
  const culter = new THREE.Mesh(new THREE.SphereGeometry(.5, 8, 4).scale(.16, .14, .9), new THREE.MeshToonMaterial({color: 0xd8dee0}));
  culter.visible = false; root.add(culter);
  let jump = null, nextJump = 6;
  const dummy = new THREE.Object3D();

  return {
    boards,
    update(dt, t, body, vehicle) {
      const season = ((shared.season?.value ?? 1) % 4 + 4) % 4;
      const winter = Math.max(0, 1 - Math.abs(season - 3) * 1.5);
      const near = body.x > LAKE.x0 - 300 && body.x < LAKE.x1 + 300 && -body.z > LAKE.n0 - 300 && -body.z < LAKE.n1 + 300;
      fish.visible = near && winter < .5;
      if (!fish.visible) { culter.visible = false; return; }
      let k = 0;
      for (const sc of schools) {
        // Away from a boat within 25 m; otherwise a slow wander, turning back from the shore.
        const bx = body.x - sc.x, bz = body.z - sc.z, bd = Math.hypot(bx, bz);
        let want = sc.h + Math.sin(t * .13 + sc.v * 7) * .6 * dt;
        const flee = vehicle === 'boat' && bd < 25;
        if (flee) want = Math.atan2(-bx, -bz);
        const ax = sc.x + Math.sin(sc.h) * 14, az = sc.z + Math.cos(sc.h) * 14;
        if (waterAt(ax, az) === null) want = sc.h + 1.2;
        sc.h += Math.atan2(Math.sin(want - sc.h), Math.cos(want - sc.h)) * Math.min(1, dt * (flee ? 3 : .8));
        const v = sc.v * (flee ? 3.5 : 1);
        const nx = sc.x + Math.sin(sc.h) * v * dt, nz = sc.z + Math.cos(sc.h) * v * dt;
        if (waterAt(nx, nz) !== null) { sc.x = nx; sc.z = nz; } else sc.h += Math.PI * .5;
        const y = waterAt(sc.x, sc.z);
        for (const f of sc.fish) {
          const c = Math.cos(sc.h), s = Math.sin(sc.h);
          const wob = Math.sin(t * 2.2 + f.ph) * .6;
          dummy.position.set(sc.x + f.dx * c + (f.dz + wob) * s, (y ?? 0) + .03, sc.z - f.dx * s + (f.dz + wob) * c);
          dummy.rotation.set(0, sc.h + Math.sin(t * 3 + f.ph) * .15, 0);
          dummy.scale.setScalar(y === null ? 0 : f.s);
          dummy.updateMatrix(); fish.setMatrixAt(k++, dummy.matrix);
        }
      }
      fish.instanceMatrix.needsUpdate = true;
      // A jump: a 1.2 s arc out of the water 15-40 m from the visitor, every 8-20 s.
      nextJump -= dt;
      if (!jump && nextJump <= 0) {
        nextJump = 8 + Math.random() * 12;
        const a = Math.random() * 6.28, r = 15 + Math.random() * 25, x = body.x + Math.cos(a) * r, z = body.z + Math.sin(a) * r;
        const y = waterAt(x, z);
        if (y !== null) jump = {x, z, y, h: Math.random() * 6.28, t: 0};
      }
      if (jump) {
        jump.t += dt;
        const u = jump.t / 1.2;
        culter.visible = u < 1;
        culter.position.set(jump.x + Math.sin(jump.h) * u * 2.4, jump.y + Math.sin(Math.PI * u) * 1.1, jump.z + Math.cos(jump.h) * u * 2.4);
        culter.rotation.set(-Math.cos(Math.PI * u) * .9, jump.h, 0);
        if (u >= 1) jump = null;
      }
    },
  };
}

function mulberry(a) {
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
