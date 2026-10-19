"""Old-city kit: pagodas, halls, horse-head-wall houses, the Ming wall, bridges, lanterns.

Parts that repeat by the hundred (houses, wall merlons, lanterns) write into a caller's bmesh so a
whole district stays a handful of objects (one draw per material after export). Hero pieces
(pagodas, halls) return objects. Same conventions as kit.py: metres, Z up, palette materials.
"""
import math

import bmesh
from mathutils import Matrix, Vector

import kit
from kit import add_box, mesh_object

kit.PALETTE.update({
    'whitewash': '#F1EDE3',       # Huizhou-style white walls (Qinhuai, Laomendong)
    'timber_dark': '#5C3326',     # dark red-brown timber frames and balconies
    'tile_dark': '#4D545C',       # grey roof tiles
    'temple_ochre': '#E6B04A',    # Jiming's yellow walls
    'temple_peach': '#E9A58F',    # Jiming's peach-pink hall walls
    'lantern': '#E8473A',         # red lanterns: emissive in the web (name contains "lantern")
    'lantern_glow': '#FFC266',    # warm window and eave light at dusk
    'gold_roof': '#D9A23A',       # Kuixing pavilion and pleasure-boat roofs
    'cherry': '#F2B8C6',
    'willow': '#9DBF4A',
    'lotus': '#5E9B4A',
    'lotus_flower': '#F4A6B8',
    'canal_stone': '#9C978C',
})


# --- Octagonal roofs and pagodas ---------------------------------------------------------------------

def poly_roof(bm, center, r_eave, r_top, height, sides=8, lift=0.6, thickness=0.25, mi=0, rings=8, per_side=4, rot=0.0):
    """Concave polygonal roof skirt from an eave radius up to a top radius, corners lifted."""
    cx, cy, cz = center
    n = sides * per_side
    grid = []
    for k in range(rings + 1):
        t = k / rings
        row = []
        for i in range(n):
            side, f = divmod(i, per_side)
            a0 = rot + 2 * math.pi * side / sides
            a1 = rot + 2 * math.pi * (side + 1) / sides
            fr = f / per_side
            px = math.cos(a0) * (1 - fr) + math.cos(a1) * fr
            py = math.sin(a0) * (1 - fr) + math.sin(a1) * fr
            r = r_eave + (r_top - r_eave) * t
            corner = (1 - min(fr, 1 - fr) * 2) ** 3    # 1 at a vertex, 0 mid-side
            z = height * t ** 1.7 + lift * corner * (1 - t) ** 3
            row.append(bm.verts.new((cx + px * r, cy + py * r, cz + z)))
        grid.append(row)
    faces = []
    for k in range(rings):
        for i in range(n):
            faces.append(bm.faces.new((grid[k][i], grid[k][(i + 1) % n], grid[k + 1][(i + 1) % n], grid[k + 1][i])))
    geom = bmesh.ops.extrude_face_region(bm, geom=faces)
    ext = [e for e in geom['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, -thickness), verts=ext)
    for f in faces + [f for f in geom['geom'] if isinstance(f, bmesh.types.BMFace)]:
        f.material_index = mi
    for v in ext:
        for f in v.link_faces:
            f.material_index = mi


def prism(bm, center, radius, height, sides=8, mi=0, rot=0.0):
    r = bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=radius, radius2=radius, depth=height)
    bmesh.ops.rotate(bm, cent=(0, 0, 0), matrix=Matrix.Rotation(rot + math.pi / sides, 3, 'Z'), verts=r['verts'])
    bmesh.ops.translate(bm, vec=(center[0], center[1], center[2] + height / 2), verts=r['verts'])
    for f in {f for v in r['verts'] for f in v.link_faces}:
        f.material_index = mi


def pagoda(name, coll, base, levels=7, r0=5.2, r_top=3.4, level_h=4.6, sides=8, walls='temple_ochre',
           trim='vermilion', roof='tile_dark', finial='gold', podium_r=7.0, spire=6.0):
    """Multi-storey pavilion pagoda: a stone podium, each storey a polygonal body with a red
    balcony and a lifted roof skirt, a gold spire on top. Total height is returned."""
    bm = bmesh.new()
    x, y, z = base
    prism(bm, (x, y, z), podium_r, 1.6, sides, mi=3)
    zc = z + 1.6
    for k in range(levels):
        t = k / max(levels - 1, 1)
        r = r0 + (r_top - r0) * t
        h = level_h * (1.0 - 0.08 * t)
        prism(bm, (x, y, zc), r, h, sides, mi=0)
        # Balcony ring and posts half a storey up, red lacquer.
        prism(bm, (x, y, zc + 0.15), r + 0.9, 0.18, sides, mi=1)
        for i in range(sides):
            a = 2 * math.pi * i / sides
            add_box(bm, (x + math.cos(a) * (r + 0.85), y + math.sin(a) * (r + 0.85), zc + 0.75), (0.16, 0.16, 1.1), mi=1)
        # Door/window band on every face.
        for i in range(sides):
            a = 2 * math.pi * (i + 0.5) / sides
            add_box(bm, (x + math.cos(a) * (r * math.cos(math.pi / sides) + 0.05), y + math.sin(a) * (r * math.cos(math.pi / sides) + 0.05),
                         zc + h * 0.48), (0.2, 0.2, h * 0.5), mi=1,
                    matrix=None)
        zc += h
        poly_roof(bm, (x, y, zc - 0.6), r + 2.3, r * 0.82, 1.5, sides, lift=0.9, mi=2)
    # Top roof, spire with rings, finial.
    poly_roof(bm, (x, y, zc - 0.2), r_top + 1.8, 0.4, 3.4, sides, lift=0.8, mi=2, rings=10)
    zc += 3.0
    s = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.35, radius2=0.08, depth=spire)
    bmesh.ops.translate(bm, vec=(x, y, zc + spire / 2), verts=s['verts'])
    for f in {f for v in s['verts'] for f in v.link_faces}:
        f.material_index = 4
    for k in range(5):
        tr = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.55 - k * 0.07, radius2=0.55 - k * 0.07, depth=0.22)
        bmesh.ops.translate(bm, vec=(x, y, zc + 0.8 + k * 0.7), verts=tr['verts'])
        for f in {f for v in tr['verts'] for f in v.link_faces}:
            f.material_index = 4
    o = mesh_object(name, bm, coll, [walls, trim, roof, 'granite_shade', finial])
    return o, zc + spire - z


