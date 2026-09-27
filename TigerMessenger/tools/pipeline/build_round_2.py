import bpy
import bmesh
import math
from math import pi, sin, cos
from mathutils import Vector, Matrix, Euler
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
source_blend = BASE / 'assets/models/optimized/human-courier-production-v2/head-round1/courier.blend'
bpy.ops.wm.open_mainfile(filepath=str(source_blend))

scene = bpy.context.scene
head = bpy.data.objects.get('head')
assert head, "Head object must exist"

# Remove Round 1 test objects to replace with refined unified meshes
for child in list(head.children_recursive):
    if child.name.startswith(('Target', 'Anatomy_')):
        bpy.data.objects.remove(child, do_unlink=True)

# Also hide or remove old Neck if it interferes
neck = bpy.data.objects.get('Neck')
if neck:
    neck.hide_render = True

PALETTE = {
    'skin_highlight': (0.784, 0.620, 0.463, 1.0), # #c89e76
    'skin_mid':       (0.655, 0.478, 0.337, 1.0), # #a77a56
    'skin_shadow':    (0.525, 0.357, 0.239, 1.0), # #865b3d
    'beard_dark':     (0.220, 0.180, 0.169, 1.0), # #382e2b
    'hair_base':      (0.169, 0.133, 0.125, 1.0), # #2b2220
    'shirt_ivory':    (0.863, 0.820, 0.745, 1.0), # #dcd1be
    'cape_wine':      (0.380, 0.080, 0.100, 1.0), # Deeper rich wine-red #611419
    'tunic_teal':     (0.150, 0.290, 0.290, 1.0), # #264a4a
    'clasp_gold':     (0.680, 0.520, 0.220, 1.0), # #ad8538
    'iris_amber':     (0.612, 0.396, 0.188, 1.0), # #9c6530
    'sclera_white':   (0.920, 0.890, 0.840, 1.0), # #eae3d6
    'pupil_black':    (0.080, 0.060, 0.050, 1.0), # #140f0d
}

def get_or_create_material(name, color_rgba, roughness=0.85, metallic=0.0):
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

# Pre-create materials
MATS = {k: get_or_create_material(k, PALETTE[k], 
                                  roughness=0.35 if 'gold' in k else 0.85,
                                  metallic=0.75 if 'gold' in k else 0.0) 
        for k in PALETTE}

def create_poly_mesh(name, verts, faces, mat_names, parent=head):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    for poly in me.polygons:
        poly.use_smooth = False
    
    # Add materials to mesh
    for m in mat_names:
        me.materials.append(MATS[m])
        
    obj = bpy.data.objects.new(name, me)
    scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj

# -------------------------------------------------------------
# 1. Complete Unified Low-Poly Head & Skull (Round 2)
# -------------------------------------------------------------
# Building fully enclosed solid low-poly head matching target proportions:
bm = bmesh.new()

# Material slots for BM:
# 0: skin_mid, 1: skin_highlight, 2: skin_shadow, 3: beard_dark, 4: hair_base
mat_map = {'skin_mid': 0, 'skin_highlight': 1, 'skin_shadow': 2, 'beard_dark': 3, 'hair_base': 4}

# Vertices dictionary
V = {}

