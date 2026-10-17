"""Export a landmark .blend to the web: static GLB, tree instances, walk grid and scene metadata.

    D:/soft/blender/blender.exe -b art-src/zhongshan.blend --python blender/export_web.py -- zhongshan

Then compress (meshopt + quantisation):

    npx gltf-transform optimize public/scenes/zhongshan/static.raw.glb public/scenes/zhongshan/static.glb \
        --compress meshopt --texture-compress false --simplify false --palette false

Writes public/scenes/<id>/:
  static.raw.glb  architecture and ground, joined per collection so each material is one draw
  trees.json      [kind, x, y, z, rotY, scale] per tree in three.js axes (x, z, -y)
  walk.bin        Int16 heights in centimetres on a 1 m grid; -32768 = not walkable
  scene.json      grid header, spawns, seats, bounds, provenance

The walk grid is ray-cast from above against everything except trees, so whatever is on top
decides: paving, steps, lawn and forest floor are walkable; roofs, hedges, water and openings
are not. Balustrades and walls are walkable on top but sit more than STEP_UP above their
neighbours, so the browser treats them as walls.
"""
import json
import math
import time
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SCENE_ID = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'zhongshan'
OUT = ROOT / 'public' / 'scenes' / SCENE_ID
OUT.mkdir(parents=True, exist_ok=True)

WALKABLE = {'paving', 'paving_joint', 'granite', 'granite_shade', 'lawn', 'forest_floor'}
NO_WALK = -32768
CELL = 1.0
TRUNK_RADIUS = 0.9

# Per-scene export settings: walk-grid extent (Blender x/y), spawns and seats (Blender coords).
# Spawns are filled from named cameras/empties when present, else from these.
SETTINGS = {
    'zhongshan': {
        'grid': {'x0': -95.0, 'x1': 225.0, 'y0': -255.0, 'y1': 675.0},
        'title': 'Sun Yat-sen Mausoleum & the Music Stage',
        'zh': '中山陵 · 音乐台',
    },
}


def to_three(v):
    return [round(v[0], 3), round(v[2], 3), round(-v[1], 3)]


STATIC_COLLECTIONS = ('Ground', 'Mausoleum axis', 'Music Stage')


def collect():
    """Read collections directly. Asking each object for users_collection scans every collection
    and turned this into minutes once the far canopy pushed the scene past 24,000 objects."""
    cols = bpy.data.collections
    static = [o for name in STATIC_COLLECTIONS if name in cols
              for o in cols[name].objects if o.type == 'MESH' and not o.hide_render]
    trees = [o for o in cols['Trees'].objects if o.type == 'MESH'] if 'Trees' in cols else []
    return static, trees


def tree_records(trees):
    out = []
    for o in trees:
        kind = o.data.name.replace('proto ', '').replace(' ', '_')
        out.append([kind, *to_three(o.location), round(o.rotation_euler.z, 3), round(o.scale.x, 3)])
    return out


def walk_grid(static, trees, grid):
    """Ray-cast the 1 m grid. Trees are hidden from the cast, then trunks are stamped out."""
    s = bpy.context.scene
    # Exclude the whole Trees collection in one step: hiding ~24,000 objects one by one is minutes.
    tree_layer = bpy.context.view_layer.layer_collection.children['Zhongshan'].children['Trees']         if 'Zhongshan' in bpy.context.view_layer.layer_collection.children else None
    if tree_layer is None:
        tree_layer = next(lc for lc in _walk_layers(bpy.context.view_layer.layer_collection) if lc.name == 'Trees')
    tree_layer.exclude = True
    dg = bpy.context.evaluated_depsgraph_get()
    nx = int((grid['x1'] - grid['x0']) / CELL)
    ny = int((grid['y1'] - grid['y0']) / CELL)
    heights = [NO_WALK] * (nx * ny)
    mats_cache = {}
    walk_count = 0
    for j in range(ny):
        y = grid['y0'] + (j + 0.5) * CELL
        for i in range(nx):
            x = grid['x0'] + (i + 0.5) * CELL
            hit, loc, normal, index, obj, _ = s.ray_cast(dg, Vector((x, y, 500.0)), Vector((0, 0, -1)))
            if not hit or normal.z < 0.5:
                continue
            key = (obj.name, index)
            name = mats_cache.get(key)
            if name is None:
                me = obj.data
                poly = me.polygons[index] if index < len(me.polygons) else None
                m = me.materials[poly.material_index] if poly and me.materials else None
                name = m.name.split('.')[0] if m else ''
                mats_cache[key] = name
            if name in WALKABLE:
                heights[j * nx + i] = max(-32000, min(32000, int(round(loc.z * 100))))
                walk_count += 1
    # Trunks: unwalkable discs round each tree inside the grid.
    for o in trees:
        x, y = o.location.x, o.location.y
        if not (grid['x0'] - 3 < x < grid['x1'] + 3 and grid['y0'] - 3 < y < grid['y1'] + 3):
            continue
        r = TRUNK_RADIUS * max(o.scale.x, 0.6)
        for jj in range(int((y - r - grid['y0']) / CELL), int((y + r - grid['y0']) / CELL) + 1):
            for ii in range(int((x - r - grid['x0']) / CELL), int((x + r - grid['x0']) / CELL) + 1):
                if 0 <= ii < nx and 0 <= jj < ny:
                    cx = grid['x0'] + (ii + 0.5) * CELL
                    cy = grid['y0'] + (jj + 0.5) * CELL
                    if math.hypot(cx - x, cy - y) <= r:
                        heights[jj * nx + ii] = NO_WALK
    tree_layer.exclude = False
    return nx, ny, heights, walk_count


