import * as THREE from 'three';
import {PICKUP_RADIUS} from './city-game.js';

// Jinling Keepsakes inside the walked worlds. The game (src/city-game.js) was laid over the old
// illustrated atlas: its lanterns hung along that atlas's routes, and nothing hung in the Blender
// worlds, where the counter read "0/3" with nothing to find (design/THINGS-TO-DO-PLAN.md).
//
// Each landmark's three lanterns hang where its three facts are about, in the world's own frame:
// [x east, north] in metres, index for index with FACTS[id]. The spots are ours, chosen on the
// approach a visitor walks (about 25 m ahead of an arrival point, never on one: arriving picked a
// lantern up unseen), the lake's name boards, the summit; none is a surveyed place
// for a lantern. At load each is moved to the nearest walkable ground within SNAP metres, and one
// that finds none is left out and reported in `skipped`.
export const WORLD_LANTERNS = {
  core: {
    // 392 steps: the foot of the stair. Blue roofs: the Sacrificial Hall. The commission: the Bo'ai arch.
    zhongshan: [[6093, 2389], [6088, 2452], [6120, 1857]],
    // The tomb: the Ming Tower. The Sacred Way: the Wengzhong Road. World Heritage: the gate.
    xiaoling: [[4796, 2034], [4509, 1121], [4869, 943]],
    // The highest point: the summit. The clouds: the ridge path. The observatory.
    zijin: [[5444, 3388], [5800, 2950], [3491, 2753]],
    // The lake's size: inside Xuanwu Gate. The imperial garden: Liangzhou. The islands' seasons: Huanzhou.
    xuanwu: [[-82, 3418], [544, 4086], [447, 3600]],
    // The temple; the pagoda's side; the cherry road up to Jiefang Gate and the wall.
    jiming: [[588, 2350], [480, 2300], [739, 2470]],
    // The tower's foot; halfway down Zhongshan Road; just north of Gulou (not on the Gulou spawn
    // itself, -470, 2000, where arriving picked it up before the visitor had looked round).
    zifeng: [[-548, 2309], [-500, 2150], [-480, 2060]],
    // The gate; the axis behind it; the west garden. The garden's first spot (720, 480) snapped into a
    // pocket that the palace's own trees, in the city since build 13 (20 Nov), close off; this is the
    // garden path just north, which a walk from the palace spawn reaches.
    palace: [[808, 314], [798, 489], [702, 498]],
    // Round Mochou Lake: north, east and south-west shores. First guesses at the shore (-2535, -150;
    // -2300, -400; -2700, -650) snapped onto ground cut off from the paths, so these are the nearest
    // points a walk from Xinjiekou reaches (tests/lanterns-browser.mjs, 12 Nov).
    mochou: [[-2578, -134], [-2166, -398], [-2694, -690]],
    // Lion Hill: the tower and its two approaches.
    // The first below the tower's north stair: at the tower's centre it fell inside the tower built on
    // 14 Nov (blender/core_landmarks.py), and the podium is not yet walkable (its stair stops 2 m above
    // the falling hillside; fixed in the code for the next export).
    yuejiang: [[-4032, 6069], [-4008, 5880], [-3880, 6009]],
  },
};
export const SNAP = 200;
const NEAR = 500;        // within this of a landmark's lanterns, the counter shows that landmark

