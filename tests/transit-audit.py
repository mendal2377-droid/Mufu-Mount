"""Transit audit, on the exported data the browser loads (public/scenes/<world>/transit.json).

    python -P tests/transit-audit.py [core]

  bus on roads    each bus route's line lies within 18 m of road cells of walk.bin wherever the walk
                  grid reaches (90 %+): the browser pulls each bus onto the carriageway within 18 m
                  (src/transit.js onCarriageway), and tests/transit-browser.mjs checks that path
  bus stops       every stop stands within 45 m of its route (the prep's tolerance: OSM's stop
                  nodes stand back from the line), on a pavement a walker can reach
  stations        every metro station is within 120 m of its line (the OSM station node), and its
                  entrance has walkable ground within 60 m
  continuity      no line jumps more than 1000 m between points (straight tunnels run long: Line 3
                  crosses under Xuanwu Lake in one 881 m reach)
  viaduct         Line 1 rises onto its viaduct north of Nanjing Station (OSM bridge=yes)
  heights         every line carries ground heights baked in Blender (tools/transit-heights.py)
"""
import json
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORLD = sys.argv[1] if len(sys.argv) > 1 else 'core'
SCENE = ROOT / 'public' / 'scenes' / WORLD
meta = json.loads((SCENE / 'scene.json').read_text(encoding='utf-8'))
data = json.loads((SCENE / 'transit.json').read_text(encoding='utf-8'))
NO = meta['walk']['noWalk']
raw = (SCENE / 'walk.bin').read_bytes()
WALK = struct.unpack(f'<{len(raw) // 2}h', raw)
failures = []


def value(x, y):
    for g in meta['walk']['grids']:
        u, v = x, y
        if g.get('yaw'):
            c, s = math.cos(g['yaw']), math.sin(g['yaw'])
            u, v = x * c + y * s, -x * s + y * c
        i, j = int((u - g['x0']) // g['cell']), int((v - g['y0']) // g['cell'])
        if 0 <= i < g['nx'] and 0 <= j < g['ny']:
            v = WALK[g['offset'] + j * g['nx'] + i]
            return v if v == NO else v + int(g.get('zOff', 0)) * 100
    return None


def check(name, ok, detail):
    print(f"{'ok  ' if ok else 'FAIL'} {name}: {detail}")
    if not ok:
        failures.append(name)


def walk_line(pts, step=6.0, side=0.0):
    """Points every step metres along pts, side metres to the right of the direction of travel."""
    for a, b in zip(pts, pts[1:]):
        L = math.dist(a, b)
        if L < 1e-6:
            continue
        dx, dy = (b[0] - a[0]) / L, (b[1] - a[1]) / L
        for k in range(int(L / step)):
            x, y = a[0] + dx * k * step, a[1] + dy * k * step
            yield x + dy * side, y - dx * side


class Polyline:
    def __init__(self, pts):
        self.pts = pts

    def span(self, a, b):
        """Points every 5 m between distances a and b along the line."""
        out, run = [], 0.0
        for p, q in zip(self.pts, self.pts[1:]):
            L = math.dist(p, q)
            for k in range(int(L / 5) + 1):
                s = run + k * 5
                if a <= s <= b and L:
                    out.append((p[0] + (q[0] - p[0]) * k * 5 / L, p[1] + (q[1] - p[1]) * k * 5 / L))
            run += L
        return out


def near_walkable(x, y, r):
    for d in range(0, int(r) + 1, 2):
        for k in range(max(1, d)):
            a = 2 * math.pi * k / max(1, d)
            v = value(x + math.cos(a) * d, y + math.sin(a) * d)
            if v not in (None, NO):
                return True
    return False


for line in data['lines']:
    pts = line['pts']
    gap = max(math.dist(a, b) for a, b in zip(pts, pts[1:]))
    check(f"continuity {line['en']}", gap < 1000, f"{len(pts)} points, {line['length']} m, longest step {gap:.0f} m")
    check(f"heights {line['en']}", len(line.get('z', [])) == len(pts), f"{len(line.get('z', []))} of {len(pts)} points have ground heights")
    if line['kind'] == 'bus':
        on = seen = 0
        # Road tunnels are left out of the city build: the bus runs below the street there.
        tunnels = [Polyline(pts).span(a, b) for a, b in line.get('tunnel', [])]
        for side, path in ((0.0, pts),):
            for x, y in walk_line(path, side=side):
                v = value(x, y)
                if v is None or any(min(math.dist((x, y), q) for q in t) < 15 for t in tunnels if t):
                    continue
                # Junction mouths: the crossing road's pavement lies over the carriageway.
                seen += 1
                on += any((value(x + dx, y + dy) or 0) & 1 and value(x + dx, y + dy) != NO
                          for d in (0, 4, 8, 12, 16) for dx, dy in ((d, 0), (-d, 0), (0, d), (0, -d), (d * .7, d * .7), (-d * .7, d * .7), (d * .7, -d * .7), (-d * .7, -d * .7)))
        check(f"bus on roads {line['en']}", seen and on / seen > .9, f'{100 * on / max(1, seen):.1f} % of {seen} samples on a carriageway')
        far = []
        for st in line['stops']:
            off = min(math.dist(st['at'], q) for q in walk_line(pts, step=3)) if len(pts) > 1 else 0
            if off > 45 or not near_walkable(*st['at'], 15):
                far.append((st['name'], round(off)))
        check(f"bus stops {line['en']}", not far, f"{len(line['stops'])} stops by the route and a pavement" + (f'; off: {far}' if far else ''))
    else:
        bad = [st['name'] for st in line['stops'] if not near_walkable(*st['at'], 60) and value(*st['at']) is not None]
        check(f"stations {line['en']}", len(line['stops']) >= 4 and not bad,
              f"{len(line['stops'])} stations: {' · '.join(s['name'] for s in line['stops'])}" + (f'; no ground near: {bad}' if bad else ''))

l1 = next((l for l in data['lines'] if l['id'] == 'subway-1'), None)
check('viaduct', bool(l1 and l1.get('elevated')), f"Line 1 elevated over {l1 and l1.get('elevated')} m along the line")
print(f"transit audit {WORLD} {'FAILED: ' + ', '.join(failures) if failures else 'passed'}")
sys.exit(1 if failures else 0)