# Symmetrical vertices generator
def define_head_geometry():
    # Centerline vertices (x = 0)
    V['crown_front'] = (0.000, -0.040,  0.220)
    V['forehead_hi']  = (0.000, -0.078,  0.180)
    V['forehead_lo']  = (0.000, -0.086,  0.145)
    V['glabella']     = (0.000, -0.090,  0.125) # between eyebrows
    V['sellion']      = (0.000, -0.093,  0.110) # bridge root
    V['rhinion']      = (0.000, -0.108,  0.078) # high straight bridge
    V['supratip']     = (0.000, -0.117,  0.056)
    V['nasal_tip']    = (0.000, -0.122,  0.046) # sharp triangular tip
    V['infratip']     = (0.000, -0.110,  0.038)
    V['subnasale']    = (0.000, -0.096,  0.032) # nose base
    V['philtrum']     = (0.000, -0.092,  0.020)
    V['upper_lip']    = (0.000, -0.097,  0.012)
    V['mouth_center'] = (0.000, -0.090,  0.004)
    V['lower_lip']    = (0.000, -0.093, -0.006)
    V['chin_groove']  = (0.000, -0.084, -0.018)
    V['chin_apex']    = (0.000, -0.092, -0.032) # strong chin
    V['chin_base']    = (0.000, -0.080, -0.048)
    V['neck_throat']  = (0.000, -0.035, -0.065)
    
    # Cranium rear centerline
    V['crown_apex']   = (0.000,  0.015,  0.230)
    V['crown_rear']   = (0.000,  0.070,  0.190)
    V['occiput_hi']   = (0.000,  0.095,  0.140)
    V['occiput_mid']  = (0.000,  0.090,  0.080)
    V['occiput_lo']   = (0.000,  0.070,  0.010)
    V['neck_nape']    = (0.000,  0.050, -0.060)

    # Lateral vertices (for left s=1 and right s=-1)
    for s in [-1, 1]:
        V[f'forehead_lat_hi_{s}'] = (s * 0.046, -0.068,  0.180)
        V[f'forehead_lat_lo_{s}'] = (s * 0.052, -0.074,  0.145)
        V[f'temple_{s}']          = (s * 0.068, -0.040,  0.140)
        
        # Eyebrows
        V[f'brow_in_{s}']         = (s * 0.016, -0.094,  0.126)
        V[f'brow_arch_{s}']       = (s * 0.040, -0.088,  0.130)
        V[f'brow_tail_{s}']       = (s * 0.062, -0.070,  0.118)
        
        # Eye socket rim
        V[f'eye_in_corner_{s}']   = (s * 0.015, -0.086,  0.106)
        V[f'eye_out_corner_{s}']  = (s * 0.054, -0.068,  0.098)
        V[f'eye_orbit_lo_{s}']    = (s * 0.035, -0.074,  0.082)
        
        # Nose facets
        V[f'nose_slope_hi_{s}']   = (s * 0.012, -0.100,  0.080)
        V[f'nose_slope_lo_{s}']   = (s * 0.014, -0.106,  0.052)
        V[f'ala_crest_{s}']       = (s * 0.022, -0.100,  0.044) # nostril top
        V[f'ala_base_{s}']        = (s * 0.024, -0.090,  0.032) # nostril bottom
        
        # Cheeks & Zygoma
        V[f'zygoma_high_{s}']     = (s * 0.070, -0.046,  0.085) # cheekbone high
        V[f'cheek_fwd_{s}']       = (s * 0.052, -0.068,  0.050) # cheek center
        V[f'cheek_hollow_{s}']    = (s * 0.058, -0.048,  0.020) # hollow under cheekbone
        
        # Mouth & Jaw
        V[f'mouth_corner_{s}']    = (s * 0.026, -0.080,  0.005)
        V[f'chin_lateral_{s}']    = (s * 0.022, -0.082, -0.040)
        V[f'jaw_crest_{s}']       = (s * 0.048, -0.060, -0.025)
        V[f'jaw_angle_{s}']       = (s * 0.064, -0.015, -0.010) # gonion
        
        # Ears & Lateral Skull
        V[f'ear_top_{s}']         = (s * 0.074, -0.005,  0.105)
        V[f'ear_helix_{s}']       = (s * 0.082,  0.008,  0.075)
        V[f'ear_lobe_{s}']        = (s * 0.072,  0.002,  0.025)
        V[f'mastoid_{s}']         = (s * 0.066,  0.025,  0.000) # behind ear
        
        # Cranium rear lateral
        V[f'parietal_hi_{s}']     = (s * 0.060,  0.025,  0.205)
        V[f'parietal_mid_{s}']    = (s * 0.072,  0.055,  0.155)
        V[f'occiput_lat_{s}']     = (s * 0.058,  0.082,  0.090)
        V[f'neck_lat_{s}']        = (s * 0.046,  0.015, -0.062)

define_head_geometry()

# Map vertices to bmesh
bm_verts = {}
for name, pos in V.items():
    bm_verts[name] = bm.verts.new(pos)

def add_face(names, mat_idx=0):
    try:
        f = bm.faces.new([bm_verts[n] for n in names])
        f.material_index = mat_idx
        return f
    except ValueError:
        return None

