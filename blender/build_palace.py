"""Presidential Palace 总统府: the 1929 gate, the Qing great hall, the Zichao Building, the West Garden.

    D:/soft/blender/blender.exe -b --factory-startup --python blender/build_palace.py [-- --no-render]

Evidence (research/palace/FACTS.md; Wikipedia/Commons photographs, inspection only): OSM gives the
gate (way 321096461, height 12.4), the great hall 大堂 (321096460), the Zichao Building 子超楼
(321096452), Sun Yat-sen's office in the West Garden (625069539), Taiping Lake 太平湖 (532885964) and
the Executive Yuan blocks (625069540, 1015404006). Shapes: a grey stone neoclassical gate with three
round arches, paired columns, a stepped attic with gold characters and a flagpole; a wide Qing hall
with red columns, dark timber front and grey hip-and-gable roof; the Zichao Building in ochre brick,
five storeys with a cream central bay of loggias; the marble boat 不系舟 with a timber cabin.
Assumptions: storey heights, courtyard walls and side wings, roof heights, garden planting.
"""
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import area_common as ac  # noqa: E402
import kit  # noqa: E402
import kit_oldcity as oc  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT_BLEND = ROOT / 'art-src' / 'palace.blend'
RENDERS = ROOT / 'design' / 'palace'
RENDER = '--no-render' not in sys.argv
rnd = random.Random(1929)

A = ac.Area('palace')
F = A.feats
PATCH = ((-330.0, 270.0), (-270.0, 260.0))
AX = 9.5                                   # the axis: gate, great hall and Zichao Building line up at x ≈ 9.5
Z = 0.0
kit.PALETTE.update({'palace_stone': '#8F8D86', 'zichao_brick': '#C9A465', 'zichao_cream': '#EDE4CF',
                    'courtyard_wall': '#B4AFA4', 'koi': '#E8763A'})


def building(name):
    return next(b for b in F['buildings'] if b['name'] == name)


lake = next(w['pts'] for w in F['water'] if w['name'] == '太平湖')
lake_mask = ac.Mask([lake], A.extent, 2.0)


def ground(x, y):
    if lake_mask.at(x, y):
        return Z - 1.6, 1
    return Z, (0 if -150 < x < 160 and -150 < y < 150 else 2)


def zground(x, y):
    return ground(x, y)[0]


def collection(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


def build_gate(coll, overhead):
    """门楼: 30 x 8 m, 12.4 m; three round arches, eight columns in pairs, cornice, stepped attic.
    The centre arch is a real passage: two solid piers, and everything above the opening goes in the
    Overhead collection, which the walk-grid ray cast ignores (so the ground under it is walkable)."""
    bm = bmesh.new()
    y = -152.0
    for sx in (-1, 1):
        kit.add_box(bm, (AX + sx * 8.6, y, 4.6), (12.8, 8.0, 9.2), mi=0)       # piers either side of the passage
    ob = bmesh.new()
    kit.add_box(ob, (AX, y, 8.1), (4.4, 8.0, 2.2), mi=0)                      # over the passage
    kit.add_box(ob, (AX, y, 9.6), (31.0, 8.8, 0.8), mi=0)                     # cornice
    kit.add_box(ob, (AX, y, 10.6), (22.0, 7.0, 1.4), mi=0)                    # attic
    kit.add_box(ob, (AX, y, 12.0), (11.0, 6.0, 1.4), mi=0)                    # stepped centre
    kit.add_box(ob, (AX, y - 3.52, 10.6), (7.0, 0.1, 0.9), mi=1)              # 總統府 in gold on the stone
    kit.mesh_object('Gate overhead', ob, overhead, ['palace_stone', 'gold'])
    for dx, w, h in ((-8.4, 3.6, 6.2), (8.4, 3.6, 6.2)):
        for s in (-1, 1):
            kit.arch_panel(bm, (AX + dx, y + s * 4.02, 0.0), w, h, depth=0.4, mi=1, facing='+Y' if s > 0 else '-Y')
    for dx in (-13.6, -11.6, -5.0, -3.0, 3.0, 5.0, 11.6, 13.6):
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.42, radius2=0.38, depth=8.2)
        bmesh.ops.translate(bm, vec=(AX + dx, y - 4.4, 4.6), verts=c['verts'])
        for f in {f for v in c['verts'] for f in v.link_faces}:
            f.material_index = 0
    c = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.12, radius2=0.06, depth=9.0)  # flagpole
    bmesh.ops.translate(bm, vec=(AX, y, 17.2), verts=c['verts'])
    for f in {f for v in c['verts'] for f in v.link_faces}:
        f.material_index = 3
    # The stone lions either side of the gate (photograph).
    for s in (-1, 1):
        kit.add_box(bm, (AX + s * 18.0, y - 6.0, 0.9), (1.4, 1.4, 1.8), mi=0)
        kit.add_box(bm, (AX + s * 18.0, y - 6.0, 2.4), (0.9, 1.1, 1.3), mi=0)
    kit.mesh_object('Presidential Palace gate', bm, coll, ['palace_stone', 'opening', 'gold', 'granite'])


