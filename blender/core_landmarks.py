"""Landmarks of the city core that had no model of their own (the one-by-one pass, 14 Nov 2026):
Jiming Temple and Yuejiang Tower. Until now each was whatever OSM footprints stood there, extruded
as ordinary city blocks: a visitor arriving at "Jiming Temple" found flats, and Lion Hill had no tower.

Each landmark goes in a collection of its own. The export joins a collection into one mesh and stores
positions in 16 bits across its bounds; inside the city-wide meshes a balustrade comes out in 20 cm
steps (blender/core_xuanwu.py, Xuanwu Gate, build 12).

PRECINCTS gives each one's ground as a quad: no OSM or CMAB block, tree or lamp is built inside.
Coordinates are the city's frame (metres east and north of 32.0418 N, 118.7838 E).

Jiming Temple is the North world's temple (blender/build_north.py, research/north/FACTS.md) at its
real place: the stair axis from the gate at the foot (OSM steps way 289362667) to the Yaoshi Pagoda
(OSM way 957807762: seven storeys, eight faces, 44.8 m). The terrace heights and the halls' places
are designed, from the owner's photographs: peach-pink side halls, a dark red main hall, yellow walls.

Yuejiang Tower: OSM way 461035531 on Lion Hill gives the footprint, an L. Built 1999-2001 in Ming
style, 52 m, seven levels of which four show outside, the main tower facing north to the Yangtze with
a wing to its side, red pillars, gold and green glazed roofs (research/nanjing/GAME-FACTS.md;
en.wikipedia.org/wiki/Yuejiang_Tower). Which end of the L the tower stands on, the tiers' sizes and
the podium are our reading of that outline, not measured.

The Drum Tower (鼓楼, 1382) in Gulou Park: OSM way 135290880, 41 x 21.5 m. A tall red masonry base
with three arched passages through it, and on top a two-eaved timber hall rebuilt in the Qing. The
base's 9 m, the hall's size and the grey tiles are read from photographs, not measured; the passages
are drawn shut (dark arches), the base is not walked through.

Mochou Lake's garden on the south shore (15 Nov): the Shengqi pavilion (胜棋楼, OSM way 854879180),
where Zhu Yuanzhang and Xu Da are said to have played chess, white walls and red pillars under grey
upswept double eaves, facing the lake; Yujin Hall (郁金堂, 854879179) on a walled court with a
pond, a rockery and the white statue of Mochou; Huayan Hall (华严庵, 854879181) and the ferry
pavilion (待渡亭, 1026024055). Footprints from OSM; heights, the court's layout and the statue's
place are read from photographs (research/nanjing/BEST-VIEWS.md), not measured.

Toutuo Ridge (头陀岭, 16 Nov), Purple Mountain's second top, where the cable car arrives (OSM node
667283025) and where most visitors stand: the ridge's peak (OSM node 2600783562, 425 m) carries a
viewing platform in three tiers, built in 2017 on steps of about 20 cm (jschina.com.cn, 14 Feb 2017),
its top a rough circle of over 200 m2 with a railing; a grey-white stone gateway with upswept eaves
marks the end of the trail and the cable car (meipian.cn travel notes, on the old Toutuo Temple's
site); the seated bronze Maitreya (OSM node 4386522953) smiles on the ridge among bare boulders.
The places are OSM's; the platform's radii, the gateway's size and place on the path, the statue's
size and which way it faces are our reading of photographs and travel notes, not measured.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import kit
import kit_oldcity as oc

kit.PALETTE.setdefault('roof_gold_glaze', '#D9A23A')
kit.PALETTE.setdefault('drum_red', '#A44A38')     # the Drum Tower's red-washed base
kit.PALETTE.setdefault('marble_white', '#EEEBE2')  # the Mochou statue
kit.PALETTE.setdefault('rock_grey', '#8E8A80')     # Toutuo Ridge's bare boulders

# --- Jiming Temple ---------------------------------------------------------------------------------
J_PAGODA = Vector((576.5, 2369.5))      # OSM way 957807762's centre
J_GATE = Vector((624.0, 2254.0))        # the foot of the temple stair
J_AX = (J_PAGODA - J_GATE).normalized()
J_ACROSS = Vector((J_AX.y, -J_AX.x))


def j_axis(u, s, z=0.0):
    """A point u metres to the right of the temple's axis and s metres up it from the gate."""
    p = J_GATE + J_AX * s + J_ACROSS * u
    return Vector((p.x, p.y, z))


# --- Yuejiang Tower --------------------------------------------------------------------------------
Y_YAW = math.atan2(13.2, 45.9) + math.pi    # the footprint's long side; fronts (local -Y) face north
Y_TOWER = Vector((-4018.0, 6006.0))         # the L's corner, where the outline is deepest
Y_WING = Vector((-3993.0, 6015.0))
Y_MID = Vector((-4008.0, 6009.0))


def _quad(centre, yaw, w, d):
    R = Matrix.Rotation(yaw, 2)
    return [tuple(centre + R @ Vector((sx * w / 2, sy * d / 2))) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]


# --- The Drum Tower --------------------------------------------------------------------------------
D_MID = Vector((-657.6, 2093.0))
D_YAW = math.atan2(26.0, 31.8) + math.pi     # the long side; the front (local -Y) faces south-east, to the square

