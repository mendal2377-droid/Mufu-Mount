import * as THREE from 'three';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Painted trees for the near range (the owner's references, 1 November 2026): flat, soft, painterly,
// each species' character clear at a glance. A trunk and limbs in painted bark, and a crown of
// leaf cards, each card a painted cluster of the species' own leaves turned to face the viewer,
// shaded as one soft volume, swaying in the wind and coloured by the season (SEASONS in
// src/landmark-world.js).
//
// Every kind follows research/plants/FACTS.md: the London plane's camouflage bark and broad dome
// (the pilot, approved), the ginkgo's fans turning gold in late November, the metasequoia's
// feathery cone going fiery red then bare, camphor, privet, cedar and cypress evergreen, the plum
// flowering on bare branches in late February and the cherry in late March.
//
// Textures are painted on canvases at load: nothing extra to download.

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// --- Leaves, painted ---------------------------------------------------------------------------------
// Each painter draws one leaf at the origin, about one unit across, pointing up (-y), in fill.

function palmate(g, fill) {                       // plane, maples: five pointed lobes
  g.beginPath();
  for (let i = 0; i <= 60; i++) {
    const t = i / 60 * Math.PI * 2, rr = .42 + .58 * Math.abs(Math.cos(2.5 * (t + Math.PI / 2))) ** 3;
    i ? g.lineTo(Math.cos(t) * rr, Math.sin(t) * rr) : g.moveTo(Math.cos(t) * rr, Math.sin(t) * rr);
  }
  g.closePath(); g.fillStyle = fill; g.fill();
}

function fan(g, fill) {                           // ginkgo: a fan, notched in the middle of its rim
  g.beginPath(); g.moveTo(0, .55);
  g.lineTo(-.62, -.42);
  g.quadraticCurveTo(-.32, -.68, -.06, -.5); g.lineTo(0, -.3); g.lineTo(.06, -.5);
  g.quadraticCurveTo(.32, -.68, .62, -.42);
  g.closePath(); g.fillStyle = fill; g.fill();
}

function oval(g, fill) {                          // camphor, privet, broadleaf: a pointed oval
  g.beginPath(); g.moveTo(0, -.6);
  g.quadraticCurveTo(.34, -.1, 0, .6); g.quadraticCurveTo(-.34, -.1, 0, -.6);
  g.fillStyle = fill; g.fill();
}

function pinnate(g, fill) {                       // scholar tree, wingnut: leaflets along a stalk
  g.fillStyle = fill;
  for (let k = 0; k < 5; k++) {
    const y = -.5 + k * .24;
    for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(sd * .16, y, .14, .075, sd * .5, 0, Math.PI * 2); g.fill(); }
  }
  g.beginPath(); g.ellipse(0, -.66, .1, .13, 0, 0, Math.PI * 2); g.fill();
}

function spray(g, fill) {                         // cedar, cypress, metasequoia: a feathered frond
  g.fillStyle = fill;
  g.beginPath(); g.moveTo(0, -.62);
  for (let k = 0; k <= 8; k++) { const y = -.55 + k * .14, w = .12 + .3 * Math.sin(k / 8 * Math.PI); g.lineTo(w, y); g.lineTo(w * .55, y + .06); }
  g.lineTo(0, .62);
  for (let k = 8; k >= 0; k--) { const y = -.55 + k * .14, w = .12 + .3 * Math.sin(k / 8 * Math.PI); g.lineTo(-w * .55, y + .06); g.lineTo(-w, y); }
  g.closePath(); g.fill();
}

function strand(g, fill) {                        // willow: a long hanging strand of narrow leaves
  g.fillStyle = fill;
  for (let k = 0; k < 9; k++) {
    const y = -.6 + k * .14, x = Math.sin(k * .7) * .05;
    for (const sd of [-1, 1]) { g.beginPath(); g.ellipse(x + sd * .05, y, .035, .1, sd * .35, 0, Math.PI * 2); g.fill(); }
  }
}

