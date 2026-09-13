"""Low-poly diorama toolkit for the 高山圣城之战 (citadel battle) art-target replica.

All geometry is generated procedurally (no bmesh.ops, no primitive_* operators) so the
script is stable across Blender versions. Repeated props (soldiers, trees, lamps,
crates, shields) share mesh datablocks and are placed as linked object copies.
"""
import bpy, math, random
from mathutils import Vector, Matrix

TAU = math.pi * 2

# ---------------------------------------------------------------- palette ----
P = {
    "wall":        ((0.965, 0.960, 0.940), 0.62, 0.0),
    "wall_warm":   ((0.985, 0.945, 0.880), 0.62, 0.0),
    "wall_shade":  ((0.820, 0.850, 0.910), 0.70, 0.0),
    "trim":        ((0.920, 0.935, 0.960), 0.50, 0.0),
    "roof_blue":   ((0.085, 0.215, 0.790), 0.38, 0.12),
    "roof_deep":   ((0.045, 0.115, 0.500), 0.40, 0.08),
    "banner":      ((0.105, 0.255, 0.800), 0.62, 0.0),
    "banner_mark": ((0.350, 0.560, 0.950), 0.60, 0.0),
    "pave":        ((0.895, 0.900, 0.915), 0.72, 0.0),
    "ground":      ((0.430, 0.470, 0.570), 0.95, 0.0),
    "ground_dark": ((0.255, 0.295, 0.400), 0.95, 0.0),
    "ridge_1":     ((0.150, 0.215, 0.390), 1.00, 0.0),
    "ridge_2":     ((0.185, 0.265, 0.450), 1.00, 0.0),
    "ridge_3":     ((0.225, 0.320, 0.520), 1.00, 0.0),
    "ridge_4":     ((0.275, 0.380, 0.580), 1.00, 0.0),
    "pave_line":   ((0.720, 0.740, 0.790), 0.85, 0.0),
    "stone":       ((0.855, 0.865, 0.890), 0.78, 0.0),
    "rock_dark":   ((0.100, 0.140, 0.290), 0.92, 0.0),
    "rock_mid":    ((0.145, 0.200, 0.395), 0.88, 0.0),
    "rock_far":    ((0.185, 0.290, 0.520), 1.00, 0.0),
    "wood":        ((0.400, 0.255, 0.135), 0.74, 0.0),
    "wood_dark":   ((0.190, 0.115, 0.065), 0.85, 0.0),
    "wood_light":  ((0.560, 0.395, 0.220), 0.70, 0.0),
    "sail":        ((0.130, 0.300, 0.780), 0.72, 0.0),
    "rope":        ((0.620, 0.540, 0.420), 0.90, 0.0),
    "skin":        ((0.870, 0.660, 0.500), 0.85, 0.0),
    "armor_blue":  ((0.115, 0.270, 0.810), 0.48, 0.18),
    "armor_dark":  ((0.140, 0.160, 0.280), 0.60, 0.20),
    "plume_blue":  ((0.210, 0.460, 0.980), 0.62, 0.0),
    "plume_red":   ((0.720, 0.090, 0.090), 0.70, 0.0),
    "cloak_red":   ((0.640, 0.110, 0.110), 0.85, 0.0),
    "bronze":      ((0.700, 0.500, 0.200), 0.35, 0.85),
    "fox":         ((0.850, 0.400, 0.110), 0.85, 0.0),
    "tree_dark":   ((0.045, 0.150, 0.145), 0.90, 0.0),
    "tree_mid":    ((0.070, 0.210, 0.180), 0.88, 0.0),
    "foliage":     ((0.090, 0.270, 0.210), 0.85, 0.0),
    "marble":      ((0.975, 0.975, 0.965), 0.42, 0.0),
    "glass_dark":  ((0.050, 0.080, 0.160), 0.20, 0.30),
    "hull_metal":  ((0.800, 0.830, 0.880), 0.25, 0.70),
}
EMIT = {
    "win_warm":   ((1.000, 0.645, 0.270), 7.0),
    "win_gold":   ((1.000, 0.700, 0.340), 9.0),
    "win_pink":   ((1.000, 0.520, 0.560), 4.0),
    "win_cyan":   ((0.400, 0.900, 1.000), 4.0),
    "gate_glow":  ((1.000, 0.400, 0.120), 2.6),
    "lamp_glow":  ((1.000, 0.720, 0.350), 22.0),
    "torch":      ((1.000, 0.480, 0.140), 26.0),
    "far_city":   ((1.000, 0.800, 0.600), 3.4),
    "arrow":      ((1.000, 0.850, 0.550), 8.0),
    # graded gate tunnel: cool-to-hot ramp read from the target's arch
    "gate_r1":    ((1.000, 0.180, 0.040), 0.55),
    "gate_r2":    ((1.000, 0.255, 0.055), 1.00),
    "gate_r3":    ((1.000, 0.350, 0.085), 1.70),
    "gate_r4":    ((1.000, 0.470, 0.140), 2.60),
    "gate_r5":    ((1.000, 0.600, 0.215), 4.60),
    "gate_core":  ((1.000, 0.700, 0.340), 6.60),
    "gate_floor": ((1.000, 0.530, 0.180), 2.20),
    # water reflection streaks (flat cards lying on the water plane)
    "refl_hot":   ((1.000, 0.520, 0.155), 1.30),
    "refl_mid":   ((1.000, 0.400, 0.110), 0.80),
    "refl_dim":   ((1.000, 0.320, 0.085), 0.42),
    "refl_far":   ((1.000, 0.500, 0.300), 0.30),
    "refl_cool":  ((0.300, 0.520, 1.000), 0.22),
    "quay_lamp":  ((1.000, 0.620, 0.250), 3.20),
}
_MATS = {}