# Build all facial & cranial facets with matching low-poly materials:
for s in [-1, 1]:
    # Forehead (skin_highlight & mid)
    add_face(['crown_front', f'forehead_lat_hi_{s}', 'forehead_hi'], mat_map['skin_highlight']) if s==1 else add_face(['crown_front', 'forehead_hi', f'forehead_lat_hi_{s}'], mat_map['skin_highlight'])
    add_face(['forehead_hi', f'forehead_lat_hi_{s}', f'forehead_lat_lo_{s}', 'forehead_lo'], mat_map['skin_mid']) if s==1 else add_face(['forehead_hi', 'forehead_lo', f'forehead_lat_lo_{s}', f'forehead_lat_hi_{s}'], mat_map['skin_mid'])
    add_face([f'forehead_lat_hi_{s}', f'temple_{s}', f'forehead_lat_lo_{s}'], mat_map['skin_mid']) if s==1 else add_face([f'forehead_lat_hi_{s}', f'forehead_lat_lo_{s}', f'temple_{s}'], mat_map['skin_mid'])
    add_face(['forehead_lo', f'forehead_lat_lo_{s}', f'brow_tail_{s}', 'glabella'], mat_map['skin_mid']) if s==1 else add_face(['forehead_lo', 'glabella', f'brow_tail_{s}', f'forehead_lat_lo_{s}'], mat_map['skin_mid'])
    
    # Eyebrows (beard_dark/hair tone for defined angular brows)
    add_face(['glabella', f'brow_in_{s}', f'brow_arch_{s}'], mat_map['beard_dark']) if s==1 else add_face(['glabella', f'brow_arch_{s}', f'brow_in_{s}'], mat_map['beard_dark'])
    add_face(['glabella', f'brow_arch_{s}', f'brow_tail_{s}'], mat_map['beard_dark']) if s==1 else add_face(['glabella', f'brow_tail_{s}', f'brow_arch_{s}'], mat_map['beard_dark'])
    
    # Eye Orbit & Temple (skin_shadow)
    add_face(['glabella', 'sellion', f'eye_in_corner_{s}', f'brow_in_{s}'], mat_map['skin_shadow']) if s==1 else add_face(['glabella', f'brow_in_{s}', f'eye_in_corner_{s}', 'sellion'], mat_map['skin_shadow'])
    add_face([f'brow_in_{s}', f'eye_in_corner_{s}', f'eye_orbit_lo_{s}', f'brow_arch_{s}'], mat_map['skin_shadow']) if s==1 else add_face([f'brow_in_{s}', f'brow_arch_{s}', f'eye_orbit_lo_{s}', f'eye_in_corner_{s}'], mat_map['skin_shadow'])
    add_face([f'brow_arch_{s}', f'eye_orbit_lo_{s}', f'eye_out_corner_{s}', f'brow_tail_{s}'], mat_map['skin_shadow']) if s==1 else add_face([f'brow_arch_{s}', f'brow_tail_{s}', f'eye_out_corner_{s}', f'eye_orbit_lo_{s}'], mat_map['skin_shadow'])
    add_face([f'brow_tail_{s}', f'temple_{s}', f'zygoma_high_{s}', f'eye_out_corner_{s}'], mat_map['skin_mid']) if s==1 else add_face([f'brow_tail_{s}', f'eye_out_corner_{s}', f'zygoma_high_{s}', f'temple_{s}'], mat_map['skin_mid'])

    # Nose Bridge (skin_highlight & mid)
    add_face(['sellion', 'rhinion', f'nose_slope_hi_{s}', f'eye_in_corner_{s}'], mat_map['skin_highlight']) if s==1 else add_face(['sellion', f'eye_in_corner_{s}', f'nose_slope_hi_{s}', 'rhinion'], mat_map['skin_highlight'])
    add_face(['rhinion', 'supratip', f'nose_slope_lo_{s}', f'nose_slope_hi_{s}'], mat_map['skin_highlight']) if s==1 else add_face(['rhinion', f'nose_slope_hi_{s}', f'nose_slope_lo_{s}', 'supratip'], mat_map['skin_highlight'])
    add_face(['supratip', 'nasal_tip', f'ala_crest_{s}', f'nose_slope_lo_{s}'], mat_map['skin_highlight']) if s==1 else add_face(['supratip', f'nose_slope_lo_{s}', f'ala_crest_{s}', 'nasal_tip'], mat_map['skin_highlight'])
    add_face(['nasal_tip', 'infratip', 'subnasale'], mat_map['skin_shadow']) if s==1 else add_face(['nasal_tip', 'subnasale', 'infratip'], mat_map['skin_shadow'])
    add_face(['infratip', f'ala_crest_{s}', f'ala_base_{s}', 'subnasale'], mat_map['skin_shadow']) if s==1 else add_face(['infratip', 'subnasale', f'ala_base_{s}', f'ala_crest_{s}'], mat_map['skin_shadow'])

    # Cheeks & Zygomatic Arch (skin_highlight & mid)
    add_face([f'eye_in_corner_{s}', f'nose_slope_hi_{s}', f'nose_slope_lo_{s}', f'eye_orbit_lo_{s}'], mat_map['skin_mid']) if s==1 else add_face([f'eye_in_corner_{s}', f'eye_orbit_lo_{s}', f'nose_slope_lo_{s}', f'nose_slope_hi_{s}'], mat_map['skin_mid'])
    add_face([f'eye_orbit_lo_{s}', f'nose_slope_lo_{s}', f'ala_crest_{s}', f'cheek_fwd_{s}'], mat_map['skin_highlight']) if s==1 else add_face([f'eye_orbit_lo_{s}', f'cheek_fwd_{s}', f'ala_crest_{s}', f'nose_slope_lo_{s}'], mat_map['skin_highlight'])
    add_face([f'eye_orbit_lo_{s}', f'cheek_fwd_{s}', f'zygoma_high_{s}', f'eye_out_corner_{s}'], mat_map['skin_highlight']) if s==1 else add_face([f'eye_orbit_lo_{s}', f'eye_out_corner_{s}', f'zygoma_high_{s}', f'cheek_fwd_{s}'], mat_map['skin_highlight'])
    add_face([f'zygoma_high_{s}', f'ear_top_{s}', f'ear_lobe_{s}', f'cheek_hollow_{s}'], mat_map['skin_shadow']) if s==1 else add_face([f'zygoma_high_{s}', f'cheek_hollow_{s}', f'ear_lobe_{s}', f'ear_top_{s}'], mat_map['skin_shadow'])
    add_face([f'zygoma_high_{s}', f'cheek_hollow_{s}', f'cheek_fwd_{s}'], mat_map['skin_mid']) if s==1 else add_face([f'zygoma_high_{s}', f'cheek_fwd_{s}', f'cheek_hollow_{s}'], mat_map['skin_mid'])

    # Mustache (beard_dark)
    add_face(['subnasale', f'ala_base_{s}', f'mouth_corner_{s}', 'philtrum'], mat_map['beard_dark']) if s==1 else add_face(['subnasale', 'philtrum', f'mouth_corner_{s}', f'ala_base_{s}'], mat_map['beard_dark'])
    add_face(['philtrum', f'mouth_corner_{s}', 'upper_lip'], mat_map['beard_dark']) if s==1 else add_face(['philtrum', 'upper_lip', f'mouth_corner_{s}'], mat_map['beard_dark'])
    add_face(['upper_lip', f'mouth_corner_{s}', 'mouth_center'], mat_map['skin_shadow']) if s==1 else add_face(['upper_lip', 'mouth_center', f'mouth_corner_{s}'], mat_map['skin_shadow'])

    # Lips & Chin (skin_mid & beard_dark)
    add_face(['mouth_center', f'mouth_corner_{s}', 'lower_lip'], mat_map['skin_mid']) if s==1 else add_face(['mouth_center', 'lower_lip', f'mouth_corner_{s}'], mat_map['skin_mid'])
    add_face(['lower_lip', f'mouth_corner_{s}', 'chin_groove'], mat_map['skin_shadow']) if s==1 else add_face(['lower_lip', 'chin_groove', f'mouth_corner_{s}'], mat_map['skin_shadow'])
    add_face(['chin_groove', f'mouth_corner_{s}', f'chin_lateral_{s}', 'chin_apex'], mat_map['beard_dark']) if s==1 else add_face(['chin_groove', 'chin_apex', f'chin_lateral_{s}', f'mouth_corner_{s}'], mat_map['beard_dark'])
    add_face(['chin_apex', f'chin_lateral_{s}', 'chin_base'], mat_map['beard_dark']) if s==1 else add_face(['chin_apex', 'chin_base', f'chin_lateral_{s}'], mat_map['beard_dark'])

    # Boxed Jaw Beard (beard_dark along jawline)
    add_face([f'ala_base_{s}', f'cheek_fwd_{s}', f'mouth_corner_{s}'], mat_map['skin_mid']) if s==1 else add_face([f'ala_base_{s}', f'mouth_corner_{s}', f'cheek_fwd_{s}'], mat_map['skin_mid'])
    add_face([f'cheek_fwd_{s}', f'cheek_hollow_{s}', f'jaw_crest_{s}', f'mouth_corner_{s}'], mat_map['beard_dark']) if s==1 else add_face([f'cheek_fwd_{s}', f'mouth_corner_{s}', f'jaw_crest_{s}', f'cheek_hollow_{s}'], mat_map['beard_dark'])
    add_face([f'mouth_corner_{s}', f'jaw_crest_{s}', f'chin_lateral_{s}'], mat_map['beard_dark']) if s==1 else add_face([f'mouth_corner_{s}', f'chin_lateral_{s}', f'jaw_crest_{s}'], mat_map['beard_dark'])
    add_face([f'chin_lateral_{s}', f'jaw_crest_{s}', f'jaw_angle_{s}', 'chin_base'], mat_map['beard_dark']) if s==1 else add_face([f'chin_lateral_{s}', 'chin_base', f'jaw_angle_{s}', f'jaw_crest_{s}'], mat_map['beard_dark'])
    add_face([f'cheek_hollow_{s}', f'ear_lobe_{s}', f'jaw_angle_{s}'], mat_map['beard_dark']) if s==1 else add_face([f'cheek_hollow_{s}', f'jaw_angle_{s}', f'ear_lobe_{s}'], mat_map['beard_dark'])

    # Neck connection
    add_face(['chin_base', f'jaw_angle_{s}', 'neck_throat'], mat_map['skin_shadow']) if s==1 else add_face(['chin_base', 'neck_throat', f'jaw_angle_{s}'], mat_map['skin_shadow'])
    add_face([f'jaw_angle_{s}', f'neck_lat_{s}', 'neck_throat'], mat_map['skin_shadow']) if s==1 else add_face([f'jaw_angle_{s}', 'neck_throat', f'neck_lat_{s}'], mat_map['skin_shadow'])
    add_face([f'jaw_angle_{s}', f'mastoid_{s}', f'neck_lat_{s}'], mat_map['skin_shadow']) if s==1 else add_face([f'jaw_angle_{s}', f'neck_lat_{s}', f'mastoid_{s}'], mat_map['skin_shadow'])
    add_face([f'mastoid_{s}', 'neck_nape', f'neck_lat_{s}'], mat_map['skin_shadow']) if s==1 else add_face([f'mastoid_{s}', f'neck_lat_{s}', 'neck_nape'], mat_map['skin_shadow'])

    # Cranium & Back of Head (hair_base)
    add_face(['crown_front', 'crown_apex', f'parietal_hi_{s}', f'forehead_lat_hi_{s}'], mat_map['hair_base']) if s==1 else add_face(['crown_front', f'forehead_lat_hi_{s}', f'parietal_hi_{s}', 'crown_apex'], mat_map['hair_base'])
    add_face([f'forehead_lat_hi_{s}', f'parietal_hi_{s}', f'temple_{s}'], mat_map['hair_base']) if s==1 else add_face([f'forehead_lat_hi_{s}', f'temple_{s}', f'parietal_hi_{s}'], mat_map['hair_base'])
    add_face([f'temple_{s}', f'parietal_hi_{s}', f'parietal_mid_{s}', f'ear_top_{s}'], mat_map['hair_base']) if s==1 else add_face([f'temple_{s}', f'ear_top_{s}', f'parietal_mid_{s}', f'parietal_hi_{s}'], mat_map['hair_base'])
    add_face([f'ear_top_{s}', f'parietal_mid_{s}', f'mastoid_{s}'], mat_map['hair_base']) if s==1 else add_face([f'ear_top_{s}', f'mastoid_{s}', f'parietal_mid_{s}'], mat_map['hair_base'])
    add_face(['crown_apex', 'crown_rear', f'parietal_mid_{s}', f'parietal_hi_{s}'], mat_map['hair_base']) if s==1 else add_face(['crown_apex', f'parietal_hi_{s}', f'parietal_mid_{s}', 'crown_rear'], mat_map['hair_base'])
    add_face(['crown_rear', 'occiput_hi', f'occiput_lat_{s}', f'parietal_mid_{s}'], mat_map['hair_base']) if s==1 else add_face(['crown_rear', f'parietal_mid_{s}', f'occiput_lat_{s}', 'occiput_hi'], mat_map['hair_base'])
    add_face(['occiput_hi', 'occiput_mid', f'mastoid_{s}', f'occiput_lat_{s}'], mat_map['hair_base']) if s==1 else add_face(['occiput_hi', f'occiput_lat_{s}', f'mastoid_{s}', 'occiput_mid'], mat_map['hair_base'])
    add_face(['occiput_mid', 'occiput_lo', 'neck_nape', f'mastoid_{s}'], mat_map['hair_base']) if s==1 else add_face(['occiput_mid', f'mastoid_{s}', 'neck_nape', 'occiput_lo'], mat_map['hair_base'])