# --- Halls -------------------------------------------------------------------------------------------

def hall(name, coll, center, w, d, h, *, walls='vermilion', roof='tile_dark', yaw=0.0, double=False,
         plinth=0.9, columns=True, lift=0.8, roof_h=None):
    """A timber hall: stone plinth, coloured walls with a red colonnade on the front, lattice
    doors, and a curved hip roof (double eave when asked). Front faces local -Y."""
    bm = bmesh.new()
    M = Matrix.Translation(center) @ Matrix.Rotation(yaw, 4, 'Z')
    add_box(bm, (0, 0, plinth / 2), (w + 2.4, d + 2.4, plinth), mi=3, matrix=M)
    add_box(bm, (0, 0, plinth + h / 2), (w - 1.6, d - 1.6, h), mi=0, matrix=M)
    if columns:
        n = max(4, int(w / 3.2))
        for k in range(n + 1):
            x = -w / 2 + w * k / n
            add_box(bm, (x, -d / 2, plinth + h / 2), (0.42, 0.42, h), mi=1, matrix=M)
        add_box(bm, (0, -d / 2, plinth + h - 0.3), (w + 0.4, 0.5, 0.6), mi=1, matrix=M)
    # Lattice doors along the front: dark panels in red frames.
    n = max(3, int((w - 2) / 2.6))
    for k in range(n):
        x = -(w - 2.4) / 2 + (w - 2.4) * (k + 0.5) / n
        add_box(bm, (x, -(d - 1.6) / 2 - 0.08, plinth + h * 0.42), (2.0, 0.12, h * 0.78), mi=1, matrix=M)
        add_box(bm, (x, -(d - 1.6) / 2 - 0.15, plinth + h * 0.42), (1.6, 0.1, h * 0.66), mi=4, matrix=M)
    o = mesh_object(name, bm, coll, [walls, 'vermilion', roof, 'granite_shade', 'timber_dark'])
    rh = roof_h or max(3.0, d * 0.32)
    rz = plinth + h
    roofs = []
    if double:
        roofs.append(kit.curved_roof(name + ' lower roof', coll, (0, 0, 0), w / 2 + 1.8, d / 2 + 1.8, rh * 0.35,
                                     lift=lift * 0.6, ridge_ratio=0.95, thickness=0.3, material=roof, ridge_material=roof))
        roofs[-1].matrix_world = M @ Matrix.Translation((0, 0, rz)) @ roofs[-1].matrix_world
        rz += 1.6
        roofs.append(kit.curved_roof(name + ' roof', coll, (0, 0, 0), w / 2 + 0.6, d / 2 + 0.6, rh, lift=lift,
                                     ridge_ratio=0.6, thickness=0.35, material=roof, ridge_material=roof))
        ring = bmesh.new()
        add_box(ring, (0, 0, plinth + h + 0.8), (w - 1.6, d - 1.6, 1.6), mi=0, matrix=M)
        mesh_object(name + ' clerestory', ring, coll, [walls])
    else:
        roofs.append(kit.curved_roof(name + ' roof', coll, (0, 0, 0), w / 2 + 1.4, d / 2 + 1.4, rh, lift=lift,
                                     ridge_ratio=0.62, thickness=0.35, material=roof, ridge_material=roof))
    roofs[-1].matrix_world = M @ Matrix.Translation((0, 0, rz)) @ roofs[-1].matrix_world
    return o