def _walk_layers(lc):
    yield lc
    for c in lc.children:
        yield from _walk_layers(c)


def named_points(prefix):
    """Empties or cameras named '<prefix> <id>' become spawn/seat records."""
    out = {}
    for o in bpy.context.scene.objects:
        if o.name.startswith(prefix + ' '):
            fwd = o.matrix_world.to_quaternion() @ Vector((0, 0, -1)) if o.type == 'CAMERA' else \
                o.matrix_world.to_quaternion() @ Vector((0, 1, 0))
            out[o.name[len(prefix) + 1:]] = {'position': to_three(o.location),
                                             'look': to_three(o.location + fwd * 30)}
    return out


def export_static(static):
    bpy.ops.object.select_all(action='DESELECT')
    groups = {}
    for o in static:
        groups.setdefault(next(n for n in STATIC_COLLECTIONS if o.name in bpy.data.collections[n].objects), []).append(o)
    joined = []
    for name, objs in groups.items():
        # Roofs etc. share mesh data only once; make each single-user before joining.
        for o in objs:
            if o.data.users > 1:
                o.data = o.data.copy()
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = objs[0]
        if len(objs) > 1:
            bpy.ops.object.join()
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
        objs[0].name = name
        joined.append(objs[0])
    bpy.ops.object.select_all(action='DESELECT')
    for o in joined:
        o.select_set(True)
    path = OUT / 'static.raw.glb'
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True,
                              export_cameras=False, export_lights=False, export_animations=False,
                              export_materials='EXPORT', export_extras=False, export_yup=True,
                              export_apply=True, export_normals=True, export_texcoords=False)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in joined)
    return path, tris


def main():
    cfg = SETTINGS[SCENE_ID]
    clock = time.time()

    def lap(label):
        nonlocal clock
        print(f'  {label}: {time.time() - clock:.1f} s', flush=True)
        clock = time.time()
    static, trees = collect()
    trees_out = tree_records(trees)
    lap('collect')
    nx, ny, heights, walk_count = walk_grid(static, trees, cfg['grid'])
    lap('walk grid')
    (OUT / 'walk.bin').write_bytes(struct.pack(f'<{len(heights)}h', *heights))
    (OUT / 'trees.json').write_text(json.dumps(trees_out, separators=(',', ':')), encoding='utf-8')
    # Trees are recorded; drop them so join/export operators don't walk ~24,000 objects.
    bpy.data.batch_remove(ids=trees)
    lap('remove trees')
    glb, tris = export_static(static)
    lap('export static')
    g = cfg['grid']
    meta = {
        'id': SCENE_ID,
        'title': cfg['title'],
        'zh': cfg['zh'],
        'axes': 'three.js: x = east, y = up, z = south (Blender x, z, -y); metres',
        # Grid in three.js terms: column i -> x = x0 + (i + .5) * cell, row j -> z = -(y0 + (j + .5) * cell).
        'walk': {'nx': nx, 'ny': ny, 'cell': CELL, 'x0': g['x0'], 'y0': g['y0'], 'noWalk': NO_WALK,
                 'walkableCells': walk_count},
        'spawns': named_points('Spawn'),
        'seats': named_points('Seat'),
        'trees': len(trees_out),
        'staticTriangles': tris,
        'provenance': 'Terrain: Copernicus GLO-30 (DLR/Airbus, ESA). Outlines: OpenStreetMap contributors (ODbL). '
                      'Architecture modelled from published dimensions; see research/zhongshan/FACTS.md.',
    }
    (OUT / 'scene.json').write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding='utf-8')
    print('EXPORTED', json.dumps({k: meta[k] for k in ('trees', 'staticTriangles')} | {'walk': meta['walk'],
          'spawns': list(meta['spawns']), 'seats': len(meta['seats']), 'glb': glb.stat().st_size}), flush=True)


main()
