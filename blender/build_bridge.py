"""Nanjing Yangtze River Bridge 南京长江大桥: the truss over the river, the bridgehead towers, the deck.

    D:/soft/blender/blender.exe -b --factory-startup --python blender/build_bridge.py [-- --no-render]

Evidence (research/bridge/FACTS.md): OSM gives the main bridge's outline (man_made=bridge, way
756599299, 1,671 m), the road ways, the railway and the South Bridgehead Park (89764156); the river
is the Yangtze's multipolygon, stitched by tools/research/area-prep.py. Published figures: a
double-deck steel truss, nine piers and ten spans (one of 128 m, nine of 160 m), 24 m clearance
under the truss, a 15 m road with 2.25 m walkways each side, double track below; bridgehead
towers about 70 m with the "three red flags" on top; worker-peasant-soldier statue groups;
magnolia lamp posts along the deck. Assumptions: truss depth (16 m), panel length (8 m), pier
shapes, the towers' plan and detail, approach arch spacing, lamp spacing, which end has the
128 m span, and everything about the parks and city on the banks beyond OSM footprints.

Frame: the world origin is the south end of the OSM outline, on its centreline. The bridge runs
along s (yaw YAW, anticlockwise from east), t across it (positive to the south-west, upstream).
"""
import json
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
OUT_BLEND = ROOT / 'art-src' / 'bridge.blend'
RENDERS = ROOT / 'design' / 'bridge'
RENDER = '--no-render' not in sys.argv
rnd = random.Random(1968)

A = ac.Area('bridge')
F = A.feats
YAW = 2.6089525                      # the outline's axis, south end to north end
CU, SU = math.cos(YAW), math.sin(YAW)
MB = Matrix.Rotation(YAW, 4, 'Z')    # bridge frame (s, t, z) -> world
LENGTH = 1670.7                      # OSM outline, abutment to abutment
TRUSS = (51.5, 51.5 + 1568.0)        # nine 160 m spans from the south, then the 128 m span
PIERS = [TRUSS[0] + 160.0 * k for k in range(10)] + [TRUSS[1]]
TOWERS = (20.0, LENGTH - 20.0)       # bridgehead centres along s
kit.PALETTE.update({
    'steel_grey': '#8C989E', 'steel_dark': '#5E6A70', 'pier_stone': '#B9B3A6', 'tower_cream': '#EADDB8',
    'flag_red': '#C8321E', 'statue_cream': '#EFE6D0', 'asphalt': '#5B5E5E', 'lane_white': '#E9E6DC',
    'iron_relief': '#4E5A60', 'lamp_white': '#FFF6E0', 'river_bed': '#6E7F6E', 'city_ground': '#A8A68C',
    'rail_bed': '#77706A',
})


def P(s, t):
    return s * CU - t * SU, s * SU + t * CU


def ST(x, y):
    return x * CU + y * SU, -x * SU + y * CU


river = [w['pts'] for w in F['water']]
islands = [w['pts'] for w in F['islands']]
water_mask = ac.Mask(river, A.extent, 4.0)
island_mask = ac.Mask(islands, A.extent, 4.0)


def wet(x, y):
    return water_mask.at(x, y) and not island_mask.at(x, y)


WATER = 0.0                          # the DSM's flat river, after A.base
for s in range(600, 1200, 50):
    if wet(*P(s, 0)):
        WATER = round(A.dsm_at(*P(s, 0)), 2)
        break
BOT = WATER + 27.5                   # truss bottom chord (24 m clearance at high water)
TOP = BOT + 16.0                     # truss top chord
RAIL = BOT + 1.4                     # rail head on the lower deck
ROAD = TOP + 1.6                     # road surface
WALK = ROAD + 0.25                   # walkways, a kerb above the road
park = next(p['pts'] for p in F['places'] if p['id'] == 89764156)
park_mask = ac.Mask([park], A.extent, 4.0)