# --- Mochou Lake's garden ---------------------------------------------------------------------------
M_FOOT = {
    'shengqi': [(-2406.1, -692.3), (-2387.3, -696.7), (-2390.5, -710.0), (-2409.3, -705.6)],
    'yujin': [(-2460.6, -679.6), (-2469.2, -715.0), (-2445.5, -720.6), (-2444.8, -717.7), (-2429.8, -721.3),
              (-2425.1, -701.9), (-2410.9, -705.3), (-2407.8, -692.2)],
    'huayan': [(-2425.2, -742.6), (-2415.5, -745.7), (-2417.5, -751.9), (-2427.2, -748.8)],
    'daidu': [(-2474.7, -723.1), (-2478.1, -733.2), (-2470.9, -735.6), (-2467.4, -725.5)],
}
M_STATUE = Vector((-2437.0, -704.0))     # in Yujin Hall's court (the place is assumed)
M_HALL = Vector((-2455.0, -697.0))       # Yujin Hall, on the court's west side


def _frame(pts, pad=0.0):
    """An outline's oriented box: (centre, yaw of its longest edge, length, depth)."""
    best = max(range(len(pts)), key=lambda i: math.dist(pts[i], pts[(i + 1) % len(pts)]))
    a, b = Vector(pts[best]), Vector(pts[(best + 1) % len(pts)])
    yaw = math.atan2(b.y - a.y, b.x - a.x)
    R = Matrix.Rotation(-yaw, 2)
    loc = [R @ Vector(p) for p in pts]
    x0, x1 = min(p.x for p in loc), max(p.x for p in loc)
    y0, y1 = min(p.y for p in loc), max(p.y for p in loc)
    c = Matrix.Rotation(yaw, 2) @ Vector(((x0 + x1) / 2, (y0 + y1) / 2))
    return c, yaw, x1 - x0 + 2 * pad, y1 - y0 + 2 * pad


def _facing_north(yaw):
    """Of yaw and yaw + pi, the one whose front (local -Y) faces north."""
    return yaw if math.cos(yaw) < 0 else yaw + math.pi

# --- Toutuo Ridge -----------------------------------------------------------------------------------
T_PEAK = Vector((5038.4, 3409.7))        # OSM node 2600783562, Toutuo Ridge, 425 m (the platform: toutuo_ridge)
T_STATION = Vector((5051.4, 3365.6))     # OSM node 667283025, the cable car's top station
T_BUDDHA = Vector((5065.5, 3416.6))      # OSM node 4386522953, the bronze Maitreya
T_TIERS = (13.0, 10.6, 8.4)              # the platform's tiers; the top one ~220 m2
T_RISE = 0.8                             # each tier four 0.2 m steps above the last


PRECINCTS = {
    'JimingTemple': [tuple(j_axis(u, s).xy) for u, s in ((-39, -38), (39, -38), (39, 150), (-39, 150))],
    'YuejiangTower': _quad(Y_MID, Y_YAW, 70.0, 50.0),
    # The podium stair runs down the hillside past the precinct; a tree stood on it (15 Nov).
    'YuejiangTower stair': [(-4040.0, 6016.0), (-4016.0, 6016.0), (-4016.0, 6072.0), (-4040.0, 6072.0)],
    'DrumTower': _quad(D_MID, D_YAW, 49.0, 30.0),
    **{f'MochouGarden {k}': _quad(*_frame(v, 1.5)) for k, v in M_FOOT.items()},
    'ToutuoRidge': [(4992.0, 3345.0), (5092.0, 3345.0), (5092.0, 3442.0), (4992.0, 3442.0)],
}


def inside(x, y):
    """The landmark whose precinct holds (x, y), or None."""
    for name, q in PRECINCTS.items():
        s = [(q[(i + 1) % 4][0] - q[i][0]) * (y - q[i][1]) - (q[(i + 1) % 4][1] - q[i][1]) * (x - q[i][0]) for i in range(4)]
        if all(v >= 0 for v in s) or all(v <= 0 for v in s):
            return name
    return None


