"""Tiny Nanjing, the city core: Xinjiekou, Zhongshan Road, the Presidential Palace, Jiming and Xuanwu.

    D:/soft/blender/blender.exe -b --factory-startup --python blender/build_core.py [-- --no-render]

Built the way Tiny Warsaw builds Warsaw (design/DETAIL-AND-TRANSPORT-PLAN.md): every OSM building and
building part is extruded from its outline (heights from OSM `height`/`min_height`/levels, else
estimated from type and footprint), and the windows, floors and shop fronts are drawn later by a
shader. Wall UVs carry metres along the wall and metres above the ground; vertex colours carry
the wall and roof colours (OSM `building:colour`/`roof:colour`, else a palette by district and a
per-building hash). Roads are ribbons whose UVs carry metres along and across, so a shader paints
the lanes. Plane trees line the avenues and OSM tree rows; parks are scattered. The Presidential
Palace is the hero model from build_palace.py, appended at its geographic origin.
Assumptions: estimated heights where OSM has none, colours where OSM has none, road widths by class,
plane-tree spacing, the bare ground (the DSM's 150 m minimum).
"""
import colorsys
import hashlib
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import area_common as ac  # noqa: E402
import kit  # noqa: E402
import kit_oldcity as oc  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
OUT_BLEND = ROOT / 'art-src' / 'core.blend'
RENDERS = ROOT / 'design' / 'core'
RENDER = '--no-render' not in sys.argv
rnd = random.Random(1912)

A = ac.Area('core')
F = A.feats
kit.PALETTE.update({
    'facade': '#FFFFFF', 'roof_city': '#FFFFFF',          # colours come from the vertices
    'road_city': '#5E6062', 'sidewalk': '#C7C1B4', 'city_paving': '#B8B3A6', 'pitch': '#7FA05A',
    'plane_leaf': '#86A84A',
})
X0, X1, Y0, Y1 = A.extent

# --- Ground and water -------------------------------------------------------------------------------
lakes = [w['pts'] for w in F['water']]
water_mask = ac.Mask(lakes, A.extent, 4.0)
island_mask = ac.Mask([w['pts'] for w in F['islands']], A.extent, 4.0)
GREEN = {'grass', 'park', 'garden', 'wood', 'flowerbed', 'meadow', 'village_green', 'recreation_ground', 'cemetery', 'scrub', 'forest'}
greens = [p['pts'] for p in F['places'] if p.get('pts') and (p['tags'].get('landuse') in GREEN or p['tags'].get('leisure') in GREEN
                                                            or p['tags'].get('natural') in GREEN)]
green_mask = ac.Mask(greens, A.extent, 4.0)
pitches = [p['pts'] for p in F['places'] if p.get('pts') and p['tags'].get('leisure') == 'pitch']


def wet(x, y):
    return water_mask.at(x, y) and not island_mask.at(x, y)


def zground(x, y):
    return A.bare_at(x, y)


WATER = {}


def ground(x, y):
    if wet(x, y):
        return zground(x, y) - 3.0, 3
    return zground(x, y), (0 if green_mask.at(x, y) else 1)


# --- Buildings --------------------------------------------------------------------------------------
NAMED = {'white': '#EEEBE4', 'grey': '#A9A9A4', 'gray': '#A9A9A4', 'red': '#B5523B', 'blue': '#6F8FB0', 'brown': '#8F663E',
         'yellow': '#E2C76A', 'beige': '#D9C7A6', 'black': '#3A3A3A', 'green': '#6A9D37'}
WALLS = ['#E8DFC8', '#EEEBE4', '#D5D2C8', '#D9C7A6', '#D8B69A', '#E6D59A', '#C9CDC8', '#E1CFB8']
ROOFS = ['#B9B7AE', '#A9AAA3', '#C4C0B4', '#8FA0A6', '#9A9C96']


def colour(v, fallback):
    if not v:
        return fallback
    v = v.strip().lower()
    v = NAMED.get(v, v)
    if v.startswith('#') and len(v) in (4, 7):
        if len(v) == 4:
            v = '#' + ''.join(ch * 2 for ch in v[1:])
        try:
            return v if int(v[1:], 16) >= 0 else fallback
        except ValueError:
            return fallback
    return fallback


def lin(hexstr):
    return kit.srgb(hexstr)


def num(v):
    try:
        return float(str(v).split()[0].replace('m', ''))
    except (ValueError, TypeError, IndexError):
        return None


