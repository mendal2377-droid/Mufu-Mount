"""Xuanwu Lake and the Ming city wall in the city core (item 38; design/XUANWU-PLAN.md).

Evidence: research/xuanwu/FACTS.md, and the wall's own OSM tags (research/core/data/wall-tags.json,
fetched from Overpass on 4 Nov 2026: the core's features.json keeps the wall's lines, not its tags).

- The wall: every standing stretch OSM maps (barrier=city_wall, 18 lines, about 20 km), open where a
  street really passes: a breach for a street at ground level, an arch (an opening under a lintel)
  for a short tunnel through it (Zhongshan Gate's passages) or a street through a mapped city gate
  (Xuanwu Gate, Jiefang Gate). Long tunnels run under it and leave it whole. The lines tagged only
  historic=citywalls trace the lost wall and are not built.
- Park halls: the 48 buildings OSM maps in Xuanwu Park carry no height or use; on the islands they
  are pavilions and halls, so they are built as one- and two-storey halls with tiled roofs, not as
  the city's slab blocks (an assumption from the park's photographs).
- Planting by each island's published character (the official island pages), lotus beds over about
  8 % of the lake (water plants cover 13.2 % of it: Hohai University 2023), and decked bridges.
"""
import json
import math
from pathlib import Path

import bmesh
import numpy as np
from mathutils import Matrix, Vector

import area_common as ac
import kit
import kit_oldcity as oc

ROOT = Path(__file__).resolve().parents[1]
PARK = 62354287                 # Xuanwu Park (OSM leisure=park)
LAKE = 2138994                  # Xuanwu Lake (OSM relation)
WALL_H = 15.0                   # above the graded ground where OSM gives no height (FACTS: 14-25 m)
WALL_W = 10.0
ARCH_TUNNEL = 100.0             # a tunnel this short through the wall is a gate passage
GATE_NEAR = 30.0                # a street this close to a mapped city gate goes through it
# Xuanwu Gate (design/XUANWU-PLAN.md, "Phase 2, first"): no published dimensions, so these are scaled
# from a photograph of the street face by the guards standing at it (approximate).
GATE_HALF = 15.0                # the gate block along the wall: about 30 m
GATE_TOP = 10.2                 # its walkway above the street; a 1.1 m balustrade above
GATE_ARCHES = (-7.8, 0.0, 7.8)  # three equal round-headed passages (one until 1931), centres along the wall
GATE_R = 2.2                    # each 4.4 m wide, its crown 5.5 m up
GATE_SPRING = 3.3
GATE_WALL_NEAR = 150.0          # the wall this close beside it stands at its height, as in the photograph

# The islands by their OSM outlines' centres (research/xuanwu/FACTS.md), with their planting:
# shore willow spacing (m), interior kinds and square metres per tree.
ISLANDS = {
    'Huanzhou': ((447, 3616), 6.0, ['camphor', 'camphor', 'plum', 'cherry', 'willow'], 150.0),   # Mists and Willows
    'Yingzhou': ((474, 3568), 9.0, ['cherry'] * 6 + ['plum'], 70.0),                            # the cherry flower sea
    'Liangzhou': ((544, 4086), 9.0, ['camphor', 'metasequoia', 'ginkgo', 'scholar'], 160.0),    # plus its ginkgo avenue
    'Cuizhou': ((1003, 4007), 9.0, ['cedar', 'cedar', 'cypress', 'cypress', 'metasequoia', 'willow'], 60.0),  # pine, cypress
    'Lingzhou': ((916, 3132), 14.0, ['camphor', 'willow', 'cherry', 'metasequoia'], 450.0),     # open lawns: the view to Zhongshan
}


def wall_tags():
    p = ROOT / 'research' / 'core' / 'data' / 'wall-tags.json'
    return {e['id']: e.get('tags', {}) for e in json.loads(p.read_text(encoding='utf-8'))['elements']}


def _num(v):
    try:
        return float(str(v).split()[0])
    except (TypeError, ValueError, IndexError):
        return None


def _cross(p1, p2, p3, p4):
    """Where segment p1-p2 crosses p3-p4: (t along the first, point), or None."""
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-9:
        return None
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    if 0 <= t <= 1 and 0 <= u <= 1:
        return t, (p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1]))
    return None


def _length(pts):
    return sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))


