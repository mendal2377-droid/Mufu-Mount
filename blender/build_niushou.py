"""Niushou Mountain 牛首山: the Usnisha Palace under its lattice robe, the Foding Pagoda, the plaza.

    D:/soft/blender/blender.exe -b --factory-startup --python blender/build_niushou.py [-- --no-render]

Evidence (research/niushou/FACTS.md; the owner's three aerial photographs, inspection only): OSM
places the Usnisha Palace 佛顶宫 (way 1160624650, an oval 106 x 154 m) in the old quarry between
the peaks, the Foding Pagoda 佛顶塔 (1160624651, a 42 m square podium) 215 m to its south-south-west,
the Niutou Chan culture park 牛頭禪文化園 (1160624652) with its grey-roofed halls, and the east
peak (249 m). Published: the palace is a large shell (about 220 x 160 m) draped like a monk's robe
over a smaller dome of a lotus base and mani jewel, 89.3 m from the lowest of its six underground
levels; the pagoda is a square, nine-storey, Tang-style tower of 88 m. Photographs: the large shell
is a rose-gold triangulated lattice, raised in a high arch towards the plaza and sweeping down to
a tail; the small dome is gold and faceted, on a cream arcaded drum ringed by water; the pagoda has
dark red storeys under gold roofs on a stone podium; the pale plaza has rows of trees; a dark
octagonal pagoda stands among grey-roofed halls below the plaza.
Assumptions: every height above the plaza except the pagoda's, the shell's plan and curve, the
drum and moat, the dark pagoda's size, and the hill ground (canopy taken off the DSM).
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
OUT_BLEND = ROOT / 'art-src' / 'niushou.blend'
RENDERS = ROOT / 'design' / 'niushou'
RENDER = '--no-render' not in sys.argv
rnd = random.Random(2015)

A = ac.Area('niushou')
F = A.feats
kit.PALETTE.update({
    'shell_rose': '#E2B3A0', 'shell_shadow': '#B4897C', 'gold_pale': '#E8CF7A', 'drum_cream': '#EDE2C8',
    'pagoda_red': '#9A3A2A', 'city_ground': '#A8A68C',
})

PAGODA = Vector((-59.0, -217.0))          # OSM podium centre
PAGODA_YAW = math.radians(20.0)           # the podium's sides
DOME = Vector((10.0, -5.0))               # the small dome, inside the OSM oval
DOME_R = 50.0
SHELL_M, SHELL_T = Vector((-90.0, -25.0)), Vector((110.0, 115.0))   # the robe's mouth and tail
PLAZA = round(A.bare_at(*PAGODA), 1)      # the pagoda's ground; the pit is filled to it


def _seg_dist(p, a, b):
    ab = b - a
    k = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * k)).length


def shell_frame(s):
    """Spine point, left normal, half-width and crown height of the robe at s in [0, 1]."""
    d = (SHELL_T - SHELL_M).normalized()
    n = Vector((-d.y, d.x))
    p = SHELL_M.lerp(SHELL_T, s) + n * (math.sin(math.pi * s) * 22.0)
    w = 78.0 * (1 - s) ** 0.55 + 12.0
    h = 58.0 * math.sin(math.pi * min(1.0, 0.18 + s * 0.95)) ** 0.7 + (6.0 * max(0.0, s - 0.85) / 0.15)
    return p, n, w, max(h, 6.0)


def plaza_distance(x, y):
    """How far (x, y) lies outside the paved, filled level: pagoda plaza, the way to the palace,
    the ring round the dome and the robe's whole plan."""
    p = Vector((x, y))
    d = min((p - PAGODA).length - 78.0, _seg_dist(p, PAGODA, DOME) - 62.0, (p - DOME).length - (DOME_R + 38.0))
    for k in range(9):
        q, _, w, _ = shell_frame(k / 8)
        d = min(d, (p - q).length - w)
    return d