function blossom(g, fill, centre) {               // plum, cherry: five round petals, a gold eye
  g.fillStyle = fill;
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2;
    g.beginPath(); g.ellipse(Math.cos(a) * .26, Math.sin(a) * .26, .24, .2, a, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = centre; g.beginPath(); g.arc(0, 0, .12, 0, Math.PI * 2); g.fill();
}

function bud(g, fill) {
  g.fillStyle = fill; g.beginPath(); g.arc(0, 0, .2, 0, Math.PI * 2); g.fill();
}

// A 2 x 2 atlas. Top row: two leaf clusters, in grey values the shader colours by season, painted
// light (front leaves), mid and dark (behind) so a card has depth of its own. Bottom row: two more
// leaf clusters, or for flowering trees two blossom clusters in their own colours.
function atlas(leaf, {seed, scale = 1, flowers = null, stretch = 1}) {
  const c = document.createElement('canvas');
  c.width = c.height = 1024;
  const g = c.getContext('2d'), r = rng(seed);
  g.scale(2, 2);
  const tones = ['#9b9b9b', '#c2c2c2', '#e8e8e8'];
  for (let cell = 0; cell < 4; cell++) {
    const ox = (cell % 2) * 256, oy = Math.floor(cell / 2) * 256;
    g.save(); g.beginPath(); g.rect(ox, oy, 256, 256); g.clip();
    if (flowers && cell >= 2) {
      // Blossoms on a dark twig, buds at the ends.
      g.strokeStyle = '#4a3530'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(ox + 40, oy + 210); g.quadraticCurveTo(ox + 120, oy + 130, ox + 220, oy + 50); g.stroke();
      for (let k = 0; k < 16; k++) {
        const t = r(), x = ox + 40 + t * 180 + (r() - .5) * 70, y = oy + 210 - t * 160 + (r() - .5) * 70;
        g.save(); g.translate(x, y); g.rotate(r() * 6.28); g.scale(26 + r() * 14, 26 + r() * 14);
        r() < .78 ? blossom(g, flowers[Math.floor(r() * flowers.length)], '#f2c94c') : bud(g, flowers[0]);
        g.restore();
      }
    } else {
      for (const [layer, fill] of tones.entries()) {
        const n = 7 + layer * 2;
        for (let k = 0; k < n; k++) {
          const a = r() * Math.PI * 2, d = Math.sqrt(r()) * (78 - layer * 12);
          g.save();
          g.translate(ox + 128 + Math.cos(a) * d, oy + 132 + Math.sin(a) * d * .85 * stretch);
          g.rotate(stretch > 1 ? (r() - .5) * .3 : r() * Math.PI * 2);
          const sz = (30 + r() * 12 - layer * 2) * scale;
          g.scale(sz, sz * stretch);
          leaf(g, fill);
          g.restore();
        }
      }
    }
    g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// --- Bark, painted -------------------------------------------------------------------------------------

// Rounded, lobed patches over a ground colour, wrapping round the trunk (the texture repeats).
function bark({seed, ground, patches, count = 120, w = [40, 70], h = [50, 110], streaks = 0}) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 1024;
  const g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = ground; g.fillRect(0, 0, 256, 1024);
  for (let k = 0; k < count; k++) {
    g.fillStyle = patches[Math.floor(r() * patches.length)];
    const x = r() * 256, y = r() * 1024, pw = w[0] + r() * w[1], ph = h[0] + r() * h[1];
    for (const ox of [0, -256, 256]) {
      g.beginPath();
      for (let i = 0; i <= 10; i++) {
        const a = i / 10 * Math.PI * 2, rr = .7 + .3 * Math.sin(a * 3 + k);
        const px = x + ox + Math.cos(a) * pw * rr * .5, py = y + Math.sin(a) * ph * rr * .5;
        i ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.fill();
    }
  }
  // Furrows: long dark vertical strokes.
  g.strokeStyle = 'rgba(30, 20, 14, .35)'; g.lineWidth = 3;
  for (let k = 0; k < streaks; k++) {
    const x = r() * 256, y = r() * 1024;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 8, y + 60 + r() * 140); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const BARKS = {
  // The plane's camouflage (the owner's reference): cream, tan, sage and grey-brown jigsaw patches.
  camo: () => bark({seed: 77, ground: '#e8dec4', patches: ['#c8b48c', '#a89a7c', '#9a8a72', '#8a6e56', '#b4b090', '#d6cba8']}),
  brown: () => bark({seed: 31, ground: '#6e5440', patches: ['#5a4434', '#7c6048', '#4a382c'], count: 60, w: [20, 40], h: [60, 120], streaks: 90}),
  grey: () => bark({seed: 53, ground: '#8a8274', patches: ['#776f62', '#9a9282', '#6a6356'], count: 60, w: [20, 40], h: [60, 120], streaks: 70}),
  red: () => bark({seed: 19, ground: '#8a5a40', patches: ['#7a4a34', '#9c6a4c', '#6a3e2c'], count: 40, w: [10, 20], h: [120, 200], streaks: 120}),
  dark: () => bark({seed: 61, ground: '#4e3a34', patches: ['#3e2e2a', '#5e463e', '#6a5048'], count: 50, w: [30, 30], h: [14, 20], streaks: 20}),
};

// --- Geometry -----------------------------------------------------------------------------------------

// A tapered limb from a to b (radii ra, rb), its bark UVs running along it.
function limb(a, b, ra, rb, segments = 7) {
  const dir = new THREE.Vector3().subVectors(b, a), len = dir.length();
  const g = new THREE.CylinderGeometry(rb, ra, len, segments, 1, true);
  g.translate(0, len / 2, 0);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len / 4);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate(a.x, a.y, a.z);
  return g.toNonIndexed();
}

// Branch skeletons, each returning {bark: geometries, tips: points where the leaves gather}.
const BRANCHES = {
  // The plane's: a trunk forking at 40 % into five rising, spreading limbs, twigs off each.
  fork(spec, r) {
    const h = spec.h, R = spec.r, bark = [], tips = [], segs = [];
    const fork = new THREE.Vector3(0, h * .42, 0);
    bark.push(limb(new THREE.Vector3(), fork, R * .12, R * .09, 9));
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + r() * .6;
      const mid = fork.clone().add(new THREE.Vector3(Math.cos(a) * R * .35, h * .16, Math.sin(a) * R * .35));
      const tip = mid.clone().add(new THREE.Vector3(Math.cos(a) * R * .45, h * .16 + r() * h * .06, Math.sin(a) * R * .45));
      bark.push(limb(fork, mid, R * .07, R * .045), limb(mid, tip, R * .045, R * .015, 5)); segs.push([mid, tip]);
      for (let t = 0; t < 4; t++) {
        const from = mid.clone().lerp(tip, .3 + t * .2), b = a + (r() - .5) * 1.6;
        const to = from.clone().add(new THREE.Vector3(Math.cos(b) * R * (.25 + r() * .2), h * (.06 + r() * .08), Math.sin(b) * R * (.25 + r() * .2)));
        bark.push(limb(from, to, R * .014, R * .005, 4)); tips.push(to); segs.push([from, to]);
      }
      tips.push(tip);
    }
    return {bark, tips, segs};
  },
  // A central leader to the top with short side branches climbing it (ginkgo, conifers).
  leader(spec, r, {spread = .6, from = .25, count = 9} = {}) {
    const h = spec.h, R = spec.r, bark = [], tips = [], segs = [];
    bark.push(limb(new THREE.Vector3(), new THREE.Vector3(0, h * .98, 0), R * .1, R * .02, 8));
    for (let k = 0; k < count; k++) {
      const f = k / (count - 1), y = h * (from + (1 - from) * .85 * f), a = k * 2.4 + r() * .5, len = R * spread * (1 - .55 * f);
      const s = new THREE.Vector3(0, y, 0), e = s.clone().add(new THREE.Vector3(Math.cos(a) * len, len * .25, Math.sin(a) * len));
      bark.push(limb(s, e, R * .03, R * .008, 4)); tips.push(e); segs.push([s, e]);
    }
    return {bark, tips, segs};
  },
  // The plum's: a leaning, twisting trunk and crooked spreading branches.
  twisted(spec, r) {
    const h = spec.h, R = spec.r, bark = [], tips = [], segs = [];
    const p = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(R * .25, h * .25, 0), new THREE.Vector3(-R * .1, h * .45, R * .1), new THREE.Vector3(R * .15, h * .6, -R * .05)];
    for (let k = 0; k < 3; k++) bark.push(limb(p[k], p[k + 1], R * (.13 - k * .03), R * (.1 - k * .03), 7));
    for (let k = 0; k < 6; k++) {
      const s = p[1 + (k % 3)], a = k * 1.05 + r() * .6, len = R * (.6 + r() * .4);
      const m = s.clone().add(new THREE.Vector3(Math.cos(a) * len * .5, h * .12 + r() * h * .08, Math.sin(a) * len * .5));
      const e = m.clone().add(new THREE.Vector3(Math.cos(a + .5) * len * .5, h * .08 + r() * h * .1, Math.sin(a + .5) * len * .5));
      bark.push(limb(s, m, R * .05, R * .03, 5), limb(m, e, R * .03, R * .01, 4)); tips.push(m, e, m.clone().lerp(e, .5)); segs.push([s, m], [m, e]);
    }
    return {bark, tips, segs};
  },
  // The willow's: a short trunk, limbs arching up and out, from which the strands hang.
  weeping(spec, r) {
    const h = spec.h, R = spec.r, bark = [], tips = [], segs = [];
    const top = new THREE.Vector3(0, h * .45, 0);
    bark.push(limb(new THREE.Vector3(), top, R * .13, R * .1, 8));
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + r() * .5;
      const e = top.clone().add(new THREE.Vector3(Math.cos(a) * R * .8, h * .38, Math.sin(a) * R * .8));
      bark.push(limb(top, e, R * .05, R * .015, 5)); tips.push(e); segs.push([top, e]);
    }
    return {bark, tips, segs};
  },
  // A short trunk and a few limbs into the crown (domes and ovals).
  crown(spec, r, {fork = .38} = {}) {
    const h = spec.h, R = spec.r, bark = [], tips = [], segs = [];
    const top = new THREE.Vector3(0, h * fork, 0);
    bark.push(limb(new THREE.Vector3(), top, R * .1, R * .08, 8));
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2 + r() * .7;
      const e = top.clone().add(new THREE.Vector3(Math.cos(a) * R * .55, h * .3, Math.sin(a) * R * .55));
      bark.push(limb(top, e, R * .05, R * .02, 5)); tips.push(e); segs.push([top, e]);
      for (let t = 0; t < 3; t++) {
        const from = top.clone().lerp(e, .45 + t * .2), b = a + (r() - .5) * 1.8;
        const to = from.clone().add(new THREE.Vector3(Math.cos(b) * R * (.3 + r() * .2), h * (.05 + r() * .1), Math.sin(b) * R * (.3 + r() * .2)));
        bark.push(limb(from, to, R * .012, R * .005, 4)); tips.push(to); segs.push([from, to]);
      }
    }
    return {bark, tips, segs};
  },
};

