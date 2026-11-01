"""The detailed Mufu Mountain model (the app's own morning walk, public/world) merged into Tiny
Nanjing at its real place (research/mufu-merge/FACTS.md).

The model was built in its own frame: three.js metres, y up, its Yangtze promenade starting at the
origin. Placed so the promenade runs between the two memorials OSM maps at its ends (草鞋峡 in the
west, 燕子矶江滩 in the east), it needs a 0.943 horizontal scale and a 0.4 degree turn. Heights keep
their metres; the model's river level (0) is set on the city's Yangtze.

    parts = load()                         # [(material name, colour, positions Nx3, triangles Mx3)]
    zone = coverage(parts, extent)          # Mask of the land the model covers
    objects = build(parts, collection, z0)  # Blender meshes, one per material
"""
import json
import math
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[1]
WORLD = ROOT / 'public' / 'world'

# The promenade's ends in the model (x, north) and the memorials in the city frame (OSM nodes
# 草鞋峡遇难同胞纪念碑 and 燕子矶江滩遇难同胞纪念碑, metres from Xinjiekou).
MODEL_A, MODEL_B = np.array([0.0, 0.0]), np.array([4732.0, 3629.0])
CITY_A, CITY_B = np.array([-1647.0, 8552.0]), np.array([2793.0, 12007.0])
_va, _vb = MODEL_B - MODEL_A, CITY_B - CITY_A
SCALE = float(np.linalg.norm(_vb) / np.linalg.norm(_va))
TURN = math.atan2(_vb[1], _vb[0]) - math.atan2(_va[1], _va[0])
_R = np.array([[math.cos(TURN), -math.sin(TURN)], [math.sin(TURN), math.cos(TURN)]])

# What the model's own surfaces are, for the walk grid: ground, paving, timber and paths are
# walkable; leaves, railings, lamps, hedges and ships are not.
WALKABLE = ('Field |', 'Hike |', 'Woodland floor', 'Grass', 'Light granite promenade', 'Mufu limestone', 'Weathered timber',
            'Yongji Avenue asphalt', 'Older blue leisure lane')
NOT_WALKABLE = ('railing', 'barrier', 'balustrade', 'silver metal', 'road stripe')
ROADS = ('Yongji Avenue asphalt', 'Older blue leisure lane')
# Parts that say where the model's land is (the wide grass apron and loose foliage do not).
LAND = ('Field |', 'Hike |', 'Woodland floor', 'Light granite promenade', 'Mufu limestone', 'Weathered timber')


def to_city(xz):
    """Model (x, z) with z south to city (x, y north)."""
    p = np.c_[xz[:, 0], -xz[:, 1]]
    return SCALE * (p - MODEL_A) @ _R.T + CITY_A


def load():
    scene = json.loads((WORLD / 'scene.json').read_text(encoding='utf-8'))
    buf = (WORLD / 'geometry.bin').read_bytes()
    parts = {}
    for rec in scene['meshes']:
        pos = np.frombuffer(buf, dtype=np.float32, count=rec['positions']['count'], offset=rec['positions']['offset']).reshape(-1, 3)
        tri = np.frombuffer(buf, dtype=np.uint32, count=rec['indices']['count'], offset=rec['indices']['offset']).reshape(-1, 3)
        name = rec['name'].split('.')[0].strip()
        xy = to_city(pos[:, [0, 2]])
        p = np.c_[xy, pos[:, 1]]
        if name in parts:
            base = len(parts[name][2])
            parts[name][2] = np.vstack([parts[name][2], p])
            parts[name][3] = np.vstack([parts[name][3], tri + base])
        else:
            parts[name] = [name, rec['color'], p, tri.astype(np.int64)]
    # Records are [x, y, z, width, height] with an optional sixth field: position and size only.
    trees = np.array([t[:5] for t in scene['trees']], dtype=np.float64)
    tree_xy = to_city(trees[:, [0, 2]])
    return list(parts.values()), np.c_[tree_xy, trees[:, 1], trees[:, 3]]


class Coverage:
    """The model's land on a grid: cells touched by its land parts, dilated and closed."""

    def __init__(self, parts, extent, cell=8.0, grow=3, allow=None):
        self.x0, self.x1, self.y0, self.y1 = extent
        self.cell = cell
        self.nx, self.ny = int((self.x1 - self.x0) / cell) + 1, int((self.y1 - self.y0) / cell) + 1
        m = np.zeros((self.ny, self.nx), dtype=bool)
        for name, _, p, tri in parts:
            if not name.startswith(LAND):
                continue
            c = p[tri].mean(axis=1)
            for q in (c, p):
                if allow is not None:
                    q = q[np.array([allow(x, y) for x, y in q[:, :2]])]
                i = ((q[:, 0] - self.x0) / cell).astype(int)
                j = ((q[:, 1] - self.y0) / cell).astype(int)
                ok = (i >= 0) & (j >= 0) & (i < self.nx) & (j < self.ny)
                m[j[ok], i[ok]] = True
        for _ in range(grow):
            m = _dilate(m)
        for _ in range(grow - 1):
            m = _erode(m)
        self.m = m

    def at(self, x, y):
        i, j = int((x - self.x0) / self.cell), int((y - self.y0) / self.cell)
        return 0 <= i < self.nx and 0 <= j < self.ny and bool(self.m[j, i])

    def bbox(self):
        js, is_ = np.nonzero(self.m)
        return (self.x0 + is_.min() * self.cell, self.x0 + (is_.max() + 1) * self.cell,
                self.y0 + js.min() * self.cell, self.y0 + (js.max() + 1) * self.cell)


