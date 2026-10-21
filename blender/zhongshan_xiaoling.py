"""Ming Xiaoling 明孝陵: the Sacred Way's stone animals, the Wengzhong Road and the tomb precinct.

A third patch in the Zhongshan world (it lies beside Meiling, within the same OSM extract).
Evidence (research/zhongshan/FACTS.md and the owner's photos D:/blender/nanjing/mingxiaoling):
- 石象路 (OSM ways 249355082/3): six kinds of animals — lion, xiezhi, camel, elephant, qilin,
  horse — two pairs each, the first pair kneeling or crouching, the second standing, facing across
  a ~4 m stone path between clipped hedges and lawns, under ginkgo and broadleaf canopy.
- 翁仲路 (OSM way 52508833): a pair of ornamental pillars (望柱), two pairs of generals and two
  pairs of civil officials (~3 m robed figures with tall caps), then the 棂星门 site.
- 大金门 (OSM 859643790) and 四方城 (743687352) with the 神功圣德碑 stele on a tortoise; the
  precinct: 文武方门 (743687351), 碑殿 with 治隆唐宋碑, 享殿 ruins (791617218), 内红门
  (1434634313), 方城明楼 (380923042) before the mound (380923041).
Assumptions: statue sizes and spacing, wall heights, the Fangcheng's 75 x 31 x 16 m mass, the
Ming Tower's restored double yellow roof, and the grading of the routes.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import kit

kit.PALETTE.update({'stone_statue': '#A7A397', 'stone_statue_dark': '#8A877C', 'xiaoling_wall': '#C9604A',
                    'roof_yellow': '#D9A43A'})
PATCH = ((-1700.0, -880.0), (-1320.0, 640.0))
SACRED = [(-1032.0, -1030.0), (-1625.0, -796.0)]       # replaced by the OSM polyline at runtime
GOLD_GATE = Vector((-1007.0, -1183.0))
SQUARE_CITY = Vector((-983.0, -1099.0))
WENWU = Vector((-1325.0, -190.0))
STELE_HALL = Vector((-1325.0, -147.0))
XIANG = Vector((-1325.0, -63.0))
INNER_RED = Vector((-1324.0, -13.0))
MING_TOWER = Vector((-1323.0, 203.0))
MOUND = Vector((-1318.0, 380.0))


def _blob(bm, c, r, mi, seg=10):
    s = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(6, seg // 2), radius=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ Matrix.Diagonal((r[0], r[1], r[2], 1)), verts=s['verts'])
    for f in {f for v in s['verts'] for f in v.link_faces}:
        f.material_index = mi


def _leg(bm, top, h, r, mi):
    c = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=r * 0.9, radius2=r, depth=h)
    bmesh.ops.translate(bm, vec=(top[0], top[1], top[2] - h / 2), verts=c['verts'])
    for f in {f for v in c['verts'] for f in v.link_faces}:
        f.material_index = mi


def statue(bm, kind, pose, mi=0):
    """A weathered stone animal or figure in local space (facing +Y, on a plinth); the caller moves
    the new vertices into place. Built from rounded masses, the way the photographs read: big simple
    volumes, no fine carving."""
    kit.add_box(bm, (0, 0, 0.25), (2.0 if kind != 'elephant' else 3.4, 3.0 if kind not in ('official', 'general') else 1.4, 0.5), mi=1)
    k = pose == 'kneel'
    if kind == 'camel':
        z = 0.5 + (0.7 if k else 1.6)
        _blob(bm, (0, 0, z), (0.8, 1.5, 0.75), mi)
        for dy in (-0.45, 0.4):
            _blob(bm, (0, dy, z + 0.75), (0.45, 0.45, 0.5), mi)
        _blob(bm, (0, 1.6, z + 0.5), (0.3, 0.35, 0.9), mi)               # neck
        _blob(bm, (0, 1.95, z + 1.3), (0.28, 0.5, 0.3), mi)              # head
        if not k:
            for x in (-0.45, 0.45):
                for y in (-0.9, 0.9):
                    _leg(bm, (x, y, z - 0.4), z - 0.9, 0.2, mi)
    elif kind == 'elephant':
        z = 0.5 + (1.0 if k else 1.9)
        _blob(bm, (0, 0, z), (1.35, 1.9, 1.25), mi)
        _blob(bm, (0, 1.9, z + 0.45), (0.85, 0.75, 0.85), mi)            # head
        for x in (-0.9, 0.9):
            _blob(bm, (x, 1.75, z + 0.4), (0.15, 0.7, 0.75), mi)         # ears
        _leg(bm, (0, 2.45, z + 0.1), 1.6 if not k else 1.1, 0.25, mi)    # trunk
        legs = 0.5 if k else 1.5
        for x in (-0.75, 0.75):
            for y in (-1.1, 1.1):
                _leg(bm, (x, y, z - 0.6), legs, 0.42, mi)
    elif kind in ('horse', 'qilin', 'xiezhi', 'lion'):
        tall = kind in ('horse', 'qilin')
        z = 0.5 + ((0.6 if k else 1.4) if tall else (0.6 if k else 1.0))
        _blob(bm, (0, 0, z), (0.6, 1.25 if tall else 1.0, 0.65), mi)
        if tall:
            _blob(bm, (0, 1.15, z + 0.6), (0.3, 0.4, 0.75), mi)          # neck
            _blob(bm, (0, 1.55, z + 1.15), (0.25, 0.5, 0.28), mi)        # head
        else:
            _blob(bm, (0, 0.95, z + 0.45), (0.65, 0.55, 0.7), mi)        # mane
            _blob(bm, (0, 1.35, z + 0.55), (0.4, 0.4, 0.42), mi)         # head
        if kind in ('qilin', 'xiezhi'):
            _leg(bm, (0, 1.5 if kind == 'xiezhi' else 1.7, z + (1.1 if kind == 'xiezhi' else 1.75)), 0.5, 0.08, mi)   # horn
        if not k:
            for x in (-0.35, 0.35):
                for y in (-0.8, 0.8):
                    _leg(bm, (x, y, z - 0.35), z - 0.85, 0.15, mi)
    elif kind in ('official', 'general'):
        _leg(bm, (0, 0, 0.5 + 2.2), 2.2, 0.55, mi)                       # robe, widening to the hem
        _blob(bm, (0, 0, 2.95), (0.5, 0.4, 0.45), mi)                    # shoulders and folded hands
        _blob(bm, (0, 0.05, 3.45), (0.24, 0.24, 0.3), mi)                # head
        if kind == 'official':
            kit.add_box(bm, (0, 0, 3.95), (0.42, 0.42, 0.55), mi=mi)      # tall cap
        else:
            _blob(bm, (0, 0, 3.75), (0.32, 0.32, 0.22), mi)               # helmet
            _leg(bm, (0.42, 0.25, 3.1), 2.4, 0.06, mi)                    # staff
    elif kind == 'pillar':
        c = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.45, radius2=0.4, depth=6.0)
        bmesh.ops.translate(bm, vec=(0, 0, 3.5), verts=c['verts'])
        for f in {f for v in c['verts'] for f in v.link_faces}:
            f.material_index = mi
        _blob(bm, (0, 0, 6.8), (0.55, 0.55, 0.5), mi)


def _transform_new(bm, before, M):
    """Move the vertices created since `before` (a set of the bmesh's vertices). Index ranges are
    not safe: after create_cone / create_uvsphere the vertex order is not creation order, and an
    index range once moved parts of earlier statues a second time."""
    bmesh.ops.transform(bm, matrix=M, verts=[v for v in bm.verts if v not in before])


def resample(pts, step):
    out = [Vector(pts[0])]
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b)
        n = max(1, int((b - a).length / step))
        out += [a.lerp(b, k / n) for k in range(1, n + 1)]
    return out


class Xiaoling:
    def __init__(self, dem, rnd, osm_ways):
        self.dem = dem
        self.rnd = rnd
        self.sacred = resample(osm_ways['sacred'], 3.0)
        self.wengzhong = resample(osm_ways['wengzhong'], 3.0)
        self.precinct = resample([WENWU, MING_TOWER], 3.0)
        self.routes = [self.sacred, self.wengzhong, resample([SQUARE_CITY, Vector(osm_ways['sacred'][0])], 3.0), self.precinct,
                       resample([Vector(osm_ways['wengzhong'][-1]), WENWU], 3.0)]
        # Route heights: forest floor smoothed over ±30 m so the paths climb evenly.
        self.route_z = []
        for r in self.routes:
            raw = [dem(p.x, p.y) - 11.0 for p in r]
            self.route_z.append([sum(raw[max(0, i - 10):i + 11]) / len(raw[max(0, i - 10):i + 11]) for i in range(len(raw))])
        self.tower_z = dem(MING_TOWER.x, MING_TOWER.y - 30) - 11.0

    def inside(self, x, y, m=0.0):
        (x0, x1), (y0, y1) = PATCH
        return x0 - m < x < x1 + m and y0 - m < y < y1 + m

    def _near(self, x, y):
        best = (1e9, 0.0)
        p = Vector((x, y))
        for r, zs in zip(self.routes, self.route_z):
            for q, z in zip(r[::2], zs[::2]):
                d = (q - p).length
                if d < best[0]:
                    best = (d, z)
        return best

    def ground(self, x, y):
        raw = self.dem(x, y) - 11.0
        d, rz = self._near(x, y)
        w = 1 - _smooth(9.0, 26.0, d)
        z = raw * (1 - w) + (rz - 0.25) * w
        # Level courts at the gates and before the Fangcheng.
        for c, r in ((SQUARE_CITY, 30), (GOLD_GATE, 26), (WENWU, 34), (XIANG, 40), (MING_TOWER - Vector((0, 40)), 36)):
            dc = (Vector((x, y)) - c).length
            wc = 1 - _smooth(r, r + 16, dc)
            if wc > 0:
                z = z * (1 - wc) + (self.dem(c.x, c.y) - 11.0 - 0.25) * wc
        return z, (2 if w > 0.6 else 0)

    # --- Geometry ------------------------------------------------------------------------------------

    def build_paths(self, coll):
        bm = bmesh.new()
        for r, width in ((self.sacred, 4.4), (self.wengzhong, 4.4), (self.routes[2], 4.0), (self.precinct, 8.0), (self.routes[4], 4.0)):
            left, right = [], []
            for i, p in enumerate(r):
                a, b = r[max(0, i - 1)], r[min(len(r) - 1, i + 1)]
                t = (b - a).normalized()
                n = Vector((-t.y, t.x))
                for s, lst in ((1, left), (-1, right)):
                    q = p + n * width / 2 * s
                    lst.append(bm.verts.new((q.x, q.y, self.ground(q.x, q.y)[0] + 0.12)))
            for i in range(len(r) - 1):
                f = bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
                f.material_index = 0
            # Clipped hedges either side (photographs), broken where statues stand.
            for i in range(0, len(r) - 1, 2):
                p, q = r[i], r[i + 1]
                t = (q - p).normalized()
                n = Vector((-t.y, t.x))
                for s in (-1, 1):
                    c = (p + q) / 2 + n * (width / 2 + 0.9) * s
                    R = Matrix.Translation((c.x, c.y, self.ground(c.x, c.y)[0] + 0.45)) @ Matrix.Rotation(math.atan2(t.y, t.x), 4, 'Z')
                    kit.add_box(bm, (0, 0, 0), ((q - p).length + 0.05, 1.0, 0.9), mi=1, matrix=R)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for f in bm.faces:
            if f.normal.z < -0.5:
                f.normal_flip()
        return kit.mesh_object('Xiaoling paths', bm, coll, ['paving', 'hedge'])

    def build_statues(self, coll):
        bm = bmesh.new()
        n = 0
        # Sacred Way: from the Square City end westward.
        order = [('lion', 'kneel'), ('lion', 'stand'), ('xiezhi', 'kneel'), ('xiezhi', 'stand'), ('camel', 'kneel'), ('camel', 'stand'),
                 ('elephant', 'kneel'), ('elephant', 'stand'), ('qilin', 'kneel'), ('qilin', 'stand'), ('horse', 'kneel'), ('horse', 'stand')]
        n += self._pairs(bm, self.sacred, order, offset=4.6)
        # Wengzhong Road: pillars, two pairs of generals, two pairs of civil officials.
        order = [('pillar', 'stand'), ('general', 'stand'), ('general', 'stand'), ('official', 'stand'), ('official', 'stand')]
        n += self._pairs(bm, self.wengzhong, order, offset=4.2)
        kit.mesh_object('Xiaoling statues', bm, coll, ['stone_statue', 'stone_statue_dark'])
        return n

    def _pairs(self, bm, route, order, offset):
        L = sum((b - a).length for a, b in zip(route, route[1:]))
        n = 0
        for k, (kind, pose) in enumerate(order):
            s = L * (k + 0.6) / (len(order) + 0.2)
            acc = 0.0
            for a, b in zip(route, route[1:]):
                seg = (b - a).length
                if acc + seg >= s:
                    p = a.lerp(b, (s - acc) / max(seg, 1e-6))
                    t = (b - a).normalized()
                    nrm = Vector((-t.y, t.x))
                    for side in (-1, 1):
                        q = p + nrm * offset * side
                        before = set(bm.verts)
                        statue(bm, kind, pose, 0)
                        facing = -nrm * side      # the pair face each other across the path
                        ang = math.atan2(-facing.x, facing.y)
                        _transform_new(bm, before, Matrix.Translation((q.x, q.y, self.ground(q.x, q.y)[0])) @ Matrix.Rotation(ang, 4, 'Z'))
                        n += 1
                    break
                acc += seg
        return n

    def build_gates_and_precinct(self, coll):
        """大金门, 四方城 with its stele, 文武方门, 碑殿, 享殿 platform, 内红门, 方城明楼."""
        bm = bmesh.new()
        mats = ['xiaoling_wall', 'granite_shade', 'opening', 'stone_statue', 'paving']

        def z_at(p):
            return self.ground(p.x, p.y)[0]
        # Great Golden Gate: red walls with three arches, roof lost.
        g = GOLD_GATE
        kit.add_box(bm, (g.x, g.y, z_at(g) + 4.6), (26.0, 8.0, 9.2), mi=0)
        for dx, w in ((-7, 3.6), (0, 4.6), (7, 3.6)):
            for s in (-1, 1):
                kit.arch_panel(bm, (g.x + dx, g.y + s * 4.02, z_at(g)), w, 6.2 if dx == 0 else 5.2, depth=0.4, mi=2,
                               facing='+Y' if s > 0 else '-Y')
        # Square City: roofless red walls, an arch on each side, the stele on a tortoise inside.
        c = SQUARE_CITY
        zc = z_at(c)
        for dx, dy, w, d in ((0, -13.0, 27.0, 1.8), (0, 13.0, 27.0, 1.8), (-13.0, 0, 1.8, 27.0), (13.0, 0, 1.8, 27.0)):
            kit.add_box(bm, (c.x + dx, c.y + dy, zc + 5.5), (w, d, 11.0), mi=0)
        for s in (-1, 1):
            kit.arch_panel(bm, (c.x, c.y + s * 13.92, zc), 4.4, 6.4, depth=0.4, mi=2, facing='+Y' if s > 0 else '-Y')
        _blob(bm, (c.x, c.y, zc + 1.0), (2.4, 3.6, 1.0), 3)                      # tortoise (bixi)
        kit.add_box(bm, (c.x, c.y, zc + 6.4), (2.2, 0.9, 8.8), mi=3)             # stele 神功圣德碑
        # The precinct: a red-walled gate, the stele hall, the Xiang Hall's stone platform with column
        # bases, the Inner Red Gate.
        for p, w, d, h in ((WENWU, 26.0, 9.0, 8.0), (STELE_HALL, 18.0, 12.0, 7.0), (INNER_RED, 16.0, 7.0, 7.0)):
            kit.add_box(bm, (p.x, p.y, z_at(p) + h / 2), (w, d, h), mi=0)
            for s in (-1, 1):
                kit.arch_panel(bm, (p.x, p.y + s * (d / 2 + 0.02), z_at(p)), 3.6, 5.2, depth=0.4, mi=2, facing='+Y' if s > 0 else '-Y')
        x = XIANG
        kit.add_box(bm, (x.x, x.y, z_at(x) + 1.5), (60.0, 34.0, 3.0), mi=1)
        for i in range(9):
            for j in range(5):
                kit.add_box(bm, (x.x - 24 + i * 6, x.y - 12 + j * 6, z_at(x) + 3.3), (1.2, 1.2, 0.6), mi=3)
        kit.stair_flight(bm, (x.x, x.y - 22.5, z_at(x)), 10.0, 12, 3.0 / 12, 0.4, mi=1)
        # 方城: the great stone-and-brick platform, a ramp tunnel through it; the Ming Tower on top.
        t = MING_TOWER
        zt = self.tower_z
        kit.add_box(bm, (t.x, t.y, zt + 8.0), (75.0, 31.0, 16.0), mi=1)
        kit.arch_panel(bm, (t.x, t.y - 15.52, zt), 5.0, 7.0, depth=0.4, mi=2)
        kit.add_box(bm, (t.x, t.y, zt + 16.0 + 4.5), (39.0, 18.0, 9.0), mi=0)   # Ming Tower walls
        for dx in (-9, 0, 9):
            kit.arch_panel(bm, (t.x + dx, t.y - 9.02, zt + 16.0), 3.4, 5.6, depth=0.4, mi=2)
        o = kit.mesh_object('Xiaoling gates', bm, coll, mats)
        # Roofs: Wenwu Gate and the stele hall single eave; the Ming Tower's restored double eave, yellow.
        for p, hw, hd, z, h in ((WENWU, 14.6, 5.8, 8.0, 3.4), (STELE_HALL, 10.4, 7.4, 7.0, 3.6), (INNER_RED, 9.4, 4.6, 7.0, 3.0)):
            r = kit.curved_roof('Xiaoling roof', coll, (p.x, p.y, z_at(p) + z), hw, hd, h, lift=0.6, ridge_ratio=0.62,
                                material='roof_yellow', ridge_material='roof_yellow')
        kit.curved_roof('Ming Tower lower roof', coll, (t.x, t.y, zt + 25.0), 21.8, 10.6, 2.0, lift=0.7, ridge_ratio=0.95,
                        material='roof_yellow', ridge_material='roof_yellow')
        kit.box('Ming Tower clerestory', (t.x, t.y, zt + 26.6), (33.0, 13.0, 3.2), coll, 'xiaoling_wall')
        kit.curved_roof('Ming Tower upper roof', coll, (t.x, t.y, zt + 28.2), 19.4, 8.8, 6.0, lift=1.0, ridge_ratio=0.6, gable=0.45,
                        material='roof_yellow', ridge_material='roof_yellow')
        return o

    def scatter_trees(self, protos, trees, count=3200):
        """Ginkgo and broadleaf canopy over the routes (photographs), forest on the mound."""
        (x0, x1), (y0, y1) = PATCH
        kinds = ['broadleaf', 'broadleaf_sun', 'broadleaf_sun', 'broadleaf_shade', 'cedar', 'plane_autumn']
        n = tries = 0
        while n < count and tries < count * 8:
            tries += 1
            x, y = self.rnd.uniform(x0, x1), self.rnd.uniform(y0, y1)
            d, _ = self._near(x, y)
            if d < 6.0:
                continue
            if any((Vector((x, y)) - c).length < r for c, r in ((SQUARE_CITY, 24), (GOLD_GATE, 20), (WENWU, 22), (XIANG, 36),
                                                                  (MING_TOWER, 48))):
                continue
            kit.place(protos[self.rnd.choice(kinds)], trees, (x, y, self.ground(x, y)[0] - 0.2), self.rnd.uniform(0, 6.28),
                      self.rnd.uniform(0.9, 1.4))
            n += 1
        return n

    def spawn_points(self):
        s0 = self.sacred[len(self.sacred) // 3]
        t = (self.sacred[len(self.sacred) // 3 + 4] - s0).normalized()
        w0 = self.wengzhong[2]
        tw = (self.wengzhong[8] - w0).normalized()
        return {
            'xiaoling': (s0, s0 + t * 60),
            'wengzhong': (w0, w0 + tw * 60),
            'mingtower': (MING_TOWER - Vector((0, 70)), MING_TOWER),
        }


def _smooth(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)
