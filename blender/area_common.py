"""Shared helpers for the city-area builds (north, oldsouth): ground, water, OSM blocks, markers.

The DEM is a surface model, so in the city it measures roofs. Bare ground is estimated as a
150 m minimum filter of the DSM, lightly blurred: right on the flat old city and lake shores,
slightly low on small hills (Jiming's hill is graded by hand where it matters).
"""
import json
import math
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

import kit

ROOT = Path(__file__).resolve().parents[1]


class Area:
    def __init__(self, name):
        self.name = name
        self.data = ROOT / 'research' / name / 'data'
        self.meta = json.loads((self.data / 'terrain.json').read_text(encoding='utf-8'))
        self.feats = json.loads((self.data / 'features.json').read_text(encoding='utf-8'))
        dsm = np.load(self.data / 'terrain.npy')
        # Bare-ground estimate: 5x5-cell minimum, then a 3x3 blur.
        pad = np.pad(dsm, 2, mode='edge')
        mins = np.min(np.stack([pad[i:i + dsm.shape[0], j:j + dsm.shape[1]] for i in range(5) for j in range(5)]), axis=0)
        pad = np.pad(mins, 1, mode='edge')
        ground = np.mean(np.stack([pad[i:i + dsm.shape[0], j:j + dsm.shape[1]] for i in range(3) for j in range(3)]), axis=0)
        self.base = float(np.percentile(ground, 3))
        self.dsm, self.bare = dsm - self.base, ground - self.base
        e = self.meta['extent_local_m']
        self.extent = (e['x_west'], e['x_east'], e['y_south'], e['y_north'])

    def _sample(self, grid, x, y):
        x0, x1, y0, y1 = self.extent
        rows, cols = grid.shape
        c = min(max((x - x0) / (x1 - x0) * (cols - 1), 0), cols - 1.001)
        r = min(max((y1 - y) / (y1 - y0) * (rows - 1), 0), rows - 1.001)
        i, j = int(r), int(c)
        fr, fc = r - i, c - j
        q = grid[i:i + 2, j:j + 2]
        return float(q[0, 0] * (1 - fr) * (1 - fc) + q[0, 1] * (1 - fr) * fc + q[1, 0] * fr * (1 - fc) + q[1, 1] * fr * fc)

    def bare_at(self, x, y):
        return self._sample(self.bare, x, y)

    def dsm_at(self, x, y):
        return self._sample(self.dsm, x, y)


# --- Polygons ----------------------------------------------------------------------------------------

def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    j = n - 1
    for i in range(n):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            inside = not inside
        j = i
    return inside


class Mask:
    """Rasterised polygon set on a regular grid for fast 'is this water?' questions."""

    def __init__(self, polys, extent, cell=4.0):
        self.x0, self.x1, self.y0, self.y1 = extent
        self.cell = cell
        self.nx = int((self.x1 - self.x0) / cell) + 1
        self.ny = int((self.y1 - self.y0) / cell) + 1
        self.m = np.zeros((self.ny, self.nx), dtype=bool)
        for poly in polys:
            ys = [p[1] for p in poly]
            for j in range(max(0, int((min(ys) - self.y0) / cell)), min(self.ny, int((max(ys) - self.y0) / cell) + 2)):
                y = self.y0 + j * cell
                xs = []
                n = len(poly)
                for i in range(n):
                    (xa, ya), (xb, yb) = poly[i], poly[(i + 1) % n]
                    if (ya > y) != (yb > y):
                        xs.append(xa + (y - ya) * (xb - xa) / (yb - ya))
                xs.sort()
                for a, b in zip(xs[0::2], xs[1::2]):
                    ia = max(0, int(math.ceil((a - self.x0) / cell)))
                    ib = min(self.nx - 1, int((b - self.x0) / cell))
                    if ib >= ia:
                        self.m[j, ia:ib + 1] ^= True

    def at(self, x, y):
        i, j = int(round((x - self.x0) / self.cell)), int(round((y - self.y0) / self.cell))
        return 0 <= i < self.nx and 0 <= j < self.ny and bool(self.m[j, i])

    def distance_ok(self, x, y, r):
        """True when no masked cell lies within r (a coarse ring test)."""
        if self.at(x, y):
            return False
        for k in range(8):
            a = k * math.pi / 4
            if self.at(x + r * math.cos(a), y + r * math.sin(a)):
                return False
        return True