def build_courts(coll):
    """The axis inside the gate: paved courts, side wings and the great hall 大堂; the second court
    and halls; then the Zichao Building at the north end."""
    bm = bmesh.new()
    kit.add_box(bm, (AX, -40.0, -0.15), (60.0, 220.0, 0.3), mi=0)            # axis paving
    # Grey courtyard walls separating the axis from the gardens.
    for s in (-1, 1):
        kit.add_box(bm, (AX + s * 32.0, -40.0, 2.0), (1.0, 220.0, 4.0), mi=1)
    kit.mesh_object('Palace courts', bm, coll, ['paving', 'courtyard_wall'])
    gh = building('大堂')['pts']
    c, w, d, a = ac.oriented_box(gh)
    oc.hall('Great Hall', coll, (AX, -62.0, Z), max(w, 32.0), max(d, 17.0), 6.5, walls='timber_dark', roof='tile_dark',
            gable=0.45, plinth=0.8)
    # Side wings along the first court: Qing-style, low, grey roofs.
    for s in (-1, 1):
        for k, y in enumerate((-125.0, -100.0)):
            oc.hall(f'East-west wing {s}{k}', coll, (AX + s * 24.0, y, Z), 18.0, 9.0, 4.6, walls='timber_dark',
                    yaw=s * math.pi / 2, columns=True)
    oc.hall('Second Hall', coll, (AX, -10.0, Z), 26.0, 14.0, 5.6, walls='timber_dark', roof='tile_dark', gable=0.45)
    # 子超楼: ochre brick, five storeys, a cream central bay of loggias over a wide stair, flat roof.
    zb = bmesh.new()
    zc = Vector((15.5, 68.5))
    kit.add_box(zb, (zc.x, zc.y, 9.5), (33.0, 22.0, 19.0), mi=0)
    kit.add_box(zb, (zc.x, zc.y - 0.4, 11.0), (11.0, 22.4, 22.0), mi=1)       # central bay, a storey higher
    for f in range(5):
        zf = 1.8 + f * 3.8
        for k in range(8):
            x = zc.x - 15.0 + k * 4.3
            if abs(x - zc.x) < 5.0:
                continue
            kit.add_box(zb, (x, zc.y - 11.05, zf), (1.5, 0.12, 2.0), mi=2)
        kit.add_box(zb, (zc.x, zc.y - 11.66, zf), (8.4, 0.12, 2.4), mi=2)     # loggia openings, on the bay's face
    kit.add_box(zb, (zc.x, zc.y, 19.2), (33.6, 22.6, 0.4), mi=1)              # parapet
    kit.stair_flight(zb, (zc.x, zc.y - 20.0, Z), 14.0, 9, 1.4 / 9, 0.9, mi=3)
    kit.mesh_object('Zichao Building', zb, coll, ['zichao_brick', 'zichao_cream', 'opening', 'granite'])
    # Executive Yuan blocks to the east: grey three-storey western buildings.
    for nm in ('行政院北楼', '行政院南楼'):
        b = building(nm)
        c, w, d, a = ac.oriented_box(b['pts'])
        bx = bmesh.new()
        M = Matrix.Translation((c[0], c[1], 0)) @ Matrix.Rotation(a, 4, 'Z')
        kit.add_box(bx, (0, 0, 6.0), (w, d, 12.0), mi=0, matrix=M)
        for f in range(3):
            for k in range(max(2, int(w / 4))):
                kit.add_box(bx, (-w / 2 + 2 + k * 4, -d / 2 - 0.06, 2 + f * 3.8), (1.4, 0.12, 2.0), mi=1, matrix=M)
        kit.mesh_object(nm, bx, coll, ['courtyard_wall', 'opening'])


