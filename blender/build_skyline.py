"""The city skyline: every tower of 60 m or more from OSM, in one city-wide frame, shared by all worlds.

    python -P tools/research/skyline-prep.py
    D:/soft/blender/blender.exe -b --factory-startup --python blender/build_skyline.py [-- --no-render]
    npx gltf-transform optimize public/scenes/skyline/skyline.raw.glb public/scenes/skyline/skyline.glb \
        --compress meshopt --texture-compress false --simplify false --palette false

Shapes are OSM's Simple 3D Buildings parts (min_height..height), so stepped towers like Zifeng keep
their real silhouettes. Heights stay absolute (DSM metres); each world subtracts its own base and
offsets by its own origin when it loads the skyline (src/landmark-world.js).
A few landmarks are not extrusions and are modelled here: the Nanjing TV Tower (a needle with a pod)
and the skybridge joining the three Golden Eagle World towers.
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import area_common as ac  # noqa: E402
import kit  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'research' / 'skyline' / 'data'
OUT = ROOT / 'public' / 'scenes' / 'skyline'
RENDER = '--no-render' not in sys.argv

kit.PALETTE.update({
    'tower_glass': '#A9BDCF',     # most glass towers: pale blue-grey in the painted haze
    'tower_glass_dark': '#5E7C9A',  # Zifeng's deep blue-green glass
    'tower_stone': '#D9D2C2',     # stone- and tile-clad towers
    'tower_roof': '#7F8B97',
    'tv_tower': '#E8E4DA',
})
TV_IDS = {669339996}               # 南京广播电视塔 footprint: replaced by a modelled tower
ZIFENG = (-541.0, 2310.0)          # rough city-frame position, for the dark glass (≈ 32.0626 N, 118.7781 E)


def material_for(s):
    cx = sum(p[0] for p in s['pts']) / len(s['pts'])
    cy = sum(p[1] for p in s['pts']) / len(s['pts'])
    if abs(cx - ZIFENG[0]) < 60 and abs(cy - ZIFENG[1]) < 60:
        return 1
    return 0 if s['h'] >= 120 else 2


def extrude(bm, pts, z0, z1, mi, roof_mi):
    pts = pts[:-1] if pts[0] == pts[-1] else pts
    if len(pts) < 3 or z1 - z0 < 0.5:
        return
    # Wind counter-clockwise so side normals face out.
    area = sum(pts[i][0] * pts[i - 1][1] - pts[i - 1][0] * pts[i][1] for i in range(len(pts)))
    if area > 0:
        pts = pts[::-1]
    lo = [bm.verts.new((x, y, z0)) for x, y in pts]
    hi = [bm.verts.new((x, y, z1)) for x, y in pts]
    n = len(pts)
    for i in range(n):
        f = bm.faces.new((lo[i], lo[(i + 1) % n], hi[(i + 1) % n], hi[i]))
        f.material_index = mi
    try:
        top = bm.faces.new(hi)
        top.material_index = roof_mi
        bmesh.ops.triangulate(bm, faces=[top], quad_method='BEAUTY', ngon_method='EAR_CLIP')
    except ValueError:
        pass


def tv_tower(bm, cx, cy, z0):
    """南京广播电视塔 (318.5 m): a three-legged concrete shaft, a pod at ~200 m, a slim antenna."""
    for k in range(3):
        a = k * 2 * math.pi / 3
        for seg in range(12):
            t0, t1 = seg / 12, (seg + 1) / 12
            r0, r1 = 14 * (1 - t0) + 3 * t0, 14 * (1 - t1) + 3 * t1
            p0 = Vector((cx + math.cos(a) * r0, cy + math.sin(a) * r0, z0 + 190 * t0))
            p1 = Vector((cx + math.cos(a) * r1, cy + math.sin(a) * r1, z0 + 190 * t1))
            mid, d = (p0 + p1) / 2, p1 - p0
            R = Matrix.Translation(mid) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
            kit.add_box(bm, (0, 0, 0), (4.0, 4.0, d.length + 0.3), mi=4, matrix=R)
    for z, r, h in ((196, 18, 10), (210, 14, 7), (224, 9, 6)):
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=r, radius2=r * 0.92, depth=h)
        bmesh.ops.translate(bm, vec=(cx, cy, z0 + z), verts=c['verts'])
        for f in {f for v in c['verts'] for f in v.link_faces}:
            f.material_index = 4
    c = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=2.2, radius2=0.4, depth=90)
    bmesh.ops.translate(bm, vec=(cx, cy, z0 + 228 + 45), verts=c['verts'])
    for f in {f for v in c['verts'] for f in v.link_faces}:
        f.material_index = 4


def main():
    data = json.loads((DATA / 'solids.json').read_text(encoding='utf-8'))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    root = bpy.data.collections.new('Skyline')
    scene.collection.children.link(root)
    bm = bmesh.new()
    golden = []
    for s in data['solids']:
        cx = sum(p[0] for p in s['pts']) / len(s['pts'])
        cy = sum(p[1] for p in s['pts']) / len(s['pts'])
        if s['id'] in TV_IDS:
            tv_tower(bm, cx, cy, s['z0'])
            continue
        if s['name'].startswith('金鹰世界'):
            golden.append((cx, cy, s['h']))
        mi = material_for(s)
        extrude(bm, s['pts'], s['z0'] + s['min_h'] - (1.0 if s['min_h'] == 0 else 0), s['z0'] + s['h'], mi, 3)
    # Golden Eagle World: the three towers share a sky podium between about 190 and 230 m.
    if len(golden) >= 3:
        gx = sum(g[0] for g in golden) / len(golden)
        gy = sum(g[1] for g in golden) / len(golden)
        z0 = next(s['z0'] for s in data['solids'] if s['name'].startswith('金鹰世界'))
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=3, radius1=62, radius2=62, depth=38)
        bmesh.ops.translate(bm, vec=(gx, gy, z0 + 210), verts=c['verts'])
        for f in {f for v in c['verts'] for f in v.link_faces}:
            f.material_index = 0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = kit.mesh_object('Skyline', bm, root, ['tower_glass', 'tower_glass_dark', 'tower_stone', 'tower_roof', 'tv_tower'])
    OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(OUT / 'skyline.raw.glb'), export_format='GLB', use_selection=True,
                              export_cameras=False, export_lights=False, export_animations=False, export_materials='EXPORT',
                              export_yup=True, export_apply=True, export_normals=True, export_texcoords=False)
    tris = sum(len(p.vertices) - 2 for p in o.data.polygons)
    (OUT / 'skyline.json').write_text(json.dumps({'origin_wgs84': data['origin_wgs84'], 'solids': len(data['solids']),
                                                  'triangles': tris, 'heights': 'absolute DSM metres (EGM2008)',
                                                  'source': 'OpenStreetMap contributors (ODbL): building and building:part heights'},
                                                 indent=1), encoding='utf-8')
    print('SKYLINE', {'solids': len(data['solids']), 'triangles': tris, 'golden': len(golden)}, flush=True)
    if RENDER:
        ac.lookdev(scene)
        # The classic view across Xuanwu Lake: from Huanzhou, looking south-west at Zifeng.
        # City frame: Jiming ≈ (580, 2350); Huanzhou's south shore ≈ (480, 3230).
        cams = {
            'xuanwu': ac.camera(scene, 'Cam xuanwu', (420, 3250, 12), (-500, 2200, 120), 30),
            'xinjiekou': ac.camera(scene, 'Cam xinjiekou', (900, -900, 60), (0, 300, 150), 30),
            'aerial': ac.camera(scene, 'Cam aerial', (2600, -3600, 1300), (-600, 900, 100), 30),
        }
        ac.render_views(scene, cams, ROOT / 'design' / 'skyline', 'lookdev')


main()