def ground(x, y):
    d = plaza_distance(x, y)
    hill = A.bare_at(x, y) - 6.0                 # canopy off the DSM
    r = (Vector((x, y)) - DOME).length
    if DOME_R + 1.0 < r < DOME_R + 10.0:
        return PLAZA - 3.5, 3                     # the moat floor
    if d <= 0:
        return PLAZA, 1
    k = min(1.0, d / 60.0)
    k = k * k * (3 - 2 * k)
    return PLAZA + (hill - PLAZA) * k, (2 if d < 14 else 0)


def zground(x, y):
    return ground(x, y)[0]


def dome_height(x, y):
    r = (Vector((x, y)) - DOME).length
    return PLAZA + 10.0 + 34.0 * math.sqrt(max(0.0, 1 - (r / DOME_R) ** 2)) if r < DOME_R else None


def collection(name, parent):
    c = bpy.data.collections.new(name)
    parent.children.link(c)
    return c


def beam(bm, a, b, w, mi):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-3:
        return
    M = Matrix.Translation((a + b) / 2) @ d.to_track_quat('X', 'Z').to_matrix().to_4x4()
    kit.add_box(bm, (0, 0, 0), (d.length, w, w), mi=mi, matrix=M)


def build_shell(coll):
    """The robe: a triangulated lattice over a vault that is high and open at the mouth (towards the
    plaza) and sweeps down to a tail; a darker skin under it; legs where its edges meet the ground.
    Over the small dome the vault is lifted clear of it."""
    ns, nt = 46, 24
    nodes = []
    for i in range(ns + 1):
        s = i / ns
        p, n, w, h = shell_frame(s)
        row = []
        for j in range(nt + 1):
            u = -1 + 2 * j / nt
            q = p + n * (u * w)
            z = zground(q.x, q.y) + h * (1 - u * u) ** 0.55
            dh = dome_height(q.x, q.y)
            if dh is not None:
                z = max(z, dh + 6.0)
            row.append(Vector((q.x, q.y, z)))
        nodes.append(row)
    bm = bmesh.new()
    for i in range(ns + 1):
        for j in range(nt + 1):
            if i < ns:
                beam(bm, nodes[i][j], nodes[i + 1][j], 0.55, 0)
            if j < nt:
                beam(bm, nodes[i][j], nodes[i][j + 1], 0.55, 0)
            if i < ns and j < nt:
                a, b = (nodes[i][j], nodes[i + 1][j + 1]) if (i + j) % 2 == 0 else (nodes[i + 1][j], nodes[i][j + 1])
                beam(bm, a, b, 0.4, 0)
        # Legs under both edges.
        if i % 3 == 0:
            for j in (0, nt):
                q = nodes[i][j]
                g = zground(q.x, q.y)
                if q.z - g > 1.5:
                    kit.add_box(bm, (q.x, q.y, (q.z + g) / 2), (1.4, 1.4, q.z - g), mi=1)
    # Skin a little under the lattice, facing up only: from above the robe reads solid, from the
    # plaza beneath it is an open lattice against the sky, as in the photographs.
    vs = [[bm.verts.new(v - Vector((0, 0, 0.7))) for v in row] for row in nodes]
    for i in range(ns):
        for j in range(nt):
            f = bm.faces.new((vs[i][j], vs[i + 1][j], vs[i + 1][j + 1], vs[i][j + 1]))
            f.material_index = 2
    kit.mesh_object('Usnisha robe', bm, coll, ['shell_rose', 'drum_cream', 'shell_shadow'])
    return nodes