def _clear_to_output(nt):
    """Empty a node tree down to a single OUTPUT_MATERIAL node (name varies by build)."""
    out = None
    for n in list(nt.nodes):
        if n.type == 'OUTPUT_MATERIAL' and out is None:
            out = n
        else:
            nt.nodes.remove(n)
    if out is None:
        out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (320, 0)
    return out


def mat(key):
    if key in _MATS:
        return _MATS[key]
    m = bpy.data.materials.new("M_" + key)
    m.use_nodes = True
    nt = m.node_tree
    out = _clear_to_output(nt)
    if key in EMIT:
        col, stren = EMIT[key]
        e = nt.nodes.new("ShaderNodeEmission")
        e.inputs[0].default_value = (col[0], col[1], col[2], 1)
        e.inputs[1].default_value = stren
        nt.links.new(e.outputs[0], out.inputs[0])
    else:
        col, rough, metal = P[key]
        b = nt.nodes.new("ShaderNodeBsdfPrincipled")
        b.inputs["Base Color"].default_value = (col[0], col[1], col[2], 1)
        b.inputs["Roughness"].default_value = rough
        b.inputs["Metallic"].default_value = metal
        nt.links.new(b.outputs[0], out.inputs[0])
    _MATS[key] = m
    return m


def water_mat():
    if "water" in _MATS:
        return _MATS["water"]
    m = bpy.data.materials.new("M_water")
    m.use_nodes = True
    nt = m.node_tree
    out = _clear_to_output(nt)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (0.016, 0.062, 0.115, 1)
    b.inputs["Roughness"].default_value = 0.045
    b.inputs["Metallic"].default_value = 0.55
    try:
        b.inputs["IOR"].default_value = 1.33
    except KeyError:
        pass
    nt.links.new(b.outputs[0], out.inputs[0])
    _MATS["water"] = m
    return m


# ------------------------------------------------------------ collections ----
def coll(name, parent=None):
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        (parent or bpy.context.scene.collection).children.link(c)
    return c


# ------------------------------------------------------------- mesh build ----
def mesh(name, verts, faces):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.validate()
    me.update()
    for p in me.polygons:
        p.use_smooth = False
    return me


def obj(name, me, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), m=None, c=None):
    o = bpy.data.objects.new(name, me)
    o.location = loc
    o.rotation_euler = rot
    o.scale = scale
    (c or bpy.context.scene.collection).objects.link(o)
    if m is not None:
        if len(me.materials) == 0:
            me.materials.append(m)
        else:
            o.material_slots[0].link = 'OBJECT'
            o.material = m
    return o


def clone(src, name, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), c=None):
    """Linked copy: shares mesh data, so hundreds of props stay cheap."""
    o = src.copy()
    o.name = name
    o.location = loc
    o.rotation_euler = rot
    o.scale = scale
    (c or bpy.context.scene.collection).objects.link(o)
    return o