# Finalize BM
bm.normal_update()
head_mesh = bpy.data.meshes.new("TargetLowPolyHeadUnified")
bm.to_mesh(head_mesh)
bm.free()

for poly in head_mesh.polygons:
    poly.use_smooth = False

for m_key in ['skin_mid', 'skin_highlight', 'skin_shadow', 'beard_dark', 'hair_base']:
    head_mesh.materials.append(MATS[m_key])

head_obj = bpy.data.objects.new("TargetLowPolyHeadUnified", head_mesh)
scene.collection.objects.link(head_obj)
head_obj.parent = head

print("Unified Low-Poly Head created successfully!")

# -------------------------------------------------------------
# 2. Almond Eyes with Amber Iris & Pupil
# -------------------------------------------------------------
for s in [-1, 1]:
    # Sclera
    sclera_pts = [
        (s * 0.020, -0.084, 0.104), # inner corner
        (s * 0.035, -0.080, 0.108), # top rim
        (s * 0.050, -0.072, 0.100), # outer corner
        (s * 0.035, -0.078, 0.096), # bottom rim
    ]
    create_poly_mesh(f"TargetEyeSclera_{s}", sclera_pts, [(0, 1, 2, 3)], ['sclera_white'], parent=head)
    
    # Amber Iris & Pupil
    iris_pts = [
        (s * 0.031, -0.082, 0.104),
        (s * 0.036, -0.081, 0.106),
        (s * 0.040, -0.078, 0.102),
        (s * 0.035, -0.080, 0.099),
    ]
    create_poly_mesh(f"TargetEyeIris_{s}", iris_pts, [(0, 1, 2, 3)], ['iris_amber'], parent=head)
    
    pupil_pts = [
        (s * 0.033, -0.083, 0.103),
        (s * 0.036, -0.082, 0.104),
        (s * 0.038, -0.080, 0.102),
        (s * 0.035, -0.081, 0.101),
    ]
    create_poly_mesh(f"TargetEyePupil_{s}", pupil_pts, [(0, 1, 2, 3)], ['pupil_black'], parent=head)

