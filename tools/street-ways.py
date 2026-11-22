"""Street ways for the city's traffic (design/STREET-LIFE-PLAN.md): the drivable surface roads of
research/core/data/features.json, written to public/scenes/core/streets.json for src/world-traffic.js.

Kept: motorway to living street and their links (OSM `highway`). Left out: service roads, footways and
paths; tunnels; anything on a layer other than 0 (the elevated roads, whose decks the walk grid does not
carry). Each way: [class, oneway, lanes, [x0, z0, x1, z1, ...]] in the browser's frame (x east,
z = -north, metres to 0.1); oneway 1 along the points, -1 against them, 0 both ways; lanes 0 where OSM
maps none.

    python tools/street-ways.py
"""
import json
import math
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'research/core/data/features.json'
OUT = ROOT / 'public/scenes/core/streets.json'
CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential', 'living_street',
           'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link']


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
    OUT.write_text(json.dumps({'classes': CLASSES, 'ways': ways}, separators=(',', ':')), encoding='utf-8')
    print(f'{len(ways)} ways, {OUT.stat().st_size // 1024} KB; left out {dropped}')
    for k in CLASSES:
        if k in metres:
            print(f'  {k:15s} {metres[k] / 1000:7.1f} km')


if __name__ == '__main__':
    main()
