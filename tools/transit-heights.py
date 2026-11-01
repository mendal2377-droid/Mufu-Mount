"""Ground heights along each transit line, from the built city (the walk grid stops short of the
north, where Line 1 rises onto its viaduct).

    D:/soft/blender/blender.exe -b art-src/core.blend --python tools/transit-heights.py -- core

Ray-casts down onto the ground and roads at every point of public/scenes/<world>/transit.json and
stores the heights as each line's `z` (three.js y, metres; matches the exported scene's frame).
"""
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(bpy.data.filepath).resolve().parents[1]
WORLD = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else 'core'
path = ROOT / 'public' / 'scenes' / WORLD / 'transit.json'
data = json.loads(path.read_text(encoding='utf-8'))
for lc in bpy.context.view_layer.layer_collection.children[0].children:
    lc.exclude = lc.name not in ('Ground', 'Roads', 'Far')
scene, dg = bpy.context.scene, bpy.context.evaluated_depsgraph_get()
for line in data['lines']:
    zs, last = [], 0.0
    for x, y in line['pts']:
        hit, loc, *_ = scene.ray_cast(dg, Vector((x, y, 900.0)), Vector((0, 0, -1)))
        last = round(loc.z, 2) if hit else last
        zs.append(last)
    line['z'] = zs
    print(line['en'], 'heights', min(zs), max(zs), flush=True)
path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