def jiming_temple(coll, ground):
    """The temple on its hill. Returns the pagoda's height."""
    z0 = ground(*J_GATE)
    # The pagoda court is the hilltop where the city's ground has one, 11 m up where it has not;
    # the first terrace 6/11 of the way. Each terrace is solid down below the gate's level.
    top = max(z0 + 11.0, ground(*J_PAGODA) + 0.3)
    court = z0 + (top - z0) * 6.0 / 11.0
    yaw = math.atan2(J_AX.y, J_AX.x) - math.pi / 2
    R = Matrix.Rotation(yaw, 4, 'Z')

    def M(u, s, z):
        return Matrix.Translation(j_axis(u, s, z)) @ R

    def slab(w, d, s, level):
        deep = level - z0 + 3.0
        kit.add_box(bm, (0, 0, -deep / 2), (w, d, deep), mi=1, matrix=M(0, s, level))
        kit.add_box(bm, (0, 0, -deep / 2 - 0.05), (w + 0.5, d + 0.5, deep - 0.1), mi=0, matrix=M(0, s, level))   # retaining faces
    bm = bmesh.new()
    mats = ['granite_shade', 'paving', 'temple_ochre', 'vermilion', 'bronze', 'paving_joint', 'tile_dark']
    slab(44, 46, -12, z0)                                                    # forecourt out to the street
    kit.stair_flight(bm, (0, 0, 0), 9.0, 30, (court - z0) / 30, 24 / 30, mi=0, matrix=M(0, 10, z0), riser_mi=5)
    for sx in (-1, 1):
        a, b = j_axis(sx * 4.8, 10), j_axis(sx * 4.8, 34)
        kit.balustrade(bm, (a.x, a.y), (b.x, b.y), z0, court, mi=0, post_every=2.4)
    slab(64, 46, 57, court)
    kit.stair_flight(bm, (0, 0, 0), 8.0, 24, (top - court) / 24, 16 / 24, mi=0, matrix=M(0, 80, court), riser_mi=5)
    for sx in (-1, 1):
        a, b = j_axis(sx * 4.3, 80), j_axis(sx * 4.3, 96)
        kit.balustrade(bm, (a.x, a.y), (b.x, b.y), court, top, mi=0, post_every=2.4)
    slab(56, 48, 120, top)
    # The yellow wall round the compound, tiled along its top: down both sides, and across the front
    # either side of the gateway (the wall the cherry road is photographed against).
    for sx in (-1, 1):
        kit.add_box(bm, (sx * 35, 0, 1.6), (1.0, 150, 3.2), mi=2, matrix=M(0, 66, court - 2))
        kit.add_box(bm, (sx * 35, 0, 3.35), (1.7, 150, 0.3), mi=6, matrix=M(0, 66, court - 2))
        kit.add_box(bm, (sx * 21.5, 0, 1.7), (26.0, 1.0, 3.4), mi=2, matrix=M(0, -9, z0))
        kit.add_box(bm, (sx * 21.5, 0, 3.55), (26.0, 1.7, 0.3), mi=6, matrix=M(0, -9, z0))
    # Incense burner on the first terrace.
    kit.add_box(bm, (0, 0, 1.2), (1.6, 1.6, 2.4), mi=4, matrix=M(0, 46, court))
    kit.add_box(bm, (0, 0, 2.6), (2.4, 2.4, 0.4), mi=4, matrix=M(0, 46, court))
    kit.mesh_object('Jiming terraces', bm, coll, mats)

    # The gate is walked through: a three-bay timber gateway (red posts, grey tile roofs), not a hall.
    gb = bmesh.new()
    for x in (-6.5, -2.4, 2.4, 6.5):
        kit.add_box(gb, (x, 0, 3.2), (0.6, 0.6, 6.4), mi=0, matrix=M(0, 4, z0))
        kit.add_box(gb, (x, 0, 0.3), (1.0, 1.0, 0.6), mi=1, matrix=M(0, 4, z0))
    kit.add_box(gb, (0, 0, 6.2), (14.5, 0.8, 0.8), mi=0, matrix=M(0, 4, z0))
    kit.add_box(gb, (0, 0, 5.3), (4.4, 0.4, 1.0), mi=2, matrix=M(0, 4, z0))
    kit.mesh_object('Jiming gateway', gb, coll, ['vermilion', 'granite_shade', 'gold'])
    for x, w, z in ((0, 3.2, 7.4), (-4.45, 2.6, 6.9), (4.45, 2.6, 6.9)):
        r = kit.curved_roof('Jiming gateway roof', coll, (0, 0, 0), w, 1.5, 1.2, lift=0.4, thickness=0.2,
                            material='tile_dark', ridge_material='tile_dark')
        r.matrix_world = M(x, 4, z0 + z) @ r.matrix_world
    for sx in (-1, 1):
        for k, s in enumerate((44, 64)):
            oc.hall(f'Jiming side hall {sx}{k}', coll, j_axis(sx * 24, s, court), 10, 14, 5.5,
                    walls='temple_peach', yaw=yaw + sx * math.pi / 2, columns=False)
    # The main hall stands 8 m short of the upper stair's foot: at 72 m up the axis (the North world's
    # place) its back met the stair, whose balustrades close its sides, and the pagoda court could not
    # be walked to (tests/lanterns-browser.mjs, 15 Nov).
    oc.hall('Jiming main hall', coll, j_axis(0, 64, court), 22, 13, 7.0, walls='vermilion', yaw=yaw, double=True)
    for sx in (-1, 1):
        oc.hall(f'Jiming court hall {sx}', coll, j_axis(sx * 20, 112, top), 14, 9, 5.0,
                walls='temple_ochre', yaw=yaw + sx * math.pi / 2)
    _, h = oc.pagoda('Yaoshi Pagoda', coll, (J_PAGODA.x, J_PAGODA.y, top), levels=7, r0=5.0, r_top=3.2,
                     level_h=5.0, spire=5.5)
    return h


