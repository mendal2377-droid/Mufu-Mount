"""The Zhongshan world (blender/build_zhongshan.py: the Mausoleum axis, the Music Stage, Meiling
Palace and Ming Xiaoling) merged into Tiny Nanjing on Purple Mountain, at its real place.

The world was built in its own frame: metres from the Bo'ai arch (OSM node 12345226894,
32.0587677 N 118.8486466 E), x east, y north, z from the arch's ground (DSM 87.8 m). Both frames
use the same flat projection (111,320 m a degree of longitude times the cosine of the origin's
latitude, 110,574 m a degree of latitude) and the same Copernicus tile, so the move is a
translation: the cosines of 32.0588 N and 32.0418 N differ by 2 parts in 10,000, 0.1 m across the
world's 1.5 km.

Only the world's three detailed ground patches come across, with everything built on them; its
outer terrain and far canopy give way to the city's mountain. Its forest floor is its DSM less
11 m (the canopy, where Copernicus measures the treetops); round each patch the city's ground eases
to that rule, so no step shows at the patch's edge.

    zs = ZhongshanMerge(area_base)
    zs.append(collections)          # meshes into the city's collections, moved into place
    zs.inside(x, y), zs.height(x, y), zs.blend(x, y)
"""
import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

ROOT = Path(__file__).resolve().parents[1]
BLEND = ROOT / 'art-src' / 'zhongshan.blend'
ORIGIN = (32.0587677, 118.8486466)     # the Bo'ai arch
BASE_Z = 87.8                          # its DSM ground, the world's z = 0
CANOPY = 11.0                          # the world's forest floor below its DSM
# The detailed patches (x range, y range) in the world's frame: build_zhongshan.build_terrain,
# zhongshan_meiling.PATCH, zhongshan_xiaoling.PATCH.
PATCHES = (((-420.0, 520.0), (-360.0, 820.0)), ((-920.0, -440.0), (-1420.0, -980.0)), ((-1700.0, -880.0), (-1320.0, 640.0)))
TERRAINS = ('Terrain', 'Terrain Meiling', 'Terrain Xiaoling')
BUILT = ('Mausoleum axis', 'Music Stage', 'Meiling', 'Xiaoling')
BLEND_R = 120.0                        # metres outside a patch over which the city's ground eases to the world's rule
EDGE = 6.0                             # the world's terrain cells are 4 m: keep the city's things this far inside


def to_city(origin):
    """The arch in the city's frame (metres from the city's origin)."""
    o_lat, o_lon = origin
    kx = 111_320.0 * math.cos(math.radians(o_lat))
    return (ORIGIN[1] - o_lon) * kx, (ORIGIN[0] - o_lat) * 110_574.0