def ground(x, y):
    if wet(x, y):
        return WATER - 6.0, 3
    z = max(A.bare_at(x, y), WATER + 1.2)
    s, t = ST(x, y)
    if any(abs(s - c) < 70 and abs(t) < 70 for c in TOWERS):
        return z, 1                  # paved plaza round each bridgehead
    # Lawn in the park and along the walkable stretch of bank (the park grid); city ground beyond.
    return z, (0 if park_mask.at(x, y) or (-260 < s < 330 and -300 < t < -16) else 2)


def zground(x, y):
    return ground(x, y)[0]


def collection(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


def member(bm, a, b, t, w, h, mi, matrix=MB):
    """A straight bar from a=(s, z) to b=(s, z) in the plane at t: w across, h deep."""
    (s0, z0), (s1, z1) = a, b
    L = math.hypot(s1 - s0, z1 - z0)
    M = matrix @ Matrix.Translation(((s0 + s1) / 2, t, (z0 + z1) / 2)) @ Matrix.Rotation(-math.atan2(z1 - z0, s1 - s0), 4, 'Y')
    kit.add_box(bm, (0, 0, 0), (L, w, h), mi=mi, matrix=M)


def build_truss(coll):
    """Two Warren truss planes with verticals at t = ±7, 8 m panels; the lower (rail) deck between
    them, cross frames at every panel point. Continuous over the piers."""
    bm = bmesh.new()
    s0, s1 = TRUSS
    n = int(round((s1 - s0) / 8.0))
    for t in (-7.0, 7.0):
        member(bm, (s0, BOT), (s1, BOT), t, 1.0, 1.3, 0)
        member(bm, (s0, TOP), (s1, TOP), t, 1.0, 1.3, 0)
        for k in range(n + 1):
            s = s0 + k * 8.0
            member(bm, (s, BOT), (s, TOP), t, 0.7, 0.6, 0)
            if k < n:
                a, b = ((s, BOT), (s + 8.0, TOP)) if k % 2 == 0 else ((s, TOP), (s + 8.0, BOT))
                member(bm, a, b, t, 0.8, 0.7, 0)
        # End posts lean in to the abutments.
        member(bm, (s0 - 2.0, BOT - 0.6), (s0, TOP), t, 1.0, 1.0, 0)
        member(bm, (s1 + 2.0, BOT - 0.6), (s1, TOP), t, 1.0, 1.0, 0)
    for k in range(n + 1):
        s = s0 + k * 8.0
        kit.add_box(bm, (s, 0, BOT - 0.2), (0.6, 14.0, 1.0), mi=1, matrix=MB)      # floor beam
        if k % 2 == 0:
            kit.add_box(bm, (s, 0, TOP - 1.2), (0.5, 14.0, 0.8), mi=1, matrix=MB)  # top cross frame
    # Lower deck: ballast and two tracks.
    kit.add_box(bm, ((s0 + s1) / 2, 0, BOT + 0.6), (s1 - s0, 12.6, 0.4), mi=2, matrix=MB)
    for tr in (-2.2, 2.2):
        for r in (-0.72, 0.72):
            kit.add_box(bm, ((s0 + s1) / 2, tr + r, RAIL - 0.08), (s1 - s0, 0.12, 0.16), mi=1, matrix=MB)
    kit.mesh_object('Truss', bm, coll, ['steel_grey', 'steel_dark', 'rail_bed'])


def build_piers(coll):
    """Nine river piers and two abutments: round-nosed concrete shafts with a cap under the truss."""
    bm = bmesh.new()
    for s in PIERS:
        x, y = P(s, 0)
        bed = min(zground(x, y), WATER - 6.0) - 2.0
        h = BOT - 0.7 - bed
        kit.add_box(bm, (s, 0, bed + h / 2), (8.0, 16.0, h), mi=0, matrix=MB)
        for t in (-8.0, 8.0):
            c = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=4.0, radius2=4.0, depth=h)
            M = MB @ Matrix.Translation((s, t, bed + h / 2))
            bmesh.ops.transform(bm, matrix=M, verts=c['verts'])
        kit.add_box(bm, (s, 0, BOT - 1.1), (10.0, 26.0, 1.0), mi=1, matrix=MB)
        # A darker band at the waterline.
        kit.add_box(bm, (s, 0, WATER + 0.4), (8.3, 16.3, 1.2), mi=2, matrix=MB)
    kit.mesh_object('Piers', bm, coll, ['pier_stone', 'granite_shade', 'steel_dark'])