def yuejiang_tower(coll, ground):
    """The tower on Lion Hill. Returns its height above the podium's foot."""
    R = Matrix.Rotation(Y_YAW, 4, 'Z')
    # The podium's floor clears the hill's highest ground under it (Lion Hill rises 13 m across the
    # footprint) and its walls go down to the lowest.
    R2 = Matrix.Rotation(Y_YAW, 2)
    under = [ground(*(Y_MID + R2 @ Vector((u, v)))) for u in range(-29, 30, 6) for v in range(-19, 20, 6)]
    z0, low = max(under) - 3.0, min(under)

    def M(c, z):
        return Matrix.Translation((c.x, c.y, z)) @ R
    bm = bmesh.new()
    mats = ['granite', 'granite_shade', 'paving', 'paving_joint']
    # The stone podium under both, solid down the hillside, a balustrade round it and the broad
    # stair on the north face up to the tower's doors.
    P = 3.6
    kit.add_box(bm, (0, 0, (P - (z0 - low) - 2.0) / 2), (58, 38, P + (z0 - low) + 2.0), mi=1, matrix=M(Y_MID, z0))
    kit.add_box(bm, (0, 0, P + 0.05), (58, 38, 0.1), mi=2, matrix=M(Y_MID, z0))
    Rm = M(Y_MID, 0.0)
    for (ax, ay), (bx, by) in (((-29, -19), (29, -19)), ((29, -19), (29, 19)), ((29, 19), (-29, 19)), ((-29, 19), (-29, -19))):
        if ay == by == -19:
            # The north side: open for the stair, 14 m wide, in front of the tower.
            tx = (Rm.inverted() @ Vector((Y_TOWER.x, Y_TOWER.y, 0))).x
            for x0, x1 in ((ax, tx - 7), (tx + 7, bx)):
                a, b = Rm @ Vector((x0, ay, 0)), Rm @ Vector((x1, by, 0))
                kit.balustrade(bm, (a.x, a.y), (b.x, b.y), z0 + P, z0 + P, mi=0, post_every=2.4)
            # Down the hillside until it meets the ground in front: to the podium's lowest ground it
            # stopped 2 m above the hill, which falls on northwards (15 Nov: the podium could not be
            # climbed).
            n = 1
            while n < 240:
                foot = Rm @ Vector((tx, -19 - n * 0.34, 0))
                if z0 + P - n * 0.18 <= ground(foot.x, foot.y) + 0.05:
                    break
                n += 1
            kit.stair_flight(bm, (0, 0, 0), 14.0, n, 0.18, 0.34, mi=0,
                             matrix=Rm @ Matrix.Translation((tx, -19 - n * 0.34, z0 + P - n * 0.18)), riser_mi=3)
        else:
            a, b = Rm @ Vector((ax, ay, 0)), Rm @ Vector((bx, by, 0))
            kit.balustrade(bm, (a.x, a.y), (b.x, b.y), z0 + P, z0 + P, mi=0, post_every=2.4)
    kit.mesh_object('Yuejiang podium', bm, coll, mats)

    # The main tower: four tiers stepping back, each a red-pillared storey with a balcony, under
    # gold-glazed roofs edged in green; the top one a double-eaved hip-and-gable roof.
    trim = bmesh.new()
    tiers = ((24.0, 20.0, 8.6), (19.5, 16.0, 8.0), (15.5, 12.5, 7.4), (11.5, 9.5, 7.0))
    z = z0 + P
    for i, (w, d, h) in enumerate(tiers):
        last = i == len(tiers) - 1
        plinth = 0.9 if i == 0 else 0.3
        oc.hall(f'Yuejiang tier {i}', coll, (Y_TOWER.x, Y_TOWER.y, z), w, d, h, walls='vermilion', roof='roof_gold_glaze',
                yaw=Y_YAW, plinth=plinth, double=last, columns=True, lift=1.1, roof_h=3.4 if last else 2.6)
        Mt = M(Y_TOWER, z)
        # Pillars and beam on the other three sides (oc.hall draws the front's), a green bracket band
        # under the eave, and the red balcony rail all round.
        n = max(4, int(w / 3.2))
        for k in range(n + 1):
            kit.add_box(trim, (-w / 2 + w * k / n, d / 2, plinth + h / 2), (0.42, 0.42, h), mi=0, matrix=Mt)
        m = max(3, int(d / 3.2))
        for sx in (-1, 1):
            for k in range(1, m):
                kit.add_box(trim, (sx * w / 2, -d / 2 + d * k / m, plinth + h / 2), (0.42, 0.42, h), mi=0, matrix=Mt)
            kit.add_box(trim, (sx * w / 2, 0, plinth + h - 0.3), (0.5, d + 0.4, 0.6), mi=0, matrix=Mt)
            kit.add_box(trim, (sx * (w / 2 + 0.6), 0, plinth + 1.05), (0.14, d + 1.2, 0.14), mi=0, matrix=Mt)
            kit.add_box(trim, (sx * (w / 2 + 0.6), 0, plinth + 0.5), (0.1, d + 1.2, 0.1), mi=0, matrix=Mt)
        kit.add_box(trim, (0, d / 2, plinth + h - 0.3), (w + 0.4, 0.5, 0.6), mi=0, matrix=Mt)
        for sy in (-1, 1):
            kit.add_box(trim, (0, sy * (d / 2 + 0.6), plinth + 1.05), (w + 1.2, 0.14, 0.14), mi=0, matrix=Mt)
            kit.add_box(trim, (0, sy * (d / 2 + 0.6), plinth + 0.5), (w + 1.2, 0.1, 0.1), mi=0, matrix=Mt)
        kit.add_box(trim, (0, 0, plinth + h + 0.12), (w + 0.9, d + 0.9, 0.5), mi=1, matrix=Mt)
        if i:   # the balcony's floor, on the roof below
            kit.add_box(trim, (0, 0, plinth - 0.1), (w + 1.4, d + 1.4, 0.2), mi=2, matrix=Mt)
        z += plinth + h + (0.0 if last else 2.3)
    z += 1.6 + 3.4       # the top roof's two eaves
    kit.add_box(trim, (0, 0, 0.9), (0.5, 0.5, 1.8), mi=3, matrix=M(Y_TOWER, z))
    kit.add_box(trim, (0, 0, 2.2), (0.9, 0.9, 0.9), mi=3, matrix=M(Y_TOWER, z))
    # The name board over the north doors, as on the real tower (blank: no characters yet).
    kit.add_box(trim, (0, -tiers[0][1] / 2 - 0.5, 0.9 + tiers[0][2] - 1.6), (6.0, 0.2, 1.7), mi=3, matrix=M(Y_TOWER, z0 + P))
    kit.add_box(trim, (0, -tiers[0][1] / 2 - 0.62, 0.9 + tiers[0][2] - 1.6), (5.5, 0.1, 1.3), mi=4, matrix=M(Y_TOWER, z0 + P))
    kit.mesh_object('Yuejiang pillars and rails', trim, coll, ['vermilion', 'roof_green', 'granite', 'gold', 'timber_dark'])
    # The wing: two lower tiers along the L's other arm.
    oc.hall('Yuejiang wing', coll, (Y_WING.x, Y_WING.y, z0 + P), 26.0, 15.0, 7.4, walls='vermilion', roof='roof_gold_glaze',
            yaw=Y_YAW, plinth=0.9, lift=1.0, roof_h=2.8)
    oc.hall('Yuejiang wing upper', coll, (Y_WING.x, Y_WING.y, z0 + P + 0.9 + 7.4 + 2.3), 18.0, 10.0, 6.0, walls='vermilion',
            roof='roof_gold_glaze', yaw=Y_YAW, plinth=0.3, double=True, lift=1.0, roof_h=3.0)
    return z + 2.65 - z0


