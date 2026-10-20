"""Turn OSM tall buildings and their 3D parts into skyline solids in one city-wide frame.

    python -P tools/research/skyline-prep.py

Input: research/skyline/data/osm-tall.json (Overpass: buildings and building:parts with height or
levels in central Nanjing) and the Copernicus tile. Output: research/skyline/data/solids.json, a list
of {name, pts (local metres), z0 (ground, absolute DSM metres), min_h, h, kind}.

Simple 3D Buildings rules: a building outline that contains parts is not drawn itself (the parts
are); a part spans min_height..height above the ground. Only towers of 60 m or more are kept: the
lower city is already drawn inside each world from its own OSM extract.
City frame: metres from Xinjiekou (32.0418 N, 118.7838 E), x east, y north.
"""
import json
import math
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research' / 'skyline' / 'data'
TILE = ROOT / 'research' / 'zhongshan' / 'data' / 'cop30_N32_E118.tif'
ORIGIN = (32.0418, 118.7838)
MIN_H = 60.0


def num(v):
    try:
        return float(str(v).split()[0].replace('m', '').replace(',', '.'))
    except (ValueError, TypeError, IndexError):
        return None


def main():
    with tifffile.TiffFile(TILE) as tif:
        page = tif.pages[0]
        dem = page.asarray().astype(np.float32)
        dx, dy = page.tags['ModelPixelScaleTag'].value[:2]
        lon0, lat0 = page.tags['ModelTiepointTag'].value[3:5]

    def ground(lat, lon):
        # Bare ground near a tower: the minimum of the DSM over ~150 m (roofs and canopy excluded).
        r, c = int((lat0 - lat) / dy), int((lon - lon0) / dx)
        if not (2 <= r < dem.shape[0] - 2 and 2 <= c < dem.shape[1] - 2):
            # South of 32 N (Hexi's Financial City) is off this tile: the Yangtze floodplain there
            # is flat at about 9 m, which is all a skyline needs.
            return 9.0
        return float(dem[r - 2:r + 3, c - 2:c + 3].min())

    kx = 111_320.0 * math.cos(math.radians(ORIGIN[0]))

    def local(p):
        return (round((p['lon'] - ORIGIN[1]) * kx, 2), round((p['lat'] - ORIGIN[0]) * 110_574.0, 2))

    osm = json.loads((DATA / 'osm-tall.json').read_text(encoding='utf-8'))
    parts, outlines = [], []
    for e in osm['elements']:
        t = e.get('tags', {})
        g = e.get('geometry')
        if e['type'] == 'relation':
            outer = [m for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
            g = outer[0]['geometry'] if outer else None
        if not g or len(g) < 4:
            continue
        h = num(t.get('height'))
        if h is None and t.get('building:levels'):
            h = (num(t['building:levels']) or 0) * 3.6
        if not h:
            continue
        mh = num(t.get('min_height'))
        if mh is None and t.get('building:min_level'):
            mh = (num(t['building:min_level']) or 0) * 3.6
        rec = {'id': e['id'], 'name': t.get('name', ''), 'name_en': t.get('name:en', ''), 'g': g, 'h': h, 'min_h': mh or 0.0,
               'roof': t.get('roof:shape', ''), 'colour': t.get('building:colour', '')}
        (parts if 'building:part' in t else outlines).append(rec)

    def inside(pt, poly):
        x, y = pt
        res = False
        for i in range(len(poly)):
            (x1, y1), (x2, y2) = poly[i], poly[i - 1]
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1 + 1e-12) + x1:
                res = not res
        return res

    part_centres = [((sum(p['lon'] for p in r['g']) / len(r['g'])), (sum(p['lat'] for p in r['g']) / len(r['g']))) for r in parts]
    solids = []
    for r in outlines:
        poly = [(p['lon'], p['lat']) for p in r['g']]
        if any(inside(c, poly) for c in part_centres):
            continue          # drawn by its parts
        if r['h'] >= MIN_H:
            solids.append(r)
    # Keep every part that belongs to a tall stack (any part of it reaches MIN_H nearby).
    tall_centres = [(sum(p['lon'] for p in r['g']) / len(r['g']), sum(p['lat'] for p in r['g']) / len(r['g']))
                    for r in parts if r['h'] >= MIN_H]
    for r in parts:
        c = (sum(p['lon'] for p in r['g']) / len(r['g']), sum(p['lat'] for p in r['g']) / len(r['g']))
        if r['h'] >= MIN_H or (r['h'] >= 20 and any(abs(c[0] - t[0]) < 0.0006 and abs(c[1] - t[1]) < 0.0005 for t in tall_centres)):
            solids.append(r)
    out = []
    for r in solids:
        lat = sum(p['lat'] for p in r['g']) / len(r['g'])
        lon = sum(p['lon'] for p in r['g']) / len(r['g'])
        out.append({'id': r['id'], 'name': r['name'], 'name_en': r['name_en'], 'pts': [local(p) for p in r['g']],
                    'z0': round(ground(lat, lon), 2), 'min_h': r['min_h'], 'h': r['h'], 'roof': r['roof']})
    (DATA / 'solids.json').write_text(json.dumps({'origin_wgs84': ORIGIN, 'solids': out}, ensure_ascii=False), encoding='utf-8')
    named = sorted({(s['h'], s['name'] or s['name_en']) for s in out if s['name'] or s['name_en']}, reverse=True)[:25]
    print(len(out), 'solids;', 'tallest named:', named)


if __name__ == '__main__':
    main()