def build_deck(coll, s_from, s_to):
    """The road deck on top of the truss: 15 m of asphalt, kerbs, 2.25 m walkways and railings
    with cast-iron relief panels; magnolia lamp posts every 32 m."""
    bm = bmesh.new()
    L, mid = s_to - s_from, (s_from + s_to) / 2
    kit.add_box(bm, (mid, 0, ROAD - 0.6), (L, 15.0, 1.2), mi=0, matrix=MB)
    for side in (-1, 1):
        kit.add_box(bm, (mid, side * 8.625, WALK - 0.7), (L, 2.25, 1.4), mi=1, matrix=MB)           # walkway
        kit.add_box(bm, (mid, side * 9.95, WALK + 0.55), (L, 0.4, 1.1), mi=1, matrix=MB)            # parapet
        kit.add_box(bm, (mid, side * 10.16, WALK + 0.45), (L, 0.06, 0.7), mi=3, matrix=MB)          # relief panels
        kit.add_box(bm, (mid, side * 9.95, WALK - 1.6), (L, 0.5, 0.8), mi=4, matrix=MB)             # edge beam
        for k in range(int(L / 8.0) + 1):                                                            # brackets
            kit.add_box(bm, (s_from + k * 8.0, side * 8.6, WALK - 2.3), (0.5, 2.4, 1.2), mi=4, matrix=MB)
    # Lane lines.
    for t in (-3.75, 3.75):
        for k in range(int(L / 12.0)):
            kit.add_box(bm, (s_from + 6 + k * 12.0, t, ROAD + 0.01), (4.0, 0.15, 0.02), mi=2, matrix=MB)
    kit.add_box(bm, (mid, 0, ROAD + 0.01), (L, 0.3, 0.02), mi=2, matrix=MB)
    kit.mesh_object('Road deck', bm, coll, ['asphalt', 'paving', 'lane_white', 'iron_relief', 'steel_dark'])
    lamps = bmesh.new()
    for side in (-1, 1):
        for k in range(int(L / 32.0) + 1):
            s = s_from + 16.0 + k * 32.0
            if s > s_to - 4:
                break
            c = bmesh.ops.create_cone(lamps, cap_ends=True, segments=8, radius1=0.2, radius2=0.14, depth=8.0)
            bmesh.ops.transform(lamps, matrix=MB @ Matrix.Translation((s, side * 9.95, WALK + 5.0)), verts=c['verts'])
            for f in {f for v in c['verts'] for f in v.link_faces}:
                f.material_index = 0
            # The magnolia: a crown globe and four petals of globes round it.
            for dx, dy, dz, r in ((0, 0, 9.4, 0.55), (0.9, 0, 8.6, 0.42), (-0.9, 0, 8.6, 0.42), (0, 0.9, 8.6, 0.42), (0, -0.9, 8.6, 0.42)):
                g = bmesh.ops.create_icosphere(lamps, subdivisions=1, radius=r)
                bmesh.ops.transform(lamps, matrix=MB @ Matrix.Translation((s + dx, side * 9.95 + dy, WALK + dz)), verts=g['verts'])
                for f in {f for v in g['verts'] for f in v.link_faces}:
                    f.material_index = 1
            kit.add_box(lamps, (s, side * 9.95, WALK + 8.5), (2.0, 0.12, 0.12), mi=0, matrix=MB)
            kit.add_box(lamps, (s, side * 9.95, WALK + 8.5), (0.12, 2.0, 0.12), mi=0, matrix=MB)
    kit.mesh_object('Magnolia lamps', lamps, coll, ['steel_dark', 'lamp_white'])