def drum_tower(coll, ground):
    """The Drum Tower on its mound. Returns its height."""
    R = Matrix.Rotation(D_YAW, 4, 'Z')
    R2 = Matrix.Rotation(D_YAW, 2)
    under = [ground(*(D_MID + R2 @ Vector((u, v)))) for u in range(-20, 21, 5) for v in range(-10, 11, 5)]
    z0, low = max(under), min(under)
    M = Matrix.Translation((D_MID.x, D_MID.y, z0)) @ R
    W, D, H = 41.0, 21.5, 9.0
    bm = bmesh.new()
    mats = ['drum_red', 'granite_shade', 'opening', 'paving', 'granite']
    # The base: battered a little (a second, narrower box on the upper half), on a grey stone plinth
    # that goes down to the mound's lowest ground, a stone coping and a parapet round the terrace.
    kit.add_box(bm, (0, 0, (0.9 - (z0 - low) - 1.0) / 2), (W + 1.2, D + 1.2, 0.9 + (z0 - low) + 1.0), mi=1, matrix=M)
    kit.add_box(bm, (0, 0, 0.9 + (H - 0.9) / 2), (W, D, H - 0.9), mi=0, matrix=M)
    kit.add_box(bm, (0, 0, H + 0.15), (W + 0.6, D + 0.6, 0.3), mi=1, matrix=M)
    kit.add_box(bm, (0, 0, H + 0.33), (W - 1.4, D - 1.4, 0.06), mi=3, matrix=M)
    for sy in (-1, 1):
        kit.add_box(bm, (0, sy * (D / 2 - 0.25), H + 0.85), (W, 0.5, 1.1), mi=0, matrix=M)
    for sx in (-1, 1):
        kit.add_box(bm, (sx * (W / 2 - 0.25), 0, H + 0.85), (0.5, D, 1.1), mi=0, matrix=M)
    # Three arched passages on each long face, the middle one the largest, in stone surrounds.
    for face, facing in ((-1, '-Y'), (1, '+Y')):
        for dx, w, h in ((0.0, 4.6, 6.2), (-11.5, 3.6, 5.2), (11.5, 3.6, 5.2)):
            kit.arch_panel(bm, (dx, face * (D / 2 + 0.05), 0.9), w + 0.9, h + 0.5, depth=0.2, mi=1, matrix=M, facing=facing)
            kit.arch_panel(bm, (dx, face * (D / 2 + 0.16), 0.9), w, h, depth=0.2, mi=2, matrix=M, facing=facing)
    # The stair up the front to the middle passage's sill.
    n = int(round((0.9 + (z0 - low)) / 0.16)) or 1
    kit.stair_flight(bm, (0, 0, 0), 12.0, n, (0.9 + (z0 - low)) / n, 0.34, mi=4,
                     matrix=M @ Matrix.Translation((0, -D / 2 - 0.6 - n * 0.34, 0.9 - n * ((0.9 + (z0 - low)) / n))), riser_mi=1)
    kit.mesh_object('Drum Tower base', bm, coll, mats)
    # The hall on top: red, two eaves, grey tiles, pillars and beam on the back as on the front.
    oc.hall('Drum Tower hall', coll, tuple(M @ Vector((0, 0, H + 0.36))), 27.0, 12.0, 6.6, walls='vermilion', roof='tile_dark',
            yaw=D_YAW, plinth=0.5, double=True, lift=1.0, roof_h=4.2)
    trim = bmesh.new()
    for k in range(9):
        kit.add_box(trim, (-13.5 + 27.0 * k / 8, 6.0, H + 0.36 + 0.5 + 3.3), (0.42, 0.42, 6.6), mi=0, matrix=M)
    kit.add_box(trim, (0, 6.0, H + 0.36 + 0.5 + 6.3), (27.4, 0.5, 0.6), mi=0, matrix=M)
    # The name board under the upper eave, blank.
    kit.add_box(trim, (0, -6.5, H + 0.36 + 0.5 + 6.6 + 0.9), (3.6, 0.2, 1.3), mi=1, matrix=M)
    kit.mesh_object('Drum Tower pillars', trim, coll, ['vermilion', 'timber_dark'])
    return H + 0.36 + 0.5 + 6.6 + 1.6 + 4.2


