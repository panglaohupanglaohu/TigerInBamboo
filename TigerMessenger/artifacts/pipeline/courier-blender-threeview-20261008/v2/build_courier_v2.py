"""TigerMessenger courier v2 — Blender build from the 3-view sheet, rigged with the game's joint names.

Blender: Z-up, character faces -Y, character's left = +X.  glTF export -> three.js Y-up facing +Z.
Joint empties use the exact names that src/assets/characters/humanCourier.js animates:
  body, head, legL, legR, kneeL, kneeR, armL, armR, elbowL, elbowR, handL, handR, letter
Every joint has identity rest rotation, so the game's `joint.rotation.set(x, y, z)` calls work as-is.

Run:  python3 build_courier_v2.py -- OUTDIR
  or: Blender --background --python build_courier_v2.py -- OUTDIR
"""
import bpy, bmesh, math, random, sys, os, json
from mathutils import Vector, Matrix, Euler
from mathutils.bvhtree import BVHTree

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
OUT = os.path.abspath(ARGS[0]) if ARGS else os.path.dirname(os.path.abspath(__file__))
os.makedirs(OUT, exist_ok=True)
random.seed(11)
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ------------------------------------------------------------------ palette
PAL = {
    'skin': '#d9a37c', 'hair': '#2a211c', 'cream': '#ece2cb', 'cream_dk': '#d6c9ad',
    'blue': '#4f7c8c', 'pants': '#5b7f90', 'cuff': '#bdb9b0', 'shirt': '#a2aaac',
    'coral': '#df7a5c', 'leather': '#7c4b2c', 'leather_dk': '#55331f', 'brass': '#c99b42',
    'boot': '#6c4531', 'sole': '#35271e', 'glove': '#4a3429', 'glass': '#86b6b8',
    'watch': '#3f7f86', 'paper': '#f3eee2', 'eye': '#1d1714', 'mouth': '#97493b', 'blush': '#e09a86',
}
def hex2lin(h):
    h = h.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c] + [1]
MATS = {}
for k, v in PAL.items():
    m = bpy.data.materials.new('courier_' + k); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = hex2lin(v)
    b.inputs['Roughness'].default_value = 0.35 if k in ('brass', 'glass') else 0.85
    if k == 'brass': b.inputs['Metallic'].default_value = 0.6
    m.diffuse_color = hex2lin(v); MATS[k] = m

# ------------------------------------------------------------------ landmarks (metres, Blender coords)
HIP_Z = 0.97          # body + leg joints (game: body & legs share the hip height)
KNEE_Z = 0.545
SH = Vector((0.172, 0.0, 1.445))     # left shoulder joint
EL = Vector((0.198, 0.012, 1.175))   # left elbow
WR = Vector((0.214, 0.0, 0.93))      # left wrist
NECK_Z = 1.505
HEAD_C = Vector((0, -0.004, 1.672))
HEAD_R = Vector((0.079, 0.092, 0.108))

# ------------------------------------------------------------------ joints
ROOT = bpy.data.objects.new('Courier', None); scene.collection.objects.link(ROOT)
JW = {}   # world positions
JOINT = {}
def joint(name, parent, world):
    e = bpy.data.objects.new(name, None); scene.collection.objects.link(e)
    e.empty_display_type = 'SPHERE'; e.empty_display_size = 0.025
    pw = JW[parent.name] if parent is not ROOT else Vector((0, 0, 0))
    e.parent = parent; e.location = Vector(world) - pw
    JW[name] = Vector(world); JOINT[name] = e
    return e
body = joint('body', ROOT, (0, 0, HIP_Z))
head = joint('head', body, (0, 0, NECK_Z))
for s, side in ((1, 'L'), (-1, 'R')):
    joint('leg' + side, ROOT, (0.082 * s, 0, HIP_Z))
    joint('knee' + side, JOINT['leg' + side], (0.086 * s, -0.004, KNEE_Z))
    joint('arm' + side, body, (SH.x * s, SH.y, SH.z))
    joint('elbow' + side, JOINT['arm' + side], (EL.x * s, EL.y, EL.z))
    joint('hand' + side, JOINT['elbow' + side], (WR.x * s, WR.y, WR.z))
joint('letter', JOINT['handR'], (-0.222, -0.05, 0.83))

PARTS = []   # (obj, joint_name)
def finish(o, mat, jname, smooth=True):
    if isinstance(mat, str):
        o.data.materials.clear(); o.data.materials.append(MATS[mat])
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
    PARTS.append((o, jname)); o['joint'] = jname
    return o

def bake(o):
    """apply object transform into mesh data (object becomes identity at origin)"""
    o.data.transform(o.matrix_basis); o.matrix_basis = Matrix.Identity(4)

def mesh_obj(name, bm):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me); scene.collection.objects.link(o); return o

def ell(name, mat, j, c, s, seg=20, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, radius=1, location=c)
    o = bpy.context.object; o.name = name; o.scale = s; bake(o)
    return finish(o, mat, j)

