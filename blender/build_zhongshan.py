"""Build the Zhongshan vertical slice (Mausoleum axis + Music Stage) and render look-dev views.

    D:/soft/blender/blender.exe -b --factory-startup --python blender/build_zhongshan.py

Inputs: research/zhongshan/data/terrain.npy + terrain.json (tools/research/zhongshan-terrain.py)
and the OSM-derived figures in research/zhongshan/FACTS.md.
Outputs: art-src/zhongshan.blend (ignored; this script regenerates it) and
design/zhongshan/lookdev-*.jpg.

Local frame: metres, origin at the Bo'ai arch's ground (DSM 87.8 m), X east, Y north, Z up.
The Mausoleum is built in an *axis frame* (u across, s along the axis) and rotated 3.12 degrees
west of north to match the OSM stair lines and hall footprint.
"""
import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import kit  # noqa: E402
import zhongshan_meiling as ml  # noqa: E402
import zhongshan_xiaoling as xl  # noqa: E402

DATA = ROOT / 'research' / 'zhongshan' / 'data'
OUT_BLEND = ROOT / 'art-src' / 'zhongshan.blend'
OUT_RENDERS = ROOT / 'design' / 'zhongshan'
RENDER = '--no-render' not in sys.argv

BASE_Z = 87.8                       # DSM height at the Bo'ai arch
AXIS_ANGLE = math.radians(3.12)     # axis bearing, west of north (hall centre -33.8, 620.9)
ROT = Matrix.Rotation(AXIS_ANGLE, 4, 'Z')
ROT_INV = Matrix.Rotation(-AXIS_ANGLE, 4, 'Z')

# Axis profile (s = distance along the axis from the arch). Heights follow the DSM cross-check:
# 71 m arch -> hall. The avenue climbs gently, the great stair takes the rest.
S_PLAZA_END = 22.0
S_AVENUE_END = 352.0
Z_AVENUE_END = 18.0
S_GATE_PLATFORM = (360.0, 392.0)
Z_GATE = 20.0
S_GATE = 384.0
S_COURT = (415.0, 437.0)
Z_COURT = 24.0
S_STELE = 426.0
S_STAIR = (437.0, 594.0)
Z_HALL = 71.0
S_HALL = 621.0
S_TERRACE_END = 652.0

# Music Stage (OSM way 141915419): chord midpoint and the direction the seats face.
MUSIC_CENTER = Vector((147.0, -176.0))
MUSIC_FACING = math.radians(28.0)   # seats lie N28E of the stage
Z_MUSIC = 64.9 - BASE_Z
MUSIC_R = 50.0

rnd = random.Random(1932)
LANDINGS = []   # (s, z) of each great-stair landing, filled by build_axis; cameras and spawns use it


def axis_profile(s):
    """Designed ground height on the axis centre line."""
    if s < S_PLAZA_END:
        return 0.0
    if s < S_AVENUE_END:
        t = (s - S_PLAZA_END) / (S_AVENUE_END - S_PLAZA_END)
        return Z_AVENUE_END * (t * t * (3 - 2 * t) * 0.35 + t * 0.65)
    if s < S_GATE_PLATFORM[0]:
        return Z_AVENUE_END + (Z_GATE - Z_AVENUE_END) * (s - S_AVENUE_END) / (S_GATE_PLATFORM[0] - S_AVENUE_END)
    if s < S_GATE_PLATFORM[1] + 6:
        return Z_GATE
    if s < S_COURT[0]:
        return Z_GATE + (Z_COURT - Z_GATE) * (s - S_GATE_PLATFORM[1] - 6) / (S_COURT[0] - S_GATE_PLATFORM[1] - 6)
    if s < S_STAIR[0]:
        return Z_COURT
    if s < S_STAIR[1]:
        return Z_COURT + (Z_HALL - Z_COURT) * (s - S_STAIR[0]) / (S_STAIR[1] - S_STAIR[0])
    return Z_HALL


def axis_half_width(s):
    if s < S_PLAZA_END:
        return 46.0
    if s < S_AVENUE_END:
        return 30.0
    if s < S_COURT[1]:
        return 34.0
    if s < S_STAIR[1]:
        return 26.0
    return 40.0


def to_axis(x, y):
    v = ROT_INV @ Vector((x, y, 0))
    return v.x, v.y


def from_axis(u, s, z=0.0):
    return ROT @ Vector((u, s, z))


def smoothstep(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)


# --- Scene ----------------------------------------------------------------------------------------

def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = 'METRIC'
    return scene


def collection(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or bpy.context.scene.collection).children.link(c)
    return c


# --- Terrain --------------------------------------------------------------------------------------

def load_dem():
    z = np.load(DATA / 'terrain.npy')
    meta = json.loads((DATA / 'terrain.json').read_text(encoding='utf-8'))
    ext = meta['extent_local_m']
    rows, cols = z.shape

    def sample(x, y):
        c = (x - ext['x_west']) / (ext['x_east'] - ext['x_west']) * (cols - 1)
        r = (ext['y_north'] - y) / (ext['y_north'] - ext['y_south']) * (rows - 1)
        c = min(max(c, 0), cols - 1.001)
        r = min(max(r, 0), rows - 1.001)
        i, j = int(r), int(c)
        fr, fc = r - i, c - j
        q = z[i:i + 2, j:j + 2]
        return float(q[0, 0] * (1 - fr) * (1 - fc) + q[0, 1] * (1 - fr) * fc
                     + q[1, 0] * fr * (1 - fc) + q[1, 1] * fr * fc) - BASE_Z
    return sample