def _dilate(m):
    out = m.copy()
    out[1:] |= m[:-1]; out[:-1] |= m[1:]; out[:, 1:] |= m[:, :-1]; out[:, :-1] |= m[:, 1:]
    return out


def _erode(m):
    out = m.copy()
    out[1:] &= m[:-1]; out[:-1] &= m[1:]; out[:, 1:] &= m[:, :-1]; out[:, :-1] &= m[:, 1:]
    return out


def material(name, colour):
    """The model's own colour under its own name; walkable surfaces flagged for the walk grid."""
    key = 'mufu ' + name
    m = bpy.data.materials.get(key)
    if m:
        return m
    m = bpy.data.materials.new(key)
    m.use_nodes = True
    rgba = (*[max(0.0, min(1.0, c)) for c in colour[:3]], 1.0)
    m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = rgba
    m.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = 0.9
    m.diffuse_color = rgba
    low = name.lower()
    m['walkable'] = name.startswith(WALKABLE) and not any(w in low for w in NOT_WALKABLE)
    # Roads a bike keeps to: the model's Yongji Avenue and its blue leisure lane, and OSM's mountain
    # roads laid in the same asphalt (drape_paths).
    m['road'] = name in ROADS
    return m


def build(parts, coll, z0, keep, drop=None):
    """One Blender mesh per material, the model's heights lifted by z0 (its river onto the city's).
    keep(x, y): which triangles to keep (inside the model's land, inside the map); drop(name, x, y):
    which of those to leave out after all (its hike paths on the mountain, where OSM's are true)."""
    objects = []
    for name, colour, p, tri in parts:
        c = p[tri].mean(axis=1)
        mask = np.array([keep(x, y) and not (drop and drop(name, x, y)) for x, y in c[:, :2]])
        tri = tri[mask]
        if not len(tri):
            continue
        used, inv = np.unique(tri.ravel(), return_inverse=True)
        me = bpy.data.meshes.new('Mufu ' + name)
        verts = p[used].copy()
        verts[:, 2] += z0
        me.from_pydata(verts.tolist(), [], inv.reshape(-1, 3).tolist())
        me.materials.append(material(name, colour))
        for poly in me.polygons:
            poly.use_smooth = False
        o = bpy.data.objects.new('Mufu ' + name, me)
        coll.objects.link(o)
        objects.append(o)
    return objects


class Heights:
    """The model's walkable ground height at (x, y), from a BVH of its land parts."""

    def __init__(self, objects):
        verts, polys = [], []
        for o in objects:
            if not o.active_material or not o.active_material.get('walkable'):
                continue
            base = len(verts)
            verts += [v.co.copy() for v in o.data.vertices]
            polys += [[base + i for i in f.vertices] for f in o.data.polygons]
        self.tree = BVHTree.FromPolygons(verts, polys) if polys else None

    def at(self, x, y):
        if not self.tree:
            return None
        hit = self.tree.ray_cast(Vector((x, y, 900.0)), Vector((0, 0, -1)))
        return hit[0].z if hit[0] is not None else None


