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
            oc.lantern_string(ls, (x, ys[0] - 3, STREET + 5.2), (x + 4, ys[-1] + 3, STREET + 5.2), 12, mi=0, sag=0.9)
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
    # The two long gold dragons in relief on the face toward the river (Commons photograph).
    for sx in (-1, 1):
        kit.add_box(bm, (AXIS_X + sx * 26, zb_y + 1.2, z + 6.4), (40.0, 0.3, 2.2), mi=2)
        kit.add_box(bm, (AXIS_X + sx * 10, zb_y + 1.25, z + 7.6), (8.0, 0.3, 1.6), mi=2)
    kit.add_box(bm, (AXIS_X, zb_y + 1.25, z + 3.2), (100.0, 0.25, 0.8), mi=3)   # wave band below
    kit.mesh_object('Zhaobi', bm, coll, ['vermilion', 'tile_dark', 'gold', 'granite_shade'])
    r = kit.curved_roof('Zhaobi coping', coll, (AXIS_X, zb_y, z + 10.0), 56.0, 1.8, 1.0, lift=0.4, thickness=0.2,
                        material='tile_dark', ridge_material='tile_dark', res=(60, 6))
    # 天下文枢 paifang on the north bank (dark timber, grey tile roofs), then 棂星门, 聚星亭,
    # 大成门, 大成殿 up the axis.
    pf = bmesh.new()
    for x in (-6.0, -2.2, 2.2, 6.0):
        kit.add_box(pf, (AXIS_X + x, -116.0, z + 3.6), (0.7, 0.7, 7.2), mi=0)
    kit.add_box(pf, (AXIS_X, -116.0, z + 6.6), (13.4, 0.9, 1.0), mi=0)
    kit.add_box(pf, (AXIS_X, -116.0, z + 5.6), (3.8, 0.4, 1.1), mi=1)
    kit.mesh_object('Tianxia Wenshu gate', pf, coll, ['timber_dark', 'gold'])
    for x, w in ((0, 3.0), (-4.1, 2.4), (4.1, 2.4)):
        kit.curved_roof('Wenshu roof', coll, (AXIS_X + x, -116.0, z + 7.3), w, 1.4, 1.1, lift=0.4, thickness=0.2,
                        material='tile_dark', ridge_material='tile_dark')
    # 棂星门: a stone gateway, not a hall: four white posts with cloud caps rising above the
    # beams, carved panels in the side bays, the centre open (Commons photograph).
    lx = bmesh.new()
    for x in (-8.0, -3.2, 3.2, 8.0):
        kit.add_box(lx, (AXIS_X + x, -96.0, z + 3.4), (0.75, 0.75, 6.8), mi=0)
        kit.add_box(lx, (AXIS_X + x, -96.0, z + 7.1), (1.0, 1.0, 0.6), mi=0)          # cloud cap
        kit.add_box(lx, (AXIS_X + x, -96.0, z + 0.5), (1.3, 1.3, 1.0), mi=0)          # base
    for x0, x1 in ((-8.0, -3.2), (-3.2, 3.2), (3.2, 8.0)):
        kit.add_box(lx, (AXIS_X + (x0 + x1) / 2, -96.0, z + 5.6), (x1 - x0, 0.5, 0.6), mi=0)
    for sx in (-1, 1):
        kit.add_box(lx, (AXIS_X + sx * 5.6, -96.0, z + 1.6), (4.0, 0.35, 2.6), mi=0)   # carved panel
    kit.mesh_object('Lingxing Gate', lx, coll, ['granite'])
    # 聚星亭: hexagonal double-eave pavilion, red timber, grey tile, gold finial (Commons).
    oc.pagoda('Juxing Pavilion', coll, (44.5, -82.5, z), levels=1, r0=3.2, r_top=3.2, level_h=4.2, sides=6,
              walls='vermilion', trim='vermilion', roof='tile_dark', podium_r=4.4, spire=1.6)
    oc.hall('Dacheng Gate', coll, (AXIS_X - 2, -64.0, z), 22, 9, 5.0, walls='timber_dark', columns=True)
    # 大成殿: 45.7 x 24.9 m, 24.8 m to the ridge on a 2.1 m base; double-eave hip-and-gable in dark
    # grey tile, dark timber front, a white stone terrace with balustrade and stair, the bronze
    # Confucius in front (ctrip figures; Commons photograph).
    dz = z + 2.1
    tb = bmesh.new()
    kit.add_box(tb, (35.0, -38.0, z + 1.05), (49.0, 28.0, 2.1), mi=0)                   # base
    kit.add_box(tb, (35.0, -57.0, z + 0.8), (30.0, 10.0, 1.6), mi=0)                    # front terrace 月台
    for sx in (-1, 1):
        kit.balustrade(tb, (35.0 + sx * 15.0, -62.0), (35.0 + sx * 15.0, -52.0), z + 1.6, z + 1.6, mi=0)
    kit.balustrade(tb, (20.0, -62.0), (31.0, -62.0), z + 1.6, z + 1.6, mi=0)
    kit.balustrade(tb, (39.0, -62.0), (50.0, -62.0), z + 1.6, z + 1.6, mi=0)
    kit.stair_flight(tb, (35.0, -66.0, z), 8.0, 8, 1.6 / 8, 0.5, mi=0)
    kit.add_box(tb, (35.0, -70.0, z + 1.2), (1.6, 1.6, 2.4), mi=1)                      # pedestal
    kit.add_box(tb, (35.0, -70.0, z + 3.6), (1.0, 0.8, 2.4), mi=2)                      # bronze figure
    kit.mesh_object('Dacheng terrace', tb, coll, ['granite', 'granite_shade', 'bronze'])
    oc.hall('Dacheng Hall', coll, (35.0, -38.0, dz), 44.0, 23.5, 9.5, walls='timber_dark', double=True,
            roof='tile_dark', plinth=0.4, roof_h=8.6)
    # 魁光阁 (Kuiguang Pavilion): three storeys, octagonal, red timber, dark grey roofs (the gold
    # in dusk photographs is lamplight), a pointed top with a tall finial, rising behind a long
    # single-storey riverside hall (Commons photograph).
    kz = dry(-6.0, -128.0)
    oc.hall('Kuiguang riverside hall', coll, (-6.0, kz + 3.0, z), 38.0, 7.0, 4.0, walls='whitewash', columns=True)
    oc.pagoda('Kuiguang Pavilion', coll, (-6.0, kz + 12.0, z + 4.0), levels=2, r0=4.4, r_top=3.6, level_h=4.2, sides=8,
              walls='vermilion', trim='vermilion', roof='tile_dark', podium_r=5.2, spire=3.2)
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
        # Pale stone ashlar on the lower two-thirds, brick above (Commons photograph of the gate).
        kit.add_box(bm, (cx, y, z + GATE_H * 0.32), (GATE_W + 0.12, th + 0.12, GATE_H * 0.64), mi=3)
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
    # 27 vaults (藏兵洞): inside, along the side walls' court faces. The outer south face stays
    # plain brick with its one great arch, as photographed.
    for sx in (-1, 1):
        for k in range(14 if sx < 0 else 13):
            yy = y0 + 26 + k * 7.0
            if any(off - 3 < yy - y0 < off + th + 3 for off, th in walls):
                continue
            R = Matrix.Translation((cx + sx * (GATE_W / 2 - 12.02), yy, z)) @ Matrix.Rotation(-sx * math.pi / 2, 4, 'Z')
            kit.arch_panel(bm, (0, 0, 0), 3.4, 4.6, depth=0.3, mi=2, matrix=R)
    # Horse ramp (马道) outside the east wall, climbing south from the city side to the wall top.
    steps = 100
    kit.stair_flight(bm, (0, 0, 0), 5.0, steps, GATE_H / steps, 1.0, mi=1,
                     matrix=Matrix.Translation((cx + GATE_W / 2 + 2.6, y0 + GATE_D + steps * 1.0, z)) @ Matrix.Rotation(math.pi, 4, 'Z'))
    kit.mesh_object('Zhonghua Gate', bm, coll, ['ming_brick', 'paving', 'opening', 'granite_shade'])
    # The city wall running east from the gate past Laomendong (OSM way 91997603).
    wb = bmesh.new()
    for w in F['wall']:
        if w['id'] == 91997603:
            oc.city_wall(wb, w['pts'], zground, height=14.0, width=10.0, outer_side=-1)
    kit.mesh_object('City wall', wb, coll, ['ming_brick', 'paving'])