# --- Houses with horse-head walls -------------------------------------------------------------------

def hui_house(bm, M, w, d, floors=2, *, steps=2, balcony=True, lanterns=0, mats=None):
    """A Jiangnan townhouse into a shared bmesh: whitewashed walls, dark timber ground floor and
    balcony, a grey gable roof along w, and stepped horse-head gable walls (马头墙) at both ends
    with dark tiled caps. Front faces local -Y. Material indices: mats dict with keys
    wall, timber, tile, lantern, glow."""
    m = mats
    fh = 3.2
    H = floors * fh
    add_box(bm, (0, 0, H / 2), (w, d, H), mi=m['wall'], matrix=M)
    # Ground floor: dark timber shopfront with a warm lit interior.
    add_box(bm, (0, -d / 2 - 0.06, fh * 0.45), (w * 0.9, 0.12, fh * 0.8), mi=m['timber'], matrix=M)
    for k in range(max(2, int(w / 2.2))):
        x = -w * 0.4 + w * 0.8 * (k + 0.5) / max(2, int(w / 2.2))
        add_box(bm, (x, -d / 2 - 0.1, fh * 0.48), (1.3, 0.08, fh * 0.55), mi=m['glow'], matrix=M)
    # Upper floors: windows in dark frames, and a projecting balcony.
    for f in range(1, floors):
        z = f * fh + fh * 0.5
        for k in range(max(1, int(w / 3.0))):
            x = -w / 2 + w * (k + 0.5) / max(1, int(w / 3.0))
            add_box(bm, (x, -d / 2 - 0.05, z), (1.5, 0.1, 1.5), mi=m['timber'], matrix=M)
            add_box(bm, (x, -d / 2 - 0.09, z), (1.1, 0.08, 1.1), mi=m['glow'], matrix=M)
        if balcony and f == 1:
            add_box(bm, (0, -d / 2 - 0.7, f * fh), (w * 0.92, 1.4, 0.16), mi=m['timber'], matrix=M)
            add_box(bm, (0, -d / 2 - 1.35, f * fh + 0.5), (w * 0.92, 0.08, 0.9), mi=m['timber'], matrix=M)
    # Gable roof along w: two sloping slabs.
    rise = d * 0.36
    for s in (-1, 1):
        slope = math.atan2(rise, d / 2 + 0.6)
        R = M @ Matrix.Translation((0, s * (d / 4 + 0.15), H + rise / 2)) @ Matrix.Rotation(-s * slope, 4, 'X')
        add_box(bm, (0, 0, 0), (w + 0.5, math.hypot(d / 2 + 0.6, rise), 0.22), mi=m['tile'], matrix=R)
    add_box(bm, (0, 0, H + rise + 0.12), (w + 0.6, 0.35, 0.3), mi=m['tile'], matrix=M)
    # Horse-head walls: each end wall rises in `steps` stairs above the roof, capped in dark tile.
    for sx in (-1, 1):
        x = sx * (w / 2 + 0.12)
        for k in range(steps + 1):
            span = d * (1 - k / (steps + 1.0))
            top = H + rise * (0.35 + 0.65 * (k + 1) / (steps + 1)) + 0.6
            add_box(bm, (x, 0, (H + top) / 2), (0.36, span, top - H), mi=m['wall'], matrix=M)
            add_box(bm, (x, 0, top + 0.12), (0.62, span + 0.3, 0.24), mi=m['tile'], matrix=M)
    for k in range(lanterns):
        x = -w / 2 + w * (k + 0.5) / lanterns
        add_box(bm, (x, -d / 2 - 0.9, fh - 0.35), (0.45, 0.45, 0.6), mi=m['lantern'], matrix=M)
    return H + rise