# --------------------------------------------------------------- geometry ----
def box_data(sx, sy, sz, ox=0.0, oy=0.0, oz=0.0, taper=1.0):
    """Axis-aligned box, centred in x/y, sitting from oz upward is caller's job."""
    hx, hy, hz = sx / 2.0, sy / 2.0, sz / 2.0
    tx, ty = hx * taper, hy * taper
    v = [(-hx + ox, -hy + oy, -hz + oz), (hx + ox, -hy + oy, -hz + oz),
         (hx + ox, hy + oy, -hz + oz), (-hx + ox, hy + oy, -hz + oz),
         (-tx + ox, -ty + oy, hz + oz), (tx + ox, -ty + oy, hz + oz),
         (tx + ox, ty + oy, hz + oz), (-tx + ox, ty + oy, hz + oz)]
    f = [(0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    return v, f


def append(store, vf, off=(0, 0, 0)):
    """Accumulate (verts, faces) into a (verts, faces) store with an offset."""
    v, f = vf
    n = len(store[0])
    ox, oy, oz = off
    store[0].extend([(x + ox, y + oy, z + oz) for (x, y, z) in v])
    store[1].extend([tuple(i + n for i in face) for face in f])
    return store


def cyl_data(r_bot, r_top, h, seg=12, oz=0.0, cap=True, phase=0.0):
    v, f = [], []
    for i in range(seg):
        a = phase + TAU * i / seg
        v.append((math.cos(a) * r_bot, math.sin(a) * r_bot, oz))
    for i in range(seg):
        a = phase + TAU * i / seg
        v.append((math.cos(a) * r_top, math.sin(a) * r_top, oz + h))
    for i in range(seg):
        j = (i + 1) % seg
        f.append((i, j, seg + j, seg + i))
    if cap:
        if r_bot > 1e-5:
            f.append(tuple(range(seg))[::-1])
        if r_top > 1e-5:
            f.append(tuple(range(seg, seg * 2)))
    return v, f


def cone_data(r, h, seg=10, oz=0.0):
    v = [(math.cos(TAU * i / seg) * r, math.sin(TAU * i / seg) * r, oz) for i in range(seg)]
    v.append((0, 0, oz + h))
    f = [(i, (i + 1) % seg, seg) for i in range(seg)]
    f.append(tuple(range(seg))[::-1])
    return v, f


def dome_data(r, h, seg=12, rings=4, oz=0.0):
    v, f = [], []
    for k in range(rings):
        t = k / float(rings)
        rr = r * math.cos(t * math.pi / 2.0)
        zz = oz + h * math.sin(t * math.pi / 2.0)
        for i in range(seg):
            a = TAU * i / seg
            v.append((math.cos(a) * rr, math.sin(a) * rr, zz))
    top = len(v)
    v.append((0, 0, oz + h))
    for k in range(rings - 1):
        for i in range(seg):
            j = (i + 1) % seg
            a, b = k * seg + i, k * seg + j
            c, d = (k + 1) * seg + j, (k + 1) * seg + i
            f.append((a, b, c, d))
    for i in range(seg):
        f.append(((rings - 1) * seg + i, (rings - 1) * seg + (i + 1) % seg, top))
    f.append(tuple(range(seg))[::-1])
    return v, f


def prism_data(pts, h, oz=0.0):
    """Extrude a closed 2-D polygon (list of (x,y)) upward by h."""
    n = len(pts)
    v = [(x, y, oz) for (x, y) in pts] + [(x, y, oz + h) for (x, y) in pts]
    f = [tuple(range(n))[::-1], tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        f.append((i, j, n + j, n + i))
    return v, f


def ring_data(r_in, r_out, h, seg=48, oz=0.0):
    v, f = [], []
    for i in range(seg):
        a = TAU * i / seg
        ca, sa = math.cos(a), math.sin(a)
        v += [(ca * r_in, sa * r_in, oz), (ca * r_out, sa * r_out, oz),
              (ca * r_in, sa * r_in, oz + h), (ca * r_out, sa * r_out, oz + h)]
    for i in range(seg):
        a, b = i * 4, ((i + 1) % seg) * 4
        f += [(a + 2, a + 3, b + 3, b + 2), (a, b, b + 1, a + 1),
              (a + 1, b + 1, b + 3, a + 3), (a, a + 2, b + 2, b)]
    return v, f


def arch_profile(w, h, seg=12):
    """Outline of an arched opening: up the left jamb, over the semicircle, down."""
    r = w / 2.0
    straight = max(0.0, h - r)
    pts = [(-r, 0.0), (-r, straight)]
    for i in range(seg + 1):
        a = math.pi * (1.0 - i / float(seg))
        pts.append((math.cos(a) * r, straight + math.sin(a) * r))
    pts.append((r, 0.0))
    return pts


def arch_band_data(w_out, h_out, w_in, h_in, depth, seg=12, oz=0.0):
    """The solid band between two arch outlines — a frame you can see through."""
    O = arch_profile(w_out, h_out, seg)
    I = arch_profile(w_in, h_in, seg)
    n = len(O)
    hd = depth / 2.0
    v = ([(x, -hd, oz + z) for (x, z) in O] + [(x, -hd, oz + z) for (x, z) in I] +
         [(x, hd, oz + z) for (x, z) in O] + [(x, hd, oz + z) for (x, z) in I])
    f = []
    for i in range(n - 1):
        a, b = i, i + 1
        ai, bi = n + i, n + i + 1
        f.append((a, b, bi, ai))                                   # front band
        f.append((2 * n + ai, 2 * n + bi, 2 * n + b, 2 * n + a))   # back band
        f.append((a, 2 * n + a, 2 * n + b, b))                     # outer wall
        f.append((bi, 2 * n + bi, 2 * n + ai, ai))                 # inner wall
    f.append((0, n, 2 * n + n, 2 * n))                             # bottom caps
    f.append((2 * n + n - 1, 2 * n + 2 * n - 1, 2 * n - 1, n - 1))
    return v, f


def arch_data(w, h, d, thick=0.0, seg=10, oz=0.0):
    """A rounded-top arch opening profile extruded in y — returns the SOLID arch shape."""
    r = w / 2.0
    pts = [(-r, 0.0), (r, 0.0)]
    straight = max(0.0, h - r)
    pts = [(-r, 0.0), (-r, straight)]
    for i in range(seg + 1):
        a = math.pi * (1.0 - i / float(seg))
        pts.append((math.cos(a) * r, straight + math.sin(a) * r))
    pts.append((r, 0.0))
    v = [(x, -d / 2.0, oz + z) for (x, z) in pts] + [(x, d / 2.0, oz + z) for (x, z) in pts]
    n = len(pts)
    f = [tuple(range(n)), tuple(range(n, 2 * n))[::-1]]
    for i in range(n):
        j = (i + 1) % n
        f.append((i, n + i, n + j, j))
    return v, f


def tube_pts(pts, r=0.04, seg=5):
    """Tube through a polyline (list of Vector/tuple)."""
    P3 = [Vector(p) for p in pts]
    v, f = [], []
    for k, p in enumerate(P3):
        if k == 0:
            d = (P3[1] - P3[0])
        elif k == len(P3) - 1:
            d = (P3[-1] - P3[-2])
        else:
            d = (P3[k + 1] - P3[k - 1])
        d.normalize()
        up = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
        a1 = d.cross(up).normalized()
        a2 = d.cross(a1).normalized()
        for i in range(seg):
            ang = TAU * i / seg
            v.append(tuple(p + a1 * (math.cos(ang) * r) + a2 * (math.sin(ang) * r)))
    for k in range(len(P3) - 1):
        for i in range(seg):
            j = (i + 1) % seg
            a, b = k * seg + i, k * seg + j
            f.append((a, b, (k + 1) * seg + j, (k + 1) * seg + i))
    return v, f


# --------------------------------------------------------------- part sets ----
class Parts(object):
    """Accumulates (verts, faces) per material key, then bakes one object per key."""

    def __init__(self, name):
        self.name = name
        self.buf = {}

    def add(self, key, vf, off=(0, 0, 0)):
        self.buf.setdefault(key, ([], []))
        append(self.buf[key], vf, off)
        return self

    def box(self, key, size, at=(0, 0, 0), taper=1.0):
        return self.add(key, box_data(size[0], size[1], size[2], taper=taper), at)

    def cyl(self, key, r_bot, r_top, h, at=(0, 0, 0), seg=12, phase=0.0):
        return self.add(key, cyl_data(r_bot, r_top, h, seg, phase=phase), at)

    def cone(self, key, r, h, at=(0, 0, 0), seg=10):
        return self.add(key, cone_data(r, h, seg), at)

    def dome(self, key, r, h, at=(0, 0, 0), seg=12, rings=4):
        return self.add(key, dome_data(r, h, seg, rings), at)

    def tube(self, key, pts, r=0.04, seg=5):
        return self.add(key, tube_pts(pts, r, seg))

    def bake(self, c=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), parent=None):
        out = []
        for key, (v, f) in self.buf.items():
            if not v:
                continue
            o = obj("%s_%s" % (self.name, key), mesh("%s_%s" % (self.name, key), v, f),
                    loc=loc, rot=rot, scale=scale, m=mat(key), c=c)
            if parent is not None:
                o.parent = parent
            out.append(o)
        return out

    def bake_single(self, c=None, loc=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1)):
        """One object carrying several material slots — used for instanced props."""
        verts, faces, slots, poly_mat = [], [], [], []
        for key, (v, f) in self.buf.items():
            if not v:
                continue
            n = len(verts)
            verts.extend(v)
            faces.extend([tuple(i + n for i in face) for face in f])
            slots.append(key)
            poly_mat.extend([len(slots) - 1] * len(f))
        me = mesh(self.name, verts, faces)
        for key in slots:
            me.materials.append(mat(key))
        for i, p in enumerate(me.polygons):
            p.material_index = poly_mat[i]
        return obj(self.name, me, loc=loc, rot=rot, scale=scale, c=c)


def rot_pts(vf, rz=0.0, ry=0.0, rx=0.0):
    M = Matrix.Rotation(rz, 3, 'Z') @ Matrix.Rotation(ry, 3, 'Y') @ Matrix.Rotation(rx, 3, 'X')
    v, f = vf
    return [tuple(M @ Vector(p)) for p in v], f