# -------------------------------------------------------------
# 3. Wavy Hair Volume, Center Parting & Bun (Round 2)
# -------------------------------------------------------------
# Crown wavy bangs and temporal volume
bangs_verts = [
    # Center-parted wavy bangs framing forehead
    (0.000, -0.065, 0.190),
    (-0.025, -0.085, 0.165),
    (0.025, -0.085, 0.165),
    (-0.045, -0.090, 0.145), # arching wave
    (0.045, -0.090, 0.145),
    (-0.065, -0.075, 0.125), # side lock root
    (0.065, -0.075, 0.125),
    (-0.070, -0.055, 0.095), # ear cover wave
    (0.070, -0.055, 0.095),
]
bangs_faces = [
    (0, 1, 3), (0, 4, 2),
    (1, 5, 3), (2, 4, 6),
    (3, 7, 5), (4, 6, 8)
]
create_poly_mesh("TargetLowPolyBangs", bangs_verts, bangs_faces, ['hair_base'], parent=head)

# Half-up bun at upper-back
bun_verts = [
    (0.000,  0.080, 0.170),
    (-0.028, 0.095, 0.185),
    (0.028,  0.095, 0.185),
    (-0.035, 0.125, 0.170),
    (0.035,  0.125, 0.170),
    (-0.025, 0.115, 0.145),
    (0.025,  0.115, 0.145),
    (0.000,  0.135, 0.160),
]
bun_faces = [
    (0, 1, 3, 5), (0, 6, 4, 2),
    (1, 2, 4, 3), (5, 3, 7, 6),
    (6, 7, 4, 2)
]
create_poly_mesh("TargetLowPolyBun", bun_verts, bun_faces, ['hair_base'], parent=head)