class Wall:
    """The standing wall's lines, where streets pass through them, and its footprint."""

    def __init__(self, F, widths, foot):
        tags = wall_tags()
        self.tags = tags
        self.lines = [w for w in F['wall'] if tags.get(w['id'], {}).get('barrier') == 'city_wall'
                      and len(w['pts']) > 1 and tuple(w['pts'][0]) != tuple(w['pts'][-1])]
        # Mapped as buildings too (layer 1, no height): they stood as solid blocks across the
        # gateways, and Xuanwu Gate could not be walked through. The wall and its arches replace them.
        self.not_buildings = {i for i, t in tags.items() if t.get('historic') == 'city_gate' or t.get('barrier') == 'city_wall'}
        gates = [b for b in F['buildings'] if b['id'] in self.not_buildings and tags.get(b['id'], {}).get('historic') == 'city_gate']
        self.gates = [(sum(p[0] for p in g['pts']) / len(g['pts']), sum(p[1] for p in g['pts']) / len(g['pts'])) for g in gates]
        # The lost wall's trace (historic=citywalls only), chained into a rough ring: which side of a
        # standing stretch is the old city. Only the parapet's side depends on it.
        segs = [[tuple(p) for p in w['pts']] for w in F['wall'] if tags.get(w['id'], {}).get('historic') == 'citywalls'
                and 'barrier' not in tags.get(w['id'], {})]
        ring = segs.pop(0) if segs else []
        while segs:
            d, i, rev = min((math.dist(ring[-1], (s[::-1] if r else s)[0]), i, r) for i, s in enumerate(segs) for r in (False, True))
            s = segs.pop(i)
            ring += (s[::-1] if rev else s)[1:]
        self.ring = ring
        self.passes = []            # (line index, arc position, half gap along the wall, arch?)
        self.tunnels_through = set()  # ids of short tunnels that are gate passages (drawn as streets)
        for li, w in enumerate(self.lines):
            pts = w['pts']
            runs = [0.0]
            for a, b in zip(pts, pts[1:]):
                runs.append(runs[-1] + math.dist(a, b))
            for r in F['ways']:
                kind = r.get('kind')
                if kind not in widths or kind == 'steps' or len(r['pts']) < 2:
                    continue
                t = r.get('tags', {})
                layer = _num(t.get('layer')) or 0
                if kind in foot and layer >= 1:
                    continue                 # the walk along the wall's top
                if t.get('bridge') and layer >= 1:
                    continue                 # over it
                under = bool(t.get('tunnel')) or layer < 0
                if under and _length(r['pts']) > ARCH_TUNNEL:
                    continue                 # under it: the lake tunnels, the Jiuhuashan tunnel
                width = widths[kind]
                if t.get('oneway') in ('yes', '1', '-1') and kind not in foot:
                    lanes = _num(t.get('lanes'))
                    width = lanes * 3.4 if lanes else max(width / 2, 6.0)
                for k, (a, b) in enumerate(zip(pts, pts[1:])):
                    for c, d in zip(r['pts'], r['pts'][1:]):
                        hit = _cross(a, b, c, d)
                        if not hit:
                            continue
                        tt, p = hit
                        # Crossing at an angle opens more of the wall.
                        wa, ra = math.atan2(b[1] - a[1], b[0] - a[0]), math.atan2(d[1] - c[1], d[0] - c[0])
                        s = max(0.45, abs(math.sin(wa - ra)))
                        arch = under or any(math.dist(p, g) < GATE_NEAR for g in self.gates)
                        self.passes.append((li, runs[k] + tt * math.dist(a, b), (width / 2 + 1.2) / s, arch))
                        if under:
                            self.tunnels_through.add(r['id'])

    def outer_side(self, pts):
        """+1 if the left of the line (as ac.polyline_offset counts it) is outside the old city."""
        if len(self.ring) < 3:
            return 1
        vote = 0
        for p in ac.polyline_offset(pts, 20.0)[::3]:
            vote += -1 if ac.point_in_poly(p.x, p.y, self.ring) else 1
        return 1 if vote >= 0 else -1

    def footprints(self):
        """The wall's ground footprint as quads (for masks: no tree, lamp or block inside it)."""
        out = []
        for w in self.lines:
            l, r = ac.polyline_offset(w['pts'], WALL_W / 2 + 1.0), ac.polyline_offset(w['pts'], -WALL_W / 2 - 1.0)
            for a, b, c, d in zip(l, l[1:], r[1:], r):
                out.append([(a.x, a.y), (b.x, b.y), (c.x, c.y), (d.x, d.y)])
        return out