// Cards along the limbs: at a point on a branch (its outer two thirds), a little off it.
function alongLimbs(spec, r, n, segs, c, jitter = .2) {
  const out = [];
  for (let k = 0; k < n && segs.length; k++) {
    const [a, b] = segs[Math.floor(r() * segs.length)];
    const p = a.clone().lerp(b, .2 + .8 * r()).add(new THREE.Vector3((r() - .5), (r() - .3), (r() - .5)).multiplyScalar(spec.r * jitter * 2));
    out.push({p, d: .85, c, up: (p.y - c.y) / spec.h * 2});
  }
  return out;
}

// Crown shapes: where the leaf cards go. Each returns [{p, d}]: the card's place and its depth in
// the crown (0 at the heart, 1 at the skin), from which it is shaded.
const CROWNS = {
  dome(spec, r, n, {cy = .7, ry = .3, rx = 1.12, segs = [], attach = 1} = {}) {
    const out = [], c = new THREE.Vector3(0, spec.h * cy, 0);
    const onLimbs = segs.length ? Math.round(n * attach) : 0;
    out.push(...alongLimbs(spec, r, onLimbs, segs, c, .12));
    for (let k = onLimbs; k < n; k++) {
      const u = r() * 2 - 1, a = r() * Math.PI * 2, d = .3 + .55 * Math.cbrt(r()), s = Math.sqrt(1 - u * u);
      const v = new THREE.Vector3(s * Math.cos(a) * spec.r * rx, (u > -.3 ? u : u * .45) * spec.h * ry, s * Math.sin(a) * spec.r * rx).multiplyScalar(d);
      out.push({p: c.clone().add(v), d, c, up: v.y / (spec.h * ry)});
    }
    return out;
  },
  // Tiers round a cone, drooping at their ends (cedar), or a narrow tight cone (metasequoia, cypress).
  cone(spec, r, n, {base = .22, width = 1, droop = .4, segs = [], attach = 1} = {}) {
    const out = [], c = new THREE.Vector3(0, spec.h * .55, 0);
    const onLimbs = segs.length ? Math.round(n * attach) : 0;
    out.push(...alongLimbs(spec, r, onLimbs, segs, c, .1));
    for (let k = onLimbs; k < n; k++) {
      const t = Math.pow(r(), .8), y = spec.h * (base + (1 - base) * t), rad = spec.r * width * .8 * (1 - t) * (.3 + .7 * Math.sqrt(r()));
      const a = r() * Math.PI * 2, out_ = rad / (spec.r * width + 1e-6);
      out.push({p: new THREE.Vector3(Math.cos(a) * rad, y - droop * out_ * spec.h * .08, Math.sin(a) * rad), d: .5 + .5 * out_, c, up: t * 2 - 1});
    }
    return out;
  },
  // Strands hanging from the limbs' ends and from a dome over them (willow).
  hang(spec, r, n, {tips}) {
    const out = [], c = new THREE.Vector3(0, spec.h * .7, 0);
    // A rounded cap over the limbs, the strands' leaves seen from above (square cards, any turn).
    const cap = Math.round(n * .35);
    for (let k = 0; k < cap; k++) {
      const tip = tips[k % tips.length], a = r() * Math.PI * 2, rr = r() * spec.r * .45;
      out.push({p: tip.clone().lerp(new THREE.Vector3(0, tip.y, 0), r() * .5).add(new THREE.Vector3(Math.cos(a) * rr, r() * spec.h * .06, Math.sin(a) * rr)),
        d: .8, c, up: .8, aspect: 1});
    }
    for (let k = cap; k < n; k++) {
      const tip = tips[k % tips.length], a = r() * Math.PI * 2, rr = r() * spec.r * .55;
      const p = tip.clone().add(new THREE.Vector3(Math.cos(a) * rr, -spec.r * .5 * 1.3 - r() * spec.h * .18, Math.sin(a) * rr));
      out.push({p, d: .6 + .4 * r(), c, up: (p.y - c.y) / spec.h});
    }
    return out;
  },
  // Gathered at the branches' tips (plum and cherry blossom).
  tips(spec, r, n, {tips, segs = [], spread = .9}) {
    const out = [], c = new THREE.Vector3(0, spec.h * .6, 0);
    const onLimbs = n;
    out.push(...alongLimbs(spec, r, onLimbs, segs, c, .06));
    for (let k = onLimbs; k < n; k++) {
      const tip = tips[k % tips.length];
      const p = tip.clone().add(new THREE.Vector3((r() - .5) * spec.r * spread * .45, (r() - .5) * spec.r * spread * .3, (r() - .5) * spec.r * spread * .45));
      out.push({p, d: .6 + .4 * r(), c, up: (p.y - c.y) / spec.h * 2});
    }
    return out;
  },
};

