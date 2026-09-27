import bpy
import bmesh
import math
from math import pi, sin, cos
from mathutils import Vector, Matrix, Euler
import sys
from pathlib import Path

# Load source head-38
BASE = Path(__file__).resolve().parents[2]
source_blend = BASE / 'assets/models/optimized/human-courier-production-v2/head-38/courier.blend'
bpy.ops.wm.open_mainfile(filepath=str(source_blend))

scene = bpy.context.scene
head = bpy.data.objects.get('head')
assert head, "Head object must exist"

# 1. Clean up distorted legacy meshes from head
objects_to_remove = []
for child in head.children_recursive:
    if child.name.startswith(('Anatomy_beard_fiber', 'Anatomy_brow_fiber', 'Anatomy_helix', 'Nose', 'Face')):
        objects_to_remove.append(child)

for obj in objects_to_remove:
    bpy.data.objects.remove(obj, do_unlink=True)

print(f"Removed {len(objects_to_remove)} legacy/distorted objects.")

# 8-Color Palette
PALETTE = {
    'skin_highlight': (0.784, 0.620, 0.463, 1.0), # #c89e76
    'skin_mid':       (0.655, 0.478, 0.337, 1.0), # #a77a56
    'skin_shadow':    (0.525, 0.357, 0.239, 1.0), # #865b3d
    'beard_dark':     (0.220, 0.180, 0.169, 1.0), # #382e2b
    'hair_base':      (0.169, 0.133, 0.125, 1.0), # #2b2220
    'shirt_ivory':    (0.863, 0.820, 0.745, 1.0), # #dcd1be
    'cape_wine':      (0.455, 0.165, 0.176, 1.0), # #742a2d
    'tunic_teal':     (0.176, 0.337, 0.337, 1.0), # #2d5656
    'clasp_gold':     (0.620, 0.471, 0.271, 1.0), # #9e7845
    'iris_amber':     (0.612, 0.396, 0.188, 1.0), # #9c6530
    'sclera_white':   (0.920, 0.890, 0.840, 1.0), # #eae3d6
    'pupil_black':    (0.100, 0.080, 0.070, 1.0), # #1a1412
}

def get_or_create_material(name, color_rgba, roughness=0.88, metallic=0.0):
    mat = bpy.data.materials.get(name)
    if not mat:
        mat = bpy.data.materials.new(name=name)
        mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value = color_rgba
        bsdf.inputs['Roughness'].default_value = roughness
        if 'Metallic' in bsdf.inputs:
            bsdf.inputs['Metallic'].default_value = metallic
    return mat

def create_lowpoly_mesh(name, verts, faces, mat_name, parent=head):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for poly in me.polygons:
        poly.use_smooth = False
    obj = bpy.data.objects.new(name, me)
    if mat_name in PALETTE:
        mat = get_or_create_material(mat_name, PALETTE[mat_name],
                                     roughness=0.35 if 'gold' in mat_name else 0.88,
                                     metallic=0.65 if 'gold' in mat_name else 0.0)
        obj.data.materials.append(mat)
    scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
        # In local space of head: head world position is (0, 0, 1.55)
        # So local z = world z - 1.55
    return obj

# Head local origin is around world z=1.55.
# Let's construct Round 1 Face Base:
# Chin at world z=1.52 -> local z=-0.03
# Mouth at world z=1.56 -> local z=0.01
# Nose tip at world z=1.60 -> local z=0.05, y=-0.115
# Eyes at world z=1.64 -> local z=0.09
# Brow at world z=1.67 -> local z=0.12
# Forehead at world z=1.71 -> local z=0.16
# Crown at world z=1.75 -> local z=0.20

# 1. Low Poly Facial Planes Mesh
# Front, cheek, nose, chin, jaw
# Symmetric vertex array:
# Key points defined for half-face, then mirrored:
V = {}
# Centerline points (x = 0):
V['crown_top']    = (0.000, -0.010,  0.205)
V['forehead_top'] = (0.000, -0.075,  0.170)
V['forehead_mid'] = (0.000, -0.082,  0.145)
V['glabella']     = (0.000, -0.086,  0.120) # between brows
V['sellion']      = (0.000, -0.090,  0.105) # nose root
V['rhinion']      = (0.000, -0.104,  0.078) # nose bridge
V['nasal_tip']    = (0.000, -0.118,  0.052) # nose tip
V['subnasale']    = (0.000, -0.096,  0.038) # under nose
V['philtrum']     = (0.000, -0.092,  0.024)
V['lip_upper']    = (0.000, -0.095,  0.014)
V['mouth_slit']   = (0.000, -0.088,  0.005)
V['lip_lower']    = (0.000, -0.092, -0.005)
V['mentolabial']  = (0.000, -0.084, -0.018) # groove under lip
V['pogonion']     = (0.000, -0.088, -0.032) # chin front
V['gnathion']     = (0.000, -0.078, -0.045) # chin bottom
V['throat']       = (0.000, -0.030, -0.050)