def build_dome(coll, water):
    """The small dome: a cream drum with an arcade, a faceted gold cap of alternating tones like
    lotus petals, and a lotus finial carrying the mani jewel; a moat round the drum."""
    bm = bmesh.new()
    c = bmesh.ops.create_cone(bm, cap_ends=True, segments=72, radius1=DOME_R, radius2=DOME_R, depth=14.0)
    bmesh.ops.translate(bm, vec=(DOME.x, DOME.y, PLAZA + 3.0), verts=c['verts'])
    for k in range(36):
        a = 2 * math.pi * (k + 0.5) / 36
        M = Matrix.Translation((DOME.x + math.cos(a) * (DOME_R + 0.05), DOME.y + math.sin(a) * (DOME_R + 0.05), PLAZA - 2.0)) @ \
            Matrix.Rotation(a + math.pi / 2, 4, 'Z')
        kit.arch_panel(bm, (0, 0, 0), 4.6, 9.0, depth=0.3, mi=1, matrix=M, facing='+Y')
    c = bmesh.ops.create_cone(bm, cap_ends=True, segments=72, radius1=DOME_R + 1.2, radius2=DOME_R + 1.2, depth=1.2)
    bmesh.ops.translate(bm, vec=(DOME.x, DOME.y, PLAZA + 10.2), verts=c['verts'])
    kit.mesh_object('Dome drum', bm, coll, ['drum_cream', 'opening'])
    cap = bmesh.new()
    sph = bmesh.ops.create_uvsphere(cap, u_segments=40, v_segments=20, radius=1.0)
    bmesh.ops.delete(cap, geom=[v for v in sph['verts'] if v.co.z < -1e-4], context='VERTS')
    for v in cap.verts:
        v.co = Vector((DOME.x + v.co.x * (DOME_R - 1.0), DOME.y + v.co.y * (DOME_R - 1.0), PLAZA + 10.8 + v.co.z * 34.0))
    for f in cap.faces:
        c0 = f.calc_center_median()
        a = math.atan2(c0.y - DOME.y, c0.x - DOME.x)
        ring = int((c0.z - PLAZA) / 3.0)
        f.material_index = (int((a + math.pi) / (2 * math.pi) * 40) + ring) % 2
    top = PLAZA + 10.8 + 34.0
    kit.mesh_object('Dome cap', cap, coll, ['gold', 'gold_pale'])
    fin = bmesh.new()
    lotus = bmesh.ops.create_cone(fin, cap_ends=True, segments=16, radius1=1.2, radius2=4.2, depth=3.0)
    bmesh.ops.translate(fin, vec=(DOME.x, DOME.y, top + 1.0), verts=lotus['verts'])
    jewel = bmesh.new()
    bmesh.ops.create_icosphere(jewel, subdivisions=2, radius=2.6)
    bmesh.ops.translate(jewel, vec=(DOME.x, DOME.y, top + 4.8), verts=jewel.verts[:])
    kit.mesh_object('Dome lotus', fin, coll, ['gold'])
    kit.mesh_object('Dome jewel', jewel, coll, ['gold'])
    ring = [[(DOME.x + math.cos(2 * math.pi * k / 72) * r, DOME.y + math.sin(2 * math.pi * k / 72) * r) for k in range(72)]
            for r in (DOME_R + 10.0, DOME_R + 1.0)]
    wm = bmesh.new()
    for k in range(72):
        k2 = (k + 1) % 72
        vs = [wm.verts.new((*ring[0][k], PLAZA - 1.2)), wm.verts.new((*ring[0][k2], PLAZA - 1.2)),
              wm.verts.new((*ring[1][k2], PLAZA - 1.2)), wm.verts.new((*ring[1][k], PLAZA - 1.2))]
        wm.faces.new(vs)
    bmesh.ops.recalc_face_normals(wm, faces=wm.faces)
    for f in wm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    kit.mesh_object('Moat', wm, water, ['water'])
    # A bridge over the moat to the entrance, on the plaza side.
    d = (PAGODA - DOME).normalized()
    br = bmesh.new()
    M = Matrix.Translation((*(DOME + d * (DOME_R + 5.5)), PLAZA - 0.3)) @ Matrix.Rotation(math.atan2(d.y, d.x), 4, 'Z')
    kit.add_box(br, (0, 0, 0), (12.0, 10.0, 0.6), mi=0, matrix=M)
    kit.mesh_object('Dome bridge', br, coll, ['paving'])