def flag(bm, base, fan, out, staff, mi):
    """One of the three red flags (三面红旗): a staff leaning out of the fan, and a cloth streaming
    away from the road in five waving panels."""
    bs, bt, bz = base
    tip = (bs + math.sin(fan) * staff, bt + out * 0.12 * staff, bz + math.cos(fan) * staff)
    member(bm, (bs, bz), (tip[0], tip[2]), bt + out * 0.06 * staff, 0.5, 0.5, mi)
    for k in range(5):
        w = (k + 0.5) * 1.4
        wave = math.sin(k * 1.3) * 0.7
        M = MB @ Matrix.Translation((tip[0] + wave - math.sin(fan) * 0.2 * k, tip[1] + out * w, tip[2] - 3.4 - 0.2 * k)) @             Matrix.Rotation(fan, 4, 'Y')
        kit.add_box(bm, (0, 0, 0), (0.5, 1.6, 6.6 - 0.3 * k), mi=mi, matrix=M)


def figure(bm, s, t, z, pose, mi, face=1):
    """A sculpted figure of a statue group, blocked out: legs, coat, head, a raised arm."""
    M = MB @ Matrix.Translation((s, t, z))
    kit.add_box(bm, (0, 0, 0.9), (0.9, 0.6, 1.8), mi=mi, matrix=M)
    kit.add_box(bm, (0, 0, 2.35), (1.1, 0.7, 1.2), mi=mi, matrix=M)
    kit.add_box(bm, (0, 0, 3.15), (0.45, 0.45, 0.5), mi=mi, matrix=M)
    if pose == 'raise':
        kit.add_box(bm, (0.45, 0, 3.4), (0.25, 0.25, 1.3), mi=mi, matrix=M)
    elif pose == 'book':
        kit.add_box(bm, (0, -0.45 * face, 2.5), (0.6, 0.12, 0.45), mi=mi, matrix=M)
    elif pose == 'rifle':
        kit.add_box(bm, (-0.5, 0, 2.6), (0.12, 0.12, 2.2), mi=mi, matrix=M)


def build_bridgehead(coll, sc, facing):
    """大桥头堡: a cream base block the decks pass through, twin towers either side of the road
    with ribs and a cornice, three red flags on each, and a statue group on a balcony on the river
    side. facing: +1 when the river is towards +s."""
    bm = bmesh.new()
    x, y = P(sc, 0)
    zg = zground(x, y)
    hb = ROAD - 0.6 - (zg - 1.0)
    kit.add_box(bm, (sc, 0, zg - 1.0 + hb / 2), (40.0, 52.0, hb), mi=0, matrix=MB)
    for side in (-1, 1):
        # Tall window strips down the long sides.
        for k in range(9):
            kit.add_box(bm, (sc - 16.0 + k * 4.0, side * 26.05, zg + (ROAD - zg) * 0.55), (1.6, 0.1, (ROAD - zg) * 0.7), mi=1, matrix=MB)
    # The rail portals on both ends (the lower deck runs through the block).
    for end in (-1, 1):
        for tr in (-2.2, 2.2):
            kit.add_box(bm, (sc + end * 20.05, tr, RAIL + 3.0), (0.1, 4.6, 6.0), mi=1, matrix=MB)
    for side in (-1, 1):
        t = side * 17.0
        kit.add_box(bm, (sc, t, ROAD + 11.0), (12.0, 8.0, 23.2), mi=0, matrix=MB)                   # tower shaft
        for k in (-4.0, 0.0, 4.0):
            kit.add_box(bm, (sc + k, t + side * 4.2, ROAD + 11.0), (0.9, 0.5, 22.0), mi=2, matrix=MB)  # ribs
        kit.add_box(bm, (sc, t, ROAD + 22.9), (13.2, 9.2, 0.8), mi=2, matrix=MB)                    # cornice
        for k, (fan, staff) in enumerate(((-0.32, 13.0), (0.0, 15.5), (0.32, 13.0))):
            flag(bm, (sc + (k - 1) * 2.2, t, ROAD + 23.3), fan, side, staff, 3)
        # Statue group on a balcony at deck level, on the river side of the tower.
        bs = sc + facing * 28.0
        kit.add_box(bm, (bs, side * 14.5, WALK - 0.4), (14.0, 9.0, 0.8), mi=2, matrix=MB)
        kit.add_box(bm, (bs, side * 15.0, WALK + 0.9), (9.0, 4.0, 1.8), mi=4, matrix=MB)            # plinth
        for k, pose in enumerate(('rifle', 'raise', 'book', 'raise', 'rifle')):
            figure(bm, bs - 3.2 + k * 1.6, side * 15.0 + (0.4 if k % 2 else -0.4), WALK + 1.8, pose, 5)
    kit.mesh_object(f'Bridgehead {int(sc)}', bm, coll, ['tower_cream', 'opening', 'granite_shade', 'flag_red', 'pier_stone', 'statue_cream'])
    return zg