// Leaf cards at the crown's points, turned to the viewer in the vertex shader (seen edge-on from
// below, fixed cards read as brush streaks): each vertex carries the card's centre as its position
// and its corner as an offset. Normals are bent to the crown's sphere so the crown shades as one
// soft volume; inner and lower cards are darker (cardShade); cardSeed thins the crown in autumn
// and winter and staggers the flutter.
function cards(points, size, r, aspect = 1) {
  const pos = [], nrm = [], uv = [], seed = [], corner = [], shade = [];
  const corners = [[-.5, -.5], [.5, -.5], [.5, .5], [-.5, -.5], [.5, .5], [-.5, .5]];
  for (const {p, d, c, up, aspect: own} of points) {
    const n = p.clone().sub(c).normalize().lerp(new THREE.Vector3(0, 1, 0), .3).normalize();
    const asp = own ?? aspect;
    const sz = size * (.75 + r() * .5), turn = asp > 1 ? (r() - .5) * .3 : r() * Math.PI * 2, cell = Math.floor(r() * 2);
    const sd = r(), depth = (.62 + .38 * Math.min(1, (d - .45) / .5)) * (.86 + .24 * Math.max(-.5, Math.min(1, up)));
    const cs = Math.cos(turn), sn = Math.sin(turn);
    for (const [cx, cy] of corners) {
      pos.push(p.x, p.y, p.z);
      nrm.push(n.x, n.y, n.z);
      const ox = cx * sz, oy = cy * sz * asp;
      corner.push(ox * cs - oy * sn, ox * sn + oy * cs);
      // The card's column; the row (leaves or blossom) is chosen in the shader by the season.
      uv.push(cell * .5 + (cx + .5) * .5, (cy + .5) * .5);
      seed.push(sd); shade.push(depth);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('corner', new THREE.Float32BufferAttribute(corner, 2));
  g.setAttribute('cardSeed', new THREE.Float32BufferAttribute(seed, 1));
  g.setAttribute('cardShade', new THREE.Float32BufferAttribute(shade, 1));
  return g;
}

function withAttributes(g) {
  const n = g.attributes.position.count;
  g.setAttribute('corner', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2));
  g.setAttribute('cardShade', new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1));
  g.setAttribute('cardSeed', new THREE.Float32BufferAttribute(new Float32Array(n), 1));
  return g;
}