/** The nearest walkable point to (x, z) within `radius`, searched outward in rings; null if none. */
export function snapToGround(height, x, z, radius = SNAP) {
  if (height(x, z) != null) return [x, z];
  for (let r = 4; r <= radius; r += 4) {
    const n = Math.max(8, Math.round(2 * Math.PI * r / 4));
    for (let k = 0; k < n; k++) {
      const a = 2 * Math.PI * k / n, px = x + r * Math.cos(a), pz = z + r * Math.sin(a);
      if (height(px, pz) != null) return [px, pz];
    }
  }
  return null;
}

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d'), grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,236,190,1)');
  grad.addColorStop(0.3, 'rgba(255,170,90,.55)');
  grad.addColorStop(1, 'rgba(255,140,60,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Hang a world's lanterns. `game` is the shared progress (createGame); `onPick(id, index, result)`
 * shows the fact card. Returns null for a world with no lanterns.
 */
export function createWorldLanterns({world, game, camera, onPick}) {
  const spots = WORLD_LANTERNS[world.id];
  if (!spots) return null;
  const lanterns = [], skipped = [];
  for (const [id, list] of Object.entries(spots)) {
    list.forEach(([x, north], index) => {
      const at = snapToGround(world.grid.height, x, -north);
      if (!at) { skipped.push(`${id}:${index}`); return; }
      const y = world.ground(at[0], at[1]);
      if (y == null) { skipped.push(`${id}:${index}`); return; }
      lanterns.push({id, index, position: [at[0], y + 1.55, at[1]], phase: (index * 2.1 + lanterns.length) % 6.28});
    });
  }
  if (skipped.length) console.warn('Keepsake lanterns with no walkable ground:', skipped.join(', '));
  const n = lanterns.length;
  const bodyGeo = new THREE.SphereGeometry(0.62, 14, 10); bodyGeo.scale(0.82, 1.1, 0.82);
  const darkMat = new THREE.MeshBasicMaterial({color: new THREE.Color(0.32, 0.2, 0.1)});
  const bodies = new THREE.InstancedMesh(bodyGeo, new THREE.MeshBasicMaterial({color: new THREE.Color(2.5, 0.95, 0.4)}), n);
  const caps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.34, 0.34, 0.16, 10), darkMat, n * 2);
  const tassels = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), darkMat, n);
  const halos = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({
    map: haloTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  }), n);
  for (const m of [bodies, caps, tassels, halos]) { m.frustumCulled = false; m.name = 'Keepsake lanterns'; world.scene.add(m); }
  const dummy = new THREE.Object3D(), halo = new THREE.Object3D();
  const gone = l => game.has(l.id, l.index);

  function draw(t) {
    lanterns.forEach((l, i) => {
      const s = gone(l) ? 0 : 1, bob = Math.sin(t * 1.6 + l.phase) * 0.12, [x, y, z] = l.position;
      dummy.position.set(x, y + bob, z); dummy.rotation.set(Math.sin(t * 0.9 + l.phase) * 0.05, t * 0.4 + l.phase, 0);
      dummy.scale.setScalar(s); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
      [0.62, -0.62].forEach((dy, k) => { dummy.position.set(x, y + bob + dy, z); dummy.updateMatrix(); caps.setMatrixAt(i * 2 + k, dummy.matrix); });
      dummy.position.set(x, y + bob - 1.15, z); dummy.updateMatrix(); tassels.setMatrixAt(i, dummy.matrix);
      halo.position.set(x, y + bob, z); halo.quaternion.copy(camera.quaternion);
      halo.scale.setScalar(s * (5.2 + Math.sin(t * 2.1 + l.phase) * 0.5)); halo.updateMatrix(); halos.setMatrixAt(i, halo.matrix);
    });
    for (const m of [bodies, caps, tassels, halos]) m.instanceMatrix.needsUpdate = true;
  }

  return {
    lanterns, skipped,
    /** The landmark whose lanterns the traveller is among, or null. */
    near(body) {
      let best = null;
      for (const l of lanterns) {
        const d = Math.hypot(l.position[0] - body.x, l.position[2] - body.z);
        if (d < NEAR && (!best || d < best.d)) best = {id: l.id, d};
      }
      return best?.id || null;
    },
    /** The nearest lantern not yet found, with its distance: for a hint. */
    nearestUnfound(body, radius = 60) {
      let best = null;
      for (const l of lanterns) {
        if (gone(l)) continue;
        const d = Math.hypot(l.position[0] - body.x, l.position[2] - body.z);
        if (d < radius && (!best || d < best.d)) best = {l, d};
      }
      return best;
    },
    /** Each frame: draw, and pick up what the traveller walks into (on foot or on the bike). */
    update(t, body, canPick = true) {
      draw(t);
      if (!canPick) return;
      for (const l of lanterns) {
        if (gone(l)) continue;
        const dx = l.position[0] - body.x, dz = l.position[2] - body.z;
        if (dx * dx + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS && Math.abs(l.position[1] - 1.55 - body.y) < 4) {
          const r = game.collect(l.id, l.index);
          if (r.fresh) onPick?.(l.id, l.index, r);
        }
      }
    },
  };
}
