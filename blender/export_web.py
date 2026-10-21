"""Export a landmark .blend to the web: static GLB, tree instances, walk grid and scene metadata.

    D:/soft/blender/blender.exe -b art-src/zhongshan.blend --python blender/export_web.py -- zhongshan

Then compress (meshopt + quantisation):

    npx gltf-transform optimize public/scenes/zhongshan/static.raw.glb public/scenes/zhongshan/static.glb \
        --compress meshopt --texture-compress false --simplify false --palette false

Writes public/scenes/<id>/:
  static.raw.glb  architecture and ground, joined per collection so each material is one draw
  trees.json      [kind, x, y, z, rotY, scale] per tree in three.js axes (x, z, -y)
  walk.bin        Int16 heights in centimetres on 1 m grids (one per scene area, concatenated);
                  -32768 = not walkable
  scene.json      grid headers, spawns, seats, gates, provenance

The walk grid is ray-cast from above against everything except trees and gates (so the moon
gates' round openings can be walked through), so whatever is on top
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
        'static': ('Ground', 'Mausoleum axis', 'Music Stage', 'Meiling', 'Gates', 'Xiaoling'),
        'grids': [{'name': 'axis', 'x0': -95.0, 'x1': 225.0, 'y0': -255.0, 'y1': 675.0},
                  {'name': 'meiling', 'x0': -905.0, 'x1': -455.0, 'y0': -1405.0, 'y1': -995.0},
                  {'name': 'xiaoling', 'x0': -1695.0, 'x1': -885.0, 'y0': -1315.0, 'y1': 635.0, 'cell': 2.0}],
        'title': 'Sun Yat-sen Mausoleum, the Music Stage, Meiling Palace & Ming Xiaoling',
        # What the gates and the places menu call each spawn.
        'labels': {'axis': 'the Mausoleum', 'stair': 'the great stair', 'hall': 'the Sacrificial Hall',
                   'music': 'the Music Stage', 'meiling': 'Meiling Palace', 'meiling-terrace': 'the Phoenix Terrace',
                   'xiaoling': 'the Sacred Way of Ming Xiaoling', 'wengzhong': 'the Wengzhong Road', 'mingtower': 'the Ming Tower'},
        'zh': '中山陵 · 音乐台',
    },
    'oldsouth': {
        'static': ('Ground', 'Water', 'Temple', 'Town', 'Walls', 'City', 'Gates'),
        'grids': [{'name': 'fuzimiao', 'x0': -315.0, 'x1': 355.0, 'y0': -375.0, 'y1': 135.0},
                  {'name': 'south', 'x0': -815.0, 'x1': 215.0, 'y0': -1355.0, 'y1': -745.0, 'cell': 1.5}],
        'title': 'The Qinhuai, Fuzimiao, Laomendong & Zhonghua Gate',
        'zh': '秦淮河 · 夫子庙 · 老门东 · 中华门',
        'fog': 0.0007,
        'labels': {'qinhuai': 'the Qinhuai River', 'fuzimiao': 'the Confucius Temple', 'zhonghua': 'Zhonghua Gate',
                   'mendong': 'Laomendong', 'baoen': "the Bao'en Pagoda", 'wall': 'the top of Zhonghua Gate'},
        'provenance': 'Terrain: Copernicus GLO-30 (DLR/Airbus, ESA). River, banks, bridges, lanes, walls and house '
                      'footprints: OpenStreetMap contributors (ODbL). Architecture from published descriptions; '
                      'see research/oldsouth/FACTS.md.',
    },
    'palace': {
        'static': ('Ground', 'Water', 'Buildings', 'Overhead', 'Garden', 'City', 'Gates'),   # not 'Palace': the root's name
        'grids': [{'name': 'palace', 'x0': -325.0, 'x1': 265.0, 'y0': -265.0, 'y1': 255.0}],
        'title': 'The Presidential Palace',
        'zh': '总统府',
        'fog': 0.0006,
        'labels': {'palace': 'the Presidential Palace gate', 'garden': 'the West Garden and the marble boat',
                   'zichao': 'the Zichao Building'},
        'provenance': 'Terrain: Copernicus GLO-30 (DLR/Airbus, ESA). Buildings, lake and streets: OpenStreetMap '
                      'contributors (ODbL). Architecture from Commons photographs; see research/palace/FACTS.md.',
    },
    'niushou': {
        'static': ('Ground', 'Water', 'Palace', 'Pagoda', 'City', 'Gates'),
        # The plaza between the pagoda and the palace, and the ring round the dome.
        'grids': [{'name': 'plaza', 'x0': -220.0, 'x1': 120.0, 'y0': -320.0, 'y1': 100.0}],
        'title': 'Niushou Mountain: the Usnisha Palace and the Foding Pagoda',
        'zh': '牛首山 · 佛顶宫 · 佛顶塔',
        'fog': 0.0006,
        'labels': {'niushou': 'the plaza of Niushou Mountain', 'dome': 'the Usnisha Palace', 'pagoda': 'the Foding Pagoda'},
        'provenance': 'Terrain: Copernicus GLO-30 (DLR/Airbus, ESA). Palace, pagoda, halls and roads: OpenStreetMap '
                      'contributors (ODbL). Shapes from published figures and photographs; see research/niushou/FACTS.md.',
    },
    'bridge': {
        'static': ('Ground', 'Water', 'Far', 'Bridge', 'Overhead', 'City', 'Gates'),
        # The deck's walkways on a grid laid along the bridge (yaw = the OSM outline's axis), fine
        # enough for 2.25 m walkways; the South Bridgehead Park beside it, on the downstream side.
        'grids': [{'name': 'deck', 'yaw': 2.6089525, 'x0': -40.0, 'x1': 1710.0, 'y0': -12.0, 'y1': 12.0, 'cell': 0.75},
                  {'name': 'park', 'yaw': 2.6089525, 'x0': -260.0, 'x1': 330.0, 'y0': -300.0, 'y1': -16.0, 'cell': 1.5}],
        'title': 'The Nanjing Yangtze River Bridge',
        'zh': '南京长江大桥',
        'fog': 0.00032,
        'labels': {'bridge': 'the South Bridgehead', 'deck': 'the road deck', 'riverside': 'the riverbank under the bridge',
                   'mid': 'mid-river, on the deck'},
        'provenance': 'Terrain: Copernicus GLO-30 (DLR/Airbus, ESA). Bridge outline, roads, railway, river, park and '
                      'buildings: OpenStreetMap contributors (ODbL). Structure from published figures; see research/bridge/FACTS.md.',
    },
    'north': {
        'static': ('Ground', 'Water', 'Temple', 'Walls', 'City', 'Gates'),
        # Jiming hill at 1 m (stairs); the island shore at 1.5 m (flat lawns and paths).
        'grids': [{'name': 'jiming', 'x0': -255.0, 'x1': 315.0, 'y0': -315.0, 'y1': 315.0},
                  {'name': 'islands', 'x0': -815.0, 'x1': 135.0, 'y0': 825.0, 'y1': 1495.0, 'cell': 1.5}],
        'title': 'Jiming Temple, Taicheng & Xuanwu Lake',
        'fog': 0.00042,
        'zh': '鸡鸣寺 · 台城 · 玄武湖',
        'labels': {'jiming': 'Jiming Temple', 'pagoda': 'the Yaoshi Pagoda', 'cherry': 'Jiming Road',
                   'taicheng': 'the Taicheng wall', 'xuanwu': 'Xuanwu Lake'},
        'provenance': 'Terrain: Copernicus GLO-30 (DLR/Airbus, ESA). Lake, islands, walls, streets and buildings: '
                      'OpenStreetMap contributors (ODbL). Architecture modelled from published descriptions; see research/north/FACTS.md.',
    },
}


def to_three(v):
    return [round(v[0], 3), round(v[2], 3), round(-v[1], 3)]


STATIC_COLLECTIONS = SETTINGS[SCENE_ID].get('static', ('Ground', 'Mausoleum axis', 'Music Stage', 'Meiling', 'Gates'))
# Left out of the walk-grid ray cast: trees, moon gates, and anything overhead that people walk under
# (gate lintels and attics), so the ground beneath stays walkable.
CAST_EXCLUDE = ('Trees', 'Gates', 'Overhead')


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


def walk_grid(trees, grid):
    """Ray-cast one 1 m grid. Trees and gates are excluded from the cast, then trunks are stamped out."""
    s = bpy.context.scene
    # Exclude whole collections in one step: hiding ~24,000 objects one by one is minutes.
    layers = [lc for lc in _walk_layers(bpy.context.view_layer.layer_collection) if lc.name in CAST_EXCLUDE]
    for lc in layers:
        lc.exclude = True
    dg = bpy.context.evaluated_depsgraph_get()
    cell = grid.get('cell', CELL)
    nx = int((grid['x1'] - grid['x0']) / cell)
    ny = int((grid['y1'] - grid['y0']) / cell)
    heights = [NO_WALK] * (nx * ny)
    mats_cache = {}
    walk_count = 0
    # A yawed grid (the bridge deck) runs in its own (u, v) frame, turned about the world origin.
    cy_, sy_ = math.cos(grid.get('yaw', 0.0)), math.sin(grid.get('yaw', 0.0))
    for j in range(ny):
        v = grid['y0'] + (j + 0.5) * cell
        for i in range(nx):
            u = grid['x0'] + (i + 0.5) * cell
            x, y = u * cy_ - v * sy_, u * sy_ + v * cy_
            hit, loc, normal, index, obj, _ = s.ray_cast(dg, Vector((x, y, 800.0)), Vector((0, 0, -1)))
            # Either winding: some ring and fan meshes face down, and only the surface's height matters.
            if not hit or abs(normal.z) < 0.5:
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
        x, y = o.location.x * cy_ + o.location.y * sy_, -o.location.x * sy_ + o.location.y * cy_
        if not (grid['x0'] - 3 < x < grid['x1'] + 3 and grid['y0'] - 3 < y < grid['y1'] + 3):
            continue
        r = TRUNK_RADIUS * max(o.scale.x, 0.6)
        for jj in range(int((y - r - grid['y0']) / cell), int((y + r - grid['y0']) / cell) + 1):
            for ii in range(int((x - r - grid['x0']) / cell), int((x + r - grid['x0']) / cell) + 1):
                if 0 <= ii < nx and 0 <= jj < ny:
                    cx = grid['x0'] + (ii + 0.5) * cell
                    cy = grid['y0'] + (jj + 0.5) * cell
                    if math.hypot(cx - x, cy - y) <= r:
                        heights[jj * nx + ii] = NO_WALK
    for lc in layers:
        lc.exclude = False
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


def _rides():
    out = {}
    for o in sorted(bpy.context.scene.objects, key=lambda o: o.name):
        if o.name.startswith('Ride '):
            route = o.name.split(' ')[1]
            out.setdefault(route, []).append(to_three(o.location))
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
    grids, heights, walk_count = [], [], 0
    for g in cfg['grids']:
        nx, ny, h, n = walk_grid(trees, g)
        grids.append({'name': g['name'], 'nx': nx, 'ny': ny, 'x0': g['x0'], 'y0': g['y0'], 'cell': g.get('cell', CELL),
                      'offset': len(heights), **({'yaw': g['yaw']} if g.get('yaw') else {})})
        heights += h
        walk_count += n
    lap('walk grids')
    (OUT / 'walk.bin').write_bytes(struct.pack(f'<{len(heights)}h', *heights))
    (OUT / 'trees.json').write_text(json.dumps(trees_out, separators=(',', ':')), encoding='utf-8')
    # Trees are recorded; drop them so join/export operators don't walk ~24,000 objects.
    bpy.data.batch_remove(ids=trees)
    lap('remove trees')
    glb, tris = export_static(static)
    lap('export static')
    gates = [{'target': k.split('@')[0], **v} for k, v in named_points('Gate').items()]
    meta = {
        'id': SCENE_ID,
        'title': cfg['title'],
        'zh': cfg['zh'],
        'axes': 'three.js: x = east, y = up, z = south (Blender x, z, -y); metres',
        # Grid in three.js terms: column i -> x = x0 + (i + .5) * cell, row j -> z = -(y0 + (j + .5) * cell).
        'walk': {'cell': CELL, 'noWalk': NO_WALK, 'grids': grids, 'walkableCells': walk_count},
        'labels': cfg.get('labels', {}),
        'origin_wgs84': list(bpy.context.scene.get('origin_wgs84', [])),
        'base_z': bpy.context.scene.get('base_z'),
        'fog': cfg.get('fog'),
        'spawns': named_points('Spawn'),
        'gates': gates,
        'bells': named_points('Bell'),
        'docks': named_points('Dock'),
        # Boat routes: 'Ride <route> NNN' empties in order, as three.js points.
        'rides': _rides(),
        'seats': named_points('Seat'),
        # Moving traffic (trains, ships, cars): the build stores routes in Blender metres.
        'traffic': [{**t, 'pts': [to_three(Vector(p)) for p in t['pts']]}
                    for t in json.loads(bpy.context.scene.get('traffic', '[]'))],
        'trees': len(trees_out),
        'staticTriangles': tris,
        'provenance': cfg.get('provenance', 'Terrain: Copernicus GLO-30 (DLR/Airbus, ESA). Outlines: OpenStreetMap contributors (ODbL). '
                                            'Architecture modelled from published dimensions; see research/zhongshan/FACTS.md.'),
    }
    (OUT / 'scene.json').write_text(json.dumps(meta, indent=1, ensure_ascii=False), encoding='utf-8')
    print('EXPORTED', json.dumps({k: meta[k] for k in ('trees', 'staticTriangles')} | {'walk': meta['walk'],
          'spawns': list(meta['spawns']), 'seats': len(meta['seats']), 'gates': len(gates), 'glb': glb.stat().st_size}), flush=True)


main()
