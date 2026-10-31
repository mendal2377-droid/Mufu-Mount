"""Name what stands on each blocked road spot found by tests/road-audit.py.

    D:/soft/blender/blender.exe -b art-src/core.blend --python tools/road-blockers.py -- core

Ray-casts down at each spot in test-results/road-blocks-<world>.json (Trees and Overhead are left
out, as in the walk grid) and prints the object and material it hits, and the OSM building whose
footprint contains the spot, if any.
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(bpy.data.filepath).resolve().parents[1]
WORLD = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'core'
spots = json.loads((ROOT / 'test-results' / f'road-blocks-{WORLD}.json').read_text(encoding='utf-8'))
feats = json.loads((ROOT / 'research' / WORLD / 'data' / 'features.json').read_text(encoding='utf-8'))


def inside(x, y, pts):
    c = False
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            c = not c
    return c


for lc in bpy.context.view_layer.layer_collection.children[0].children:
    if lc.name in ('Trees', 'Overhead', 'Gates'):
        lc.exclude = True
scene, dg = bpy.context.scene, bpy.context.evaluated_depsgraph_get()
for s in spots[:40]:
    x, y = s['at']
    hit, loc, n, idx, obj, _ = scene.ray_cast(dg, Vector((x, y, 900)), Vector((0, 0, -1)))
    mat = obj.data.materials[obj.data.polygons[idx].material_index].name if hit and obj.data.materials else None
    osm = [(b['id'], b['tags']) for b in feats['buildings'] if inside(x, y, b['pts'])]
    print('BLOCK', s['metres'], 'm', s['kind'], s['name'], s['at'], '->', obj.name if hit else None, mat,
          round(loc.z, 1) if hit else None, osm[:2])
