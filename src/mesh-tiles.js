import * as THREE from 'three';

// Speed on older computers (the owner's note 3, 28 Nov): the export joins each collection into a few
// huge meshes (the city's roads 1.04 M triangles in one, the terrain 1.25 M, the buildings 0.55 M), each
// spanning the whole map. A mesh is drawn whole or not at all, so the city was drawn whole every frame,
// behind the camera too: 9 to 11 M triangles. Here each big mesh is cut at load into square tiles by its
// triangles' middles, so the browser's frustum test and the far plane leave out what is not in view.
// The tiles keep the mesh's material, shadow flags and parent; nothing else about the scene changes.

const raw = (attr) => (attr.isInterleavedBufferAttribute
  ? (i, c) => attr.data.array[i * attr.data.stride + attr.offset + c]
  : (i, c) => attr.array[i * attr.itemSize + c]);

/** Cut `mesh` into tiles of `size` metres (in world x, z); returns the new meshes (already added). */
export function tileMesh(mesh, size = 400) {
  const g = mesh.geometry, pos = g.attributes.position, idx = g.index;
  const triCount = (idx ? idx.count : pos.count) / 3;
  const vert = (t, k) => (idx ? idx.getX(t * 3 + k) : t * 3 + k);
  mesh.updateWorldMatrix(true, false);
  const m = mesh.matrixWorld, v = new THREE.Vector3();
  const groups = g.groups.length ? g.groups : [{start: 0, count: idx ? idx.count : pos.count, materialIndex: 0}];
  const buckets = new Map();   // "tile:material" -> triangle list
  for (const gr of groups) {
    for (let t = gr.start / 3; t < (gr.start + gr.count) / 3; t++) {
      let cx = 0, cz = 0;
      for (let k = 0; k < 3; k++) { v.fromBufferAttribute(pos, vert(t, k)).applyMatrix4(m); cx += v.x; cz += v.z; }
      const key = `${Math.floor(cx / 3 / size)},${Math.floor(cz / 3 / size)}:${gr.materialIndex ?? 0}`;
      (buckets.get(key) || buckets.set(key, []).get(key)).push(t);
    }
  }
  if (buckets.size < 2) return [];
  const names = Object.keys(g.attributes), mats = [].concat(mesh.material), out = [];
  for (const [key, tris] of buckets) {
    const remap = new Map(), order = [];
    const index = new Uint32Array(tris.length * 3);
    tris.forEach((t, j) => {
      for (let k = 0; k < 3; k++) {
        const o = vert(t, k);
        let n = remap.get(o);
        if (n === undefined) { n = order.length; remap.set(o, n); order.push(o); }
        index[j * 3 + k] = n;
      }
    });
    const geo = new THREE.BufferGeometry();
    for (const name of names) {
      const a = g.attributes[name], get = raw(a), size_ = a.itemSize;
      const Arr = a.isInterleavedBufferAttribute ? a.data.array.constructor : a.array.constructor;
      const arr = new Arr(order.length * size_);
      order.forEach((o, i) => { for (let c = 0; c < size_; c++) arr[i * size_ + c] = get(o, c); });
      geo.setAttribute(name, new THREE.BufferAttribute(arr, size_, a.normalized));
    }
    geo.setIndex(new THREE.BufferAttribute(order.length < 65536 ? new Uint16Array(index) : index, 1));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    const mi = +key.split(':')[1];
    const tile = new THREE.Mesh(geo, mats[mi] || mats[0]);
    tile.name = `${mesh.name}_tile_${key.split(':')[0].replace(',', '_')}_${mi}`;
    tile.position.copy(mesh.position); tile.quaternion.copy(mesh.quaternion); tile.scale.copy(mesh.scale);
    tile.castShadow = mesh.castShadow; tile.receiveShadow = mesh.receiveShadow; tile.renderOrder = mesh.renderOrder;
    tile.userData = {...mesh.userData, tileOf: mesh.name};
    mesh.parent.add(tile);
    out.push(tile);
  }
  mesh.parent.remove(mesh);
  g.dispose();
  return out;
}

/** Tile every mesh in `root` over `minTris` triangles, but not those `keep(mesh)` holds whole. */
export function tileScene(root, {minTris = 40000, size = 400, keep = () => false} = {}) {
  const big = [];
  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || keep(o)) return;
    const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
    if (n >= minTris) big.push(o);
  });
  let tiles = 0;
  for (const o of big) tiles += tileMesh(o, size).length;
  return {meshes: big.length, tiles};
}