# Lateral points (s = -1 for char-right/stage-left, s = 1 for char-left/stage-right):
def make_lateral_points(s):
    p = {}
    p[f'forehead_lat_{s}']   = (s * 0.045, -0.068,  0.165)
    p[f'temple_{s}']         = (s * 0.062, -0.045,  0.140)
    p[f'brow_inner_{s}']     = (s * 0.018, -0.088,  0.122)
    p[f'brow_arch_{s}']      = (s * 0.040, -0.082,  0.124)
    p[f'brow_tail_{s}']      = (s * 0.058, -0.065,  0.115)
    p[f'orbit_inner_{s}']    = (s * 0.015, -0.082,  0.102)
    p[f'orbit_outer_{s}']    = (s * 0.052, -0.062,  0.095)
    p[f'orbit_bottom_{s}']   = (s * 0.034, -0.070,  0.080)
    p[f'nose_slope_{s}']     = (s * 0.014, -0.098,  0.075)
    p[f'alar_{s}']           = (s * 0.020, -0.096,  0.045) # nostril
    p[f'zygoma_high_{s}']    = (s * 0.066, -0.048,  0.082) # high cheekbone
    p[f'cheek_mid_{s}']      = (s * 0.055, -0.062,  0.045)
    p[f'mouth_corner_{s}']   = (s * 0.026, -0.078,  0.006)
    p[f'jaw_angle_{s}']      = (s * 0.058, -0.025, -0.012) # gonion
    p[f'jaw_line_{s}']       = (s * 0.044, -0.055, -0.030)
    p[f'chin_lateral_{s}']   = (s * 0.022, -0.076, -0.040)
    p[f'ear_top_{s}']        = (s * 0.068, -0.015,  0.105)
    p[f'ear_lobe_{s}']       = (s * 0.065, -0.010,  0.030)
    return p

for s in [-1, 1]:
    V.update(make_lateral_points(s))

# Build faces list
vert_keys = list(V.keys())
vert_indices = {k: i for i, k in enumerate(vert_keys)}
raw_verts = [V[k] for k in vert_keys]

faces = []
def add_tri(a, b, c):
    faces.append((vert_indices[a], vert_indices[b], vert_indices[c]))
def add_quad(a, b, c, d):
    faces.append((vert_indices[a], vert_indices[b], vert_indices[c], vert_indices[d]))

for s in [-1, 1]:
    # Forehead
    add_quad('crown_top', f'forehead_lat_{s}', 'forehead_top', 'crown_top') if s==1 else None
    add_quad('forehead_top', f'forehead_lat_{s}', f'temple_{s}', 'forehead_mid')
    add_quad('forehead_mid', f'temple_{s}', f'brow_tail_{s}', 'glabella')
    add_tri('glabella', f'brow_tail_{s}', f'brow_arch_{s}')
    add_tri('glabella', f'brow_arch_{s}', f'brow_inner_{s}')
    
    # Eye orbit & Cheekbone
    add_tri('glabella', f'brow_inner_{s}', 'sellion')
    add_tri('sellion', f'brow_inner_{s}', f'orbit_inner_{s}')
    add_quad(f'brow_inner_{s}', f'brow_arch_{s}', f'orbit_bottom_{s}', f'orbit_inner_{s}')
    add_quad(f'brow_arch_{s}', f'brow_tail_{s}', f'orbit_outer_{s}', f'orbit_bottom_{s}')
    add_quad(f'brow_tail_{s}', f'temple_{s}', f'zygoma_high_{s}', f'orbit_outer_{s}')
    
    # Nose
    add_quad('sellion', f'orbit_inner_{s}', f'nose_slope_{s}', 'rhinion')
    add_quad('rhinion', f'nose_slope_{s}', f'alar_{s}', 'nasal_tip')
    add_tri('nasal_tip', f'alar_{s}', 'subnasale')
    
    # Cheeks
    add_quad(f'orbit_bottom_{s}', f'orbit_outer_{s}', f'zygoma_high_{s}', f'cheek_mid_{s}')
    add_quad(f'orbit_inner_{s}', f'orbit_bottom_{s}', f'cheek_mid_{s}', f'alar_{s}')
    add_quad(f'alar_{s}', f'cheek_mid_{s}', f'mouth_corner_{s}', 'subnasale')
    add_quad('subnasale', f'mouth_corner_{s}', 'mouth_slit', 'philtrum')
    add_tri('philtrum', 'mouth_slit', 'lip_upper')
    
    # Mouth, Chin, Jaw
    add_quad('mouth_slit', f'mouth_corner_{s}', f'chin_lateral_{s}', 'lip_lower')
    add_quad('lip_lower', f'chin_lateral_{s}', 'pogonion', 'mentolabial')
    add_tri('mentolabial', 'pogonion', 'pogonion') if s==1 else None
    add_quad('pogonion', f'chin_lateral_{s}', f'gnathion', 'pogonion') if s==1 else None
    
    # Jawline and beard planes
    add_quad(f'zygoma_high_{s}', f'ear_top_{s}', f'jaw_angle_{s}', f'cheek_mid_{s}')
    add_quad(f'cheek_mid_{s}', f'jaw_angle_{s}', f'jaw_line_{s}', f'mouth_corner_{s}')
    add_quad(f'mouth_corner_{s}', f'jaw_line_{s}', f'chin_lateral_{s}', 'mouth_slit')
    add_tri(f'chin_lateral_{s}', f'gnathion', f'jaw_line_{s}')
    add_quad(f'jaw_line_{s}', f'jaw_angle_{s}', f'ear_lobe_{s}', f'throat')
    add_tri(f'jaw_line_{s}', f'throat', 'gnathion')