def designed_ground(x, y, dem):
    """Bare-earth estimate with the axis, plazas and the Music Stage bowl graded in.

    Returns (height, open_weight). open_weight is 1 on paved/graded ground, 0 in forest; the
    forest floor drops ~11 m below the DSM because Copernicus measures the canopy top there.
    """
    raw = dem(x, y)
    u, s = to_axis(x, y)
    w_axis = 0.0
    z_axis = 0.0
    if -90 < s < S_TERRACE_END + 30:
        hw = axis_half_width(min(max(s, 0), S_TERRACE_END))
        w_across = 1 - smoothstep(hw, hw + 22, abs(u))
        w_along = smoothstep(-90, -62, s) * (1 - smoothstep(S_TERRACE_END, S_TERRACE_END + 30, s))
        w_axis = w_across * w_along
        z_axis = axis_profile(min(max(s, 0), S_TERRACE_END))
        # Sink the ground under built stone so lawn never pokes through paving or steps; the stair,
        # landings and terraces are solid down to their own base, so nothing shows the gap.
        z_axis -= 0.6
        if S_GATE_PLATFORM[0] - 10 < s < S_TERRACE_END and abs(u) < 34:
            z_axis -= 2.0
        # Side ground beside the stair rises with it, a touch higher, so the stair sits in a cut.
        if S_STAIR[0] < s < S_STAIR[1] and abs(u) > 24:
            z_axis += 1.2
    # Music Stage bowl: stage level at the chord, seats terraced up to the rim.
    d = Vector((x, y)) - MUSIC_CENTER
    r = d.length
    w_music = 1 - smoothstep(MUSIC_R + 6, MUSIC_R + 26, r)
    # Sunk 0.8 m below the built rings so the pool, lawn terraces and walks are never buried.
    z_music = Z_MUSIC + max(0.0, r - 16) * 0.16 - (0.8 if r < MUSIC_R + 4 else 0.0)
    forest_floor = raw - 11.0
    # Blend: open ground follows the design, forest follows DSM minus canopy.
    z = forest_floor
    open_w = 0.0
    if w_music > 0:
        z = z * (1 - w_music) + z_music * w_music
        open_w = max(open_w, w_music)
    if w_axis > 0:
        z = z * (1 - w_axis) + z_axis * w_axis
        open_w = max(open_w, w_axis)
    return z, open_w


def build_terrain(coll, dem, x_range=(-420, 520), y_range=(-360, 820), step=4.0, fn=None, name='Terrain'):
    fn = fn or (lambda x, y: designed_ground(x, y, dem))
    nx = int((x_range[1] - x_range[0]) / step) + 1
    ny = int((y_range[1] - y_range[0]) / step) + 1
    bm = bmesh.new()
    heights = {}
    verts = []
    for j in range(ny):
        row = []
        y = y_range[0] + j * step
        for i in range(nx):
            x = x_range[0] + i * step
            z, w = fn(x, y)
            # Tiny noise keeps forest floor from looking ironed (deterministic).
            z += (math.sin(x * 0.11) * math.cos(y * 0.13) + math.sin((x + y) * 0.07)) * 0.6 * (1 - w)
            row.append(bm.verts.new((x, y, z)))
            heights[(i, j)] = (z, w)
        verts.append(row)
    lawn, floor = 0, 1
    for j in range(ny - 1):
        for i in range(nx - 1):
            f = bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
            w = (heights[(i, j)][1] + heights[(i + 1, j + 1)][1]) / 2
            f.material_index = lawn if w > 0.5 else floor
    o = kit.mesh_object(name, bm, coll, ['lawn', 'forest_floor'])
    for p in o.data.polygons:
        p.use_smooth = True

    def ground(x, y):
        z, _ = designed_ground(x, y, dem)
        return z
    return o, ground


# Detailed terrain patches (x range, y range): the Mausoleum/Music Stage slice and Meiling.
INNERS = (((-420, 520), (-360, 820)), ml.PATCH, xl.PATCH)


def in_inner(x, y, margin):
    return any(ix0 + margin < x < ix1 - margin and iy0 + margin < y < iy1 - margin for (ix0, ix1), (iy0, iy1) in INNERS)


def build_outer_terrain(coll, dem, step=24.0):
    """Coarse apron over the rest of the DEM tile crop, so the paraglide descent and long views
    never reach the edge of the world. Purple Mountain's ridge (DSM ~440 m) rises behind the hall.
    Quads inside the detailed terrain are skipped; the apron sits 1.5 m lower at the seam so the
    detailed mesh always wins."""
    meta = json.loads((DATA / 'terrain.json').read_text(encoding='utf-8'))['extent_local_m']
    x0, x1 = meta['x_west'] + step, meta['x_east'] - step
    y0, y1 = meta['y_south'] + step, meta['y_north'] - step
    nx, ny = int((x1 - x0) / step) + 1, int((y1 - y0) / step) + 1
    bm = bmesh.new()
    grid = []
    for j in range(ny):
        y = y0 + j * step
        row = []
        for i in range(nx):
            x = x0 + i * step
            inside = in_inner(x, y, 12)
            row.append(bm.verts.new((x, y, dem(x, y) - 11.0 - (1.5 if inside else 0.0))))
        grid.append(row)
    for j in range(ny - 1):
        for i in range(nx - 1):
            xa, ya = x0 + i * step, y0 + j * step
            if all(in_inner(px, py, step) for px, py in ((xa, ya), (xa + step, ya), (xa, ya + step), (xa + step, ya + step))):
                continue
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    o = kit.mesh_object('Terrain outer', bm, coll, ['forest_floor'])
    for p in o.data.polygons:
        p.use_smooth = True
    return o, (x0, x1, y0, y1)


def scatter_far_canopy(dem, protos, trees, extent, spacing=26.0):
    """One soft crown per ~26 m outside the detailed area: reads as continuous forest from the air."""
    x0, x1, y0, y1 = extent
    n = 0
    y = y0
    while y < y1:
        x = x0
        while x < x1:
            px, py = x + rnd.uniform(-9, 9), y + rnd.uniform(-9, 9)
            if not in_inner(px, py, -10):
                kit.place(protos['far'], trees, (px, py, dem(px, py) - 12.0), rnd.uniform(0, 6.28), rnd.uniform(1.6, 2.6))
                n += 1
            x += spacing
        y += spacing
    return n


# --- Mausoleum axis -------------------------------------------------------------------------------