def _cut(pts, s0, s1):
    """The polyline between arc positions s0 and s1."""
    out, run = [], 0.0
    for a, b in zip(pts, pts[1:]):
        L = math.dist(a, b)
        if run + L >= s0 and run <= s1:
            u0, u1 = max(0.0, (s0 - run) / L if L else 0.0), min(1.0, (s1 - run) / L if L else 1.0)
            p0 = (a[0] + (b[0] - a[0]) * u0, a[1] + (b[1] - a[1]) * u0)
            p1 = (a[0] + (b[0] - a[0]) * u1, a[1] + (b[1] - a[1]) * u1)
            if not out:
                out.append(p0)
            out.append(p1)
        run += L
    return out


def gate_site(wall):
    """Xuanwu Gate on its wall line: (line index, arc position, point, unit direction), or None.
    The gate is OSM way 940335843 (a city_gate building the wall replaces)."""
    g = next((c for c in wall.gates if 3300 < c[1] < 3500 and -250 < c[0] < 0), None)
    if g is None:
        return None
    best = None
    for li, w in enumerate(wall.lines):
        run = 0.0
        for a, b in zip(w['pts'], w['pts'][1:]):
            L = math.dist(a, b)
            if L > 1e-6:
                k = max(0.0, min(1.0, ((g[0] - a[0]) * (b[0] - a[0]) + (g[1] - a[1]) * (b[1] - a[1])) / (L * L)))
                p = (a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k)
                d = math.dist(p, g)
                if best is None or d < best[0]:
                    best = (d, li, run + k * L, p, Vector(((b[0] - a[0]) / L, (b[1] - a[1]) / L, 0.0)))
            run += L
    return best[1:] if best and best[0] < 40 else None


def _pieces(s0, s1, cuts):
    """[s0, s1] split at the given arc positions."""
    marks = [s0] + sorted(c for c in cuts if s0 < c < s1) + [s1]
    return list(zip(marks, marks[1:]))


def build_wall(wall, coll, over, ground):
    """The wall in runs between its openings; a lintel (Overhead: the walk grid sees under it) over
    each arch, and Xuanwu Gate's two pavilions on top. Returns (metres built, breaches, arches)."""
    bm = bmesh.new()
    lint = bmesh.new()
    built = breaches = arches = 0
    site = gate_site(wall)
    for li, w in enumerate(wall.lines):
        pts = [tuple(p) for p in w['pts']]
        total = _length(pts)
        height = _num(wall.tags.get(w['id'], {}).get('height')) or WALL_H
        side = wall.outer_side(pts)
        gaps = sorted((s - h, s + h, arch) for l2, s, h, arch in wall.passes if l2 == li)
        sg = site[1] if site and site[0] == li else None
        if sg is not None:
            # Xuanwu Gate: one 30 m gap the gate block fills (xuanwu_gate), not the streets' openings.
            gaps = sorted([gp for gp in gaps if gp[1] < sg - GATE_HALF - 10 or gp[0] > sg + GATE_HALF + 10]
                          + [(sg - GATE_HALF, sg + GATE_HALF, 'gate')])
        merged = []
        for g in gaps:
            if merged and g[0] <= merged[-1][1] + 3.0:      # less than 3 m of wall between: one opening
                merged[-1] = (merged[-1][0], max(merged[-1][1], g[1]), merged[-1][2] or g[2])
            else:
                merged.append(g)
        s = 0.0
        for g0, g1, arch in merged + [(total, total, False)]:
            if g0 - s > 4.0:
                cuts = (sg - GATE_WALL_NEAR, sg + GATE_WALL_NEAR) if sg is not None else ()
                for a0, a1 in _pieces(s, g0, cuts):
                    if a1 - a0 > 1.0:
                        near = sg is not None and abs((a0 + a1) / 2 - sg) < GATE_WALL_NEAR
                        oc.city_wall(bm, _cut(pts, a0, a1), ground, height=GATE_TOP if near else height, width=WALL_W,
                                     outer_side=side)
                built += g0 - s
            if arch == 'gate':
                arches += 1
            elif g1 > g0:
                span_pts = _cut(pts, max(0.0, g0), min(total, g1))
                a, b = span_pts[0], span_pts[-1]
                if arch and math.dist(a, b) > 1.0:
                    mid = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
                    gz = ground(*mid)
                    span = math.dist(a, b)
                    clear = max(6.5, min(height - 4.0, 3.0 + 0.45 * span))
                    R = Matrix.Translation((mid[0], mid[1], 0)) @ Matrix.Rotation(math.atan2(b[1] - a[1], b[0] - a[0]), 4, 'Z')
                    kit.add_box(lint, (0, 0, gz + (clear + height) / 2 + 0.6), (span + 0.6, WALL_W, height - clear + 1.2), mi=0, matrix=R)
                    kit.add_box(lint, (0, 0, gz + height + 0.65), (span + 0.6, WALL_W - 1.6, 0.1), mi=1, matrix=R)
                    arches += 1
                else:
                    breaches += 1
            s = max(s, g1)
    kit.mesh_object('City wall', bm, coll, ['ming_brick', 'paving'])
    kit.mesh_object('City wall arches', lint, over, ['ming_brick', 'paving'])
    return built, breaches, arches