// --- The species ---------------------------------------------------------------------------------------
// branch: skeleton; crown: card layout; leaf: painter; bark: texture; deciduous: bare in winter;
// bloom: [from, to] on the season clock (0 spring … 3 winter, wrapping) when the blossom row shows.
const PLANE = {branch: 'fork', crown: ['dome'], leaf: palmate, bark: 'camo', deciduous: true, cards: 150, size: .5};
const BROADLEAF = {branch: 'crown', crown: ['dome', {cy: .66, ry: .34, rx: 1.0}], leaf: oval, leafScale: .8, bark: 'brown', deciduous: true, cards: 130, size: .5};
const SPECIES = {
  plane: PLANE, plane_autumn: PLANE,
  camphor: {...BROADLEAF, crown: ['dome', {cy: .64, ry: .38, rx: 1.05}], leafScale: .7, deciduous: false, cards: 160},
  ginkgo: {branch: 'leader', branchOpts: {spread: 1.0, from: .3, count: 14}, crown: ['dome', {cy: .6, ry: .42, rx: .95}], leaf: fan, leafScale: .85, bark: 'grey', deciduous: true, cards: 140, size: .55, gain: 1.25},
  metasequoia: {branch: 'leader', branchOpts: {spread: .6, from: .15}, crown: ['cone', {base: .15, width: 1, droop: 0}], leaf: spray, bark: 'red', deciduous: true, cards: 150, size: .55, gain: 1.15},
  cedar: {branch: 'leader', branchOpts: {spread: .8, from: .12}, crown: ['cone', {base: .12, width: 1.15, droop: .9}], leaf: spray, leafScale: 1.1, bark: 'brown', deciduous: false, cards: 170, size: .6, gain: 2.1},
  cypress: {branch: 'leader', branchOpts: {spread: .4, from: .1}, crown: ['cone', {base: .1, width: .8, droop: 0}], leaf: spray, leafScale: .8, bark: 'red', deciduous: false, cards: 100, size: .5, gain: 1.5},
  scholar: {...BROADLEAF, leaf: pinnate, leafScale: 1.1},
  wingnut: {...BROADLEAF, leaf: pinnate, leafScale: 1.2, crown: ['dome', {cy: .66, ry: .32, rx: 1.12}]},
  privet: {...BROADLEAF, crown: ['dome', {cy: .6, ry: .4, rx: .95}], leafScale: .6, deciduous: false, cards: 100},
  broadleaf: BROADLEAF, broadleaf_sun: BROADLEAF, broadleaf_shade: {...BROADLEAF, deciduous: false},
  maple_red: {...BROADLEAF, leaf: palmate, leafScale: .7, bark: 'dark', crown: ['dome', {cy: .62, ry: .34, rx: 1.15}]},
  maple_autumn: {...BROADLEAF, leaf: palmate, leafScale: .7, bark: 'dark', crown: ['dome', {cy: .62, ry: .34, rx: 1.15}]},
  willow: {branch: 'weeping', crown: ['hang'], leaf: strand, stretch: 2.6, bark: 'brown', deciduous: true, cards: 150, size: .5, aspect: 2.6},
  // Late February: plum blossom on bare branches, the city's flower (People's Daily 2022).
  plum: {branch: 'twisted', crown: ['tips', {spread: .8}], leaf: oval, leafScale: .7, bark: 'dark', deciduous: true, cards: 90, size: .45,
    flowers: ['#e86a8a', '#f08aa4', '#d9506f'], bloom: [3.45, 4.1]},
  // Mid-to-late March to early April: cherry blossom (bendibao).
  cherry: {branch: 'twisted', crown: ['tips', {spread: 1.1}], leaf: oval, leafScale: .75, bark: 'dark', deciduous: true, cards: 130, size: .55,
    flowers: ['#f6c6d4', '#fbd9e3', '#f0b0c4'], bloom: [3.92, 4.45]},
};