# Clean filtered faces
valid_faces = []
for f in faces:
    unique_indices = []
    for idx in f:
        if idx not in unique_indices:
            unique_indices.append(idx)
    if len(unique_indices) >= 3:
        valid_faces.append(tuple(unique_indices))

face_mesh_obj = create_lowpoly_mesh("TargetLowPolyFaceBase", raw_verts, valid_faces, 'skin_mid', parent=head)
print("Created TargetLowPolyFaceBase successfully with", len(raw_verts), "verts and", len(valid_faces), "faces.")

# 2. Almond Eyes (left and right)
for s in [-1, 1]:
    sclera_verts = [
        (s * 0.020, -0.078, 0.100), # inner
        (s * 0.034, -0.075, 0.106), # top
        (s * 0.048, -0.068, 0.096), # outer
        (s * 0.034, -0.072, 0.092), # bottom
    ]
    sclera_faces = [(0, 1, 2, 3)]
    create_lowpoly_mesh(f"TargetEyeSclera_{s}", sclera_verts, sclera_faces, 'sclera_white', parent=head)
    
    iris_verts = [
        (s * 0.030, -0.077, 0.102),
        (s * 0.035, -0.076, 0.104),
        (s * 0.038, -0.074, 0.100),
        (s * 0.033, -0.075, 0.098),
    ]
    iris_faces = [(0, 1, 2, 3)]
    create_lowpoly_mesh(f"TargetEyeIris_{s}", iris_verts, iris_faces, 'iris_amber', parent=head)

# 3. Trimmed Boxed Beard Mesh (Mustache + Jawline Beard)
beard_verts = [
    # Mustache
    (0.000, -0.096,  0.034),
    (-0.022, -0.088, 0.016),
    (0.022, -0.088,  0.016),
    (0.000, -0.096,  0.018),
    # Chin / Jaw beard band
    (0.000, -0.090, -0.020),
    (-0.024, -0.080, -0.038),
    (0.024, -0.080, -0.038),
    (-0.046, -0.060, -0.028),
    (0.046, -0.060, -0.028),
    (-0.060, -0.028, -0.010),
    (0.060, -0.028, -0.010),
    (0.000, -0.080, -0.046),
]
beard_faces = [
    (0, 1, 3), (0, 3, 2), # mustache
    (4, 5, 11), (4, 11, 6), # chin front
    (5, 7, 11), (6, 11, 8), # chin lateral
    (7, 9, 11), (8, 11, 10), # jaw edge
]
create_lowpoly_mesh("TargetLowPolyBeard", beard_verts, beard_faces, 'beard_dark', parent=head)

