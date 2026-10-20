"""Shared Blender kit for the city rebuild: palette materials and parametric building parts.

Every landmark script imports this, so a roof or balustrade looks the same everywhere and a fix
lands once. Units are metres, Z up, X east, Y north (the web export converts to (x, z, -y)).
Parts return mesh objects linked to the given collection; nothing here touches scene settings.
"""
import math
import random

import bmesh
import bpy
from mathutils import Matrix, Vector

# Palette from design/ART-BIBLE.md (sRGB hex). Keep names stable: the web loader keys toon
# ramps on the material name.
PALETTE = {
    'granite': '#E9E4D8',
    'granite_shade': '#C9CED3',
    'paving': '#CFC6B4',
    'paving_joint': '#A79E8C',
    'roof_cobalt': '#2B3F9E',
    'roof_cobalt_ridge': '#1A2466',
    'roof_green': '#3E7D5A',
    'roof_grey': '#5D6670',
    'vermilion': '#B8432F',
    'ochre': '#E2B04A',
    'ming_brick': '#8E8C86',
    'gold': '#D6A640',
    'bronze': '#4B5A4A',
    'opening': '#2A2622',
    'leaf_sun': '#A7C24A',
    'leaf_mid': '#5E8F3A',
    'leaf_shade': '#2F5A3A',
    'cedar': '#3D5E3F',
    'hedge': '#4F7F3A',
    'lawn': '#8DB04A',
    'forest_floor': '#5C7A3A',
    'bark': '#5A4636',
    'plane_bark': '#B9B39A',
    'autumn_plane': '#E2B233',
    'autumn_maple': '#D0622E',
    'water': '#5FA8B5',
    'road': '#A39C90',
    'meiling_wall': '#EBD392',
    'vine': '#6E9A3E',
}


def srgb(hexstr):
    h = hexstr.lstrip('#')
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4) for v in c) + (1.0,)


_materials = {}


def mat(name, roughness=0.85):
    """Palette material. Principled only, so glTF exports the base colour the web toon shader needs."""
    if name in _materials:
        return _materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = srgb(PALETTE[name])
    p.inputs['Roughness'].default_value = roughness
    m.diffuse_color = srgb(PALETTE[name])
    _materials[name] = m
    return m


def link(obj, coll):
    coll.objects.link(obj)
    return obj


def mesh_object(name, bm, coll, material_names):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for n in material_names:
        me.materials.append(mat(n))
    for poly in me.polygons:
        poly.use_smooth = False
    return link(bpy.data.objects.new(name, me), coll)


def add_box(bm, center, size, mi=0, matrix=None):
    """Axis-aligned box into an existing bmesh; returns the new faces.

    Built vertex by vertex: bmesh.ops.create_cube slows down as the target mesh grows, which made
    a district of houses (tens of thousands of boxes in one bmesh) quadratic: minutes, not seconds.
    """
    m = Matrix.Translation(Vector(center)) @ Matrix.Diagonal((size[0], size[1], size[2], 1))
    if matrix is not None:
        m = matrix @ m
    v = [bm.verts.new(m @ Vector((x, y, z))) for x in (-.5, .5) for y in (-.5, .5) for z in (-.5, .5)]
    # Corners indexed by (x, y, z) bits: 0 = (-,-,-) ... 7 = (+,+,+). Faces wound outwards.
    quads = ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3))
    faces = [bm.faces.new((v[a], v[b], v[c], v[d])) for a, b, c, d in quads]
    if m.determinant() < 0:   # a mirrored matrix turns the winding inside out
        for f in faces:
            f.normal_flip()
    for f in faces:
        f.material_index = mi
    return faces


def box(name, center, size, coll, material):
    bm = bmesh.new()
    add_box(bm, center, size)
    return mesh_object(name, bm, coll, [material])


