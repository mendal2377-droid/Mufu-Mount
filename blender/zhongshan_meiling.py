"""Meiling Palace 美龄宫 and the plane-tree "necklace", the Zhongshan slice's third scene.

Evidence (research/zhongshan/FACTS.md): OSM way 338667850 footprint ~38 x 25 m; yellow walls,
red columns, green glazed double-eave hip-and-gable roof with ~1,000 phoenix motifs, three
storeys over a basement, a south terrace (观凤台) with a white phoenix balustrade of 34 posts.
The necklace: plane trees along Lingyuan Road (the chain), Meiling Road, and the ring drive round
Xiaohong Hill (the pendant), with the palace as its emerald. It reads best from the air in
autumn, which is how the visitor first sees it: from the paraglider.

Modelling assumptions (not measured): storey height 3.6 m, terrace depth 8 m, pad level, column
count and window rhythm, the drive's width (6 m) and the trees' 9 m spacing.
"""
import json
import math
from pathlib import Path

import bmesh
from mathutils import Matrix, Vector

import kit

DATA = Path(__file__).resolve().parents[1] / 'research' / 'zhongshan' / 'data'
PALACE = Vector((-677.0, -1226.0))       # footprint centre (OSM way 338667850)
PATCH = ((-920.0, -440.0), (-1420.0, -980.0))   # detailed terrain extent (x range, y range)
PAD = (31.0, 26.0)                       # half-size of the levelled palace grounds
W, D = 38.0, 25.0                        # footprint
ROAD_W = {'meiling_ring': 6.0, 'meiling_road': 7.0, 'lingyuan_road': 10.0}
PATH_W = {'meiling_path_n': 2.6, 'meiling_path_w': 2.6}


def anchors():
    return json.loads((DATA / 'anchors-local.json').read_text(encoding='utf-8'))


def _resample(pts, step):
    out = [Vector(pts[0])]
    for a, b in zip(pts, pts[1:]):
        a, b = Vector(a), Vector(b)
        n = max(1, int((b - a).length / step))
        out += [a.lerp(b, k / n) for k in range(1, n + 1)]
    return out