def approach_line(start, pts, grade, z0):
    """Sample a ramp along a polyline from start: z falls by grade per metre until it meets the
    ground. Returns [(x, y, z)]."""
    out, d = [], 0.0
    line = [start] + pts
    for a, b in zip(line, line[1:]):
        a, b = Vector(a), Vector(b)
        L = (b - a).length
        k = 0.0
        while k < L:
            p = a.lerp(b, k / L)
            z = z0 - grade * (d + k)
            g = zground(p.x, p.y)
            out.append((p.x, p.y, max(z, g + 0.2)))
            if z < g + 0.5:
                return out
            k += 6.0
        d += L
    return out


def build_approach(coll, over, line, width=19.8):
    """A road approach on double-curved arches (双曲拱): piers every 30 m, arch rings between them
    on both faces, the deck slab and parapets on top. The deck and arches are Overhead (walk
    beneath them); the piers are solid."""
    piers, top = bmesh.new(), bmesh.new()
    run = 0.0
    last = None
    for i in range(len(line) - 1):
        a, b = Vector(line[i]), Vector(line[i + 1])
        d = b - a
        L = d.xy.length
        if L < 1e-3:
            continue
        ang = math.atan2(d.y, d.x)
        M = Matrix.Translation(((a + b) / 2)) @ Matrix.Rotation(ang, 4, 'Z') @ Matrix.Rotation(-math.atan2(d.z, L), 4, 'Y')
        kit.add_box(top, (0, 0, -0.5), (L + 0.2, width, 1.0), mi=0, matrix=M)
        for side in (-1, 1):
            kit.add_box(top, (0, side * (width / 2 - 0.2), 0.55), (L + 0.2, 0.4, 1.1), mi=1, matrix=M)
        run += L
        if last is None or run - last >= 30.0:
            last = run
            g = zground(b.x, b.y)
            h = b.z - 1.0 - g
            if h > 2.5:
                for side in (-1, 1):
                    q = Matrix.Translation((b.x, b.y, g + h / 2)) @ Matrix.Rotation(ang, 4, 'Z')
                    kit.add_box(piers, (0, side * 6.0, 0), (2.2, 3.0, h), mi=0, matrix=q)
                # Arch rings back to the previous pier on both faces.
                span = 30.0
                rise = min(h * 0.55, 11.0)
                for side in (-1, 1):
                    for k in range(10):
                        a0, a1 = math.pi * k / 10, math.pi * (k + 1) / 10
                        p0 = (-span / 2 * math.cos(a0) - span / 2, b.z - 1.0 - rise + rise * math.sin(a0))
                        p1 = (-span / 2 * math.cos(a1) - span / 2, b.z - 1.0 - rise + rise * math.sin(a1))
                        q = Matrix.Translation((b.x, b.y, 0)) @ Matrix.Rotation(ang, 4, 'Z')
                        member(top, p0, p1, side * (width / 2 - 0.6), 0.8, 0.9, 2, matrix=q)
    kit.mesh_object('Approach deck', top, over, ['asphalt', 'granite_shade', 'pier_stone'])
    kit.mesh_object('Approach piers', piers, coll, ['pier_stone'])