def curved_roof(name, coll, center, half_x, half_y, height, *, ridge_ratio=0.45, lift=0.9,
                thickness=0.35, material='roof_cobalt', ridge_material='roof_cobalt_ridge', res=(36, 22), gable=0.0):
    """Chinese hip roof: concave slopes, a level ridge and lifted corners.

    The slope profile h = H * t**1.7 (t = inset from the eave over the half-depth) is steep at the
    ridge and nearly flat at the eave, which is what makes the curve read from below.
    ridge_ratio sets the ridge length as a fraction of the long side; 1.0 is close to a gable.
    gable > 0 makes a hip-and-gable roof (歇山): the end hips stop at that fraction of the rise,
    and above it the long slopes run on to the ridge, leaving a vertical triangular gable (山花)
    at each end. Extra grid columns either side of the gable line keep its face crisp.
    """
    nx, ny = res
    bm = bmesh.new()
    a, b = half_x, half_y
    inset_max = b
    ridge_half =(a - b) + b * ridge_ratio * 0.5 if a > b else a * ridge_ratio
    xs = [-a + 2 * a * i / nx for i in range(nx + 1)]
    if gable > 0:
        xg = a - gable * (a - ridge_half)
        xs = sorted(set(xs + [s * (xg + e) for s in (-1, 1) for e in (-0.02, 0.02)]))
    grid = []
    for j in range(ny + 1):
        row = []
        y = -b + 2 * b * j / ny
        for x in xs:
            # Distance from the eave line, measuring the end slopes against the shorter hip.
            dy = b - abs(y)
            dx = (a - abs(x)) * (b / max(a - ridge_half, 1e-3))
            d = min(dx, dy)
            if gable > 0 and dx / inset_max >= gable:
                d = dy                          # inside the gable line only the long slopes rise
            t = min(max(d / inset_max, 0.0), 1.0)  # grid edges can round to -1e-16
            z = height * t ** 1.7
            # Corner lift: strongest at the eave corners, fading inward and along the eave.
            cx, cy = abs(x) / a, abs(y) / b
            corner = (cx * cy) ** 6
            z += lift * corner * max(0.0, 1 - t * 3)
            row.append(bm.verts.new((center[0] + x, center[1] + y, center[2] + z)))
        grid.append(row)
    for j in range(ny):
        for i in range(len(xs) - 1):
            bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Thickness downwards so eaves read as a slab from below.
    geom = bmesh.ops.extrude_face_region(bm, geom=list(bm.faces))
    ext = [e for e in geom['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, -thickness), verts=ext)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Ridge beam with raised ends.
    rz = center[2] + height
    if gable > 0:
        ridge_half = xg                       # the ridge runs between the gables
    ridge_faces = add_box(bm, (center[0], center[1], rz + 0.35), (2 * ridge_half + 0.6, 0.6, 0.8), mi=1)
    for sx in (-1, 1):
        add_box(bm, (center[0] + sx * (ridge_half + 0.2), center[1], rz + 0.9), (0.7, 0.6, 1.4), mi=1)
    del ridge_faces
    return mesh_object(name, bm, coll, [material, ridge_material])


def stair_flight(bm, start, width, count, riser, tread, mi=0, matrix=None, riser_mi=None):
    """Solid steps climbing +Y from start (front-bottom-centre). Returns the top-front point.

    riser_mi gives the vertical faces their own material: treads and risers in one colour
    flatten a long stair into a ramp, in look-dev and in the web toon shader alike.
    """
    x, y, z = start
    for k in range(count):
        # Each block runs down to the flight's base, so there are no gaps under it on uneven ground.
        faces = add_box(bm, (x, y + tread * (k + 0.5), z + riser * (k + 1) / 2), (width, tread, riser * (k + 1)),
                        mi=mi, matrix=matrix)
        if riser_mi is not None:
            for f in faces:
                f.normal_update()
                if f.normal.z < 0.5:
                    f.material_index = riser_mi
    return (x, y + tread * count, z + riser * count)


def balustrade(bm, p0, p1, z0, z1, mi=0, post_every=2.2, height=1.05, matrix=None):
    """Stone posts and a top rail from p0 to p1 (XY), its base sloping from z0 to z1."""
    p0, p1 = Vector((*p0, 0)), Vector((*p1, 0))
    length = (p1 - p0).length
    n = max(1, int(length / post_every))
    d = (p1 - p0).normalized()
    ang = math.atan2(d.y, d.x)
    rot = Matrix.Rotation(ang, 4, 'Z')
    for k in range(n + 1):
        t = k / n
        p = p0.lerp(p1, t)
        z = z0 + (z1 - z0) * t
        add_box(bm, (p.x, p.y, z + height / 2), (0.32, 0.32, height + 0.15), mi=mi, matrix=matrix)
    # Rail as sloped segments between posts.
    for k in range(n):
        a, b = p0.lerp(p1, k / n), p0.lerp(p1, (k + 1) / n)
        za = z0 + (z1 - z0) * k / n + height - 0.12
        zb = z0 + (z1 - z0) * (k + 1) / n + height - 0.12
        mid = (a + b) / 2
        seg = (b - a).length
        slope = math.atan2(zb - za, seg)
        m = Matrix.Translation((mid.x, mid.y, (za + zb) / 2)) @ rot @ Matrix.Rotation(-slope, 4, 'Y')
        r = bmesh.ops.create_cube(bm, size=1.0)
        bmesh.ops.transform(bm, matrix=(matrix or Matrix()) @ m @ Matrix.Diagonal((seg, 0.24, 0.2, 1)),
                            verts=r['verts'])
        for f in {f for v in r['verts'] for f in v.link_faces}:
            f.material_index = mi
        # Lower rail
        r = bmesh.ops.create_cube(bm, size=1.0)
        m2 = Matrix.Translation((mid.x, mid.y, (za + zb) / 2 - 0.62)) @ rot @ Matrix.Rotation(-slope, 4, 'Y')
        bmesh.ops.transform(bm, matrix=(matrix or Matrix()) @ m2 @ Matrix.Diagonal((seg, 0.18, 0.14, 1)),
                            verts=r['verts'])
        for f in {f for v in r['verts'] for f in v.link_faces}:
            f.material_index = mi


def arch_panel(bm, center, width, height, depth=0.3, mi=0, segments=10, matrix=None, facing='-Y'):
    """A dark round-arched opening panel set into a wall face (reads as a doorway in a painted look)."""
    cx, cy, cz = center
    r = width / 2
    pts = [(-r, 0), (r, 0), (r, height - r)]
    for k in range(1, segments):
        a = math.pi * k / segments
        pts.append((r * math.cos(a), height - r + r * math.sin(a)))
    pts.append((-r, height - r))
    sgn = -1 if facing == '-Y' else 1
    front = [bm.verts.new((cx + x, cy + sgn * depth * 0.5, cz + z)) for x, z in pts]
    back = [bm.verts.new((cx + x, cy - sgn * depth * 0.5, cz + z)) for x, z in pts]
    if matrix is not None:
        bmesh.ops.transform(bm, matrix=matrix, verts=front + back)
    faces = [bm.faces.new(front), bm.faces.new(list(reversed(back)))]
    n = len(pts)
    for k in range(n):
        faces.append(bm.faces.new((front[k], front[(k + 1) % n], back[(k + 1) % n], back[k])))
    for f in faces:
        f.material_index = mi
    return faces


# --- Trees ---------------------------------------------------------------------------------------

def tree_prototypes(coll):
    """Low-poly look-dev trees. The web replaces crowns with painted cards; positions are what export."""
    protos = {}
    rnd = random.Random(7)

    def blob_tree(name, crown_mat, trunk_mat, h, r, lobes):
        bm = bmesh.new()
        add_box(bm, (0, 0, h * 0.3), (r * 0.12, r * 0.12, h * 0.6), mi=1)
        for k in range(lobes):
            ang = 2 * math.pi * k / lobes + rnd.random()
            rr = r * (0.55 + 0.25 * rnd.random())
            c = (math.cos(ang) * r * 0.45, math.sin(ang) * r * 0.45, h * (0.62 + 0.18 * rnd.random()))
            s = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=rr)
            bmesh.ops.translate(bm, vec=c, verts=s['verts'])
        s = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r * 0.75)
        bmesh.ops.translate(bm, vec=(0, 0, h * 0.82), verts=s['verts'])
        for f in bm.faces:
            if f.material_index != 1:
                f.material_index = 0
        o = mesh_object(name, bm, coll, [crown_mat, trunk_mat])
        for p in o.data.polygons:
            p.use_smooth = True
        return o

    def cone_tree(name, h, r, tiers):
        bm = bmesh.new()
        add_box(bm, (0, 0, h * 0.1), (0.4, 0.4, h * 0.2), mi=1)
        for k in range(tiers):
            t = k / tiers
            c = bmesh.ops.create_cone(bm, cap_ends=True, segments=9, radius1=r * (1 - t * 0.75),
                                      radius2=0.05, depth=h * 0.42)
            bmesh.ops.translate(bm, vec=(0, 0, h * (0.32 + 0.6 * t)), verts=c['verts'])
        o = mesh_object(name, bm, coll, ['cedar', 'bark'])
        return o

    protos['broadleaf'] = blob_tree('proto broadleaf', 'leaf_mid', 'bark', 14, 5.0, 6)
    protos['broadleaf_sun'] = blob_tree('proto broadleaf sun', 'leaf_sun', 'bark', 12, 4.2, 5)
    protos['broadleaf_shade'] = blob_tree('proto broadleaf shade', 'leaf_shade', 'bark', 16, 5.5, 7)
    protos['plane_autumn'] = blob_tree('proto plane autumn', 'autumn_plane', 'plane_bark', 18, 5.5, 6)
    protos['maple_autumn'] = blob_tree('proto maple autumn', 'autumn_maple', 'bark', 9, 3.6, 5)
    protos['far'] = blob_tree('proto far', 'leaf_mid', 'bark', 12, 4.6, 3)
    protos['cedar'] = cone_tree('proto cedar', 18, 4.2, 5)
    protos['cypress'] = cone_tree('proto cypress', 9, 1.6, 4)
    for o in protos.values():
        o.hide_render = True
        o.hide_viewport = True
    return protos