def build_boai_arch(bm, M):
    """博爱坊: three bays, four posts rising through the roofs, 17.3 m wide, 11 m tall."""
    W = 17.3
    posts = [-W / 2 + 0.6, -2.9, 2.9, W / 2 - 0.6]
    for x in posts:
        kit.add_box(bm, (x, 0, 5.5), (1.1, 1.1, 11.0), mi=0, matrix=M)
        kit.add_box(bm, (x, 0, 0.6), (1.8, 1.8, 1.2), mi=0, matrix=M)   # plinth
        kit.add_box(bm, (x, 0, 11.3), (1.3, 1.3, 0.6), mi=0, matrix=M)  # cloud cap
    # Lintels and frieze: centre bay higher.
    kit.add_box(bm, (0, 0, 7.6), (5.8, 0.9, 1.6), mi=0, matrix=M)
    kit.add_box(bm, (0, 0, 8.9), (6.6, 0.7, 0.9), mi=2, matrix=M)       # gold inscription board
    for sx in (-1, 1):
        kit.add_box(bm, (sx * 5.8, 0, 6.2), (5.0, 0.9, 1.3), mi=0, matrix=M)


def build_arch_roofs(coll, M):
    objs = [kit.curved_roof('Boai roof centre', coll, (0, 0, 9.4), 3.6, 1.3, 1.2, lift=0.35, thickness=0.25),
            kit.curved_roof('Boai roof west', coll, (-5.8, 0, 7.0), 2.7, 1.2, 1.0, lift=0.3, thickness=0.22),
            kit.curved_roof('Boai roof east', coll, (5.8, 0, 7.0), 2.7, 1.2, 1.0, lift=0.3, thickness=0.22)]
    for o in objs:
        o.matrix_world = M @ o.matrix_world


def place_axis(o, u, s, z):
    o.matrix_world = Matrix.Translation(from_axis(u, s, z)) @ ROT @ o.matrix_world