def build_garden(coll, protos, trees):
    """煦园: Taiping Lake, the marble boat at its south end, the waterside pavilion at the north,
    Sun Yat-sen's office (a two-storey yellow western house), willows and rockery."""
    ac.polygon_mesh('Taiping Lake', coll, [lake], Z - 0.35, 'water')
    bm = bmesh.new()
    # Stone edging round the lake.
    for a, b in zip(lake, lake[1:]):
        a, b = Vector(a), Vector(b)
        L = (b - a).length
        if L < 0.2:
            continue
        mid = (a + b) / 2
        R = Matrix.Translation((mid.x, mid.y, Z - 0.4)) @ Matrix.Rotation(math.atan2(b.y - a.y, b.x - a.x), 4, 'Z')
        kit.add_box(bm, (0, 0, 0), (L + 0.1, 0.9, 1.0), mi=0, matrix=R)
    kit.mesh_object('Lake edging', bm, coll, ['canal_stone'])
    # The marble boat: a stone hull, a timber cabin with lattice, two stepped grey roofs.
    ys = [p[1] for p in lake]
    xs = [p[0] for p in lake]
    bx = (min(xs) + max(xs)) / 2
    by = min(ys) + 14.0
    hb = bmesh.new()
    kit.add_box(hb, (bx, by, Z + 0.2), (5.0, 14.0, 1.4), mi=0)
    kit.add_box(hb, (bx, by + 7.6, Z + 0.4), (3.0, 2.0, 1.0), mi=0)          # bow
    kit.add_box(hb, (bx, by - 2.0, Z + 2.2), (4.2, 7.0, 2.6), mi=1)
    kit.add_box(hb, (bx, by + 3.4, Z + 1.9), (4.2, 3.6, 2.0), mi=1)
    for k in range(5):
        kit.add_box(hb, (bx - 2.12, by - 5 + k * 1.6, Z + 2.3), (0.08, 1.1, 1.4), mi=2)
        kit.add_box(hb, (bx + 2.12, by - 5 + k * 1.6, Z + 2.3), (0.08, 1.1, 1.4), mi=2)
    kit.mesh_object('Marble boat', hb, coll, ['granite', 'timber_dark', 'opening'])
    kit.curved_roof('Marble boat roof', coll, (bx, by - 2.0, Z + 3.5), 2.8, 4.2, 1.2, lift=0.3, ridge_ratio=0.9,
                    material='tile_dark', ridge_material='tile_dark')
    kit.curved_roof('Marble boat front roof', coll, (bx, by + 3.4, Z + 2.9), 2.6, 2.2, 0.9, lift=0.25, ridge_ratio=0.9,
                    material='tile_dark', ridge_material='tile_dark')
    # Waterside pavilion at the north end of the lake.
    oc.pagoda('Waterside pavilion', coll, (bx, max(ys) + 4.0, Z), levels=1, r0=3.0, r_top=3.0, level_h=3.6, sides=4,
              walls='vermilion', trim='vermilion', roof='tile_dark', podium_r=4.0, spire=1.0)
    # Sun Yat-sen's office: a two-storey yellow western house with a veranda.
    b = building('孙中山临时大总统办公室')
    c, w, d, a = ac.oriented_box(b['pts'])
    so = bmesh.new()
    M = Matrix.Translation((c[0], c[1], 0)) @ Matrix.Rotation(a, 4, 'Z')
    kit.add_box(so, (0, 0, 4.0), (w, d, 8.0), mi=0, matrix=M)
    kit.add_box(so, (0, -d / 2 - 1.2, 3.8), (w, 2.4, 0.3), mi=1, matrix=M)   # veranda floor
    for k in range(7):
        kit.add_box(so, (-w / 2 + 1 + k * (w - 2) / 6, -d / 2 - 2.3, 1.9), (0.35, 0.35, 3.8), mi=1, matrix=M)
    kit.mesh_object('Sun Yat-sen office', so, coll, ['ochre', 'whitewash'])
    r = kit.curved_roof('Office roof', coll, (0, 0, 0), w / 2 + 1.2, d / 2 + 1.6, 3.0, lift=0.2, ridge_ratio=0.7,
                        material='roof_grey', ridge_material='roof_grey')
    r.matrix_world = M @ Matrix.Translation((0, 0, 8.0)) @ r.matrix_world
    # Willows and garden trees round the lake.
    n = 0
    for a2, b2 in zip(lake, lake[1:]):
        a2, b2 = Vector(a2), Vector(b2)
        L = (b2 - a2).length
        k = 0.0
        while k < L:
            p = a2.lerp(b2, k / max(L, 1e-6))
            q = p + Vector((-(b2 - a2).y, (b2 - a2).x)).normalized() * 3.0
            if lake_mask.at(q.x, q.y):
                q = p - Vector((-(b2 - a2).y, (b2 - a2).x)).normalized() * 3.0
            # Keep the boat, its viewing spot and the benches open (willows once hid the boat).
            if not lake_mask.at(q.x, q.y) and (q - Vector((bx, by))).length > 9 and                     all((q - Vector((bx + dx, by + dy))).length > 11 for dx, dy in ((8, -12), (9, 4), (9, 22), (12, -16))):
                kit.place(protos['willow' if rnd.random() < 0.6 else 'broadleaf'], trees, (q.x, q.y, Z), rnd.uniform(0, 6.28),
                          rnd.uniform(0.85, 1.15))
                n += 1
            k += 8.0
    return n, (bx, by)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    root = bpy.data.collections.new('Palace')
    scene.collection.children.link(root)
    c = {n: collection(n, root) for n in ('Ground', 'Water', 'Buildings', 'Overhead', 'Garden', 'City', 'Gates', 'Trees', 'Prototypes', 'Markers')}
    protos = oc.extra_prototypes(c['Prototypes'], kit.tree_prototypes(c['Prototypes']))
    ac.terrain_patch('Terrain palace', c['Ground'], PATCH[0], PATCH[1], ground, ['lawn', 'canal_stone', 'paving'])
    kit.PALETTE.setdefault('city_ground', '#A8A68C')
    ac.outer_apron('Terrain outer', c['Ground'], A, (PATCH,), lambda x, y: Z, material='city_ground')
    build_gate(c['Buildings'], c['Overhead'])
    build_courts(c['Buildings'])
    trees, boat = build_garden(c['Garden'], protos, c['Trees'])
    skip = {'大堂', '总统府门楼', '总统府文书局办公楼子超楼', '孙中山临时大总统办公室', '行政院北楼', '行政院南楼'}
    sky = ac.Mask(ac.skyline_polys(A.meta['origin_wgs84']), A.extent, 6.0)

    def keep(x, y):
        inside = PATCH[0][0] + 10 < x < PATCH[0][1] - 10 and PATCH[1][0] + 10 < y < PATCH[1][1] - 10
        return not (-150 < x < 160 and -170 < y < 150) and not sky.at(x, y) and (not inside or abs(x) > 140 or abs(y) > 160)
    _, blocks = ac.city_blocks('City blocks', c['City'], [b for b in F['buildings'] if b['name'] not in skip],
                               lambda x, y: Z, keep)
    kinds = ['broadleaf', 'broadleaf_sun', 'broadleaf_shade', 'cedar']
    trees += ac.scatter(protos, c['Trees'], rnd, kinds, 260, (-140.0, 150.0), (-150.0, 140.0),
                        lambda x, y: (x < -26 or x > 45) and not lake_mask.distance_ok(x, y, 0) is False and
                        not any(abs(x - bx) < 20 and abs(y - by_) < 20 for bx, by_ in ((15.5, 68.5), (-112, 2), (103, 36), (95, -5))),
                        zground)
    # Markers: before the gate on Changjiang Road; the boat; the Zichao Building; a bench by the lake.
    ac.add_point(c['Markers'], 'Spawn palace', (AX, -200.0, Z), (AX, -100.0, Z + 8))
    ac.add_point(c['Markers'], 'Spawn garden', (boat[0] + 8, boat[1] - 12, Z), (boat[0], boat[1], Z + 2))
    ac.add_point(c['Markers'], 'Spawn zichao', (15.5, 20.0, Z), (15.5, 68.5, Z + 12))
    ac.add_point(c['Markers'], 'Seat garden-0', (boat[0] + 9, boat[1] + 4, Z), (boat[0], boat[1], Z + 1))
    ac.add_point(c['Markers'], 'Seat garden-1', (boat[0] + 9, boat[1] + 22, Z), (boat[0] - 4, boat[1] + 30, Z + 1))
    scene['origin_wgs84'] = list(A.meta['origin_wgs84'])
    scene['base_z'] = A.base
    ac.lookdev(scene)
    cams = {
        'gate': ac.camera(scene, 'Cam gate', (AX + 12, -205.0, 1.7), (AX, -152.0, 7.0), 32),
        'zichao': ac.camera(scene, 'Cam zichao', (15.5, 18.0, 1.7), (15.5, 68.5, 10.0), 34),
        'boat': ac.camera(scene, 'Cam boat', (boat[0] + 12, boat[1] - 16, 1.7), (boat[0], boat[1], 1.5), 34),
        'aerial': ac.camera(scene, 'Cam aerial', (180, -360, 160), (0, -20, 0), 30),
    }
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print('BUILD', {'trees': trees, 'blocks': blocks, 'boat': [round(v, 1) for v in boat], 'objects': len(bpy.data.objects)}, flush=True)
    if RENDER:
        ac.render_views(scene, cams, RENDERS, 'lookdev')


main()