def place(proto, coll, loc, rot=0.0, scale=1.0, name=None):
    o = bpy.data.objects.new(name or proto.name.replace('proto ', ''), proto.data)
    o.location = loc
    o.rotation_euler = (0, 0, rot)
    o.scale = (scale, scale, scale)
    coll.objects.link(o)
    return o


def moon_gate(name, coll, width=6.4, height=4.6, radius=1.55, depth=0.5, wall='granite', coping='roof_grey'):
    """月洞门: a short white garden wall pierced by a round opening, grey tile coping on top.

    Built without booleans: the wall face is a fan of quads from the circle out to the rectangle
    (corner angles included, so the rectangle stays square), mirrored front and back, with the
    opening's inner band joining them. Local frame: centred on the opening's ground point, wall
    in the XZ plane, faces +/-Y. The opening's bottom sits 0.15 m above the ground.
    """
    bm = bmesh.new()
    cz = radius + 0.15
    hw = width / 2
    corners = [math.atan2(height - cz, hw), math.atan2(height - cz, -hw), math.atan2(-cz, -hw) + 2 * math.pi,
               math.atan2(-cz, hw) + 2 * math.pi]
    angles = sorted({round(2 * math.pi * k / 40, 6) for k in range(40)} | {round(a % (2 * math.pi), 6) for a in corners})

    def rect_point(a):
        dx, dz = math.cos(a), math.sin(a)
        tx = hw / abs(dx) if abs(dx) > 1e-9 else 1e9
        tz = ((height - cz) / dz) if dz > 1e-9 else (cz / -dz if dz < -1e-9 else 1e9)
        t = min(tx, tz)
        return dx * t, cz + dz * t

    rings = {}
    for side, y in (('front', -depth / 2), ('back', depth / 2)):
        inner = [bm.verts.new((radius * math.cos(a), y, cz + radius * math.sin(a))) for a in angles]
        outer = [bm.verts.new((rect_point(a)[0], y, rect_point(a)[1])) for a in angles]
        rings[side] = inner
        n = len(angles)
        for k in range(n):
            q = (inner[k], inner[(k + 1) % n], outer[(k + 1) % n], outer[k])
            bm.faces.new(q if side == 'back' else tuple(reversed(q)))
    n = len(angles)
    fi, bi = rings['front'], rings['back']
    for k in range(n):
        bm.faces.new((fi[k], fi[(k + 1) % n], bi[(k + 1) % n], bi[k]))
    # Wall ends and top as boxes (simple closed caps).
    add_box(bm, (-hw - 0.15, 0, height / 2), (0.3, depth + 0.1, height), mi=0)
    add_box(bm, (hw + 0.15, 0, height / 2), (0.3, depth + 0.1, height), mi=0)
    add_box(bm, (0, 0, height + 0.1), (width + 0.6, depth + 0.1, 0.2), mi=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_object(name, bm, coll, [wall])
    roof = curved_roof(name + ' coping', coll, (0, 0, height + 0.2), width / 2 + 0.6, depth / 2 + 0.55, 0.55,
                       lift=0.25, thickness=0.12, material=coping, ridge_material=coping, res=(24, 6))
    roof.parent = o
    return o
