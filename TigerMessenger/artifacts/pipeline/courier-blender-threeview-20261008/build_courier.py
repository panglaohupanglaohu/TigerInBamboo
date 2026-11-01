"""Procedural Blender build of the TigerMessenger courier from the 3-view sheet.
Z-up, character faces -Y, character's right = -X. Height ~1.76 m.
Run:  python3 build_courier.py [outdir]
  or: Blender --background --python build_courier.py -- [outdir]
"""
import bpy, bmesh, math, random, sys, os
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
OUT = os.path.abspath(ARGS[0]) if ARGS else os.path.dirname(os.path.abspath(__file__))
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- materials
PAL = {
    'skin': '#d6a07a', 'hair': '#2b221d', 'cream': '#ece2cb', 'cream_dk': '#d8ccb2',
    'blue': '#4f7c8c', 'pants': '#5d8090', 'cuff': '#bdb9b0', 'shirt': '#9ea6a8',
    'collar': '#df7a5c', 'leather': '#7c4b2c', 'leather_dk': '#55331f', 'brass': '#c99b42',
    'boot': '#6c4531', 'sole': '#35271e', 'glove': '#4a3429', 'glass': '#7fb0b3',
    'watch': '#3f7f86', 'paper': '#f3eee2', 'eye': '#1d1714', 'mouth': '#9a4a3c',
}

def hex2lin(h):
    h = h.lstrip('#'); c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return [((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c] + [1]

MATS = {}
for k, v in PAL.items():
    m = bpy.data.materials.new('courier_' + k)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hex2lin(v)
    b.inputs['Roughness'].default_value = 0.85 if k not in ('brass', 'glass') else 0.35
    if k == 'brass':
        b.inputs['Metallic'].default_value = 0.6
    m.diffuse_color = hex2lin(v)
    MATS[k] = m

ROOT = bpy.data.objects.new('Courier', None)
scene.collection.objects.link(ROOT)
PARTS = []

def finish(obj, mat, name, smooth=True):
    obj.name = name
    obj.data.materials.clear(); obj.data.materials.append(MATS[mat])
    if smooth:
        for p in obj.data.polygons: p.use_smooth = True
    obj.parent = ROOT
    PARTS.append(obj)
    return obj

def apply(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)

def ell(name, mat, c, s, seg=24, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=seg // 2, radius=1, location=c, rotation=rot)
    o = bpy.context.object; o.scale = s; apply(o)
    return finish(o, mat, name)

def ico(name, mat, c, r, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=c)
    return finish(bpy.context.object, mat, name)

def box(name, mat, c, d, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c, rotation=rot)
    o = bpy.context.object; o.scale = d; apply(o)
    if bevel:
        mod = o.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 2
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='bev')
    return finish(o, mat, name, smooth=False)

def seg(name, mat, p1, p2, r1, r2, sx=1.0, sy=1.0, verts=20, cap=True):
    """Tapered limb from p1 (radius r1) to p2 (radius r2); elliptical by sx/sy in local frame."""
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1; L = d.length
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=L,
                                    end_fill_type='NGON' if cap else 'NOTHING')
    o = bpy.context.object
    o.scale = (sx, sy, 1); apply(o)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = q
    o.location = (p1 + p2) / 2
    apply(o)
    return finish(o, mat, name)

def _chaikin(pts, it=2):
    for _ in range(it):
        out = [pts[0]]
        for i in range(len(pts) - 1):
            p, q = pts[i], pts[i + 1]
            out += [p.lerp(q, 0.25), p.lerp(q, 0.75)]
        out.append(pts[-1]); pts = out
    return pts

def strap(name, mat, pts, w=0.04, t=0.012, smooth=True):
    """Continuous flat ribbon (solidified) through a polyline, lying tangent to the body surface."""
    P = [Vector(p) for p in pts]
    if smooth: P = _chaikin(P)
    bm = bmesh.new(); rows = []
    for i, p in enumerate(P):
        tan = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        c = Vector((0, 0, min(p.z, 1.25)))
        n = (p - c); n.normalize()
        wv = n.cross(tan).normalized(); n = tan.cross(wv).normalized()
        rows.append([bm.verts.new(p + wv * w / 2 + n * t / 2), bm.verts.new(p - wv * w / 2 + n * t / 2),
                     bm.verts.new(p - wv * w / 2 - n * t / 2), bm.verts.new(p + wv * w / 2 - n * t / 2)])
    for i in range(len(rows) - 1):
        A, B = rows[i], rows[i + 1]
        for k in range(4):
            bm.faces.new((A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]))
    bm.faces.new(rows[0][::-1]); bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o)
    return finish(o, mat, name, smooth=False)