def build_axis(coll, ground, protos, trees):
    # Material indices for the axis bmesh: 0 granite, 1 paving, 2 gold, 3 opening, 4 hedge, 5 bronze,
    # 6 riser shade
    mats = ['granite', 'paving', 'gold', 'opening', 'hedge', 'bronze', 'paving_joint']
    bm = bmesh.new()
    A = ROT  # axis frame -> world (rotation only; heights are explicit)

    # Plaza in front of the arch and the avenue paving (slabs follow the profile in 6 m pieces).
    for s0 in np.arange(-60, S_AVENUE_END, 6.0):
        s1 = s0 + 6.0
        z0, z1 = axis_profile(max(s0, 0)), axis_profile(max(s1, 0))
        hw = 40.0 if s0 < S_PLAZA_END else 7.0
        zc = (z0 + z1) / 2
        kit.add_box(bm, (0, s0 + 3, zc - 0.4), (2 * hw, 6.05, 0.8 + abs(z1 - z0)), mi=1, matrix=A)
        if s0 >= S_PLAZA_END:
            for sx in (-1, 1):  # side walks either side of the lawn strips
                kit.add_box(bm, (sx * 19.0, s0 + 3, zc - 0.4), (4.0, 6.05, 0.8 + abs(z1 - z0)), mi=1, matrix=A)

    build_boai_arch(bm, Matrix.Translation(from_axis(0, 0, 0)) @ ROT)

    # Steps up to the gate platform and the platform itself (20 granite steps).
    kit.stair_flight(bm, (0, S_AVENUE_END, Z_AVENUE_END), 30.0, 20, (Z_GATE - Z_AVENUE_END) / 20,
                     (S_GATE_PLATFORM[0] - S_AVENUE_END) / 20, mi=0, matrix=A, riser_mi=6)
    kit.add_box(bm, (0, (S_GATE_PLATFORM[0] + S_GATE_PLATFORM[1] + 6) / 2, Z_GATE - 1.5),
                (64.0, S_GATE_PLATFORM[1] + 6 - S_GATE_PLATFORM[0], 3.0), mi=1, matrix=A)

    # Tomb Gate 陵门: 24.6 x 8.4 m (OSM), three round arches, single blue hip roof.
    gz = Z_GATE
    kit.add_box(bm, (0, S_GATE, gz + 5.0), (24.6, 8.4, 10.0), mi=0, matrix=A)
    kit.add_box(bm, (0, S_GATE, gz + 10.4), (25.4, 9.2, 0.8), mi=0, matrix=A)
    for x in (-7.2, 0.0, 7.2):
        kit.arch_panel(bm, (x, S_GATE - 4.25, gz), 4.0 if x == 0 else 3.4, 6.6 if x == 0 else 5.8,
                       depth=0.4, mi=3, matrix=A)
        kit.arch_panel(bm, (x, S_GATE + 4.25, gz), 4.0 if x == 0 else 3.4, 6.6 if x == 0 else 5.8,
                       depth=0.4, mi=3, matrix=A, facing='+Y')
    kit.add_box(bm, (0, S_GATE - 4.3, gz + 8.4), (6.0, 0.3, 1.4), mi=2, matrix=A)   # 天下为公 board
    # Flanking walls with blue coping.
    for sx in (-1, 1):
        kit.add_box(bm, (sx * 31.0, S_GATE, gz + 2.6), (37.0, 2.0, 5.2), mi=0, matrix=A)

    # Steps gate -> court, three flights (OSM ways 1335291478/82/83).
    for u in (-14.0, 0.0, 14.0):
        kit.stair_flight(bm, (u, S_GATE_PLATFORM[1] + 6, Z_GATE), 8.0, 28, (Z_COURT - Z_GATE) / 28,
                         (S_COURT[0] - S_GATE_PLATFORM[1] - 6) / 28, mi=0, matrix=A, riser_mi=6)
    kit.add_box(bm, (0, (S_COURT[0] + S_COURT[1]) / 2, Z_COURT - 1.0), (60.0, S_COURT[1] - S_COURT[0], 2.0),
                mi=1, matrix=A)

    # Stele Pavilion 碑亭: 14 x 12.5 m, arched opening on every side, double eaves.
    sz = Z_COURT
    kit.add_box(bm, (0, S_STELE, sz + 0.5), (16.0, 14.5, 1.0), mi=0, matrix=A)
    kit.add_box(bm, (0, S_STELE, sz + 6.0), (14.0, 12.5, 10.0), mi=0, matrix=A)
    for face in ('-Y', '+Y'):
        kit.arch_panel(bm, (0, S_STELE + (-6.3 if face == '-Y' else 6.3), sz + 1.0), 3.6, 6.0, depth=0.3, mi=3,
                       matrix=A, facing=face)
    kit.add_box(bm, (0, S_STELE, sz + 5.0), (2.0, 0.9, 8.1), mi=0, matrix=A)          # the stele itself

    # The great stair: 339 steps in nine flights, three lanes split by planted bands (OSM: lanes at
    # u = -13.5, 0, +13.5 relative to the axis). The lower flights span the full width.
    n_flights, steps_per = 9, 38
    rise_total = Z_HALL - Z_COURT
    run_total = S_STAIR[1] - S_STAIR[0]
    landing = 3.0
    riser = rise_total / (n_flights * steps_per)
    tread = (run_total - landing * (n_flights - 1)) / (n_flights * steps_per)
    s, z = S_STAIR[0], Z_COURT
    LANDINGS.clear()
    for k in range(n_flights):
        if k < 4:
            lanes = [(0.0, 44.0)]
        else:
            lanes = [(-13.5, 8.0), (0.0, 12.0), (13.5, 8.0)]
        for u, w in lanes:
            kit.stair_flight(bm, (u, s, z), w, steps_per, riser, tread, mi=0, matrix=A, riser_mi=6)
        s += steps_per * tread
        z += steps_per * riser
        flight_end = s
        if k < n_flights - 1:
            kit.add_box(bm, (0, s + landing / 2, z - 0.6), (46.0, landing, 1.2), mi=1, matrix=A)
            LANDINGS.append((s + landing / 2, z))
            s += landing
        # Split flights: a low clipped hedge band between lanes, a balustrade either side of it.
        if k >= 4:
            s0 = flight_end - steps_per * tread
            z0 = z - steps_per * riser
            run, rise = steps_per * tread, steps_per * riser
            for sx in (-1, 1):
                band_u = sx * 7.75
                for q in range(8):
                    t0 = (q + 0.5) / 8
                    kit.add_box(bm, (band_u, s0 + t0 * run, z0 + t0 * rise + 0.25),
                                (2.4, run / 8 + 0.05, 1.0 + rise / 8), mi=4, matrix=A)
                for edge in (-1.6, 1.6):
                    kit.balustrade(bm, (band_u + edge, s0), (band_u + edge, flight_end), z0, z, mi=0,
                                   matrix=A, post_every=3.0, height=0.95)
    # Side balustrades along the whole stair.
    for sx in (-1, 1):
        kit.balustrade(bm, (sx * 22.5, S_STAIR[0]), (sx * 22.5, S_STAIR[1]), Z_COURT, Z_HALL, mi=0, matrix=A,
                       post_every=4.0)
        # Bronze tripods 鼎 on the posts at the top.
        kit.add_box(bm, (sx * 22.5, S_STAIR[1] - 1, Z_HALL + 1.9), (1.4, 1.4, 1.2), mi=5, matrix=A)

    # Hall terrace and the Sacrificial Hall 祭堂 (OSM 27 x 22 m; published 30 x 25 x 29 m).
    hz = Z_HALL
    kit.add_box(bm, (0, (S_STAIR[1] + S_TERRACE_END) / 2, hz - 1.0), (84.0, S_TERRACE_END - S_STAIR[1], 2.0),
                mi=1, matrix=A)
    for sx in (-1, 1):
        kit.balustrade(bm, (sx * 42.0, S_STAIR[1] + 0.5), (sx * 22.5, S_STAIR[1] + 0.5), hz, hz, mi=0, matrix=A)
    HW, HD = 30.0, 25.0
    kit.add_box(bm, (0, S_HALL, hz + 0.8), (HW + 4, HD + 4, 1.6), mi=0, matrix=A)      # plinth
    kit.add_box(bm, (0, S_HALL, hz + 9.0), (HW - 7, HD - 2, 16.0), mi=0, matrix=A)     # recessed core
    for sx in (-1, 1):
        for sy in (-1, 1):  # four corner bastions, taller than the lower eave
            kit.add_box(bm, (sx * (HW / 2 - 3.2), S_HALL + sy * (HD / 2 - 3.2), hz + 10.0), (6.4, 6.4, 18.4),
                        mi=0, matrix=A)
            kit.add_box(bm, (sx * (HW / 2 - 3.2), S_HALL + sy * (HD / 2 - 3.2), hz + 19.4), (6.8, 6.8, 0.6),
                        mi=0, matrix=A)
    core_front = S_HALL - (HD - 2) / 2
    for x, w in ((-5.2, 2.4), (0.0, 3.2), (5.2, 2.4)):
        kit.arch_panel(bm, (x, core_front, hz + 1.6), w, 4.8 if x == 0 else 4.0, depth=0.5, mi=3,
                       matrix=A)
        kit.add_box(bm, (x, core_front - 0.2, hz + 7.4), (w + 1.2, 0.3, 0.9), mi=2, matrix=A)  # 民族/民权/民生
    # Pilaster strips between the doors, as in the photographs.
    for x in (-8.2, -2.6, 2.6, 8.2):
        kit.add_box(bm, (x, core_front - 0.25, hz + 5.2), (0.9, 0.5, 8.6), mi=0, matrix=A)
    kit.add_box(bm, (0, core_front - 0.3, hz + 10.2), (HW - 13.0, 0.6, 1.2), mi=0, matrix=A)  # cornice
    kit.add_box(bm, (0, core_front - 0.4, hz + 16.6), (2.6, 0.3, 2.6), mi=2, matrix=A)        # 天地正气 tablet
    kit.add_box(bm, (0, S_HALL, hz + 18.3), (HW - 12.6, HD - 6.0, 2.6), mi=0, matrix=A)      # bracket frieze

    kit.mesh_object('Mausoleum axis stone', bm, coll, mats)

    # Roofs: gate, stele pavilion (double), hall lower skirt and upper roof.
    place_axis(kit.curved_roof('Tomb Gate roof', coll, (0, 0, 0), 14.6, 6.0, 4.4, lift=0.9, ridge_ratio=0.5),
               0, S_GATE, Z_GATE + 10.8)
    place_axis(kit.curved_roof('Stele roof lower', coll, (0, 0, 0), 9.4, 8.6, 1.8, lift=0.6, thickness=0.3),
               0, S_STELE, Z_COURT + 11.0)
    place_axis(kit.curved_roof('Stele roof upper', coll, (0, 0, 0), 7.6, 6.6, 3.6, lift=0.7, ridge_ratio=0.55, gable=0.45),
               0, S_STELE, Z_COURT + 13.3)
    # Lower eave: a lean-to blue roof across the facade between the bastions, front and back (it
    # reads as a strong band in every photograph). Its upper half is buried in the core.
    for sy, name in ((-1, 'front'), (1, 'back')):
        place_axis(kit.curved_roof(f'Hall lower eave {name}', coll, (0, 0, 0), 10.4, 3.4, 3.0, lift=0.45,
                                   thickness=0.35, ridge_ratio=0.95),
                   0, S_HALL + sy * ((HD - 2) / 2 - 0.4), Z_HALL + 11.2)
    # Upper roof sits on the frieze; its eaves reach out over the bastion caps, as photographed.
    place_axis(kit.curved_roof('Hall upper roof', coll, (0, 0, 0), 14.4, 12.4, 7.4, lift=1.1, ridge_ratio=0.62, gable=0.45,
                               thickness=0.45),
               0, S_HALL, Z_HALL + 20.2)
    place_axis(kit.box('Stele pavilion core cap', (0, 0, 0), (12.0, 10.5, 2.4), coll, 'granite'),
               0, S_STELE, Z_COURT + 12.2)

    # Bo'ai arch roofs.
    build_arch_roofs(coll, Matrix.Translation(from_axis(0, 0, 0)) @ ROT)

    # Avenue planting: lawn strips with cedars in pairs, cypress rows by the stair, hedges.
    for s in np.arange(30.0, S_AVENUE_END - 6, 9.0):
        for sx in (-1, 1):
            for u in (11.5, 25.5):
                p = from_axis(sx * u, s + rnd.uniform(-1, 1), 0)
                kit.place(protos['cedar'], trees, (p.x, p.y, ground(p.x, p.y)), rnd.uniform(0, 6.28),
                          rnd.uniform(0.85, 1.1))
    for s in np.arange(S_STAIR[0] + 4, S_STAIR[1], 7.0):
        for sx in (-1, 1):
            p = from_axis(sx * 28.0, s, 0)
            kit.place(protos['cypress'], trees, (p.x, p.y, ground(p.x, p.y)), 0, rnd.uniform(0.9, 1.2))