def xuanwu_gate(wall, coll, ground, over):
    """Xuanwu Gate as the photographs show it (design/XUANWU-PLAN.md): a block of warm grey-brown
    stone 30 m along the wall with three equal round-headed passages, each in a pale blue-green ring;
    red doors shut in the middle one (visitors use the sides); the name plaque over it on both
    faces; a pale balustrade on top; and the 1984 tower, a red gallery hall under a green glazed roof
    with a two-storey pavilion at each end. Until 9 Nov: one square passage and two small dark-roofed
    pavilions (the owner: "far too different from the real gate").
    The spans over the passages and the rings are Overhead, so the walk grid sees the passages' floor.
    Returns the number of tower buildings."""
    site = gate_site(wall)
    if site is None:
        return 0
    _, _, g, t = site
    # The tower faces the street (west, away from the lake): hall fronts face local -Y.
    yaw = math.atan2(t.y, t.x)
    if t.y > 0:                     # local -Y would face east
        yaw += math.pi
    z0 = ground(*g)
    M = Matrix.Translation((g[0], g[1], z0)) @ Matrix.Rotation(yaw, 4, 'Z')
    D = WALL_W + 1.0                # proud of the wall's faces by half a metre
    top = GATE_TOP
    body, span, rings = bmesh.new(), bmesh.new(), bmesh.new()

    # Piers: the solid stone between and beside the passages.
    edges = [-GATE_HALF] + [e for c in GATE_ARCHES for e in (c - GATE_R, c + GATE_R)] + [GATE_HALF]
    for x0, x1 in zip(edges[::2], edges[1::2]):
        kit.add_box(body, ((x0 + x1) / 2, 0, (top - 1.0) / 2), (x1 - x0, D, top + 1.0), mi=0, matrix=M)
    for c in GATE_ARCHES:
        # Over each passage: the stone above its round crown, in strips.
        n = 12
        for k in range(n):
            xa, xb = c - GATE_R + 2 * GATE_R * k / n, c - GATE_R + 2 * GATE_R * (k + 1) / n
            xm = (xa + xb) / 2 - c
            zc = GATE_SPRING + math.sqrt(max(0.0, GATE_R * GATE_R - xm * xm))
            kit.add_box(span, (c + xm, 0, (zc + top) / 2), (xb - xa + 0.02, D, top - zc), mi=0, matrix=M)
        # The ring on both faces: jambs, then the round head in 14 pieces, 0.8 m wide.
        for face in (-1, 1):
            y = face * (D / 2 + 0.06)
            for sx in (-1, 1):
                kit.add_box(rings, (c + sx * (GATE_R + 0.4), y, GATE_SPRING / 2), (0.8, 0.14, GATE_SPRING), mi=1, matrix=M)
            rr = GATE_R + 0.4
            for k in range(14):
                a0 = math.pi * (k + 0.5) / 14
                R = (Matrix.Translation((c + rr * math.cos(a0), y, GATE_SPRING + rr * math.sin(a0)))
                     @ Matrix.Rotation(-(a0 - math.pi / 2), 4, 'Y'))
                kit.add_box(rings, (0, 0, 0), (math.pi * rr / 14 + 0.05, 0.14, 0.8), mi=1, matrix=M @ R)
    # The middle passage's red doors, shut.
    kit.add_box(body, (GATE_ARCHES[1], 0, (GATE_SPRING + GATE_R) / 2), (2 * GATE_R, 0.3, GATE_SPRING + GATE_R), mi=2, matrix=M)
    # The plaque (Cai Yuanpei's calligraphy, 1929) over it: a dark board in a gold frame. The lake
    # face is the same as the street face (the owner, 9 Nov), so on both.
    for face in (-1, 1):
        kit.add_box(body, (0, face * (D / 2 + 0.08), 7.9), (2.7, 0.1, 1.25), mi=4, matrix=M)
        kit.add_box(body, (0, face * (D / 2 + 0.14), 7.9), (2.4, 0.1, 0.95), mi=3, matrix=M)
    # The walk on top, and a pale stone balustrade along both faces.
    kit.add_box(span, (0, 0, top + 0.05), (2 * GATE_HALF, D - 1.0, 0.1), mi=5, matrix=M)
    for face in (-1, 1):
        y = face * (D / 2 - 0.2)
        for k in range(int(2 * GATE_HALF / 1.5) + 1):
            kit.add_box(body, (-GATE_HALF + k * 1.5, y, top + 0.55), (0.28, 0.28, 1.1), mi=5, matrix=M)
        kit.add_box(body, (0, y, top + 1.05), (2 * GATE_HALF, 0.3, 0.14), mi=5, matrix=M)
        kit.add_box(body, (0, y, top + 0.3), (2 * GATE_HALF, 0.22, 0.12), mi=5, matrix=M)
    mats = ['gate_stone', 'gate_ring', 'vermilion', 'timber_dark', 'gold', 'granite']
    kit.mesh_object('Xuanwu Gate', body, coll, mats)
    kit.mesh_object('Xuanwu Gate spans', span, over, mats)
    kit.mesh_object('Xuanwu Gate rings', rings, over, mats)

    # The tower (1984): a long gallery hall with gold railings, a two-storey pavilion at each end.
    def at(lx, ly, lz):
        p = M @ Vector((lx, ly, lz))
        return (p.x, p.y, p.z)
    # Seen from the lake it is the same (the owner, 9 Nov): oc.hall draws its colonnade on the front
    # only, so the back gets the same red columns and beam, and the gold railing runs on both sides.
    trim = bmesh.new()

    def back_columns(lx, w, d, h, plinth=0.4):
        n = max(4, int(w / 3.2))
        for k in range(n + 1):
            kit.add_box(trim, (lx - w / 2 + w * k / n, d / 2, top + plinth + h / 2), (0.42, 0.42, h), mi=0, matrix=M)
        kit.add_box(trim, (lx, d / 2, top + plinth + h - 0.3), (w + 0.4, 0.5, 0.6), mi=0, matrix=M)
    oc.hall('Xuanwu Gate gallery', coll, at(0, 0, top), 22.0, 6.0, 3.4, walls='vermilion', roof='roof_green',
            yaw=yaw, plinth=0.4, columns=True)
    back_columns(0, 22.0, 6.0, 3.4)
    for face in (-1, 1):
        kit.add_box(trim, (0, face * (3.0 + 0.9), top + 0.9), (22.0, 0.14, 1.0), mi=1, matrix=M)
    for sx in (-1, 1):
        oc.hall(f'Xuanwu Gate pavilion {sx}', coll, at(sx * 12.0, 0, top), 6.4, 6.4, 5.6, walls='vermilion',
                roof='roof_green', yaw=yaw, double=True, plinth=0.4, columns=True)
        back_columns(sx * 12.0, 6.4, 6.4, 5.6)
    kit.mesh_object('Xuanwu Gate colonnade and railing', trim, coll, ['vermilion', 'gold'])
    return 3


