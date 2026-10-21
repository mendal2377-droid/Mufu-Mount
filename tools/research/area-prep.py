"""Prepare a landmark area for Blender: DEM crop + OSM features in local metres.

    python -P tools/research/area-prep.py north
    python -P tools/research/area-prep.py oldsouth

Reads the Copernicus tile (research/zhongshan/data/cop30_N32_E118.tif covers all of central
Nanjing) and research/<area>/data/osm-<area>.json; writes research/<area>/data/terrain.npy,
terrain.json and features.json. Local frame: metres from the area origin, x east, y north.
Heights are left as the DSM (canopy and roofs included); Blender grades the ground.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parents[2]
TILE = ROOT / 'research' / 'zhongshan' / 'data' / 'cop30_N32_E118.tif'

AREAS = {
    # Origin: Jiming's Yaoshi Pagoda (atlas anchor, OSM way 319055520).
    'north': {'bbox': (32.056, 118.778, 32.088, 118.812), 'origin': (32.0630502, 118.79003095)},
    # Origin: the Qinhuai/Fuzimiao atlas anchor (OSM way 1531638749).
    # Origin: the Presidential Palace atlas anchor (OSM way 62353727).
    'palace': {'bbox': (32.038, 118.784, 32.054, 118.800), 'origin': (32.04622025, 118.79225685)},
    'oldsouth': {'bbox': (32.006, 118.766, 32.028, 118.794), 'origin': (32.02273535, 118.7836028)},
}


def main(area):
    cfg = AREAS[area]
    data = ROOT / 'research' / area / 'data'
    s, w, n, e = cfg['bbox']
    o_lat, o_lon = cfg['origin']
    kx = 111_320.0 * math.cos(math.radians(o_lat))
    local = lambda lat, lon: (round((lon - o_lon) * kx, 2), round((lat - o_lat) * 110_574.0, 2))  # noqa: E731

    with tifffile.TiffFile(TILE) as tif:
        page = tif.pages[0]
        z = page.asarray().astype(np.float32)
        dx, dy = page.tags['ModelPixelScaleTag'].value[:2]
        lon0, lat0 = page.tags['ModelTiepointTag'].value[3:5]
    r0, c0 = int((lat0 - n) / dy), int((w - lon0) / dx)
    r1, c1 = int(math.ceil((lat0 - s) / dy)), int(math.ceil((e - lon0) / dx))
    crop = z[r0:r1 + 1, c0:c1 + 1]
    north_lat, west_lon = lat0 - r0 * dy, lon0 + c0 * dx
    south_lat, east_lon = north_lat - (crop.shape[0] - 1) * dy, west_lon + (crop.shape[1] - 1) * dx
    x0, y1 = local(north_lat, west_lon)
    x1, y0 = local(south_lat, east_lon)
    np.save(data / 'terrain.npy', crop)
    (data / 'terrain.json').write_text(json.dumps({
        'source': 'Copernicus GLO-30 DEM (DSM), tile N32 E118. © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA.',
        'shape_rows_cols': list(crop.shape), 'origin_wgs84': cfg['origin'],
        'extent_local_m': {'x_west': x0, 'x_east': x1, 'y_south': y0, 'y_north': y1},
        'min_m': float(crop.min()), 'max_m': float(crop.max())}, indent=1), encoding='utf-8')

    osm = json.loads((data / f'osm-{area}.json').read_text(encoding='utf-8'))
    feats = {'water': [], 'islands': [], 'wall': [], 'buildings': [], 'ways': [], 'bridges': [], 'places': []}

    def ring(geom):
        return [local(p['lat'], p['lon']) for p in geom]

    for el in osm['elements']:
        t = el.get('tags', {})
        name = t.get('name', '')
        if el['type'] == 'node':
            feats['places'].append({'id': el['id'], 'name': name, 'tags': t, 'p': local(el['lat'], el['lon'])})
            continue
        if el['type'] == 'relation':
            if t.get('natural') == 'water' or t.get('water') or t.get('landuse') == 'reservoir':
                for m in el.get('members', []):
                    if m.get('geometry'):
                        (feats['water'] if m['role'] == 'outer' else feats['islands']).append(
                            {'id': el['id'], 'name': name, 'pts': ring(m['geometry'])})
            continue
        g = el.get('geometry')
        if not g:
            continue
        pts = ring(g)
        closed = g[0] == g[-1]
        rec = {'id': el['id'], 'name': name, 'pts': pts}
        if t.get('natural') == 'water' or t.get('water') or t.get('waterway') in ('riverbank',):
            feats['water'].append(rec)
        elif t.get('waterway') in ('river', 'canal', 'stream'):
            feats['ways'].append({**rec, 'kind': 'waterway', 'tags': {k: t[k] for k in ('waterway', 'width') if k in t}})
        elif t.get('barrier') == 'city_wall' or t.get('historic') in ('citywalls', 'city_wall'):
            feats['wall'].append(rec)
        elif t.get('building') or t.get('building:part'):
            feats['buildings'].append({**rec, 'tags': {k: t[k] for k in ('building', 'building:levels', 'height', 'amenity',
                                                                        'historic', 'tourism', 'religion', 'roof:shape') if k in t}})
        elif t.get('bridge') and t.get('highway'):
            feats['bridges'].append({**rec, 'tags': {k: t[k] for k in ('highway', 'bridge', 'layer') if k in t}})
        elif t.get('highway'):
            feats['ways'].append({**rec, 'kind': t['highway']})
        elif t.get('place') == 'islet' or t.get('place') == 'island':
            feats['islands'].append(rec)
        elif closed and (t.get('leisure') or t.get('landuse') or t.get('amenity') or t.get('tourism') or t.get('historic')):
            feats['places'].append({'id': el['id'], 'name': name, 'tags': {k: t[k] for k in ('leisure', 'landuse', 'amenity', 'tourism', 'historic', 'religion') if k in t},
                                    'pts': pts})
    (data / 'features.json').write_text(json.dumps(feats, ensure_ascii=False), encoding='utf-8')
    print(area, {k: len(v) for k, v in feats.items()}, 'extent', round(x0), round(x1), round(y0), round(y1))


if __name__ == '__main__':
    main(sys.argv[1])
