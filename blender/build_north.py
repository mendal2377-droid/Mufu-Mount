"""North world: Jiming Temple, the Taicheng wall and Xuanwu Lake.

    D:/soft/blender/blender.exe -b --factory-startup --python blender/build_north.py [-- --no-render]

Evidence: research/north/FACTS.md. Origin: the Yaoshi Pagoda (OSM way 319055520 area; the
pagoda's own footprint is way 957807762, tagged 44.8 m). Local metres, x east, y north, z up,
z = 0 at the area's low ground (about the lake surface).

Scenes (spawns): the temple gate and its stair axis up to the seven-storey pagoda; Jiming Road
under cherry blossom; the Taicheng wall top by Jiefang Gate; Huanzhou island's shore, looking
south across lotus to the wall, the pagoda and Zifeng Tower (the classic photograph).
"""
import math
import random
import statistics
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
OUT_BLEND = ROOT / 'art-src' / 'north.blend'
RENDERS = ROOT / 'design' / 'north'
RENDER = '--no-render' not in sys.argv
rnd = random.Random(1368)

A = ac.Area('north')
F = A.feats
PATCH_J = ((-260.0, 320.0), (-320.0, 320.0))      # Jiming hill, Taicheng, Jiefang Gate
PATCH_I = ((-820.0, 140.0), (820.0, 1500.0))      # Huanzhou and Yingzhou, Xuanwu Gate
PATCHES = (PATCH_J, PATCH_I)

PAGODA = Vector((-11.5, 19.5))                    # OSM way 957807762 centre
GATE = Vector((36.0, -96.0))                      # foot of the temple stairs (OSM steps way)
AX = (PAGODA - GATE).normalized()
AX_ACROSS = Vector((AX.y, -AX.x))
AX_LEN = (PAGODA - GATE).length
ZIFENG = Vector((-1137.0, -40.0))                 # atlas anchor, OSM way 140809508

lake = max((w for w in F['water'] if w['name'] == '玄武湖'), key=lambda w: len(w['pts']))['pts']
islands = [w['pts'] for w in F['islands'] if w['name'] != '玄武湖']
water_mask = ac.Mask([lake], A.extent, 4.0)
island_mask = ac.Mask(islands, A.extent, 4.0)
building_mask = ac.Mask([b['pts'] for b in F['buildings']], A.extent, 6.0)


def is_water(x, y):
    return water_mask.at(x, y) and not island_mask.at(x, y)


# Lake surface: the median bare-ground estimate over open water.
_samples = [A.bare_at(x, y) for x, y in ((rnd.uniform(-700, 1700), rnd.uniform(0, 2700)) for _ in range(4000)) if is_water(x, y)]
WATER = statistics.median(_samples)
Z0 = A.bare_at(*GATE)                             # street level at the temple gate
TEMPLE_COURT = Z0 + 6.0                           # first terrace (photo: one long central stair)
TEMPLE_TOP = Z0 + 11.0                            # pagoda court on the hilltop


def to_axis(x, y):
    d = Vector((x, y)) - GATE
    return d.dot(AX_ACROSS), d.dot(AX)


def from_axis(u, s, z=0.0):
    p = GATE + AX * s + AX_ACROSS * u
    return Vector((p.x, p.y, z))


def temple_profile(s):
    if s < 10:
        return Z0
    if s < 34:
        return Z0 + (TEMPLE_COURT - Z0) * (s - 10) / 24
    if s < 80:
        return TEMPLE_COURT
    if s < 96:
        return TEMPLE_COURT + (TEMPLE_TOP - TEMPLE_COURT) * (s - 80) / 16
    return TEMPLE_TOP


def ground(x, y):
    """(z, material): lake bed under water, terraced temple, bare ground elsewhere."""
    if is_water(x, y):
        return WATER - 3.0, 1
    z = A.bare_at(x, y)
    u, s = to_axis(x, y)
    # The temple compound: terraces graded across a 70 m wide footprint along the axis.
    if -6 < s < AX_LEN + 22 and abs(u) < 48:
        w = 1 - ac_smooth(36, 48, abs(u))
        zt = temple_profile(max(0.0, min(s, AX_LEN + 22)))
        z = z * (1 - w) + (zt - 0.4) * w
        return z, 2 if abs(u) < 34 else 0
    # Island and shore lawns are a touch above the water so the edge reads.
    if island_mask.at(x, y):
        z = max(z, WATER + 0.9)
    return z, 0


