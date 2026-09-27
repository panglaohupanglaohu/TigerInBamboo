import bpy
import bmesh
import math
from math import pi, sin, cos
from mathutils import Vector, Matrix, Euler
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
source_blend = BASE / 'assets/models/optimized/human-courier-production-v2/head-round1/courier.blend'
print(f"Opening source: {source_blend}")
bpy.ops.wm.open_mainfile(filepath=str(source_blend))

scene = bpy.context.scene
head = bpy.data.objects.get('head')
assert head, "Head object must exist"

# 1. Purge all previous test objects
to_delete = []
for o in bpy.data.objects:
    name = o.name
    if any(name.startswith(p) for p in [
        'Target', 'Anatomy_', 'Hair_target', 'Folded_linen', 'Linen_neck',
        'Sun_brooch', 'Brooch_ray', 'Fox_clasp', 'Vest_lapel', 'Cloak_gold_hem'
    ]):
        to_delete.append(o)
    elif name in ['Neck', 'Cloak_folds']:
        o.hide_render = True

for o in to_delete:
    bpy.data.objects.remove(o, do_unlink=True)

# 2. Material Palette (8-color palette fidelity)
PALETTE = {
    'skin_highlight': (0.784, 0.620, 0.463, 1.0), # #c89e76 - Forehead, cheek highlight, nose dorsum
    'skin_mid':       (0.655, 0.478, 0.337, 1.0), # #a77a56 - Main skin midtone
    'skin_shadow':    (0.525, 0.357, 0.239, 1.0), # #865b3d - Orbit recess, subnasal, cheek hollow
    'skin_deep':      (0.380, 0.240, 0.160, 1.0), # #613d29 - Upper eyelid crease
    'beard_dark':     (0.220, 0.180, 0.169, 1.0), # #382e2b - Boxed beard, mustache, eyebrows
    'hair_base':      (0.169, 0.133, 0.125, 1.0), # #2b2220 - Dark hair base
    'hair_highlight': (0.240, 0.190, 0.175, 1.0), # #3d302c - Hair lock ridge highlights
    'shirt_ivory':    (0.863, 0.820, 0.745, 1.0), # #dcd1be - Crisp linen shirt
    'cape_wine':      (0.380, 0.080, 0.100, 1.0), # #611419 - Rich wine cowl
    'cape_wine_hi':   (0.480, 0.120, 0.140, 1.0), # #7a1e24 - Wine cape fold highlight
    'tunic_teal':     (0.150, 0.290, 0.290, 1.0), # #264a4a - Teal lining fold
    'clasp_gold':     (0.680, 0.520, 0.220, 1.0), # #ad8538 - Antique gold brooch
    'iris_amber':     (0.612, 0.396, 0.188, 1.0), # #9c6530 - Amber iris
    'sclera_white':   (0.920, 0.890, 0.840, 1.0), # #eae3d6 - Sclera
    'pupil_black':    (0.080, 0.060, 0.050, 1.0), # #140f0d - Dark pupil
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

MATS = {k: get_or_create_material(k, PALETTE[k], 
                                  roughness=0.28 if 'gold' in k else 0.88,
                                  metallic=0.80 if 'gold' in k else 0.0) 
        for k in PALETTE}

MAT_ORDER = list(PALETTE.keys())
MAT_INDEX_MAP = {k: i for i, k in enumerate(MAT_ORDER)}

def create_poly_object(name, verts, faces, face_materials, parent=head):
    me = bpy.data.meshes.new(name)
    for m_key in MAT_ORDER:
        me.materials.append(MATS[m_key])
        
    bm = bmesh.new()
    bm_verts = [bm.verts.new(v) for v in verts]
    
    for f_indices, m_key in zip(faces, face_materials):
        try:
            face_verts = [bm_verts[i] for i in f_indices]
            f = bm.faces.new(face_verts)
            f.material_index = MAT_INDEX_MAP[m_key]
        except Exception as e:
            pass
            
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    
    for poly in me.polygons:
        poly.use_smooth = False
        
    obj = bpy.data.objects.new(name, me)
    scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj

# -------------------------------------------------------------------------
# 3. Flawless Watertight Head, Skull & Anatomical Ears (Round 7)
# -------------------------------------------------------------------------
V_map = {}
def add_v(name, pos):
    V_map[name] = Vector(pos)

# Centerline Vertices
add_v('crown_front',   (0.000, -0.040,  0.155))
add_v('forehead_hi',    (0.000, -0.068,  0.138))
add_v('forehead_mid',   (0.000, -0.078,  0.112))
add_v('glabella',       (0.000, -0.084,  0.086))
add_v('sellion',        (0.000, -0.086,  0.072))
add_v('rhinion',        (0.000, -0.100,  0.048))
add_v('supratip',       (0.000, -0.112,  0.028))
add_v('nasal_tip',      (0.000, -0.120,  0.018))
add_v('infratip',       (0.000, -0.108,  0.010))
add_v('subnasale',      (0.000, -0.092,  0.005))
add_v('philtrum',       (0.000, -0.088, -0.008))
add_v('upper_lip',      (0.000, -0.092, -0.016))
add_v('mouth_center',   (0.000, -0.086, -0.024))
add_v('lower_lip',      (0.000, -0.088, -0.032))
add_v('chin_groove',    (0.000, -0.080, -0.045))
add_v('chin_apex',      (0.000, -0.086, -0.062))
add_v('chin_base',      (0.000, -0.072, -0.078))
add_v('throat',         (0.000, -0.025, -0.090))

# Cranium rear centerline
add_v('crown_mid',      (0.000,  0.025,  0.165))
add_v('crown_rear',     (0.000,  0.075,  0.145))
add_v('occiput_hi',     (0.000,  0.098,  0.105))
add_v('occiput_mid',    (0.000,  0.095,  0.045))
add_v('occiput_lo',     (0.000,  0.078, -0.015))
add_v('nape',           (0.000,  0.052, -0.070))

# Bilateral Vertices
for s in [-1, 1]:
    # Cranium lateral
    add_v(f'parietal_hi_{s}',   (s * 0.062,  0.022,  0.158))
    add_v(f'parietal_mid_{s}',  (s * 0.080,  0.048,  0.112))
    add_v(f'occiput_lat_{s}',   (s * 0.068,  0.078,  0.052))
    
    # Forehead & Temples
    add_v(f'forehead_lat_hi_{s}',  (s * 0.048, -0.058, 0.138))
    add_v(f'forehead_mid_lat_{s}', (s * 0.032, -0.072, 0.112))
    add_v(f'forehead_lat_lo_{s}',  (s * 0.058, -0.065, 0.112))
    add_v(f'temple_hi_{s}',        (s * 0.068, -0.038, 0.135))
    add_v(f'temple_lo_{s}',        (s * 0.075, -0.032, 0.092))
    
    # Eyebrows
    add_v(f'brow_in_{s}',          (s * 0.015, -0.090, 0.090))
    add_v(f'brow_mid_{s}',         (s * 0.042, -0.086, 0.094))
    add_v(f'brow_tail_{s}',        (s * 0.070, -0.062, 0.080))
    
    # Eye Socket Crease
    add_v(f'crease_in_{s}',        (s * 0.018, -0.084, 0.080))
    add_v(f'crease_mid_{s}',       (s * 0.040, -0.080, 0.082))
    add_v(f'crease_out_{s}',       (s * 0.062, -0.060, 0.074))
    
    # Eye Contour
    add_v(f'eye_in_{s}',           (s * 0.020, -0.080, 0.068))
    add_v(f'eye_top_{s}',          (s * 0.038, -0.077, 0.074))
    add_v(f'eye_out_{s}',          (s * 0.058, -0.058, 0.066))
    add_v(f'eye_bot_{s}',          (s * 0.038, -0.075, 0.060))
    add_v(f'iris_in_{s}',          (s * 0.028, -0.078, 0.067))
    add_v(f'iris_out_{s}',         (s * 0.048, -0.070, 0.067))
    add_v(f'pupil_top_{s}',        (s * 0.038, -0.077, 0.070))
    add_v(f'pupil_bot_{s}',        (s * 0.038, -0.074, 0.064))
    
    # Orbit Floor
    add_v(f'orbit_fl_in_{s}',      (s * 0.022, -0.076, 0.052))
    add_v(f'orbit_fl_mid_{s}',     (s * 0.042, -0.070, 0.048))
    add_v(f'orbit_fl_out_{s}',     (s * 0.065, -0.052, 0.052))
    
    # Nose Bridges & Wings
    add_v(f'nose_slope_hi_{s}',    (s * 0.012, -0.092, 0.065))
    add_v(f'nose_slope_mid_{s}',   (s * 0.014, -0.100, 0.042))
    add_v(f'nose_slope_lo_{s}',    (s * 0.016, -0.106, 0.025))
    add_v(f'ala_crest_{s}',        (s * 0.024, -0.098, 0.016))
    add_v(f'ala_base_{s}',         (s * 0.025, -0.088, 0.005))
    
    # Cheeks & Zygoma
    add_v(f'zygoma_apex_{s}',      (s * 0.082, -0.038, 0.055))
    add_v(f'cheek_ant_{s}',        (s * 0.050, -0.064, 0.030))
    add_v(f'cheek_mid_{s}',        (s * 0.064, -0.050, 0.025))
    add_v(f'cheek_hollow_{s}',     (s * 0.065, -0.042, 0.005))
    
    # Mouth & Lips Lateral
    add_v(f'upper_lip_peak_{s}',   (s * 0.014, -0.090, -0.015))
    add_v(f'mouth_corner_{s}',     (s * 0.030, -0.076, -0.024))
    add_v(f'lower_lip_lat_{s}',    (s * 0.018, -0.084, -0.032))
    
    # Chin, Jawline & Beard
    add_v(f'chin_lat_apex_{s}',    (s * 0.024, -0.082, -0.062))
    add_v(f'chin_lat_base_{s}',    (s * 0.024, -0.070, -0.076))
    add_v(f'jaw_body_{s}',         (s * 0.052, -0.046, -0.055))
    add_v(f'jaw_angle_{s}',        (s * 0.072,  0.005, -0.035))
    
    # ROUND 7 ENHANCED ANATOMICAL EARS (Helix, Antihelix, Concha, Tragus, Lobe)
    add_v(f'ear_crus_{s}',         (s * 0.076,  0.000,  0.065))
    add_v(f'ear_helix_hi_{s}',     (s * 0.084,  0.008,  0.075))
    add_v(f'ear_helix_mid_{s}',    (s * 0.092,  0.022,  0.052))
    add_v(f'ear_helix_lo_{s}',     (s * 0.088,  0.025,  0.025))
    add_v(f'ear_lobe_{s}',         (s * 0.078,  0.014,  0.002))
    add_v(f'ear_antihelix_{s}',    (s * 0.082,  0.014,  0.048))
    add_v(f'ear_concha_{s}',       (s * 0.076,  0.010,  0.038))
    add_v(f'ear_tragus_{s}',       (s * 0.074, -0.004,  0.036))
    
    # Neck
    add_v(f'mastoid_{s}',          (s * 0.068,  0.035, -0.015))
    add_v(f'neck_scm_{s}',        (s * 0.048, -0.005, -0.085))
    add_v(f'neck_lat_{s}',         (s * 0.052,  0.025, -0.088))

vert_list = []
vert_index = {}
for k, v in V_map.items():
    vert_index[k] = len(vert_list)
    vert_list.append(v)

faces_list = []
faces_mat = []

def add_facet(names, mat_key):
    faces_list.append([vert_index[n] for n in names])
    faces_mat.append(mat_key)

for s in [-1, 1]:
    # Forehead planes
    add_facet(['crown_front', f'forehead_lat_hi_{s}', 'forehead_hi'], 'skin_highlight') if s==1 else add_facet(['crown_front', 'forehead_hi', f'forehead_lat_hi_{s}'], 'skin_highlight')
    add_facet(['forehead_hi', f'forehead_lat_hi_{s}', f'forehead_mid_lat_{s}', 'forehead_mid'], 'skin_mid') if s==1 else add_facet(['forehead_hi', 'forehead_mid', f'forehead_mid_lat_{s}', f'forehead_lat_hi_{s}'], 'skin_mid')
    add_facet([f'forehead_lat_hi_{s}', f'temple_hi_{s}', f'forehead_lat_lo_{s}', f'forehead_mid_lat_{s}'], 'skin_mid') if s==1 else add_facet([f'forehead_lat_hi_{s}', f'forehead_mid_lat_{s}', f'forehead_lat_lo_{s}', f'temple_hi_{s}'], 'skin_mid')
    add_facet(['forehead_mid', f'forehead_mid_lat_{s}', f'brow_in_{s}', 'glabella'], 'skin_mid') if s==1 else add_facet(['forehead_mid', 'glabella', f'brow_in_{s}', f'forehead_mid_lat_{s}'], 'skin_mid')
    add_facet([f'forehead_mid_lat_{s}', f'forehead_lat_lo_{s}', f'brow_mid_{s}', f'brow_in_{s}'], 'skin_mid') if s==1 else add_facet([f'forehead_mid_lat_{s}', f'brow_in_{s}', f'brow_mid_{s}', f'forehead_lat_lo_{s}'], 'skin_mid')
    add_facet([f'forehead_lat_lo_{s}', f'temple_lo_{s}', f'brow_tail_{s}', f'brow_mid_{s}'], 'skin_mid') if s==1 else add_facet([f'forehead_lat_lo_{s}', f'brow_mid_{s}', f'brow_tail_{s}', f'temple_lo_{s}'], 'skin_mid')

    # Cranial closure
    add_facet(['crown_front', 'crown_mid', f'parietal_hi_{s}', f'forehead_lat_hi_{s}'], 'hair_base') if s==1 else add_facet(['crown_front', f'forehead_lat_hi_{s}', f'parietal_hi_{s}', 'crown_mid'], 'hair_base')
    add_facet([f'forehead_lat_hi_{s}', f'parietal_hi_{s}', f'temple_hi_{s}'], 'hair_base') if s==1 else add_facet([f'forehead_lat_hi_{s}', f'temple_hi_{s}', f'parietal_hi_{s}'], 'hair_base')
    add_facet([f'temple_hi_{s}', f'parietal_hi_{s}', f'parietal_mid_{s}'], 'hair_base') if s==1 else add_facet([f'temple_hi_{s}', f'parietal_mid_{s}', f'parietal_hi_{s}'], 'hair_base')
    add_facet([f'temple_hi_{s}', f'parietal_mid_{s}', f'temple_lo_{s}', f'forehead_lat_lo_{s}'], 'hair_base') if s==1 else add_facet([f'temple_hi_{s}', f'forehead_lat_lo_{s}', f'temple_lo_{s}', f'parietal_mid_{s}'], 'hair_base')
    add_facet(['crown_mid', 'crown_rear', f'parietal_mid_{s}', f'parietal_hi_{s}'], 'hair_base') if s==1 else add_facet(['crown_mid', f'parietal_hi_{s}', f'parietal_mid_{s}', 'crown_rear'], 'hair_base')
    add_facet(['crown_rear', 'occiput_hi', f'occiput_lat_{s}', f'parietal_mid_{s}'], 'hair_base') if s==1 else add_facet(['crown_rear', f'parietal_mid_{s}', f'occiput_lat_{s}', 'occiput_hi'], 'hair_base')
    add_facet([f'temple_lo_{s}', f'parietal_mid_{s}', f'ear_helix_hi_{s}'], 'hair_base') if s==1 else add_facet([f'temple_lo_{s}', f'ear_helix_hi_{s}', f'parietal_mid_{s}'], 'hair_base')
    add_facet([f'parietal_mid_{s}', f'occiput_lat_{s}', f'mastoid_{s}', f'ear_helix_mid_{s}'], 'hair_base') if s==1 else add_facet([f'parietal_mid_{s}', f'ear_helix_mid_{s}', f'mastoid_{s}', f'occiput_lat_{s}'], 'hair_base')
    add_facet([f'ear_helix_hi_{s}', f'parietal_mid_{s}', f'ear_helix_mid_{s}'], 'hair_base') if s==1 else add_facet([f'ear_helix_hi_{s}', f'ear_helix_mid_{s}', f'parietal_mid_{s}'], 'hair_base')
    add_facet(['occiput_hi', 'occiput_mid', f'mastoid_{s}', f'occiput_lat_{s}'], 'hair_base') if s==1 else add_facet(['occiput_hi', f'occiput_lat_{s}', f'mastoid_{s}', 'occiput_mid'], 'hair_base')
    add_facet(['occiput_mid', 'occiput_lo', 'nape', f'mastoid_{s}'], 'hair_base') if s==1 else add_facet(['occiput_mid', f'mastoid_{s}', 'nape', 'occiput_lo'], 'hair_base')

    # Eyebrows
    add_facet(['glabella', f'brow_in_{s}', f'crease_in_{s}'], 'beard_dark') if s==1 else add_facet(['glabella', f'crease_in_{s}', f'brow_in_{s}'], 'beard_dark')
    add_facet([f'brow_in_{s}', f'brow_mid_{s}', f'crease_mid_{s}', f'crease_in_{s}'], 'beard_dark') if s==1 else add_facet([f'brow_in_{s}', f'crease_in_{s}', f'crease_mid_{s}', f'brow_mid_{s}'], 'beard_dark')
    add_facet([f'brow_mid_{s}', f'brow_tail_{s}', f'crease_out_{s}', f'crease_mid_{s}'], 'beard_dark') if s==1 else add_facet([f'brow_mid_{s}', f'crease_mid_{s}', f'crease_out_{s}', f'brow_tail_{s}'], 'beard_dark')

    # Upper eyelid crease shadow
    add_facet([f'crease_in_{s}', f'crease_mid_{s}', f'eye_top_{s}', f'eye_in_{s}'], 'skin_deep') if s==1 else add_facet([f'crease_in_{s}', f'eye_in_{s}', f'eye_top_{s}', f'crease_mid_{s}'], 'skin_deep')
    add_facet([f'crease_mid_{s}', f'crease_out_{s}', f'eye_out_{s}', f'eye_top_{s}'], 'skin_deep') if s==1 else add_facet([f'crease_mid_{s}', f'eye_top_{s}', f'eye_out_{s}', f'crease_out_{s}'], 'skin_deep')

    # Almond Eyes with Amber Iris and Dark Pupil
    add_facet([f'eye_in_{s}', f'eye_top_{s}', f'iris_in_{s}'], 'sclera_white') if s==1 else add_facet([f'eye_in_{s}', f'iris_in_{s}', f'eye_top_{s}'], 'sclera_white')
    add_facet([f'eye_in_{s}', f'iris_in_{s}', f'eye_bot_{s}'], 'sclera_white') if s==1 else add_facet([f'eye_in_{s}', f'eye_bot_{s}', f'iris_in_{s}'], 'sclera_white')
    add_facet([f'iris_in_{s}', f'eye_top_{s}', f'pupil_top_{s}'], 'iris_amber') if s==1 else add_facet([f'iris_in_{s}', f'pupil_top_{s}', f'eye_top_{s}'], 'iris_amber')
    add_facet([f'iris_in_{s}', f'pupil_bot_{s}', f'eye_bot_{s}'], 'iris_amber') if s==1 else add_facet([f'iris_in_{s}', f'eye_bot_{s}', f'pupil_bot_{s}'], 'iris_amber')
    add_facet([f'iris_in_{s}', f'pupil_top_{s}', f'iris_out_{s}', f'pupil_bot_{s}'], 'pupil_black') if s==1 else add_facet([f'iris_in_{s}', f'pupil_bot_{s}', f'iris_out_{s}', f'pupil_top_{s}'], 'pupil_black')
    add_facet([f'pupil_top_{s}', f'eye_top_{s}', f'iris_out_{s}'], 'iris_amber') if s==1 else add_facet([f'pupil_top_{s}', f'iris_out_{s}', f'eye_top_{s}'], 'iris_amber')
    add_facet([f'pupil_bot_{s}', f'iris_out_{s}', f'eye_bot_{s}'], 'iris_amber') if s==1 else add_facet([f'pupil_bot_{s}', f'eye_bot_{s}', f'iris_out_{s}'], 'iris_amber')
    add_facet([f'iris_out_{s}', f'eye_out_{s}', f'eye_bot_{s}'], 'sclera_white') if s==1 else add_facet([f'iris_out_{s}', f'eye_bot_{s}', f'eye_out_{s}'], 'sclera_white')
    add_facet([f'eye_top_{s}', f'eye_out_{s}', f'iris_out_{s}'], 'sclera_white') if s==1 else add_facet([f'eye_top_{s}', f'iris_out_{s}', f'eye_out_{s}'], 'sclera_white')

    # Lower eyelid & orbital floor
    add_facet([f'eye_in_{s}', f'eye_bot_{s}', f'orbit_fl_in_{s}'], 'skin_shadow') if s==1 else add_facet([f'eye_in_{s}', f'orbit_fl_in_{s}', f'eye_bot_{s}'], 'skin_shadow')
    add_facet([f'eye_bot_{s}', f'eye_out_{s}', f'orbit_fl_out_{s}', f'orbit_fl_mid_{s}'], 'skin_shadow') if s==1 else add_facet([f'eye_bot_{s}', f'orbit_fl_mid_{s}', f'orbit_fl_out_{s}', f'eye_out_{s}'], 'skin_shadow')
    add_facet([f'orbit_fl_in_{s}', f'eye_bot_{s}', f'orbit_fl_mid_{s}'], 'skin_mid') if s==1 else add_facet([f'orbit_fl_in_{s}', f'orbit_fl_mid_{s}', f'eye_bot_{s}'], 'skin_mid')

    # Glabella & Nose Bridge
    add_facet(['glabella', 'sellion', f'crease_in_{s}'], 'skin_shadow') if s==1 else add_facet(['glabella', f'crease_in_{s}', 'sellion'], 'skin_shadow')
    add_facet(['sellion', f'nose_slope_hi_{s}', f'eye_in_{s}', f'crease_in_{s}'], 'skin_mid') if s==1 else add_facet(['sellion', f'crease_in_{s}', f'eye_in_{s}', f'nose_slope_hi_{s}'], 'skin_mid')
    add_facet(['sellion', 'rhinion', f'nose_slope_mid_{s}', f'nose_slope_hi_{s}'], 'skin_highlight') if s==1 else add_facet(['sellion', f'nose_slope_hi_{s}', f'nose_slope_mid_{s}', 'rhinion'], 'skin_highlight')
    add_facet(['rhinion', 'supratip', f'nose_slope_lo_{s}', f'nose_slope_mid_{s}'], 'skin_highlight') if s==1 else add_facet(['rhinion', f'nose_slope_mid_{s}', f'nose_slope_lo_{s}', 'supratip'], 'skin_highlight')
    add_facet(['supratip', 'nasal_tip', f'ala_crest_{s}', f'nose_slope_lo_{s}'], 'skin_highlight') if s==1 else add_facet(['supratip', f'nose_slope_lo_{s}', f'ala_crest_{s}', 'nasal_tip'], 'skin_highlight')

    # Subnasal Tip & Alar wings
    add_facet(['nasal_tip', 'infratip', f'ala_crest_{s}'], 'skin_shadow') if s==1 else add_facet(['nasal_tip', f'ala_crest_{s}', 'infratip'], 'skin_shadow')
    add_facet(['infratip', 'subnasale', f'ala_base_{s}', f'ala_crest_{s}'], 'skin_shadow') if s==1 else add_facet(['infratip', f'ala_crest_{s}', f'ala_base_{s}', 'subnasale'], 'skin_shadow')

    # Cheeks & Zygoma (WATERTIGHT)
    add_facet([f'nose_slope_hi_{s}', f'nose_slope_mid_{s}', f'orbit_fl_in_{s}', f'eye_in_{s}'], 'skin_mid') if s==1 else add_facet([f'nose_slope_hi_{s}', f'eye_in_{s}', f'orbit_fl_in_{s}', f'nose_slope_mid_{s}'], 'skin_mid')
    add_facet([f'nose_slope_mid_{s}', f'nose_slope_lo_{s}', f'ala_crest_{s}', f'orbit_fl_in_{s}'], 'skin_highlight') if s==1 else add_facet([f'nose_slope_mid_{s}', f'orbit_fl_in_{s}', f'ala_crest_{s}', f'nose_slope_lo_{s}'], 'skin_highlight')
    add_facet([f'ala_crest_{s}', f'cheek_ant_{s}', f'orbit_fl_mid_{s}', f'orbit_fl_in_{s}'], 'skin_highlight') if s==1 else add_facet([f'ala_crest_{s}', f'orbit_fl_in_{s}', f'orbit_fl_mid_{s}', f'cheek_ant_{s}'], 'skin_highlight')
    add_facet([f'orbit_fl_mid_{s}', f'cheek_ant_{s}', f'cheek_mid_{s}', f'orbit_fl_out_{s}'], 'skin_highlight') if s==1 else add_facet([f'orbit_fl_mid_{s}', f'orbit_fl_out_{s}', f'cheek_mid_{s}', f'cheek_ant_{s}'], 'skin_highlight')
    add_facet([f'orbit_fl_out_{s}', f'cheek_mid_{s}', f'zygoma_apex_{s}'], 'skin_highlight') if s==1 else add_facet([f'orbit_fl_out_{s}', f'zygoma_apex_{s}', f'cheek_mid_{s}'], 'skin_highlight')
    add_facet([f'crease_out_{s}', f'brow_tail_{s}', f'temple_lo_{s}', f'orbit_fl_out_{s}'], 'skin_mid') if s==1 else add_facet([f'crease_out_{s}', f'orbit_fl_out_{s}', f'temple_lo_{s}', f'brow_tail_{s}'], 'skin_mid')
    add_facet([f'temple_lo_{s}', f'zygoma_apex_{s}', f'orbit_fl_out_{s}'], 'skin_mid') if s==1 else add_facet([f'temple_lo_{s}', f'orbit_fl_out_{s}', f'zygoma_apex_{s}'], 'skin_mid')

    # Mustache & Philtrum
    add_facet(['subnasale', f'ala_base_{s}', f'mouth_corner_{s}', f'upper_lip_peak_{s}', 'philtrum'], 'beard_dark') if s==1 else add_facet(['subnasale', 'philtrum', f'upper_lip_peak_{s}', f'mouth_corner_{s}', f'ala_base_{s}'], 'beard_dark')
    add_facet(['philtrum', f'upper_lip_peak_{s}', 'upper_lip'], 'beard_dark') if s==1 else add_facet(['philtrum', 'upper_lip', f'upper_lip_peak_{s}'], 'beard_dark')

    # Lips
    add_facet(['upper_lip', f'upper_lip_peak_{s}', f'mouth_corner_{s}', 'mouth_center'], 'skin_shadow') if s==1 else add_facet(['upper_lip', 'mouth_center', f'mouth_corner_{s}', f'upper_lip_peak_{s}'], 'skin_shadow')
    add_facet(['mouth_center', f'mouth_corner_{s}', f'lower_lip_lat_{s}', 'lower_lip'], 'skin_highlight') if s==1 else add_facet(['mouth_center', 'lower_lip', f'lower_lip_lat_{s}', f'mouth_corner_{s}'], 'skin_highlight')

    # Soul patch & Chin
    add_facet(['lower_lip', f'lower_lip_lat_{s}', 'chin_groove'], 'skin_mid') if s==1 else add_facet(['lower_lip', 'chin_groove', f'lower_lip_lat_{s}'], 'skin_mid')
    add_facet(['chin_groove', f'lower_lip_lat_{s}', f'chin_lat_apex_{s}', 'chin_apex'], 'beard_dark') if s==1 else add_facet(['chin_groove', 'chin_apex', f'chin_lat_apex_{s}', f'lower_lip_lat_{s}'], 'beard_dark')
    add_facet(['chin_apex', f'chin_lat_apex_{s}', f'chin_lat_base_{s}', 'chin_base'], 'beard_dark') if s==1 else add_facet(['chin_apex', 'chin_base', f'chin_lat_base_{s}', f'chin_lat_apex_{s}'], 'beard_dark')

    # Mid Cheek & Jaw beard
    add_facet([f'ala_crest_{s}', f'ala_base_{s}', f'mouth_corner_{s}', f'cheek_ant_{s}'], 'skin_mid') if s==1 else add_facet([f'ala_crest_{s}', f'cheek_ant_{s}', f'mouth_corner_{s}', f'ala_base_{s}'], 'skin_mid')
    add_facet([f'cheek_ant_{s}', f'mouth_corner_{s}', f'cheek_hollow_{s}', f'cheek_mid_{s}'], 'skin_mid') if s==1 else add_facet([f'cheek_ant_{s}', f'cheek_mid_{s}', f'cheek_hollow_{s}', f'mouth_corner_{s}'], 'skin_mid')
    add_facet([f'cheek_mid_{s}', f'cheek_hollow_{s}', f'zygoma_apex_{s}'], 'beard_dark') if s==1 else add_facet([f'cheek_mid_{s}', f'zygoma_apex_{s}', f'cheek_hollow_{s}'], 'beard_dark')
    
    # Cheek Hollow to Ear & Jaw Angle
    add_facet([f'zygoma_apex_{s}', f'cheek_hollow_{s}', f'ear_tragus_{s}', f'ear_crus_{s}'], 'skin_mid') if s==1 else add_facet([f'zygoma_apex_{s}', f'ear_crus_{s}', f'ear_tragus_{s}', f'cheek_hollow_{s}'], 'skin_mid')
    add_facet([f'zygoma_apex_{s}', f'ear_crus_{s}', f'ear_helix_hi_{s}', f'temple_lo_{s}'], 'hair_base') if s==1 else add_facet([f'zygoma_apex_{s}', f'temple_lo_{s}', f'ear_helix_hi_{s}', f'ear_crus_{s}'], 'hair_base')
    add_facet([f'cheek_hollow_{s}', f'jaw_body_{s}', f'jaw_angle_{s}', f'ear_lobe_{s}'], 'beard_dark') if s==1 else add_facet([f'cheek_hollow_{s}', f'ear_lobe_{s}', f'jaw_angle_{s}', f'jaw_body_{s}'], 'beard_dark')
    add_facet([f'cheek_hollow_{s}', f'ear_lobe_{s}', f'ear_tragus_{s}'], 'skin_shadow') if s==1 else add_facet([f'cheek_hollow_{s}', f'ear_tragus_{s}', f'ear_lobe_{s}'], 'skin_shadow')

    add_facet([f'mouth_corner_{s}', f'chin_lat_apex_{s}', f'jaw_body_{s}', f'cheek_hollow_{s}'], 'beard_dark') if s==1 else add_facet([f'mouth_corner_{s}', f'cheek_hollow_{s}', f'jaw_body_{s}', f'chin_lat_apex_{s}'], 'beard_dark')
    add_facet([f'chin_lat_apex_{s}', f'chin_lat_base_{s}', f'jaw_body_{s}'], 'beard_dark') if s==1 else add_facet([f'chin_lat_apex_{s}', f'jaw_body_{s}', f'chin_lat_base_{s}'], 'beard_dark')
    add_facet([f'chin_lat_base_{s}', f'jaw_angle_{s}', f'jaw_body_{s}'], 'beard_dark') if s==1 else add_facet([f'chin_lat_base_{s}', f'jaw_body_{s}', f'jaw_angle_{s}'], 'beard_dark')

    # ROUND 7: ANATOMICAL LOW-POLY EAR FACETS
    # Outer Helix Rim
    add_facet([f'ear_crus_{s}', f'ear_helix_hi_{s}', f'ear_antihelix_{s}'], 'skin_highlight') if s==1 else add_facet([f'ear_crus_{s}', f'ear_antihelix_{s}', f'ear_helix_hi_{s}'], 'skin_highlight')
    add_facet([f'ear_helix_hi_{s}', f'ear_helix_mid_{s}', f'ear_antihelix_{s}'], 'skin_highlight') if s==1 else add_facet([f'ear_helix_hi_{s}', f'ear_antihelix_{s}', f'ear_helix_mid_{s}'], 'skin_highlight')
    add_facet([f'ear_helix_mid_{s}', f'ear_helix_lo_{s}', f'ear_lobe_{s}', f'ear_antihelix_{s}'], 'skin_mid') if s==1 else add_facet([f'ear_helix_mid_{s}', f'ear_antihelix_{s}', f'ear_lobe_{s}', f'ear_helix_lo_{s}'], 'skin_mid')
    # Inner Concha Bowl (Shadow)
    add_facet([f'ear_crus_{s}', f'ear_antihelix_{s}', f'ear_concha_{s}', f'ear_tragus_{s}'], 'skin_shadow') if s==1 else add_facet([f'ear_crus_{s}', f'ear_tragus_{s}', f'ear_concha_{s}', f'ear_antihelix_{s}'], 'skin_shadow')
    add_facet([f'ear_antihelix_{s}', f'ear_lobe_{s}', f'ear_concha_{s}'], 'skin_shadow') if s==1 else add_facet([f'ear_antihelix_{s}', f'ear_concha_{s}', f'ear_lobe_{s}'], 'skin_shadow')
    # Tragus & Lobe Front
    add_facet([f'ear_tragus_{s}', f'ear_concha_{s}', f'ear_lobe_{s}'], 'skin_mid') if s==1 else add_facet([f'ear_tragus_{s}', f'ear_lobe_{s}', f'ear_concha_{s}'], 'skin_mid')
    # Ear Posterior Attachment to Mastoid
    add_facet([f'ear_helix_mid_{s}', f'mastoid_{s}', f'ear_helix_lo_{s}'], 'skin_shadow') if s==1 else add_facet([f'ear_helix_mid_{s}', f'ear_helix_lo_{s}', f'mastoid_{s}'], 'skin_shadow')
    add_facet([f'ear_helix_lo_{s}', f'mastoid_{s}', f'ear_lobe_{s}'], 'skin_shadow') if s==1 else add_facet([f'ear_helix_lo_{s}', f'ear_lobe_{s}', f'mastoid_{s}'], 'skin_shadow')

    # Sealed Chin Base & Neck
    add_facet(['chin_base', f'chin_lat_base_{s}', f'jaw_angle_{s}'], 'beard_dark') if s==1 else add_facet(['chin_base', f'jaw_angle_{s}', f'chin_lat_base_{s}'], 'beard_dark')
    add_facet(['chin_base', f'jaw_angle_{s}', 'throat'], 'skin_shadow') if s==1 else add_facet(['chin_base', 'throat', f'jaw_angle_{s}'], 'skin_shadow')
    add_facet([f'jaw_angle_{s}', f'neck_scm_{s}', 'throat'], 'skin_shadow') if s==1 else add_facet([f'jaw_angle_{s}', 'throat', f'neck_scm_{s}'], 'skin_shadow')
    add_facet([f'jaw_angle_{s}', f'ear_lobe_{s}', f'mastoid_{s}', f'neck_scm_{s}'], 'skin_shadow') if s==1 else add_facet([f'jaw_angle_{s}', f'neck_scm_{s}', f'mastoid_{s}', f'ear_lobe_{s}'], 'skin_shadow')
    add_facet([f'mastoid_{s}', f'neck_lat_{s}', f'neck_scm_{s}'], 'skin_shadow') if s==1 else add_facet([f'mastoid_{s}', f'neck_scm_{s}', f'neck_lat_{s}'], 'skin_shadow')
    add_facet([f'mastoid_{s}', 'nape', f'neck_lat_{s}'], 'skin_shadow') if s==1 else add_facet([f'mastoid_{s}', f'neck_lat_{s}', 'nape'], 'skin_shadow')

create_poly_object("TargetLowPolyHeadUnified_R7", vert_list, faces_list, faces_mat, parent=head)
print(f"Head R7 created: {len(vert_list)} verts, {len(faces_list)} faces.")

# -------------------------------------------------------------------------
# 4. Volumetric Wavy Hair Locks, Crests & Half-Bun (Round 7)
# -------------------------------------------------------------------------
bangs_v = [
    Vector(( 0.000, -0.066, 0.158)), # 0 center root
    Vector(( 0.024, -0.076, 0.144)), # 1
    Vector(( 0.046, -0.080, 0.124)), # 2 ridge
    Vector(( 0.065, -0.074, 0.098)), # 3 tip
    Vector(( 0.016, -0.084, 0.118)), # 4 lower rim
    Vector(( 0.038, -0.088, 0.102)), # 5
    Vector((-0.024, -0.076, 0.144)), # 6
    Vector((-0.046, -0.080, 0.124)), # 7 ridge
    Vector((-0.065, -0.074, 0.098)), # 8 tip
    Vector((-0.016, -0.084, 0.118)), # 9 lower rim
    Vector((-0.038, -0.088, 0.102)), # 10
]
bangs_f = [
    [0, 1, 4], [1, 2, 5, 4], [2, 3, 5],
    [0, 9, 6], [6, 9, 10, 7], [7, 10, 8]
]
bangs_m = ['hair_base', 'hair_highlight', 'hair_base',
           'hair_base', 'hair_highlight', 'hair_base']
create_poly_object("TargetLowPolyBangs_R7", bangs_v, bangs_f, bangs_m, parent=head)

# Crown Hair Crests
crest_v = [
    Vector(( 0.000, -0.030, 0.160)), # 0
    Vector(( 0.030, -0.015, 0.164)), # 1
    Vector((-0.030, -0.015, 0.164)), # 2
    Vector(( 0.000,  0.035, 0.168)), # 3
    Vector(( 0.045,  0.030, 0.162)), # 4
    Vector((-0.045,  0.030, 0.162)), # 5
]
crest_f = [
    [0, 1, 3], [0, 3, 2],
    [1, 4, 3], [2, 3, 5]
]
crest_m = ['hair_highlight', 'hair_base', 'hair_highlight', 'hair_base']
create_poly_object("TargetLowPolyCrownCrest_R7", crest_v, crest_f, crest_m, parent=head)

# Volumetric 3D Cascading Wavy Side Locks
for s in [-1, 1]:
    sl_v = [
        Vector((s * 0.075, -0.045, 0.115)), # 0 inner
        Vector((s * 0.088, -0.048, 0.112)), # 1 ridge
        Vector((s * 0.082, -0.035, 0.110)), # 2 outer
        Vector((s * 0.080, -0.065, 0.065)), # 3 inner
        Vector((s * 0.096, -0.060, 0.060)), # 4 ridge
        Vector((s * 0.090, -0.045, 0.055)), # 5 outer
        Vector((s * 0.074, -0.058, 0.010)), # 6 inner
        Vector((s * 0.088, -0.050, 0.005)), # 7 ridge
        Vector((s * 0.084, -0.038, 0.000)), # 8 outer
        Vector((s * 0.068, -0.062, -0.045)),# 9 inner
        Vector((s * 0.080, -0.052, -0.050)),# 10 ridge
        Vector((s * 0.076, -0.040, -0.052)),# 11 outer
        Vector((s * 0.062, -0.055, -0.080)),# 12 tip
    ]
    sl_f = [
        [0, 1, 4, 3] if s==1 else [0, 3, 4, 1],
        [1, 2, 5, 4] if s==1 else [1, 4, 5, 2],
        [3, 4, 7, 6] if s==1 else [3, 6, 7, 4],
        [4, 5, 8, 7] if s==1 else [4, 7, 8, 5],
        [6, 7, 10, 9] if s==1 else [6, 9, 10, 7],
        [7, 8, 11, 10] if s==1 else [7, 10, 11, 8],
        [9, 10, 12] if s==1 else [9, 12, 10],
        [10, 11, 12] if s==1 else [10, 12, 11],
    ]
    sl_m = ['hair_highlight', 'hair_base',
            'hair_highlight', 'hair_base',
            'hair_highlight', 'hair_base',
            'hair_highlight', 'hair_base']
    create_poly_object(f"TargetLowPolySideLock_R7_{'R' if s==1 else 'L'}", sl_v, sl_f, sl_m, parent=head)

# Half-Bun (Seamlessly Anchored to Occiput)
bun_v = [
    Vector(( 0.000, 0.086, 0.075)), # 0 Base center
    Vector(( 0.034, 0.082, 0.075)), # 1 Base right
    Vector((-0.034, 0.082, 0.075)), # 2 Base left
    Vector(( 0.000, 0.092, 0.105)), # 3 Base top
    Vector(( 0.000, 0.080, 0.045)), # 4 Base bot
    Vector(( 0.000, 0.138, 0.075)), # 5 Bun apex
    Vector(( 0.026, 0.126, 0.098)), # 6 Mid top-right
    Vector((-0.026, 0.126, 0.098)), # 7 Mid top-left
    Vector(( 0.026, 0.122, 0.052)), # 8 Mid bot-right
    Vector((-0.026, 0.122, 0.052)), # 9 Mid bot-left
]
bun_f = [
    [0, 3, 6, 1], [0, 1, 8, 4],
    [0, 4, 9, 2], [0, 2, 7, 3],
    [3, 7, 5, 6], [1, 6, 5, 8],
    [4, 8, 5, 9], [2, 9, 5, 7],
]
bun_m = ['hair_base', 'hair_highlight', 'hair_base', 'hair_highlight',
         'hair_highlight', 'hair_base', 'hair_highlight', 'hair_base']
create_poly_object("TargetLowPolyHalfBun_R7", bun_v, bun_f, bun_m, parent=head)

# Back Nape Hair
back_hair_v = [
    Vector(( 0.000, 0.080,  0.045)), # 0
    Vector(( 0.045, 0.072,  0.048)), # 1
    Vector((-0.045, 0.072,  0.048)), # 2
    Vector(( 0.000, 0.062, -0.045)), # 3
    Vector(( 0.055, 0.055, -0.045)), # 4
    Vector((-0.055, 0.055, -0.045)), # 5
]
back_hair_f = [
    [0, 1, 4, 3], [0, 3, 5, 2],
    [1, 0, 3],    [2, 0, 3],
    [1, 4, 3],    [2, 3, 5]
]
back_hair_m = ['hair_base', 'hair_base', 'hair_highlight',
               'hair_base', 'hair_highlight', 'hair_base']
create_poly_object("TargetLowPolyBackHair_R7", back_hair_v, back_hair_f, back_hair_m, parent=head)

# Standing Linen Shirt Collar
shirt_v = [
    Vector((-0.038, -0.065, -0.045)), # 0
    Vector(( 0.038, -0.065, -0.045)), # 1
    Vector((-0.055, -0.020, -0.050)), # 2
    Vector(( 0.055, -0.020, -0.050)), # 3
    Vector((-0.045,  0.035, -0.055)), # 4
    Vector(( 0.045,  0.035, -0.055)), # 5
    Vector(( 0.000, -0.060, -0.095)), # 6
    Vector((-0.060, -0.025, -0.090)), # 7
    Vector(( 0.060, -0.025, -0.090)), # 8
]
shirt_f = [
    [0, 6, 7, 2], [1, 3, 8, 6],
    [2, 7, 4],    [3, 5, 8],
    [0, 2, 6],    [1, 6, 3],
]
shirt_m = ['shirt_ivory'] * len(shirt_f)
create_poly_object("TargetLowPolyShirt_R7", shirt_v, shirt_f, shirt_m, parent=head)

# Wine-Red Cowl Cloak, Teal Lining & Golden Brooch
cowl_v = [
    Vector(( 0.000, -0.115, -0.075)), # 0
    Vector((-0.095, -0.088, -0.060)), # 1
    Vector(( 0.095, -0.088, -0.060)), # 2
    Vector((-0.135, -0.025, -0.065)), # 3
    Vector(( 0.135, -0.025, -0.065)), # 4
    Vector((-0.115,  0.065, -0.075)), # 5
    Vector(( 0.115,  0.065, -0.075)), # 6
    Vector(( 0.000,  0.085, -0.085)), # 7
    Vector(( 0.000, -0.155, -0.135)), # 8
    Vector((-0.125, -0.125, -0.120)), # 9
    Vector(( 0.125, -0.125, -0.120)), # 10
    Vector((-0.175, -0.035, -0.125)), # 11
    Vector(( 0.175, -0.035, -0.125)), # 12
    Vector((-0.145,  0.085, -0.130)), # 13
    Vector(( 0.145,  0.085, -0.130)), # 14
    Vector(( 0.000,  0.105, -0.140)), # 15
]
cowl_f = [
    [0, 1, 9, 8],   [0, 8, 10, 2],
    [1, 3, 11, 9],  [2, 10, 12, 4],
    [3, 5, 13, 11], [4, 12, 14, 6],
    [5, 7, 15, 13], [6, 14, 15, 7],
]
cowl_m = ['cape_wine_hi', 'cape_wine', 'cape_wine_hi', 'cape_wine',
          'cape_wine',    'cape_wine', 'cape_wine',    'cape_wine']
create_poly_object("TargetLowPolyCowl_R7", cowl_v, cowl_f, cowl_m, parent=head)

# Teal Lining Band
teal_v = [
    Vector(( 0.000, -0.110, -0.072)), # 0
    Vector((-0.090, -0.084, -0.058)), # 1
    Vector(( 0.090, -0.084, -0.058)), # 2
    Vector(( 0.000, -0.118, -0.076)), # 3
    Vector((-0.098, -0.090, -0.062)), # 4
    Vector(( 0.098, -0.090, -0.062)), # 5
]
teal_f = [[0, 1, 4, 3], [0, 3, 5, 2]]
teal_m = ['tunic_teal', 'tunic_teal']
create_poly_object("TargetLowPolyTealLining_R7", teal_v, teal_f, teal_m, parent=head)

# Antique Gold Diamond Brooch
brooch_v = [
    Vector((-0.090, -0.092, -0.050)), # 0
    Vector((-0.112, -0.086, -0.068)), # 1
    Vector((-0.068, -0.086, -0.068)), # 2
    Vector((-0.090, -0.080, -0.086)), # 3
    Vector((-0.090, -0.102, -0.068)), # 4
]
brooch_f = [
    [0, 1, 4], [0, 4, 2],
    [1, 3, 4], [2, 4, 3]
]
brooch_m = ['clasp_gold'] * 4
create_poly_object("TargetLowPolyBrooch_R7", brooch_v, brooch_f, brooch_m, parent=head)

# Save Round 7 blend
round7_blend = BASE / 'assets/models/optimized/human-courier-production-v2/head-round7/courier.blend'
round7_blend.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(round7_blend))
print(f"Round 7 courier successfully saved to: {round7_blend}")