# -------------------------------------------------------------
# 4. Rich Draped Cowl Collar, Teal Lining & Brooch (Round 2)
# -------------------------------------------------------------
# Draped wine-red cloak cowl
cowl_outer_verts = [
    # Upper fold rim
    (0.000, -0.115, -0.055),
    (-0.080, -0.095, -0.040),
    (0.080, -0.095, -0.040),
    (-0.115, -0.035, -0.045),
    (0.115, -0.035, -0.045),
    (-0.100,  0.060, -0.055),
    (0.100,  0.060, -0.055),
    (0.000,  0.080, -0.065),
    # Lower drape rim
    (0.000, -0.135, -0.115),
    (-0.105, -0.115, -0.100),
    (0.105, -0.115, -0.100),
    (-0.145, -0.040, -0.105),
    (0.145, -0.040, -0.105),
    (-0.125,  0.075, -0.110),
    (0.125,  0.075, -0.110),
    (0.000,  0.095, -0.120),
]
cowl_outer_faces = [
    (0, 1, 9, 8), (0, 8, 10, 2),
    (1, 3, 11, 9), (2, 10, 12, 4),
    (3, 5, 13, 11), (4, 12, 14, 6),
    (5, 7, 15, 13), (6, 14, 15, 7),
]
create_poly_mesh("TargetLowPolyCowlOuter", cowl_outer_verts, cowl_outer_faces, ['cape_wine'], parent=head)