# --- Music Stage ----------------------------------------------------------------------------------

def build_music_stage(coll, ground, protos, trees):
    """音乐台: 50 m semicircular bowl, crescent pool, 16.67 x 11.33 m screen wall, rim pergola."""
    mats = ['granite_shade', 'paving', 'lawn', 'water', 'granite', 'vine', 'hedge']
    bm = bmesh.new()
    # Local stage frame: origin at the chord midpoint, +Y toward the seats.
    face = MUSIC_FACING
    M = Matrix.Translation((MUSIC_CENTER.x, MUSIC_CENTER.y, Z_MUSIC)) @ Matrix.Rotation(-face, 4, 'Z')

    def ring_sector(r0, r1, z0, z1, mi, a0=0.0, a1=math.pi, seg=48):
        """Annular half-ring from angle a0..a1 (0 = +X, pi/2 = +Y), solid down to z = -1."""
        vs_top, vs_bot = [], []
        for k in range(seg + 1):
            a = a0 + (a1 - a0) * k / seg
            for r, z in ((r0, z0), (r1, z1)):
                vs_top.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
                vs_bot.append(bm.verts.new((r * math.cos(a), r * math.sin(a), -1.0)))
        faces = []
        for k in range(seg):
            i = 2 * k
            faces.append(bm.faces.new((vs_top[i], vs_top[i + 2], vs_top[i + 3], vs_top[i + 1])))
            faces.append(bm.faces.new((vs_top[i + 1], vs_top[i + 3], vs_bot[i + 3], vs_bot[i + 1])))
            faces.append(bm.faces.new((vs_bot[i], vs_bot[i + 2], vs_top[i + 2], vs_top[i])))
        for f in faces:
            f.material_index = mi
        bmesh.ops.transform(bm, matrix=M, verts=vs_top + vs_bot)

    # Stage platform (scalloped edge approximated by a 9-lobe half disc) and the pool crescent.
    ring_sector(0.0, 11.0, 1.2, 1.2, 1)
    for k in range(9):
        a = math.pi * (k + 0.5) / 9
        c = M @ Vector((11.0 * math.cos(a), 11.0 * math.sin(a), 0.0))
        cyl = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=1.6, radius2=1.6, depth=2.2)
        bmesh.ops.translate(bm, vec=(c.x, c.y, c.z + 0.1), verts=cyl['verts'])
        for f in {f for v in cyl['verts'] for f in v.link_faces}:
            f.material_index = 1
    ring_sector(12.6, 13.6, 0.5, 0.5, 6)                 # hedge ring round the stage
    ring_sector(13.6, 19.0, -0.4, -0.4, 3)               # crescent pool
    ring_sector(19.0, 21.0, 0.3, 0.3, 4)                 # pool kerb walk
    # Seating: four bands of terraced lawn split by paved walks, rising to the rim.
    bands = [(21.0, 29.0), (30.5, 37.5), (39.0, 45.0), (46.5, 50.0)]
    walks = [(29.0, 30.5), (37.5, 39.0), (45.0, 46.5), (50.0, 52.5)]
    z_of = lambda r: max(0.0, r - 16) * 0.16  # noqa: E731  (matches designed_ground)
    for r0, r1 in bands:
        rows = max(2, int((r1 - r0) / 1.6))
        for q in range(rows):
            ra = r0 + (r1 - r0) * q / rows
            rb = r0 + (r1 - r0) * (q + 1) / rows
            ring_sector(ra, rb, z_of(rb), z_of(rb), 2)
    for r0, r1 in walks:
        ring_sector(r0, r1, z_of(r1) + 0.05, z_of(r1) + 0.05, 1)
    # Radial aisles (5) as paved strips over the lawn.
    for k in range(1, 6):
        a = math.pi * k / 6
        for r in np.arange(21.0, 50.0, 2.0):
            c = Vector((r * math.cos(a), r * math.sin(a), z_of(r + 1.0) + 0.08))
            kit.add_box(bm, (0, 0, 0), (1.8, 2.05, 0.12), mi=1,
                        matrix=M @ Matrix.Translation(c) @ Matrix.Rotation(a - math.pi / 2, 4, 'Z'))

    # Screen wall: five panels on a shallow curve behind the stage, stepped crown, pilasters.
    W, H = 16.67, 11.33
    R = 24.0
    for k in range(5):
        x = -W / 2 + W * (k + 0.5) / 5
        a = x / R
        h = H - abs(k - 2) * 1.1
        pos = Vector((R * math.sin(a), -R * (1 - math.cos(a)) - 2.0, 1.2 + h / 2))
        rot = Matrix.Rotation(-a, 4, 'Z')
        kit.add_box(bm, (0, 0, 0), (W / 5 + 0.02, 1.0, h), mi=0, matrix=M @ Matrix.Translation(pos) @ rot)
        kit.add_box(bm, (0, 0, 0), (W / 5 + 0.25, 1.2, 0.5),
                    mi=0, matrix=M @ Matrix.Translation(pos + Vector((0, 0, h / 2 + 0.25))) @ rot)
        for side in (-1, 1):  # pilasters on the face toward the seats (+Y)
            kit.add_box(bm, (side * W / 10, 0.65, 0), (0.7, 0.5, h - 0.4), mi=4,
                        matrix=M @ Matrix.Translation(pos) @ rot)
        kit.add_box(bm, (0, 0.6, -h / 2 + 1.2), (W / 5, 0.4, 0.5), mi=4,
                    matrix=M @ Matrix.Translation(pos) @ rot)          # base course
    # Side pergolas (three bays each side) and the rim colonnade with vines on top.
    for sx in (-1, 1):
        for q in range(4):
            x = sx * (12.0 + q * 3.2)
            for y in (-2.5, 0.5):
                kit.add_box(bm, (x, y, 1.2 + 1.6), (0.45, 0.45, 3.2), mi=4, matrix=M)
        kit.add_box(bm, (sx * 16.8, -1.0, 4.6), (10.8, 4.2, 0.5), mi=5, matrix=M)
    for k in range(0, 41):
        a = math.pi * k / 40
        for r in (51.0, 53.6):
            c = Vector((r * math.cos(a), r * math.sin(a), z_of(53) + 1.6))
            kit.add_box(bm, c, (0.4, 0.4, 3.2), mi=4, matrix=M)
        if k < 40:
            a2 = math.pi * (k + 0.5) / 40
            c = Vector((52.3 * math.cos(a2), 52.3 * math.sin(a2), z_of(53) + 3.4))
            kit.add_box(bm, (0, 0, 0), (3.2, 3.4, 0.45), mi=5,
                        matrix=M @ Matrix.Translation(c) @ Matrix.Rotation(a2 - math.pi / 2, 4, 'Z'))
    kit.mesh_object('Music Stage', bm, coll, mats)

    # Tall cedars behind the screen; autumn canopy around the rim (photo: maple, plane, oak).
    for k in range(26):
        a = math.pi + rnd.uniform(0.15, math.pi - 0.15)
        r = rnd.uniform(18, 40)
        p = M @ Vector((r * math.cos(a), r * math.sin(a), 0))
        kit.place(protos['cedar'], trees, (p.x, p.y, ground(p.x, p.y)), rnd.uniform(0, 6.28), rnd.uniform(1.0, 1.4))
    for k in range(60):
        a = rnd.uniform(-0.25, math.pi + 0.25)
        r = rnd.uniform(58, 80)
        p = M @ Vector((r * math.cos(a), r * math.sin(a), 0))
        proto = protos[rnd.choice(['maple_autumn', 'plane_autumn', 'broadleaf_sun', 'broadleaf'])]
        kit.place(proto, trees, (p.x, p.y, ground(p.x, p.y)), rnd.uniform(0, 6.28), rnd.uniform(0.9, 1.25))