def build_pagoda(coll):
    """佛顶塔: nine square storeys, dark red with gold roofs, on a stone podium with stairs."""
    o, h = oc.pagoda('Foding Pagoda', coll, (PAGODA.x, PAGODA.y, PLAZA + 4.0), levels=9, r0=17.0, r_top=10.5, level_h=7.8,
                     sides=4, walls='pagoda_red', trim='gold_roof', roof='gold_roof', finial='gold', podium_r=21.0, spire=12.0)
    R = Matrix.Translation((PAGODA.x, PAGODA.y, 0)) @ Matrix.Rotation(PAGODA_YAW + math.pi / 4, 4, 'Z') @ \
        Matrix.Translation((-PAGODA.x, -PAGODA.y, 0))
    o.matrix_world = R @ o.matrix_world
    bm = bmesh.new()
    M = Matrix.Translation((PAGODA.x, PAGODA.y, PLAZA)) @ Matrix.Rotation(PAGODA_YAW, 4, 'Z')
    kit.add_box(bm, (0, 0, 2.0), (42.0, 42.0, 4.0), mi=0, matrix=M)
    for k in range(4):
        Mk = M @ Matrix.Rotation(k * math.pi / 2, 4, 'Z')
        kit.stair_flight(bm, (0, -21.0 - 6.0, 0.0), 12.0, 10, 0.4, 0.6, mi=1, matrix=Mk)
        kit.balustrade(bm, (-21.0, -21.0), (-6.5, -21.0), 4.0, 4.0, mi=1, matrix=Mk)
        kit.balustrade(bm, (6.5, -21.0), (21.0, -21.0), 4.0, 4.0, mi=1, matrix=Mk)
    kit.mesh_object('Pagoda podium', bm, coll, ['granite', 'granite'])
    return h