def polygon_mesh(name, coll, polys, z, material, inset=0.0):
    """Flat triangulated polygons at height z (lake or canal surfaces)."""
    bm = bmesh.new()
    for poly in polys:
        pts = poly[:-1] if poly[0] == poly[-1] else poly
        if len(pts) < 3:
            continue
        vs = [bm.verts.new((x, y, z)) for x, y in pts]
        try:
            f = bm.faces.new(vs)
        except ValueError:
            continue
        bmesh.ops.triangulate(bm, faces=[f], quad_method='BEAUTY', ngon_method='EAR_CLIP')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    return kit.mesh_object(name, bm, coll, [material])


# --- Terrain -----------------------------------------------------------------------------------------

def terrain_patch(name, coll, x_range, y_range, fn, materials, step=4.0):
    """Grid terrain; fn(x, y) -> (z, material_index)."""
    nx = int((x_range[1] - x_range[0]) / step) + 1
    ny = int((y_range[1] - y_range[0]) / step) + 1
    bm = bmesh.new()
    rows, mats = [], {}
    for j in range(ny):
        y = y_range[0] + j * step
        row = []
        for i in range(nx):
            x = x_range[0] + i * step
            z, mi = fn(x, y)
            row.append(bm.verts.new((x, y, z)))
            mats[(i, j)] = mi
        rows.append(row)
    for j in range(ny - 1):
        for i in range(nx - 1):
            f = bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
            f.material_index = mats[(i, j)]
    o = kit.mesh_object(name, bm, coll, materials)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def outer_apron(name, coll, area, inners, fn, step=24.0, material='forest_floor'):
    """Coarse ground over the whole DEM crop except the detailed patches."""
    x0, x1, y0, y1 = area.extent
    x0, x1, y0, y1 = x0 + step, x1 - step, y0 + step, y1 - step
    nx, ny = int((x1 - x0) / step) + 1, int((y1 - y0) / step) + 1

    def inside(x, y, m):
        return any(a + m < x < b - m and c + m < y < d - m for (a, b), (c, d) in inners)
    bm = bmesh.new()
    grid = []
    for j in range(ny):
        y = y0 + j * step
        grid.append([bm.verts.new((x0 + i * step, y, fn(x0 + i * step, y) - (1.5 if inside(x0 + i * step, y, 12) else 0)))
                     for i in range(nx)])
    for j in range(ny - 1):
        for i in range(nx - 1):
            xa, ya = x0 + i * step, y0 + j * step
            if all(inside(px, py, step) for px, py in ((xa, ya), (xa + step, ya), (xa, ya + step), (xa + step, ya + step))):
                continue
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    o = kit.mesh_object(name, bm, coll, [material])
    for p in o.data.polygons:
        p.use_smooth = True
    return o


# --- City blocks from OSM ----------------------------------------------------------------------------

def city_blocks(name, coll, buildings, ground, keep, *, default_h=14.0, max_n=4000):
    """Extrude OSM footprints as simple painted blocks: low ones whitewashed with dark tile tops,
    tall ones pale blue-grey. keep(cx, cy) decides which footprints to draw."""
    bm = bmesh.new()
    n = 0
    for b in buildings:
        pts = b['pts'][:-1] if b['pts'][0] == b['pts'][-1] else b['pts']
        if len(pts) < 3:
            continue
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        if not keep(cx, cy):
            continue
        t = b.get('tags', {})
        try:
            h = float(t.get('height', '').split()[0]) if t.get('height') else float(t['building:levels']) * 3.2 if t.get('building:levels') else default_h
        except (ValueError, KeyError):
            h = default_h
        h = max(4.0, min(h, 260.0))
        z = ground(cx, cy)
        vs = [bm.verts.new((x, y, z - 1.0)) for x, y in pts]
        try:
            f = bm.faces.new(vs)
        except ValueError:
            continue
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
        ext = bmesh.ops.extrude_face_region(bm, geom=[f])
        top = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0, 0, h + 1.0), verts=top)
        tall = h > 24
        for e in ext['geom']:
            if isinstance(e, bmesh.types.BMFace):
                e.material_index = 1 if tall else 0
        f.material_index = 1 if tall else 0
        topf = [e for e in ext['geom'] if isinstance(e, bmesh.types.BMFace)]
        for tf in topf:
            tf.normal_update()
            if tf.normal.z > 0.9:
                tf.material_index = 2 if not tall else 1
        n += 1
        if n >= max_n:
            break
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    kit.PALETTE.setdefault('city_glass', '#B7C6D4')
    o = kit.mesh_object(name, bm, coll, ['whitewash', 'city_glass', 'tile_dark'])
    return o, n


# --- Markers -----------------------------------------------------------------------------------------

def add_point(coll, name, loc, target):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'SINGLE_ARROW'
    e.location = loc
    d = Vector(target) - Vector(loc)
    e.rotation_euler = (0, 0, math.atan2(-d.x, d.y))
    coll.objects.link(e)
    return e