# --- The Ming city wall ------------------------------------------------------------------------------

def city_wall(bm, pts, ground, *, height=14.0, width=12.0, outer_side=1, mi_brick=0, mi_top=1, merlon_every=2.6,
              top_override=None):
    """Grey-brick wall along a polyline: a battered body, a paved walkway on top, crenellated
    parapet on the outer side and a low parapet inside. ground(x, y) gives the foot height; the
    top follows the smoothed foot plus height so the walkway has no sudden steps."""
    pts = [Vector(p) for p in pts]
    if len(pts) < 2:
        return
    # Resample every 4 m, smooth the base along the run.
    res = [pts[0]]
    for a, b in zip(pts, pts[1:]):
        n = max(1, int((b - a).length / 4.0))
        res += [a.lerp(b, k / n) for k in range(1, n + 1)]
    base = [ground(p.x, p.y) for p in res]
    sm = [sum(base[max(0, i - 4):i + 5]) / len(base[max(0, i - 4):i + 5]) for i in range(len(base))]
    tops = [top_override if top_override is not None else z + height for z in sm]
    acc = 0.0
    for i in range(len(res) - 1):
        a, b = res[i], res[i + 1]
        seg = (b - a).length
        if seg < 1e-3:
            continue
        t = (b - a) / seg
        nrm = Vector((-t.y, t.x)) * outer_side
        mid = (a + b) / 2
        ang = math.atan2(t.y, t.x)
        zt = (tops[i] + tops[i + 1]) / 2
        zb = min(base[i], base[i + 1]) - 1.0
        R = Matrix.Translation((mid.x, mid.y, 0)) @ Matrix.Rotation(ang, 4, 'Z')
        add_box(bm, (0, 0, (zb + zt) / 2), (seg + 0.05, width, zt - zb), mi=mi_brick, matrix=R)
        add_box(bm, (0, 0, zt + 0.05), (seg + 0.05, width - 1.6, 0.1), mi=mi_top, matrix=R)
        add_box(bm, (0, -width / 2 + 0.3, zt + 0.55), (seg + 0.05, 0.6, 1.1), mi=mi_brick, matrix=R)   # inner parapet
        add_box(bm, (0, width / 2 - 0.35, zt + 0.6), (seg + 0.05, 0.7, 1.2), mi=mi_brick, matrix=R)     # outer parapet
        # Merlons along the outer parapet.
        k = 0
        while acc + k * merlon_every < acc + seg:
            off = -seg / 2 + (k + 0.5) * merlon_every
            if off < seg / 2:
                add_box(bm, (off, width / 2 - 0.35, zt + 1.6), (1.3, 0.7, 0.8), mi=mi_brick, matrix=R)
            k += 1
        acc += seg


