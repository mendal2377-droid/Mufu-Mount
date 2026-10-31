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
          + ''.join(f'\n       {100 * s:.0f} % water: {n} ({k} samples)' for s, n, k in sorted(worst)[:8]))
    # Banks: just outside the water's edge the ground should not be lower than the water surface.
    low = total = 0
    for w in feats['water'][:400]:
        pts = w['pts']
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
    check('banks', total == 0 or low / total < .05, f'{low} of {total} bank samples lie below their water')

# --- waterways: rivers and canals are continuous --------------------------------------------------
if WATER is not None:
    gaps = []
    on = seen = 0
    for w in feats['ways']:
        if w.get('kind') != 'waterway' or w.get('tags', {}).get('waterway') not in ('river', 'canal'):
            continue
        run = 0
        for a, b in zip(w['pts'], w['pts'][1:]):
            L = math.dist(a, b)
            for k in range(max(1, int(L / 6))):
                x, y = a[0] + (b[0] - a[0]) * k / max(1, int(L / 6)), a[1] + (b[1] - a[1]) * k / max(1, int(L / 6))
                v = value(WATER, x, y)
                if v is None:
                    continue
                seen += 1
                wet = v != NO or value(WALK, x, y) not in (None, NO)    # water, or a bridge deck over it
                on += wet
                run = 0 if wet else run + 6
                if run == 30:
                    gaps.append((w['name'] or w['id'], round(x), round(y)))
    check('waterways', seen == 0 or on / seen > .9 and len(gaps) < 6,
          f'{on} of {seen} centreline samples are water or bridge; gaps of 30 m+: {gaps[:6]}')

# --- trees and lamps: not in water, not on a carriageway -----------------------------------------
wet_trees = road_trees = 0
examples = []
for kind, x3, y3, z3, *_ in trees:
    x, y = x3, -z3
    if kind == 'far':
        continue
    # Lotus grows in the water on purpose.
    if WATER is not None and kind not in ('lotus', 'lotus_flower') and value(WATER, x, y) not in (None, NO):
        wet_trees += 1
        examples.append((kind, 'water', round(x), round(y)))
    v = value(WALK, x, y)
    # The trunk stamps its own cell unwalkable, so look at the ring round it for road.
    ring = [value(WALK, x + dx, y + dy) for dx, dy in ((2.5, 0), (-2.5, 0), (0, 2.5), (0, -2.5))]
    # Road cells exist only in exports that mark them (walk.roads); older ones have no meaning here.
    if meta['walk'].get('roads') and kind != 'lamp' and sum(1 for r in ring if r not in (None, NO) and r & 1) >= 3:
        road_trees += 1
        examples.append((kind, 'road', round(x), round(y)))
check('trees', wet_trees + road_trees <= max(5, len(trees) // 2000),
      f'{wet_trees} in water, {road_trees} on a carriageway, of {len(trees)}; e.g. {examples[:5]}')

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

print('audit', WORLD, 'FAILED: ' + ', '.join(failures) if failures else 'ok')
sys.exit(1 if failures else 0)