def scatter(protos, trees, rnd, kinds, count, x_range, y_range, ok, ground, scale=(0.9, 1.35), clump=18.0, groves=120):
    """Clumped scatter: groves of one kind, accepted where ok(x, y)."""
    centres = [(rnd.uniform(*x_range), rnd.uniform(*y_range), rnd.choice(kinds)) for _ in range(groves)]
    placed = tries = 0
    while placed < count and tries < count * 8:
        tries += 1
        gx, gy, kind = rnd.choice(centres)
        x, y = gx + rnd.gauss(0, clump), gy + rnd.gauss(0, clump)
        if not (x_range[0] < x < x_range[1] and y_range[0] < y < y_range[1]) or not ok(x, y):
            continue
        k = kind if rnd.random() < 0.75 else rnd.choice(kinds)
        kit.place(protos[k], trees, (x, y, ground(x, y) - 0.2), rnd.uniform(0, 6.28), rnd.uniform(*scale))
        placed += 1
    return placed


def lookdev(scene, sky='#62A8E6', sun_az=125, sun_el=38, energy=5.0):
    """Same painted look-dev setup as the Zhongshan build."""
    try:
        scene.render.engine = 'BLENDER_EEVEE'
    except TypeError:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x, scene.render.resolution_y = 1280, 800
    scene.render.image_settings.file_format = 'JPEG'
    scene.render.image_settings.quality = 88
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Punchy'
    except TypeError:
        pass
    world = bpy.data.worlds.new('Painted sky')
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes['Background']
    bg.inputs['Color'].default_value = kit.srgb(sky)
    bg.inputs['Strength'].default_value = 0.85
    fill = nt.nodes.new('ShaderNodeBackground')
    fill.inputs['Color'].default_value = kit.srgb('#BCD7EE')
    fill.inputs['Strength'].default_value = 0.45
    mix = nt.nodes.new('ShaderNodeMixShader')
    path = nt.nodes.new('ShaderNodeLightPath')
    nt.links.new(path.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(fill.outputs['Background'], mix.inputs[1])
    nt.links.new(bg.outputs['Background'], mix.inputs[2])
    nt.links.new(mix.outputs['Shader'], nt.nodes['World Output'].inputs['Surface'])
    scene.world = world
    sun = bpy.data.lights.new('Sun', 'SUN')
    sun.energy = energy
    sun.color = (1.0, 0.95, 0.86)
    so = bpy.data.objects.new('Sun', sun)
    so.rotation_euler = (math.radians(90 - sun_el), 0, math.radians(sun_az + 180))
    scene.collection.objects.link(so)


def camera(scene, name, loc, target, lens=32):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.clip_end = 6000
    o = bpy.data.objects.new(name, cam)
    o.location = loc
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    scene.collection.objects.link(o)
    return o


def render_views(scene, cams, out_dir, prefix):
    out_dir.mkdir(parents=True, exist_ok=True)
    scene.eevee.taa_render_samples = 32
    for k, o in cams.items():
        scene.camera = o
        scene.render.filepath = str(out_dir / f'{prefix}-{k}.jpg')
        bpy.ops.render.render(write_still=True)
        print('RENDERED', k, flush=True)


def oriented_box(pts):
    """Minimum-area rectangle of a footprint: (centre, width, depth, angle). Width runs along angle."""
    pts = pts[:-1] if pts[0] == pts[-1] else pts
    best = None
    for i in range(len(pts)):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
        a = math.atan2(y1 - y0, x1 - x0)
        c, s = math.cos(-a), math.sin(-a)
        rx = [x * c - y * s for x, y in pts]
        ry = [x * s + y * c for x, y in pts]
        w, d = max(rx) - min(rx), max(ry) - min(ry)
        if best is None or w * d < best[0]:
            cx, cy = (max(rx) + min(rx)) / 2, (max(ry) + min(ry)) / 2
            ca, sa = math.cos(a), math.sin(a)
            best = (w * d, (cx * ca - cy * sa, cx * sa + cy * ca), w, d, a)
    _, centre, w, d, a = best
    if d > w:
        w, d, a = d, w, a + math.pi / 2
    return centre, w, d, a


def polyline_offset(pts, offset):
    """Offset an open polyline sideways (left positive)."""
    out = []
    for i, p in enumerate(pts):
        a, b = Vector(pts[max(0, i - 1)]), Vector(pts[min(len(pts) - 1, i + 1)])
        t = (b - a).normalized()
        out.append(Vector(p) + Vector((-t.y, t.x)) * offset)
    return out