# --- Forest ---------------------------------------------------------------------------------------

def scatter_forest(ground, protos, trees, count=6500, x_range=(-400, 500), y_range=(-340, 800)):
    """Clumped canopy: groves of one kind, so the forest reads as masses of colour, not confetti."""
    kinds = ['broadleaf'] * 5 + ['broadleaf_sun'] * 3 + ['broadleaf_shade'] * 3 + ['cedar'] * 2
    groves = [(rnd.uniform(*x_range), rnd.uniform(*y_range), rnd.choice(kinds)) for _ in range(260)]
    placed = 0
    tries = 0
    while placed < count and tries < count * 6:
        tries += 1
        gx, gy, kind = rnd.choice(groves)
        x, y = gx + rnd.gauss(0, 22), gy + rnd.gauss(0, 22)
        if not (x_range[0] < x < x_range[1] and y_range[0] < y < y_range[1]):
            continue
        u, s = to_axis(x, y)
        if -70 < s < S_TERRACE_END + 12 and abs(u) < axis_half_width(min(max(s, 0), S_TERRACE_END)) + 6:
            continue
        if (Vector((x, y)) - MUSIC_CENTER).length < MUSIC_R + 10:
            continue
        kind_here = kind if rnd.random() < 0.75 else rnd.choice(kinds)
        kit.place(protos[kind_here], trees, (x, y, ground(x, y) - 0.3), rnd.uniform(0, 6.28),
                  rnd.uniform(0.9, 1.45))
        placed += 1
    return placed


# --- Look-dev -------------------------------------------------------------------------------------

