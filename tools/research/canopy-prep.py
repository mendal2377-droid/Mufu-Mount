"""Tree canopy over the city core, from Meta and WRI's 1 m canopy height map (CC BY 4.0).

    python -P tools/research/canopy-prep.py E:/nanjing-geodata/canopy-meta

The source tiles (s3://dataforgood-fb-data/forests/v1/alsgedi_global_v6_float/chm/<quadkey>.tif,
quadkeys 132103222 and 132103223 over Nanjing) are Web Mercator, 1.194 m pixels (about 1.0 m on
the ground at 32 N), canopy height in whole metres. Each is 65,536 pixels square, 4.3 GB raw, so
only the deflate strips over the core are decoded.

Writes research/core/data/canopy.npz on the core's 4 m grid (the frame of terrain.json):
  cover   per cell, the share of its 16 one-metre samples under canopy taller than 3 m (0-255)
  height  per cell, the tallest sample in metres
and canopy.json with the extent and the source's credit.
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import tifffile

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'research' / 'core' / 'data'
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'E:/nanjing-geodata/canopy-meta')
TILES = ('132103222', '132103223')
R = 6378137.0
CELL = 4.0
SUB = 4                    # samples per cell side, one metre apart
TALL = 3                   # metres: shrubs and hedges below this are not canopy

terrain = json.loads((DATA / 'terrain.json').read_text(encoding='utf-8'))
o_lat, o_lon = terrain['origin_wgs84']
kx, ky = 111_320.0 * math.cos(math.radians(o_lat)), 110_574.0
# The core's own bbox (tools/research/area-prep.py), in its local metres.
S, W, N, E = 32.028, 118.728, 32.158, 118.867
x0, x1 = (W - o_lon) * kx, (E - o_lon) * kx
y0, y1 = (S - o_lat) * ky, (N - o_lat) * ky
nx, ny = int((x1 - x0) / CELL), int((y1 - y0) / CELL)


def merc(lat, lon):
    return R * np.radians(lon), R * np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))


def window(q):
    """The tile's rows over the core, decoded strip by strip: (array, first row, X0, Y0, scale)."""
    with tifffile.TiffFile(SRC / f'{q}.tif') as t:
        p = t.pages[0]
        sc = p.tags['ModelPixelScaleTag'].value[0]
        X0, Y0 = p.tags['ModelTiepointTag'].value[3:5]
        _, ytop = merc(N + 0.002, W)
        _, ybot = merc(S - 0.002, W)
        r0, r1 = max(0, int((Y0 - ytop) / sc)), min(p.shape[0], int((Y0 - ybot) / sc) + 1)
        rps = p.rowsperstrip
        out = np.zeros((r1 - r0, p.shape[1]), np.uint8)
        fh = t.filehandle
        for s in range(r0 // rps, (r1 - 1) // rps + 1):
            fh.seek(p.dataoffsets[s])
            seg, _, _ = p.decode(fh.read(p.databytecounts[s]), s)
            seg = seg.reshape(-1, p.shape[1])
            a = s * rps
            lo, hi = max(a, r0), min(a + seg.shape[0], r1)
            out[lo - r0:hi - r0] = seg[lo - a:hi - a]
        return out, r0, X0, Y0, sc


cover = np.zeros((ny, nx), np.uint16)
height = np.zeros((ny, nx), np.uint8)
xs = x0 + (np.arange(nx) + 0.5) * CELL
for q in TILES:
    win, r0, X0, Y0, sc = window(q)
    print(q, 'rows', r0, r0 + win.shape[0], 'canopy > 3 m', round(float((win > TALL).mean()) * 100, 1), '%', flush=True)
    for j in range(ny):
        yc = y0 + (j + 0.5) * CELL
        for sy in range(SUB):
            lat = o_lat + (yc + (sy + 0.5) * CELL / SUB - CELL / 2) / ky
            for sx in range(SUB):
                lon = o_lon + (xs + (sx + 0.5) * CELL / SUB - CELL / 2) / kx
                X, Y = merc(lat, lon)
                c = ((X - X0) / sc).astype(np.int64)
                r = int((Y0 - Y) / sc) - r0
                inside = (c >= 0) & (c < win.shape[1]) & (0 <= r < win.shape[0])
                if not inside.any():
                    continue
                v = np.zeros(nx, np.uint8)
                v[inside] = win[r, c[inside]]
                cover[j] += v > TALL
                np.maximum(height[j], v, out=height[j])
cover = np.minimum(255, cover * 255 // (SUB * SUB)).astype(np.uint8)
np.savez_compressed(DATA / 'canopy.npz', cover=cover, height=height)
(DATA / 'canopy.json').write_text(json.dumps({
    'source': 'High Resolution Canopy Height Maps by WRI and Meta (Tolan et al. 2024), CC BY 4.0; '
              'quadkeys ' + ', '.join(TILES) + '. Imagery mostly 2018-2020: a snapshot, not today.',
    'cell': CELL, 'rows_cols': [ny, nx], 'extent_local_m': {'x_west': x0, 'x_east': x1, 'y_south': y0, 'y_north': y1},
    'cover': f'share of {SUB * SUB} one-metre samples per cell under canopy over {TALL} m, 0-255',
    'height': 'tallest sample per cell, metres'}, indent=1), encoding='utf-8')
print('canopy', ny, 'x', nx, 'cells; under canopy', round(float((cover > 127).mean()) * 100, 1), '% of cells')