# Teal inner lining fold
cowl_inner_verts = [
    (0.000, -0.108, -0.050),
    (-0.070, -0.090, -0.038),
    (0.070, -0.090, -0.038),
    (0.000, -0.118, -0.055),
    (-0.080, -0.095, -0.040),
    (0.080, -0.095, -0.040),
]
cowl_inner_faces = [(0, 1, 4, 3), (0, 3, 5, 2)]
create_poly_mesh("TargetLowPolyCowlInner", cowl_inner_verts, cowl_inner_faces, ['tunic_teal'], parent=head)

# Ivory shirt V-neck
shirt_verts = [
    (0.000, -0.085, -0.040),
    (-0.042, -0.070, -0.035),
    (0.042, -0.070, -0.035),
    (0.000, -0.105, -0.090),
]
shirt_faces = [(0, 1, 3), (0, 3, 2)]
create_poly_mesh("TargetLowPolyShirtV", shirt_verts, shirt_faces, ['shirt_ivory'], parent=head)

# Antique Gold Diamond Brooch on right shoulder
clasp_verts = [
    (-0.088, -0.098, -0.035), # top
    (-0.110, -0.092, -0.052), # left
    (-0.066, -0.092, -0.052), # right
    (-0.088, -0.086, -0.070), # bottom
    (-0.088, -0.108, -0.052), # raised diamond apex
]
clasp_faces = [
    (0, 1, 4), (0, 4, 2),
    (1, 3, 4), (2, 4, 3)
]
create_poly_mesh("TargetLowPolyBrooch", clasp_verts, clasp_faces, ['clasp_gold'], parent=head)

# Save Round 2 blend
round2_blend = BASE / 'assets/models/optimized/human-courier-production-v2/head-round2/courier.blend'
round2_blend.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(round2_blend))
print(f"Saved Round 2 blend to {round2_blend}")