def prism(name, mat, poly_xz, y, t):
    """Flat plate facing -Y from a 2D polygon in the XZ plane."""
    bm = bmesh.new()
    f = [bm.verts.new((x, y - t / 2, z)) for x, z in poly_xz]
    b = [bm.verts.new((x, y + t / 2, z)) for x, z in poly_xz]
    bm.faces.new(f); bm.faces.new(b[::-1])
    for i in range(len(f)):
        j = (i + 1) % len(f); bm.faces.new((f[i], b[i], b[j], f[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o)
    return finish(o, mat, name, smooth=False)

def ring(name, mat, c, R, r, rot=(0, 0, 0), sx=1, sy=1):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=32, minor_segments=8,
                                     location=c, rotation=rot)
    o = bpy.context.object; o.scale = (sx, sy, 1); apply(o)
    return finish(o, mat, name)

# ---------------------------------------------------------------- legs & boots
for side, sx in (('R', -1), ('L', 1)):
    fx = 0.118 * sx
    # boots
    seg(f'boot_shaft_{side}', 'boot', (fx, 0.0, 0.04), (fx, 0.0, 0.215), 0.068, 0.072)
    ell(f'boot_toe_{side}', 'boot', (fx, -0.065, 0.055), (0.066, 0.115, 0.056))
    box(f'boot_sole_{side}', 'sole', (fx, -0.04, 0.014), (0.142, 0.27, 0.028), bevel=0.01)
    box(f'boot_heel_{side}', 'sole', (fx, 0.055, 0.035), (0.12, 0.07, 0.04), bevel=0.006)
    ring(f'boot_strap_{side}', 'leather_dk', (fx, 0, 0.17), 0.073, 0.009)
    ring(f'boot_strap2_{side}', 'leather_dk', (fx, -0.03, 0.08), 0.062, 0.008, rot=(math.radians(-25), 0, 0), sy=1.25)
    ico(f'boot_buckle_{side}', 'brass', (fx + 0.06 * sx, 0.0, 0.17), 0.012, 1)
    # rolled trouser cuff
    seg(f'pant_cuff_{side}', 'cuff', (fx, 0, 0.19), (fx, 0, 0.255), 0.088, 0.09)
    # trousers (slightly baggy, taper to knee)
    knee = (0.108 * sx, -0.008, 0.5)
    hip = (0.092 * sx, 0.0, 0.88)
    seg(f'shin_{side}', 'pants', (fx, 0, 0.25), knee, 0.083, 0.087)
    ell(f'knee_{side}', 'pants', knee, (0.085, 0.085, 0.04))
    seg(f'thigh_{side}', 'pants', knee, hip, 0.087, 0.112, sy=0.95)
    # cargo pocket outer thigh + crease seam
    box(f'cargo_pocket_{side}', 'pants', (0.193 * sx, 0.0, 0.62), (0.022, 0.11, 0.14), bevel=0.008)
    box(f'cargo_flap_{side}', 'leather_dk' if False else 'pants', (0.2 * sx, 0.0, 0.685), (0.024, 0.115, 0.03), bevel=0.006)

ell('pelvis', 'pants', (0, 0.005, 0.9), (0.18, 0.12, 0.1))

# right-thigh holster straps and pouch (character right = -X)
ring('thigh_strap_hi', 'leather', (-0.1, 0, 0.74), 0.112, 0.01)
ring('thigh_strap_lo', 'leather', (-0.105, 0, 0.62), 0.104, 0.01)
box('thigh_pouch', 'leather', (-0.16, -0.075, 0.71), (0.075, 0.04, 0.12), rot=(0, 0, math.radians(-30)), bevel=0.01)
box('thigh_pouch_flap', 'leather_dk', (-0.163, -0.094, 0.75), (0.08, 0.012, 0.05), rot=(0, 0, math.radians(-30)))
ico('thigh_pouch_rivet', 'brass', (-0.165, -0.102, 0.745), 0.009, 1)
strap('holster_drop', 'leather', [(-0.16, -0.06, 0.95), (-0.17, -0.09, 0.82), (-0.16, -0.095, 0.77)], w=0.025, t=0.01)

# ---------------------------------------------------------------- belt & hip
seg('belt', 'leather', (0, 0.0, 0.925), (0, 0.0, 0.985), 0.19, 0.188, sy=0.69)
box('belt_buckle', 'brass', (0, -0.133, 0.955), (0.055, 0.012, 0.045), bevel=0.004)
box('belt_buckle_in', 'leather', (0, -0.139, 0.955), (0.03, 0.006, 0.024))
box('hip_pouch_R', 'leather', (-0.185, -0.035, 0.905), (0.05, 0.06, 0.075), bevel=0.008)
box('hip_pouch_R_flap', 'leather_dk', (-0.188, -0.04, 0.93), (0.054, 0.066, 0.03))

# ---------------------------------------------------------------- torso (shirt + cropped jacket)
seg('waist_shirt', 'shirt', (0, 0, 0.97), (0, 0, 1.05), 0.16, 0.165, sy=0.7)
seg('jacket_body', 'cream', (0, 0.0, 1.03), (0, 0.0, 1.36), 0.172, 0.205, sy=0.64)
ell('jacket_chest', 'cream', (0, 0.0, 1.36), (0.212, 0.132, 0.085))
seg('jacket_hem', 'cream_dk', (0, 0.0, 1.02), (0, 0.0, 1.05), 0.176, 0.174, sy=0.66)
# collar lining peek at hem (orange)
# blue shoulder yoke wrapping back & shoulders
def cut_front(o, y0):
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < y0], context='VERTS')
    bm.to_mesh(o.data); bm.free()