# OSM's ways on the mountain, by kind: width (m) and which of the model's own surfaces they take.
PATHS = {
    'residential': (5.0, 'Yongji Avenue asphalt'), 'service': (4.0, 'Yongji Avenue asphalt'),
    'unclassified': (5.0, 'Yongji Avenue asphalt'), 'tertiary': (6.0, 'Yongji Avenue asphalt'),
    'track': (3.0, 'Hike | earth and leaf litter'), 'path': (1.8, 'Hike | earth and leaf litter'),
    'footway': (2.2, 'Hike | weathered limestone paving'), 'steps': (2.0, 'Hike | weathered limestone paving'),
    'pedestrian': (3.0, 'Hike | weathered limestone paving'), 'cycleway': (2.2, 'Hike | weathered limestone paving'),
    'secondary': (9.0, 'Yongji Avenue asphalt'), 'primary': (10.0, 'Yongji Avenue asphalt'),
    'trunk': (12.0, 'Yongji Avenue asphalt'),
}
# City roads carried into the model where they meet it (build_core.py, the links to its own roads).
LINKS = ('trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'service')


def drape_paths(ways, inside, heights, colours, coll, step=2.0, grade=None):
    """OSM's roads, paths and steps on the mountain, laid over the model's ground as walkable
    ribbons in the model's own path materials. Only the stretches where inside(x, y).
    Returns metres laid, by kind. With grade (rise per metre), each ribbon is graded: never below
    the ground, never steeper than grade, rising early to meet higher ground ahead (a city road
    meeting the model's Yongji Avenue on its 1 m embankment)."""
    from collections import defaultdict
    runs = defaultdict(list)
    laid = defaultdict(float)
    for w in ways:
        kind = w.get('kind')
        if kind not in PATHS or len(w['pts']) < 2:
            continue
        # Tunnels stay underground (the Yanziji Yangtze tunnel runs under the mountain).
        t = w.get('tags', {})
        if t.get('tunnel') or str(t.get('layer', '0')).startswith('-'):
            continue
        dense = []
        for a, b in zip(w['pts'], w['pts'][1:]):
            n = max(1, int(math.dist(a, b) / step))
            dense += [(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) for k in range(n)]
        dense.append(tuple(w['pts'][-1]))
        run = []
        for q in dense + [None]:
            if q is not None and inside(*q) and heights.at(*q) is not None:
                run.append(q)
                continue
            if len(run) >= 3:
                runs[kind].append(run)
                laid[kind] += sum(math.dist(a, b) for a, b in zip(run, run[1:]))
            run = []
    for kind, rs in runs.items():
        width, surface = PATHS[kind]
        bm = bmesh.new()
        for run in rs:
            left, right = _offset(run, width / 2), _offset(run, -width / 2)
            if grade:
                # The highest ground across the ribbon at each point, then eased both ways so no
                # stretch is steeper than the grade.
                z = []
                for c0, l, r in zip(run, left, right):
                    hs = [h for h in (heights.at(*c0), heights.at(*l), heights.at(*r)) if h is not None]
                    z.append(max(hs))
                for k in range(len(z) - 2, -1, -1):
                    z[k] = max(z[k], z[k + 1] - grade * math.dist(run[k], run[k + 1]))
                for k in range(1, len(z)):
                    z[k] = max(z[k], z[k - 1] - grade * math.dist(run[k], run[k - 1]))
            row = []
            for l, r in zip(left, right):
                if grade:
                    hl = hr = z[len(row)]
                else:
                    hl, hr = heights.at(*l), heights.at(*r)
                    hc = heights.at(*run[len(row)])
                    hl = hl if hl is not None else hc
                    hr = hr if hr is not None else hc
                row.append((bm.verts.new((l[0], l[1], hl + .07)), bm.verts.new((r[0], r[1], hr + .07))))
            for (a, b), (c, d) in zip(row, row[1:]):
                bm.faces.new((a, b, d, c))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for f in bm.faces:
            if f.normal.z < 0:
                f.normal_flip()
        me = bpy.data.meshes.new(f'Mufu OSM {kind}')
        bm.to_mesh(me)
        bm.free()
        me.materials.append(material(surface, colours.get(surface, (.4, .38, .34))))
        coll.objects.link(bpy.data.objects.new(f'Mufu OSM {kind}', me))
    return dict(laid)


def _offset(pts, d):
    out = []
    for i, p in enumerate(pts):
        a, b = pts[max(0, i - 1)], pts[min(len(pts) - 1, i + 1)]
        L = math.dist(a, b) or 1.0
        out.append((p[0] - (b[1] - a[1]) / L * d, p[1] + (b[0] - a[0]) / L * d))
    return out


def cut_ponds(objects, ponds, point_in_poly):
    """Remove the model's faces inside each pond (polygons in the city frame), so the real water
    shows: the model has none of Mufu Mountain's ponds and reservoirs (劳山水库 and others)."""
    boxes = [(min(x for x, _ in w), max(x for x, _ in w), min(y for _, y in w), max(y for _, y in w), w) for w in ponds]
    for o in objects:
        bm = bmesh.new()
        bm.from_mesh(o.data)
        doomed = []
        for f in bm.faces:
            # Any corner in the pond: faces straddling the shore covered its edge.
            pts = [f.calc_center_median()] + [v.co for v in f.verts]
            if any(x0 < c.x < x1 and y0 < c.y < y1 and point_in_poly(c.x, c.y, w) for x0, x1, y0, y1, w in boxes for c in pts):
                doomed.append(f)
        if doomed:
            bmesh.ops.delete(bm, geom=doomed, context='FACES')
            bm.to_mesh(o.data)
        bm.free()


def river_level(lakes, levels, point_in_poly):
    """The city's level for the Yangtze in front of the promenade (a point 250 m off its middle)."""
    mid = to_city(np.array([[2366.0, -1815.0]]))[0]
    side = _R @ np.array([-0.61, 0.79])
    q = mid + side * 250
    for k, (w, z) in enumerate(zip(lakes, levels)):
        if point_in_poly(q[0], q[1], w):
            return z, k
    return None, None
