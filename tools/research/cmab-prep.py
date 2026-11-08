"""Building footprints with height, use and age over the city core, from CMAB (CC BY 4.0).

    python -P tools/research/cmab-prep.py E:/nanjing-geodata/cmab/nanjing

CMAB, the China Multi-Attribute Building dataset (Zhang et al., "CMAB: A First National-Scale
Multi-Attribute Building Dataset in China Derived from Open Source Data and Ensemble Learning",
Scientific Data 2025; Figshare 27992417, CC BY 4.0). Rooftops are segmented from satellite imagery;
height, function and age are estimated by machine learning from imagery, street views and other
open data. They are estimates, not surveys; tests/cmab-check.py measures them against the
heights OSM's mappers tagged. Nanjing's file is processed_nanjing_20201231_all (Web Mercator, 113,823 buildings).

Writes research/core/data/cmab.json: per building whose centre is in the core's bbox (the frame of
terrain.json), [height m, function, year built or '', outer ring in local metres to 0.1 m]. Holes
(courtyards) are dropped: the city's extrusion has none, and the ring keeps the courtyard's shape.
"""
import json
import math
import sys
from pathlib import Path

import shapefile                       # pyshp

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research' / 'core' / 'data'
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'E:/nanjing-geodata/cmab/nanjing')
R = 6378137.0

terrain = json.loads((DATA / 'terrain.json').read_text(encoding='utf-8'))
o_lat, o_lon = terrain['origin_wgs84']
kx, ky = 111_320.0 * math.cos(math.radians(o_lat)), 110_574.0
S, W, N, E = 32.028, 118.728, 32.158, 118.867          # as tools/research/area-prep.py


def local(X, Y):
    lon = math.degrees(X / R)
    lat = math.degrees(2 * math.atan(math.exp(Y / R)) - math.pi / 2)
    return (lon - o_lon) * kx, (lat - o_lat) * ky, lat, lon


def simplify(pts, tol=0.5):
    """Douglas-Peucker on a closed ring: the rooftops are traced along image pixels, a stair of
    corners every metre that the city's flat extrusion only pays for in triangles."""
    def dp(a):
        if len(a) < 3:
            return a
        (x0, y0), (x1, y1) = a[0], a[-1]
        L = math.hypot(x1 - x0, y1 - y0) or 1e-9
        d = [abs((x1 - x0) * (y0 - y) - (x0 - x) * (y1 - y0)) / L for x, y in a[1:-1]]
        k = max(range(len(d)), key=d.__getitem__)
        if d[k] <= tol:
            return [a[0], a[-1]]
        return dp(a[:k + 2])[:-1] + dp(a[k + 1:])
    far = max(range(len(pts)), key=lambda i: math.dist(pts[0], pts[i]))
    return dp(pts[:far + 1])[:-1] + dp(pts[far:] + [pts[0]])[:-1]


def area(pts):
    return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))


r = shapefile.Reader(str(next(SRC.glob('processed_nanjing_*.shp'))), encoding='utf-8')
out, funcs, dropped = [], {}, {'outside': 0, 'tiny': 0, 'no height': 0}
for sr in r.iterShapeRecords():
    s, rec = sr.shape, sr.record
    if not s.points:
        continue
    ends = list(s.parts[1:]) + [len(s.points)]
    rings = [s.points[a:b] for a, b in zip(s.parts, ends)]
    # The outer ring: the largest (shapefile outer rings run clockwise, holes anticlockwise).
    ring = max(rings, key=lambda q: abs(area(q)))
    pts = [local(X, Y) for X, Y in ring]
    lat = sum(p[2] for p in pts) / len(pts)
    lon = sum(p[3] for p in pts) / len(pts)
    if not (S < lat < N and W < lon < E):
        dropped['outside'] += 1
        continue
    xy = [(round(p[0], 1), round(p[1], 1)) for p in pts]
    if xy[0] == xy[-1]:
        xy = xy[:-1]
    xy = simplify(xy) if len(xy) > 4 else xy
    if len(xy) < 3 or abs(area(xy)) < 12:
        dropped['tiny'] += 1
        continue
    h = rec['Height']
    if not h or h != h or h <= 0:
        dropped['no height'] += 1
        continue
    f = rec['Function'] or ''
    funcs[f] = funcs.get(f, 0) + 1
    out.append([round(float(h), 1), f, rec['Age'] or '', [list(p) for p in xy]])

(DATA / 'cmab.json').write_text(json.dumps({
    'source': 'CMAB (Zhang et al., Scientific Data 2025; figshare 27992417), CC BY 4.0. Rooftops from '
              'satellite imagery; height, function and age estimated by machine learning, not surveyed.',
    'frame': 'local metres, origin and scale of terrain.json',
    'fields': ['height_m', 'function', 'year', 'ring'],
    'buildings': out,
}, separators=(',', ':')), encoding='utf-8')
hs = sorted(b[0] for b in out)
print('CMAB core', len(out), 'buildings; dropped', dropped)
print('functions', funcs)
print('height median', hs[len(hs) // 2], 'p90', hs[int(len(hs) * .9)], 'max', hs[-1])
print('corners', sum(len(b[3]) for b in out))
print('size MB', round((DATA / 'cmab.json').stat().st_size / 1e6, 1))