def park_halls(F, coll, ground, skip_ids):
    """The park's mapped buildings as halls with tiled roofs, on their footprints' rectangles.
    Returns the ids built (build_core leaves them out of its extrusions)."""
    park = next((p['pts'] for p in F['places'] if p['id'] == PARK and p.get('pts')), None)
    if park is None:
        return set()
    done = set()
    for b in F['buildings']:
        t = b['tags']
        if b['id'] in skip_ids or t.get('building') not in ('yes', None) or t.get('height') or t.get('building:levels'):
            continue
        pts = b['pts'][:-1] if b['pts'][0] == b['pts'][-1] else list(b['pts'])
        if len(pts) < 3:
            continue
        cx, cy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        if not ac.point_in_poly(cx, cy, park):
            continue
        a = abs(0.5 * sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(pts, pts[1:] + pts[:1])))
        if a < 12:
            continue
        (bx, by), w, d, ang = ac.oriented_box(pts)
        # The hall's plinth stands 1.2 m out all round; its walls sit inside the footprint.
        hw, hd = max(2.6, w - 2.4), max(2.6, d - 2.4)
        small = a < 70
        oc.hall(f'Park hall {b["id"]}', coll, (bx, by, ground(bx, by)), hw, hd, 3.2 if small else 3.8,
                walls='vermilion' if small else 'whitewash', roof='tile_dark', yaw=ang,
                columns=small or a > 300, double=a > 700, plinth=0.6)
        done.add(b['id'])
    return done