def area(pts):
    return 0.5 * sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(pts, pts[1:] + pts[:1]))


def estimate_height(t, a):
    kind = t.get('building') or ''
    if kind in ('apartments', 'residential', 'dormitory'):
        return 21.0 if a > 250 else 15.0
    if kind in ('commercial', 'office', 'hospital', 'hotel', 'retail'):
        return 30.0 if a > 1200 else 20.0
    if kind in ('school', 'university', 'public', 'civic', 'government'):
        return 16.0
    if kind in ('train_station', 'transportation'):
        return 14.0
    if a < 120:
        return 6.5           # old one- and two-storey houses
    if a < 500:
        return 12.0
    return 18.0


# Window style per building, read by the façade shader from the vertex alpha:
# 0 = residential, .35 = office glass, .7 = old low houses, 1 = blank (stations, halls).
def style(t, h):
    kind = t.get('building') or ''
    if kind in ('train_station', 'transportation', 'warehouse', 'industrial', 'temple', 'church'):
        return 1.0
    if h > 40 or kind in ('commercial', 'office', 'hotel', 'retail'):
        return 0.35
    if h < 8:
        return 0.7
    return 0.0


def hashf(s, k=0):
    return int(hashlib.md5(f'{s}:{k}'.encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def build_buildings(coll, skip):
    """Extrude every building and part. Outlines that contain parts are dropped (OSM's 3D
    convention: the parts describe the building, the outline is only its footprint)."""
    parts = [b for b in F['buildings'] if b['tags'].get('building:part')]
    part_c = [(sum(p[0] for p in b['pts']) / len(b['pts']), sum(p[1] for p in b['pts']) / len(b['pts'])) for b in parts]
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    col = bm.loops.layers.color.new('Col')
    n = tris = 0
    for b in F['buildings']:
        t = b['tags']
        pts = b['pts'][:-1] if b['pts'][0] == b['pts'][-1] else list(b['pts'])
        if len(pts) < 3:
            continue
        cx, cy = sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts)
        if skip(cx, cy) or not (X0 + 30 < cx < X1 - 30 and Y0 + 30 < cy < Y1 - 30):
            continue
        a = area(pts)
        if abs(a) < 12:
            continue
        if a < 0:
            pts = pts[::-1]
        if not t.get('building:part'):
            xs, ys = [p[0] for p in pts], [p[1] for p in pts]
            if any(min(xs) < px < max(xs) and min(ys) < py < max(ys) and ac.point_in_poly(px, py, pts) for px, py in part_c):
                continue
        h = num(t.get('height')) or (num(t.get('building:levels')) or 0) * 3.3 or estimate_height(t, abs(a))
        h0 = num(t.get('min_height')) or (num(t.get('building:min_level')) or 0) * 3.3
        h = max(h, h0 + 2.5)
        g = zground(cx, cy)
        wall = lin(colour(t.get('building:colour'), WALLS[int(hashf(b['id']) * len(WALLS))]))
        roof = lin(colour(t.get('roof:colour'), '#5D6670' if h < 8 else ROOFS[int(hashf(b['id'], 1) * len(ROOFS))]))
        st = style(t, h)
        wall = (*wall[:3], st)
        roof = (*roof[:3], st)
        base = [bm.verts.new((x, y, g + h0 - (0.6 if h0 == 0 else 0))) for x, y in pts]
        top = [bm.verts.new((x, y, g + h)) for x, y in pts]
        run = 0.0
        for i in range(len(pts)):
            j = (i + 1) % len(pts)
            L = math.dist(pts[i], pts[j])
            f = bm.faces.new((base[i], base[j], top[j], top[i]))
            f.material_index = 0
            for loop, (u, v) in zip(f.loops, ((run, h0 - 0.6 if h0 == 0 else h0), (run + L, h0 - 0.6 if h0 == 0 else h0), (run + L, h), (run, h))):
                loop[uv].uv = (u, v)
                loop[col] = wall
            run += L
        try:
            f = bm.faces.new(top)
        except ValueError:
            continue
        f.material_index = 1
        for loop in f.loops:
            loop[uv].uv = (0.0, -1.0)     # v < 0 marks a roof for the shader
            loop[col] = roof
        res = bmesh.ops.triangulate(bm, faces=[f], quad_method='BEAUTY', ngon_method='EAR_CLIP')
        n += 1
        tris += len(pts) * 2 + len(res['faces'])
    o = kit.mesh_object('City buildings', bm, coll, ['facade', 'roof_city'])
    return o, n, tris


# --- Roads ------------------------------------------------------------------------------------------
WIDTH = {'trunk': 26.0, 'primary': 22.0, 'secondary': 15.0, 'tertiary': 11.0, 'residential': 7.0, 'unclassified': 7.0,
         'living_street': 5.5, 'service': 4.5, 'pedestrian': 7.0, 'footway': 2.6, 'cycleway': 3.0, 'path': 2.0,
         'primary_link': 8.0, 'secondary_link': 7.0, 'trunk_link': 9.0, 'tertiary_link': 6.0}
FOOT = {'pedestrian', 'footway', 'path', 'cycleway', 'steps'}
AVENUE = {'trunk', 'primary', 'secondary'}


def ribbon(bm, uv, pts3, width, mi, lift):
    """A strip along a polyline: UV u = metres along, v = metres across (centre 0)."""
    left = ac.polyline_offset([p[:2] for p in pts3], width / 2)
    right = ac.polyline_offset([p[:2] for p in pts3], -width / 2)
    runs = [0.0]
    for a, b in zip(pts3, pts3[1:]):
        runs.append(runs[-1] + math.dist(a[:2], b[:2]))
    vs = [(bm.verts.new((l.x, l.y, p[2] + lift)), bm.verts.new((r.x, r.y, p[2] + lift))) for l, r, p in zip(left, right, pts3)]
    for i in range(1, len(vs)):
        f = bm.faces.new((vs[i - 1][1], vs[i][1], vs[i][0], vs[i - 1][0]))
        f.material_index = mi
        for loop, (u, v) in zip(f.loops, ((runs[i - 1], -width / 2), (runs[i], -width / 2), (runs[i], width / 2), (runs[i - 1], width / 2))):
            loop[uv].uv = (u, v)


def densify(pts, step=12.0):
    out = []
    for a, b in zip(pts, pts[1:]):
        L = math.dist(a, b)
        k = max(1, int(L / step))
        out += [(a[0] + (b[0] - a[0]) * i / k, a[1] + (b[1] - a[1]) * i / k) for i in range(k)]
    out.append(tuple(pts[-1]))
    return out


def build_roads(coll, skip):
    """Carriageways (a lane-marking shader paints them), raised sidewalks along the avenues, and
    footpaths. Tunnels are left out; bridges and flyovers rise 7 m over their middle."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    avenues = []
    order = {'footway': 0, 'path': 0, 'cycleway': 0, 'pedestrian': 1, 'service': 1, 'living_street': 2, 'residential': 3,
             'unclassified': 3, 'tertiary': 4, 'tertiary_link': 4, 'secondary': 5, 'secondary_link': 5, 'primary': 6,
             'primary_link': 6, 'trunk': 7, 'trunk_link': 7}
    for w in F['ways'] + F['bridges']:
        kind = w.get('kind') or w.get('tags', {}).get('highway')
        if kind not in WIDTH:
            continue
        t = w.get('tags', {})
        if t.get('tunnel') or (num(t.get('layer')) or 0) < 0:
            continue
        pts = [p for p in w['pts'] if X0 + 20 < p[0] < X1 - 20 and Y0 + 20 < p[1] < Y1 - 20]
        if len(pts) < 2:
            continue
        pts = densify(pts)
        if skip(*pts[len(pts) // 2]):
            continue
        lanes = num(t.get('lanes'))
        width = max(WIDTH[kind], lanes * 3.4) if lanes and kind not in FOOT else WIDTH[kind]
        bridge = bool(t.get('bridge')) and (num(t.get('layer')) or 1) > 0 and kind not in FOOT
        pts3 = []
        total = sum(math.dist(a, b) for a, b in zip(pts, pts[1:]))
        run = 0.0
        for i, p in enumerate(pts):
            if i:
                run += math.dist(pts[i - 1], p)
            rise = 7.0 * max(0.0, math.sin(math.pi * min(run / total, 1.0))) ** 0.5 if bridge and total > 60 else 0.0
            pts3.append((p[0], p[1], zground(*p) + rise))
        foot = kind in FOOT
        ribbon(bm, uv, pts3, width, 1 if foot else 0, 0.06 + 0.012 * order.get(kind, 0))
        if kind in AVENUE or kind == 'tertiary':
            for side in (-1, 1):
                off = ac.polyline_offset([p[:2] for p in pts3], side * (width / 2 + 2.0))
                ribbon(bm, uv, [(o.x, o.y, p[2]) for o, p in zip(off, pts3)], 4.0, 1, 0.2)
            if kind in AVENUE:
                avenues.append((pts3, width, kind))
    o = kit.mesh_object('City roads', bm, coll, ['road_city', 'sidewalk'])
    return o, avenues


# --- Trees ------------------------------------------------------------------------------------------
def plane_prototype(protos, coll):
    me = protos['plane_autumn'].data.copy()
    me.name = 'proto plane'
    me.materials[0] = kit.mat('plane_leaf')
    o = bpy.data.objects.new('proto plane', me)
    o.hide_render = o.hide_viewport = True
    coll.objects.link(o)
    protos['plane'] = o
    return protos


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    root = bpy.data.collections.new('Core')
    scene.collection.children.link(root)
    c = {n: ac_coll for n, ac_coll in ((n, bpy.data.collections.new(n)) for n in
                                       ('Ground', 'Water', 'Roads', 'City', 'Buildings', 'Overhead', 'Garden', 'Gates', 'Trees', 'Prototypes', 'Markers'))}
    for v in c.values():
        root.children.link(v)
    protos = plane_prototype(oc.extra_prototypes(c['Prototypes'], kit.tree_prototypes(c['Prototypes'])), c['Prototypes'])

    # The Presidential Palace hero: appended from art-src/palace.blend at its own origin.
    (olat, olon), core_o = (32.04622025, 118.79225685), A.meta['origin_wgs84']
    kx = 111_320.0 * math.cos(math.radians(core_o[0]))
    pal = Vector(((olon - core_o[1]) * kx, (olat - core_o[0]) * 110_574.0))
    pal_z = zground(pal.x, pal.y)

    def in_palace(x, y):
        return -150 < x - pal.x < 160 and -170 < y - pal.y < 150

    with bpy.data.libraries.load(str(ROOT / 'art-src' / 'palace.blend')) as (src, dst):
        dst.collections = [n for n in src.collections if n in ('Buildings', 'Overhead', 'Garden')]
    for coll in dst.collections:
        target = c['Overhead'] if coll.name.startswith('Overhead') else c['Buildings']
        for o in list(coll.objects):
            if o.type != 'MESH' or o.name.startswith('Garden') and 'tree' in o.name.lower():
                continue
            o.matrix_world = Matrix.Translation((pal.x, pal.y, pal_z)) @ o.matrix_world
            target.objects.link(o)

    # Detailed ground over the centre (Xinjiekou to Gulou and the Palace); coarser out to the river.
    patch = ((-1500.0, 2100.0), (-1530.0, 3400.0))
    ac.terrain_patch('Terrain core', c['Ground'], patch[0], patch[1], ground, ['lawn', 'city_paving', 'lawn', 'canal_stone'], step=12.0)
    ac.terrain_patch('Terrain outer', c['Ground'], (X0 + 24, X1 - 24), (Y0 + 24, Y1 - 24),
                     lambda x, y: ground(x, y) if not (patch[0][0] + 6 < x < patch[0][1] - 6 and patch[1][0] + 6 < y < patch[1][1] - 6)
                     else (ground(x, y)[0] - 2.0, ground(x, y)[1]), ['lawn', 'city_paving', 'lawn', 'canal_stone'], step=24.0)
    # Each lake and river at its own level: the lowest DSM round its shore (the Yangtze is metres
    # below Xuanwu Lake).
    for k, w in enumerate(lakes):
        z = min(A.dsm_at(x, y) for x, y in w[::max(1, len(w) // 400)])
        ac.polygon_mesh(f'Water {k}', c['Water'], [w], z + 0.3, 'water')
    ac.polygon_mesh('Pitches', c['Ground'], pitches, 0.0, 'pitch')
    for o in c['Ground'].objects:
        if o.name.startswith('Pitches'):
            for v in o.data.vertices:
                v.co.z = zground(v.co.x, v.co.y) + 0.08
    city, n_b, tris = build_buildings(c['City'], in_palace)
    roads, avenues = build_roads(c['Roads'], in_palace)

    # Plane trees: both sides of every avenue, every 9 m, where there is no building; OSM tree rows.
    bmask = ac.Mask([b['pts'] for b in F['buildings']], A.extent, 2.0)
    trees = 0
    for pts3, width, kind in avenues:
        for side in (-1, 1):
            off = ac.polyline_offset([p[:2] for p in pts3], side * (width / 2 + 2.0))
            run, nxt = 0.0, rnd.uniform(0, 9)
            for i in range(1, len(off)):
                seg = (off[i] - off[i - 1]).length
                while nxt < run + seg:
                    q = off[i - 1].lerp(off[i], (nxt - run) / max(seg, 1e-6))
                    if not bmask.at(q.x, q.y) and not wet(q.x, q.y) and not in_palace(q.x, q.y):
                        kit.place(protos['plane'], c['Trees'], (q.x, q.y, zground(q.x, q.y)), rnd.uniform(0, 6.28), rnd.uniform(0.85, 1.1))
                        trees += 1
                    nxt += 9.0
                run += seg
    for w in F['ways']:
        if w.get('kind') == 'tree_row':
            for p in densify(w['pts'], 8.0):
                if not bmask.at(*p):
                    kit.place(protos['plane'], c['Trees'], (p[0], p[1], zground(*p)), rnd.uniform(0, 6.28), rnd.uniform(0.8, 1.05))
                    trees += 1
    kinds = ['broadleaf', 'broadleaf_sun', 'broadleaf_shade', 'cedar', 'willow', 'cherry']
    trees += ac.scatter(protos, c['Trees'], rnd, kinds, 9000, patch[0], patch[1],
                        lambda x, y: green_mask.at(x, y) and not bmask.at(x, y) and not wet(x, y) and not in_palace(x, y), zground, groves=500)

    # Markers: Xinjiekou looking up Zhongshan Road; the road itself; the Palace gate; Gulou.
    pk = c['Markers']
    xj = Vector((-445.0, 150.0))
    ac.add_point(pk, 'Spawn xinjiekou', (xj.x, xj.y, zground(*xj)), (-460.0, 900.0, zground(-460, 900) + 20))
    zs = Vector((-430.0, 1100.0))
    ac.add_point(pk, 'Spawn zhongshan', (zs.x, zs.y, zground(*zs)), (-460.0, 1900.0, zground(-460, 1900) + 8))
    pg = pal + Vector((9.5, -200.0))
    ac.add_point(pk, 'Spawn palace', (pg.x, pg.y, pal_z), (pal.x + 9.5, pal.y - 100.0, pal_z + 8))
    gl = Vector((-470.0, 2000.0))
    ac.add_point(pk, 'Spawn gulou', (gl.x, gl.y, zground(*gl)), (-600.0, 2100.0, zground(-600, 2100) + 10))
    for n, (target, at, toward) in enumerate((('palace', xj + Vector((14.0, 30.0)), xj + Vector((14.0, 60.0))),
                                             ('xinjiekou', pg + Vector((20.0, 10.0)), pg + Vector((40.0, 10.0))))):
        d = (toward - at).normalized()
        g = kit.moon_gate(f'Moon gate {n}', c['Gates'])
        z = zground(*at) if target == 'palace' else pal_z
        g.matrix_world = Matrix.Translation((at.x, at.y, z)) @ Matrix.Rotation(math.atan2(-d.x, d.y), 4, 'Z')
        ac.add_point(pk, f'Gate {target}@{n}', (at.x, at.y, z), (at.x + d.x * 10, at.y + d.y * 10, z))

    scene['origin_wgs84'] = list(A.meta['origin_wgs84'])
    scene['base_z'] = A.base
    scene['skyline_clip'] = [X0, X1, Y0, Y1]
    ac.lookdev(scene, sun_az=235, sun_el=18)
    cams = {
        'xinjiekou': ac.camera(scene, 'Cam xinjiekou', (xj.x, xj.y - 30, zground(*xj) + 1.7), (-460.0, 700.0, zground(-460, 700) + 25), 30),
        'aerial': ac.camera(scene, 'Cam aerial', (-1200.0, -900.0, 420.0), (-100.0, 700.0, 0.0), 32),
    }
    OUT_BLEND.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT_BLEND))
    print('BUILD', {'buildings': n_b, 'building_tris': tris, 'avenues': len(avenues), 'trees': trees, 'palace': [round(pal.x), round(pal.y), round(pal_z, 1)],
                    'objects': len(bpy.data.objects)}, flush=True)
    if RENDER:
        ac.render_views(scene, cams, RENDERS, 'lookdev')


main()