class Meiling:
    def __init__(self, dem, rnd):
        self.dem = dem
        self.rnd = rnd
        a = anchors()
        self.roads = {k: _resample(a[k], 4.0) for k in ROAD_W if k in a}
        self.paths = {k: _resample(a[k], 3.0) for k in PATH_W if k in a}
        # Road surface heights: forest floor along the centreline, smoothed over ±20 m so the
        # drive climbs evenly instead of following every bump of the 30 m DEM.
        self.road_z = {}
        for k, pts in {**self.roads, **self.paths}.items():
            raw = [dem(p.x, p.y) - 11.0 for p in pts]
            win = 5
            self.road_z[k] = [sum(raw[max(0, i - win):i + win + 1]) / len(raw[max(0, i - win):i + win + 1])
                              for i in range(len(raw))]
        # The pad sits on the hilltop: the mean forest floor a little outside the footprint.
        ring = [dem(PALACE.x + 45 * math.cos(t), PALACE.y + 45 * math.sin(t)) - 11.0
                for t in [k * math.pi / 6 for k in range(12)]]
        self.pad_z = sum(ring) / len(ring) + 2.5
        # Only samples near the patch matter for grading; Lingyuan Road runs on for kilometres.
        self.near = [(q, zs, (ROAD_W.get(k) or PATH_W.get(k)) / 2)
                     for k, pts in {**self.roads, **self.paths}.items()
                     for q, zs in zip(pts, self.road_z[k]) if self.inside(q.x, q.y, 60)]

    def inside(self, x, y, margin=0.0):
        (x0, x1), (y0, y1) = PATCH
        return x0 - margin < x < x1 + margin and y0 - margin < y < y1 + margin

    def _near_road(self, x, y):
        """(distance, height, half-width) of the nearest road or path sample."""
        best = (1e9, 0.0, 0.0)
        p = Vector((x, y))
        for q, z, hw in self.near:
            d = (q - p).length
            if d < best[0]:
                best = (d, z, hw)
        return best

    def ground(self, x, y):
        """Designed ground in the patch: forest floor, levelled pad, roads cut in level across."""
        raw = self.dem(x, y) - 11.0
        z, open_w = raw, 0.0
        dx, dy = abs(x - PALACE.x), abs(y - PALACE.y)
        pad = max(dx / PAD[0], dy / PAD[1])
        w_pad = 1 - _smooth(1.0, 1.45, pad)
        if w_pad > 0:
            z = z * (1 - w_pad) + (self.pad_z - 0.4) * w_pad
            open_w = max(open_w, w_pad)
        if self.inside(x, y, 40):
            d, rz, hw = self._near_road(x, y)
            w_road = 1 - _smooth(hw + 1.0, hw + 9.0, d)
            if w_road > 0:
                z = z * (1 - w_road) + (rz - 0.3) * w_road
        return z, open_w

    # --- Geometry ------------------------------------------------------------------------------------

    def build_roads(self, coll, outer_height):
        """Road ribbons. Inside the patch they lie on the graded ground; beyond it (Lingyuan Road
        runs on for a kilometre) they float 1 m over the coarse apron so they are never buried."""
        bm = bmesh.new()
        for k, pts in {**self.roads, **self.paths}.items():
            hw = (ROAD_W.get(k) or PATH_W.get(k)) / 2
            mi = 0 if k in ROAD_W else 1
            left, right = [], []
            for i, p in enumerate(pts):
                a = pts[max(0, i - 1)]
                b = pts[min(len(pts) - 1, i + 1)]
                t = (b - a).normalized() if (b - a).length > 1e-6 else Vector((1, 0))
                nrm = Vector((-t.y, t.x))
                for side, lst in ((1, left), (-1, right)):
                    q = p + nrm * hw * side
                    if self.inside(q.x, q.y):
                        zq = self.ground(q.x, q.y)[0] + 0.12
                    else:
                        # outer_height may return (z, lift): lie on another detailed patch's graded
                        # ground, or float 1 m over the coarse apron so the road is never buried.
                        zo = outer_height(q.x, q.y)
                        zq = zo[0] + zo[1] if isinstance(zo, tuple) else zo + 1.0
                    lst.append(bm.verts.new((q.x, q.y, zq)))
            for i in range(len(pts) - 1):
                f = bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
                f.material_index = mi
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        for f in bm.faces:
            if f.normal.z < 0:
                f.normal_flip()
        return kit.mesh_object('Meiling roads', bm, coll, ['road', 'paving'])

    def build_palace(self, coll):
        """Pad, podium, south terrace with 34 balustrade posts, three storeys, portico, green roofs."""
        z0 = self.pad_z
        bm = bmesh.new()
        mats = ['granite_shade', 'paving', 'meiling_wall', 'opening', 'vermilion', 'granite', 'gold']
        M = Matrix.Translation((PALACE.x, PALACE.y, z0))
        # Paved forecourt and the pad's edge.
        kit.add_box(bm, (0, -2.0, -0.5), (2 * PAD[0] - 4, 2 * PAD[1] - 4, 1.0), mi=1, matrix=M)
        # Podium (basement storey shows as a stone base) and the south terrace (观凤台).
        kit.add_box(bm, (0, 0, 0.8), (W + 2, D + 2, 1.6), mi=0, matrix=M)
        kit.add_box(bm, (0, -D / 2 - 4.5, 0.8), (26.0, 9.0, 1.6), mi=5, matrix=M)
        posts = 34
        # Balustrade round the terrace's three open sides: 34 posts in all, as published.
        tx, ty0, ty1 = 13.0, -D / 2 - 9.0, -D / 2 - 1.0
        per_side = [10, 14, 10]
        lines = [((-tx, ty1), (-tx, ty0)), ((-tx, ty0), (tx, ty0)), ((tx, ty0), (tx, ty1))]
        for (p0, p1), n in zip(lines, per_side):
            for k in range(n):
                t = (k + 0.5) / n
                x, y = p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t
                kit.add_box(bm, (x, y, 2.15), (0.34, 0.34, 1.1), mi=5, matrix=M)
            kit.add_box(bm, ((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, 2.62),
                        (abs(p1[0] - p0[0]) + 0.4, abs(p1[1] - p0[1]) + 0.4, 0.18), mi=5, matrix=M)
        assert sum(per_side) == posts
        # Steps from the forecourt up to the terrace, centred.
        kit.stair_flight(bm, (0, -D / 2 - 9.0 - 3.6, 0.0), 8.0, 9, 1.6 / 9, 0.4, mi=5,
                         matrix=M @ Matrix.Rotation(0, 4, 'Z'), riser_mi=0)
        # Three storeys: ground and first floor full footprint, second floor set back under the roof.
        H = 3.6
        kit.add_box(bm, (0, 0, 1.6 + H), (W - 2, D - 2, 2 * H), mi=2, matrix=M)
        kit.add_box(bm, (0, 0, 1.6 + 2 * H + H / 2), (W - 8, D - 8, H), mi=2, matrix=M)
        # Windows: dark panes in red frames, three rows on the south and north faces.
        for row, zc in enumerate((1.6 + 1.7, 1.6 + H + 1.7)):
            for k in range(9):
                x = -W / 2 + 3.0 + k * (W - 6.0) / 8
                if abs(x) < 5.5 and row == 0:
                    continue  # the portico
                for face, y in ((-1, -(D - 2) / 2 - 0.12), (1, (D - 2) / 2 + 0.12)):
                    kit.add_box(bm, (x, y, zc), (1.9, 0.18, 2.2), mi=4, matrix=M)
                    kit.add_box(bm, (x, y + face * 0.06, zc), (1.4, 0.16, 1.7), mi=3, matrix=M)
        for k in range(7):
            x = -(W - 8) / 2 + 2.5 + k * (W - 13) / 6
            for face, y in ((-1, -(D - 8) / 2 - 0.12), (1, (D - 8) / 2 + 0.12)):
                kit.add_box(bm, (x, y, 1.6 + 2 * H + 1.6), (1.4, 0.16, 1.6), mi=4, matrix=M)
                kit.add_box(bm, (x, y + face * 0.06, 1.6 + 2 * H + 1.6), (1.0, 0.14, 1.2), mi=3, matrix=M)
        # Portico: six red columns carrying a beam, the door behind.
        for k in range(6):
            x = -6.25 + k * 2.5
            kit.add_box(bm, (x, -(D - 2) / 2 - 2.2, 1.6 + H), (0.55, 0.55, 2 * H), mi=4, matrix=M)
        kit.add_box(bm, (0, -(D - 2) / 2 - 2.2, 1.6 + 2 * H - 0.3), (15.0, 0.8, 0.7), mi=4, matrix=M)
        kit.add_box(bm, (0, -(D - 2) / 2 - 0.15, 1.6 + 1.6), (3.2, 0.2, 3.2), mi=3, matrix=M)
        kit.add_box(bm, (0, -(D - 2) / 2 - 2.62, 1.6 + 2 * H - 0.3), (3.6, 0.1, 0.5), mi=6, matrix=M)  # name board
        o = kit.mesh_object('Meiling Palace', bm, coll, mats)
        # Green glazed roofs: a lower eave round the whole house at the second floor, the upper
        # hip-and-gable over the set-back top storey, and a small roof over the portico.
        lower = kit.curved_roof('Meiling lower eave', coll, (0, 0, 0), W / 2 + 1.6, D / 2 + 1.6, 2.4,
                                lift=0.6, ridge_ratio=0.9, thickness=0.3, material='roof_green', ridge_material='roof_green')
        lower.matrix_world = Matrix.Translation((PALACE.x, PALACE.y, z0 + 1.6 + 2 * H)) @ lower.matrix_world
        upper = kit.curved_roof('Meiling upper roof', coll, (0, 0, 0), (W - 8) / 2 + 2.2, (D - 8) / 2 + 2.2, 5.4,
                                lift=0.9, ridge_ratio=0.6, thickness=0.35, material='roof_green', ridge_material='roof_green',
                                gable=0.45)   # 重檐歇山: double-eave hip-and-gable
        upper.matrix_world = Matrix.Translation((PALACE.x, PALACE.y, z0 + 1.6 + 3 * H)) @ upper.matrix_world
        porch = kit.curved_roof('Meiling portico roof', coll, (0, 0, 0), 8.4, 2.4, 1.3, lift=0.3, ridge_ratio=0.9,
                                thickness=0.25, material='roof_green', ridge_material='roof_green')
        porch.matrix_world = Matrix.Translation((PALACE.x, PALACE.y - (D - 2) / 2 - 2.0, z0 + 1.6 + 2 * H)) @ porch.matrix_world
        return o

    def benches(self, coll):
        """Three stone benches at the forecourt edge, facing the palace. Returns seat records."""
        bm = bmesh.new()
        seats = []
        # On the levelled pad either side of the terrace stair (south of the stair is off the pad).
        for x, y in ((-22.0, -16.0), (22.0, -16.0), (-22.0, -22.0)):
            p = Vector((PALACE.x + x, PALACE.y + y))
            M = Matrix.Translation((p.x, p.y, self.pad_z))
            kit.add_box(bm, (0, 0, 0.42), (2.2, 0.5, 0.12), mi=0, matrix=M)
            for sx in (-0.85, 0.85):
                kit.add_box(bm, (sx, 0, 0.2), (0.2, 0.42, 0.4), mi=0, matrix=M)
            seats.append(((p.x, p.y - 0.4, self.pad_z), (PALACE.x, PALACE.y, self.pad_z + 8)))
        kit.mesh_object('Meiling benches', bm, coll, ['granite_shade'])
        return seats

    def plant_necklace(self, protos, trees, outer_height):
        """Golden plane trees both sides of every road, ~9 m apart: the necklace."""
        n = 0
        for k, pts in self.roads.items():
            hw = ROAD_W[k] / 2 + 2.6
            for i in range(0, len(pts) - 1, 2):
                p, q = pts[i], pts[min(i + 1, len(pts) - 1)]
                t = (q - p).normalized() if (q - p).length > 1e-6 else Vector((1, 0))
                nrm = Vector((-t.y, t.x))
                for side in (-1, 1):
                    s = p + nrm * hw * side
                    dx, dy = abs(s.x - PALACE.x), abs(s.y - PALACE.y)
                    if dx < PAD[0] + 2 and dy < PAD[1] + 2:
                        continue
                    zo = outer_height(s.x, s.y)
                    z = self.ground(s.x, s.y)[0] if self.inside(s.x, s.y) else (zo[0] if isinstance(zo, tuple) else zo)
                    kit.place(protos['plane_autumn'], trees, (s.x, s.y, z - 0.2), self.rnd.uniform(0, 6.28),
                              self.rnd.uniform(1.05, 1.3))
                    n += 1
        return n

    def scatter_forest(self, protos, trees, count=2600):
        kinds = ['broadleaf'] * 5 + ['broadleaf_sun'] * 3 + ['broadleaf_shade'] * 3 + ['cedar'] * 2 + ['maple_autumn']
        (x0, x1), (y0, y1) = PATCH
        placed = tries = 0
        while placed < count and tries < count * 8:
            tries += 1
            x, y = self.rnd.uniform(x0, x1), self.rnd.uniform(y0, y1)
            if abs(x - PALACE.x) < PAD[0] + 6 and abs(y - PALACE.y) < PAD[1] + 6:
                continue
            d, _, hw = self._near_road(x, y)
            if d < hw + 4.5:
                continue
            kit.place(protos[self.rnd.choice(kinds)], trees, (x, y, self.ground(x, y)[0] - 0.3),
                      self.rnd.uniform(0, 6.28), self.rnd.uniform(0.9, 1.4))
            placed += 1
        return placed

    def spawn_points(self):
        z = self.pad_z
        front = (PALACE.x, PALACE.y - D / 2 - 9.0 - 3.6 - 14.0, z)
        terrace = (PALACE.x, PALACE.y - D / 2 - 6.0, z + 1.6)
        gate = (PALACE.x + PAD[0] - 6.0, PALACE.y - PAD[1] + 5.0, z)
        return {'front': front, 'terrace': terrace, 'gate': gate, 'palace': (PALACE.x, PALACE.y, z + 8)}


def _smooth(e0, e1, x):
    t = min(max((x - e0) / (e1 - e0), 0.0), 1.0)
    return t * t * (3 - 2 * t)
