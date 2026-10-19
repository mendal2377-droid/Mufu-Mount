"""Old South world: Fuzimiao on the Qinhuai, Laomendong, Zhonghua Gate and the Bao'en pagoda.

    D:/soft/blender/blender.exe -b --factory-startup --python blender/build_oldsouth.py [-- --no-render]

Evidence: research/oldsouth/FACTS.md. Origin: the Qinhuai/Fuzimiao atlas anchor. The river,
banks, bridges, lanes, the fortress walls and every house footprint come from OSM; the
architecture follows published descriptions (照壁 110 x 10 m; Zhonghua Gate 118.5 x 128 m,
21.45 m high, three courts, 27 vaults; Bao'en tower 78.2 m in OSM) and the owner's photographs
(white walls, dark red timber, grey tiles, horse-head gables, gold-roofed boats, lanterns).
Best light: sunset into dusk, when the lanterns and windows glow.
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
OUT_BLEND = ROOT / 'art-src' / 'oldsouth.blend'
RENDERS = ROOT / 'design' / 'oldsouth'
RENDER = '--no-render' not in sys.argv
rnd = random.Random(1384)

A = ac.Area('oldsouth')
F = A.feats
P_F = ((-320.0, 360.0), (-380.0, 140.0))         # Fuzimiao and the Panchi stretch of the Qinhuai
P_S = ((-820.0, 220.0), (-1360.0, -740.0))       # Laomendong, Zhonghua Gate, Bao'en
PATCHES = (P_F, P_S)

AXIS_X = 40.0                                     # Fuzimiao's axis (Dacheng Hall, Juxing Pavilion)
GATE_C = Vector((-666.0, -893.0))                 # Zhonghua Gate fortress centre (OSM park polygon)
GATE_W, GATE_D, GATE_H = 118.5, 128.0, 21.45
BAOEN = Vector((-471.0, -1300.0))                 # OSM way 859565691, height 78.2

water_polys = [w['pts'] for w in F['water'] if len(w['pts']) > 5]
water_mask = ac.Mask(water_polys, A.extent, 3.0)
_ws = [A.bare_at(x, y) for x, y in ((rnd.uniform(-900, 400), rnd.uniform(-1450, 300)) for _ in range(6000)) if water_mask.at(x, y)]
WATER = statistics.median(_ws)
STREET = WATER + 2.6                               # embankments: streets sit 2.6 m above the river


def in_patch(x, y, m=0.0):
    return any(a - m < x < b + m and c - m < y < d + m for (a, b), (c, d) in PATCHES)


def ground(x, y):
    if water_mask.at(x, y):
        return WATER - 2.2, 1
    z = max(A.bare_at(x, y), STREET)
    # The fortress's three courts are paved and level with the street.
    if abs(x - GATE_C.x) < GATE_W / 2 + 4 and abs(y - GATE_C.y) < GATE_D / 2 + 4:
        return STREET, 2
    return z, 0


def zground(x, y):
    return ground(x, y)[0]


def collection(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


HOUSE_MATS = ['whitewash', 'timber_dark', 'tile_dark', 'lantern', 'lantern_glow']
MI = {'wall': 0, 'timber': 1, 'tile': 2, 'lantern': 3, 'glow': 4}


# --- River banks, bridges, lanterns ------------------------------------------------------------------

def build_river(coll):
    near = [p for p in water_polys if any(in_patch(x, y, 300) for x, y in p)]
    ac.polygon_mesh('Qinhuai water', coll, near, WATER, 'water')
    bm = bmesh.new()
    for poly in near:
        for a, b in zip(poly, poly[1:]):
            a, b = Vector(a), Vector(b)
            L = (b - a).length
            if L < 0.5:
                continue
            mid = (a + b) / 2
            if not in_patch(mid.x, mid.y, 40):
                continue
            t = (b - a) / L
            n = Vector((-t.y, t.x))
            # An edge with water on both sides is where OSM cut the river into pieces: no wall.
            if water_mask.at(*(mid + n * 4)) and water_mask.at(*(mid - n * 4)):
                continue
            R = Matrix.Translation((mid.x, mid.y, 0)) @ Matrix.Rotation(math.atan2(t.y, t.x), 4, 'Z')
            kit.add_box(bm, (0, 0, (WATER - 2.5 + STREET) / 2), (L + 0.1, 1.4, STREET - WATER + 2.5), mi=0, matrix=R)
            # White stone balustrade on the bank top, posts every 2 m (photographs: lit at dusk).
            kit.add_box(bm, (0, 0, STREET + 0.95), (L + 0.1, 0.22, 0.16), mi=1, matrix=R)
            kit.add_box(bm, (0, 0, STREET + 0.45), (L + 0.1, 0.14, 0.12), mi=1, matrix=R)
            for k in range(max(1, int(L / 2.0))):
                kit.add_box(bm, (-L / 2 + (k + 0.5) * L / max(1, int(L / 2.0)), 0, STREET + 0.5), (0.24, 0.24, 1.0), mi=1, matrix=R)
            # Warm light strip under the balustrade, the gold line in the dusk photograph.
            kit.add_box(bm, (0, 0, STREET - 0.25), (L + 0.1, 1.5, 0.12), mi=2, matrix=R)
    kit.mesh_object('Qinhuai embankments', bm, coll, ['canal_stone', 'granite', 'lantern_glow'])
    br = bmesh.new()
    for w in F['bridges']:
        if w['name'] in ('文德桥', '文源桥', '平江桥', '来燕桥', '武定桥', '镇淮桥', '镇淮东桥', '朱雀桥', '东园桥') and len(w['pts']) >= 2:
            a, b = Vector(w['pts'][0]), Vector(w['pts'][-1])
            ext = (b - a).normalized() * 4
            oc.arch_bridge(br, a - ext, b + ext, STREET, width=6.0, rise=1.6 if w['name'] != '文德桥' else 2.2)
    kit.mesh_object('Qinhuai bridges', br, coll, ['granite_shade'])
    # Lantern strings across the river in front of Fuzimiao.
    ls = bmesh.new()
    for x in range(-120, 330, 24):
        ys = [y for y in range(-300, 60, 2) if water_mask.at(x, y)]
        if len(ys) > 4:
            oc.lantern_string(ls, (x, ys[0] - 3, STREET + 7.5), (x + 4, ys[-1] + 3, STREET + 7.5), 9, mi=0)
    kit.mesh_object('Lantern strings', ls, coll, ['lantern'])


# --- Houses from OSM footprints -----------------------------------------------------------------------

def build_houses(coll, keep):
    bm = bmesh.new()
    n = 0
    for b in F['buildings']:
        pts = b['pts']
        if len(pts) < 4:
            continue
        c, w, d, a = ac.oriented_box(pts)
        if not keep(c[0], c[1]) or w < 4 or d < 3 or w * d > 2500:
            continue
        # Long footprints become terraces of houses, 7-11 m each, so the roofline steps.
        units = max(1, int(w / rnd.uniform(7, 11)))
        uw = w / units
        floors = 2 if rnd.random() < 0.7 else 3
        try:
            floors = min(3, max(1, int(float(b['tags'].get('building:levels', floors)))))
        except ValueError:
            pass
        # Face the nearer of water or the street side: test both normals.
        n0 = Vector((-math.sin(a), math.cos(a)))
        face = 1
        if water_mask.at(c[0] - n0.x * (d / 2 + 8), c[1] - n0.y * (d / 2 + 8)):
            face = 1
        elif water_mask.at(c[0] + n0.x * (d / 2 + 8), c[1] + n0.y * (d / 2 + 8)):
            face = -1
        for k in range(units):
            off = -w / 2 + uw * (k + 0.5)
            px, py = c[0] + math.cos(a) * off, c[1] + math.sin(a) * off
            M = Matrix.Translation((px, py, zground(px, py))) @ Matrix.Rotation(a + (math.pi if face < 0 else 0), 4, 'Z')
            oc.hui_house(bm, M, uw - 0.3, min(d, 14) - 0.4, floors, steps=2 if uw > 6 else 1, balcony=rnd.random() < 0.6,
                         lanterns=2 if rnd.random() < 0.5 else 0, mats=MI)
            n += 1
    kit.mesh_object('Old town houses', bm, coll, HOUSE_MATS)
    return n


# --- Fuzimiao ---------------------------------------------------------------------------------------

def build_fuzimiao(coll):
    z = STREET
    bm = bmesh.new()
    # 照壁: 110 m long, 10 m high, on the south bank facing the temple across the river.
    zb_y = -196.0
    kit.add_box(bm, (AXIS_X, zb_y, z + 5.0), (110.0, 2.2, 10.0), mi=0)
    kit.add_box(bm, (AXIS_X, zb_y, z + 0.6), (111.0, 2.8, 1.2), mi=3)
    kit.mesh_object('Zhaobi', bm, coll, ['vermilion', 'tile_dark', 'gold', 'granite_shade'])
    r = kit.curved_roof('Zhaobi coping', coll, (AXIS_X, zb_y, z + 10.0), 56.0, 1.8, 1.0, lift=0.4, thickness=0.2,
                        material='tile_dark', ridge_material='tile_dark', res=(60, 6))
    # 天下文枢 paifang on the north bank, then 棂星门, 聚星亭, 大成门, 大成殿 up the axis.
    pf = bmesh.new()
    for x in (-6.0, -2.2, 2.2, 6.0):
        kit.add_box(pf, (AXIS_X + x, -116.0, z + 3.6), (0.7, 0.7, 7.2), mi=0)
    kit.add_box(pf, (AXIS_X, -116.0, z + 6.6), (13.4, 0.9, 1.0), mi=0)
    kit.add_box(pf, (AXIS_X, -116.0, z + 5.6), (3.8, 0.4, 1.1), mi=1)
    kit.mesh_object('Tianxia Wenshu gate', pf, coll, ['timber_dark', 'gold'])
    for x, w in ((0, 3.0), (-4.1, 2.4), (4.1, 2.4)):
        rr = kit.curved_roof('Wenshu roof', coll, (AXIS_X + x, -116.0, z + 7.3), w, 1.4, 1.1, lift=0.4, thickness=0.2,
                             material='gold_roof', ridge_material='gold_roof')
    oc.hall('Lingxing Gate', coll, (AXIS_X, -96.0, z), 18, 6, 4.5, walls='vermilion', columns=True)
    _, _ = oc.pagoda('Juxing Pavilion', coll, (44.5, -82.5, z), levels=1, r0=3.2, r_top=3.2, level_h=4.0, sides=6,
                     walls='vermilion', trim='gold', roof='gold_roof', podium_r=4.4, spire=1.5)
    oc.hall('Dacheng Gate', coll, (AXIS_X - 2, -64.0, z), 22, 9, 5.0, walls='vermilion', columns=True)
    oc.hall('Dacheng Hall', coll, (35.0, -38.0, z + 1.2), 30, 18, 8.0, walls='vermilion', double=True, roof='tile_dark')
    # 魁星阁: three-tier golden-roofed pavilion at the river's edge west of the axis (photographs).
    oc.pagoda('Kuixing Pavilion', coll, (-6.0, -128.0, z), levels=3, r0=4.2, r_top=3.0, level_h=3.4, sides=8,
              walls='lantern_glow', trim='vermilion', roof='gold_roof', podium_r=5.6, spire=2.2)
    # 江南贡院: a hall on the examination-hall site.
    oc.hall('Jiangnan Examination Hall', coll, (176.0, 68.0, z), 24, 14, 7.0, walls='whitewash', double=True)
    # Forecourt paving and the dock for the pleasure boats.
    pv = bmesh.new()
    kit.add_box(pv, (AXIS_X, -102.0, z - 0.2), (70, 34, 0.4), mi=0)
    kit.add_box(pv, (78.0, -96.0, WATER + 0.4), (40, 6, 0.6), mi=1)
    kit.mesh_object('Fuzimiao paving', pv, coll, ['paving', 'timber_dark'])


# --- Zhonghua Gate ---------------------------------------------------------------------------------

def build_zhonghua(coll):
    """Four pierced walls with three courts between, a ramp up the inner side, 27 vaults (藏兵洞)
    in the south wall's face. The 1937-destroyed timber tower is not rebuilt (archive photos)."""
    bm = bmesh.new()
    cx, cy = GATE_C
    z = STREET
    y0 = cy - GATE_D / 2
    walls = [(0.0, 22.0), (44.0, 10.0), (78.0, 10.0), (110.0, 18.0)]   # (south offset, thickness)
    for off, th in walls:
        y = y0 + off + th / 2
        kit.add_box(bm, (cx, y, z + GATE_H / 2), (GATE_W, th, GATE_H), mi=0)
        kit.add_box(bm, (cx, y, z + GATE_H + 0.05), (GATE_W - 2, th - 1.2, 0.1), mi=1)
        for side in (-1, 1):
            kit.arch_panel(bm, (cx, y + side * (th / 2 + 0.02), z), 7.0, 10.5, depth=0.4, mi=2,
                           facing='+Y' if side > 0 else '-Y')
        # Merlons on the outer (south) wall.
        if off == 0.0:
            for k in range(int(GATE_W / 2.6)):
                kit.add_box(bm, (cx - GATE_W / 2 + 1.3 + k * 2.6, y0 + 0.4, z + GATE_H + 1.4), (1.3, 0.8, 0.9), mi=0)
    # East and west side walls closing the courts, carrying the ramps.
    for sx in (-1, 1):
        kit.add_box(bm, (cx + sx * (GATE_W / 2 - 6), cy, z + GATE_H / 2), (12.0, GATE_D, GATE_H), mi=0)
        kit.add_box(bm, (cx + sx * (GATE_W / 2 - 6), cy, z + GATE_H + 0.05), (10.8, GATE_D - 1, 0.1), mi=1)
    # 27 vaults in three rows across the south face.
    for row in range(3):
        for k in range(9):
            kit.arch_panel(bm, (cx - 40 + k * 10.0, y0 - 0.03, z + 1.2 + row * 6.4), 3.4, 4.4, depth=0.3, mi=2)
    # Horse ramp (马道) outside the east wall, climbing south from the city side to the wall top.
    steps = 100
    kit.stair_flight(bm, (0, 0, 0), 5.0, steps, GATE_H / steps, 1.0, mi=1,
                     matrix=Matrix.Translation((cx + GATE_W / 2 + 2.6, y0 + GATE_D + steps * 1.0, z)) @ Matrix.Rotation(math.pi, 4, 'Z'))
    kit.mesh_object('Zhonghua Gate', bm, coll, ['ming_brick', 'paving', 'opening'])
    # The city wall running east from the gate past Laomendong (OSM way 91997603).
    wb = bmesh.new()
    for w in F['wall']:
        if w['id'] == 91997603:
            oc.city_wall(wb, w['pts'], zground, height=14.0, width=10.0, outer_side=-1)
    kit.mesh_object('City wall', wb, coll, ['ming_brick', 'paving'])


