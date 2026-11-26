import * as THREE from 'three';

// The inscriptions on Sun Yat-sen's Mausoleum (the owner: "there should be Chinese characters on the
// Zhongshan Ling gate", 27 Nov). The model (blender/build_zhongshan.py) has their boards, blank; the
// characters are laid on them here, in the city's frame, on the face toward the visitor coming up the
// axis. From the Chinese Wikipedia's 中山陵 (read 27 Nov 2026):
//   博愛   the Bo'ai arch's middle lintel, Sun Yat-sen's hand, gilt
//   天下為公 over the Mausoleum Gate's south door, Sun Yat-sen's hand, gilt, on a stone tablet
//   民族 民權 民生 over the Sacrificial Hall's three doors, Zhang Jingjiang's seal script, gold; 民生 over
//          the larger middle door (the page lists them east to west as 民族, 民權, 民生, which cannot
//          also put 民生 in the middle: the sides here, 民族 east and 民權 west, are ours)
//   天地正氣 on the tablet between the hall's eaves over the middle door, Sun Yat-sen's hand, gold
// Ours: the stone's colour, the brush font (a Kai face, not their hands; no seal script), the horizontal
// ones read right to left as inscriptions of 1929 were written, 天地正氣 in two columns.
//
// Board centres [x, y, z] and sizes [w, h] from the exported model (tests/_gold-probe.mjs found them);
// FACE: the axis's way toward the visitor, south and a little east.
const FACE = new THREE.Vector3(0.0544, 0, 0.9985).normalize();
const ACROSS = new THREE.Vector3(FACE.z, 0, -FACE.x);   // east along the boards
const HALL = new THREE.Vector3(6085.8, 165.2, -2484.4).addScaledVector(FACE, -0.2);
const INSCRIPTIONS = {
  core: [
    {text: '愛博', at: [6119.05, 95.7, -1876.25], size: [6.6, .9], depth: .7, pad: .6},
    {text: '公為下天', at: [6098.4, 115.2, -2255.3], size: [6.0, 1.4], depth: .3, pad: .5},
    {text: '生民', at: HALL.toArray(), size: [4.4, .9], depth: .3, pad: .7, seal: true},
    {text: '族民', at: HALL.clone().addScaledVector(ACROSS, 5.2).toArray(), size: [3.6, .9], depth: .3, pad: .7, seal: true},
    {text: '權民', at: HALL.clone().addScaledVector(ACROSS, -5.2).toArray(), size: [3.6, .9], depth: .3, pad: .7, seal: true},
    {text: '天地正氣', at: [6085.8, 174.4, -2484.4], size: [2.6, 2.6], depth: .3, grid: true},
  ],
};

function texture(text, w, h, {grid = false, pad = .5} = {}) {
  const px = 128, c = document.createElement('canvas');
  c.width = Math.round(w * px); c.height = Math.round(h * px);
  const g = c.getContext('2d');
  // Pale granite, a fine darker rim.
  g.fillStyle = '#ddd7c8'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#a9a291'; g.lineWidth = c.height * .05; g.strokeRect(0, 0, c.width, c.height);
  const gold = g.createLinearGradient(0, 0, 0, c.height);
  gold.addColorStop(0, '#f6dc86'); gold.addColorStop(.5, '#c9962e'); gold.addColorStop(1, '#f0cf6e');
  g.fillStyle = gold; g.strokeStyle = '#6a4a12'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const font = (s) => `700 ${s}px "KaiTi", "STKaiti", "Kaiti SC", "BiauKai", "Noto Serif SC", serif`;
  const chars = [...text];
  if (grid) {
    // Two columns, read top to bottom, right column first: 天地 | 正氣.
    const s = c.width * .4;
    g.font = font(s); g.lineWidth = s * .03;
    const cells = [[.73, .28], [.73, .72], [.27, .28], [.27, .72]];
    chars.forEach((ch, i) => { const [x, y] = cells[i]; g.strokeText(ch, c.width * x, c.height * y); g.fillText(ch, c.width * x, c.height * y); });
  } else {
    // As large as the board's height allows, and close together in its middle (two characters on the
    // arch's long board stood at its ends).
    const n = chars.length, cell = (c.width - c.height * pad) / n, sz = Math.min(cell * .9, c.height * .78), step = Math.min(cell, sz * 1.4);
    g.font = font(sz); g.lineWidth = sz * .03;
    chars.forEach((ch, i) => { const x = c.width / 2 + (i - (n - 1) / 2) * step; g.strokeText(ch, x, c.height * .52); g.fillText(ch, x, c.height * .52); });
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

// Each board measured in the model as loaded: the gold faces near its expected place, in the axis's
// frame (across, up, toward the visitor). The inscription lies on the board's front, its own size.
function goldPoints(scene) {
  const pts = [], v = new THREE.Vector3();
  scene.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || !o.geometry?.attributes.position) return;
    const mats = [].concat(o.material), gold = mats.map((m, i) => (/^gold/i.test(m.name || '') ? i : -1)).filter(i => i >= 0);
    if (!gold.length) return;
    const g = o.geometry, idx = g.index, groups = g.groups.length ? g.groups : [{start: 0, count: idx ? idx.count : g.attributes.position.count, materialIndex: 0}];
    for (const gr of groups) {
      if (!gold.includes(gr.materialIndex ?? 0)) continue;
      for (let i = gr.start; i < gr.start + gr.count; i++) {
        v.fromBufferAttribute(g.attributes.position, idx ? idx.getX(i) : i).applyMatrix4(o.matrixWorld);
        if (v.x > 6000 && v.x < 6200 && v.z > -2600 && v.z < -1800) pts.push(v.clone());
      }
    }
  });
  return pts;
}
function fit(ins, pts) {
  const c = new THREE.Vector3().fromArray(ins.at), [w, h] = ins.size, lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const p of pts) {
    const d = p.clone().sub(c), a = d.dot(ACROSS), y = d.y, f = d.dot(FACE);
    if (Math.abs(a) > w / 2 + .8 || Math.abs(y) > h / 2 + .5 || Math.abs(f) > 1.2) continue;
    [a, y, f].forEach((q, j) => { lo[j] = Math.min(lo[j], q); hi[j] = Math.max(hi[j], q); });
  }
  if (!Number.isFinite(lo[0])) return null;
  return {centre: c.clone().addScaledVector(ACROSS, (lo[0] + hi[0]) / 2).setY(c.y + (lo[1] + hi[1]) / 2).addScaledVector(FACE, hi[2] + .02),
    w: hi[0] - lo[0], h: hi[1] - lo[1]};
}

/** Lays the world's inscriptions on their boards; returns the planes (for the audit). */
export function addInscriptions(scene, worldId) {
  const out = [], list = INSCRIPTIONS[worldId] || [];
  const pts = list.length ? goldPoints(scene) : [];
  for (const ins of list) {
    const board = fit(ins, pts);
    if (!board) { console.warn(`No board found for ${ins.text}`); continue; }
    const {w, h} = board;
    const mat = new THREE.MeshBasicMaterial({map: texture(ins.text, w, h, ins), fog: true, toneMapped: false});
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.copy(board.centre);
    m.lookAt(m.position.clone().add(FACE));
    m.name = `Inscription ${[...ins.text].reverse().join('')}`;
    m.userData.text = ins.text;
    scene.add(m);
    out.push(m);
  }
  return out;
}