def build_baoen(coll):
    """The Bao'en protective tower: a nine-storey lantern of a pagoda that glows white-gold at dusk."""
    oc.glass_tower("Bao'en Pagoda", coll, (BAOEN.x, BAOEN.y, zground(*BAOEN)), levels=9, r0=8.5, r1=6.2, level_h=7.4)


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
                    # Keep Fuzimiao's axis, its screen wall and the bank benches open.
                    axis_open = -70 < q.x < 150 and -240 < q.y < -95
                    if in_patch(q.x, q.y) and not water_mask.at(q.x, q.y) and not axis_open and rnd.random() < 0.25:
                        kit.place(protos['willow' if rnd.random() < 0.6 else 'broadleaf_shade'], trees,
                                  (q.x, q.y, zground(q.x, q.y)), rnd.uniform(0, 6.28), rnd.uniform(0.9, 1.25))
                        n += 1
                k += 14.0
    return n


def dry(x, y, dy=1.0):
    """Step a marker inland (along y) until it is 6 m clear of the river: bank tops are
    balustrade and embankment, which the walk grid treats as walls."""
    for _ in range(80):
        if water_mask.distance_ok(x, y, 6.0):
            return y
        y += dy
    return y


def markers(coll, gates_coll, ride_line):
    z = STREET
    bank = dry(AXIS_X + 18, -132.0)
    ac.add_point(coll, 'Spawn qinhuai', (AXIS_X + 18, bank, z), (AXIS_X - 30, -200.0, z + 4))
    ac.add_point(coll, 'Spawn fuzimiao', (AXIS_X, -104.0, z), (35.0, -38.0, z + 8))
    ac.add_point(coll, 'Spawn zhonghua', (GATE_C.x, GATE_C.y - GATE_D / 2 - 30, z), (GATE_C.x, GATE_C.y, z + 12))
    ac.add_point(coll, 'Spawn mendong', (-60.0, -860.0, zground(-60, -860)), (-30.0, -760.0, zground(-30, -760) + 4))
    ac.add_point(coll, 'Spawn baoen', (BAOEN.x + 45, BAOEN.y + 55, zground(BAOEN.x + 45, BAOEN.y + 55)), (BAOEN.x, BAOEN.y, 40))
    ac.add_point(coll, 'Spawn wall', (GATE_C.x, GATE_C.y - GATE_D / 2 + 11, z + GATE_H + 0.1), (GATE_C.x, GATE_C.y - 600, z))
    # Benches on the north bank facing the river and the screen wall.
    for k, x in enumerate((AXIS_X - 18, AXIS_X + 6, AXIS_X + 24)):   # x = 10 lands on the Kuixing podium
        ac.add_point(coll, f'Seat qinhuai-{k}', (x, dry(x, -136.0), z), (x, -200.0, z + 3))
    ac.add_point(coll, 'Dock fuzimiao', (78.0, -99.5, WATER + 0.7), (78.0, -110, WATER))
    # Boat path: the river centreline through the Fuzimiao stretch, as a marker chain.
    for k, p in enumerate(ride_line):
        e = bpy.data.objects.new(f'Ride qinhuai {k:03d}', None)
        e.location = (p.x, p.y, WATER + 0.15)
        coll.objects.link(e)
    gy = dry(AXIS_X + 60, -132.0)
    gates = [('zhonghua', Vector((AXIS_X + 60, gy, z)), Vector((AXIS_X + 80, gy, z))),
             ('qinhuai', Vector((GATE_C.x + 40, GATE_C.y - GATE_D / 2 - 30, z)), Vector((GATE_C.x + 60, GATE_C.y - GATE_D / 2 - 30, z))),
             ('mendong', Vector((AXIS_X - 60, dry(AXIS_X - 60, -132.0), z)), Vector((AXIS_X - 80, dry(AXIS_X - 60, -132.0), z)))]
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
    import time
    clock = [time.time()]

    def lap(label):
        print(f'  {label}: {time.time() - clock[0]:.1f} s', flush=True)
        clock[0] = time.time()
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    root = bpy.data.collections.new('OldSouth')
    scene.collection.children.link(root)
    c = {n: collection(n, root) for n in ('Ground', 'Water', 'Temple', 'Town', 'Walls', 'City', 'Gates', 'Trees', 'Prototypes', 'Markers')}
    protos = oc.extra_prototypes(c['Prototypes'], kit.tree_prototypes(c['Prototypes']))
    lap('protos')
    (fx, fy), (sx, sy) = P_F, P_S
    ac.terrain_patch('Terrain Fuzimiao', c['Ground'], fx, fy, ground, ['paving', 'canal_stone', 'paving'])
    lap('ac.terrain_patch')
    ac.terrain_patch('Terrain south', c['Ground'], sx, sy, ground, ['paving', 'canal_stone', 'paving'])
    lap('ac.terrain_patch')
    kit.PALETTE.setdefault('city_ground', '#A8A68C')
    ac.outer_apron('Terrain outer', c['Ground'], A, PATCHES, zground, material='city_ground')
    lap('ac.outer_apron')
    build_river(c['Water'])
    lap('build_river')
    build_fuzimiao(c['Temple'])
    lap('build_fuzimiao')
    build_zhonghua(c['Walls'])
    lap('build_zhonghua')
    build_baoen(c['Temple'])
    lap('build_baoen')
    build_laomendong_gate(c['Town'])
    lap('build_laomendong_gate')

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
    lap('houses')
    sky = ac.Mask(ac.skyline_polys(A.meta['origin_wgs84']), A.extent, 6.0)   # towers come from the shared skyline
    _, blocks = ac.city_blocks('City blocks', c['City'], F['buildings'], lambda x, y: max(A.bare_at(x, y), STREET),
                               lambda x, y: not in_patch(x, y, 10) and not water_mask.at(x, y) and not sky.at(x, y))
    scene['origin_wgs84'] = list(A.meta['origin_wgs84'])
    scene['base_z'] = A.base
    trees = plant(protos, c['Trees'])
    # Street and courtyard trees between the city blocks: the green that Nanjing's plane trees give
    # the city from the air (wherever OSM has no building within 12 m and no water).
    bmask = ac.Mask([b['pts'] for b in F['buildings']], A.extent, 6.0)
    x0, x1, y0, y1 = A.extent
    y = y0 + 20
    while y < y1 - 20:
        x = x0 + 20
        while x < x1 - 20:
            px, py = x + rnd.uniform(-9, 9), y + rnd.uniform(-9, 9)
            if not in_patch(px, py, 6) and not water_mask.at(px, py) and bmask.distance_ok(px, py, 12):
                kit.place(protos['far'], c['Trees'], (px, py, max(A.bare_at(px, py), STREET) - 1.0), rnd.uniform(0, 6.28), rnd.uniform(1.2, 1.9))
                trees += 1
            x += 26
        y += 26
    lap('trees')
    line = river_line()
    lap('line')
    markers(c['Markers'], c['Gates'], line)
    lap('markers')
    ac.lookdev(scene, sky='#E9A27A', sun_az=250, sun_el=9, energy=3.2)
    lap('ac.lookdev')
    cams = {
        'qinhuai-dusk': ac.camera(scene, 'Cam qinhuai', (AXIS_X + 70, -140.0, STREET + 3), (AXIS_X - 60, -150.0, STREET + 2), 30),
        'fuzimiao': ac.camera(scene, 'Cam fuzimiao', (AXIS_X, -190.0, STREET + 12), (35.0, -40.0, STREET + 6), 32),
        'zhonghua': ac.camera(scene, 'Cam zhonghua', (GATE_C.x + 60, GATE_C.y - 160, STREET + 30), (GATE_C.x, GATE_C.y, STREET + 8), 30),
        'mendong': ac.camera(scene, 'Cam mendong', (-40.0, -820.0, zground(-40, -820) + 1.7), (-25.0, -700.0, zground(-25, -700) + 3), 32),
        'aerial': ac.camera(scene, 'Cam aerial', (300, -1500, 420), (-200, -500, 0), 28),
        # Shape audit close-ups, framed like the reference photographs.
        'audit-dacheng': ac.camera(scene, 'Cam audit-dacheng', (35.0, -98.0, STREET + 3.0), (35.0, -38.0, STREET + 10), 30),
        'audit-kuiguang': ac.camera(scene, 'Cam audit-kuiguang', (-40.0, -165.0, STREET + 3.0), (-6.0, -110.0, STREET + 9), 34),
        'audit-lingxing': ac.camera(scene, 'Cam audit-lingxing', (58.0, -112.0, STREET + 1.7), (40.0, -94.0, STREET + 3), 32),
        'audit-baoen': ac.camera(scene, 'Cam audit-baoen', (BAOEN.x + 20, BAOEN.y + 150, max(zground(BAOEN.x, BAOEN.y + 150), STREET) + 2),
                                 (BAOEN.x, BAOEN.y, 40), 30),
        'audit-zhonghua': ac.camera(scene, 'Cam audit-zhonghua', (GATE_C.x, GATE_C.y - GATE_D / 2 - 40, STREET + 1.7),
                                    (GATE_C.x, GATE_C.y, STREET + 8), 32),
    }
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print('BUILD', {'water': round(WATER, 2), 'street': round(STREET, 2), 'houses': houses, 'blocks': blocks, 'trees': trees,
                    'ride_pts': len(line), 'objects': len(bpy.data.objects)}, flush=True)
    if RENDER:
        ac.render_views(scene, cams, RENDERS, 'lookdev')


main()