# 4. Low-Poly Volumetric Hair Crown & Bun
hair_crown_verts = [
    (0.000, -0.072, 0.180),  # front hairline center
    (-0.050, -0.062, 0.175), # front hairline right
    (0.050, -0.062, 0.175),  # front hairline left
    (-0.075, -0.035, 0.155), # side right
    (0.075, -0.035, 0.155),  # side left
    (-0.078, 0.030, 0.130),  # temple back right
    (0.078, 0.030, 0.130),   # temple back left
    (0.000, 0.070, 0.120),   # nape top
    (0.000, -0.010, 0.225),  # crown peak
    (-0.055, 0.010, 0.215),  # crown peak right
    (0.055, 0.010, 0.215),   # crown peak left
    (0.000, 0.055, 0.190),   # back crown
]
hair_crown_faces = [
    (0, 1, 9, 8), (0, 8, 10, 2), # front bangs wedge
    (1, 3, 5, 9), (2, 10, 6, 4), # side volumes
    (8, 9, 11), (8, 11, 10),     # top crown
    (9, 5, 7, 11), (10, 11, 7, 6)# back crown
]
create_lowpoly_mesh("TargetLowPolyHairCrown", hair_crown_verts, hair_crown_faces, 'hair_base', parent=head)

# Half-up bun at back
bun_verts = [
    (0.000, 0.075, 0.165),
    (-0.025, 0.090, 0.180),
    (0.025, 0.090, 0.180),
    (-0.030, 0.115, 0.165),
    (0.030, 0.115, 0.165),
    (-0.020, 0.110, 0.145),
    (0.020, 0.110, 0.145),
    (0.000, 0.125, 0.160),
]
bun_faces = [
    (0, 1, 3, 5), (0, 6, 4, 2), # bun sides
    (1, 2, 4, 3), # bun top
    (5, 3, 7, 6), (6, 7, 4, 2), # bun back
]
create_lowpoly_mesh("TargetLowPolyBun", bun_verts, bun_faces, 'hair_base', parent=head)

# 5. Draped Cowl Collar (wine-red outer, teal inner, ivory shirt V-neck)
cowl_outer_verts = [
    (0.000, -0.115, -0.060), # cowl front droop
    (-0.075, -0.095, -0.045),
    (0.075, -0.095, -0.045),
    (-0.110, -0.030, -0.050),
    (0.110, -0.030, -0.050),
    (-0.095, 0.055, -0.060),
    (0.095, 0.055, -0.060),
    (0.000, 0.075, -0.070),
    # Lower rim
    (0.000, -0.130, -0.110),
    (-0.095, -0.110, -0.095),
    (0.095, -0.110, -0.095),
    (-0.135, -0.035, -0.100),
    (0.135, -0.035, -0.100),
    (-0.115, 0.070, -0.105),
    (0.115, 0.070, -0.105),
    (0.000, 0.090, -0.115),
]
cowl_outer_faces = [
    (0, 1, 9, 8), (0, 8, 10, 2),
    (1, 3, 11, 9), (2, 10, 12, 4),
    (3, 5, 13, 11), (4, 12, 14, 6),
    (5, 7, 15, 13), (6, 14, 15, 7),
]
create_lowpoly_mesh("TargetLowPolyCowlOuter", cowl_outer_verts, cowl_outer_faces, 'cape_wine', parent=head)

# Teal inner fold rim
cowl_inner_verts = [
    (0.000, -0.105, -0.055),
    (-0.065, -0.088, -0.042),
    (0.065, -0.088, -0.042),
    (0.000, -0.115, -0.060),
    (-0.075, -0.095, -0.045),
    (0.075, -0.095, -0.045),
]
cowl_inner_faces = [(0, 1, 4, 3), (0, 3, 5, 2)]
create_lowpoly_mesh("TargetLowPolyCowlInner", cowl_inner_verts, cowl_inner_faces, 'tunic_teal', parent=head)

# Ivory shirt V-neck
shirt_verts = [
    (0.000, -0.085, -0.040),
    (-0.040, -0.065, -0.035),
    (0.040, -0.065, -0.035),
    (0.000, -0.100, -0.085), # V plunge
]
shirt_faces = [(0, 1, 3), (0, 3, 2)]
create_lowpoly_mesh("TargetLowPolyShirtV", shirt_verts, shirt_faces, 'shirt_ivory', parent=head)

# Antique Gold Diamond Clasp on right shoulder
clasp_verts = [
    (-0.085, -0.095, -0.040), # center top
    (-0.105, -0.090, -0.055), # left
    (-0.065, -0.090, -0.055), # right
    (-0.085, -0.085, -0.070), # bottom
    (-0.085, -0.102, -0.055), # raised apex
]
clasp_faces = [
    (0, 1, 4), (0, 4, 2),
    (1, 3, 4), (2, 4, 3)
]
create_lowpoly_mesh("TargetLowPolyBrooch", clasp_verts, clasp_faces, 'clasp_gold', parent=head)

# Save Round 1 blend
round1_blend = BASE / 'assets/models/optimized/human-courier-production-v2/head-round1/courier.blend'
round1_blend.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(round1_blend))
print(f"Saved Round 1 blend to {round1_blend}")