def setup_lookdev(scene):
    try:
        scene.render.engine = 'BLENDER_EEVEE'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x, scene.render.resolution_y = 1280, 800
    scene.render.film_transparent = False
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 88
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Punchy'   # painted saturation; AgX base reads washed out
    except TypeError:
        pass
    world = bpy.data.worlds.new('Painted sky')
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = kit.srgb('#62A8E6')
    bg.inputs['Strength'].default_value = 0.85
    # Camera sees the saturated painted sky; the scene is lit by a paler, weaker sky so the blue
    # does not flood every shadow (the web does the same with separate sky and hemisphere colours).
    nt = world.node_tree
    fill = nt.nodes.new('ShaderNodeBackground')
    fill.inputs['Color'].default_value = kit.srgb('#BCD7EE')
    fill.inputs['Strength'].default_value = 0.45
    mix = nt.nodes.new('ShaderNodeMixShader')
    path = nt.nodes.new('ShaderNodeLightPath')
    nt.links.new(path.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(fill.outputs['Background'], mix.inputs[1])
    nt.links.new(bg.outputs['Background'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], nt.nodes['World Output'].inputs['Surface'])
    scene.world = world
    sun = bpy.data.lights.new('Morning sun', 'SUN')
    sun.energy = 5.0
    sun.color = (1.0, 0.95, 0.86)
    sun.angle = math.radians(3)
    so = bpy.data.objects.new('Morning sun', sun)
    # Morning sun from the south-east (the slice faces south): azimuth 125, elevation 38.
    so.rotation_euler = (math.radians(90 - 38), 0, math.radians(125 + 180))
    scene.collection.objects.link(so)


def add_point(coll, name, loc, target):
    """Spawn/seat marker for export_web.py: an empty whose local +Y faces the target."""
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'SINGLE_ARROW'
    e.location = loc
    d = Vector(target) - Vector(loc)
    e.rotation_euler = (0, 0, math.atan2(-d.x, d.y))
    coll.objects.link(e)
    return e


def add_markers(coll, ground):
    """Where visitors arrive and where they can sit. Heights are the walking surface (no eye)."""
    hall_eye = from_axis(0, S_HALL, Z_HALL + 12)
    add_point(coll, 'Spawn axis', from_axis(0, -44, 0), from_axis(0, 120, 9))
    add_point(coll, 'Spawn stair', from_axis(2, LANDINGS[2][0], LANDINGS[2][1]), hall_eye)
    add_point(coll, 'Spawn hall', from_axis(0, S_STAIR[1] + 8, Z_HALL), from_axis(0, -200, 10))
    M = Matrix.Translation((MUSIC_CENTER.x, MUSIC_CENTER.y, Z_MUSIC)) @ Matrix.Rotation(-MUSIC_FACING, 4, 'Z')
    stage = M @ Vector((0, 0, 3))
    add_point(coll, 'Spawn music', M @ Vector((0, 47.7, max(0.0, 47.7 - 16) * 0.16 + 0.05)), stage)
    # Seats on the lawn terraces, mid-band, either side of the radial aisles.
    k = 0
    for r in (24.4, 33.6, 41.8):
        for a_deg in (30, 60, 90, 120, 150):
            a = math.radians(a_deg + 15 * (1 if r > 30 else -1) * 0.5)
            p = M @ Vector((r * math.cos(a), r * math.sin(a), max(0.0, r - 16) * 0.16))
            add_point(coll, f'Seat music-{k:02d}', p, stage)
            k += 1


def build_gates(coll, markers, meiling, xiao=None):
    """Moon gates between the three scenes. Walking up to one offers a glide to its target."""
    M = Matrix.Translation((MUSIC_CENTER.x, MUSIC_CENTER.y, Z_MUSIC)) @ Matrix.Rotation(-MUSIC_FACING, 4, 'Z')
    sp = meiling.spawn_points()
    gates = [
        ('meiling', from_axis(-38, 6, 0), from_axis(-60, 6, 0)),      # west side of the arch plaza
        ('music', from_axis(38, 6, 0), from_axis(60, 6, 0)),          # east side of the arch plaza
        ('axis', M @ Vector((0, 57.5, max(0.0, 57.5 - 16) * 0.16)), M @ Vector((0, 70, 0))),
        ('axis', Vector(sp['gate']), Vector(sp['gate']) + Vector((14, -14, 0))),
    ]
    if xiao is not None:
        # Meiling <-> Ming Xiaoling (the Sacred Way), a short glide west over the hill.
        g = Vector(sp['gate']) + Vector((-58, 0, 0))
        gates.append(('xiaoling', g, g + Vector((-14, 0, 0))))
        s0 = xiao.sacred[len(xiao.sacred) // 3]
        t = (xiao.sacred[len(xiao.sacred) // 3 + 4] - s0).normalized()
        q = s0 - t * 18
        q3 = Vector((q.x, q.y, xiao.ground(q.x, q.y)[0]))
        gates.append(('meiling', q3, q3 - Vector((t.x, t.y, 0)) * 10))
    for n, (target, loc, toward) in enumerate(gates):
        d = (Vector(toward) - Vector(loc)).normalized()
        g = kit.moon_gate(f'Moon gate {n}', coll)
        g.matrix_world = Matrix.Translation(loc) @ Matrix.Rotation(math.atan2(-d.x, d.y), 4, 'Z')
        add_point(markers, f'Gate {target}@{n}', loc, Vector(loc) + d * 10)


def add_meiling_markers(coll, meiling, seats):
    sp = meiling.spawn_points()
    add_point(coll, 'Spawn meiling', sp['front'], sp['palace'])
    add_point(coll, 'Spawn meiling-terrace', sp['terrace'], (sp['terrace'][0], sp['terrace'][1] - 100, sp['terrace'][2]))
    for k, (pos, look) in enumerate(seats):
        add_point(coll, f'Seat meiling-{k}', pos, look)


def camera(scene, name, loc, target, lens=32):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.clip_end = 4000
    o = bpy.data.objects.new(name, cam)
    o.location = loc
    d = Vector(target) - Vector(loc)
    o.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(o)
    return o


def main():
    scene = reset_scene()
    root = collection('Zhongshan')
    c_ground = collection('Ground', root)
    c_axis = collection('Mausoleum axis', root)
    c_music = collection('Music Stage', root)
    c_meiling = collection('Meiling', root)
    c_gates = collection('Gates', root)
    c_xiaoling = collection('Xiaoling', root)
    c_trees = collection('Trees', root)
    c_protos = collection('Prototypes', root)
    protos = kit.tree_prototypes(c_protos)
    dem = load_dem()
    _, ground = build_terrain(c_ground, dem)
    build_axis(c_axis, ground, protos, c_trees)
    build_music_stage(c_music, ground, protos, c_trees)
    n = scatter_forest(ground, protos, c_trees)
    meiling = ml.Meiling(dem, rnd)
    (mx0, mx1), (my0, my1) = ml.PATCH
    build_terrain(c_ground, dem, (mx0, mx1), (my0, my1), fn=meiling.ground, name='Terrain Meiling')
    anchors = json.loads((DATA / 'anchors-local.json').read_text(encoding='utf-8'))
    xiao = xl.Xiaoling(dem, rnd, {'sacred': anchors['xiaoling_sacred'], 'wengzhong': anchors['xiaoling_wengzhong']})
    (qx0, qx1), (qy0, qy1) = xl.PATCH
    build_terrain(c_ground, dem, (qx0, qx1), (qy0, qy1), fn=xiao.ground, name='Terrain Xiaoling')
    _, outer_extent = build_outer_terrain(c_ground, dem)
    # Roads leaving Meiling cross the Xiaoling patch: there they lie on its graded ground.
    outer_height = lambda x, y: (xiao.ground(x, y)[0], 0.12) if xiao.inside(x, y) else (dem(x, y) - 11.0, 1.0)  # noqa: E731
    meiling.build_roads(c_meiling, outer_height)
    meiling.build_palace(c_meiling)
    seats = meiling.benches(c_meiling)
    n_necklace = meiling.plant_necklace(protos, c_trees, outer_height)
    n += meiling.scatter_forest(protos, c_trees)
    xiao.build_paths(c_xiaoling)
    n_statues = xiao.build_statues(c_xiaoling)
    xiao.build_gates_and_precinct(c_xiaoling)
    n += xiao.scatter_trees(protos, c_trees)
    n_far = scatter_far_canopy(dem, protos, c_trees, outer_extent)
    c_markers = collection('Markers', root)
    add_markers(c_markers, ground)
    add_meiling_markers(c_markers, meiling, seats)
    build_gates(c_gates, c_markers, meiling, xiao)
    for name, (p, look) in xiao.spawn_points().items():
        z = xiao.ground(p.x, p.y)[0]
        add_point(c_markers, f'Spawn {name}', (p.x, p.y, z), (look.x, look.y, z + 3))
    setup_lookdev(scene)

    cams = {
        'axis-from-arch': ((from_axis(0, -44, 1.7))[:], (from_axis(0, 120, 9))[:], 35),
        # From a landing a third of the way up, as in the owner's reference photograph.
        'stair-to-hall': ((from_axis(2, LANDINGS[2][0], LANDINGS[2][1] + 1.7))[:],
                          (from_axis(0, S_HALL, Z_HALL + 13))[:], 40),
        'axis-aerial': ((from_axis(0, -140, 190))[:], (from_axis(0, 420, 30))[:], 30),
        'music-aerial': ((MUSIC_CENTER.x - 30, MUSIC_CENTER.y + 110, Z_MUSIC + 70),
                         (MUSIC_CENTER.x, MUSIC_CENTER.y, Z_MUSIC), 28),
        # The necklace from the paraglider's height, and the palace from its forecourt.
        'meiling-aerial': ((ml.PALACE.x + 260, ml.PALACE.y - 380, meiling.pad_z + 230),
                           (ml.PALACE.x - 20, ml.PALACE.y + 40, meiling.pad_z), 30),
        'meiling-front': ((ml.PALACE.x + 8, ml.PALACE.y - 52, meiling.pad_z + 1.7),
                          (ml.PALACE.x, ml.PALACE.y, meiling.pad_z + 9), 32),
        # Ming Xiaoling: the Sacred Way framed like the owner's photographs, and the Ming Tower.
        'xiaoling-sacred': ((xiao.sacred[len(xiao.sacred) // 3] - (xiao.sacred[len(xiao.sacred) // 3 + 4] - xiao.sacred[len(xiao.sacred) // 3]).normalized() * 12).to_3d()
                            + Vector((0, 0, xiao.ground(*xiao.sacred[len(xiao.sacred) // 3])[0] + 1.7)),
                            (xiao.sacred[len(xiao.sacred) // 3 + 10]).to_3d() + Vector((0, 0, xiao.ground(*xiao.sacred[len(xiao.sacred) // 3 + 10])[0] + 2)), 32),
        'xiaoling-tower': ((xl.MING_TOWER - Vector((0, 90))).to_3d() + Vector((0, 0, xiao.tower_z + 2)),
                           xl.MING_TOWER.to_3d() + Vector((0, 0, xiao.tower_z + 18)), 32),
        'music-from-seats': ((Matrix.Translation((MUSIC_CENTER.x, MUSIC_CENTER.y, Z_MUSIC))
                              @ Matrix.Rotation(-MUSIC_FACING, 4, 'Z') @ Vector((6, 34, 4.6)))[:],
                             (MUSIC_CENTER.x, MUSIC_CENTER.y, Z_MUSIC + 4), 30),
    }
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    OUT_RENDERS.mkdir(parents=True, exist_ok=True)
    # Where this world sits on the globe, for the shared skyline (src/landmark-world.js).
    scene['origin_wgs84'] = [32.0587677, 118.8486466]
    scene['base_z'] = BASE_Z
    cam_objs = {k: camera(scene, 'Cam ' + k, *v) for k, v in cams.items()}
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    stats = {'forest_trees': n, 'far_canopy': n_far, 'necklace': n_necklace, 'statues': n_statues, 'trees_total': len(c_trees.objects),
             # Iterate the collections: o.users_collection scans them all, per object (minutes at 24k).
             'triangles_static': sum(sum(len(p.vertices) - 2 for p in o.data.polygons)
                                     for c in (c_ground, c_axis, c_music, c_meiling, c_gates, c_xiaoling) for o in c.objects if o.type == 'MESH')}
    print('BUILD', json.dumps(stats), flush=True)
    if RENDER:
        scene.eevee.taa_render_samples = 32
        for k, o in cam_objs.items():
            scene.camera = o
            scene.render.filepath = str(OUT_RENDERS / f'lookdev-{k}.jpg')
            bpy.ops.render.render(write_still=True)
            print('RENDERED', k, flush=True)


main()