def ac_smooth(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def zground(x, y):
    return ground(x, y)[0]


def collection(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


MATS_HOUSE = {'wall': 0, 'timber': 1, 'tile': 2, 'lantern': 3, 'glow': 4}


# --- Jiming Temple --------------------------------------------------------------------------------

def build_temple(coll):
    bm = bmesh.new()
    mats = ['granite_shade', 'paving', 'temple_ochre', 'vermilion', 'bronze', 'paving_joint']
    R = Matrix.Rotation(math.atan2(AX.y, AX.x) - math.pi / 2, 4, 'Z')   # axis frame: +Y along the axis

    def M(u, s, z):
        return Matrix.Translation(from_axis(u, s, z)) @ R
    # Gate plaza, the long central stair with balustrades, the terraces' retaining walls.
    kit.add_box(bm, (0, 0, -0.5), (44, 46, 1.0), mi=1, matrix=M(0, -12, Z0))   # forecourt out to the street
    kit.stair_flight(bm, (0, 0, 0), 9.0, 30, (TEMPLE_COURT - Z0) / 30, 24 / 30, mi=0, matrix=M(0, 10, Z0), riser_mi=5)
    # Balustrades in axis coordinates (kit.balustrade takes world XY), sloping with the stair.
    for sx in (-1, 1):
        a, b = from_axis(sx * 4.8, 10), from_axis(sx * 4.8, 34)
        kit.balustrade(bm, (a.x, a.y), (b.x, b.y), Z0, TEMPLE_COURT, mi=0, post_every=2.4)
    kit.add_box(bm, (0, 0, -0.6), (64, 46, 1.2), mi=1, matrix=M(0, 57, TEMPLE_COURT))
    kit.stair_flight(bm, (0, 0, 0), 8.0, 24, (TEMPLE_TOP - TEMPLE_COURT) / 24, 16 / 24, mi=0, matrix=M(0, 80, TEMPLE_COURT), riser_mi=5)
    kit.add_box(bm, (0, 0, -0.6), (56, 48, 1.2), mi=1, matrix=M(0, 120, TEMPLE_TOP))
    # Yellow outer wall round the compound (photo: warm yellow walls).
    for sx in (-1, 1):
        kit.add_box(bm, (sx * 35, 0, 1.6), (1.0, 140, 3.2), mi=2, matrix=M(0, 70, TEMPLE_COURT - 2))
    # Incense burner on the first terrace.
    kit.add_box(bm, (0, 0, 1.2), (1.6, 1.6, 2.4), mi=4, matrix=M(0, 46, TEMPLE_COURT))
    kit.add_box(bm, (0, 0, 2.6), (2.4, 2.4, 0.4), mi=4, matrix=M(0, 46, TEMPLE_COURT))
    kit.mesh_object('Jiming terraces', bm, coll, mats)

    # Halls: the gate hall, a pair of peach halls each side of the first terrace, the main hall,
    # and halls round the pagoda court. Yellow and peach walls, grey tile roofs (photographs).
    yaw = math.atan2(AX.y, AX.x) - math.pi / 2
    # The gate is walked through: a three-bay timber gateway (red posts, grey tile roofs), not a hall.
    gb = bmesh.new()
    for x in (-6.5, -2.4, 2.4, 6.5):
        kit.add_box(gb, (x, 0, 3.2), (0.6, 0.6, 6.4), mi=0, matrix=M(0, 4, Z0))
        kit.add_box(gb, (x, 0, 0.3), (1.0, 1.0, 0.6), mi=1, matrix=M(0, 4, Z0))
    kit.add_box(gb, (0, 0, 6.2), (14.5, 0.8, 0.8), mi=0, matrix=M(0, 4, Z0))
    kit.add_box(gb, (0, 0, 5.3), (4.4, 0.4, 1.0), mi=2, matrix=M(0, 4, Z0))
    kit.mesh_object('Jiming gateway', gb, coll, ['vermilion', 'granite_shade', 'gold'])
    for x, w, z in ((0, 3.2, 7.4), (-4.45, 2.6, 6.9), (4.45, 2.6, 6.9)):
        r = kit.curved_roof('Jiming gateway roof', coll, (0, 0, 0), w, 1.5, 1.2, lift=0.4, thickness=0.2,
                            material='tile_dark', ridge_material='tile_dark')
        r.matrix_world = M(x, 4, Z0 + z) @ r.matrix_world
    for sx in (-1, 1):
        for k, s in enumerate((44, 64)):
            oc.hall(f'Jiming side hall {sx}{k}', coll, from_axis(sx * 24, s, TEMPLE_COURT), 10, 14, 5.5,
                    walls='temple_peach', yaw=yaw + sx * math.pi / 2, columns=False)
    oc.hall('Jiming main hall', coll, from_axis(0, 72, TEMPLE_COURT), 22, 13, 7.0, walls='vermilion', yaw=yaw, double=True)
    for sx in (-1, 1):
        oc.hall(f'Jiming court hall {sx}', coll, from_axis(sx * 20, 112, TEMPLE_TOP), 14, 9, 5.0,
                walls='temple_ochre', yaw=yaw + sx * math.pi / 2)
    # 药师佛塔: seven storeys, eight faces, 44.8 m.
    _, h = oc.pagoda('Yaoshi Pagoda', coll, (PAGODA.x, PAGODA.y, TEMPLE_TOP), levels=7, r0=5.0, r_top=3.2,
                     level_h=5.0, spire=5.5)
    return h


# --- Walls and gates ------------------------------------------------------------------------------

def wall_line(way_id):
    for w in F['wall']:
        if w['id'] == way_id:
            return w['pts']
    raise KeyError(way_id)


def build_streets(coll):
    """Jiming Road and Taicheng Road as paved ribbons on the ground (the cherry road)."""
    bm = bmesh.new()
    for w in F['ways']:
        if w['name'] not in ('鸡鸣寺路', '台城路'):
            continue
        pts = [Vector(p) for p in w['pts']]
        left, right = [], []
        for i, p in enumerate(pts):
            a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
            t = (b - a).normalized()
            n = Vector((-t.y, t.x))
            for side, lst in ((1, left), (-1, right)):
                q = p + n * 4.5 * side
                lst.append(bm.verts.new((q.x, q.y, zground(q.x, q.y) + 0.1)))
        for i in range(len(pts) - 1):
            bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    kit.mesh_object('Streets', bm, coll, ['paving'])


def build_walls(coll):
    bm = bmesh.new()
    # Taicheng (the hill section behind the temple), and the long lakeside run from Jiefang Gate
    # to Xuanwu Gate and beyond (OSM ways 89637327, 95918075), plus the run east to Taiping Gate.
    oc.city_wall(bm, wall_line(89637327), zground, height=15.0, width=11.0, outer_side=1)
    oc.city_wall(bm, wall_line(95918075), zground, height=14.0, width=10.0, outer_side=-1)
    oc.city_wall(bm, wall_line(237044575), zground, height=14.0, width=10.0, outer_side=1)
    # Xuanwu Gate (玄武门): three arches through the wall, two small pavilions on top.
    xg = Vector((-721.0, 1058.0))
    zb = zground(xg.x, xg.y)
    for k, (u, w) in enumerate(((-7.5, 4.0), (0, 5.5), (7.5, 4.0))):
        kit.arch_panel(bm, (xg.x + u, xg.y - 5.6, zb), w, 6.5 if k == 1 else 5.2, depth=0.6, mi=2)
        kit.arch_panel(bm, (xg.x + u, xg.y + 5.6, zb), w, 6.5 if k == 1 else 5.2, depth=0.6, mi=2, facing='+Y')
    kit.mesh_object('City walls', bm, coll, ['ming_brick', 'paving', 'opening'])
    for sx in (-1, 1):
        oc.hall(f'Xuanwu Gate pavilion {sx}', coll, (xg.x + sx * 9, xg.y, zb + 14.4), 7, 6, 3.6,
                walls='vermilion', columns=True)
    # Wall stairs at Jiefang Gate (OSM 解放门登城口), so the wall top is walkable from the street.
    st = bmesh.new()
    top = zground(103, 196) + 15.0
    kit.stair_flight(st, (0, 0, 0), 3.0, 64, (top - zground(103, 175)) / 64, 0.32, mi=0,
                     matrix=Matrix.Translation((103, 175, zground(103, 175))) @ Matrix.Rotation(0, 4, 'Z'), riser_mi=1)
    kit.mesh_object('Jiefang Gate stair', st, coll, ['granite_shade', 'paving_joint'])


# --- Lake, islands, lotus, bridges ------------------------------------------------------------------

def build_lake(coll, protos, trees):
    ac.polygon_mesh('Xuanwu Lake', coll, [lake], WATER, 'water')
    bm = bmesh.new()
    for w in F['bridges']:
        if w['name'] in ('樱桥', '莲桥', '白桥', '芳桥', '月影桥') and len(w['pts']) >= 2:
            oc.arch_bridge(bm, w['pts'][0], w['pts'][-1], WATER + 1.0, width=5.0, rise=1.8)
    kit.mesh_object('Lake bridges', bm, coll, ['granite_shade'])
    # Lotus: dense pads on the shallows south of Huanzhou and along the wall shore, a few blooms.
    n = 0
    sp = huanzhou_view_point()
    for _ in range(9000):
        x, y = sp.x + rnd.uniform(-260, 220), sp.y - rnd.uniform(4, 70)
        if is_water(x, y):
            kind = 'lotus_flower' if rnd.random() < 0.08 else 'lotus'
            kit.place(protos[kind], trees, (x, y, WATER + (0.35 if kind == 'lotus_flower' else 0.05)), rnd.uniform(0, 6.28),
                      rnd.uniform(0.9, 1.6))
            n += 1
    for _ in range(16000):
        x, y = rnd.uniform(-760, 160), rnd.uniform(160, 980)
        if not is_water(x, y):
            continue
        near_shore = not water_mask.distance_ok(x, y, 70) or island_mask.at(x, y + 60) or island_mask.at(x, y + 30)
        if not near_shore:
            continue
        kind = 'lotus_flower' if rnd.random() < 0.06 else 'lotus'
        kit.place(protos[kind], trees, (x, y, WATER + (0.35 if kind == 'lotus_flower' else 0.05)), rnd.uniform(0, 6.28),
                  rnd.uniform(0.8, 1.5))
        n += 1
    return n


# --- Planting -------------------------------------------------------------------------------------

def huanzhou_view_point():
    hz = next(w for w in F['islands'] if w['name'] == '环洲')['pts']
    return Vector(min(hz, key=lambda p: p[1] - 0.3 * p[0])) + Vector((10, 14))


def clear_of_spawns(x, y):
    """Nothing planted within 9 m of a spawn or seat (a tree once grew on the lotus view)."""
    sp = huanzhou_view_point()
    road = next(w for w in F['ways'] if w['name'] == '鸡鸣寺路')['pts']
    spots = [sp, sp + Vector((-12, 6)), sp + Vector((12, 6)), sp + Vector((22, 4)), Vector(road[len(road) // 2]),
             from_axis(0, -14).to_2d(), from_axis(16, -6).to_2d()]
    return all((Vector((x, y)) - q).length > 9 for q in spots)


def plant(protos, trees):
    n = 0
    # Jiming Road under cherry blossom: both sides, 6 m apart.
    for w in F['ways']:
        if w['name'] == '鸡鸣寺路':
            pts = [Vector(p) for p in w['pts']]
            for a, b in zip(pts, pts[1:]):
                L = (b - a).length
                t = (b - a) / max(L, 1e-6)
                nrm = Vector((-t.y, t.x))
                k = 0.0
                while k < L:
                    for side in (-1, 1):
                        p = a + t * k + nrm * side * 6.5
                        if not is_water(p.x, p.y):
                            kit.place(protos['cherry'], trees, (p.x, p.y, zground(p.x, p.y)), rnd.uniform(0, 6.28), rnd.uniform(0.95, 1.25))
                            n += 1
                    k += 6.0
    # Cherries along the inside foot of the Taicheng and lakeside walls near Jiefang Gate.
    for wid, off in ((89637327, -9.0), (95918075, 9.0)):
        pts = [Vector(p) for p in wall_line(wid)]
        for a, b in zip(pts, pts[1:]):
            L = (b - a).length
            t = (b - a) / max(L, 1e-6)
            nrm = Vector((-t.y, t.x))
            k = 0.0
            while k < L:
                p = a + t * k + nrm * off
                if -260 < p.x < 320 and -320 < p.y < 320 and not is_water(p.x, p.y):
                    kit.place(protos['cherry'], trees, (p.x, p.y, zground(p.x, p.y)), rnd.uniform(0, 6.28), rnd.uniform(0.9, 1.2))
                    n += 1
                k += 7.0
    # Willow-fringed island shores (环洲烟柳): every ~9 m inside each island outline.
    for poly in islands:
        pts = [Vector(p) for p in poly]
        for a, b in zip(pts, pts[1:]):
            L = (b - a).length
            k = 0.0
            while k < L:
                p = a.lerp(b, k / max(L, 1e-6))
                c = sum(pts, Vector((0, 0))) / len(pts)
                q = p + (c - p).normalized() * 3.5
                if not is_water(q.x, q.y) and clear_of_spawns(q.x, q.y):
                    kit.place(protos['willow'], trees, (q.x, q.y, zground(q.x, q.y)), rnd.uniform(0, 6.28), rnd.uniform(0.9, 1.2))
                    n += 1
                k += 9.0
    # Groves on the islands and the temple hill; parkland trees round the lake.
    kinds = ['broadleaf', 'broadleaf_sun', 'broadleaf_shade', 'cedar']

    def ok(x, y):
        if is_water(x, y) or building_mask.at(x, y):
            return False
        u, s = to_axis(x, y)
        if -10 < s < AX_LEN + 24 and abs(u) < 40:
            return False
        return (water_mask.distance_ok(x, y, 6) or island_mask.at(x, y)) and clear_of_spawns(x, y)
    for (x0, x1), (y0, y1) in PATCHES:
        n += ac.scatter(protos, trees, rnd, kinds, 1300, (x0, x1), (y0, y1), ok, zground)
    return n


def far_canopy(protos, trees):
    x0, x1, y0, y1 = A.extent
    n = 0
    y = y0 + 20
    while y < y1 - 20:
        x = x0 + 20
        while x < x1 - 20:
            px, py = x + rnd.uniform(-8, 8), y + rnd.uniform(-8, 8)
            inside = any(a < px < b and c < py < d for (a, b), (c, d) in PATCHES)
            if not inside and not water_mask.at(px, py) and building_mask.distance_ok(px, py, 14):
                kit.place(protos['far'], trees, (px, py, A.bare_at(px, py) - 1.0), rnd.uniform(0, 6.28), rnd.uniform(1.4, 2.2))
                n += 1
            x += 30
        y += 30
    return n


def build_zifeng(coll):
    """紫峰大厦: a slim faceted glass blade, ~450 m with its spire, on the western skyline."""
    bm = bmesh.new()
    z = A.bare_at(*ZIFENG)
    levels = [(0, 34, 0.0), (180, 30, 0.12), (300, 24, 0.24), (380, 17, 0.36), (430, 9, 0.5)]
    for (z0, r0, a0), (z1, r1, a1) in zip(levels, levels[1:]):
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=3, radius1=r0, radius2=r1, depth=z1 - z0)
        bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(a0, 3, 'Z'), verts=c['verts'])
        bmesh.ops.translate(bm, vec=(ZIFENG.x, ZIFENG.y, z + (z0 + z1) / 2), verts=c['verts'])
    s = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=1.2, radius2=0.2, depth=22)
    bmesh.ops.translate(bm, vec=(ZIFENG.x, ZIFENG.y, z + 441), verts=s['verts'])
    kit.mesh_object('Zifeng Tower', bm, coll, ['city_glass'])


# --- Markers --------------------------------------------------------------------------------------

def markers(coll, gates_coll):
    pag = (PAGODA.x, PAGODA.y, TEMPLE_TOP + 20)
    ac.add_point(coll, 'Spawn jiming', from_axis(0, -14, Z0), from_axis(0, 60, TEMPLE_COURT + 6))
    ac.add_point(coll, 'Spawn pagoda', from_axis(6, 104, TEMPLE_TOP), pag)
    road = next(w for w in F['ways'] if w['name'] == '鸡鸣寺路')['pts']
    mid = Vector(road[len(road) // 2])
    ac.add_point(coll, 'Spawn cherry', (mid.x, mid.y, zground(mid.x, mid.y)), (mid.x + 5, mid.y + 120, zground(mid.x, mid.y) + 8))
    taicheng = Vector(wall_line(89637327)[-3])
    ac.add_point(coll, 'Spawn taicheng', (taicheng.x, taicheng.y, zground(taicheng.x, taicheng.y) + 15.1),
                 (taicheng.x - 300, taicheng.y + 700, WATER))
    # Huanzhou's south shore looking across the lotus to the wall, the pagoda and Zifeng.
    hz = next(w for w in F['islands'] if w['name'] == '环洲')['pts']
    south = min(hz, key=lambda p: p[1] - 0.3 * p[0])
    sp = Vector(south) + Vector((10, 14))
    ac.add_point(coll, 'Spawn xuanwu', (sp.x, sp.y, zground(sp.x, sp.y)), (PAGODA.x - 200, PAGODA.y, TEMPLE_TOP + 20))
    for k, d in enumerate((-12, 0, 12)):
        p = sp + Vector((d, 6))
        ac.add_point(coll, f'Seat xuanwu-{k}', (p.x, p.y, zground(p.x, p.y)), (PAGODA.x - 200, PAGODA.y, TEMPLE_TOP))
    tp = from_axis(-10, 128, TEMPLE_TOP)
    ac.add_point(coll, 'Seat pagoda-0', tp, (tp.x - 100, tp.y + 400, WATER))
    # Moon gates: temple gate plaza <-> Huanzhou shore; the bell for Jiming's bell pavilion.
    gates = [('xuanwu', from_axis(16, -6, Z0), from_axis(30, -6, Z0)),
             ('jiming', Vector((sp.x + 22, sp.y + 4, zground(sp.x + 22, sp.y + 4))), Vector((sp.x + 40, sp.y + 4, 0)))]
    for n, (target, loc, toward) in enumerate(gates):
        d = (Vector(toward) - Vector(loc)).normalized()
        d.z = 0
        d.normalize()
        g = kit.moon_gate(f'Moon gate {n}', gates_coll)
        g.matrix_world = Matrix.Translation(loc) @ Matrix.Rotation(math.atan2(-d.x, d.y), 4, 'Z')
        ac.add_point(coll, f'Gate {target}@{n}', loc, Vector(loc) + d * 10)
    bell = from_axis(14, 54, TEMPLE_COURT)
    ac.add_point(coll, 'Bell jiming', bell, from_axis(0, 72, TEMPLE_COURT))
    bm = bmesh.new()
    kit.add_box(bm, (bell.x, bell.y, bell.z + 2.0), (0.3, 0.3, 4.0), mi=0)
    kit.add_box(bm, (bell.x + 1.6, bell.y, bell.z + 2.0), (0.3, 0.3, 4.0), mi=0)
    kit.add_box(bm, (bell.x + 0.8, bell.y, bell.z + 4.0), (2.2, 0.4, 0.3), mi=0)
    c = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.7, radius2=0.45, depth=1.4)
    bmesh.ops.translate(bm, vec=(bell.x + 0.8, bell.y, bell.z + 3.0), verts=c['verts'])
    for f in {f for v in c['verts'] for f in v.link_faces}:
        f.material_index = 1
    kit.mesh_object('Bell frame', bm, gates_coll, ['vermilion', 'bronze'])


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    root = bpy.data.collections.new('North')
    scene.collection.children.link(root)
    c = {n: collection(n, root) for n in ('Ground', 'Water', 'Temple', 'Walls', 'City', 'Gates', 'Trees', 'Prototypes', 'Markers')}
    protos = oc.extra_prototypes(c['Prototypes'], kit.tree_prototypes(c['Prototypes']))
    (jx, jy), (ix, iy) = PATCH_J, PATCH_I
    ac.terrain_patch('Terrain Jiming', c['Ground'], jx, jy, ground, ['lawn', 'forest_floor', 'paving'])
    ac.terrain_patch('Terrain islands', c['Ground'], ix, iy, ground, ['lawn', 'forest_floor', 'paving'])
    ac.outer_apron('Terrain outer', c['Ground'], A, PATCHES, zground)
    pag_h = build_temple(c['Temple'])
    build_walls(c['Walls'])
    build_streets(c['City'])
    lotus = build_lake(c['Water'], protos, c['Trees'])
    trees = plant(protos, c['Trees'])
    far = far_canopy(protos, c['Trees'])

    def keep(cx, cy):
        if any(a - 10 < cx < b + 10 and cc - 10 < cy < d + 10 for (a, b), (cc, d) in PATCHES):
            u, s = to_axis(cx, cy)
            return not (-20 < s < AX_LEN + 40 and abs(u) < 60) and Vector((cx, cy)).length > 140 and not island_mask.at(cx, cy)
        return not water_mask.at(cx, cy)
    # Towers of 60 m and more come from the shared skyline (blender/build_skyline.py): skip them here.
    sky = ac.Mask(ac.skyline_polys(A.meta['origin_wgs84']), A.extent, 6.0)
    keep_low = lambda x, y: keep(x, y) and not sky.at(x, y)  # noqa: E731
    _, blocks = ac.city_blocks('City blocks', c['City'], F['buildings'], lambda x, y: A.bare_at(x, y), keep_low)
    scene['origin_wgs84'] = list(A.meta['origin_wgs84'])
    scene['base_z'] = A.base
    markers(c['Markers'], c['Gates'])
    ac.lookdev(scene)
    hz = next(w for w in F['islands'] if w['name'] == '环洲')['pts']
    south = Vector(min(hz, key=lambda p: p[1] - 0.3 * p[0])) + Vector((10, 14))
    cams = {
        'temple-axis': ac.camera(scene, 'Cam temple-axis', from_axis(0, -22, Z0 + 1.7), from_axis(0, 80, TEMPLE_COURT + 10), 32),
        'temple-aerial': ac.camera(scene, 'Cam temple-aerial', from_axis(0, -120, Z0 + 95), from_axis(0, 80, TEMPLE_COURT), 30),
        'lotus-view': ac.camera(scene, 'Cam lotus-view', (south.x, south.y, zground(south.x, south.y) + 1.7),
                                (PAGODA.x - 250, PAGODA.y, TEMPLE_TOP + 25), 30),
        'cherry-road': ac.camera(scene, 'Cam cherry-road', (60, -200, A.bare_at(60, -200) + 1.7), (40, 0, A.bare_at(40, 0) + 8), 34),
        'lake-aerial': ac.camera(scene, 'Cam lake-aerial', (400, -500, 260), (-200, 700, WATER), 28),
    }
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print('BUILD', {'water': round(WATER, 2), 'z0': round(Z0, 2), 'pagoda_h': round(pag_h, 1), 'lotus': lotus, 'trees': trees,
                    'far': far, 'blocks': blocks, 'objects': len(bpy.data.objects)}, flush=True)
    if RENDER:
        ac.render_views(scene, cams, RENDERS, 'lookdev')


main()
