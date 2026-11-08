"""How far to trust CMAB's estimated heights (research/core/data/cmab.json), and what they can fill.

    python -P tests/cmab-check.py

Matches CMAB rooftops to OSM buildings (one contains the other's centre) and compares CMAB's height
with the height OSM's mappers tagged (`height`, else `building:levels` x 3.3 m). Then counts the
OSM buildings with no tagged height that CMAB could give one, and the CMAB rooftops that no OSM
building covers: the real buildings that can stand where the build now invents infill blocks.
"""
import json
import math
import statistics
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'research' / 'core' / 'data'
F = json.loads((DATA / 'features.json').read_text(encoding='utf-8'))
C = json.loads((DATA / 'cmab.json').read_text(encoding='utf-8'))['buildings']
G = 50.0


def num(v):
    try:
        return float(str(v).split()[0].replace('m', ''))
    except (ValueError, TypeError, IndexError):
        return None


def inside(x, y, pts):
    c = False
    for (ax, ay), (bx, by) in zip(pts, pts[1:] + pts[:1]):
        if (ay > y) != (by > y) and x < ax + (y - ay) * (bx - ax) / (by - ay):
            c = not c
    return c


def centre(pts):
    return sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)


def area(pts):
    return abs(0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1])))


grid = defaultdict(list)
for k, (h, f, yr, ring) in enumerate(C):
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    for i in range(int(min(xs) // G), int(max(xs) // G) + 1):
        for j in range(int(min(ys) // G), int(max(ys) // G) + 1):
            grid[i, j].append(k)
cent = [centre(b[3]) for b in C]

osm = [b for b in F['buildings'] if not b['tags'].get('building:part') and (num(b['tags'].get('layer')) or 0) >= 0]
pairs, untagged, untagged_hit, covered = [], 0, 0, set()
fits, hit_by, seen = [], defaultdict(int), []
for b in osm:
    pts = b['pts'][:-1] if b['pts'][0] == b['pts'][-1] else b['pts']
    if len(pts) < 3:
        continue
    cx, cy = centre(pts)
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    near = {k for i in range(int(min(xs) // G), int(max(xs) // G) + 1) for j in range(int(min(ys) // G), int(max(ys) // G) + 1) for k in grid[i, j]}
    hits = [k for k in near if inside(cx, cy, C[k][3]) or inside(*cent[k], pts)]
    covered.update(hits)
    seen.append((area(pts), bool(hits)))
    if len(hits) == 1:
        fits.append((hits[0], area(pts)))
    for k in hits:
        hit_by[k] += 1
    t = b['tags']
    tagged = num(t.get('height')) or (num(t.get('building:levels')) or 0) * 3.3
    if not tagged:
        untagged += 1
        untagged_hit += bool(hits)
    elif hits:
        # The CMAB rooftop that best matches in size (OSM often maps a block CMAB splits, or the reverse).
        a = area(pts)
        k = min(hits, key=lambda k: abs(math.log(max(area(C[k][3]), 1) / max(a, 1))))
        pairs.append((tagged, C[k][0], a))

err = [c - o for o, c, _ in pairs]
ab = sorted(abs(e) for e in err)
print(f'matched {len(pairs)} OSM buildings with a tagged height')
print(f'  CMAB - OSM: median {statistics.median(err):+.1f} m, median |error| {ab[len(ab) // 2]:.1f} m, '
      f'90% within {ab[int(len(ab) * .9)]:.1f} m, RMSE {math.sqrt(sum(e * e for e in err) / len(err)):.1f} m')
for lo, hi in ((0, 12), (12, 24), (24, 45), (45, 100), (100, 1000)):
    e = [c - o for o, c, _ in pairs if lo <= o < hi]
    if e:
        a = sorted(abs(v) for v in e)
        print(f'  tagged {lo}-{hi} m: {len(e)} buildings, median CMAB - OSM {statistics.median(e):+.1f} m, median |error| {a[len(a) // 2]:.1f} m')
print(f'OSM without a tagged height: {untagged}; CMAB gives {untagged_hit} of them one ({100 * untagged_hit / max(untagged, 1):.0f}%)')
free = [k for k in range(len(C)) if k not in covered]
print(f'CMAB rooftops no OSM building covers: {len(free)} of {len(C)}, {sum(area(C[k][3]) for k in free) / 1e6:.2f} km2')


def perimeter(pts):
    return sum(math.dist(a, b) for a, b in zip(pts, pts[1:] + pts[:1]))


# Footprint size: one-to-one matches (each the other's only match). The outward offset d that would
# make a CMAB outline as big as its OSM building is (A_osm - A_cmab) / perimeter, near enough.
one = [(k, a) for k, a in fits if hit_by[k] == 1]
ratio = sorted(area(C[k][3]) / a for k, a in one if a > 0)
grow = sorted((a - area(C[k][3])) / perimeter(C[k][3]) for k, a in one)
print(f'footprints, {len(one)} one-to-one matches: CMAB area / OSM area median {statistics.median(ratio):.2f} '
      f'(middle half {ratio[len(ratio) // 4]:.2f}-{ratio[3 * len(ratio) // 4]:.2f}); '
      f'outward offset to match median {statistics.median(grow):+.2f} m (middle half {grow[len(grow) // 4]:+.2f} to {grow[3 * len(grow) // 4]:+.2f})')
for lo, hi in ((0, 200), (200, 600), (600, 2000), (2000, 1e9)):
    g = sorted((a - area(C[k][3])) / perimeter(C[k][3]) for k, a in one if lo <= a < hi)
    if g:
        print(f'  OSM footprint {lo:.0f}-{hi:.0f} m2: {len(g)}, offset median {statistics.median(g):+.2f} m')

# Recall: of the buildings OSM maps, how many CMAB found at all (by count and by footprint area).
for lo, hi in ((0, 100), (100, 300), (300, 1000), (1000, 1e9)):
    g = [hit for a, hit in seen if lo <= a < hi]
    if g:
        print(f'  CMAB finds {100 * sum(g) / len(g):.0f}% of the {len(g)} OSM buildings of {lo:.0f}-{hi:.0f} m2')
print(f'CMAB finds {100 * sum(h for _, h in seen) / len(seen):.0f}% of OSM buildings, '
      f'{100 * sum(a for a, h in seen if h) / sum(a for a, _ in seen):.0f}% of their footprint area')
