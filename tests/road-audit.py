"""Road audit for Tiny Nanjing: is every carriageway open?

    python -P tests/road-audit.py [core]

Walks every OSM vehicle road in research/<world>/data/features.json along its centreline, every
5 m, and looks the point up in the exported walk grid (public/scenes/<world>/walk.bin):

  open     the cell is walkable and marked as road (odd centimetre, blender/export_web.py)
  paved    walkable but not marked road (a pavement or a crossing road's kerb lies over it)
  blocked  not walkable at all: something stands on the road (a building, a wall, a tree)

Tunnels and bridges are skipped (their decks are not at ground level in the grid). Prints the
share of each and the worst stretches with their coordinates, and fails if more than 1 % of the
samples are blocked, so a building on a road (an infill slab, an underground station drawn above
ground) is caught here instead of by riding into it.
"""
import json
import math
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORLD = sys.argv[1] if len(sys.argv) > 1 else 'core'
ROADS = {'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street',
         'primary_link', 'secondary_link', 'trunk_link', 'tertiary_link'}

meta = json.loads((ROOT / 'public' / 'scenes' / WORLD / 'scene.json').read_text(encoding='utf-8'))
raw = (ROOT / 'public' / 'scenes' / WORLD / 'walk.bin').read_bytes()
H = struct.unpack(f'<{len(raw) // 2}h', raw)
feats = json.loads((ROOT / 'research' / WORLD / 'data' / 'features.json').read_text(encoding='utf-8'))
NO = meta['walk']['noWalk']


def cell(x, y):
    """Walk-grid value at Blender (x, y), or None outside every grid."""
    for g in meta['walk']['grids']:
        u, v = x, y
        if g.get('yaw'):
            c, s = math.cos(g['yaw']), math.sin(g['yaw'])
            u, v = x * c + y * s, -x * s + y * c
        i, j = int((u - g['x0']) // g['cell']), int((v - g['y0']) // g['cell'])
        if 0 <= i < g['nx'] and 0 <= j < g['ny']:
            return H[g['offset'] + j * g['nx'] + i]
    return None


counts = {'open': 0, 'paved': 0, 'blocked': 0}
stretches = []
for w in feats['ways'] + feats['bridges']:
    kind = w.get('kind') or w.get('tags', {}).get('highway')
    t = w.get('tags', {})
    if kind not in ROADS or t.get('tunnel') or t.get('bridge'):
        continue
    run = []
    for a, b in zip(w['pts'], w['pts'][1:]):
        L = math.dist(a, b)
        for k in range(max(1, int(L / 5))):
            x, y = a[0] + (b[0] - a[0]) * k / max(1, int(L / 5)), a[1] + (b[1] - a[1]) * k / max(1, int(L / 5))
            v = cell(x, y)
            if v is None:
                continue
            state = 'blocked' if v == NO else 'open' if v & 1 else 'paved'
            counts[state] += 1
            if state == 'blocked':
                run.append((x, y))
            elif run:
                stretches.append((len(run) * 5, w['id'], t.get('name', ''), kind, run[0], run[-1]))
                run = []
    if run:
        stretches.append((len(run) * 5, w['id'], t.get('name', ''), kind, run[0], run[-1]))

# The blocked spots, for tools/road-blockers.py to name what stands on them (in Blender).
out = ROOT / 'test-results' / f'road-blocks-{WORLD}.json'
out.parent.mkdir(exist_ok=True)
out.write_text(json.dumps([{'metres': m, 'way': wid, 'name': name, 'kind': kind, 'at': [round(a[0], 1), round(a[1], 1)]}
                           for m, wid, name, kind, a, _ in sorted(stretches, reverse=True)], ensure_ascii=False), encoding='utf-8')
total = sum(counts.values()) or 1
print(WORLD, {k: f'{v} ({100 * v / total:.1f} %)' for k, v in counts.items()})
for metres, wid, name, kind, a, b in sorted(stretches, reverse=True)[:15]:
    print(f'  blocked {metres:4d} m  way {wid} {kind} {name}  from ({a[0]:.0f}, {a[1]:.0f}) to ({b[0]:.0f}, {b[1]:.0f})')
share = counts['blocked'] / total
assert share < 0.01, f'{100 * share:.1f} % of road samples are blocked'
print('roads ok')
