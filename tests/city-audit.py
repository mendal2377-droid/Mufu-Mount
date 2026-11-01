"""City systems audit, on the exported data the browser loads (public/scenes/<world>/).

    python -P tests/city-audit.py [core]

Each system gets its own check, so a regression is caught here instead of by riding into it:

  water         every OSM lake and river is water in water.bin (sampled inside each polygon), and
                its surface sits below the ground on its banks
  waterways     rivers and canals run continuously: samples along each OSM waterway centreline
                are water (or a bridge over it)
  trees         no tree or lamp stands in water or on a carriageway (trees.json against water.bin
                and the road cells of walk.bin)
  walkability   every spawn, seat and gate is on walkable ground, and all of them are reachable on
                foot from the first spawn (a flood fill over the walk grid, steps up to STEP_UP)

Roads have their own audit (tests/road-audit.py); buildings and trees against buildings are
checked in Blender (tools/scene-audit.py), where the geometry is.
"""
import json
import math
import struct
import sys
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORLD = sys.argv[1] if len(sys.argv) > 1 else 'core'
SCENE = ROOT / 'public' / 'scenes' / WORLD
STEP_UP = 0.65            # src/landmark-world.js: the largest step a walker takes

meta = json.loads((SCENE / 'scene.json').read_text(encoding='utf-8'))
NO = meta['walk']['noWalk']


def load(name):
    p = SCENE / name
    if not p.exists():
        return None
    raw = p.read_bytes()
    return struct.unpack(f'<{len(raw) // 2}h', raw)


WALK, WATER = load('walk.bin'), load('water.bin')
feats_path = ROOT / 'research' / WORLD / 'data' / 'features.json'
feats = json.loads(feats_path.read_text(encoding='utf-8')) if feats_path.exists() else {'water': [], 'ways': [], 'islands': []}
trees = json.loads((SCENE / 'trees.json').read_text(encoding='utf-8'))
failures = []


def index(x, y):
    """(grid, i, j, flat index) for Blender (x, y), or None outside every grid."""
    for g in meta['walk']['grids']:
        u, v = x, y
        if g.get('yaw'):
            c, s = math.cos(g['yaw']), math.sin(g['yaw'])
            u, v = x * c + y * s, -x * s + y * c
        i, j = int((u - g['x0']) // g['cell']), int((v - g['y0']) // g['cell'])
        if 0 <= i < g['nx'] and 0 <= j < g['ny']:
            return g, i, j, g['offset'] + j * g['nx'] + i
    return None


def value(grid, x, y):
    k = index(x, y)
    return None if k is None or grid is None else grid[k[3]]


def inside(x, y, pts):
    c = False
    for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]):
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            c = not c
    return c


def check(name, ok, detail):
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {detail}")
    if not ok:
        failures.append(name)


# --- water: lakes and rivers are water, and below their banks -----------------------------------
if WATER is None:
    print('--   water: no water.bin for this world')