class ZhongshanMerge:
    def __init__(self, city_origin, city_base):
        self.dx, self.dy = to_city(city_origin)
        self.dz = BASE_Z - city_base
        self.rects = [(x0 + self.dx, x1 + self.dx, y0 + self.dy, y1 + self.dy) for (x0, x1), (y0, y1) in PATCHES]
        self.tree = None
        self.ways = None         # its roads and paths (face centres), once appended
        self.built = None        # its paving, steps and roofs (upward faces), once appended
        self.trees = []          # (kind, x, y, z, rotation, scale) of the world's own planting
        self.spawns = []         # (name, location, rotation): its spawns and seats

    def append(self, colls, terrain_coll, kinds):
        """Append the world's patches and buildings into colls[name] (one city collection per world
        collection), its terrain into terrain_coll; note its trees whose kind the city has."""
        names = set(TERRAINS)
        with bpy.data.libraries.load(str(BLEND), link=False) as (src, dst):
            dst.collections = [n for n in src.collections if n in BUILT + ('Ground', 'Trees', 'Markers')]
        lib = {c.name.split('.')[0]: c for c in dst.collections if c is not None}
        moved, terrain = [], []
        for name in BUILT:
            for o in list(lib[name].objects):
                colls[name].objects.link(o)
                moved.append(o)
        for o in list(lib['Ground'].objects):
            if o.name.split('.')[0] in names:
                terrain_coll.objects.link(o)
                moved.append(o)
                terrain.append(o)
        for o in moved:
            if o.parent is None:
                o.location += Vector((self.dx, self.dy, self.dz))
        bpy.context.view_layer.update()
        # The world ran Lingyuan Road and its paths on past its patches, floating a metre over its
        # coarse apron; here the city's own roads take over at the patch edge.
        ways = []
        for o in moved:
            if o.type == 'MESH' and o.name.split('.')[0].endswith((' roads', ' paths')):
                self.clip(o)
                ways += [(o.matrix_world @ f.center).xy for f in o.data.polygons]
        self.ways = KDTree(len(ways))
        for i, p in enumerate(ways):
            self.ways.insert((p.x, p.y, 0.0), i)
        self.ways.balance()
        # Its planting (avenue cedars, the plane necklace round Meiling, the Sacred Way's pines and
        # its forest) on its patches only: the far canopy and the outer forest give way to the
        # city's, planted from the canopy height map.
        for o in lib['Trees'].objects:
            kind = o.name.split('.')[0].replace(' ', '_')
            x, y = o.location.x + self.dx, o.location.y + self.dy
            if kind != 'far' and kind in kinds and self.inside(x, y):
                self.trees.append((kind, x, y, o.location.z + self.dz, o.rotation_euler.z, o.scale.x))
        for o in lib['Markers'].objects:
            # Spawns and seats (the Music Stage's 15 benches, Meiling's terrace); its moon gates, the
            # world's shortcuts between its own sights, are left out: the city has its roads and Bus 34.
            kind, _, rest = o.name.partition(' ')
            if kind in ('Spawn', 'Seat'):
                self.spawns.append((f'{kind} zs-{rest}', o.location + Vector((self.dx, self.dy, self.dz)), o.rotation_euler.z))
        # Drop the appended collections and whatever was only in them (the world's 27,700 trees among
        # it: in one batch, as removing them one by one is quadratic).
        kept = set(moved)
        bpy.data.batch_remove([o for c in lib.values() for o in c.objects if o not in kept])
        bpy.data.batch_remove(list(lib.values()))
        bpy.context.view_layer.update()
        verts, polys = [], []
        for o in terrain:
            m = o.matrix_world
            base = len(verts)
            verts += [m @ v.co for v in o.data.vertices]
            polys += [[base + i for i in f.vertices] for f in o.data.polygons]
        self.tree = BVHTree.FromPolygons(verts, polys) if polys else None
        # Its paving, steps and roofs (the upward faces of everything built on the patches): a city
        # road under them would only show as a sliver at their edges (by the Bo'ai arch's plaza).
        verts, polys = [], []
        for o in moved:
            if o.type != 'MESH' or o in terrain:
                continue
            m, r = o.matrix_world, o.matrix_world.to_3x3()
            base = len(verts)
            verts += [m @ v.co for v in o.data.vertices]
            polys += [[base + i for i in f.vertices] for f in o.data.polygons if (r @ f.normal).z > 0.5]
        self.built = BVHTree.FromPolygons(verts, polys) if polys else None
        return moved

    def clip(self, o):
        """Drop o's faces whose centre lies off every patch."""
        m = o.matrix_world
        bm = bmesh.new()
        bm.from_mesh(o.data)
        off = [f for f in bm.faces if not self.inside(*(m @ f.calc_center_median()).xy, 0.0)]
        bmesh.ops.delete(bm, geom=off, context='FACES')
        bm.to_mesh(o.data)
        bm.free()
        return len(off)

    def cut(self, o):
        """Drop o's faces lying wholly on a patch, where the world's own terrain covers them."""
        m = o.matrix_world
        bm = bmesh.new()
        bm.from_mesh(o.data)
        under = [f for f in bm.faces if all(self.inside(*(m @ v.co).xy, 0.0) for v in f.verts)]
        bmesh.ops.delete(bm, geom=under, context='FACES')
        bm.to_mesh(o.data)
        bm.free()
        return len(under)

    def has_way(self, x, y, r=12.0):
        """Whether the world drew a road or path within r of (x, y). Bus 34's road east of Meiling
        Palace crosses its patch but was never drawn: there the city's own road stays."""
        return self.ways is not None and self.ways.find((x, y, 0.0))[2] <= r

    def covers(self, x, y):
        """Whether the world drew its own ground at (x, y): a road or path near it, or paving,
        steps or a roof over it. Elsewhere on a patch the city's own road stays."""
        if self.has_way(x, y):
            return True
        return self.built is not None and self.built.ray_cast(Vector((x, y, 1000.0)), Vector((0, 0, -1)))[0] is not None

    def inside(self, x, y, margin=EDGE):
        return any(x0 + margin < x < x1 - margin and y0 + margin < y < y1 - margin for x0, x1, y0, y1 in self.rects)

    def height(self, x, y):
        """The world's ground at (x, y) in the city's z, or None off its patches."""
        if not self.tree or not self.inside(x, y, 0.0):
            return None
        hit = self.tree.ray_cast(Vector((x, y, 900.0)), Vector((0, 0, -1)))
        return hit[0].z if hit[0] is not None else None

    def distance(self, x, y):
        """Metres outside the nearest patch (0 inside)."""
        return min(math.hypot(max(x0 - x, 0.0, x - x1), max(y0 - y, 0.0, y - y1)) for x0, x1, y0, y1 in self.rects)

    def blend(self, x, y, city_z, dsm):
        """The city's ground eased, within BLEND_R of a patch, to the world's rule (DSM less 11 m)."""
        d = self.distance(x, y)
        if d >= BLEND_R:
            return city_z
        t = d / BLEND_R
        w = 1.0 - t * t * (3 - 2 * t)
        return city_z * (1 - w) + (dsm - CANOPY) * w