def _ring(bm, centre, z, r, h, mi, seg=24):
    c = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=h)
    bmesh.ops.translate(bm, vec=(centre.x, centre.y, z + h / 2), verts=c['verts'])
    for f in {f for v in c['verts'] for f in v.link_faces}:
        f.material_index = mi


def mochou_garden(coll, ground):
    """The garden's buildings on Mochou Lake's south shore. Returns the number of buildings."""
    def at(c):
        return ground(c.x, c.y)
    c, yaw, w, d = _frame(M_FOOT['shengqi'])
    oc.hall('Shengqi pavilion', coll, (c.x, c.y, at(c)), w, d, 5.6, walls='whitewash', roof='tile_dark',
            yaw=_facing_north(yaw), double=True, plinth=0.9, lift=1.1, roof_h=4.0)
    # Yujin Hall faces east into its court; a white wall with a tiled coping closes the court's
    # other sides, open in the middle of each long side.
    _, yaw, _, _ = _frame(M_FOOT['yujin'])
    oc.hall('Yujin Hall', coll, (M_HALL.x, M_HALL.y, at(M_HALL)), 16.0, 9.0, 4.6, walls='whitewash', roof='tile_dark',
            yaw=yaw - math.pi / 2, plinth=0.6, lift=0.9)
    bm = bmesh.new()
    mats = ['whitewash', 'tile_dark', 'water', 'granite_shade', 'marble_white']
    pts = M_FOOT['yujin']
    for i in range(len(pts)):
        a, b = Vector(pts[i]), Vector(pts[(i + 1) % len(pts)])
        L = (b - a).length
        if L < 1.0 or ((a + b) / 2 - M_HALL).length < 9.0:
            continue
        t = (b - a) / L
        R = Matrix.Rotation(math.atan2(t.y, t.x), 4, 'Z')
        for s0, s1 in ([(0.0, L / 2 - 1.6), (L / 2 + 1.6, L)] if L > 14 else [(0.0, L)]):
            p = a + t * ((s0 + s1) / 2)
            M = Matrix.Translation((p.x, p.y, ground(p.x, p.y))) @ R
            kit.add_box(bm, (0, 0, 0.7), (s1 - s0, 0.45, 3.4), mi=0, matrix=M)
            kit.add_box(bm, (0, 0, 2.5), (s1 - s0 + 0.2, 0.9, 0.22), mi=1, matrix=M)
    z = at(M_STATUE)
    _ring(bm, M_STATUE, z - 0.2, 5.2, 0.45, 3)         # the pond's stone rim
    _ring(bm, M_STATUE, z - 0.2, 4.7, 0.5, 2)          # its water, standing a little above the rim's floor
    for dx, dy, r, h in ((0, 0, 1.6, 1.3), (1.2, -0.6, 1.0, 0.9), (-1.1, 0.7, 0.9, 1.0), (0.3, 1.3, 0.8, 0.6)):
        sph = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((M_STATUE.x + dx, M_STATUE.y + dy, z + 0.35 + h / 2))
                            @ Matrix.Diagonal((r, r * 0.85, h, 1)), verts=sph['verts'])
        for f in {f for v in sph['verts'] for f in v.link_faces}:
            f.material_index = 3
    # Mochou: a young woman in a long robe on the rockery, about 3 m tall with her hair up.
    top = z + 0.35 + 1.3
    robe = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.55, radius2=0.22, depth=2.2)
    bmesh.ops.translate(bm, vec=(M_STATUE.x, M_STATUE.y, top + 1.1), verts=robe['verts'])
    parts = list(robe['verts'])
    for cx, cy, cz, r in ((0, 0, top + 2.35, (0.21, 0.19, 0.24)), (0, -0.05, top + 2.62, (0.14, 0.14, 0.12)),
                          (0.3, 0.1, top + 1.85, (0.12, 0.12, 0.38)), (-0.28, 0.12, top + 1.6, (0.12, 0.12, 0.45))):
        sph = bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=1.0)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((M_STATUE.x + cx, M_STATUE.y + cy, cz)) @ Matrix.Diagonal((*r, 1)),
                            verts=sph['verts'])
        parts += sph['verts']
    for f in {f for v in parts for f in v.link_faces}:
        f.material_index = 4
    kit.mesh_object('Mochou court and statue', bm, coll, mats)
    c, yaw, w, d = _frame(M_FOOT['huayan'])
    oc.hall('Huayan Hall', coll, (c.x, c.y, at(c)), w, d, 4.0, walls='whitewash', roof='tile_dark',
            yaw=_facing_north(yaw), plinth=0.5)
    # The ferry pavilion: four red posts under a pyramid roof, open on every side.
    c, yaw, w, d = _frame(M_FOOT['daidu'])
    pb = bmesh.new()
    M = Matrix.Translation((c.x, c.y, at(c))) @ Matrix.Rotation(yaw, 4, 'Z')
    kit.add_box(pb, (0, 0, 0.25), (w, d, 0.5), mi=1, matrix=M)
    for sx in (-1, 1):
        for sy in (-1, 1):
            kit.add_box(pb, (sx * (w / 2 - 0.6), sy * (d / 2 - 0.6), 2.0), (0.3, 0.3, 3.0), mi=0, matrix=M)
    kit.mesh_object('Ferry pavilion posts', pb, coll, ['vermilion', 'granite_shade'])
    r = kit.curved_roof('Ferry pavilion roof', coll, (0, 0, 0), w / 2 + 1.0, d / 2 + 1.0, 2.2, ridge_ratio=0.05, lift=0.7,
                        thickness=0.25, material='tile_dark', ridge_material='tile_dark')
    r.matrix_world = M @ Matrix.Translation((0, 0, 3.5)) @ r.matrix_world
    return 5


