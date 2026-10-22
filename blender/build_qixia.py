"""Qixia Mountain 栖霞山 in autumn: the temple, the relic pagoda, the Thousand Buddha Cliff, the maples.

    D:/soft/blender/blender.exe -b --factory-startup --python blender/build_qixia.py [-- --no-render]

Evidence (research/qixia/FACTS.md; the owner's five autumn photographs, inspection only): OSM
gives Qixia Temple 栖霞寺 (way 1243073749) with its halls on one east-west axis facing west
(毘卢宝殿 Pilu Hall, way 1059591708, and two more), the pond in front, the Thousand Buddha Cliff
千佛岩 and the Rulai Hall to the south-east, and the paths and pavilions up Tiger Hill 虎山 to the
Reading-the-Maples viewpoint 读枫. Published: the relic pagoda 舍利塔 is stone, octagonal, five
storeys, about 18 m, on a carved base; the cliff has hundreds of niches and a Great Buddha about
12 m tall. Photographs: red-railed timber boardwalks and stairs climbing through deep-red maples,
orange and gold hillsides, a road winding through them.
Assumptions: terraces and hall heights, the compound walls, the pagoda's proportions, the cliff's
plan and niche layout, the boardwalk's line between OSM paths, and the mix of trees.
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
OUT_BLEND = ROOT / 'art-src' / 'qixia.blend'
RENDERS = ROOT / 'design' / 'qixia'
RENDER = '--no-render' not in sys.argv
rnd = random.Random(1146)

A = ac.Area('qixia')
F = A.feats
kit.PALETTE.update({
    'maple_red': '#C8321E', 'boardwalk': '#8A6448', 'rail_red': '#B8301E', 'pagoda_stone': '#C9C2B2',
    'cliff_rock': '#9A8F7E', 'statue_stone': '#B8AE98', 'city_ground': '#A8A68C',
})

AXIS_Y = 42.0                                  # the halls' line (OSM)
HALLS = ((-40.0, 16.0, 8.0, False), (59.0, 22.0, 16.0, False), (116.0, 34.0, 23.0, True), (175.0, 23.0, 19.0, False))
COMPOUND = ((-52.0, 205.0), (10.0, 74.0))
PAGODA = Vector((150.0, -30.0))
TZ = round(A.bare_at(59.0, AXIS_Y), 1)        # the temple's ground
pond = next(w['pts'] for w in F['water'] if w['id'] == 968838967)
pond_mask = ac.Mask([pond], A.extent, 2.0)


def way(wid):
    return next(w['pts'] for w in F['ways'] if w['id'] == wid)


# The red boardwalk: from the temple's north side up Tiger Hill past the Deyun pavilion to the
# Reading-the-Maples viewpoint (OSM path 586367837, then on to the OSM viewpoint nodes).
BOARD = [Vector(p) for p in [(60.0, 90.0)] + way(586367837) + [(181.0, 353.0), (175.0, 450.0), (167.0, 530.0)]]


def _seg_dist(p, a, b):
    ab = b - a
    k = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * k)).length


def board_distance(x, y):
    p = Vector((x, y))
    return min(_seg_dist(p, a, b) for a, b in zip(BOARD, BOARD[1:]))


def in_temple(x, y):
    return COMPOUND[0][0] - 25 < x < COMPOUND[0][1] + 20 and COMPOUND[1][0] - 40 < y < COMPOUND[1][1] + 20


def ground(x, y):
    hill = A.bare_at(x, y) - 7.0               # canopy off the DSM
    if pond_mask.at(x, y):
        return TZ - 2.0, 3
    # The temple climbs gently east over three terraces, smoothed into a walkable slope.
    t = min(1.0, max(0.0, (x - 20.0) / 120.0))
    tz = TZ + 3.0 * t * t * (3 - 2 * t)
    dx = max(COMPOUND[0][0] - 60 - x, x - COMPOUND[0][1] - 90, 0.0)
    dy = max(COMPOUND[1][0] - 80 - y, y - COMPOUND[1][1] - 30, 0.0)
    d = math.hypot(dx, dy)
    k = min(1.0, d / 50.0)
    k = k * k * (3 - 2 * k)
    z = tz + (hill - tz) * k
    inside = COMPOUND[0][0] < x < COMPOUND[0][1] and COMPOUND[1][0] < y < COMPOUND[1][1]
    return z, (1 if inside or (Vector((x, y)) - PAGODA).length < 22 else (2 if d < 30 else 0))


def zground(x, y):
    return ground(x, y)[0]


def collection(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


def build_temple(coll):
    """The halls on the axis, facing west, with ochre compound walls and grey tile caps."""
    for k, (x, w, d, double) in enumerate(HALLS):
        oc.hall(f'Qixia hall {k}', coll, (x, AXIS_Y, zground(x, AXIS_Y)), w, d, 6.5 if double else 5.0,
                walls='temple_ochre', roof='tile_dark', yaw=-math.pi / 2, double=double)
    bm = bmesh.new()
    (x0, x1), (y0, y1) = COMPOUND
    for a, b in (((x0, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, AXIS_Y + 6)), ((x0, AXIS_Y - 6), (x0, y0))):
        a, b = Vector(a), Vector(b)
        L = (b - a).length
        for k in range(int(L / 6) + 1):
            p = a.lerp(b, min(1.0, (k + 0.5) * 6 / L))
            g = zground(p.x, p.y)
            M = Matrix.Translation((p.x, p.y, g)) @ Matrix.Rotation(math.atan2(b.y - a.y, b.x - a.x), 4, 'Z')
            kit.add_box(bm, (0, 0, 2.0), (6.2, 0.8, 4.0), mi=0, matrix=M)
            kit.add_box(bm, (0, 0, 4.2), (6.4, 1.4, 0.4), mi=1, matrix=M)
    kit.mesh_object('Temple walls', bm, coll, ['temple_ochre', 'tile_dark'])
    ac.polygon_mesh('Mingjing pond', coll, [pond], TZ - 0.6, 'water')


def build_relic_pagoda(coll):
    """舍利塔: a stone octagon of five storeys, about 18 m, on a carved sumeru base: a tall first
    storey with door and window reliefs, then four close-set eaves and a spire."""
    bm = bmesh.new()
    x, y, z = PAGODA.x, PAGODA.y, zground(PAGODA.x, PAGODA.y)
    oc.prism(bm, (x, y, z), 5.6, 0.9, 8, mi=0, rot=math.pi / 8)            # platform
    oc.prism(bm, (x, y, z + 0.9), 4.2, 0.7, 8, mi=0, rot=math.pi / 8)      # sumeru base: plinth
    oc.prism(bm, (x, y, z + 1.6), 3.6, 1.6, 8, mi=1, rot=math.pi / 8)      # carved band (the eight scenes)
    oc.prism(bm, (x, y, z + 3.2), 4.0, 0.5, 8, mi=0, rot=math.pi / 8)      # lotus ledge
    zc = z + 3.7
    oc.prism(bm, (x, y, zc), 2.9, 3.6, 8, mi=0, rot=math.pi / 8)           # first storey
    for k in range(8):
        a = math.pi / 8 + k * math.pi / 4 + math.pi / 8
        M = Matrix.Translation((x + math.cos(a) * 2.75, y + math.sin(a) * 2.75, zc)) @ Matrix.Rotation(a - math.pi / 2, 4, 'Z')
        kit.arch_panel(bm, (0, 0, 0.3), 1.2, 2.2, depth=0.12, mi=2, matrix=M, facing='+Y')
    zc += 3.6
    for k in range(5):
        r = 3.6 - k * 0.32
        oc.prism(bm, (x, y, zc), r, 0.45, 8, mi=0, rot=math.pi / 8)        # eave
        oc.prism(bm, (x, y, zc + 0.45), r - 1.0, 1.1, 8, mi=0, rot=math.pi / 8)
        zc += 1.55
    s = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.9, radius2=0.15, depth=3.6)
    bmesh.ops.translate(bm, vec=(x, y, zc + 1.8), verts=s['verts'])
    kit.mesh_object('Relic pagoda', bm, coll, ['pagoda_stone', 'statue_stone', 'opening'])
    return zc + 3.6 - z


def build_cliff(coll):
    """千佛岩: a rock face along the hillside south-east of the temple, facing west, with rows of
    small niches and the Great Buddha in a tall niche at its centre."""
    bm = bmesh.new()
    line = [Vector((175.0, -60.0)), Vector((195.0, -20.0)), Vector((205.0, 20.0)), Vector((215.0, 60.0))]
    for a, b in zip(line, line[1:]):
        L = (b - a).length
        ang = math.atan2(b.y - a.y, b.x - a.x)
        for k in range(int(L / 4)):
            p = a.lerp(b, (k + 0.5) * 4 / L)
            g = zground(p.x, p.y)
            h = 16.0 + 3.0 * math.sin(p.y * 0.13)
            M = Matrix.Translation((p.x, p.y, g)) @ Matrix.Rotation(ang, 4, 'Z')
            kit.add_box(bm, (0, 3.0, h / 2), (4.3, 6.0, h), mi=0, matrix=M)
            kit.add_box(bm, (0, 4.5, h + 1.5), (4.5, 5.0, 3.0), mi=0, matrix=M)   # rough brow
            for row in range(3):
                for col in (-1, 1):
                    kit.arch_panel(bm, (col * 1.0, -0.02, 2.0 + row * 4.2), 0.9, 1.6, depth=0.15, mi=1, matrix=M, facing='-Y')
    # The Great Buddha: seated, in a tall niche at the cliff's middle.
    c = line[1].lerp(line[2], 0.5)
    g = zground(c.x, c.y)
    ang = math.atan2(line[2].y - line[1].y, line[2].x - line[1].x)
    M = Matrix.Translation((c.x, c.y, g)) @ Matrix.Rotation(ang, 4, 'Z')
    kit.arch_panel(bm, (0, -0.06, 0.0), 9.0, 15.0, depth=0.2, mi=1, matrix=M, facing='-Y')
    kit.add_box(bm, (0, -1.5, 1.2), (7.0, 3.0, 2.4), mi=2, matrix=M)                # lotus seat
    kit.add_box(bm, (0, -1.6, 5.4), (5.2, 2.6, 6.0), mi=2, matrix=M)                # body
    kit.add_box(bm, (0, -1.8, 9.6), (2.4, 2.2, 2.6), mi=2, matrix=M)                # head
    kit.add_box(bm, (0, -1.0, 9.6), (5.6, 0.3, 5.6), mi=3, matrix=M)                # halo
    kit.mesh_object('Thousand Buddha Cliff', bm, coll, ['cliff_rock', 'opening', 'statue_stone', 'gold'])


def build_boardwalk(coll):
    """The red boardwalk: a 2.4 m timber deck a little above the hillside, red rails both sides."""
    bm = bmesh.new()
    pts = []
    for a, b in zip(BOARD, BOARD[1:]):
        L = (b - a).length
        n = max(1, int(L / 2.0))
        pts += [a.lerp(b, k / n) for k in range(n)]
    pts.append(BOARD[-1])
    p3 = [Vector((p.x, p.y, zground(p.x, p.y) + 0.45)) for p in pts]
    for a, b in zip(p3, p3[1:]):
        d = b - a
        if d.xy.length < 1e-3:
            continue
        ang = math.atan2(d.y, d.x)
        M = Matrix.Translation((a + b) / 2) @ Matrix.Rotation(ang, 4, 'Z') @ Matrix.Rotation(-math.atan2(d.z, d.xy.length), 4, 'Y')
        kit.add_box(bm, (0, 0, -0.15), (d.length + 0.15, 2.4, 0.3), mi=0, matrix=M)
        for side in (-1, 1):
            kit.add_box(bm, (0, side * 1.3, 0.95), (d.length + 0.1, 0.12, 0.12), mi=1, matrix=M)   # handrail
            kit.add_box(bm, (0, side * 1.3, 0.45), (d.length + 0.1, 0.08, 0.08), mi=1, matrix=M)   # mid rail
            kit.add_box(bm, (-d.length / 2, side * 1.3, 0.45), (0.14, 0.14, 1.0), mi=1, matrix=M)  # post
    kit.mesh_object('Red boardwalk', bm, coll, ['boardwalk', 'rail_red'])
    return p3


def maple_prototypes(protos, coll):
    """maple_red: the maple prototype's shape with a deep-red crown (the web draws it by name)."""
    me = protos['maple_autumn'].data.copy()
    me.name = 'proto maple red'
    me.materials[0] = kit.mat('maple_red')
    o = bpy.data.objects.new('proto maple red', me)
    o.hide_render = o.hide_viewport = True
    coll.objects.link(o)
    protos['maple_red'] = o
    return protos


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    root = bpy.data.collections.new('Qixia')
    scene.collection.children.link(root)
    c = {n: collection(n, root) for n in ('Ground', 'Water', 'Temple', 'Hill', 'City', 'Gates', 'Trees', 'Prototypes', 'Markers')}
    protos = maple_prototypes(oc.extra_prototypes(c['Prototypes'], kit.tree_prototypes(c['Prototypes'])), c['Prototypes'])
    patch = ((-420.0, 520.0), (-320.0, 660.0))
    ac.terrain_patch('Terrain qixia', c['Ground'], patch[0], patch[1], ground, ['forest_floor', 'paving', 'lawn', 'canal_stone'], step=4.0)
    ac.outer_apron('Terrain outer', c['Ground'], A, (patch,), lambda x, y: A.bare_at(x, y) - 7.0)
    build_temple(c['Temple'])
    h = build_relic_pagoda(c['Temple'])
    build_cliff(c['Hill'])
    walk = build_boardwalk(c['Hill'])
    skip = {1059591708, 1059591709, 1059591711}
    _, blocks = ac.city_blocks('City blocks', c['City'], [b for b in F['buildings'] if b['id'] not in skip], zground,
                               lambda x, y: not in_temple(x, y) and (x < -300 or y < -250 or x > 450 or y > 600))
    # Maples arch over the boardwalk; the hills are red, orange and gold, with a few evergreens.
    trees = 0
    for k, p in enumerate(walk[::3]):
        for side in (-1, 1):
            i = min(len(walk) - 1, k * 3 + 1)
            d = (walk[i] - walk[max(0, i - 2)]).xy
            if d.length < 1e-3:
                continue
            n = Vector((-d.y, d.x)).normalized()
            q = p.xy + n * side * rnd.uniform(3.4, 5.5)
            kit.place(protos['maple_red' if rnd.random() < 0.7 else 'maple_autumn'], c['Trees'], (q.x, q.y, zground(q.x, q.y) - 0.2),
                      rnd.uniform(0, 6.28), rnd.uniform(0.85, 1.2))
            trees += 1
    kinds = ['maple_red', 'maple_red', 'maple_autumn', 'maple_autumn', 'plane_autumn', 'broadleaf', 'cedar']
    trees += ac.scatter(protos, c['Trees'], rnd, kinds, 6500, patch[0], patch[1],
                        lambda x, y: not in_temple(x, y) and board_distance(x, y) > 3.2 and (Vector((x, y)) - PAGODA).length > 24
                        and not pond_mask.distance_ok(x, y, 3) is False and not (165 < x < 230 and -70 < y < 70), zground, groves=260)
    # The rest of the hills (Fengxiang Peak behind) in the same autumn mix; the town on the low
    # ground to the west stays open.
    x0, x1, y0, y1 = A.extent
    trees += ac.scatter(protos, c['Trees'], rnd, kinds, 9000, (x0 + 40, x1 - 40), (y0 + 40, y1 - 40),
                        lambda x, y: not (patch[0][0] < x < patch[0][1] and patch[1][0] < y < patch[1][1]) and A.bare_at(x, y) > 40,
                        lambda x, y: A.bare_at(x, y) - 7.0, groves=400)
    # Ginkgo-gold and maple-red round the temple courtyards.
    for x in range(-30, 200, 22):
        for y in (AXIS_Y - 24, AXIS_Y + 24):
            if all(abs(x - hx) > hd / 2 + 5 for hx, _, hd, _ in HALLS):
                kit.place(protos['plane_autumn' if (x // 22) % 2 else 'maple_red'], c['Trees'], (x, y, zground(x, y)), rnd.uniform(0, 6.28), 0.7)
                trees += 1

    pk = c['Markers']
    ac.add_point(pk, 'Spawn qixia', (-95.0, AXIS_Y - 2, zground(-95.0, AXIS_Y)), (60.0, AXIS_Y, TZ + 8))
    sp = PAGODA + Vector((-26.0, 4.0))
    ac.add_point(pk, 'Spawn pagoda', (sp.x, sp.y, zground(sp.x, sp.y)), (PAGODA.x + 40, PAGODA.y + 10, zground(*PAGODA) + 9))
    m = walk[len(walk) // 3]
    m2 = walk[len(walk) // 3 + 12]
    ac.add_point(pk, 'Spawn maples', tuple(m), (m2.x, m2.y, m2.z + 2))
    top, before = walk[-1], walk[-8]
    ac.add_point(pk, 'Spawn peak', tuple(before), (before.x - 300, before.y - 500, before.z - 40))
    ac.add_point(pk, 'Seat peak-0', tuple(walk[-4]), (walk[-4].x - 300, walk[-4].y - 500, walk[-4].z - 40))
    ac.add_point(pk, 'Seat pond-0', (-92.0, AXIS_Y - 14, zground(-92.0, AXIS_Y - 14)), (-150.0, AXIS_Y + 10, TZ))
    gates = (('maples', Vector((-80.0, AXIS_Y - 14)), Vector((-80.0, AXIS_Y - 30))),
             ('qixia', walk[len(walk) // 3 + 4].xy + Vector((0.0, 0.0)), walk[len(walk) // 3 + 8].xy))
    for n, (target, at, toward) in enumerate(gates):
        d = (toward - at).normalized()
        z = zground(at.x, at.y) + (0.45 if target == 'qixia' else 0.0)
        g = kit.moon_gate(f'Moon gate {n}', c['Gates'], **({'width': 2.4, 'height': 3.2, 'radius': 1.0} if target == 'qixia' else {}))
        g.matrix_world = Matrix.Translation((at.x, at.y, z)) @ Matrix.Rotation(math.atan2(-d.x, d.y), 4, 'Z')
        ac.add_point(pk, f'Gate {target}@{n}', (at.x, at.y, z), (at.x + d.x * 10, at.y + d.y * 10, z))

    scene['origin_wgs84'] = list(A.meta['origin_wgs84'])
    scene['base_z'] = A.base
    ac.lookdev(scene, sun_az=230, sun_el=22)
    cams = {
        'temple': ac.camera(scene, 'Cam temple', (-95.0, AXIS_Y - 6, TZ + 1.7), (80.0, AXIS_Y, TZ + 8), 30),
        'pagoda': ac.camera(scene, 'Cam pagoda', (sp.x - 4, sp.y - 6, zground(sp.x, sp.y) + 1.7), (PAGODA.x, PAGODA.y, zground(*PAGODA) + 9), 30),
        'maples': ac.camera(scene, 'Cam maples', (m.x, m.y, m.z + 1.7), (m2.x, m2.y, m2.z + 2.5), 30),
        'aerial': ac.camera(scene, 'Cam aerial', (-380.0, -360.0, TZ + 260), (80.0, 120.0, TZ + 30), 30),
    }
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print('BUILD', {'temple_z': TZ, 'pagoda_h': round(h, 1), 'trees': trees, 'blocks': blocks, 'boardwalk': len(walk),
                    'objects': len(bpy.data.objects)}, flush=True)
    if RENDER:
        ac.render_views(scene, cams, RENDERS, 'lookdev')


main()
