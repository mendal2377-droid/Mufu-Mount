"""Tiny Nanjing, the city core: Xinjiekou, Zhongshan Road, the Presidential Palace, Jiming and Xuanwu.

    D:/soft/blender/blender.exe -b --factory-startup --python blender/build_core.py [-- --no-render]

Built the way Tiny Warsaw builds Warsaw (design/DETAIL-AND-TRANSPORT-PLAN.md): every OSM building and
building part is extruded from its outline (heights from OSM `height`/`min_height`/levels, else
estimated from type and footprint), and the windows, floors and shop fronts are drawn later by a
shader. Wall UVs carry metres along the wall and metres above the ground; vertex colours carry
the wall and roof colours (OSM `building:colour`/`roof:colour`, else a palette by district and a
per-building hash). Roads are ribbons whose UVs carry metres along and across, so a shader paints
the lanes. Plane trees line the avenues and OSM tree rows; parks are scattered. The Presidential
Palace is the hero model from build_palace.py, appended at its geographic origin.
Where OSM maps no buildings, CMAB's rooftops traced from satellite imagery stand instead; park and
forest trees stand where Meta and WRI's canopy map has trees (design/CMAB-CANOPY-PLAN.md).
Assumptions: estimated heights where OSM has none (from use and footprint), colours where OSM has
none, road widths by class, plane-tree spacing, the bare ground (the DSM's 150 m minimum).
"""
import colorsys
import hashlib
import json
import math
import random
import sys
from collections import Counter
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import area_common as ac  # noqa: E402
import kit  # noqa: E402
import kit_oldcity as oc  # noqa: E402
import core_xuanwu as xw  # noqa: E402
import mufu_merge as mm  # noqa: E402
import zhongshan_merge as zm  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT_BLEND = ROOT / 'art-src' / 'core.blend'
RENDERS = ROOT / 'design' / 'core'
RENDER = '--no-render' not in sys.argv
rnd = random.Random(1912)

A = ac.Area('core')
F = A.feats
kit.PALETTE.update({
    'facade': '#FFFFFF', 'roof_city': '#FFFFFF',          # colours come from the vertices
    'road_city': '#55585A', 'sidewalk': '#B3AC9E', 'city_paving': '#8F9488', 'pitch': '#7FA05A',
    'plane_leaf': '#86A84A',
})
X0, X1, Y0, Y1 = A.extent
# The landscape around the map, terrain only (Purple Mountain, Mufu Mountain), in the core's heights.
FAR = ac.Area('core_far')


def far_z(x, y):
    return FAR.bare_at(x, y) + FAR.base - A.base - (8.0 if FAR.bare_at(x, y) + FAR.base - A.base > 30 else 0.0)  # canopy off the hills

# --- Ground and water -------------------------------------------------------------------------------
def clip_rect(poly, x0, x1, y0, y1):
    """Sutherland–Hodgman: the part of a polygon inside a rectangle."""
    def cut(pts, inside, cross):
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cross(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cross(prev, cur))
        return out

    def at_x(x):
        return lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))

    def at_y(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y)
    pts = list(poly[:-1] if poly[0] == poly[-1] else poly)
    for inside, cross in ((lambda p: p[0] >= x0, at_x(x0)), (lambda p: p[0] <= x1, at_x(x1)),
                          (lambda p: p[1] >= y0, at_y(y0)), (lambda p: p[1] <= y1, at_y(y1))):
        if len(pts) < 3:
            return pts
        pts = cut(pts, inside, cross)
    return pts


# Water areas clipped to the map: the Yangtze's OSM outline runs 86 km downstream, and the whole
# ring split into slivers that left the river by Mufu Mountain without a surface (city-audit).
lakes = [w['pts'] if all(X0 - 300 < x < X1 + 300 and Y0 - 300 < y < Y1 + 300 for x, y in w['pts'])
         else clip_rect(w['pts'], X0 - 300, X1 + 300, Y0 - 300, Y1 + 300) for w in F['water']]
# A water area wholly off the map keeps its index as a speck far outside it.
lakes = [w if len(w) >= 3 else [(X1 + 900, Y1 + 900), (X1 + 901, Y1 + 900), (X1 + 900, Y1 + 901)] for w in lakes]


def big_river(w):
    """The Yangtze and Jiajiang: kilometres across the map (their banks are wharves and dikes)."""
    return max(x for x, _ in w) - min(x for x, _ in w) > 4000 or max(y for _, y in w) - min(y for _, y in w) > 4000
# Rivers and canals mapped only as centrelines (the inner Qinhuai's 运渎, the Pearl River) become
# channels: the line buffered to its OSM width, else a typical width for its kind. Stretches already
# inside a water polygon are left alone (tests/city-audit.py found these missing).
RIVER_WIDTH = {'river': 14.0, 'canal': 10.0, 'stream': 4.0}
CHANNELS = {}                  # index in lakes -> (left bank, right bank), drawn as a strip
_poly_mask = ac.Mask(lakes, A.extent, 4.0)
for w in F['ways']:
    kind = w.get('tags', {}).get('waterway')
    if w.get('kind') != 'waterway' or kind not in RIVER_WIDTH or len(w['pts']) < 2:
        continue
    # Culverts run under the streets (21 OSM waterway lines, the Jinchuan River's among them):
    # drawn open they ran under buildings (tools/scene-audit.py).
    if w['tags'].get('tunnel') or w['tags'].get('layer', '0').startswith('-'):
        continue
    try:
        width = float(str(w.get('tags', {}).get('width', '')).split()[0])
    except (ValueError, IndexError):
        width = RIVER_WIDTH[kind]
    # Only the stretches outside mapped water: the Yangwu moat (杨吴城濠) is a polygon in parts and a
    # line between them, and skipping whole lines left 30 m+ gaps in it.
    pts, wet_pt = w['pts'], [_poly_mask.at(*p) for p in w['pts']]
    runs, run = [], []
    for k in range(len(pts) - 1):
        if not (wet_pt[k] and wet_pt[k + 1]):
            run = run or [pts[k]]
            run.append(pts[k + 1])
        elif run:
            runs.append(run)
            run = []
    if run:
        runs.append(run)
    for run in runs:
        left, right = ac.polyline_offset(run, width / 2), ac.polyline_offset(run, -width / 2)
        CHANNELS[len(lakes)] = (left, right)
        lakes.append([(v.x, v.y) for v in left] + [(v.x, v.y) for v in reversed(right)])


_house_mask = ac.Mask([b['pts'] for b in F['buildings']], A.extent, 2.0)


def water_shapes(k):
    """The polygons that make up lakes[k]: a channel is its strip of quads, never its outline,
    which self-intersects at bends. Where a mapped building stands on the line the river is
    culverted under it, tagged or not (tools/scene-audit.py found channels under Xiaguan's houses)."""
    if k not in CHANNELS:
        return [lakes[k]]
    left, right = CHANNELS[k]
    quads = [[(a.x, a.y), (b.x, b.y), (d.x, d.y), (e.x, e.y)] for a, b, d, e in zip(left, left[1:], right[1:], right)]
    def probes(q):
        # The river's own line (start, middle, end of the strip), not its banks: houses line the
        # canals, and testing the banks culverted open water beside them.
        (a, b, d, e) = q
        return [((a[0] + e[0]) / 2, (a[1] + e[1]) / 2), ((b[0] + d[0]) / 2, (b[1] + d[1]) / 2),
                (sum(p[0] for p in q) / 4, sum(p[1] for p in q) / 4)]
    return [q for q in quads if not any(_house_mask.at(*p) for p in probes(q))]