def box(name, mat, j, c, d, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = d
    if bevel:
        mod = o.modifiers.new('bev', 'BEVEL'); mod.width = bevel; mod.segments = 2
        bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='bev')
    bake(o)
    return finish(o, mat, j, smooth=False)

def seg(name, mat, j, p1, p2, r1, r2, sx=1.0, sy=1.0, verts=18):
    p1, p2 = Vector(p1), Vector(p2); d = p2 - p1
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=d.length)
    o = bpy.context.object; o.name = name
    o.data.transform(Matrix.Diagonal((sx, sy, 1, 1)))
    o.data.transform(Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix().to_4x4())
    o.data.transform(Matrix.Translation((p1 + p2) / 2)); o.location = (0, 0, 0)
    return finish(o, mat, j)

def ring(name, mat, j, c, R, r, rot=(0, 0, 0), sx=1, sy=1):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=28, minor_segments=6,
                                     location=c, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = (sx, sy, 1); bake(o)
    return finish(o, mat, j)

def ball(name, mat, j, c, r, seg_=10, rings=6):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg_, ring_count=rings, radius=r, location=c)
    o = bpy.context.object; o.name = name; bake(o)
    return finish(o, mat, j)

def _chaikin(P, it=2):
    for _ in range(it):
        out = [P[0]]
        for i in range(len(P) - 1):
            out += [P[i].lerp(P[i + 1], 0.25), P[i].lerp(P[i + 1], 0.75)]
        out.append(P[-1]); P = out
    return P

def strap(name, mat, j, pts, w=0.04, t=0.012, smooth=True, center_z=1.3):
    P = [Vector(p) for p in pts]
    if smooth: P = _chaikin(P)
    bm = bmesh.new(); rows = []
    for i, p in enumerate(P):
        tan = (P[min(i + 1, len(P) - 1)] - P[max(i - 1, 0)]).normalized()
        n = p - Vector((0, 0, min(p.z, center_z))); n.normalize()
        wv = n.cross(tan).normalized(); n = tan.cross(wv).normalized()
        rows.append([bm.verts.new(p + wv * w / 2 + n * t / 2), bm.verts.new(p - wv * w / 2 + n * t / 2),
                     bm.verts.new(p - wv * w / 2 - n * t / 2), bm.verts.new(p + wv * w / 2 - n * t / 2)])
    for i in range(len(rows) - 1):
        A, B = rows[i], rows[i + 1]
        for k in range(4): bm.faces.new((A[k], A[(k + 1) % 4], B[(k + 1) % 4], B[k]))
    bm.faces.new(rows[0][::-1]); bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(mesh_obj(name, bm), mat, j, smooth=False)

def superell(t, hw, hd, e):
    c, s = math.cos(t), math.sin(t)
    return (hw * math.copysign(abs(c) ** (2 / e), c), hd * math.copysign(abs(s) ** (2 / e), s))