function geometryFor(kind, spec, sp) {
  const r = rng(4242 + kind.length * 31);
  const {bark, tips, segs} = BRANCHES[sp.branch](spec, r, sp.branchOpts);
  const [shape, opts = {}] = sp.crown;
  const points = CROWNS[shape](spec, r, Math.round(sp.cards * 1.25), {...opts, tips, segs});
  const leaves = cards(points, spec.r * sp.size * .78, r, sp.aspect || 1);
  return mergeGeometries([withAttributes(mergeGeometries(bark)), leaves], true);   // groups: 0 bark, 1 leaves
}

// The leaves' material: the atlas' grey values coloured by the season (seasonCol / fallCol, as on
// the low trees), alpha-tested, swaying with the crown and fluttering per card. Deciduous crowns
// thin card by card into winter; a flowering tree shows its blossom row (in its own colours) in its
// bloom window, on bare branches if it flowers before its leaves.
function leafMaterial(kind, sp, bands, shared, plan, base, map) {
  const m = new THREE.MeshToonMaterial({map, gradientMap: bands, alphaTest: .5, side: THREE.DoubleSide});
  const year = [0, 1, 2, 3].map(i => new THREE.Color(plan.year?.[i] || '#' + base.getHexString()));
  const fall = (plan.fall || ['#' + year[2].getHexString()]).map(h => new THREE.Color(h));
  while (fall.length < 4) fall.push(fall[fall.length - 1]);
  const bloom = sp.bloom || [-9, -9];
  m.onBeforeCompile = s => {
    s.uniforms.cityTime = shared.time; s.uniforms.citySnow = shared.snow; s.uniforms.cityStorm = shared.storm || {value: 0};
    s.uniforms.citySeason = shared.season || {value: 1};
    s.uniforms.seasonCol = {value: year}; s.uniforms.fallCol = {value: fall}; s.uniforms.leafGain = {value: sp.gain || 1};
    s.vertexShader = `uniform float cityTime,cityStorm,citySeason;attribute float cardSeed,cardShade;attribute vec2 corner;varying float vSeed,vTreeHash,vShade,vBloom;
      float bloomAt(float s){float a=${bloom[0].toFixed(2)},b=${bloom[1].toFixed(2)};return smoothstep(a,a+.08,s)*(1.-smoothstep(b-.08,b,s))+smoothstep(a-4.,a-3.92,s)*(1.-smoothstep(b-4.08,b-4.,s));}
      ` + s.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
      float s4v=mod(citySeason,4.);vBloom=step(.5,bloomAt(s4v));
      #ifdef USE_MAP
        vMapUv.y=vMapUv.y*1.+(vBloom>.5?0.:.5);
      #endif`).replace('#include <begin_vertex>', `#include <begin_vertex>
      vShade=cardShade;
      vec3 o=instanceMatrix[3].xyz;vSeed=cardSeed;vTreeHash=fract(sin(dot(o.xz,vec2(12.9898,78.233)))*43758.5453);
      float sway=smoothstep(2.,14.,transformed.y)*(1.+cityStorm*2.5);
      transformed.x+=sin(cityTime*(.9+cityStorm*1.6)+o.x*.05+o.z*.07)*.18*sway;transformed.z+=cos(cityTime*(.7+cityStorm*1.4)+o.x*.06)*.12*sway;
      transformed+=normal*sin(cityTime*3.1+cardSeed*40.)*.06*(1.+cityStorm*3.);`)
      // The card turned to the viewer: its corner added in view space, at the tree's own scale.
      .replace('#include <project_vertex>', `vec4 mvPosition=vec4(transformed,1.);
      #ifdef USE_INSTANCING
        mvPosition=instanceMatrix*mvPosition;
      #endif
      mvPosition=modelViewMatrix*mvPosition;
      mvPosition.xy+=corner*length(instanceMatrix[0].xyz);
      gl_Position=projectionMatrix*mvPosition;`);
    s.fragmentShader = 'uniform float citySnow,citySeason,leafGain;uniform vec3 seasonCol[4],fallCol[4];varying float vSeed,vTreeHash,vShade,vBloom;\n' + s.fragmentShader
      .replace('#include <map_fragment>', `#include <map_fragment>
        float s4=mod(citySeason,4.);int si=int(floor(s4));float sf=s4-float(si);int sj=(si+1)-4*((si+1)/4);
        vec3 fallPick=fallCol[int(vTreeHash*3.999)];
        vec3 ca=si==2?fallPick:seasonCol[si], cb=sj==2?fallPick:seasonCol[sj];
        float lum=dot(diffuseColor.rgb,vec3(.3,.59,.11));
        if(vBloom<.5){
          // Leaves: the painted grey is the light, 0.6 (back) to 1.0 (front), round the season's colour.
          diffuseColor.rgb=mix(ca,cb,sf)*(.55+.75*lum)*vShade*leafGain;
          ${sp.deciduous ? `// Late autumn into winter the crown thins card by card, back in spring.
          float bare=smoothstep(2.55,2.95,s4)*(1.-smoothstep(3.75,3.98,s4));
          if(vSeed<bare*1.02)discard;` : ''}
        } else {
          // Blossom: its own painted colours, a little shaded with depth.
          diffuseColor.rgb*=mix(.85,1.05,vShade);
        }
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.92,.94,.95),citySnow*.5*smoothstep(.2,.9,lum));`);
  };
  m.customProgramCacheKey = () => 'painted-leaves-v5-' + kind;
  return m;
}

const barkCache = new Map(), atlasCache = new Map();

// {geometry, materials} for a painted tree of this kind, or null where there is none.
export function paintedTree(kind, spec, {bands, shared, seasons}) {
  const sp = SPECIES[kind];
  if (!sp) return null;
  if (!barkCache.has(sp.bark)) barkCache.set(sp.bark, new THREE.MeshToonMaterial({map: BARKS[sp.bark](), gradientMap: bands}));
  const key = kind + (sp.flowers ? ':f' : '');
  if (!atlasCache.has(key)) atlasCache.set(key, atlas(sp.leaf, {seed: 1234 + kind.length * 7, scale: sp.leafScale || 1, flowers: sp.flowers, stretch: sp.stretch || 1}));
  const plan = seasons[kind] || {year: []}, base = new THREE.Color(spec.crown);
  return {geometry: geometryFor(kind, spec, sp), materials: [barkCache.get(sp.bark), leafMaterial(kind, sp, bands, shared, plan, base, atlasCache.get(key))]};
}