def build_rail_viaduct(coll, s_from, s_to, z_from, z_to):
    """The railway approach: a girder viaduct on twin columns every 32 m, straight on the axis."""
    bm = bmesh.new()
    n = int(abs(s_to - s_from) / 32.0)
    for k in range(n):
        sa = s_from + (s_to - s_from) * k / n
        sb = s_from + (s_to - s_from) * (k + 1) / n
        za = z_from + (z_to - z_from) * k / n
        zb = z_from + (z_to - z_from) * (k + 1) / n
        member(bm, (sa, za - 1.6), (sb, zb - 1.6), 0, 11.0, 2.6, 0)
        for tr in (-2.2, 2.2):
            for r in (-0.72, 0.72):
                member(bm, (sa, za - 0.08), (sb, zb - 0.08), tr + r, 0.12, 0.16, 1)
        x, y = P(sb, 0)
        g = zground(x, y)
        if zb - 3.0 - g > 1.0:
            for t in (-3.4, 3.4):
                kit.add_box(bm, (sb, t, (g + zb - 2.9) / 2), (2.0, 2.0, zb - 2.9 - g), mi=2, matrix=MB)
    kit.mesh_object('Rail viaduct', bm, coll, ['pier_stone', 'steel_dark', 'pier_stone'])


def gate(coll, gates_coll, target, n, s, t, z, toward):
    loc = Vector((*P(s, t), z))
    to = Vector((*P(*toward), z))
    d = (to - loc).normalized()
    g = kit.moon_gate(f'Moon gate {n}', gates_coll, width=2.6, height=3.4, radius=1.05)
    g.matrix_world = Matrix.Translation(loc) @ Matrix.Rotation(math.atan2(-d.x, d.y), 4, 'Z')
    ac.add_point(coll, f'Gate {target}@{n}', loc, loc + d * 10)