cut_front(seg('yoke_back', 'blue', (0, 0.012, 1.29), (0, 0.012, 1.40), 0.207, 0.213, sy=0.645), -0.02)
cut_front(ell('yoke_top', 'blue', (0, 0.01, 1.385), (0.2, 0.134, 0.065)), -0.035)
# cream front panel over yoke (front is cream with blue only at shoulder tips)
# open neckline: grey shirt V + necklace
prism('shirt_v', 'shirt', [(-0.055, 1.455), (0.055, 1.455), (0, 1.325)], -0.142, 0.008)
prism('chest_skin', 'skin', [(-0.03, 1.457), (0.03, 1.457), (0, 1.39)], -0.147, 0.006)
for sx in (-1, 1):
    prism(f'lapel_lining_{sx}', 'collar', [(0.055 * sx, 1.455), (0.072 * sx, 1.455), (0.006 * sx, 1.312), (0.0, 1.325)], -0.145, 0.008)
    # chest pocket flaps & buttons
    ico(f'chest_btn_{sx}', 'brass', (0.11 * sx, -0.142, 1.30), 0.009, 1)
    for i, z in enumerate((1.09, 1.16, 1.23)):
        ico(f'btn_{sx}_{i}', 'brass', (0.075 * sx, -0.137, z), 0.0095, 1)
ring('necklace', 'leather_dk', (0, -0.04, 1.43), 0.06, 0.003, rot=(math.radians(-35), 0, 0))
# standing collar: open-front ring, cream outside / coral inside, coral lapel tips folded out
def open_ring(name, mat, r1, r2, z0, z1, gap_y):
    bpy.ops.mesh.primitive_cone_add(vertices=32, radius1=r1, radius2=r2, depth=z1 - z0, end_fill_type='NOTHING',
                                    location=(0, 0.005, (z0 + z1) / 2))
    o = bpy.context.object
    o.scale = (1, 1.12, 1); apply(o)
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < gap_y], context='VERTS')
    bm.to_mesh(o.data); bm.free()
    mod = o.modifiers.new('sol', 'SOLIDIFY'); mod.thickness = 0.008
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='sol')
    return finish(o, mat, name)
open_ring('collar_outer', 'cream', 0.078, 0.07, 1.42, 1.525, -0.055)
open_ring('collar_inner', 'collar', 0.069, 0.061, 1.425, 1.52, -0.05)
for sx in (-1, 1):
    box(f'collar_tip_{sx}', 'collar', (0.062 * sx, -0.093, 1.445), (0.05, 0.01, 0.075),
        rot=(math.radians(-15), math.radians(-18 * sx), math.radians(32 * sx)))
# back wing emblem (gold)
for k in range(3):
    for sx in (-1, 1):
        box(f'emblem_wing_{sx}_{k}', 'brass', (sx * (0.035 + k * 0.004), 0.143, 1.37 - k * 0.012), (0.055 - k * 0.012, 0.006, 0.008),
            rot=(0, math.radians(-14 * sx), 0))
ico('emblem_core', 'brass', (0, 0.146, 1.36), 0.016, 1)