def loft(name, j, keys, mat_fn, n=48, e=2.3, step=0.01, cap_bottom=True, cap_top=True):
    """keys: list of (z, hw, hd, cy) sorted by z; interpolated every `step`. mat_fn(x,y,z)->material key."""
    zs = []
    z = keys[0][0]
    while z < keys[-1][0] - 1e-6: zs.append(z); z += step
    zs.append(keys[-1][0])
    def at(z):
        for a, b in zip(keys, keys[1:]):
            if a[0] <= z <= b[0]:
                t = (z - a[0]) / (b[0] - a[0]); t = t * t * (3 - 2 * t)
                return [a[i] + (b[i] - a[i]) * t for i in range(1, 4)]
        return keys[-1][1:]
    bm = bmesh.new(); rows = []
    for z in zs:
        hw, hd, cy = at(z)
        row = []
        for i in range(n):
            t = -math.pi / 2 + 2 * math.pi * i / n          # i=0 at front (-Y)
            x, y = superell(t, hw, hd, e)
            row.append(bm.verts.new((x, cy + y, z)))
        rows.append(row)
    keys_used = []
    def mi(k):
        if k not in keys_used: keys_used.append(k)
        return keys_used.index(k)
    for a, b in zip(rows, rows[1:]):
        for i in range(n):
            f = bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
            c = f.calc_center_median(); f.material_index = mi(mat_fn(c.x, c.y, c.z))
    if cap_bottom: bm.faces.new(rows[0][::-1]).material_index = mi(mat_fn(0, 0, zs[0]))
    if cap_top: bm.faces.new(rows[-1]).material_index = mi(mat_fn(0, 0, zs[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(name, bm)
    for k in keys_used: o.data.materials.append(MATS[k])
    return finish(o, None, j)

def raycast_front(objs, x, z, y0=-1.0):
    """first hit travelling +Y from the front at (x, z) against the given objects"""
    best = None
    for o in objs:
        bvh = BVHTree.FromObject(o, bpy.context.evaluated_depsgraph_get())
        hit = bvh.ray_cast(Vector((x, y0, z)), Vector((0, 1, 0)))
        if hit[0] is not None and (best is None or hit[3] < best[3]): best = hit
    return best

# ================================================================== LEGS (legX: thigh, kneeX: shin + boot)
for s, side in ((1, 'L'), (-1, 'R')):
    L, K = 'leg' + side, 'knee' + side
    hip = Vector((0.082 * s, 0.0, HIP_Z + 0.004)); knee = Vector((0.086 * s, -0.004, KNEE_Z))
    ankle = Vector((0.09 * s, 0.0, 0.2))
    seg(f'thigh_{side}', 'pants', L, hip, knee + Vector((0, 0, -0.02)), 0.074, 0.064, sy=0.97)
    ell(f'kneecap_{side}', 'pants', K, knee, (0.06, 0.062, 0.045))
    seg(f'shin_{side}', 'pants', K, knee, ankle + Vector((0, 0, 0.04)), 0.064, 0.06)
    seg(f'cuff_{side}', 'cuff', K, ankle + Vector((0, 0, 0.0)), ankle + Vector((0, 0, 0.06)), 0.068, 0.07)
    # boot
    seg(f'boot_shaft_{side}', 'boot', K, (ankle.x, 0, 0.04), (ankle.x, 0, 0.2), 0.058, 0.062)
    ring(f'boot_fold_{side}', 'boot', K, (ankle.x, 0, 0.195), 0.062, 0.012)
    ell(f'boot_toe_{side}', 'boot', K, (ankle.x, -0.07, 0.05), (0.056, 0.105, 0.05))
    box(f'boot_sole_{side}', 'sole', K, (ankle.x, -0.045, 0.013), (0.122, 0.26, 0.026), bevel=0.01)
    box(f'boot_heel_{side}', 'sole', K, (ankle.x, 0.05, 0.03), (0.105, 0.065, 0.034), bevel=0.006)
    ring(f'boot_strap_{side}', 'leather_dk', K, (ankle.x, -0.02, 0.09), 0.056, 0.007, rot=(math.radians(-28), 0, 0), sy=1.2)
    for i in range(3):
        box(f'boot_lace_{side}_{i}', 'leather_dk', K, (ankle.x, -0.06 + i * 0.012, 0.12 + i * 0.025), (0.05, 0.008, 0.006),
            rot=(math.radians(-30), 0, 0))
    # cargo pocket on outer thigh
    box(f'cargo_pocket_{side}', 'pants', L, (0.15 * s, 0.0, 0.73), (0.02, 0.1, 0.13), bevel=0.008)
    box(f'cargo_flap_{side}', 'pants', L, (0.156 * s, 0.0, 0.79), (0.02, 0.104, 0.028), bevel=0.006)
# right-thigh holster (character right = -X)
ring('thigh_strap_hi', 'leather', 'legR', (-0.084, 0, 0.84), 0.078, 0.008, sx=1.0, sy=1.0)
ring('thigh_strap_lo', 'leather', 'legR', (-0.085, 0, 0.73), 0.072, 0.008)
box('thigh_pouch', 'leather', 'legR', (-0.12, -0.07, 0.8), (0.06, 0.035, 0.1), rot=(0, 0, math.radians(-35)), bevel=0.008)
box('thigh_pouch_flap', 'leather_dk', 'legR', (-0.124, -0.086, 0.83), (0.064, 0.01, 0.042), rot=(0, 0, math.radians(-35)))
ball('thigh_pouch_rivet', 'brass', 'legR', (-0.126, -0.094, 0.826), 0.007)
strap('holster_drop', 'leather', 'legR', [(-0.118, -0.072, 0.925), (-0.122, -0.082, 0.89), (-0.12, -0.08, 0.86)], w=0.022, t=0.008, center_z=0.0)

# ================================================================== PELVIS, BELT (body)
loft('pelvis', 'body', [(0.9, 0.13, 0.095, 0.0), (0.97, 0.148, 0.104, 0.0), (1.05, 0.142, 0.1, 0.0)],
     lambda x, y, z: 'pants', n=32)
loft('belt', 'body', [(1.035, 0.149, 0.107, 0.0), (1.085, 0.147, 0.106, 0.0)], lambda x, y, z: 'leather', n=40)
box('belt_buckle', 'brass', 'body', (0, -0.112, 1.06), (0.05, 0.012, 0.042), bevel=0.004)
box('belt_buckle_in', 'leather', 'body', (0, -0.118, 1.06), (0.028, 0.006, 0.022))
for i, x in enumerate((-0.07, 0.07)):
    box(f'belt_loop_{i}', 'leather_dk', 'body', (x, -0.106, 1.06), (0.012, 0.012, 0.058))

# ================================================================== JACKET TORSO (square shoulders, slim waist)
def vhalf(z):            # half width of the open neckline at height z
    return max(0.0, 0.058 * (z - 1.335) / (1.5 - 1.335))
def torso_mat(x, y, z):
    if z > 1.395 and (y > -0.06 or abs(x) > 0.125): return 'blue'       # shoulder yoke
    if y > 0.02 and z > 1.33: return 'blue'                              # back yoke
    if z < 1.105: return 'cream_dk'                                      # hem band
    return 'cream'
loft('jacket', 'body', [
    (1.075, 0.142, 0.1, 0.0),
    (1.13, 0.135, 0.098, 0.0),     # slim waist
    (1.25, 0.15, 0.107, -0.002),
    (1.36, 0.168, 0.112, -0.004),  # chest
    (1.43, 0.183, 0.104, 0.0),     # wide, square shoulder line
    (1.47, 0.178, 0.088, 0.004),
    (1.49, 0.13, 0.07, 0.006),
    (1.505, 0.06, 0.05, 0.006)], torso_mat, n=56, e=2.6)
JACKET = PARTS[-1][0]
# buttons projected onto jacket front
for sx in (-1, 1):
    for i, z in enumerate((1.14, 1.2, 1.26, 1.32)):
        h = raycast_front([JACKET], 0.07 * sx, z)
        ball(f'btn_{sx}_{i}', 'brass', 'body', h[0] + Vector((0, -0.002, 0)), 0.009, 8, 5)
    h = raycast_front([JACKET], 0.112 * sx, 1.37)
    box(f'chest_flap_{sx}', 'cream_dk', 'body', h[0] + Vector((0, -0.004, 0.0)), (0.07, 0.008, 0.024))
    ball(f'chest_btn_{sx}', 'brass', 'body', h[0] + Vector((0, -0.01, -0.004)), 0.008, 8, 5)
def conform_plate(name, mat, j, poly_xz, off, t=0.004, target=None):
    bm = bmesh.new(); f = []; b = []
    for x, z in poly_xz:
        h = raycast_front([target], x, z)
        p = h[0] + Vector((0, -off, 0))
        f.append(bm.verts.new(p + Vector((0, -t / 2, 0)))); b.append(bm.verts.new(p + Vector((0, t / 2, 0))))
    bm.faces.new(f); bm.faces.new(b[::-1])
    for i in range(len(f)):
        k = (i + 1) % len(f); bm.faces.new((f[i], b[i], b[k], f[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return finish(mesh_obj(name, bm), mat, j, smooth=False)
# open V neckline: grey shirt, skin at the throat, coral lining edges, folded coral lapel points
def vline(n, x0, z0, z1, x1=0.0):
    return [(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n) for i in range(n + 1)]
def conform_band(name, mat, j, z0, z1, xin, xout, off, t=0.004, nz=14, nx=8, target=None):
    """grid plate between x=xin(z)..xout(z), z0..z1, projected onto `target` from the front"""
    bvh = BVHTree.FromObject(target, bpy.context.evaluated_depsgraph_get())
    bm = bmesh.new(); grid = []
    for iz in range(nz + 1):
        z = z0 + (z1 - z0) * iz / nz; row = []
        for ix in range(nx + 1):
            x = xin(z) + (xout(z) - xin(z)) * ix / nx
            h = bvh.ray_cast(Vector((x, -1, z)), Vector((0, 1, 0)))
            zz = z
            while h[0] is None and zz > z0 - 0.05:
                zz -= 0.002; h = bvh.ray_cast(Vector((x, -1, zz)), Vector((0, 1, 0)))
            p = h[0].copy(); p.z = z
            row.append(bm.verts.new(p + Vector((0, -off, 0))))
        grid.append(row)
    for a_, b_ in zip(grid, grid[1:]):
        for i in range(nx): bm.faces.new((a_[i], a_[i + 1], b_[i + 1], b_[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    o = mesh_obj(name, bm)
    mod = o.modifiers.new('sol', 'SOLIDIFY'); mod.thickness = t
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='sol')
    return finish(o, mat, j, smooth=False)
VB, VT = 1.33, 1.499
hv = lambda z: 0.062 * (z - VB) / (VT - VB)
conform_band('shirt_v', 'shirt', 'body', VB, VT, lambda z: -hv(z), hv, 0.0025, target=JACKET)
conform_band('throat_skin', 'skin', 'body', 1.41, VT, lambda z: -0.6 * hv(z) * (z - 1.41) / (VT - 1.41) * 1.6, lambda z: 0.6 * hv(z) * (z - 1.41) / (VT - 1.41) * 1.6, 0.004, target=JACKET)
for sx in (-1, 1):
    if sx > 0:
        conform_band('v_lining_L', 'coral', 'body', VB - 0.01, VT, lambda z: hv(z), lambda z: hv(z) + 0.013, 0.0035, nx=2, target=JACKET)
        conform_band('lapel_L', 'coral', 'body', 1.425, 1.5, lambda z: 0.064 - 0.01 * (z - 1.425) / 0.075,
                     lambda z: 0.064 + 0.046 * min(1, (z - 1.425) / 0.055), 0.0055, nz=8, nx=6, target=JACKET)
    else:
        conform_band('v_lining_R', 'coral', 'body', VB - 0.01, VT, lambda z: -hv(z) - 0.013, lambda z: -hv(z), 0.0035, nx=2, target=JACKET)
        conform_band('lapel_R', 'coral', 'body', 1.425, 1.5, lambda z: -0.064 - 0.046 * min(1, (z - 1.425) / 0.055),
                     lambda z: -0.064 + 0.01 * (z - 1.425) / 0.075, 0.0055, nz=8, nx=6, target=JACKET)
# back wing emblem on the blue yoke
for k in range(3):
    for sx in (-1, 1):
        box(f'emblem_wing_{sx}_{k}', 'brass', 'body', (sx * (0.034 + k * 0.004), 0.117, 1.405 - k * 0.012),
            (0.05 - k * 0.011, 0.006, 0.008), rot=(0, math.radians(-14 * sx), 0))
ball('emblem_core', 'brass', 'body', (0, 0.12, 1.395), 0.015, 10, 6)
ring('necklace', 'leather_dk', 'body', (0, -0.035, 1.47), 0.05, 0.0028, rot=(math.radians(-38), 0, 0))

# ---- standing collar: flared, taller at the back, V-open at the front; cream outside / coral inside
def collar_mesh(name, mat, dr, dz):
    bm = bmesh.new(); rows = []; V = 6; U = 28
    for v in range(V + 1):
        fv = v / V
        half_open = math.radians(24 + 40 * fv)
        row = []
        for u in range(U + 1):
            th = half_open + (2 * math.pi - 2 * half_open) * u / U       # angle from front (-Y)
            back = (1 - math.cos(th)) / 2
            r = 0.06 + 0.042 * fv ** 1.4 + dr
            z = 1.47 + (0.05 + 0.04 * back) * fv + dz
            row.append(bm.verts.new((r * math.sin(th), -r * math.cos(th) * 1.08 + 0.006, z)))
        rows.append(row)
    for a, b in zip(rows, rows[1:]):
        for u in range(U): bm.faces.new((a[u], a[u + 1], b[u + 1], b[u]))
    o = mesh_obj(name, bm)
    mod = o.modifiers.new('sol', 'SOLIDIFY'); mod.thickness = 0.006; mod.offset = 0
    bpy.context.view_layer.objects.active = o; bpy.ops.object.modifier_apply(modifier='sol')
    return finish(o, mat, 'body')
collar_mesh('collar_outer', 'cream', 0.0, 0.0)
collar_mesh('collar_inner', 'coral', -0.006, 0.002)

# ================================================================== ARMS
for s, side in ((1, 'L'), (-1, 'R')):
    A, E, H = 'arm' + side, 'elbow' + side, 'hand' + side
    sh = Vector((SH.x * s, SH.y, SH.z)); el = Vector((EL.x * s, EL.y, EL.z)); wr = Vector((WR.x * s, WR.y, WR.z))
    ell(f'shoulder_cap_{side}', 'blue', A, sh + Vector((0.0, 0, 0.0)), (0.054, 0.057, 0.042))
    mid = sh.lerp(el, 0.32)
    seg(f'sleeve_upper_blue_{side}', 'blue', A, sh, mid, 0.056, 0.053)
    seg(f'sleeve_upper_{side}', 'cream', A, mid, el + Vector((0, 0, 0.02)), 0.053, 0.05)
    ball(f'sleeve_emblem_{side}', 'brass', A, sh.lerp(el, 0.2) + Vector((0.054 * s, 0, 0)), 0.011, 8, 5)
    seg(f'sleeve_roll_{side}', 'cream_dk', E, el + Vector((0, 0, 0.035)), el + Vector((0, 0, -0.035)), 0.056, 0.055)
    seg(f'forearm_{side}', 'skin', E, el + Vector((0, 0, -0.02)), wr + Vector((0, 0, 0.01)), 0.037, 0.03)
    seg(f'wrist_band_{side}', 'watch' if side == 'L' else 'leather_dk', H, wr + Vector((0, 0, 0.016)), wr + Vector((0, 0, -0.008)), 0.034, 0.034)
    # fingerless glove, fingers, thumb
    hc = wr + Vector((0.004 * s, -0.004, -0.055))
    ell(f'glove_{side}', 'glove', H, hc, (0.027, 0.043, 0.05))
    seg(f'glove_cuff_{side}', 'glove', H, wr + Vector((0, 0, -0.008)), wr + Vector((0, 0, -0.03)), 0.034, 0.03)
    for i in range(4):
        fy = -0.03 + i * 0.02
        seg(f'finger_{side}_{i}', 'skin', H, (hc.x + 0.004 * s, hc.y + fy, hc.z - 0.035),
            (hc.x + 0.006 * s, hc.y + fy - 0.004, hc.z - 0.075 + abs(i - 1.5) * 0.007), 0.0095, 0.008, verts=8)
    seg(f'thumb_{side}', 'skin', H, (hc.x - 0.012 * s, hc.y - 0.035, hc.z + 0.005), (hc.x - 0.018 * s, hc.y - 0.055, hc.z - 0.025), 0.01, 0.0085, verts=8)

# letter held by the right hand (hidden unless the game sets letter.visible)
box('letter_paper', 'paper', 'letter', (-0.222, -0.05, 0.83), (0.012, 0.13, 0.095))
ball('letter_seal', 'coral', 'letter', (-0.229, -0.05, 0.83), 0.01, 8, 5)

# ================================================================== NECK + HEAD (oval face, tapered chin)
seg('neck', 'skin', 'head', (0, 0.006, 1.46), (0, 0.0, 1.62), 0.039, 0.036)
bpy.ops.mesh.primitive_uv_sphere_add(segments=36, ring_count=18, radius=1)
H_ = bpy.context.object; H_.name = 'head_skin'
for v in H_.data.vertices:
    x, y, z = v.co
    if z < 0:                       # lower half: narrow jaw, soft pointed chin, slightly forward
        t = -z
        x *= 1 - 0.36 * t ** 1.5
        y *= 1 - 0.12 * t
        y -= 0.10 * t ** 2 * max(0, -y)   # chin pulls forward
    v.co = Vector((x * HEAD_R.x, y * HEAD_R.y, z * HEAD_R.z)) + HEAD_C
finish(H_, 'skin', 'head')
HEADO = H_
def face_pt(x, z, out=0.0):
    h = raycast_front([HEADO], x, z)
    return h[0] + h[1] * out
for s in (-1, 1):
    ell(f'ear_{s}', 'skin', 'head', (0.078 * s, 0.012, 1.668), (0.014, 0.022, 0.028))
    p = face_pt(0.032 * s, 1.676, -0.003)
    ell(f'eye_{s}', 'eye', 'head', p, (0.0115, 0.007, 0.0165))
    ball(f'eye_hi_{s}', 'paper', 'head', face_pt(0.032 * s + 0.004, 1.683, 0.002), 0.0038, 8, 5)
    p = face_pt(0.034 * s, 1.708, 0.0)
    box(f'brow_{s}', 'hair', 'head', p, (0.028, 0.006, 0.0065), rot=(0, math.radians(4 * s), 0))
p = face_pt(0, 1.645, -0.004)
ell('nose', 'skin', 'head', p + Vector((0, -0.004, 0)), (0.008, 0.01, 0.013))
# smile: lower arc of a small torus, sitting on the face surface
pm = face_pt(0, 1.612, 0.0)
bpy.ops.mesh.primitive_torus_add(major_radius=0.016, minor_radius=0.0026, major_segments=24, minor_segments=6)
m_ = bpy.context.object; m_.name = 'mouth'
bm = bmesh.new(); bm.from_mesh(m_.data)
bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > -0.007], context='VERTS'); bm.to_mesh(m_.data); bm.free()
m_.data.transform(Matrix.Rotation(math.radians(90), 4, 'X'))
m_.data.transform(Matrix.Diagonal((1, 1, 0.75, 1)))
m_.data.transform(Matrix.Translation(pm + Vector((0, 0.001, 0.012))))
finish(m_, 'mouth', 'head')

# ---- hair: scalp + soft curls (low-poly balls), face window kept clear
HC = HEAD_C + Vector((0, 0.012, 0.012))
ell('hair_cap', 'hair', 'head', HC, (0.083, 0.094, 0.1), 24, 12)
ell('hair_nape', 'hair', 'head', HEAD_C + Vector((0, 0.045, -0.04)), (0.076, 0.06, 0.06), 20, 10)
n = 0
for i in range(600):
    u = random.uniform(-1, 1); th = random.uniform(0, 2 * math.pi)
    v = Vector((math.sqrt(1 - u * u) * math.cos(th), math.sqrt(1 - u * u) * math.sin(th), u))
    if v.z < -0.2 and v.y < 0.3: continue
    if v.z < -0.55: continue
    if v.y < -0.3 and v.z < 0.5: continue          # face window
    if abs(v.x) > 0.75 and v.z < 0.2 and v.y < 0.25: continue   # ears
    p = HC + Vector((v.x * 0.084, v.y * 0.092, v.z * 0.1))
    ball(f'curl_{n}', 'hair', 'head', p, random.uniform(0.019, 0.029), 10, 6); n += 1
    if n >= 85: break
for i, x in enumerate((-0.055, -0.022, 0.012, 0.046)):          # fringe curls tumbling on the forehead
    ball(f'fringe_{i}', 'hair', 'head', (x, -0.078, 1.752 - abs(x) * 0.35), 0.021, 10, 6)
# goggles pushed up onto the hair
ring('goggle_strap', 'leather_dk', 'head', HC + Vector((0, 0.0, 0.05)), 0.098, 0.009, rot=(math.radians(-24), 0, 0), sy=1.08)
for s in (-1, 1):
    c = Vector((0.04 * s, -0.07, 1.79))
    seg(f'goggle_rim_{s}', 'brass', 'head', c, c + Vector((0, -0.016, 0.022)), 0.026, 0.024)
    seg(f'goggle_lens_{s}', 'glass', 'head', c + Vector((0, -0.015, 0.021)), c + Vector((0, -0.019, 0.026)), 0.02, 0.02)
box('goggle_bridge', 'brass', 'head', (0, -0.082, 1.802), (0.022, 0.01, 0.009))

# ================================================================== CROSS-BODY STRAP + SATCHEL (left hip, behind the arm's swing plane)
BAG = Vector((0.085, 0.148, 1.02))
FRONT = [(-0.1, 0.03, 1.502), (-0.098, -0.07, 1.452), (-0.05, -0.116, 1.37), (0.06, -0.112, 1.2), (0.135, -0.078, 1.12), (0.156, 0.0, 1.1), (0.12, 0.11, 1.095)]
BACK = [(-0.1, 0.03, 1.502), (-0.095, 0.09, 1.44), (-0.04, 0.12, 1.33), (0.04, 0.122, 1.2), (0.06, 0.14, 1.095)]
strap('bag_strap_front', 'leather', 'body', FRONT, w=0.04)
strap('bag_strap_back', 'leather', 'body', BACK, w=0.04)
a_, b_ = Vector(FRONT[1]), Vector(FRONT[2])
P_ = lambda t: tuple(a_.lerp(b_, t) + Vector((0, -0.005, 0)))
strap('strap_buckle', 'brass', 'body', [P_(0.35), P_(0.65)], w=0.05, t=0.016, smooth=False)
strap('strap_buckle_in', 'leather', 'body', [P_(0.42), P_(0.58)], w=0.028, t=0.02, smooth=False)
rotz = math.radians(-12)
box('bag', 'leather', 'body', BAG, (0.16, 0.065, 0.14), rot=(0, 0, rotz), bevel=0.014)
R = Matrix.Rotation(rotz, 3, 'Z')
box('bag_flap', 'leather_dk', 'body', BAG + R @ Vector((0, 0.036, 0.03)), (0.165, 0.012, 0.09), rot=(0, 0, rotz), bevel=0.005)
box('bag_clasp', 'brass', 'body', BAG + R @ Vector((0, 0.045, -0.012)), (0.024, 0.008, 0.028), rot=(0, 0, rotz))
box('bag_badge', 'brass', 'body', BAG + R @ Vector((0, 0.044, 0.045)), (0.032, 0.006, 0.02), rot=(0, 0, rotz))
for i, (dx, h) in enumerate(((-0.04, 0.035), (0.0, 0.045), (0.04, 0.03))):
    box(f'letter_in_bag_{i}', 'paper', 'body', BAG + R @ Vector((dx, -0.012 + i * 0.008, 0.075 + h / 2 - 0.01)), (0.07, 0.006, h), rot=(0, 0, rotz))
T = BAG + R @ Vector((-0.095, 0.0, 0.0))
seg('brass_tube', 'brass', 'body', T + Vector((0, 0, -0.095)), T + Vector((0, 0, 0.1)), 0.024, 0.024)
seg('brass_tube_cap', 'leather_dk', 'body', T + Vector((0, 0, 0.1)), T + Vector((0, 0, 0.118)), 0.026, 0.026)
seg('brass_tube_end', 'leather_dk', 'body', T + Vector((0, 0, -0.113)), T + Vector((0, 0, -0.095)), 0.026, 0.026)
ring('tube_band', 'leather_dk', 'body', T, 0.026, 0.005)

# ================================================================== parent parts to joints (mesh baked into joint-local space)
for o, j in PARTS:
    o.data.transform(Matrix.Translation(-JW[j]))
    o.parent = JOINT[j]; o.location = (0, 0, 0)
bpy.context.view_layer.update()

# ================================================================== game pose table (copied from humanCourier.js steady states)
C = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))     # three.js (x, y, z) -> blender (x, -z, y)
def set_three(name, x=0.0, y=0.0, z=0.0):
    R3 = Euler((x, y, z), 'XYZ').to_matrix()       # three.js 'XYZ' euler == R_x R_y R_z
    e = JOINT[name]; e.rotation_mode = 'QUATERNION'
    e.rotation_quaternion = (C @ R3 @ C.transposed()).to_quaternion()
def walk_pose(running, phase=math.pi / 2):
    amp = 0.62 if running else 0.36; sw = math.sin(phase) * amp; kf = 1.45 if running else 1.18
    arm = 0.82 if running else 0.62
    return {'legL': (sw,), 'legR': (-sw,), 'kneeL': (max(0, -sw) * kf,), 'kneeR': (max(0, sw) * kf,),
            'armL': (-sw * arm, 0, 0.05), 'armR': (sw * arm, 0, -0.05),
            'elbowL': (-0.18 - max(0, -sw) * 0.26,), 'elbowR': (-0.18 - max(0, sw) * 0.26,),
            'handL': (-math.sin(phase - 0.42) * (0.26 if running else 0.16),),
            'handR': (math.sin(phase - 0.42) * (0.26 if running else 0.16),)}
POSES = {
    'idle': {'armL': (0, 0, 0.04), 'armR': (0, 0, -0.04), 'elbowL': (-0.1,), 'elbowR': (-0.1,)},
    'walk': walk_pose(False), 'walk_b': walk_pose(False, -math.pi / 2),
    'run': walk_pose(True), 'run_b': walk_pose(True, -math.pi / 2),
    'letter': {'armL': (0, 0, 0.05), 'elbowL': (-0.12,), 'armR': (-0.62, -0.15, -0.22), 'elbowR': (-0.72, 0.12, 0), 'handR': (0.22,)},
    'ride': {'legL': (-1.15,), 'legR': (-1.15,), 'kneeL': (1.3,), 'kneeR': (1.3,), 'armL': (-0.48, 0, 0.05),
             'armR': (-0.48, 0, -0.05), 'elbowL': (-0.68,), 'elbowR': (-0.68,)},
    'jump': {'legL': (-0.28,), 'legR': (0.22,), 'kneeL': (0.45,), 'kneeR': (0.65,), 'armL': (0, 0, 0.04), 'armR': (0, 0, -0.04),
             'elbowL': (-0.1,), 'elbowR': (-0.1,)},
}
def apply_pose(name):
    for j in JOINT:
        if j in ('body',): continue
        set_three(j)
    for j, v in POSES[name].items(): set_three(j, *v)
    JOINT['letter'].hide_render = name != 'letter'
    for o, jn in PARTS:
        if jn == 'letter': o.hide_render = name != 'letter'
    bpy.context.view_layer.update()

# ---- penetration audit: forearms/hands/sleeves vs torso gear, legs vs bag/pouches
def world_bvh(objs):
    verts, polys = [], []
    for o in objs:
        M = o.matrix_world; off = len(verts)
        verts += [M @ v.co for v in o.data.vertices]
        polys += [[off + i for i in p.vertices] for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, polys)
def descendants(jn):
    out = {jn}
    for c in JOINT[jn].children_recursive:
        if c.name in JOINT: out.add(c.name)
    return out
def objs_of(joints, exclude=()):
    return [o for o, j in PARTS if j in joints and not any(o.name.startswith(e) for e in exclude)]
TORSO_GEAR = [o for o, j in PARTS if j == 'body']
GEAR = [o for o in TORSO_GEAR if o.name.startswith(('bag', 'brass_tube', 'tube_band', 'letter_in_bag', 'hip_pouch', 'bag_strap', 'strap_'))]
audit = {}
for pname in POSES:
    apply_pose(pname)
    res = {}
    for side in 'LR':
        lower_arm = objs_of(descendants('elbow' + side))            # forearm + hand
        upper_arm = objs_of({'arm' + side}, exclude=('shoulder_cap',))
        res['forearm_hand_' + side + '_vs_torso'] = len(world_bvh(lower_arm).overlap(world_bvh(TORSO_GEAR)))
        res['upperarm_' + side + '_vs_gear'] = len(world_bvh(upper_arm).overlap(world_bvh(GEAR)))
        legs = objs_of(descendants('leg' + side))
        res['leg_' + side + '_vs_gear'] = len(world_bvh(legs).overlap(world_bvh(GEAR)))
        other = objs_of(descendants('leg' + ('R' if side == 'L' else 'L')))
        if side == 'L': res['leg_vs_leg'] = len(world_bvh(legs).overlap(world_bvh(other)))
    audit[pname] = res
    det = []
    for side in 'LR':
        for A_ in objs_of(descendants('elbow' + side)) + objs_of(descendants('leg' + side)):
            ba = world_bvh([A_])
            for B_ in TORSO_GEAR:
                if B_.name.startswith(('collar',)): continue
                k = len(ba.overlap(world_bvh([B_])))
                if k: det.append(f'{A_.name}x{B_.name}:{k}')
    if det: audit[pname + '_detail'] = det
for j in JOINT: set_three(j)          # identity rest pose for export (game drives the rotations)
for o, jn in PARTS:
    o.hide_render = False
bpy.context.view_layer.update()

tris = 0
for o, j in PARTS:
    o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
height = max((o.matrix_world @ v.co).z for o, j in PARTS for v in o.data.vertices)
info = {'parts': len(PARTS), 'triangles': tris, 'height_m': round(height, 4),
        'joints': {k: [round(c, 4) for c in v] for k, v in JW.items()}, 'audit_overlapping_face_pairs': audit}
print(json.dumps(info, indent=1))
with open(os.path.join(OUT, 'courier-v2-report.json'), 'w') as f: json.dump(info, f, indent=1)

# custom props -> glTF extras -> three.js userData
ROOT['isHumanCourier'] = True
ROOT['bodyBaseY'] = HIP_Z
ROOT['source'] = 'courier-blender-threeview v2 (Blender build_courier_v2.py)'
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'courier-v2.blend'))

# ---- export: merge meshes per joint (fewer nodes/draw calls), keep the joint hierarchy
for jn, e in JOINT.items():
    kids = [o for o, j in PARTS if j == jn]
    if len(kids) < 2: continue
    bpy.ops.object.select_all(action='DESELECT')
    for o in kids: o.select_set(True)
    bpy.context.view_layer.objects.active = kids[0]
    bpy.ops.object.join()
    bpy.context.object.name = f'{jn}_mesh'
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'courier-v2.glb'), export_format='GLB',
                          export_extras=True, export_apply=True)
print('exported')