water_mask = ac.Mask([q for k in range(len(lakes)) for q in water_shapes(k)], A.extent, 4.0)
# Each water body's level, from the bare ground on its banks; the bed is always below it (a
# pond's bed once came out above its own surface, from the noisy bare-ground estimate).
water_level = np.full(water_mask.m.shape, np.inf, dtype=np.float32)
LAKE_LEVELS = []
for k, w in enumerate(lakes):
    level = min(A.bare_at(x, y) for x, y in w[::max(1, len(w) // 400)]) - 0.4
    LAKE_LEVELS.append(level)
    m = ac.Mask(water_shapes(k), A.extent, 4.0).m
    water_level[m] = np.minimum(water_level[m], level)
island_mask = ac.Mask([w['pts'] for w in F['islands']], A.extent, 4.0)
GREEN = {'grass', 'park', 'garden', 'wood', 'flowerbed', 'meadow', 'village_green', 'recreation_ground', 'cemetery', 'scrub', 'forest'}
greens = [p['pts'] for p in F['places'] if p.get('pts') and (p['tags'].get('landuse') in GREEN or p['tags'].get('leisure') in GREEN
                                                            or p['tags'].get('natural') in GREEN)]
green_mask = ac.Mask(greens, A.extent, 4.0)
pitches = [p['pts'] for p in F['places'] if p.get('pts') and p['tags'].get('leisure') == 'pitch']


def wet(x, y):
    return water_mask.at(x, y) and not island_mask.at(x, y)


def dry(x, y, r=3.0):
    """No water within r: a trunk on the very edge stood in the water cells the boat uses."""
    return not any(wet(x + dx, y + dy) for dx, dy in ((0, 0), (r, 0), (-r, 0), (0, r), (0, -r)))


# Purple Mountain's forest (OSM relation 16455205, inside the Zhongshan Scenic Area). The bare-ground
# estimate's 150 m minimum, there to strip buildings off the streets, would shave its summits by
# 50-60 m (Purple Mountain 388 m, not 448). There, the surface model less a thin canopy, which on
# 1 Nov sat 6-12 m under OSM's surveyed peaks (design/PURPLE-MOUNTAIN-PLAN.md).
MOUNTAIN_WOODS = (16455205,)
_mountain = [p['pts'] for p in F['places'] if p['id'] in MOUNTAIN_WOODS and p.get('pts')]
MOUNTAIN = ac.Mask(_mountain, A.extent, 8.0) if _mountain else None
# Tree canopy (Meta and WRI, 1 m, CC BY 4.0), on the core's 4 m grid: tools/research/canopy-prep.py.
_canopy_meta = json.loads((A.data / 'canopy.json').read_text(encoding='utf-8')) if (A.data / 'canopy.json').exists() else None
if _canopy_meta:
    _cz = np.load(A.data / 'canopy.npz')
    _ccover, _cheight = _cz['cover'], _cz['height']
    # The canopy's mean height over a 28 m window, about one Copernicus cell: what its surface model
    # stands above the forest floor there (open ground counts as 0).
    _surf = np.pad(_cheight.astype(np.float32) * (_ccover / 255.0), 3, mode='edge')
    _cs = np.pad(_surf.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    _cmean = (_cs[7:, 7:] - _cs[:-7, 7:] - _cs[7:, :-7] + _cs[:-7, :-7]) / 49.0


def _canopy_cell(x, y):
    e = _canopy_meta['extent_local_m']
    return int((y - e['y_south']) // 4.0), int((x - e['x_west']) // 4.0)


def canopy_at(x, y):
    """(share of the cell under canopy over 3 m, the tallest canopy within 4 m) at (x, y); (0, 0) outside."""
    if not _canopy_meta:
        return 0.0, 0.0
    j, i = _canopy_cell(x, y)
    if not (1 <= j < _ccover.shape[0] - 1 and 1 <= i < _ccover.shape[1] - 1):
        return 0.0, 0.0
    return _ccover[j, i] / 255.0, float(_cheight[j - 1:j + 2, i - 1:i + 2].max())


def canopy_mean(x, y, default=4.0):
    if not _canopy_meta:
        return default
    j, i = _canopy_cell(x, y)
    return float(_cmean[j, i]) if 0 <= j < _cmean.shape[0] and 0 <= i < _cmean.shape[1] else default


def mountain_floor(x, y):
    """The forest floor under Purple Mountain: the surface model less the canopy measured there
    (until 3 Nov a flat 4 m; the canopy map has 8-13 m trees on the slopes, 6 m on the ridges)."""
    return max(A.bare_at(x, y), A.dsm_at(x, y) - canopy_mean(x, y))


# The 30 m cells round the sharpest tops off further: on 3 Nov Toutuo Ridge was built at 411 m
# against its surveyed 425. Each OSM peak with an ele on the mountain lifts the ground to that
# height, fading out over SUMMIT_R (a cosine). The lift is measured from the highest ground within
# 40 m of the mapped point, not the point itself: Tianbao's top lies off its node, and lifting from
# the node put it 14 m over its surveyed 250 m.
SUMMIT_R = 250.0
SUMMITS = []
for _p in F['places'] if MOUNTAIN is not None else ():
    _t = _p.get('tags', {})
    if _t.get('natural') != 'peak' or 'ele' not in _t or not _p.get('p') or not MOUNTAIN.at(*_p['p']):
        continue
    try:
        _top = max(mountain_floor(_p['p'][0] + dx, _p['p'][1] + dy) for dx in range(-40, 41, 8) for dy in range(-40, 41, 8) if dx * dx + dy * dy <= 1600)
        _lift = float(str(_t['ele']).split()[0]) - A.base - _top
    except ValueError:
        continue
    if _lift > 0:
        SUMMITS.append((_p['p'][0], _p['p'][1], _lift))
print('SUMMITS', [(round(x), round(y), round(l, 1)) for x, y, l in SUMMITS])
# The Zhongshan world on the mountain (blender/zhongshan_merge.py): its patches are appended in
# the build; round them the city's ground eases to the world's own forest-floor rule.
ZS = zm.ZhongshanMerge(A.meta['origin_wgs84'], A.base) if MOUNTAIN is not None else None


def zground(x, y):
    if ZS is not None:
        h = ZS.height(x, y)
        if h is not None:
            return h
    if MOUNTAIN is not None and MOUNTAIN.at(x, y):
        z = mountain_floor(x, y)
        for sx, sy, lift in SUMMITS:
            d = math.hypot(x - sx, y - sy)
            if d < SUMMIT_R:
                z += lift * 0.5 * (1 + math.cos(math.pi * d / SUMMIT_R))
    else:
        z = A.bare_at(x, y)
    return ZS.blend(x, y, z, A.dsm_at(x, y)) if ZS is not None else z


# Detailed ground over the centre (Xinjiekou to Gulou and the Palace), 12 m; coarser, 24 m, out to
# the river, sunk 2 m under the centre's.
CORE_PATCH = ((-1500.0, 2100.0), (-1530.0, 3400.0))
_SURFACE = {}


def in_core(x, y, margin=6.0):
    return CORE_PATCH[0][0] + margin < x < CORE_PATCH[0][1] - margin and CORE_PATCH[1][0] + margin < y < CORE_PATCH[1][1] - margin


def outer_vertex(x, y):
    z, mi = ground(x, y, 24.0)
    return (z - 2.0, mi) if in_core(x, y) else (z, mi)


def terrain_top(x, y, s, ox, oy, fn):
    """The higher of a terrain_patch quad's two triangulations at (x, y): its rendered surface."""
    i, j = math.floor((x - ox) / s), math.floor((y - oy) / s)
    u, v = (x - ox) / s - i, (y - oy) / s - j

    def at(a, b):
        k = (s, i + a, j + b)
        if k not in _SURFACE:
            _SURFACE[k] = fn(ox + k[1] * s, oy + k[2] * s)[0]
        return _SURFACE[k]
    z00, z10, z01, z11 = at(0, 0), at(1, 0), at(0, 1), at(1, 1)
    a = z00 + u * (z10 - z00) + v * (z11 - z10) if u >= v else z00 + v * (z01 - z00) + u * (z11 - z01)
    b = z00 + u * (z10 - z00) + v * (z01 - z00) if u + v <= 1 else z11 + (1 - u) * (z01 - z11) + (1 - v) * (z10 - z11)
    return max(a, b)


def road_z(x, y):
    """A road's height: zground, but never under the rendered terrain. A 12-24 m terrain cell
    spans a dip in zground as a chord, and a road laid at zground lay under it: Yongji Avenue's
    last 10 m before the Mufu model, buried under the station square, and the bike stopped there
    (tests/mufu-journey-browser.mjs). On Purple Mountain zground also follows the forest floor's
    metre-scale bumps, which the 24 m terrain smooths away: a road at zground rode up to 3 m over
    the ground on both sides, and the bike, clipping a corner of a slanting road's 4 m cells, fell
    off it (tests/zhongshan-journey-browser.mjs). There the road lies at most 0.8 m over the
    terrain. On and by the Zhongshan patches the world's own ground is the surface: zground."""
    z = zground(x, y)
    if ZS is not None and ZS.distance(x, y) < 30.0:
        return z
    t = terrain_top(x, y, 24.0, X0 + 24, Y0 + 24, outer_vertex)
    if in_core(x, y, 0.0):
        t = max(t, terrain_top(x, y, 12.0, CORE_PATCH[0][0], CORE_PATCH[1][0], lambda x, y: ground(x, y, 12.0)))
    if MOUNTAIN is not None and MOUNTAIN.at(x, y):
        return max(t, min(z, t + 0.8))
    return max(t, z)


WATER = {}


def river_strips(name, coll, ring, z, holes, cell=8.0, extra=None):
    """Water as row strips over a polygon's scanline fill (islands left dry); extra: more cells."""
    m = ac.Mask([ring], A.extent, cell).m.copy()
    if holes:
        m &= ~ac.Mask(holes, A.extent, cell).m
    if extra is not None:
        m |= extra
    bm = bmesh.new()
    x0, y0 = A.extent[0], A.extent[2]
    for j in range(m.shape[0]):
        row = m[j]
        if not row.any():
            continue
        edges = np.flatnonzero(np.diff(np.r_[0, row.astype(np.int8), 0]))
        ya, yb = y0 + (j - .5) * cell, y0 + (j + .5) * cell
        for a, b in zip(edges[0::2], edges[1::2]):
            xa, xb = x0 + (a - .5) * cell, x0 + (b - .5) * cell
            bm.faces.new([bm.verts.new((xa, ya, z)), bm.verts.new((xb, ya, z)), bm.verts.new((xb, yb, z)), bm.verts.new((xa, yb, z))])
    return kit.mesh_object(name, bm, coll, ['water'])


MUFU = {'zone': None, 'heights': None, 'shallows': None, 'river_k': None}


def ground(x, y, step=4.0):
    """(z, material) of the terrain grid at (x, y). The grid is 12-24 m, wider than many canals, so
    a vertex within one step of water drops just under the water's level as a stone bank: else the
    terrain between a dry vertex and a wet one rose through the surface (tests/city-audit.py found
    a quarter of the moats and the inner Qinhuai covered by lawn and paving)."""
    # Under the Zhongshan world's patches the city's ground keeps out of sight: well inside, 2.5 m
    # down; within one terrain step of the edge only a little, or its 24 m cells dipped a trench
    # along the patch's border.
    if ZS is not None and (h := ZS.height(x, y)) is not None:
        return h - (2.5 if ZS.inside(x, y, step + 6.0) else 0.6), 0
    # Under the merged Mufu model the city's ground keeps out of sight, just below it.
    if MUFU['zone'] is not None and MUFU['zone'].at(x, y):
        h = MUFU['heights'].at(x, y)
        if h is not None:
            return min(zground(x, y), h - 2.5), 0
        if not wet(x, y):
            # Round a pond the model's faces are cut back: the city's ground fills the gap at the
            # forest's own height, or the pond sat in a pit (tests/city-audit.py banks).
            near = [q for d in (6, 12, 24) for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d))
                    if (q := MUFU['heights'].at(x + dx, y + dy)) is not None]
            if near:
                return min(near) - 0.2, 0
    i, j = int(round((x - water_mask.x0) / water_mask.cell)), int(round((y - water_mask.y0) / water_mask.cell))
    if wet(x, y):
        level = water_level[j, i] if 0 <= i < water_mask.nx and 0 <= j < water_mask.ny else np.inf
        return min(zground(x, y) - 3.0, level - 1.5), 3
    if island_mask.at(x, y):
        # Islands stand clear of their lake: the bare-ground estimate put Xuanwu's isles under it.
        r = int(math.ceil(60.0 / water_mask.cell))
        near = water_level[max(0, j - r):j + r + 1, max(0, i - r):i + r + 1]
        if near.size and np.isfinite(near).any():
            return max(zground(x, y), float(near[np.isfinite(near)].max()) + 0.6), land(x, y)
        return zground(x, y), land(x, y)
    if step > water_mask.cell:
        r = int(math.ceil(step / water_mask.cell))
        near = water_level[max(0, j - r):j + r + 1, max(0, i - r):i + r + 1]
        if near.size and np.isfinite(near).any():
            return min(zground(x, y), float(near.min()) - 0.2), 3
    return zground(x, y), land(x, y)


def land(x, y):
    """Terrain material: 2 forest floor on Purple Mountain (under a closed canopy, not lawn), 0 lawn
    in green spaces, 1 city paving."""
    if MOUNTAIN is not None and MOUNTAIN.at(x, y):
        return 2
    return 0 if green_mask.at(x, y) else 1


# --- Buildings --------------------------------------------------------------------------------------
NAMED = {'white': '#EEEBE4', 'grey': '#A9A9A4', 'gray': '#A9A9A4', 'red': '#B5523B', 'blue': '#6F8FB0', 'brown': '#8F663E',
         'yellow': '#E2C76A', 'beige': '#D9C7A6', 'black': '#3A3A3A', 'green': '#6A9D37'}
WALLS = ['#E8DFC8', '#EEEBE4', '#D5D2C8', '#D9C7A6', '#D8B69A', '#E6D59A', '#C9CDC8', '#E1CFB8']
ROOFS = ['#B9B7AE', '#A9AAA3', '#C4C0B4', '#8FA0A6', '#9A9C96']
INFILL_WALLS = ['#EEEBE4', '#E8E2D2', '#DEDBD2', '#E8DFC8', '#D5D2C8', '#E4D9C2', '#D9C7A6', '#EEEBE4']


def colour(v, fallback):
    if not v:
        return fallback
    v = v.strip().lower()
    v = NAMED.get(v, v)
    if v.startswith('#') and len(v) in (4, 7):
        if len(v) == 4:
            v = '#' + ''.join(ch * 2 for ch in v[1:])
        try:
            return v if int(v[1:], 16) >= 0 else fallback
        except ValueError:
            return fallback
    return fallback


def lin(hexstr):
    return kit.srgb(hexstr)


def num(v):
    try:
        return float(str(v).split()[0].replace('m', ''))
    except (ValueError, TypeError, IndexError):
        return None


def area(pts):
    return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))


def estimate_height(t, a):
    kind = t.get('building') or ''
    if kind in ('apartments', 'residential', 'dormitory'):
        return 21.0 if a > 250 else 15.0
    if kind in ('commercial', 'office', 'hospital', 'hotel', 'retail'):
        return 30.0 if a > 1200 else 20.0
    if kind in ('school', 'university', 'public', 'civic', 'government'):
        return 16.0
    if kind in ('train_station', 'transportation'):
        return 14.0
    if a < 120:
        return 6.5           # old one- and two-storey houses
    if a < 500:
        return 12.0
    return 18.0


# CMAB (Zhang et al., Scientific Data 2025, CC BY 4.0; tools/research/cmab-prep.py): rooftops traced
# from satellite imagery, each with a use label and a height and year estimated by machine learning.
# Measured against the heights OSM's mappers tagged (tests/cmab-check.py, design/CMAB-CANOPY-PLAN.md),
# its heights are no better than a constant (median 8.4 m off, correlation 0.07) and its years are
# mostly a filler (1985), so neither is used. Its use labels are: in estimate_height in place of
# OSM's bare building=yes, the median error falls from 7.0 m to 4.7 m. Its rooftops replace the
# made-up infill.
CMAB_KIND = {'Residence': 'residential', 'Business': 'commercial', 'Office': 'office', 'Public service': 'public',
             'Industry': 'industrial', 'Other': ''}
CMAB = json.loads((A.data / 'cmab.json').read_text(encoding='utf-8'))['buildings'] if (A.data / 'cmab.json').exists() else []
CMAB_C = [(sum(p[0] for p in b[3]) / len(b[3]), sum(p[1] for p in b[3]) / len(b[3])) for b in CMAB]
_CMAB_G = 50.0
_cmab_grid = {}
for _k, _b in enumerate(CMAB):
    _xs, _ys = [p[0] for p in _b[3]], [p[1] for p in _b[3]]
    for _i in range(int(min(_xs) // _CMAB_G), int(max(_xs) // _CMAB_G) + 1):
        for _j in range(int(min(_ys) // _CMAB_G), int(max(_ys) // _CMAB_G) + 1):
            _cmab_grid.setdefault((_i, _j), []).append(_k)
CMAB_STATS = Counter()


def cmab_hits(pts):
    """The CMAB rooftops matching an outline: the outline's centre on the rooftop, or the rooftop's
    centre inside the outline (OSM maps blocks CMAB splits, and the reverse)."""
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    cx, cy = sum(xs) / len(xs), sum(ys) / len(ys)
    near = {k for i in range(int(min(xs) // _CMAB_G), int(max(xs) // _CMAB_G) + 1)
            for j in range(int(min(ys) // _CMAB_G), int(max(ys) // _CMAB_G) + 1) for k in _cmab_grid.get((i, j), ())}
    return [k for k in near if ac.point_in_poly(cx, cy, CMAB[k][3]) or ac.point_in_poly(*CMAB_C[k], pts)]


def cmab_kind(pts, a):
    """The use label of the CMAB rooftop closest in size to this outline, as an OSM building kind ('' if none)."""
    hits = cmab_hits(pts)
    if not hits:
        return ''
    k = min(hits, key=lambda k: abs(math.log(max(abs(area(CMAB[k][3])), 1.0) / max(a, 1.0))))
    return CMAB_KIND.get(CMAB[k][1], '')


# Districts from OSM land use (the owner, 1 November: the old residential compounds round Wutang
# Square are not the offices of Xinjiekou): residential, commercial and retail, industrial; and
# the frontage of the avenues, where ground floors are shops.
def _landuse(*kinds):
    return ac.Mask([p['pts'] for p in F['places'] if p.get('pts') and p['tags'].get('landuse') in kinds], A.extent, 8.0)


RESIDENTIAL, COMMERCIAL, INDUSTRIAL = _landuse('residential'), _landuse('commercial', 'retail'), _landuse('industrial')
_front = []
for _w in F['ways']:
    if _w.get('kind') in ('trunk', 'primary', 'secondary', 'tertiary') and len(_w['pts']) > 1:
        _l, _r = ac.polyline_offset(_w['pts'], 28.0), ac.polyline_offset(_w['pts'], -28.0)
        _front.append([(v.x, v.y) for v in _l] + [(v.x, v.y) for v in reversed(_r)])
FRONTAGE = ac.Mask(_front, A.extent, 8.0)

# Window style per building, read by the façade shader from the vertex alpha:
#   0    flats with shops on the ground floor (on an avenue)
#   .08  flats without shops (inside a compound)
#   .18  old walk-up flats (residential land, up to 8 floors): balconies, air conditioners
#   .26  old walk-up flats with shops below (on an avenue)
#   .35  office glass (commercial land, office and shop tags, towers)
#   .7   old low houses
#   1    blank (stations, halls, sheds)
def style(t, h, x=None, y=None):
    kind = t.get('building') or ''
    if kind in ('train_station', 'transportation', 'warehouse', 'industrial', 'temple', 'church'):
        return 1.0
    if h > 40 or kind in ('commercial', 'office', 'hotel', 'retail'):
        return 0.35
    if h < 8:
        return 0.7
    front = x is not None and FRONTAGE.at(x, y)
    if x is not None and COMMERCIAL.at(x, y) and h > 14:
        return 0.35
    if x is not None and INDUSTRIAL.at(x, y) and kind in ('', 'yes') and h < 16:
        return 1.0
    homes = kind in ('apartments', 'residential', 'dormitory', 'house') or x is not None and RESIDENTIAL.at(x, y)
    if homes and h <= 27:
        return 0.26 if front else 0.18
    return 0.0 if front else 0.08


# Old walk-ups: the faded render and tile of 1980s-90s compounds (cream, pale pink, grey, pale
# yellow, grimy white): an assumption from photographs, stated in the provenance.
WALKUP_WALLS = ['#D9CDB4', '#D7B8AA', '#B7B4AC', '#D8C99A', '#CFCBC0', '#C9B8A0', '#DCD3C2']


def hashf(s, k=0):
    return int(hashlib.md5(f'{s}:{k}'.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


# Set in main(): OSM buildings built another way (the wall's gates, Xuanwu Park's halls), short
# tunnels that are gate passages through the wall (drawn as streets), and the park's foot bridges
# (built as decks, not ribbons).
SKIP_BUILDINGS, THROUGH, DECKED = set(), set(), set()


def build_buildings(coll, skip, over):
    """Extrude every building and part. Outlines that contain parts are dropped (OSM's 3D
    convention: the parts describe the building, the outline is only its footprint)."""
    parts = [b for b in F['buildings'] if b['tags'].get('building:part')]
    part_c = [(sum(p[0] for p in b['pts']) / len(b['pts']), sum(p[1] for p in b['pts']) / len(b['pts'])) for b in parts]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    col = bm.loops.layers.color.new('Col')
    obm = bmesh.new()
    ob = (obm, obm.loops.layers.uv.new('UVMap'), obm.loops.layers.color.new('Col'))
    n = tris = 0
    for b in F['buildings']:
        t = b['tags']
        # Underground buildings (metro stations, layer < 0) stood on Zhongshan Road's carriageway;
        # construction sites are plots, not buildings, and several are mapped over roads.
        if (num(t.get('layer')) or 0) < 0 or t.get('building') == 'construction' or b['id'] in SKIP_BUILDINGS:
            continue
        pts = b['pts'][:-1] if b['pts'][0] == b['pts'][-1] else list(b['pts'])
        if len(pts) < 3:
            continue
        cx, cy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        if skip(cx, cy) or not (X0 + 30 < cx < X1 - 30 and Y0 + 30 < cy < Y1 - 30):
            continue
        a = area(pts)
        if abs(a) < 12:
            continue
        if a < 0:
            pts = pts[::-1]
        if not t.get('building:part'):
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            if any(min(xs) < px < max(xs) and min(ys) < py < max(ys) and ac.point_in_poly(px, py, pts) for px, py in part_c):
                continue
        h = num(t.get('height')) or (num(t.get('building:levels')) or 0) * 3.3
        if not h:
            # No mapped height: the rule, told what the building is by CMAB where OSM says only "yes".
            kind = cmab_kind(pts, abs(a)) if (t.get('building') or 'yes') == 'yes' else ''
            if kind:
                t = dict(t, building=kind)
                CMAB_STATS['osm kind from cmab'] += 1
            h = estimate_height(t, abs(a))
        h0 = num(t.get('min_height')) or (num(t.get('building:min_level')) or 0) * 3.3
        h = max(h, h0 + 2.5)
        g = zground(cx, cy)
        wall = lin(colour(t.get('building:colour'), WALLS[int(hashf(b['id']) * len(WALLS))]))
        roof = lin(colour(t.get('roof:colour'), '#5D6670' if h < 8 else ROOFS[int(hashf(b['id'], 1) * len(ROOFS))]))
        st = style(t, h, cx, cy)
        if .15 < st < .3 and not t.get('building:colour'):
            wall = lin(WALKUP_WALLS[int(hashf(b['id'], 2) * len(WALKUP_WALLS))])
        wall = (*wall[:3], st)
        roof = (*roof[:3], st)
        # Parts that start 3 m or more up (skybridges, decks over a street) are Overhead: the walk
        # grid's ray cast skips them, so the street beneath stays walkable and rideable.
        k = extrude(*(ob if h0 >= 3.0 else (bm, uv, col)), pts, g, h0, h, wall, roof)
        if k:
            n += 1
            tris += k
    o = kit.mesh_object('City buildings', bm, coll, ['facade', 'roof_city'])
    kit.mesh_object('Raised building parts', ob[0], over, ['facade', 'roof_city'])
    return o, n, tris


def extrude(bm, uv, col, pts, g, h0, h, wall, roof):
    """Walls and a flat roof for one footprint (anticlockwise). Wall UVs: metres along the wall,
    metres above the ground; roofs get v = -1. Returns triangles added, 0 if the roof failed."""
    lo = h0 - 0.6 if h0 == 0 else h0          # walls start a little below ground on sloping streets
    base = [bm.verts.new((x, y, g + lo)) for x, y in pts]
    top = [bm.verts.new((x, y, g + h)) for x, y in pts]
    run = 0.0
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        L = math.dist(pts[i], pts[j])
        f = bm.faces.new((base[i], base[j], top[j], top[i]))
        f.material_index = 0
        for loop, (u, v) in zip(f.loops, ((run, lo), (run + L, lo), (run + L, h), (run, h))):
            loop[uv].uv = (u, v)
            loop[col] = wall
        run += L
    try:
        f = bm.faces.new(top)
    except ValueError:
        return 0
    f.material_index = 1
    for loop in f.loops:
        loop[uv].uv = (0.0, -1.0)     # v < 0 marks a roof for the shader
        loop[col] = roof
    res = bmesh.ops.triangulate(bm, faces=[f], quad_method='BEAUTY', ngon_method='EAR_CLIP')
    return len(pts) * 2 + len(res['faces'])


def build_infill(coll, blocked, skip, mark):
    """Where OSM maps no buildings: CMAB's rooftops (traced from satellite imagery) that no OSM
    building covers, each extruded from its own outline, its height from estimate_height told CMAB's
    use label. Until 9 Nov a lattice of made-up six- and seven-storey slabs stood here (26,600, every
    34 m wherever a street was near): now a building stands only where one was seen. A rooftop is
    skipped where it would stand in a road, on a mapped building or in water (probed every 4 m
    inside it, OSM and the water mask winning), or in a landmark built another way."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    col = bm.loops.layers.color.new('Col')
    covered = set()
    for b in F['buildings']:
        pts = b['pts'][:-1] if b['pts'][0] == b['pts'][-1] else b['pts']
        if len(pts) >= 3:
            covered.update(cmab_hits(pts))
    n = 0
    for k, (_, func, _, ring) in enumerate(CMAB):
        if k in covered:
            CMAB_STATS['covered by osm'] += 1
            continue
        cx, cy = CMAB_C[k]
        if not (X0 + 30 < cx < X1 - 30 and Y0 + 30 < cy < Y1 - 30):
            CMAB_STATS['skipped: map edge'] += 1
            continue
        pts = [tuple(p) for p in ring]
        a = area(pts)
        if a < 0:
            pts = pts[::-1]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        probe = [(x, y) for x in np.arange(min(xs) + 2.0, max(xs), 4.0) for y in np.arange(min(ys) + 2.0, max(ys), 4.0)
                 if ac.point_in_poly(x, y, pts)] or [(cx, cy)]
        if any(skip(x, y) for x, y in probe):
            CMAB_STATS['skipped: landmark'] += 1
            continue
        if not all(dry(x, y, 2.0) for x, y in probe):
            CMAB_STATS['skipped: water'] += 1
            continue
        # A rooftop's traced edge may lap a pavement or a neighbour by a metre: a few blocked probes
        # are allowed, not a building across a street.
        if sum(blocked(x, y) for x, y in probe) > 0.15 * len(probe):
            CMAB_STATS['skipped: road or building'] += 1
            continue
        t = {'building': CMAB_KIND.get(func, '')}
        h = estimate_height(t, abs(a))
        st = style(t, h, cx, cy)
        # Nanjing's compounds are mostly white, cream and pale grey; old walk-ups faded.
        walls = WALKUP_WALLS if .15 < st < .3 else INFILL_WALLS
        wall = lin(walls[int(hashf(k, 4) * len(walls))])
        roof = lin(ROOFS[int(hashf(k, 5) * len(ROOFS))] if h > 25 else ('#8FA0A6', '#A9AAA3', '#7E9AA8')[int(hashf(k, 6) * 3)])
        if extrude(bm, uv, col, pts, zground(cx, cy), 0.0, h, (*wall[:3], st), (*roof[:3], st)):
            n += 1
            mark(pts)
    kit.mesh_object('Infill buildings', bm, coll, ['facade', 'roof_city'])
    CMAB_STATS['infill built'] = n
    return n


# --- Roads ------------------------------------------------------------------------------------------
WIDTH = {'trunk': 26.0, 'primary': 22.0, 'secondary': 15.0, 'tertiary': 11.0, 'residential': 7.0, 'unclassified': 7.0,
         'living_street': 5.5, 'service': 4.5, 'pedestrian': 7.0, 'footway': 2.6, 'cycleway': 3.0, 'path': 2.0,
         'primary_link': 8.0, 'secondary_link': 7.0, 'trunk_link': 9.0, 'tertiary_link': 6.0,
         # Purple Mountain's stairways and dirt tracks (the city had no use for them before).
         'steps': 2.4, 'track': 3.0}
FOOT = {'pedestrian', 'footway', 'path', 'cycleway', 'steps', 'track'}
AVENUE = {'trunk', 'primary', 'secondary'}


def ribbon(bm, uv, pts3, width, mi, lift):
    """A strip along a polyline: UV u = metres along, v = metres across (centre 0)."""
    left = ac.polyline_offset([p[:2] for p in pts3], width / 2)
    right = ac.polyline_offset([p[:2] for p in pts3], -width / 2)
    runs = [0.0]
    for a, b in zip(pts3, pts3[1:]):
        runs.append(runs[-1] + math.dist(a[:2], b[:2]))
    vs = [(bm.verts.new((l.x, l.y, p[2] + lift)), bm.verts.new((r.x, r.y, p[2] + lift))) for l, r, p in zip(left, right, pts3)]
    for i in range(1, len(vs)):
        f = bm.faces.new((vs[i - 1][1], vs[i][1], vs[i][0], vs[i - 1][0]))
        f.material_index = mi
        for loop, (u, v) in zip(f.loops, ((runs[i - 1], -width / 2), (runs[i], -width / 2), (runs[i], width / 2), (runs[i - 1], width / 2))):
            loop[uv].uv = (u, v)


def densify(pts, step=12.0):
    out = []
    for a, b in zip(pts, pts[1:]):
        L = math.dist(a, b)
        k = max(1, int(L / step))
        out += [(a[0] + (b[0] - a[0]) * i / k, a[1] + (b[1] - a[1]) * i / k) for i in range(k)]
    out.append(tuple(pts[-1]))
    return out


def build_roads(coll, skip):
    """Carriageways (a lane-marking shader paints them), raised sidewalks along the avenues, and
    footpaths. Tunnels are left out; bridges and flyovers rise 7 m over their middle."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    avenues, pavements = [], []
    global carriageways, lamps, planted
    carriageways = []
    planted = []
    lamps = []
    order = {'footway': 0, 'path': 0, 'cycleway': 0, 'pedestrian': 1, 'service': 1, 'living_street': 2, 'residential': 3,
             'unclassified': 3, 'tertiary': 4, 'tertiary_link': 4, 'secondary': 5, 'secondary_link': 5, 'primary': 6,
             'primary_link': 6, 'trunk': 7, 'trunk_link': 7}
    for w in F['ways'] + F['bridges']:
        kind = w.get('kind') or w.get('tags', {}).get('highway')
        if kind not in WIDTH:
            continue
        t = w.get('tags', {})
        if (t.get('tunnel') or (num(t.get('layer')) or 0) < 0) and w.get('id') not in THROUGH or w.get('id') in DECKED:
            continue
        pts = [p for p in w['pts'] if X0 + 20 < p[0] < X1 - 20 and Y0 + 20 < p[1] < Y1 - 20]
        if len(pts) < 2:
            continue
        pts = densify(pts)
        # Cut out the stretches inside a skipped area (the Mufu model's own roads) and keep the rest:
        # skipping a whole way by its midpoint dropped Yongji Avenue's last 200 m to the Shangyuanmen
        # junction, outside the model, and the bike could not reach the station.
        runs, cur = [], []
        for q in pts:
            if skip(q[0], q[1], kind):
                if len(cur) > 1:
                    runs.append(cur)
                cur = []
            else:
                cur.append(q)
        if len(cur) > 1:
            runs.append(cur)
        for pts in runs:
            if sum(math.dist(a, b) for a, b in zip(pts, pts[1:])) < 8:
                continue
            lanes = num(t.get('lanes'))
            width = max(WIDTH[kind], lanes * 3.4) if lanes and kind not in FOOT else WIDTH[kind]
            # OSM maps most avenues here as two one-way halves; each half is one direction's lanes, not
            # the whole avenue (at full width the halves overlapped, and one half's pavement and lamps
            # stood on the other: the owner saw lamps mid-road).
            if t.get('oneway') in ('yes', '-1', '1') and kind not in FOOT:
                width = lanes * 3.4 if lanes else max(WIDTH[kind] / 2, 6.0)
            bridge = bool(t.get('bridge')) and (num(t.get('layer')) or 1) > 0 and kind not in FOOT
            # On and by the Zhongshan patches the ground is the world's 4 m terrain, steep across
            # some roads (the lawn south of the Bo'ai arch falls 4 m in 18): a road laid at its
            # centreline's height sank under the grass at its uphill edge, and showed as a sliver
            # the bike fell off. There it is sampled every 4 m and lies at the higher of its edges.
            near_zs = ZS is not None and any(ZS.distance(*q) < 30.0 for q in pts)
            if near_zs:
                pts = densify(pts, 4.0)
            pts3 = []
            total = sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
            run = 0.0
            for i, p in enumerate(pts):
                if i:
                    run += math.dist(pts[i - 1], p)
                rise = 7.0 * max(0.0, math.sin(math.pi * min(run / total, 1.0))) ** 0.5 if bridge and total > 60 else 0.0
                z = road_z(*p)
                if near_zs and ZS.distance(*p) < 30.0:
                    a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
                    d = math.dist(a, b) or 1.0
                    nx, ny = (a[1] - b[1]) / d * width / 2, (b[0] - a[0]) / d * width / 2
                    z = max(z, zground(p[0] + nx, p[1] + ny), zground(p[0] - nx, p[1] - ny))
                pts3.append((p[0], p[1], z + rise))
            foot = kind in FOOT
            if not foot:
                carriageways.append(([p[:2] for p in pts3], width))
            ribbon(bm, uv, pts3, width, 1 if foot else 0, 0.3 + 0.015 * order.get(kind, 0))
            if kind in AVENUE or kind == 'tertiary':
                planted.append((pts3, width, kind, t.get('name', ''), w['id']))
                for side in (-1, 1):
                    pavements.append((ac.polyline_offset([p[:2] for p in pts3], side * (width / 2 + 2.0)), pts3, side))
                if kind in AVENUE:
                    avenues.append((pts3, width, kind))
    # Pavements go down once every carriageway is known, and stop where they cross one: a side
    # street's pavement ran on across the avenue it meets, and the inner pavement of a divided
    # avenue lay on its other half, lamps and all (the owner saw grey blocks and lamps mid-road).
    on_road = carriageway_test()
    for off, pts3, side in pavements:
        pts = [(o.x, o.y, p[2]) for o, p in zip(off, pts3)]
        fine = []
        for a, b in zip(pts, pts[1:]):
            k = max(1, int(math.dist(a[:2], b[:2]) / 2.0))
            fine += [tuple(a[j] + (b[j] - a[j]) * i / k for j in range(3)) for i in range(k)]
        fine.append(pts[-1])
        runs, cur = [], []
        for p in fine:
            if on_road(p[0], p[1], 1.0):
                if len(cur) > 1:
                    runs.append(cur)
                cur = []
            else:
                cur.append(p)
        if len(cur) > 1:
            runs.append(cur)
        for r in runs:
            if math.dist(r[0][:2], r[-1][:2]) < 6:
                continue
            ribbon(bm, uv, r, 4.0, 1, 0.45)
            # Street lamps every 28 m from 14 m along this pavement, where its shader draws their
            # pools of light; the arm reaches out over the road. None within 3 m of a carriageway.
            run, nxt = 0.0, 14.0
            for i in range(1, len(r)):
                seg = math.dist(r[i - 1][:2], r[i][:2])
                while nxt < run + seg:
                    f = (nxt - run) / max(seg, 1e-6)
                    x, y = r[i - 1][0] + (r[i][0] - r[i - 1][0]) * f, r[i - 1][1] + (r[i][1] - r[i - 1][1]) * f
                    if not on_road(x, y, 1.5):
                        lamps.append((x, y, r[i][2] + 0.45, math.atan2(r[i][1] - r[i - 1][1], r[i][0] - r[i - 1][0]) + (math.pi if side > 0 else 0.0)))
                    nxt += 28.0
                run += seg
    o = kit.mesh_object('City roads', bm, coll, ['road_city', 'sidewalk'])
    return o, avenues


def carriageway_test(cell=40.0):
    """on_road(x, y, margin): whether a point lies on any carriageway (within half its width plus
    margin of the centreline). Segments are hashed on a coarse grid."""
    grid = {}
    for pts, width in carriageways:
        for a, b in zip(pts, pts[1:]):
            r = width / 2 + 2.0
            for i in range(int((min(a[0], b[0]) - r) // cell), int((max(a[0], b[0]) + r) // cell) + 1):
                for j in range(int((min(a[1], b[1]) - r) // cell), int((max(a[1], b[1]) + r) // cell) + 1):
                    grid.setdefault((i, j), []).append((a, b, width / 2))

    def on_road(x, y, margin):
        for a, b, half in grid.get((int(x // cell), int(y // cell)), ()):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L2 = dx * dx + dy * dy
            t = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / L2))
            if math.hypot(x - a[0] - dx * t, y - a[1] - dy * t) < half + margin:
                return True
        return False
    return on_road


# --- Trees ------------------------------------------------------------------------------------------
# From research/plants/FACTS.md. Roads the city lists as plane avenues (梧桐路):
PLANE_ROADS = ('中山路', '中山东路', '中山北路', '中山南路', '中央路', '长江路', '北京西路', '瞻园路', '黄埔路', '瑞金路', '颐和路',
               '灵谷寺路', '陵园路')
# Street trees of the main city by census share (2026): camphor 26 %, plane 17 %; the rest split
# among the 2007 survey's dominant species (the split is an assumption).
CENSUS = (('camphor', 26.3), ('plane', 17.2), ('scholar', 12.0), ('privet', 10.0), ('metasequoia', 9.0),
          ('cedar', 8.0), ('wingnut', 7.0), ('ginkgo', 6.0))
# OSM places with their own planting.
ZONES = {
    62114524: ['ginkgo', 'ginkgo', 'ginkgo', 'camphor', 'cedar'],         # 清凉山公园: the city's largest ginkgo grove
    88779953: ['ginkgo', 'ginkgo', 'plane', 'camphor', 'cedar'],          # 南京大学 (鼓楼)
    89638729: ['ginkgo', 'ginkgo', 'camphor', 'cedar', 'plane'],          # 南京师范大学 (随园)
    236946068: ['cherry'],                                              # the mapped cherry grove (樱花)
    91828655: ['camphor', 'cedar', 'broadleaf_shade', 'wingnut', 'metasequoia'],   # 北极阁 wood
    62344629: ['camphor', 'broadleaf', 'broadleaf_shade', 'cedar', 'wingnut'],     # 幕府山 wood
}


def species_prototypes(protos, coll):
    """Stand-ins named for each researched species; the web draws the species (TREES in
    src/landmark-world.js) by the mesh's name."""
    for kind in ('camphor', 'ginkgo', 'metasequoia', 'scholar', 'privet', 'wingnut', 'plum'):
        me = protos['plane'].data.copy()
        me.name = f'proto {kind}'
        o = bpy.data.objects.new(f'proto {kind}', me)
        o.hide_render = o.hide_viewport = True
        coll.objects.link(o)
        protos[kind] = o
    return protos


def plane_prototype(protos, coll):
    me = protos['plane_autumn'].data.copy()
    me.name = 'proto plane'
    me.materials[0] = kit.mat('plane_leaf')
    o = bpy.data.objects.new('proto plane', me)
    o.hide_render = o.hide_viewport = True
    coll.objects.link(o)
    protos['plane'] = o
    return protos


def lamp_prototype(coll):
    """A stand-in mesh named 'proto lamp': the web draws the lamp itself (TREES.lamp)."""
    bm = bmesh.new()
    kit.add_box(bm, (0, 0, 4.0), (0.2, 0.2, 8.0))
    kit.add_box(bm, (0, 1.1, 7.8), (0.42, 0.9, 0.2))
    o = kit.mesh_object('proto lamp', bm, coll, ['bark'])
    o.data.name = 'proto lamp'
    o.hide_render = o.hide_viewport = True
    return o


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    root = bpy.data.collections.new('Core')
    scene.collection.children.link(root)
    c = {n: ac_coll for n, ac_coll in ((n, bpy.data.collections.new(n)) for n in
                                       ('Ground', 'Water', 'Far', 'Horizon', 'Roads', 'City', 'Buildings', 'Overhead', 'Garden', 'Gates', 'Trees', 'Prototypes', 'Markers'))}
    for v in c.values():
        root.children.link(v)
    protos = species_prototypes(plane_prototype(oc.extra_prototypes(c['Prototypes'], kit.tree_prototypes(c['Prototypes'])), c['Prototypes']), c['Prototypes'])

    # The Presidential Palace hero: appended from art-src/palace.blend at its own origin.
    (olat, olon), core_o = (32.04622025, 118.79225685), A.meta['origin_wgs84']
    kx = 111_320.0 * math.cos(math.radians(core_o[0]))
    pal = Vector(((olon - core_o[1]) * kx, (olat - core_o[0]) * 110_574.0))
    pal_z = zground(pal.x, pal.y)

    def in_palace(x, y):
        return -150 < x - pal.x < 160 and -170 < y - pal.y < 150

    with bpy.data.libraries.load(str(ROOT / 'art-src' / 'palace.blend')) as (src, dst):
        dst.collections = [n for n in src.collections if n in ('Buildings', 'Overhead', 'Garden')]
    for coll in dst.collections:
        target = c['Overhead'] if coll.name.startswith('Overhead') else c['Buildings']
        for o in list(coll.objects):
            if o.type != 'MESH' or o.name.startswith('Garden') and 'tree' in o.name.lower():
                continue
            o.matrix_world = Matrix.Translation((pal.x, pal.y, pal_z)) @ o.matrix_world
            target.objects.link(o)

    # Mufu Mountain: the app's own detailed model at its real place (blender/mufu_merge.py). Its land
    # replaces the city's there: OSM buildings, roads, infill and trees keep out, the city's ground
    # lies just under it, and the walk grid covers it.
    c['Mufu'] = bpy.data.collections.new('Mufu')
    root.children.link(c['Mufu'])
    mparts, mtrees = mm.load()
    # The model's land where the real mountain is: inside OSM's Mufu Mountain wood (幕府山) or
    # north of the old map's edge along the river. Its woodland reaches a kilometre further south,
    # over the streets round Wutang Square, which stay the city's.
    wood = next((p['pts'] for p in F['places'] if p['id'] == 62344629 and p.get('pts')), None)
    wood_mask = ac.Mask([wood], A.extent, 8.0) if wood else None
    zone = mm.Coverage(mparts, A.extent, allow=lambda x, y: y > 8432.0 or (wood_mask is not None and wood_mask.at(x, y)))
    river, river_k = mm.river_level(lakes, LAKE_LEVELS, ac.point_in_poly)
    z0 = river if river is not None else 0.0
    # On the mountain OSM's roads and paths are the true ones (the owner, 1 November): the model's
    # own hike paths inside OSM's Mufu Mountain wood give way to them. Along the river the model's
    # Yongji Avenue and promenade are the truer, and stay.
    def on_mountain(x, y):
        return wood_mask is not None and wood_mask.at(x, y)
    mobjects = mm.build(mparts, c['Mufu'], z0, lambda x, y: zone.at(x, y) and X0 < x < X1 and Y0 < y < Y1,
                        drop=lambda name, x, y: name.startswith('Hike |') and on_mountain(x, y))
    MUFU['zone'], MUFU['heights'] = zone, mm.Heights(mobjects)
    laid = mm.drape_paths(F['ways'], lambda x, y: on_mountain(x, y) and zone.at(x, y), MUFU['heights'],
                          {name: colour for name, colour, _, _ in mparts}, c['Mufu'])
    print('MUFU PATHS', {k: round(v) for k, v in laid.items()}, 'm', flush=True)
    # Where a city road runs into the model, its first stretch inside is laid over the model's ground
    # too, until it meets the model's own road: the model, fitted by scale and turn, put its Yongji
    # Avenue some 50 m off OSM's, and the bike could not cross from one to the other at Shangyuanmen.
    links = []
    for w in F['ways']:
        k = w.get('kind')
        if k not in mm.LINKS or len(w['pts']) < 2:
            continue
        dense = []
        for a, b in zip(w['pts'], w['pts'][1:]):
            n = max(1, int(math.dist(a, b) / 2.0))
            dense += [(a[0] + (b[0] - a[0]) * j / n, a[1] + (b[1] - a[1]) * j / n) for j in range(n)]
        dense.append(tuple(w['pts'][-1]))
        inside = [zone.at(*q) and not on_mountain(*q) for q in dense]
        for i in range(1, len(dense)):
            if inside[i] == inside[i - 1]:
                continue
            # Entering (or, read backwards, leaving) the model: up to 80 m inside from the edge.
            step = 1 if inside[i] else -1
            j, seg, run = (i if inside[i] else i - 1), [], 0.0
            while 0 <= j < len(dense) and inside[j] and run < 80:
                if seg:
                    run += math.dist(seg[-1], dense[j])
                seg.append(dense[j])
                j += step
            if len(seg) >= 3:
                links.append({'kind': k, 'pts': seg})
    linked = mm.drape_paths(links, lambda x, y: zone.at(x, y), MUFU['heights'],
                            {name: colour for name, colour, _, _ in mparts}, c['Mufu'], grade=0.08,
                            ground=lambda x, y: zground(x, y) + 0.3)
    print('MUFU LINKS', len(links), {k: round(v) for k, v in linked.items()}, 'm', flush=True)
    # Mufu Mountain's own ponds and reservoirs (OSM, 劳山水库 among them): each at the level of the
    # model's ground on its banks, cut out of the model so the water shows.
    ponds = []
    for k, w in enumerate(lakes):
        if k in CHANNELS or big_river(w):
            continue
        ring = w[::max(1, len(w) // 60)]
        # Any pond that touches the model's land: one half on the model, half on the city, stood
        # metres above the model's ground beside it (tests/city-audit.py banks).
        if not any(zone.at(x, y) for x, y in ring):
            continue
        # The lowest ground on its shore, the model's or (at the model's edge) the city's own.
        banks = [h if (h := MUFU['heights'].at(x, y)) is not None else zground(x, y) for x, y in ring]
        if banks:
            LAKE_LEVELS[k] = min(banks) - 0.4
            m = ac.Mask([w], A.extent, 4.0).m
            water_level[m] = LAKE_LEVELS[k]
            ponds.append(w)
    if ponds:
        mm.cut_ponds(mobjects, ponds, ac.point_in_poly)
        MUFU['heights'] = mm.Heights(mobjects)
    print('MUFU PONDS', len(ponds), flush=True)
    # The model's own river edge lies a few metres inland of OSM's: wherever its ground is below its
    # waterline, the Yangtze's water covers it too, as the original app's river did.
    river_ring = lakes[river_k] if river_k is not None else None
    river_mask = ac.Mask([river_ring], A.extent, 8.0) if river_ring else None

    def near_river(x, y):
        return river_mask is not None and any(river_mask.at(x + dx, y + dy) for dx in (-40, 0, 40) for dy in (-40, 0, 40))
    shallows = np.zeros_like(ac.Mask([], A.extent, 8.0).m)
    sx0, sy0 = A.extent[0], A.extent[2]
    mx0, mx1, my0, my1 = zone.bbox()
    for j in range(int((my0 - sy0) / 8), int((my1 - sy0) / 8) + 1):
        for i in range(int((mx0 - sx0) / 8), int((mx1 - sx0) / 8) + 1):
            x, y = sx0 + i * 8.0, sy0 + j * 8.0
            if 0 <= j < shallows.shape[0] and 0 <= i < shallows.shape[1] and zone.at(x, y):
                if not near_river(x, y):
                    continue
                # The model's ground, or where it has gaps at its riverside the city's own (hidden
                # 2.5 m under it), at nine points of the cell: any of them below the waterline makes
                # the cell river (single samples stepped over the model's low shore rocks).
                for ox in (-3.0, 0.0, 3.0):
                    for oy in (-3.0, 0.0, 3.0):
                        h = MUFU['heights'].at(x + ox, y + oy)
                        g = h if h is not None else ground(x + ox, y + oy, 8.0)[0]
                        if g < z0 - 0.05:
                            shallows[j, i] = True
                            break
                    if shallows[j, i]:
                        break
    MUFU['shallows'], MUFU['river_k'] = shallows, river_k
    print('MUFU SHALLOWS', int(shallows.sum()), 'cells', flush=True)

    def in_mufu(x, y):
        # Only where the model really has ground: its zone is drawn a few cells wider, and in that
        # margin the city's road stopped short of the model's (Yongji Avenue at Shangyuanmen).
        return zone.at(x, y) and MUFU['heights'].at(x, y) is not None

    # The Zhongshan world (blender/zhongshan_merge.py): the Mausoleum axis, the Music Stage, Meiling
    # Palace and Ming Xiaoling, with their own graded ground, on Purple Mountain. OSM's buildings,
    # roads and the city's trees keep off its patches, as on Mufu Mountain.
    if ZS is not None:
        c['Zhongshan'] = bpy.data.collections.new('Zhongshan')
        root.children.link(c['Zhongshan'])
        zmoved = ZS.append({n: c['Zhongshan'] for n in zm.BUILT}, c['Ground'], set(protos))
        print('ZHONGSHAN', {'objects': len(zmoved), 'tris': sum(len(o.data.polygons) for o in zmoved if o.type == 'MESH'),
                            'trees': len(ZS.trees), 'spawns': [n for n, _, _ in ZS.spawns], 'arch': [round(ZS.dx), round(ZS.dy), round(ZS.dz, 1)]}, flush=True)

    def in_zs(x, y):
        return ZS is not None and ZS.inside(x, y, 0.0)

    def skip(x, y):
        return in_palace(x, y) or in_mufu(x, y) or in_zs(x, y)
    mx0, mx1, my0, my1 = zone.bbox()
    extra = [{'name': 'mufu', 'x0': max(X0, mx0 - 20), 'x1': min(X1, mx1 + 20), 'y0': max(Y0, my0 - 20),
              'y1': min(Y1, my1 + 20), 'cell': 3.0, 'stepUp': 1.3}]
    if ZS is not None:
        # Finer ground over the Mausoleum's axis and the Music Stage (2 m: the stair's landings,
        # the stage's terraces), searched before the mountain's 4 m grid.
        x0_, x1_, y0_, y1_ = ZS.rects[0]
        extra.append({'name': 'mausoleum', 'x0': x0_, 'x1': x1_, 'y0': y0_, 'y1': y1_, 'cell': 2.0, 'stepUp': 1.0, 'first': True})
    scene['extra_grids'] = json.dumps(extra)
    print('MUFU', {'parts': len(mobjects), 'tris': sum(len(o.data.polygons) for o in mobjects), 'river': round(z0, 2),
                   'scale': round(mm.SCALE, 4), 'turn': round(math.degrees(mm.TURN), 2), 'bbox': [round(v) for v in (mx0, mx1, my0, my1)]}, flush=True)

    # Detailed ground over the centre (CORE_PATCH); coarser out to the river (road_z reads both).
    patch = CORE_PATCH
    ac.terrain_patch('Terrain core', c['Ground'], patch[0], patch[1], lambda x, y: ground(x, y, 12.0), ['lawn', 'city_paving', 'forest_floor', 'canal_stone'], step=12.0)
    outer = ac.terrain_patch('Terrain outer', c['Ground'], (X0 + 24, X1 - 24), (Y0 + 24, Y1 - 24),
                             outer_vertex, ['lawn', 'city_paving', 'forest_floor', 'canal_stone'], step=24.0)
    if ZS is not None:
        # 2.5 m down was not enough under the Zhongshan patches: a 24 m cell spans a curve of the
        # world's 4 m ground (the Ming Tower's mound) and rose through Xiaoling's paving. Its cells
        # wholly on a patch go; the world's terrain covers them.
        print('ZHONGSHAN CUT', ZS.cut(outer), flush=True)
    # Beyond the map: coarse ground to the horizon, forested hills with one-crown canopy trees.
    kit.PALETTE.setdefault('far_ground', '#8E9478')
    ac.outer_apron('Landscape', c['Far'], FAR, (((X0 + 24, X1 - 24), (Y0 + 24, Y1 - 24)),), far_z, step=60.0, material='far_ground')
    fx0, fx1, fy0, fy1 = FAR.extent
    # Out to 40 km, a flat frame just below the landscape's edge, so the sky never shows under the
    # world. Its own collection: meshopt quantises over each mesh's bounds (see bridge, 1 Nov).
    far, lo = 40000.0, min(far_z(x, y) for x, y in ((fx0 + 70, fy0 + 70), (fx1 - 70, fy0 + 70), (fx0 + 70, fy1 - 70), (fx1 - 70, fy1 - 70))) - 1.0
    gx0, gx1, gy0, gy1 = fx0 + 60, fx1 - 60, fy0 + 60, fy1 - 60
    ac.polygon_mesh('Horizon', c['Horizon'], [[(-far, -far), (far, -far), (far, gy0), (-far, gy0)], [(-far, gy1), (far, gy1), (far, far), (-far, far)],
                                              [(-far, gy0), (gx0, gy0), (gx0, gy1), (-far, gy1)], [(gx1, gy0), (far, gy0), (far, gy1), (gx1, gy1)]],
                    lo, 'far_ground')
    canopy = ac.scatter(protos, c['Trees'], rnd, ['far'], 14000, (fx0 + 80, fx1 - 80), (fy0 + 80, fy1 - 80),
                        lambda x, y: not (X0 < x < X1 and Y0 < y < Y1) and far_z(x, y) > 28 and not wet(x, y), far_z,
                        scale=(1.1, 1.6), clump=60.0, groves=400)
    # Each lake and river at its own level: the lowest DSM round its shore (the Yangtze is metres
    # below Xuanwu Lake).
    for k, w in enumerate(lakes):
        # From the bare ground on the banks, not the surface model: its minimum caught roofs and
        # trees and floated one surface 8 m up, over Jiefang South Road (tests/road-audit.py).
        if k in CHANNELS:
            # A strip of quads: ear-clipping the channel's outline self-intersected at bends and
            # spread water over the land beside it (tests/city-audit.py: willows in water).
            ac.polygon_mesh(f'Water {k}', c['Water'], water_shapes(k), LAKE_LEVELS[k], 'water')
            continue
        # Islands are holes: Xuanwu Lake's isles and their buildings stand clear of its surface.
        holes = [i['pts'] for i in F['islands'] if ac.point_in_poly(*i['pts'][0], w)]
        if big_river(w):
            # The Yangtze and Jiajiang: their stitched outlines are too tangled to triangulate (the
            # river by Mufu Mountain came out without a surface), so their water is laid from the
            # same scanline fill as the water mask, in 8 m strips.
            river_strips(f'Water {k}', c['Water'], w, LAKE_LEVELS[k], holes, extra=MUFU['shallows'] if k == MUFU.get('river_k') else None)
            continue
        ac.water_mesh(f'Water {k}', c['Water'], w, LAKE_LEVELS[k], holes=holes)
    ac.polygon_mesh('Pitches', c['Ground'], pitches, 0.0, 'pitch')
    for o in c['Ground'].objects:
        if o.name.startswith('Pitches'):
            for v in o.data.vertices:
                v.co.z = zground(v.co.x, v.co.y) + 0.08
    # The Ming wall and Xuanwu Lake (blender/core_xuanwu.py): the wall's gates and the park's halls
    # stand in for their OSM buildings, gate passages are streets, the lake's bridges are decks.
    wall = xw.Wall(F, WIDTH, FOOT)
    THROUGH.update(wall.tunnels_through)
    SKIP_BUILDINGS.update(wall.not_buildings)
    halls = xw.park_halls(F, c['Buildings'], zground, wall.not_buildings)
    SKIP_BUILDINGS.update(halls)
    xk = xw.lake_ring(F, lakes)
    xw_level = LAKE_LEVELS[xk] if xk is not None else 0.0
    xw_bridges = xw.foot_bridges(F, A.extent, lakes[xk]) if xk is not None else []
    DECKED.update(b['id'] for b in xw_bridges)
    city, n_b, tris = build_buildings(c['City'], skip, c['Overhead'])
    # On the Zhongshan patches the world's own roads and paths stand in for OSM's, except where it
    # drew no way and built nothing over the spot (the road east of Meiling Palace, Bus 34's way):
    # there the city's carriageway runs on. Its footpaths stay off: OSM's paths through the walled
    # grounds run under its buildings.
    roads, avenues = build_roads(c['Roads'], lambda x, y, kind: in_palace(x, y) or in_mufu(x, y)
                                 or (in_zs(x, y) and (kind in FOOT or ZS.covers(x, y))))
    wall_m, breaches, arches = xw.build_wall(wall, c['Buildings'], c['Overhead'], zground)
    pavilions = xw.xuanwu_gate(wall, c['Buildings'], zground)
    decks = xw.build_bridges(xw_bridges, c['Roads'], xw_level, road_z)
    print('WALL', {'lines': len(wall.lines), 'built_m': round(wall_m), 'breaches': breaches, 'arches': arches,
                   'gate_passages': len(THROUGH), 'pavilions': pavilions, 'park_halls': len(halls)}, flush=True)
    lamp_proto = lamp_prototype(c['Prototypes'])
    for x, y, z, ang in lamps:
        kit.place(lamp_proto, c['Trees'], (x, y, z), ang)

    # Plane trees: both sides of every avenue, every 9 m, where there is no building; OSM tree rows.
    bmask = ac.Mask([b['pts'] for b in F['buildings']] + wall.footprints(), A.extent, 2.0)
    # Carriageways as polygons (both edges of each ribbon), so trees never stand in a road: Zhongshan
    # Road is mapped as two one-way ways, and each side's trees fell on the other.
    road_polys = []
    for pts, w in carriageways:
        if len(pts) > 1:
            l, r = ac.polyline_offset(pts, w / 2 + 0.6), ac.polyline_offset(pts, -w / 2 - 0.6)
            road_polys.append([(v.x, v.y) for v in l] + [(v.x, v.y) for v in reversed(r)])
    rmask = ac.Mask(road_polys, A.extent, 2.0)
    blocked = lambda x, y: bmask.at(x, y) or rmask.at(x, y) or in_mufu(x, y) or in_zs(x, y)  # noqa: E731

    # A tree needs its whole crown clear of buildings, not just its trunk (crowns pierced walls).
    def crown_clear(x, y, r=4.5):
        return not any(bmask.at(x + r * math.cos(a), y + r * math.sin(a)) for a in (0, 1.57, 3.14, 4.71, .78, 2.36, 3.93, 5.5))

    def mark(pts):
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        for j in range(int((min(ys) - bmask.y0) / bmask.cell), int((max(ys) - bmask.y0) / bmask.cell) + 2):
            for i in range(int((min(xs) - bmask.x0) / bmask.cell), int((max(xs) - bmask.x0) / bmask.cell) + 2):
                if 0 <= i < bmask.nx and 0 <= j < bmask.ny and ac.point_in_poly(bmask.x0 + i * bmask.cell, bmask.y0 + j * bmask.cell, pts):
                    bmask.m[j, i] = True
    infill = build_infill(c['City'], blocked, skip, mark)
    print('CMAB', dict(CMAB_STATS), flush=True)
    trees = 0
    # Street trees by research (research/plants/FACTS.md): plane on the roads the city names as
    # plane avenues, cherries on Jiming Temple Road; every other road one species along its whole
    # length (streets are planted uniformly), drawn by the census shares.
    def street_species(name, wid):
        if any(r in name for r in PLANE_ROADS):
            return 'plane'
        if '鸡鸣寺路' in name:
            return 'cherry'
        pick, acc = hashf(wid, 7) * sum(w for _, w in CENSUS), 0.0
        for kind, w in CENSUS:
            acc += w
            if pick <= acc:
                return kind
        return 'camphor'
    species_count = {}
    for pts3, width, kind, name, wid in planted:
        sp = street_species(name, wid)
        spacing = 7.0 if sp == 'cherry' else 9.0
        for side in (-1, 1):
            off = ac.polyline_offset([p[:2] for p in pts3], side * (width / 2 + 2.0))
            run, nxt = 0.0, rnd.uniform(0, 9)
            for i in range(1, len(off)):
                seg = (off[i] - off[i - 1]).length
                while nxt < run + seg:
                    q = off[i - 1].lerp(off[i], (nxt - run) / max(seg, 1e-6))
                    if not blocked(q.x, q.y) and crown_clear(q.x, q.y) and dry(q.x, q.y) and not in_palace(q.x, q.y):
                        kit.place(protos[sp], c['Trees'], (q.x, q.y, zground(q.x, q.y)), rnd.uniform(0, 6.28), rnd.uniform(0.85, 1.1))
                        species_count[sp] = species_count.get(sp, 0) + 1
                        trees += 1
                    nxt += spacing
                run += seg
    for w in F['ways']:
        if w.get('kind') == 'tree_row':
            for p in densify(w['pts'], 8.0):
                if not blocked(*p) and crown_clear(*p):
                    kit.place(protos['plane'], c['Trees'], (p[0], p[1], zground(*p)), rnd.uniform(0, 6.28), rnd.uniform(0.8, 1.05))
                    trees += 1
    # Places with their own planting (research/plants/FACTS.md): ginkgo groves and campuses,
    # the mapped cherry grove, the Beiji'ge and Mufu Mountain woods.
    zones = []
    for pid, mix in ZONES.items():
        poly = next((p['pts'] for p in F['places'] if p['id'] == pid and p.get('pts')), None)
        if poly:
            zones.append((ac.Mask([poly], A.extent, 4.0), mix))

    def zone_ok(mix):
        return lambda x, y: not blocked(x, y) and crown_clear(x, y, 3.0) and dry(x, y) and any(m.at(x, y) for m, k in zones if k is mix)
    for mask, mix in zones:
        n = int(mask.m.sum() * 16 / 140)         # about one tree per 140 m² of the place
        trees += ac.scatter(protos, c['Trees'], rnd, mix, min(n, 3000), patch[0], patch[1], zone_ok(mix), zground, groves=max(6, n // 30))
    # Lake shores: willows above all, cherries and camphor between (Xuanwu's banks, the moats).
    shore = 0
    for w in lakes:
        if big_river(w):
            continue                                 # the Yangtze: its banks are wharves and dikes
        for a, b in zip(w, w[1:]):
            L = math.dist(a, b)
            for k in range(int(L / 10)):
                px, py = a[0] + (b[0] - a[0]) * (k + .5) * 10 / L, a[1] + (b[1] - a[1]) * (k + .5) * 10 / L
                nx, ny = -(b[1] - a[1]) / L, (b[0] - a[0]) / L
                for side in (1, -1):
                    qx, qy = px + nx * side * 6.0, py + ny * side * 6.0
                    if dry(qx, qy) and not blocked(qx, qy) and crown_clear(qx, qy, 2.5):
                        r = rnd.random()
                        kit.place(protos['willow' if r < .65 else 'cherry' if r < .8 else 'camphor'], c['Trees'], (qx, qy, zground(qx, qy)),
                                  rnd.uniform(0, 6.28), rnd.uniform(.85, 1.1))
                        shore += 1
                        break
    trees += shore
    # Xuanwu Lake's islands, each by its own character (blender/core_xuanwu.py), off their paths.
    xw_isl = ac.Mask(list(xw.islands(F).values()), A.extent, 4.0)
    foot_polys = []
    for w in F['ways']:
        if w.get('kind') in FOOT and len(w['pts']) > 1 and any(-500 < x < 1900 and 2400 < y < 4800 for x, y in w['pts']):
            l, r = ac.polyline_offset(w['pts'], 2.4), ac.polyline_offset(w['pts'], -2.4)
            foot_polys.append([(v.x, v.y) for v in l] + [(v.x, v.y) for v in reversed(r)])
    foot_mask = ac.Mask(foot_polys, A.extent, 2.0)
    island_trees = xw.plant_islands(F, protos, c['Trees'], rnd, zground,
                                    lambda x, y: not blocked(x, y) and not foot_mask.at(x, y) and crown_clear(x, y, 3.0) and dry(x, y), A.extent)
    trees += sum(island_trees.values())
    print('ISLAND TREES', island_trees, flush=True)
    # Other green spaces: the census mix of the city's own trees, where Meta and WRI's canopy map has
    # trees over 3 m (as on Purple Mountain below), each scaled to the canopy's height there. Until
    # 9 Nov, 9,000 trees were scattered at random over the central patch's parks, of which the map
    # has only an eighth under canopy, and the parks beyond it had none. A jittered lattice, 12 m in
    # the central patch where people walk, 16 m beyond; species in groves (60 m cells).
    kinds = ['camphor', 'camphor', 'plane', 'scholar', 'ginkgo', 'metasequoia', 'cedar', 'privet', 'wingnut']
    tall = {k: max(protos[k].dimensions.z, 1.0) for k in set(kinds)}

    def park_ok(x, y):
        return (green_mask.at(x, y) and not (MOUNTAIN is not None and MOUNTAIN.at(x, y)) and not xw_isl.at(x, y) and not in_palace(x, y)
                and not any(m.at(x, y) for m, _ in zones) and not blocked(x, y) and crown_clear(x, y, 3.5) and dry(x, y))
    park_trees = 0
    for sp, inside in ((12.0, True), (16.0, False)):
        for gy in np.arange(Y0 + 30, Y1 - 30, sp):
            for gx in np.arange(X0 + 30, X1 - 30, sp):
                if (patch[0][0] < gx < patch[0][1] and patch[1][0] < gy < patch[1][1]) != inside:
                    continue
                x, y = gx + rnd.uniform(-.4, .4) * sp, gy + rnd.uniform(-.4, .4) * sp
                if not green_mask.at(x, y):
                    continue
                cover, h = canopy_at(x, y)
                if h < 3 or rnd.random() >= cover or not park_ok(x, y):
                    continue
                g = random.Random(hash((int(x // 60), int(y // 60))))
                k = g.choice(kinds) if rnd.random() < 0.75 else rnd.choice(kinds)
                kit.place(protos[k], c['Trees'], (x, y, zground(x, y) - 0.2), rnd.uniform(0, 6.28),
                          min(1.4, max(0.55, h / tall[k] * rnd.uniform(.85, 1.05))))
                park_trees += 1
    trees += park_trees
    print('PARK TREES', park_trees, flush=True)
    # Purple Mountain's forest (OSM relation 16455205). Its secondary forest has turned from planted
    # Masson pine to deciduous broadleaf: in forest-gap surveys sweetgum (枫香) is in every plot, then
    # castor aralia, white oak, Chinese pistache and cork oak; conifers about 10 % of the reserve,
    # broadleaf about 49 % (2002). As this build's kinds: sweetgum as the maple (green, then red in
    # autumn), oaks and pistache as broadleaf, pine as cedar.
    # Sources: design/PURPLE-MOUNTAIN-PLAN.md.
    # Where the trees stand, and how tall: Meta and WRI's 1 m canopy height map (CC BY 4.0), on the
    # core's 4 m grid (tools/research/canopy-prep.py; 60 % of the mountain band under canopy, mostly
    # 8-13 m). A tree on a jittered 18 m lattice wherever the canopy covers the cell, and on a 9 m
    # lattice within about 20 m of the ways a visitor walks or rides, where the forest is seen from inside;
    # each scaled to the canopy's height there. Species in groves (60 m cells) of the survey mix.
    # Before this (3 Nov) 30,000 trees in 3,000 groves read as parkland on a lawn.
    mountain_trees = 0
    if MOUNTAIN is not None:
        kinds = ['maple_autumn'] * 7 + ['broadleaf'] * 5 + ['broadleaf_shade'] * 3 + ['broadleaf_sun'] * 2 + ['cedar'] * 2 + ['camphor']
        tall = {k: max(protos[k].dimensions.z, 1.0) for k in set(kinds)}

        def wood_ok(x, y):
            return MOUNTAIN.at(x, y) and not blocked(x, y) and dry(x, y) and crown_clear(x, y, 2.5)

        WAYSIDE = 15.0
        wayside = set()
        for w in F['ways']:
            if w.get('kind') not in WIDTH or len(w['pts']) < 2:      # roads and paths, not rail or rivers
                continue
            for a, b in zip(w['pts'], w['pts'][1:]):
                L = math.dist(a, b)
                for k in range(int(L / WAYSIDE) + 1):
                    px, py = a[0] + (b[0] - a[0]) * k * WAYSIDE / max(L, 1e-6), a[1] + (b[1] - a[1]) * k * WAYSIDE / max(L, 1e-6)
                    if MOUNTAIN.at(px, py):
                        i, j = int(px // WAYSIDE), int(py // WAYSIDE)
                        wayside.update((i + di, j + dj) for di in (-1, 0, 1) for dj in (-1, 0, 1))
        seen = 0
        for sp, keep in ((18.0, lambda x, y: True), (9.0, lambda x, y: (int(x // WAYSIDE), int(y // WAYSIDE)) in wayside)):
            for gy in np.arange(Y0 + 30, 6000.0, sp):
                for gx in np.arange(3600.0, X1 - 30, sp):
                    x, y = gx + rnd.uniform(-.4, .4) * sp, gy + rnd.uniform(-.4, .4) * sp
                    if not keep(x, y) or not MOUNTAIN.at(x, y):
                        continue
                    seen += 1
                    cover, h = canopy_at(x, y)
                    if rnd.random() >= cover or h < 3 or not wood_ok(x, y):
                        continue
                    g = random.Random(hash((int(x // 60), int(y // 60))))
                    k = g.choice(kinds) if rnd.random() < 0.75 else rnd.choice(kinds)
                    kit.place(protos[k], c['Trees'], (x, y, zground(x, y) - 0.2), rnd.uniform(0, 6.28),
                              min(1.4, max(0.55, h / tall[k] * rnd.uniform(.85, 1.05))))
                    mountain_trees += 1
        print('MOUNTAIN FOREST', mountain_trees, 'trees of', seen, 'lattice points', flush=True)
        trees += mountain_trees
    zs_trees = 0
    for kind, x, y, z, rot, sc in (ZS.trees if ZS is not None else ()):
        # The world never drew Zixia Lake (紫霞湖) by Xiaoling; the city has it from OSM.
        if not dry(x, y):
            continue
        # Nor the road it never drew east of Meiling, which the city's road now carries.
        if rmask.at(x, y):
            continue
        kit.place(protos[kind], c['Trees'], (x, y, z), rot, sc)
        zs_trees += 1
    trees += zs_trees
    print('SPECIES', species_count, 'shore', shore, 'mountain', mountain_trees, 'zhongshan', zs_trees, flush=True)
    # The model's own trees, at their places, as the Mufu Mountain wood's researched mix
    # (ZONES: research/plants/FACTS.md).
    mix, placed = ZONES[62344629], 0
    for x, y, z, sc in mtrees:
        if not (X0 < x < X1 and Y0 < y < Y1) or not zone.at(x, y) or not dry(x, y):
            continue                     # (the model's trees stood in the ponds it did not have)
        h = MUFU['heights'].at(x, y)
        kit.place(protos[mix[int(hashf(int(x * 7 + y * 13), 3) * len(mix)) % len(mix)]], c['Trees'],
                  (x, y, h if h is not None else z + z0), rnd.uniform(0, 6.28), max(.6, min(1.4, sc)))
        placed += 1
    trees += placed
    print('MUFU TREES', placed, flush=True)

    # Last, no tree or lamp under a roof (tools/scene-audit.py found lamps on pavements that OSM
    # buildings cover, and trees inside infill and hero buildings): a ray up from each foot.
    dg = bpy.context.evaluated_depsgraph_get()
    roofs = []
    for coll in (c['City'], c['Buildings']):
        for o in coll.all_objects:
            if o.type == 'MESH' and len(o.data.polygons):
                inv = o.matrix_world.inverted()
                roofs.append((BVHTree.FromObject(o, dg), inv, inv.to_3x3()))
    # Roads and water as BVHs (world space: both are built in place); roads first, for bridges.
    floors = [(BVHTree.FromPolygons([v.co for v in o.data.vertices], [f.vertices[:] for f in o.data.polygons]), o.data)
              for o in list(c['Roads'].objects) + list(c['Water'].objects)
              + [m for m in c['Mufu'].objects if m.active_material and m.active_material.get('road')]
              if o.type == 'MESH' and len(o.data.polygons)]
    # And every tree stands on the ground as built (terrain, paving, the model's ground): trees were
    # placed on the satellite heights, and the banks lowered by water left some in the air (the
    # owner saw them floating).
    grounds = [(BVHTree.FromPolygons([v.co for v in o.data.vertices], [f.vertices[:] for f in o.data.polygons]))
               for o in list(c['Ground'].objects) + list(c['Roads'].objects)
               + [m for m in c['Mufu'].objects if m.active_material and m.active_material.get('walkable')]
               if o.type == 'MESH' and len(o.data.polygons)]
    # Xuanwu Lake's stone decks (core_xuanwu.build_bridges): trees lifted onto a 4.5 m deck stood
    # across it, and their trunks cut the walk to Huanzhou and from Cuizhou Gate (build 10).
    decks = {o.data for o in c['Roads'].objects if o.name.startswith('Lake bridges')}
    up, culled = Vector((0, 0, 1)), Counter()
    for o in list(c['Trees'].objects):
        if o.data.name == 'proto far':
            continue
        top = None
        for t in grounds:
            hit = t.ray_cast(o.location + Vector((0, 0, 3.0)), Vector((0, 0, -1)), 10.0)   # not up onto a bridge over it
            if hit[0] is not None and (top is None or hit[0].z > top):
                top = hit[0].z
        if top is not None and o.data.name != 'proto lamp':
            o.location.z = top
        foot = o.location + Vector((0, 0, 0.5))
        kind = o.data.name.replace('proto ', '')
        # Not on a carriageway (roads the tree masks missed: service roads, junction mouths) and
        # not on water (lamps excepted: they stand on bridges).
        # Water counts only where its surface is the top one: a lake's big triangles run on under
        # its islands, hidden below their higher ground (build 8 culled 4200 island trees so).
        under = ''
        for t, me in floors:
            hit = t.ray_cast(o.location + Vector((0, 0, 3.0)), Vector((0, 0, -1)), 6.0)
            if hit[0] is not None:
                mat = me.materials[me.polygons[hit[2]].material_index]
                under = 'road_city' if mat.get('road') else 'deck' if me in decks else mat.name.split('.')[0]
                if under == 'water' and top is not None and hit[0].z < top - 0.05:
                    under = ''
                    continue
                break
        if under in ('water', 'deck') and kind != 'lamp' or under == 'road_city':
            culled[kind + ' on ' + under] += 1
            bpy.data.objects.remove(o)
            continue
        # A trunk with road on three sides within 2.5 m stands in the carriageway's edge (the city
        # audit's own test, tests/city-audit.py trees).
        if kind != 'lamp':
            sides = 0
            for dx, dy in ((2.5, 0), (-2.5, 0), (0, 2.5), (0, -2.5)):
                for t, me in floors:
                    hit = t.ray_cast(o.location + Vector((dx, dy, 3.0)), Vector((0, 0, -1)), 6.0)
                    if hit[0] is not None:
                        mat = me.materials[me.polygons[hit[2]].material_index]
                        sides += bool(mat.get('road')) or mat.name.split('.')[0] == 'road_city'
                        break
            if sides >= 3:
                culled[kind + ' at a road edge'] += 1
                bpy.data.objects.remove(o)
                continue
        if any(t.ray_cast(inv @ foot, (r3 @ up).normalized())[0] is not None for t, inv, r3 in roofs):
            culled[o.data.name.replace('proto ', '')] += 1
            bpy.data.objects.remove(o)
    trees -= sum(n for k, n in culled.items() if k != 'lamp')
    print('CULLED under roofs', dict(culled), flush=True)
    # Lotus on Xuanwu Lake, after the cull (it grows in the water on purpose). The beds are Overhead:
    # out of the walk and water grids' ray cast, so the lake stays water for the boat and the audits.
    if xk is not None:
        holes = [i['pts'] for i in F['islands'] if ac.point_in_poly(*i['pts'][0], lakes[xk])]
        bed, lake_cells, centres = xw.lotus_beds(F, lakes[xk], holes, wet, xw_level, c['Overhead'], xw_bridges)
        plants = xw.lotus_plants(centres, protos, c['Trees'], rnd, xw_level)
        print('XUANWU', {'level': round(xw_level + A.base, 2), 'level_local': round(xw_level, 2), 'bridges': decks,
                         'lotus_share': round(bed / max(lake_cells, 1), 3), 'lotus_plants': plants}, flush=True)

    # Markers: Xinjiekou looking up Zhongshan Road; the road itself; the Palace gate; Gulou.
    pk = c['Markers']
    xj = Vector((-460.0, 150.0))       # on the pavement; -445 was inside 南京新百's footprint
    ac.add_point(pk, 'Spawn xinjiekou', (xj.x, xj.y, zground(*xj)), (-460.0, 900.0, zground(-460, 900) + 20))
    zs = Vector((-430.0, 1100.0))
    # Off any trunk or lamp: a street tree's stamp left the old spot unwalkable (tests/city-audit.py).
    while bmask.at(*zs) or any((o.location.xy - zs).length < 2.5 for o in c['Trees'].objects):
        zs.x -= 3.0
    ac.add_point(pk, 'Spawn zhongshan', (zs.x, zs.y, zground(*zs)), (-460.0, 1900.0, zground(-460, 1900) + 8))
    pg = pal + Vector((9.5, -200.0))
    # On the street before the gate, at its own height (the Palace's ground is 2.7 m higher;
    # tests/worlds-browser.mjs found the marker floating).
    ac.add_point(pk, 'Spawn palace', (pg.x, pg.y, zground(pg.x, pg.y)), (pal.x + 9.5, pal.y - 100.0, pal_z + 8))
    # Mufu Mountain: where the model's hike starts (its 'Hike start' view), and Wutang Square by
    # the Line 3 station.
    hs = mm.to_city(np.array([[1385.95, -943.81]]))[0]
    ahead = mm.to_city(np.array([[1385.95 - 0.2085 * 30, -943.81 + 0.9764 * 30]]))[0]
    hz = MUFU['heights'].at(*hs)
    ac.add_point(pk, 'Spawn mufu', (hs[0], hs[1], hz if hz is not None else zground(*hs)), (ahead[0], ahead[1], (hz or 0) + 1.6))
    wt = Vector((-1065.0, 7860.0))
    ac.add_point(pk, 'Spawn wutang', (wt.x, wt.y, zground(*wt)), (-1065.0, 8200.0, zground(-1065, 8200) + 10))
    for name, loc, rot in (ZS.spawns if ZS is not None else ()):
        e = bpy.data.objects.new(name, None)
        e.location, e.rotation_euler = loc, (0, 0, rot)
        pk.objects.link(e)
    gl = Vector((-470.0, 2000.0))
    ac.add_point(pk, 'Spawn gulou', (gl.x, gl.y, zground(*gl)), (-600.0, 2100.0, zground(-600, 2100) + 10))
    for n, (target, at, toward) in enumerate((('palace', xj + Vector((14.0, 30.0)), xj + Vector((14.0, 60.0))),
                                             ('xinjiekou', pg + Vector((20.0, 10.0)), pg + Vector((40.0, 10.0))))):
        d = (toward - at).normalized()
        g = kit.moon_gate(f'Moon gate {n}', c['Gates'])
        z = zground(*at)
        g.matrix_world = Matrix.Translation((at.x, at.y, z)) @ Matrix.Rotation(math.atan2(-d.x, d.y), 4, 'Z')
        ac.add_point(pk, f'Gate {target}@{n}', (at.x, at.y, z), (at.x + d.x * 10, at.y + d.y * 10, z))

    scene['origin_wgs84'] = list(A.meta['origin_wgs84'])
    scene['base_z'] = A.base
    scene['skyline_clip'] = [X0, X1, Y0, Y1]
    ac.lookdev(scene, sun_az=235, sun_el=18)
    cams = {
        'xinjiekou': ac.camera(scene, 'Cam xinjiekou', (xj.x, xj.y - 30, zground(*xj) + 1.7), (-460.0, 700.0, zground(-460, 700) + 25), 30),
        'aerial': ac.camera(scene, 'Cam aerial', (-1200.0, -900.0, 420.0), (-100.0, 700.0, 0.0), 32),
    }
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print('BUILD', {'lamps': len(lamps), 'canopy': canopy, 'infill': infill, 'buildings': n_b, 'building_tris': tris, 'avenues': len(avenues), 'trees': trees, 'palace': [round(pal.x), round(pal.y), round(pal_z, 1)],
                    'objects': len(bpy.data.objects)}, flush=True)
    if RENDER:
        ac.render_views(scene, cams, RENDERS, 'lookdev')


main()