# --- Bridges and props ------------------------------------------------------------------------------

def arch_bridge(bm, a, b, z_banks, *, width=6.0, rise=2.4, mi_stone=0, mi_rail=0, segs=16):
    """Stone bridge from a to b: a gently humped deck with balustrades, piers into the water."""
    a, b = Vector(a), Vector(b)
    L = (b - a).length
    t = (b - a) / L
    ang = math.atan2(t.y, t.x)
    for k in range(segs):
        u0, u1 = k / segs, (k + 1) / segs
        z0 = z_banks + rise * math.sin(math.pi * u0)
        z1 = z_banks + rise * math.sin(math.pi * u1)
        p = a.lerp(b, (u0 + u1) / 2)
        R = Matrix.Translation((p.x, p.y, (z0 + z1) / 2)) @ Matrix.Rotation(ang, 4, 'Z') @ \
            Matrix.Rotation(math.atan2(z1 - z0, L / segs), 4, 'Y').inverted()
        add_box(bm, (0, 0, -0.35), (L / segs + 0.05, width, 0.7), mi=mi_stone, matrix=R)
        for s in (-1, 1):
            add_box(bm, (0, s * (width / 2 - 0.15), 0.55), (L / segs + 0.05, 0.25, 0.9), mi=mi_rail, matrix=R)
    for u in (0.25, 0.5, 0.75):
        p = a.lerp(b, u)
        R = Matrix.Translation((p.x, p.y, 0)) @ Matrix.Rotation(ang, 4, 'Z')
        add_box(bm, (0, 0, z_banks - 3), (1.4, width - 0.6, 6), mi=mi_stone, matrix=R)


def lantern_string(bm, a, b, n, mi, sag=1.2):
    """A sagging line of red lanterns between two points (3D)."""
    a, b = Vector(a), Vector(b)
    for k in range(1, n + 1):
        u = k / (n + 1)
        p = a.lerp(b, u)
        p.z -= sag * 4 * u * (1 - u)
        add_box(bm, (p.x, p.y, p.z - 0.35), (0.42, 0.42, 0.55), mi=mi)


def extra_prototypes(coll, protos):
    """Look-dev stand-ins for the city kinds; the web draws its own painted versions by name."""
    rnd_lobes = [(0.0, 0.0), (1.4, 0.6), (-1.2, 0.9), (0.4, -1.5), (-0.8, -1.0)]

    def make(name, crown, h, r, hang=False, flat=False):
        bm = bmesh.new()
        if flat:
            c = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=r, radius2=r * 0.9, depth=0.08)
            for f in {f for v in c['verts'] for f in v.link_faces}:
                f.material_index = 0
            o = mesh_object('proto ' + name, bm, coll, [crown])
        else:
            add_box(bm, (0, 0, h * 0.3), (r * 0.12, r * 0.12, h * 0.6), mi=1)
            for dx, dy in rnd_lobes:
                if hang:
                    s = bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=r * 0.45)
                    bmesh.ops.scale(bm, vec=(1, 1, 2.2), verts=s['verts'])
                    bmesh.ops.translate(bm, vec=(dx * r * 0.45, dy * r * 0.45, h * 0.62), verts=s['verts'])
                else:
                    s = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r * 0.6)
                    bmesh.ops.translate(bm, vec=(dx * r * 0.4, dy * r * 0.4, h * 0.75), verts=s['verts'])
                for f in {f for v in s['verts'] for f in v.link_faces}:
                    f.material_index = 0
            o = mesh_object('proto ' + name, bm, coll, [crown, 'bark'])
        o.hide_render = o.hide_viewport = True
        protos[name] = o
    make('cherry', 'cherry', 8, 3.8)
    make('willow', 'willow', 10, 4.2, hang=True)
    make('lotus', 'lotus', 0, 0.55, flat=True)
    make('lotus_flower', 'lotus_flower', 0, 0.25, flat=True)
    return protos