def build_baoen(coll):
    """The Bao'en protective tower: a nine-storey lantern of a pagoda that glows white-gold at dusk."""
    oc.pagoda("Bao'en Pagoda", coll, (BAOEN.x, BAOEN.y, zground(*BAOEN)), levels=9, r0=8.0, r_top=5.0, level_h=7.0, sides=8,
              walls='lantern_glow', trim='whitewash', roof='whitewash', podium_r=12.0, spire=6.0)


def build_laomendong_gate(coll):
    """老门东 paifang at the lane's head (OSM node), stone with a grey-tile roof."""
    p = Vector((-76.3, -871.55))
    bm = bmesh.new()
    z = zground(*p)
    for x in (-5.5, -2.0, 2.0, 5.5):
        kit.add_box(bm, (p.x + x, p.y, z + 3.5), (0.8, 0.8, 7.0), mi=0)
    kit.add_box(bm, (p.x, p.y, z + 6.4), (12.0, 1.0, 1.0), mi=0)
    kit.add_box(bm, (p.x, p.y - 0.55, z + 5.3), (3.6, 0.2, 1.0), mi=1)
    kit.mesh_object('Laomendong gateway', bm, coll, ['granite_shade', 'gold'])
    for x, w in ((0, 2.8), (-3.75, 2.2), (3.75, 2.2)):
        kit.curved_roof('Laomendong roof', coll, (p.x + x, p.y, z + 7.0), w, 1.3, 1.0, lift=0.35, thickness=0.2,
                        material='tile_dark', ridge_material='tile_dark')