def build_chan_park(coll):
    """牛頭禪文化園 below the plaza: grey-roofed halls and the dark octagonal pagoda among trees."""
    for k, (x, y, w, d, yaw) in enumerate(((95.0, -150.0, 22.0, 12.0, 0.75), (120.0, -185.0, 18.0, 10.0, 0.75),
                                          (80.0, -185.0, 14.0, 9.0, 0.75), (138.0, -160.0, 12.0, 8.0, 0.75))):
        oc.hall(f'Chan hall {k}', coll, (x, y, zground(x, y)), w, d, 4.8, walls='timber_dark', roof='tile_dark', yaw=yaw)
    x, y = 150.0, -205.0
    oc.pagoda('Dark pagoda', coll, (x, y, zground(x, y)), levels=7, r0=4.6, r_top=3.2, level_h=4.4, sides=8,
              walls='tile_dark', trim='timber_dark', roof='tile_dark', finial='gold', podium_r=6.0, spire=3.5)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    root = bpy.data.collections.new('Niushou')
    scene.collection.children.link(root)
    c = {n: collection(n, root) for n in ('Ground', 'Water', 'Palace', 'Pagoda', 'City', 'Gates', 'Trees', 'Prototypes', 'Markers')}
    protos = oc.extra_prototypes(c['Prototypes'], kit.tree_prototypes(c['Prototypes']))
    patch = ((-520.0, 520.0), (-620.0, 460.0))
    ac.terrain_patch('Terrain niushou', c['Ground'], patch[0], patch[1], ground, ['forest_floor', 'paving', 'lawn', 'canal_stone'], step=5.0)
    ac.outer_apron('Terrain outer', c['Ground'], A, (patch,), lambda x, y: A.bare_at(x, y) - 6.0)
    # Reservoirs and ponds, each at the lowest DSM level round its own shore.
    x0, x1, y0, y1 = A.extent
    for k, w in enumerate(F['water']):
        if not all(x0 < x < x1 and y0 < y < y1 for x, y in w['pts']):
            continue                  # reaches off the DEM: it would float over nothing
        ac.polygon_mesh(f'Pond {k}', c['Water'], [w['pts']], min(A.dsm_at(x, y) for x, y in w['pts']) + 0.2, 'water')
    build_shell(c['Palace'])
    build_dome(c['Palace'], c['Water'])
    h = build_pagoda(c['Pagoda'])
    build_chan_park(c['Pagoda'])
    skip = {1160624650, 1160624651, 1160624652}
    _, blocks = ac.city_blocks('City blocks', c['City'], [b for b in F['buildings'] if b['id'] not in skip], zground,
                               lambda x, y: plaza_distance(x, y) > 40)
    # Rows of trees on the plaza (bare ginkgos in the photographs), forest on the hills.
    rows = 0
    for gx in range(-170, 60, 14):
        for gy in range(-300, -60, 14):
            x, y = gx + 0.5, gy + 0.5
            p = Vector((x, y))
            if plaza_distance(x, y) < -8 and (p - PAGODA).length > 34 and (p - DOME).length > DOME_R + 16 and \
                    _seg_dist(p, PAGODA, DOME) > 9 and all((p - shell_frame(k / 8)[0]).length > shell_frame(k / 8)[2] + 4 for k in range(9)):
                kit.place(protos['broadleaf_sun'], c['Trees'], (x, y, PLAZA), rnd.uniform(0, 6.28), 0.75)
                rows += 1
    kinds = ['broadleaf', 'broadleaf_shade', 'broadleaf_sun', 'cedar', 'cedar']
    trees = ac.scatter(protos, c['Trees'], rnd, kinds, 5200, patch[0], patch[1],
                       lambda x, y: plaza_distance(x, y) > 10 and not any((Vector((x, y)) - Vector(q)).length < 14 for q in
                                                                           ((95, -150), (120, -185), (80, -185), (138, -160), (150, -205))),
                       zground, groves=220)

    pk = c['Markers']
    look_dome = Vector((DOME.x, DOME.y, PLAZA + 30))
    s0 = PAGODA + (DOME - PAGODA) * 0.5 + Vector((-30.0, 6.0))
    ac.add_point(pk, 'Spawn niushou', (s0.x, s0.y, PLAZA), (DOME.x + 40, DOME.y - 20, PLAZA + 25))
    sd = DOME + (PAGODA - DOME).normalized() * (DOME_R + 18.0)
    ac.add_point(pk, 'Spawn dome', (sd.x, sd.y, PLAZA), look_dome)
    sp = PAGODA + (DOME - PAGODA).normalized() * 40.0
    ac.add_point(pk, 'Spawn pagoda', (sp.x, sp.y, PLAZA), (PAGODA.x, PAGODA.y, PLAZA + 60))
    # Benches at the plaza's west edge, looking out over the hills towards the city.
    for k in range(2):
        b = PAGODA + Vector((-62.0, 20.0 + k * 14.0))
        ac.add_point(pk, f'Seat plaza-{k}', (b.x, b.y, PLAZA), (b.x - 200, b.y + 300, PLAZA - 20))
    for n, (target, at, toward) in enumerate((('dome', sp + Vector((14.0, -8.0)), sd), ('pagoda', sd + Vector((12.0, 10.0)), sp))):
        at = Vector(at)
        d = (Vector(toward) - at).normalized()
        g = kit.moon_gate(f'Moon gate {n}', c['Gates'])
        g.matrix_world = Matrix.Translation((at.x, at.y, PLAZA)) @ Matrix.Rotation(math.atan2(-d.x, d.y), 4, 'Z')
        ac.add_point(pk, f'Gate {target}@{n}', (at.x, at.y, PLAZA), (at.x + d.x * 10, at.y + d.y * 10, PLAZA))

    scene['origin_wgs84'] = list(A.meta['origin_wgs84'])
    scene['base_z'] = A.base
    ac.lookdev(scene, sun_az=140, sun_el=40)
    cams = {
        'plaza': ac.camera(scene, 'Cam plaza', (s0.x, s0.y, PLAZA + 1.7), (DOME.x + 30, DOME.y, PLAZA + 25), 28),
        'pagoda': ac.camera(scene, 'Cam pagoda', (sp.x + 20, sp.y + 30, PLAZA + 1.7), (PAGODA.x, PAGODA.y, PLAZA + 45), 28),
        'aerial': ac.camera(scene, 'Cam aerial', (-380.0, -520.0, PLAZA + 260), (0, -60, PLAZA + 20), 30),
    }
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print('BUILD', {'plaza': PLAZA, 'pagoda_h': round(h, 1), 'trees': trees + rows, 'blocks': blocks, 'objects': len(bpy.data.objects)}, flush=True)
    if RENDER:
        ac.render_views(scene, cams, RENDERS, 'lookdev')


main()