def toutuo_ridge(coll, ground, over):
    """The viewing platform, the stone gateway, the Maitreya and the boulders on Toutuo Ridge.
    The gateway's lintels and roofs go in `over`, which the walk grid's ray cast leaves out, so the
    path runs under them. Returns the platform top's height."""
    # The platform stands on the built hilltop: the terrain lifts each surveyed peak from the highest
    # ground within 40 m of its node (blender/build_core.py, SUMMITS), here about 20 m south of it, so
    # a platform on the node itself stood on the slope, 9 m of hillside under its 13 m radius.
    P = max((T_PEAK + Vector((dx, dy)) for dx in range(-30, 31, 3) for dy in range(-30, 31, 3) if dx * dx + dy * dy <= 900),
            key=lambda q: ground(q.x, q.y))
    gate = T_STATION.lerp(P, 0.35)
    # The platform: three round tiers on the peak, solid down into the hill. The stair climbs from
    # the south, the side the gateway and the cable car are on.
    south = (gate - P).normalized()
    yaw = math.atan2(south.y, south.x) + math.pi / 2       # local -Y toward the gateway
    Rm = Matrix.Translation((P.x, P.y, 0)) @ Matrix.Rotation(yaw, 4, 'Z')
    ring = [Vector((math.cos(a) * T_TIERS[0], math.sin(a) * T_TIERS[0])) for a in [k * math.tau / 24 for k in range(24)]]
    under = [ground(*(P + v)) for v in ring] + [ground(*P)]
    z1 = max(max(under) + 0.2, ground(*(P + south * T_TIERS[0])) + 0.6)
    low = min(under) - 1.0
    bm = bmesh.new()
    mats = ['granite', 'granite_shade', 'paving']
    tops = []
    for k, r in enumerate(T_TIERS):
        top = z1 + k * T_RISE
        tops.append(top)
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=r, radius2=r, depth=top - low)
        bmesh.ops.translate(bm, vec=(P.x, P.y, (top + low) / 2), verts=c['verts'])
        for f in {f for v in c['verts'] for f in v.link_faces}:
            f.normal_update()
            f.material_index = 2 if f.normal.z > 0.5 else 1
    # Four steps from each tier to the next, on the south axis; from the hill to the first tier,
    # as many as reach the ground there.
    for k in (1, 2):
        kit.stair_flight(bm, (0, 0, 0), 3.2, 4, 0.2, 0.34, mi=2, riser_mi=1,
                         matrix=Rm @ Matrix.Translation((0, -T_TIERS[k] - 4 * 0.34, tops[k - 1])))
    n = 1
    while n < 40:
        foot = Rm @ Vector((0, -T_TIERS[0] - n * 0.34, 0))
        if z1 - n * 0.2 <= ground(foot.x, foot.y) + 0.05:
            break
        n += 1
    kit.stair_flight(bm, (0, 0, 0), 3.2, n, 0.2, 0.34, mi=2, riser_mi=1,
                     matrix=Rm @ Matrix.Translation((0, -T_TIERS[0] - n * 0.34, z1 - n * 0.2)))
    # A railing round each tier's edge, open where the stair arrives.
    for k, r in enumerate(T_TIERS):
        gap = math.asin(min(1.0, 1.9 / r))
        a0, a1 = -math.pi / 2 + gap, 1.5 * math.pi - gap      # local angles, -Y (the stair) left open
        m = max(6, int((a1 - a0) * r / 2.4))
        pts = [Rm @ Vector((math.cos(a0 + (a1 - a0) * q / m) * (r - 0.25), math.sin(a0 + (a1 - a0) * q / m) * (r - 0.25), 0))
               for q in range(m + 1)]
        for a, b in zip(pts, pts[1:]):
            kit.balustrade(bm, (a.x, a.y), (b.x, b.y), tops[k], tops[k], mi=0, post_every=2.4)
    kit.mesh_object('Toutuo platform', bm, coll, mats)

    # The stone gateway: three bays, grey-white stone, upswept stone roofs; open along the path.
    g = gate
    zg = ground(*g)
    G = Matrix.Translation((g.x, g.y, zg)) @ Matrix.Rotation(yaw, 4, 'Z')
    gb = bmesh.new()
    for x in (-5.0, -1.9, 1.9, 5.0):
        kit.add_box(gb, (x, 0, 0.4), (1.2, 1.2, 0.8), mi=1, matrix=G)            # the post's foot
        kit.add_box(gb, (x, 0, 3.4), (0.7, 0.7, 6.8), mi=0, matrix=G)
    kit.mesh_object('Toutuo gateway', gb, coll, ['granite', 'granite_shade'])
    ob = bmesh.new()
    kit.add_box(ob, (0, 0, 5.5), (3.8, 0.6, 0.5), mi=0, matrix=G)                # lintels
    kit.add_box(ob, (0, 0, 6.3), (11.0, 0.7, 0.6), mi=0, matrix=G)
    kit.add_box(ob, (0, -0.33, 5.9), (2.4, 0.08, 0.5), mi=1, matrix=G)           # the name panel
    kit.mesh_object('Toutuo gateway lintels', ob, over, ['granite', 'granite_shade'])
    for x, w, z in ((0.0, 2.5, 7.1), (-3.45, 1.9, 6.7), (3.45, 1.9, 6.7)):
        r = kit.curved_roof('Toutuo gateway roof', over, (0, 0, 0), w, 1.0, 0.9, lift=0.4, thickness=0.2,
                            material='granite', ridge_material='granite_shade')
        r.matrix_world = G @ Matrix.Translation((x, 0, z)) @ r.matrix_world

    # The Maitreya: seated, broad and round, laughing, on a stone pedestal, facing south over the
    # city (assumed). About 6 m with the pedestal.
    zb = ground(*T_BUDDHA)
    B = Matrix.Translation((T_BUDDHA.x, T_BUDDHA.y, zb)) @ Matrix.Rotation(math.pi, 4, 'Z')
    bb = bmesh.new()
    kit.add_box(bb, (0, 0, 0.6), (5.2, 4.2, 1.2), mi=1, matrix=B)
    kit.add_box(bb, (0, 0, 1.3), (4.6, 3.6, 0.2), mi=1, matrix=B)
    for (cx, cy, cz), r in (((0, 0.2, 2.1), (2.1, 1.5, 0.75)),        # crossed legs, wide
                            ((0, 0.05, 3.1), (1.45, 1.15, 1.35)),     # the round belly and chest
                            ((0, -0.05, 3.95), (1.25, 0.95, 0.55)),   # shoulders
                            ((0, 0.0, 4.85), (0.72, 0.68, 0.78)),     # head, clear of the shoulders
                            ((-2.05, 0.1, 2.05), (0.85, 0.75, 0.75)), # the cloth bag, at his side
                            ((1.35, 0.35, 2.6), (0.45, 0.6, 0.45)),   # hand on the knee
                            ((-1.5, 0.2, 2.75), (0.45, 0.5, 0.45))):  # hand on the bag
        sph = bmesh.ops.create_uvsphere(bb, u_segments=14, v_segments=8, radius=1.0)
        bmesh.ops.transform(bb, matrix=B @ Matrix.Translation((cx, cy, cz)) @ Matrix.Diagonal((*r, 1)), verts=sph['verts'])
        for f in {f for v in sph['verts'] for f in v.link_faces}:
            f.material_index = 0
    kit.mesh_object('Toutuo Maitreya', bb, coll, ['bronze', 'granite_shade'])

    # Bare boulders round the peak.
    rb = bmesh.new()
    for a, d, r, h in ((0.3, 16, 1.6, 1.1), (1.2, 18, 1.2, 0.9), (2.4, 15.5, 2.0, 1.3), (3.0, 19, 1.0, 0.7),
                       (4.1, 17, 1.5, 1.0), (5.5, 16.5, 1.3, 0.8)):
        p = P + Vector((math.cos(a), math.sin(a))) * d
        sph = bmesh.ops.create_icosphere(rb, subdivisions=1, radius=1.0)
        bmesh.ops.transform(rb, matrix=Matrix.Translation((p.x, p.y, ground(*p) + h * 0.35)) @ Matrix.Rotation(a, 4, 'Z')
                            @ Matrix.Diagonal((r, r * 0.8, h, 1)), verts=sph['verts'])
    kit.mesh_object('Toutuo boulders', rb, coll, ['rock_grey'])
    return tops[-1]
