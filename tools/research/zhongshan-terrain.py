"""Crop the Copernicus GLO-30 tile to the Zhongshan slice and write a Blender-ready heightfield.

Copernicus is a surface model: canopy and roofs are included, so forested slopes read
10-25 m high. Blender grading flattens the paved axis, plazas and the Music Stage bowl;
this script only crops and reprojects, it never edits heights.

    python -P tools/research/zhongshan-terrain.py

Writes research/zhongshan/data/terrain.npy (float32 metres, row 0 = north) and
terrain.json (extent, local metre grid, sampled landmark heights).
"""
import json
import math
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research' / 'zhongshan' / 'data'
TILE = DATA / 'cop30_N32_E118.tif'

# Slice extent (WGS84). Covers Meiling, Music Stage, the Mausoleum axis and the ridge behind.
SOUTH, NORTH, WEST, EAST = 32.040, 32.072, 118.828, 118.866
# Local origin: the Bo'ai archway (OSM node 12345226894). East = +x, north = +y, metres.
ORIGIN = (32.0587677, 118.8486466)

# Point anchors from the OSM extract (way centroids or nodes), for sampling only.
ANCHORS = {
    'boai_arch': (32.0587677, 118.8486466),
    'tomb_gate': (32.06223148, 118.8483997),
    'stele_pavilion': (32.0626349, 118.84838934),
    'sacrificial_hall': (32.06436138, 118.84826112),
    'music_stage': (32.057341364705884, 118.85026735882353),
    'meiling_palace': (32.04769156, 118.84149932666666),
}


def local_metres(lat, lon):
    k = 111_320.0
    return ((lon - ORIGIN[1]) * k * math.cos(math.radians(ORIGIN[0])), (lat - ORIGIN[0]) * 110_574.0)


def main():
    with tifffile.TiffFile(TILE) as tif:
        page = tif.pages[0]
        z = page.asarray().astype(np.float32)
        scale = page.tags['ModelPixelScaleTag'].value
        tie = page.tags['ModelTiepointTag'].value
    dx, dy = scale[0], scale[1]
    lon0, lat0 = tie[3], tie[4]  # upper-left corner of pixel (0, 0)

    def px(lat, lon):
        return (lat0 - lat) / dy, (lon - lon0) / dx

    r0, c0 = (int(math.floor(v)) for v in px(NORTH, WEST))
    r1, c1 = (int(math.ceil(v)) for v in px(SOUTH, EAST))
    crop = z[r0:r1 + 1, c0:c1 + 1]

    def sample(lat, lon):
        r, c = px(lat, lon)
        r -= r0
        c -= c0
        i, j = int(r), int(c)
        fr, fc = r - i, c - j
        q = crop[i:i + 2, j:j + 2]
        return float(q[0, 0] * (1 - fr) * (1 - fc) + q[0, 1] * (1 - fr) * fc
                     + q[1, 0] * fr * (1 - fc) + q[1, 1] * fr * fc)

    north_lat = lat0 - r0 * dy
    west_lon = lon0 + c0 * dx
    south_lat = north_lat - (crop.shape[0] - 1) * dy
    east_lon = west_lon + (crop.shape[1] - 1) * dx
    x0, y1 = local_metres(north_lat, west_lon)
    x1, y0 = local_metres(south_lat, east_lon)

    np.save(DATA / 'terrain.npy', crop)
    meta = {
        'source': 'Copernicus GLO-30 DEM (DSM), tile N32 E118. © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018, provided under COPERNICUS by the European Union and ESA.',
        'note': 'Surface model: includes canopy and roofs. Heights are metres above EGM2008.',
        'shape_rows_cols': list(crop.shape),
        'extent_wgs84': {'north': north_lat, 'south': south_lat, 'west': west_lon, 'east': east_lon},
        'origin_wgs84': ORIGIN,
        'extent_local_m': {'x_west': x0, 'x_east': x1, 'y_south': y0, 'y_north': y1},
        'min_m': float(crop.min()),
        'max_m': float(crop.max()),
        'anchors': {k: {'local_m': [round(v, 1) for v in local_metres(*p)], 'dsm_m': round(sample(*p), 1)}
                    for k, p in ANCHORS.items()},
    }
    (DATA / 'terrain.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding='utf-8')
    print(json.dumps({k: meta[k] for k in ('shape_rows_cols', 'extent_local_m', 'min_m', 'max_m', 'anchors')}, indent=1))


if __name__ == '__main__':
    main()