def river_lane(s):
    """The navigation channel at s: t from bank to bank (wet), sampled outwards from the bridge."""
    ts = []
    for direction in (-1, 1):
        t = 0.0
        while abs(t) < 2600:
            x, y = P(s, t)
            if not wet(x, y) or not (A.extent[0] + 60 < x < A.extent[1] - 60 and A.extent[2] + 60 < y < A.extent[3] - 60):
                break
            t += direction * 20.0
        ts.append(t - direction * 60.0)
    return ts


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    root = bpy.data.collections.new('Yangtze')
    scene.collection.children.link(root)
    c = {n: collection(n, root) for n in ('Ground', 'Water', 'Bridge', 'Overhead', 'City', 'Gates', 'Trees', 'Prototypes', 'Markers')}
    protos = oc.extra_prototypes(c['Prototypes'], kit.tree_prototypes(c['Prototypes']))
    x0, x1, y0, y1 = A.extent
    patch = ((max(x0 + 30, -2100.0), min(x1 - 30, 700.0)), (max(y0 + 30, -700.0), min(y1 - 30, 1500.0)))
    ac.terrain_patch('Terrain bridge', c['Ground'], patch[0], patch[1], ground, ['lawn', 'paving', 'city_ground', 'river_bed'], step=8.0)
    ac.outer_apron('Terrain outer', c['Ground'], A, (patch,), lambda x, y: ground(x, y)[0], material='city_ground')
    # One sheet of river over the whole crop; the terrain dips below it wherever OSM says river.
    ac.polygon_mesh('Yangtze', c['Water'], [[(x0, y0), (x1, y0), (x1, y1), (x0, y1)]], WATER, 'water')
    build_truss(c['Bridge'])
    build_piers(c['Bridge'])
    build_deck(c['Bridge'], -2.0, LENGTH + 2.0)
    zs = build_bridgehead(c['Bridge'], TOWERS[0], 1)
    zn = build_bridgehead(c['Bridge'], TOWERS[1], -1)
    # South road approach: off the bridgehead, then along OSM's southbound road (ways 313911855,
    # 81370525) as it swings south-west; the north approach runs straight on, falling to grade.
    south = [w['pts'] for w in F['bridges'] if w['id'] in (313911855, 81370525)]
    south_pts = [p for p in south[0] + south[1][1:] if ST(*p)[0] < -60] if len(south) == 2 else []
    s_line = approach_line(P(0.0, 0.0), [P(-60.0, 4.0)] + south_pts, 0.035, ROAD)
    n_line = approach_line(P(LENGTH, 0.0), [P(LENGTH + 1200.0, 0.0)], 0.06, ROAD)
    build_approach(c['Bridge'], c['Overhead'], s_line)
    build_approach(c['Bridge'], c['Overhead'], n_line)
    rail_s = (-1150.0, RAIL - 0.008 * 1150.0)
    rail_n = (LENGTH + 720.0, max(zground(*P(LENGTH + 720.0, 0)) + 1.5, RAIL - 0.03 * 720.0))
    build_rail_viaduct(c['Bridge'], -2.0, rail_s[0], RAIL, rail_s[1])
    build_rail_viaduct(c['Bridge'], LENGTH + 2.0, rail_n[0], RAIL, rail_n[1])

    # City on both banks from OSM footprints, clear of the bridge, its approaches and the park.
    sky = ac.Mask(ac.skyline_polys(A.meta['origin_wgs84']), A.extent, 6.0)
    road_pts = [Vector(p[:2]) for p in s_line[::3] + n_line[::3]]

    def clear(x, y, r):
        s, t = ST(x, y)
        return not (-1200 < s < LENGTH + 800 and abs(t) < r) and all((Vector((x, y)) - q).length > r for q in road_pts)

    _, blocks = ac.city_blocks('City blocks', c['City'], F['buildings'], zground,
                               lambda x, y: clear(x, y, 40) and not park_mask.at(x, y) and not sky.at(x, y) and not wet(x, y))
    kinds = ['broadleaf', 'broadleaf_sun', 'broadleaf_shade', 'cedar', 'willow']
    trees = ac.scatter(protos, c['Trees'], rnd, kinds, 900, (patch[0][0], patch[0][1]), (patch[1][0], patch[1][1]),
                       lambda x, y: park_mask.at(x, y) and clear(x, y, 34) and
                       all(abs(ST(x, y)[0] - tc) > 75 or abs(ST(x, y)[1]) > 75 for tc in TOWERS), zground)
    trees += ac.scatter(protos, c['Trees'], rnd, kinds, 1400, (patch[0][0], patch[0][1]), (patch[1][0], patch[1][1]),
                        lambda x, y: not wet(x, y) and clear(x, y, 36) and not park_mask.at(x, y) and
                        all(abs(ST(x, y)[0] - tc) > 75 or abs(ST(x, y)[1]) > 75 for tc in TOWERS), zground)

    # Traffic: two trains on the lower deck, barges up and down the channel, cars both ways.
    rail_line = [(*P(rail_s[0], 0), rail_s[1]), (*P(-2.0, 0), RAIL), (*P(LENGTH + 2.0, 0), RAIL), (*P(rail_n[0], 0), rail_n[1])]
    traffic = []
    for k, tr in enumerate((-2.2, 2.2)):
        pts = [(x - tr * SU, y + tr * CU, z) for x, y, z in rail_line]
        traffic.append({'kind': 'train', 'pts': pts if k else pts[::-1], 'speed': 16.0, 'cars': 14, 'phase': 0.5 * k, 'gap': 900.0})
    centre = s_line[::-1] + [(*P(s, 0), ROAD) for s in (0.0, LENGTH)] + n_line
    for direction, line in ((1, centre), (-1, centre[::-1])):
        for lane in (1.9, 5.6):
            off = ac.polyline_offset([p[:2] for p in line], -lane)
            traffic.append({'kind': 'car', 'pts': [(o.x, o.y, p[2]) for o, p in zip(off, line)][::2], 'speed': 11.0 + lane, 'n': 26})
    for k, s in enumerate((PIERS[3] + 80.0, PIERS[5] + 80.0)):
        ta, tb = river_lane(s)
        pts = [(*P(s, t), WATER) for t in (ta, (ta + tb) / 2, tb)]
        traffic.append({'kind': 'ship', 'pts': pts if k else pts[::-1], 'speed': 3.5, 'n': 3, 'phase': 0.3 * k})
    # Catmull-Rom curves divide by segment length: drop repeated points.
    for tr in traffic:
        pts = [tr['pts'][0]]
        for q in tr['pts'][1:]:
            if math.dist(q, pts[-1]) > 0.5:
                pts.append(q)
        tr['pts'] = [[round(v, 2) for v in q] for q in pts]
    scene['traffic'] = json.dumps(traffic)

    # Markers. The park beside the south bridgehead (on its downstream side, t < 0), the walkway,
    # the riverbank under the first river span, and mid-river on the deck.
    pk = c['Markers']
    sx, sy = P(-40.0, -95.0)
    ac.add_point(pk, 'Spawn bridge', (sx, sy, zground(sx, sy)), (*P(TOWERS[0], -17.0), ROAD + 10))
    ac.add_point(pk, 'Spawn deck', (*P(TOWERS[0] + 45.0, -8.6), WALK), (*P(700.0, -8.6), WALK + 2))
    rx, ry = P(PIERS[1] - 30.0, -80.0)
    for k in range(30):                  # step back up the bank until dry
        if not wet(rx, ry):
            break
        rx, ry = P(PIERS[1] - 30.0 - 6.0 * (k + 1), -80.0)
    ac.add_point(pk, 'Spawn riverside', (rx, ry, zground(rx, ry)), (*P(PIERS[3], 0), BOT))
    ac.add_point(pk, 'Spawn mid', (*P(820.0, 8.6), WALK), (*P(500.0, 900.0), WATER + 30))
    ac.add_point(pk, 'Seat deck-0', (*P(800.0, 8.7), WALK), (*P(600.0, 700.0), WATER + 20))
    ac.add_point(pk, 'Seat deck-1', (*P(840.0, -8.7), WALK), (*P(840.0, -700.0), WATER + 20))
    gate(pk, c['Gates'], 'deck', 0, -30.0, -60.0, zground(*P(-30.0, -60.0)), (TOWERS[0], -60.0))
    gate(pk, c['Gates'], 'bridge', 1, TOWERS[0] + 36.0, -8.6, WALK, (TOWERS[0] + 80.0, -8.6))
    gate(pk, c['Gates'], 'riverside', 2, 1000.0, -8.6, WALK, (1040.0, -8.6))

    scene['origin_wgs84'] = list(A.meta['origin_wgs84'])
    scene['base_z'] = A.base
    ac.lookdev(scene, sun_az=235, sun_el=16)
    cams = {
        'tower': ac.camera(scene, 'Cam tower', (sx, sy, zground(sx, sy) + 1.7), (*P(TOWERS[0], -17.0), ROAD + 16), 30),
        'deck': ac.camera(scene, 'Cam deck', (*P(TOWERS[0] + 45.0, -8.0), WALK + 1.7), (*P(500.0, -6.0), WALK + 4), 30),
        'river': ac.camera(scene, 'Cam river', (rx, ry, zground(rx, ry) + 1.7), (*P(PIERS[3], 0), BOT + 4), 28),
        'aerial': ac.camera(scene, 'Cam aerial', (*P(-500.0, -900.0), 320), (*P(700.0, 0), 20), 30),
    }
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print('BUILD', {'trees': trees, 'blocks': blocks, 'water': WATER, 'road': ROAD, 'south_ground': round(zs, 1),
                    'north_ground': round(zn, 1), 'approach': [len(s_line), len(n_line)], 'traffic': len(traffic),
                    'objects': len(bpy.data.objects)}, flush=True)
    if RENDER:
        ac.render_views(scene, cams, RENDERS, 'lookdev')


main()