# --- Planting and markers -------------------------------------------------------------------------

def plant(protos, trees):
    n = 0
    # Willows and plane trees along both banks, like the photographs' dark green masses.
    for poly in water_polys:
        for a, b in zip(poly, poly[1:]):
            a, b = Vector(a), Vector(b)
            L = (b - a).length
            t = (b - a) / max(L, 1e-6)
            nrm = Vector((-t.y, t.x))
            k = 0.0
            while k < L:
                p = a + t * k
                for side in (-1, 1):
                    q = p + nrm * side * 5.0
                    if in_patch(q.x, q.y) and not water_mask.at(q.x, q.y) and rnd.random() < 0.35:
                        kit.place(protos['willow' if rnd.random() < 0.6 else 'broadleaf_shade'], trees,
                                  (q.x, q.y, zground(q.x, q.y)), rnd.uniform(0, 6.28), rnd.uniform(0.9, 1.25))
                        n += 1
                k += 14.0
    return n


def markers(coll, gates_coll, ride_line):
    z = STREET
    ac.add_point(coll, 'Spawn qinhuai', (AXIS_X + 18, -132.0, z), (AXIS_X - 30, -200.0, z + 4))
    ac.add_point(coll, 'Spawn fuzimiao', (AXIS_X, -104.0, z), (35.0, -38.0, z + 8))
    ac.add_point(coll, 'Spawn zhonghua', (GATE_C.x, GATE_C.y - GATE_D / 2 - 30, z), (GATE_C.x, GATE_C.y, z + 12))
    ac.add_point(coll, 'Spawn mendong', (-60.0, -860.0, zground(-60, -860)), (-30.0, -760.0, zground(-30, -760) + 4))
    ac.add_point(coll, 'Spawn baoen', (BAOEN.x + 40, BAOEN.y - 60, zground(BAOEN.x + 40, BAOEN.y - 60)), (BAOEN.x, BAOEN.y, 40))
    ac.add_point(coll, 'Spawn wall', (GATE_C.x, GATE_C.y - GATE_D / 2 + 11, z + GATE_H + 0.1), (GATE_C.x, GATE_C.y - 600, z))
    # Benches on the north bank facing the river and the screen wall.
    for k, x in enumerate((AXIS_X - 30, AXIS_X - 12, AXIS_X + 24)):
        ac.add_point(coll, f'Seat qinhuai-{k}', (x, -136.0, z), (x, -200.0, z + 3))
    ac.add_point(coll, 'Dock fuzimiao', (78.0, -99.5, WATER + 0.7), (78.0, -110, WATER))
    # Boat path: the river centreline through the Fuzimiao stretch, as a marker chain.
    for k, p in enumerate(ride_line):
        e = bpy.data.objects.new(f'Ride qinhuai {k:03d}', None)
        e.location = (p.x, p.y, WATER + 0.15)
        coll.objects.link(e)
    gates = [('zhonghua', Vector((AXIS_X + 60, -132.0, z)), Vector((AXIS_X + 80, -132.0, z))),
             ('qinhuai', Vector((GATE_C.x + 40, GATE_C.y - GATE_D / 2 - 30, z)), Vector((GATE_C.x + 60, GATE_C.y - GATE_D / 2 - 30, z))),
             ('mendong', Vector((AXIS_X - 60, -132.0, z)), Vector((AXIS_X - 80, -132.0, z)))]
    for n, (target, loc, toward) in enumerate(gates):
        d = (toward - loc).normalized()
        g = kit.moon_gate(f'Moon gate {n}', gates_coll)
        g.matrix_world = Matrix.Translation(loc) @ Matrix.Rotation(math.atan2(-d.x, d.y), 4, 'Z')
        ac.add_point(coll, f'Gate {target}@{n}', loc, loc + d * 10)