else:
    islands = [w['pts'] for w in feats.get('islands', [])]
    covered = sampled = 0
    worst = []
    for w in feats['water']:
        pts = w['pts']
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        step = max(6.0, min(max(xs) - min(xs), max(ys) - min(ys)) / 12)
        here = hits = 0
        y = min(ys) + step / 2
        while y < max(ys):
            x = min(xs) + step / 2
            while x < max(xs):
                if index(x, y) and inside(x, y, pts) and not any(inside(x, y, i) for i in islands):
                    here += 1
                    hits += value(WATER, x, y) not in (None, NO)
                x += step
            y += step
        sampled += here
        covered += hits
        if here >= 8 and hits / here < .8:
            worst.append((hits / here, w['name'] or w['id'], here))
        if sampled > 200000:
            break
    share = covered / max(sampled, 1)
    check('water', share > .9, f'{100 * share:.1f} % of {sampled} points inside OSM water are water'
          + ''.join(f'\n       {100 * s:.0f} % water: {n} ({k} samples)' for s, n, k in sorted(worst, key=lambda t: t[0])[:8]))
    # Banks: just outside the water's edge the ground should not be lower than the water surface.
    low = total = 0
    small = []
    for w in feats['water'][:400]:
        pts = w['pts']
        # Below the ground's resolution: the terrain is laid on a 24 m grid (blender/build_core.py),
        # so a pond under about two cells across (2500 m²) cannot have its banks shaped; Mufu
        # Mountain's 10-60 m ponds were the case. Listed, not failed.
        area = abs(sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))) / 2
        if area < 2500:
            small.append(w['id'])
            continue
        for a, b in zip(pts[::5], pts[5::5]):
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            wz = value(WATER, mx, my)
            if wz in (None, NO):
                continue
            dx, dy = b[1] - a[1], a[0] - b[0]
            n = math.hypot(dx, dy) or 1
            for side in (1, -1):
                gx, gy = mx + side * dx / n * 6, my + side * dy / n * 6
                gz = value(WALK, gx, gy)
                if gz not in (None, NO) and not inside(gx, gy, pts):
                    total += 1
                    low += gz < wz - 30      # centimetres
    check('banks', total == 0 or low / total < .05, f'{low} of {total} bank samples lie below their water'
          f' ({len(small)} ponds under 2500 m² are below the 24 m ground grid, not sampled)')