def islands(F):
    """The five named islands' outlines, by their OSM centres."""
    out = {}
    for name, (c, *_rest) in ISLANDS.items():
        best = None
        for i in F['islands']:
            p = i['pts']
            cx, cy = sum(x for x, _ in p) / len(p), sum(y for _, y in p) / len(p)
            d = math.dist((cx, cy), c)
            if d < 60 and (best is None or d < best[0]):
                best = (d, p)
        if best:
            out[name] = best[1]
    return out


def plant_islands(F, protos, trees, rnd, ground, ok, extent):
    """Each island's own planting: willows along its shore (Huanzhou's all round, closest), then its
    interior mix; Liangzhou's ginkgo avenue along its paths. ok(x, y) keeps trees off buildings,
    roads, water and paths. Returns {island: trees}."""
    isl = islands(F)
    counts = {}
    foot = [w['pts'] for w in F['ways'] if w.get('kind') in ('footway', 'path', 'pedestrian') and len(w['pts']) > 1]
    for name, ring in isl.items():
        _, spacing, kinds, per = ISLANDS[name]
        mask = ac.Mask([ring], extent, 2.0)
        n = 0
        # Shore: 4 m in from the water's edge, every `spacing` metres.
        for a, b in zip(ring, ring[1:] + ring[:1]):
            L = math.dist(a, b)
            for k in range(int(L / spacing)):
                px, py = a[0] + (b[0] - a[0]) * (k + .5) * spacing / L, a[1] + (b[1] - a[1]) * (k + .5) * spacing / L
                nx, ny = -(b[1] - a[1]) / L, (b[0] - a[0]) / L
                for sd in (1, -1):
                    qx, qy = px + nx * sd * 4.0, py + ny * sd * 4.0
                    if mask.at(qx, qy) and ok(qx, qy):
                        kit.place(protos['willow'], trees, (qx, qy, ground(qx, qy)), rnd.uniform(0, 6.28), rnd.uniform(.85, 1.15))
                        n += 1
                        break
        if name == 'Liangzhou':
            # The ginkgo avenue (research/plants/FACTS.md): both sides of its paths, every 8 m.
            for pts in foot:
                for a, b in zip(pts, pts[1:]):
                    L = math.dist(a, b)
                    for k in range(int(L / 8.0)):
                        px, py = a[0] + (b[0] - a[0]) * (k + .5) * 8 / L, a[1] + (b[1] - a[1]) * (k + .5) * 8 / L
                        if not mask.at(px, py):
                            continue
                        nx, ny = -(b[1] - a[1]) / L, (b[0] - a[0]) / L
                        for sd in (1, -1):
                            qx, qy = px + nx * sd * 3.6, py + ny * sd * 3.6
                            if mask.at(qx, qy) and ok(qx, qy):
                                kit.place(protos['ginkgo'], trees, (qx, qy, ground(qx, qy)), rnd.uniform(0, 6.28), rnd.uniform(.9, 1.1))
                                n += 1
        xs, ys = [p[0] for p in ring], [p[1] for p in ring]
        want = int(mask.m.sum() * 4.0 / per)
        n += ac.scatter(protos, trees, rnd, kinds, want, (min(xs), max(xs)), (min(ys), max(ys)),
                        lambda x, y: mask.at(x, y) and ok(x, y), ground, scale=(0.85, 1.2), clump=14.0, groves=max(4, want // 25))
        counts[name] = n
    return counts


def lake_ring(F, lakes):
    """Xuanwu Lake's outer ring among the build's water polygons: the one holding the islands."""
    isl = islands(F)
    if not isl:
        return None
    c = next(iter(isl.values()))[0]
    best = None
    for k, w in enumerate(lakes):
        if len(w) > 20 and ac.point_in_poly(c[0], c[1], w):
            a = abs(0.5 * sum(p[0] * q[1] - q[0] * p[1] for p, q in zip(w, w[1:] + w[:1])))
            if best is None or a > best[1]:
                best = (k, a)
    return best[0] if best else None


def foot_bridges(F, extent, ring):
    """The park's foot bridges over the lake: OSM's footway, path and service bridges with any part
    over open water."""
    out = []
    for b in F['bridges']:
        t = b.get('tags', {})
        if t.get('highway') not in ('footway', 'path', 'pedestrian', 'cycleway', 'service') or len(b['pts']) < 2:
            continue
        if t.get('bridge') == 'boardwalk':
            continue                     # laid on the shore (the boardwalk by the wall), not over the lake
        if any(ac.point_in_poly(x, y, ring) for x, y in b['pts']):
            out.append(b)
    return out


def build_bridges(bridges, coll, level, ground):
    """Stone decks with balustrades, 4.5 m wide (a 2.6 m footway ribbon fell between the walk grid's
    4 m cells and left holes over the water: 21 of the 29 park bridges). Short ones are humped."""
    bm = bmesh.new()
    n = 0
    for b in bridges:
        pts = [tuple(p) for p in b['pts']]
        L = _length(pts)
        # Each end at its own bank: one height for both (the lower) left the service road's bridge
        # by Cuizhou Gate 1.1 m below the road at its higher end, a step no walker takes (build 9).
        # `ground` is the roads' own height (road_z); their ribbons lie 0.3-0.4 m over it.
        za, zb = (max(level + 0.9, ground(*p) + 0.35) for p in (pts[0], pts[-1]))
        # Humped only when nearly straight: a zigzag (the chain to Cuizhou) or a U drawn as one hump
        # between its ends left the walked line off the deck, over the water (build 8: 9 of 26).
        if len(pts) == 2 or L < 70 and math.dist(pts[0], pts[-1]) > 0.97 * L:
            oc.arch_bridge(bm, pts[0], pts[-1], za, width=4.5, rise=min(1.6, L * 0.05), z_end=zb)
        else:
            s = 0.0
            for a, c in zip(pts, pts[1:]):
                d = math.dist(a, c)
                if d > 0.5:
                    oc.arch_bridge(bm, a, c, za + (zb - za) * s / L, width=4.5, rise=0.0,
                                   segs=max(2, int(d / 6)), z_end=za + (zb - za) * (s + d) / L)
                s += d
        n += 1
    kit.mesh_object('Lake bridges', bm, coll, ['granite_shade'])
    return n


def lotus_beds(F, ring, holes, wet, level, coll, bridges, share=0.08, cell=4.0, seed=38):
    """Lotus beds over about `share` of the lake: water 6-50 m from a shore, where the shore is near on
    several sides (the bays between the islands and along the wall), in patches from a smooth noise
    field. A flat bed at the water's level, its outline in 4 m cells. Returns (bed cells, lake cells, centres)."""
    xs, ys = [p[0] for p in ring], [p[1] for p in ring]
    x0, y0 = min(xs) - cell, min(ys) - cell
    nx, ny = int((max(xs) - x0) / cell) + 2, int((max(ys) - y0) / cell) + 2
    water = np.zeros((ny, nx), dtype=bool)
    lake_m = ac.Mask([ring], (x0, x0 + nx * cell, y0, y0 + ny * cell), cell)
    hole_m = ac.Mask(holes, (x0, x0 + nx * cell, y0, y0 + ny * cell), cell)
    for j in range(ny):
        for i in range(nx):
            x, y = x0 + (i + .5) * cell, y0 + (j + .5) * cell
            water[j, i] = lake_m.at(x, y) and not hole_m.at(x, y) and wet(x, y)
    land = ~water
    # Distance from land in cells (4-neighbour dilation, out to 13 cells).
    dist = np.full(water.shape, 99, dtype=np.int16)
    front = land.copy()
    dist[front] = 0
    for k in range(1, 14):
        grow = front.copy()
        grow[1:, :] |= front[:-1, :]
        grow[:-1, :] |= front[1:, :]
        grow[:, 1:] |= front[:, :-1]
        grow[:, :-1] |= front[:, 1:]
        dist[grow & (dist == 99)] = k
        front = grow
    # Shelter: the share of land within 300 m (summed-area table).
    r = int(150 / cell)
    pad = np.pad(land.astype(np.float32), r, mode='constant', constant_values=1.0)
    cs = np.pad(pad.cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    box = (cs[2 * r + 1:, 2 * r + 1:] - cs[:-2 * r - 1, 2 * r + 1:] - cs[2 * r + 1:, :-2 * r - 1] + cs[:-2 * r - 1, :-2 * r - 1]) / (2 * r + 1) ** 2
    rng = np.random.default_rng(seed)

    def noise(step):
        g = rng.random((int(ny * cell / step) + 3, int(nx * cell / step) + 3))
        jj, ii = np.mgrid[0:ny, 0:nx]
        fy, fx = jj * cell / step, ii * cell / step
        j0, i0 = fy.astype(int), fx.astype(int)
        ty, tx = fy - j0, fx - i0
        ty, tx = ty * ty * (3 - 2 * ty), tx * tx * (3 - 2 * tx)
        return (g[j0, i0] * (1 - ty) * (1 - tx) + g[j0, i0 + 1] * (1 - ty) * tx + g[j0 + 1, i0] * ty * (1 - tx) + g[j0 + 1, i0 + 1] * ty * tx)
    score = 0.65 * noise(60.0) + 0.35 * noise(20.0) + 0.6 * box
    ok = water & (dist >= 2) & (dist <= 12)
    # Not on or beside a bridge (12 m).
    for b in bridges:
        for a, c in zip(b['pts'], b['pts'][1:]):
            L = max(math.dist(a, c), 1e-6)
            for u in np.arange(0, L + 1, 2.0):
                px, py = a[0] + (c[0] - a[0]) * u / L, a[1] + (c[1] - a[1]) * u / L
                i, j = int((px - x0) / cell), int((py - y0) / cell)
                ok[max(0, j - 3):j + 4, max(0, i - 3):i + 4] = False
    want = int(water.sum() * share)
    vals = np.sort(score[ok])[::-1]
    if len(vals) == 0:
        return 0, int(water.sum()), []
    thr = vals[min(want, len(vals)) - 1]
    bed = ok & (score >= thr)
    bm = bmesh.new()
    centres = []
    z = level + 0.04
    for j in range(ny):
        i = 0
        while i < nx:
            if not bed[j, i]:
                i += 1
                continue
            i1 = i
            while i1 + 1 < nx and bed[j, i1 + 1]:
                i1 += 1
            ax, bx_ = x0 + i * cell, x0 + (i1 + 1) * cell
            ay, by = y0 + j * cell, y0 + (j + 1) * cell
            v = [bm.verts.new((ax, ay, z)), bm.verts.new((bx_, ay, z)), bm.verts.new((bx_, by, z)), bm.verts.new((ax, by, z))]
            bm.faces.new(v)
            for ii in range(i, i1 + 1):
                centres.append((x0 + (ii + .5) * cell, y0 + (j + .5) * cell))
            i = i1 + 1
    kit.mesh_object('Lotus beds', bm, coll, ['lotus'])
    return int(bed.sum()), int(water.sum()), centres


def lotus_plants(centres, protos, trees, rnd, level, n_pads=7000, n_flowers=2200):
    """Raised leaves and blooms over the beds, so they read as lotus and not as a green floor."""
    if not centres:
        return 0
    n = 0
    for _ in range(n_pads):
        cx, cy = rnd.choice(centres)
        kit.place(protos['lotus'], trees, (cx + rnd.uniform(-2, 2), cy + rnd.uniform(-2, 2), level + 0.05), rnd.uniform(0, 6.28), rnd.uniform(1.0, 1.8))
        n += 1
    for _ in range(n_flowers):
        cx, cy = rnd.choice(centres)
        kit.place(protos['lotus_flower'], trees, (cx + rnd.uniform(-2, 2), cy + rnd.uniform(-2, 2), level + 0.35), rnd.uniform(0, 6.28), rnd.uniform(0.9, 1.4))
        n += 1
    return n
