"""Audit the built city in Blender, where the geometry is (tests/city-audit.py checks the export).

    D:/soft/blender/blender.exe -b art-src/core.blend --python tools/scene-audit.py -- core

  trees in buildings   a ray up from each trunk (half a metre above its foot) must not hit a
                       building: a tree under a roof stands inside it
  buildings in water   no building's roof stands over water (a ray down from inside the roof,
                       buildings left out, hits the water)
  heights              every building is 2 m to 460 m tall (紫峰大厦, the tallest, is 450 m)

Prints one ok or FAIL line per check, with examples, and exits non-zero on a failure.
"""
import json
import sys
from collections import Counter
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(bpy.data.filepath).resolve().parents[1]
WORLD = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'core'
TALLEST = 460.0
failures = []


def check(name, ok, detail):
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {detail}", flush=True)
    if not ok:
        failures.append(name)


def collection(name):
    return bpy.data.collections.get(name)


def set_excluded(names):
    for lc in bpy.context.view_layer.layer_collection.children[0].children:
        lc.exclude = lc.name in names
    return bpy.context.evaluated_depsgraph_get()


scene = bpy.context.scene
# The OSM city is in City (mapped buildings and infill); Buildings holds the hand-built heroes (the
# Palace and its garden, Taiping Lake included), which trees may not enter either.
CITY, HEROES = 'City', 'Buildings'
buildings = [o for o in (collection(CITY).all_objects if collection(CITY) else []) if o.type == 'MESH']
names = {o.name for n in (CITY, HEROES) if collection(n) for o in collection(n).all_objects}

# --- trees inside buildings: only buildings in the scene, so a hit is a roof or a wall -----------
dg = set_excluded({n.name for n in bpy.data.collections} - {CITY, HEROES})
inside, examples = Counter(), []
trees = [o for o in (collection('Trees').all_objects if collection('Trees') else []) if o.type == 'MESH']
for o in trees:
    kind = o.data.name.replace('proto ', '')
    hit, loc, n, idx, obj, _ = scene.ray_cast(dg, o.location + Vector((0, 0, 0.5)), Vector((0, 0, 1)), distance=TALLEST)
    if hit and obj.name in names:
        inside[kind] += 1
        if len(examples) < 6:
            examples.append((kind, round(o.location.x), round(o.location.y), obj.name[:20]))
total = sum(inside.values())
check('trees in buildings', total <= max(5, len(trees) // 2000),
      f'{total} of {len(trees)} trees stand under a building {dict(inside)}; e.g. {examples}')

# --- buildings in water, and building heights, from the roofs ------------------------------------
dg_ground = set_excluded({CITY, HEROES, 'Overhead', 'Trees', 'Gates', 'Prototypes', 'Markers'})
wet, tall, low, roofs = [], [], [], 0
for o in buildings:
    mw, me = o.matrix_world, o.data
    for p in me.polygons:
        if p.normal.z < 0.9 or p.area < 20:
            continue
        roofs += 1
        c = mw @ p.center
        hit, loc, n, idx, obj, _ = scene.ray_cast(dg_ground, c + Vector((0, 0, 1)), Vector((0, 0, -1)), distance=TALLEST + 50)
        if not hit:
            continue
        mats = obj.data.materials
        mat = mats[obj.data.polygons[idx].material_index].name.split('.')[0] if mats and idx < len(obj.data.polygons) else ''
        h = c.z - loc.z
        if mat == 'water' and len(wet) < 400:
            wet.append((o.name[:20], round(c.x), round(c.y)))
        if h > TALLEST:
            tall.append((o.name[:20], round(c.x), round(c.y), round(h)))
        if 0 < h < 2.0 and p.area > 60:
            low.append((o.name[:20], round(c.x), round(c.y), round(h, 1)))
# Buildings the map itself puts in a water area (wharves on the Yangtze, a pavilion in Xuanwu
# Lake) are real; only the build's own mistakes fail.
feats = json.loads((ROOT / 'research' / WORLD / 'data' / 'features.json').read_text(encoding='utf-8'))


def mapped_in_water(x, y):
    for w in feats['water']:
        pts, c = w['pts'], False
        for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
            if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
                c = not c
        if c:
            return True
    return False


mapped = [r for r in wet if mapped_in_water(r[1], r[2])]
wet = [r for r in wet if r not in mapped]
print(f'     {len(mapped)} roofs stand in water areas OSM maps them in (wharves, pavilions): {mapped[:4]}')
check('buildings in water', len(wet) <= 3, f'{len(wet)} of {roofs} roofs stand over water; e.g. {wet[:6]}')
check('heights', not tall and len(low) <= roofs // 500,
      f'{len(tall)} roofs over {TALLEST:.0f} m, {len(low)} under 2 m, of {roofs}; e.g. {(tall + low)[:6]}')

print(f"scene audit {WORLD} {'FAILED: ' + ', '.join(failures) if failures else 'passed'}", flush=True)
sys.exit(1 if failures else 0)
