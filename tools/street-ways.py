"""Street ways for the city's traffic (design/STREET-LIFE-PLAN.md): the drivable surface roads of
research/core/data/features.json, written to public/scenes/core/streets.json for src/world-traffic.js.

Kept: motorway to living street and their links (OSM `highway`). Left out: service roads, footways and
paths; tunnels; anything on a layer other than 0 (the elevated roads, whose decks the walk grid does not
carry). Each way: [class, oneway, lanes, [x0, z0, x1, z1, ...]] in the browser's frame (x east,
z = -north, metres to 0.1); oneway 1 along the points, -1 against them, 0 both ways; lanes 0 where OSM
maps none.

Junctions with traffic lights: [x, z, mapped]. OSM maps 120 signal nodes here
(research/core/data/osm-core-signals.json, Overpass, 23 Nov 2026), far fewer than the city has, so
crossings of main roads get lights too, by our rule: two ways crossing at more than 30 degrees, both
secondary or bigger, or a primary and a tertiary (mapped = 0). Points within 35 m are one junction.

    python tools/street-ways.py
"""
import json
import math
import pathlib
from collections import defaultdict

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'research/core/data/features.json'
OUT = ROOT / 'public/scenes/core/streets.json'
SIGNALS = ROOT / 'research/core/data/osm-core-signals.json'
LAT0, LON0 = 32.0418, 118.7838   # the core's origin (scene.json); the flat projection of blender/zhongshan_merge.py
CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street',
           'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']


RANK = {'trunk': 3, 'motorway': 3, 'primary': 3, 'secondary': 2, 'tertiary': 1}


def crossing(p, q, r, s):
    """Where segments pq and rs cross, or None."""
    d = (q[0] - p[0]) * (s[1] - r[1]) - (q[1] - p[1]) * (s[0] - r[0])
    if abs(d) < 1e-9:
        return None
    t = ((r[0] - p[0]) * (s[1] - r[1]) - (r[1] - p[1]) * (s[0] - r[0])) / d
    u = ((r[0] - p[0]) * (q[1] - p[1]) - (r[1] - p[1]) * (q[0] - p[0])) / d
    if -0.02 <= t <= 1.02 and -0.02 <= u <= 1.02:
        return (p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1]))
    return None


def junctions(ways):
    """Signal junctions: OSM's mapped signals, and crossings of main roads (our rule)."""
    pts = []
    kx = 111320 * math.cos(math.radians(LAT0))
    for e in json.loads(SIGNALS.read_text(encoding='utf-8'))['elements']:
        pts.append(((e['lon'] - LON0) * kx, -(e['lat'] - LAT0) * 110574, 1))
    segs, grid = [], defaultdict(list)
    for wi, (cls, _, _, flat) in enumerate(ways):
        rank = RANK.get(CLASSES[cls], 0)
        if not rank:
            continue
        for i in range(0, len(flat) - 2, 2):
            a, b = (flat[i], flat[i + 1]), (flat[i + 2], flat[i + 3])
            k = len(segs)
            segs.append((wi, rank, a, b))
            for gx in range(int(min(a[0], b[0]) // 100), int(max(a[0], b[0]) // 100) + 1):
                for gz in range(int(min(a[1], b[1]) // 100), int(max(a[1], b[1]) // 100) + 1):
                    grid[(gx, gz)].append(k)
    seen = set()
    for cell in grid.values():
        for i in range(len(cell)):
            for j in range(i + 1, len(cell)):
                k1, k2 = sorted((cell[i], cell[j]))
                (w1, r1, a, b), (w2, r2, c, d) = segs[k1], segs[k2]
                if w1 == w2 or (k1, k2) in seen:
                    continue
                seen.add((k1, k2))
                if not (min(r1, r2) >= 2 or (max(r1, r2) >= 3 and min(r1, r2) >= 1)):
                    continue
                u, v = (b[0] - a[0], b[1] - a[1]), (d[0] - c[0], d[1] - c[1])
                cos = abs(u[0] * v[0] + u[1] * v[1]) / (math.hypot(*u) * math.hypot(*v) or 1)
                if cos > math.cos(math.radians(30)):
                    continue
                x = crossing(a, b, c, d)
                if x:
                    pts.append((x[0], x[1], 0))
    # One junction for the points within 35 m of each other; mapped if any of its points is.
    out = []
    for x, z, m in sorted(pts, key=lambda p: -p[2]):
        for j in out:
            if math.hypot(j[0] - x, j[1] - z) < 35:
                j[3] += 1
                j[0] += (x - j[0]) / j[3]
                j[1] += (z - j[1]) / j[3]
                j[2] = max(j[2], m)
                break
        else:
            out.append([x, z, m, 1])
    return [[round(x, 1), round(z, 1), m] for x, z, m, _ in out]


def main():
    feats = json.loads(SRC.read_text(encoding='utf-8'))
    ways, dropped, metres = [], {'tunnel': 0, 'layer': 0}, {}
    for w in feats['ways']:
        kind, tags = w.get('kind'), w.get('tags') or {}
        if kind not in CLASSES or len(w['pts']) < 2:
            continue
        if tags.get('tunnel') not in (None, 'no'):
            dropped['tunnel'] += 1
            continue
        try:
            layer = int(tags.get('layer', '0'))
        except ValueError:
            layer = 0
        if layer != 0:
            dropped['layer'] += 1
            continue
        oneway = {'yes': 1, 'true': 1, '1': 1, '-1': -1}.get(tags.get('oneway'), 0)
        if kind in ('motorway', 'motorway_link') and 'oneway' not in tags:
            oneway = 1   # OSM: a motorway and its links are one way unless tagged otherwise
        try:
            lanes = max(0, min(8, int(str(tags.get('lanes', '0')).split(';')[0])))
        except ValueError:
            lanes = 0
        flat = []
        for x, n in w['pts']:
            flat += [round(x, 1), round(-n, 1)]
        ways.append([CLASSES.index(kind), oneway, lanes, flat])
        p = w['pts']
        metres[kind] = metres.get(kind, 0) + sum(math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]) for i in range(1, len(p)))
    lights = junctions(ways)
    OUT.write_text(json.dumps({'classes': CLASSES, 'ways': ways, 'junctions': lights}, separators=(',', ':')), encoding='utf-8')
    print(f'{len(ways)} ways, {len(lights)} signal junctions ({sum(j[2] for j in lights)} with a mapped signal), '
          f'{OUT.stat().st_size // 1024} KB; left out {dropped}')
    for k in CLASSES:
        if k in metres:
            print(f'  {k:15s} {metres[k] / 1000:7.1f} km')


if __name__ == '__main__':
    main()