def river_line():
    """Centreline of the inner Qinhuai through the Fuzimiao patch, sampled from the water mask."""
    pts = []
    for x in range(-300, 350, 6):
        ys = [y for y in range(-320, 120, 2) if water_mask.at(x, y)]
        if ys:
            pts.append(Vector((x, (ys[0] + ys[-1]) / 2)))
    # Keep the longest run of consecutive samples (the river, not the side canals).
    runs, cur = [], [pts[0]] if pts else []
    for p in pts[1:]:
        if (p - cur[-1]).length < 20:
            cur.append(p)
        else:
            runs.append(cur)
            cur = [p]
    runs.append(cur)
    best = max(runs, key=len)
    # Smooth.
    return [sum(best[max(0, i - 2):i + 3], Vector((0, 0))) / len(best[max(0, i - 2):i + 3]) for i in range(len(best))]


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    root = bpy.data.collections.new('OldSouth')
    scene.collection.children.link(root)
    c = {n: collection(n, root) for n in ('Ground', 'Water', 'Temple', 'Town', 'Walls', 'City', 'Gates', 'Trees', 'Prototypes', 'Markers')}
    protos = oc.extra_prototypes(c['Prototypes'], kit.tree_prototypes(c['Prototypes']))
    (fx, fy), (sx, sy) = P_F, P_S
    ac.terrain_patch('Terrain Fuzimiao', c['Ground'], fx, fy, ground, ['paving', 'canal_stone', 'paving'])
    ac.terrain_patch('Terrain south', c['Ground'], sx, sy, ground, ['paving', 'canal_stone', 'paving'])
    ac.outer_apron('Terrain outer', c['Ground'], A, PATCHES, zground, material='paving')
    build_river(c['Water'])
    build_fuzimiao(c['Temple'])
    build_zhonghua(c['Walls'])
    build_baoen(c['Temple'])
    build_laomendong_gate(c['Town'])

    def keep_house(x, y):
        if not in_patch(x, y, -4):
            return False
        if -40 < x < 120 and -125 < y < 0:            # Fuzimiao compound
            return False
        if abs(x - GATE_C.x) < GATE_W / 2 + 25 and abs(y - GATE_C.y) < GATE_D / 2 + 25:
            return False
        if (Vector((x, y)) - BAOEN).length < 70:
            return False
        return not water_mask.at(x, y)
    houses = build_houses(c['Town'], keep_house)
    _, blocks = ac.city_blocks('City blocks', c['City'], F['buildings'], lambda x, y: max(A.bare_at(x, y), STREET),
                               lambda x, y: not in_patch(x, y, 10) and not water_mask.at(x, y))
    trees = plant(protos, c['Trees'])
    line = river_line()
    markers(c['Markers'], c['Gates'], line)
    ac.lookdev(scene, sky='#E9A27A', sun_az=250, sun_el=9, energy=3.2)
    cams = {
        'qinhuai-dusk': ac.camera(scene, 'Cam qinhuai', (AXIS_X + 70, -140.0, STREET + 3), (AXIS_X - 60, -150.0, STREET + 2), 30),
        'fuzimiao': ac.camera(scene, 'Cam fuzimiao', (AXIS_X, -190.0, STREET + 12), (35.0, -40.0, STREET + 6), 32),
        'zhonghua': ac.camera(scene, 'Cam zhonghua', (GATE_C.x + 60, GATE_C.y - 160, STREET + 30), (GATE_C.x, GATE_C.y, STREET + 8), 30),
        'mendong': ac.camera(scene, 'Cam mendong', (-40.0, -820.0, STREET + 1.7), (-25.0, -700.0, STREET + 3), 32),
        'aerial': ac.camera(scene, 'Cam aerial', (300, -1500, 420), (-200, -500, 0), 28),
    }
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print('BUILD', {'water': round(WATER, 2), 'street': round(STREET, 2), 'houses': houses, 'blocks': blocks, 'trees': trees,
                    'ride_pts': len(line), 'objects': len(bpy.data.objects)}, flush=True)
    if RENDER:
        ac.render_views(scene, cams, RENDERS, 'lookdev')


main()