# ---------------------------------------------------------------- arms
for side, sx in (('R', -1), ('L', 1)):
    sh = (0.205 * sx, 0.0, 1.37)
    el = (0.262 * sx, 0.01, 1.12)
    wr = (0.28 * sx, -0.005, 0.875)
    ell(f'shoulder_{side}', 'blue', sh, (0.064, 0.07, 0.06))
    seg(f'sleeve_blue_{side}', 'blue', sh, (0.235 * sx, 0.004, 1.27), 0.064, 0.062)
    ico(f'sleeve_emblem_{side}', 'brass', (0.29 * sx, 0.004, 1.31), 0.013, 1)
    seg(f'sleeve_{side}', 'cream', (0.235 * sx, 0.004, 1.27), el, 0.062, 0.058)
    seg(f'sleeve_roll_{side}', 'cream_dk', (0.258 * sx, 0.008, 1.15), (0.265 * sx, 0.008, 1.085), 0.072, 0.07)
    seg(f'forearm_{side}', 'skin', (0.264 * sx, 0.008, 1.09), wr, 0.047, 0.036)
    seg(f'wrist_band_{side}', 'watch' if side == 'L' else 'leather_dk', (0.279 * sx, -0.004, 0.895), (0.281 * sx, -0.005, 0.865), 0.041, 0.041)
    # fingerless glove + fingers
    hc = Vector((0.285 * sx, -0.012, 0.81))
    ell(f'glove_{side}', 'glove', hc, (0.032, 0.05, 0.062))
    seg(f'glove_cuff_{side}', 'glove', (0.282 * sx, -0.008, 0.865), (0.284 * sx, -0.01, 0.835), 0.04, 0.036)
    for i in range(4):
        fy = -0.04 + i * 0.026
        seg(f'finger_{side}_{i}', 'skin', (0.29 * sx, fy, 0.765), (0.292 * sx, fy - 0.004, 0.725 + abs(i - 1.5) * 0.008), 0.011, 0.009)
    seg(f'thumb_{side}', 'skin', (0.275 * sx, -0.05, 0.81), (0.268 * sx, -0.07, 0.775), 0.012, 0.01)

# ---------------------------------------------------------------- neck & head
seg('neck', 'skin', (0, 0.005, 1.40), (0, 0.0, 1.56), 0.046, 0.044)
HEAD = Vector((0, -0.005, 1.645))
ell('head', 'skin', HEAD, (0.094, 0.104, 0.118))
ell('jaw', 'skin', (0, -0.03, 1.588), (0.072, 0.078, 0.058))
for sx in (-1, 1):
    ell(f'ear_{sx}', 'skin', (0.094 * sx, 0.012, 1.635), (0.016, 0.026, 0.031))
    ell(f'eye_{sx}', 'eye', (0.036 * sx, -0.094, 1.652), (0.013, 0.008, 0.019))
    ico(f'eye_hi_{sx}', 'paper', (0.036 * sx + 0.004, -0.1015, 1.659), 0.0042, 1)
    box(f'brow_{sx}', 'hair', (0.038 * sx, -0.099, 1.688), (0.03, 0.006, 0.007), rot=(0, math.radians(5 * sx), 0))
ell('nose', 'skin', (0, -0.104, 1.622), (0.008, 0.01, 0.014))
bpy.ops.mesh.primitive_torus_add(major_radius=0.02, minor_radius=0.0028, major_segments=24, minor_segments=6,
                                 location=(0, -0.105, 1.604), rotation=(math.radians(90), 0, 0))
_m = bpy.context.object
_bm = bmesh.new(); _bm.from_mesh(_m.data)
bmesh.ops.delete(_bm, geom=[v for v in _bm.verts if v.co.y > -0.009], context='VERTS')
_bm.to_mesh(_m.data); _bm.free()
_m.scale = (1, 1, 0.8)
finish(_m, 'mouth', 'mouth_smile')

# hair: dark scalp cap + curls (keep face open)
ell('hair_cap', 'hair', (0, 0.02, 1.68), (0.098, 0.106, 0.098))
ell('hair_back', 'hair', (0, 0.05, 1.625), (0.093, 0.075, 0.085))
n = 0
for i in range(400):
    u = random.uniform(-1, 1); th = random.uniform(0, 2 * math.pi)
    v = Vector((math.sqrt(1 - u * u) * math.cos(th), math.sqrt(1 - u * u) * math.sin(th), u))
    if v.z < -0.15 and v.y < 0.3: continue
    if v.z < -0.5: continue
    if v.y < -0.35 and v.z < 0.55: continue           # face window
    if abs(v.x) > 0.8 and v.z < 0.25 and v.y < 0.2: continue  # ears
    p = Vector((0, 0.02, 1.68)) + Vector((v.x * 0.108, v.y * 0.115, v.z * 0.11))
    ico(f'curl_{n}', 'hair', p, random.uniform(0.024, 0.04), 2); n += 1
    if n >= 95: break