# --- waterways: rivers and canals are continuous --------------------------------------------------
# Building footprints on a 4 m grid, for the culvert rule shared with blender/build_core.py.
HOUSES = {}
for bld in feats.get('buildings', []):
    xs, ys = [q[0] for q in bld['pts']], [q[1] for q in bld['pts']]
    for gx in range(int(min(xs) // 4), int(max(xs) // 4) + 1):
        for gy in range(int(min(ys) // 4), int(max(ys) // 4) + 1):
            HOUSES.setdefault((gx, gy), []).append(bld['pts'])


def near_edge(x, y, margin=60.0):
    """Within margin of the map's edge (the Yangtze leaves the map there)."""
    clip = meta.get('skyline_clip')
    if not clip:
        return False
    x0, x1, z0, z1 = clip
    return x < x0 + margin or x > x1 - margin or -y < z0 + margin or -y > z1 - margin


def under_house(x, y):
    return any(inside(x, y, pts) for pts in HOUSES.get((int(x // 4), int(y // 4)), ()))


if WATER is not None:
    gaps = []
    on = seen = 0
    for w in feats['ways']:
        if w.get('kind') != 'waterway' or w.get('tags', {}).get('waterway') not in ('river', 'canal'):
            continue
        if w['tags'].get('tunnel') or w['tags'].get('layer', '0').startswith('-'):
            continue                                 # culverts run underground
        run = 0
        for a, b in zip(w['pts'], w['pts'][1:]):
            L = math.dist(a, b)
            for k in range(max(1, int(L / 6))):
                x, y = a[0] + (b[0] - a[0]) * k / max(1, int(L / 6)), a[1] + (b[1] - a[1]) * k / max(1, int(L / 6))
                v = value(WATER, x, y)
                if v is None or under_house(x, y) or near_edge(x, y):
                    continue                     # a river under a mapped building is culverted there
                seen += 1
                # Water, or a bridge deck over it; OSM's centrelines and water areas disagree by up
                # to about 10 m (the Nanshili ditch, 南十里长沟), so water within 12 m counts.
                wet = v != NO or value(WALK, x, y) not in (None, NO) or any(
                    value(WATER, x + dx, y + dy) not in (None, NO) for dx, dy in ((12, 0), (-12, 0), (0, 12), (0, -12), (8, 8), (-8, -8), (8, -8), (-8, 8)))
                on += wet
                run = 0 if wet else run + 6
                if run == 30:
                    gaps.append((w['name'] or w['id'], round(x), round(y)))
    check('waterways', seen == 0 or on / seen > .9 and len(gaps) <= max(5, seen // 1500),
          f'{on} of {seen} centreline samples are water or bridge; gaps of 30 m+: {gaps[:6]}')

# --- trees and lamps: not in water, not on a carriageway -----------------------------------------
wet_trees = road_trees = 0
examples = []
for kind, x3, y3, z3, *_ in trees:
    x, y = x3, -z3
    if kind == 'far':
        continue
    # Lotus grows in the water on purpose, and lamps over water stand on bridges.
    if WATER is not None and kind not in ('lotus', 'lotus_flower', 'lamp') and value(WATER, x, y) not in (None, NO):
        wet_trees += 1
        examples.append((kind, 'water', round(x), round(y)))
    v = value(WALK, x, y)
    # The trunk stamps its own cell unwalkable, so look at the ring round it for road.
    # Only where the grid can tell a 3 m pavement from the road beside it (cells up to 2.5 m); on
    # the coarser grids the build's last pass is the guarantee: it removes any tree whose foot
    # stands on a road surface (blender/build_core.py, the cull under roofs and on roads).
    k = index(x, y)
    ring = [value(WALK, x + dx, y + dy) for dx, dy in ((2.5, 0), (-2.5, 0), (0, 2.5), (0, -2.5))] if k and k[0]['cell'] <= 2.5 else []
    # Road cells exist only in exports that mark them (walk.roads); older ones have no meaning here.
    if meta['walk'].get('roads') and kind != 'lamp' and sum(1 for r in ring if r not in (None, NO) and r & 1) >= 3:
        road_trees += 1
        examples.append((kind, 'road', round(x), round(y)))
check('trees', wet_trees + road_trees <= max(5, len(trees) // 2000),
      f'{wet_trees} in water, {road_trees} on a carriageway, of {len(trees)}; e.g. {examples[:5]}')

# --- lamps: none standing in a carriageway, measured against the OSM centrelines ------------------
# The walk grid cannot tell: a pavement strip laid over a road reads as pavement there. So this
# measures each lamp against the mapped roads themselves (widths as blender/build_core.py WIDTH,
# lanes x 3.4 m where tagged), 1 m inside the kerb. The owner saw lamps mid-road on divided avenues.
FEATURES = ROOT / 'research' / WORLD / 'data' / 'features.json'
if FEATURES.exists():
    WIDTH = {'trunk': 26.0, 'primary': 22.0, 'secondary': 15.0, 'tertiary': 11.0, 'residential': 7.0, 'unclassified': 7.0,
             'living_street': 5.5, 'service': 4.5, 'primary_link': 8.0, 'secondary_link': 7.0, 'trunk_link': 9.0, 'tertiary_link': 6.0}
    F = json.loads(FEATURES.read_text(encoding='utf-8'))
    segs = {}
    for w in F.get('ways', []) + F.get('bridges', []):
        t = w.get('tags', {})
        kind = w.get('kind') or t.get('highway')
        if kind not in WIDTH or t.get('tunnel') or str(t.get('layer', '0')).lstrip('-').isdigit() and int(t.get('layer', 0)) < 0:
            continue
        try:
            lanes = float(str(t.get('lanes', '')).split(';')[0])
        except ValueError:
            lanes = 0
        half = max(WIDTH[kind], lanes * 3.4) / 2
        if t.get('oneway') in ('yes', '-1', '1'):
            half = (lanes * 3.4 if lanes else max(WIDTH[kind] / 2, 6.0)) / 2
        for a, b in zip(w['pts'], w['pts'][1:]):
            for i in range(int(min(a[0], b[0]) // 40) - 1, int(max(a[0], b[0]) // 40) + 2):
                for j in range(int(min(a[1], b[1]) // 40) - 1, int(max(a[1], b[1]) // 40) + 2):
                    segs.setdefault((i, j), []).append((a, b, half))

    def in_road(x, y):
        for a, b, half in segs.get((int(x // 40), int(y // 40)), ()):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L2 = dx * dx + dy * dy
            s = 0.0 if L2 == 0 else max(0.0, min(1.0, ((x - a[0]) * dx + (y - a[1]) * dy) / L2))
            if math.hypot(x - a[0] - dx * s, y - a[1] - dy * s) < half - 1.0:
                return True
        return False
    lamps = [(x3, -z3) for kind, x3, y3, z3, *_ in trees if kind == 'lamp']
    mid = [(round(x), round(y)) for x, y in lamps if in_road(x, y)]
    check('lamps', len(mid) <= max(5, len(lamps) // 500), f'{len(mid)} of {len(lamps)} lamps stand in a carriageway; e.g. {mid[:5]}')

# --- walkability: markers on walkable ground and reachable from the first spawn -----------------
markers = []
for group in ('spawns', 'seats', 'bells', 'docks'):
    for k, s in (meta.get(group) or {}).items():
        markers.append((f'{group[:-1]} {k}', s['position'][0], -s['position'][2]))
for n, g in enumerate(meta.get('gates') or []):
    markers.append((f"gate {n}->{g['target']}", g['position'][0], -g['position'][2]))
off = [m[0] for m in markers if value(WALK, m[1], m[2]) in (None, NO) and not m[0].startswith('dock')]
check('markers', not off, f'{len(markers) - len(off)} of {len(markers)} on walkable ground' + (f'; off: {off}' if off else ''))

start = next((m for m in markers if m[0].startswith('spawn') and value(WALK, m[1], m[2]) not in (None, NO)), None)
if start:
    k0 = index(start[1], start[2])
    g = k0[0]
    seen_cells = {k0[3]}
    q = deque([(k0[1], k0[2])])
    while q:
        i, j = q.popleft()
        h = WALK[g['offset'] + j * g['nx'] + i]
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            a, b = i + di, j + dj
            if 0 <= a < g['nx'] and 0 <= b < g['ny']:
                c = g['offset'] + b * g['nx'] + a
                if c not in seen_cells and WALK[c] != NO and abs(WALK[c] - h) <= STEP_UP * 100:
                    seen_cells.add(c)
                    q.append((a, b))
    same = [m for m in markers if index(m[1], m[2]) and index(m[1], m[2])[0] is g and not m[0].startswith('dock')]
    unreached = [m[0] for m in same if index(m[1], m[2])[3] not in seen_cells]
    # Gates and glides link the grids; on one grid everything should be reachable on foot.
    check('reachable', len(unreached) <= max(1, len(same) // 5),
          f'{len(same) - len(unreached)} of {len(same)} markers on the {g["name"]} grid reachable on foot from {start[0]}'
          + (f'; not: {unreached}' if unreached else ''))

# --- Mufu Mountain is reachable on foot from the city: Wutang Square to the hike's start ----------
# A flood fill on a 4 m lattice across every walk grid (each with its own step height), so the
# merged mountain is joined to the streets and the Line 3 stations, not an island.
if meta.get('spawns', {}).get('mufu') and meta['spawns'].get('wutang'):
    def step_up(x, y):
        k = index(x, y)
        return (k[0].get('stepUp') or STEP_UP) * 100 if k else STEP_UP * 100
    a, b = meta['spawns']['wutang']['position'], meta['spawns']['mufu']['position']
    sx, sy, tx, ty = a[0], -a[2], b[0], -b[2]
    lat = 4.0
    seen_m = {(0, 0)}
    q = deque([(0, 0)])
    found = False
    while q and not found:
        i, j = q.popleft()
        x, y = sx + i * lat, sy + j * lat
        h = value(WALK, x, y)
        if h in (None, NO):
            continue
        for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            n = (i + di, j + dj)
            if n in seen_m:
                continue
            nx_, ny_ = sx + n[0] * lat, sy + n[1] * lat
            if not (-3000 < nx_ < 4000 and 6500 < ny_ < 12500):
                continue
            v = value(WALK, nx_, ny_)
            if v not in (None, NO) and abs(v - h) <= max(step_up(x, y), step_up(nx_, ny_)):
                seen_m.add(n)
                q.append(n)
                if math.hypot(nx_ - tx, ny_ - ty) < 8:
                    found = True
                    break
    check('mufu reachable', found, f"Mufu Mountain's hike start {'is' if found else 'is not'} reachable on foot from Wutang Square ({len(seen_m)} cells explored)")

print('audit', WORLD, 'FAILED: ' + ', '.join(failures) if failures else 'ok')
sys.exit(1 if failures else 0)
