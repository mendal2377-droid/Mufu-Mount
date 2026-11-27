import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {tileMesh, tileScene} from '../src/mesh-tiles.js';

// A 2 km square ground of 20 x 20 quads, scaled from unit coordinates as the quantised export does.
function ground({interleaved = false} = {}) {
  const g = new THREE.PlaneGeometry(1, 1, 20, 20).rotateX(-Math.PI / 2);
  if (interleaved) {
    const p = g.attributes.position, uv = g.attributes.uv, n = p.count, buf = new Float32Array(n * 5);
    for (let i = 0; i < n; i++) buf.set([p.getX(i), p.getY(i), p.getZ(i), uv.getX(i), uv.getY(i)], i * 5);
    const ib = new THREE.InterleavedBuffer(buf, 5);
    g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0));
    g.setAttribute('uv', new THREE.InterleavedBufferAttribute(ib, 2, 3));
    g.deleteAttribute('normal');
  }
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
  m.name = 'Ground'; m.scale.set(2000, 1, 2000); m.castShadow = true;
  const root = new THREE.Group(); root.add(m);
  return {root, m, tris: g.index.count / 3};
}

test('A big mesh is cut into tiles that keep every triangle once, its transform and flags', () => {
  const {root, m, tris} = ground();
  const tiles = tileMesh(m, 800);
  assert.ok(tiles.length >= 9 && tiles.length <= 16, `${tiles.length} tiles`);
  assert.equal(tiles.reduce((a, t) => a + t.geometry.index.count / 3, 0), tris);
  assert.ok(!root.children.includes(m), 'the original mesh is gone');
  for (const t of tiles) {
    assert.equal(t.parent, root); assert.equal(t.scale.x, 2000); assert.ok(t.castShadow); assert.equal(t.userData.tileOf, 'Ground');
    // Every triangle of a tile has its middle inside the tile's 800 m square.
    const p = t.geometry.attributes.position, idx = t.geometry.index, [, ix, iz] = t.name.match(/_tile_(-?\d+)_(-?\d+)_/).map(Number);
    for (let k = 0; k < idx.count; k += 3) {
      const cx = (p.getX(idx.getX(k)) + p.getX(idx.getX(k + 1)) + p.getX(idx.getX(k + 2))) / 3 * 2000;
      const cz = (p.getZ(idx.getX(k)) + p.getZ(idx.getX(k + 1)) + p.getZ(idx.getX(k + 2))) / 3 * 2000;
      assert.equal(Math.floor(cx / 800), ix); assert.equal(Math.floor(cz / 800), iz);
    }
  }
});

test('Interleaved attributes are copied value for value', () => {
  const {m, tris} = ground({interleaved: true});
  const before = new Set();
  const p = m.geometry.attributes.position, uv = m.geometry.attributes.uv;
  for (let i = 0; i < p.count; i++) before.add(`${p.getX(i).toFixed(4)},${p.getZ(i).toFixed(4)},${uv.getX(i).toFixed(4)},${uv.getY(i).toFixed(4)}`);
  const tiles = tileMesh(m, 800);
  assert.equal(tiles.reduce((a, t) => a + t.geometry.index.count / 3, 0), tris);
  for (const t of tiles) {
    const q = t.geometry.attributes.position, u = t.geometry.attributes.uv;
    for (let i = 0; i < q.count; i++) assert.ok(before.has(`${q.getX(i).toFixed(4)},${q.getZ(i).toFixed(4)},${u.getX(i).toFixed(4)},${u.getY(i).toFixed(4)}`));
  }
});

test('Small meshes and kept ones stay whole', () => {
  const {root} = ground();
  const far = ground().m; far.name = 'Far'; root.add(far);
  const r = tileScene(root, {minTris: 100, size: 800, keep: (o) => o.name === 'Far'});
  assert.equal(r.meshes, 1);
  assert.ok(root.children.includes(far));
  assert.equal(tileScene(new THREE.Group().add(ground().m), {minTris: 1e6}).meshes, 0);
});