for i, x in enumerate((-0.06, -0.025, 0.012, 0.05)):          # fringe curls over forehead
    ico(f'fringe_{i}', 'hair', (x, -0.088, 1.735 - abs(x) * 0.3), 0.024, 1)
for i, x in enumerate((-0.075, 0.075)):                     # side tufts
    ico(f'sideburn_{i}', 'hair', (x, -0.045, 1.69), 0.024, 1)

# goggles pushed up on the hair
ring('goggle_strap', 'leather_dk', (0, 0.01, 1.715), 0.118, 0.011, rot=(math.radians(-22), 0, 0), sy=1.07)
for sx in (-1, 1):
    c = Vector((0.047 * sx, -0.075, 1.775))
    seg(f'goggle_rim_{sx}', 'brass', c - Vector((0, 0.008, -0.012)), c + Vector((0, -0.018, 0.026)), 0.03, 0.028)
    seg(f'goggle_lens_{sx}', 'glass', c + Vector((0, -0.017, 0.025)), c + Vector((0, -0.021, 0.03)), 0.023, 0.023)
box('goggle_bridge', 'brass', (0, -0.085, 1.79), (0.025, 0.012, 0.01))

# ---------------------------------------------------------------- crossbody strap + satchel (bag on char-left hip)
FRONT = [(-0.14, 0.03, 1.455), (-0.13, -0.1, 1.39), (-0.06, -0.142, 1.3), (0.08, -0.127, 1.12), (0.19, -0.095, 0.98), (0.235, -0.06, 0.935)]
BACK = [(-0.14, 0.03, 1.455), (-0.12, 0.123, 1.38), (-0.05, 0.146, 1.3), (0.08, 0.126, 1.12), (0.2, 0.08, 0.98), (0.235, 0.03, 0.935)]
strap('bag_strap_front', 'leather', FRONT, w=0.042)
strap('bag_strap_back', 'leather', BACK, w=0.042)
_a, _b = Vector(FRONT[1]), Vector(FRONT[2])
_n = lambda t: tuple(_a.lerp(_b, t) + Vector((0, -0.004, 0)))
strap('strap_buckle', 'brass', [_n(0.45), _n(0.7)], w=0.052, t=0.02, smooth=False)
strap('strap_buckle_in', 'leather', [_n(0.5), _n(0.65)], w=0.03, t=0.024, smooth=False)
BAG = Vector((0.25, -0.01, 0.85))
box('bag', 'leather', BAG, (0.2, 0.075, 0.165), bevel=0.014)
box('bag_flap', 'leather_dk', BAG + Vector((0, -0.04, 0.035)), (0.205, 0.012, 0.1), bevel=0.005)
box('bag_clasp', 'brass', BAG + Vector((0, -0.049, -0.012)), (0.026, 0.008, 0.03))
box('bag_badge', 'brass', BAG + Vector((0.0, -0.048, 0.05)), (0.034, 0.006, 0.022))
for i, (dx, h) in enumerate(((-0.03, 0.035), (0.015, 0.045), (0.045, 0.03))):
    box(f'letter_{i}', 'paper', BAG + Vector((dx * 1.2, 0.005 + i * 0.008, 0.08 + h / 2 - 0.01)), (0.08, 0.006, h))
T = BAG + Vector((0.03, 0.062, 0))
seg('brass_tube', 'brass', T + Vector((0, 0, -0.1)), T + Vector((0, 0, 0.11)), 0.026, 0.026)
seg('brass_tube_cap', 'leather_dk', T + Vector((0, 0, 0.11)), T + Vector((0, 0, 0.13)), 0.028, 0.028)
seg('brass_tube_end', 'leather_dk', T + Vector((0, 0, -0.12)), T + Vector((0, 0, -0.1)), 0.028, 0.028)
ring('tube_band', 'leather_dk', T, 0.028, 0.005)

# ---------------------------------------------------------------- stats & export
tris = sum(len(o.data.loop_triangles) if o.data.calc_loop_triangles() is None else 0 for o in PARTS)
print('parts', len(PARTS), 'triangles', tris)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'courier-threeview.blend'))
bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'courier-threeview.glb'), export_format='GLB')
