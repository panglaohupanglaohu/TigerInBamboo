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

# 1. Purge previous test objects
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

# 2. Material Palette (Target Concept Art Fidelity)
PALETTE = {
    'skin_highlight': (0.840, 0.710, 0.580, 1.0), # #d7b594 Forehead, bridge highlight, cheek apex
    'skin_mid':       (0.720, 0.560, 0.420, 1.0), # #b88f6b Main warm sun-kissed skin
    'skin_shadow':    (0.560, 0.410, 0.290, 1.0), # #8f694a Orbit recess, jaw shadow, subnasal
    'skin_deep':      (0.380, 0.240, 0.160, 1.0), # #613d29 Deep upper eyelid crease & nostrils
    'lip_rose':       (0.710, 0.480, 0.420, 1.0), # #b57a6c Warm natural lips
    'lip_shadow':     (0.520, 0.320, 0.280, 1.0), # #855247 Mentolabial crease & mouth line
    'beard_dark':     (0.200, 0.165, 0.155, 1.0), # #332a27 Dark hair/beard
    'beard_stubble':  (0.460, 0.360, 0.290, 1.0), # #6b5445 Cheek 5 o'clock stubble gradient
    'hair_base':      (0.169, 0.133, 0.125, 1.0), # #2b2220 Rich dark hair base
    'hair_highlight': (0.260, 0.200, 0.180, 1.0), # #42332e Hair lock ridge highlights
    'shirt_ivory':    (0.880, 0.850, 0.780, 1.0), # #e0d9c7 Crisp ivory linen shirt
    'shirt_shadow':   (0.760, 0.720, 0.650, 1.0), # #c2b8a6 Shirt fold shadow
    'cape_wine':      (0.420, 0.120, 0.140, 1.0), # #6b1f24 Rich wine cowl
    'cape_wine_hi':   (0.520, 0.160, 0.180, 1.0), # #85292e Wine cape fold highlight
    'tunic_teal':     (0.170, 0.310, 0.300, 1.0), # #2b4f4d Teal lining fold
    'clasp_gold':     (0.720, 0.560, 0.240, 1.0), # #b88f3d Antique gold brooch & bun ring
    'clasp_gold_hi':  (0.820, 0.680, 0.320, 1.0), # #d1ad52 Clasp highlight
    'iris_amber':     (0.660, 0.470, 0.200, 1.0), # #a87834 Warm glowing amber iris
    'sclera_white':   (0.920, 0.890, 0.840, 1.0), # #eae3d6 Crisp eye sclera
    'pupil_black':    (0.080, 0.060, 0.050, 1.0), # #140f0d Deep dark pupil
    'eye_highlight':  (1.000, 1.000, 1.000, 1.0), # #ffffff Sparkling specular eye catchlight
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
                                  roughness=0.35 if 'gold' in k else (0.25 if 'highlight' in k and 'eye' in k else 0.88),
                                  metallic=0.85 if 'gold' in k else 0.0) 
        for k in PALETTE}
MAT_ORDER = list(PALETTE.keys())
MAT_INDEX_MAP = {k: i for i, k in enumerate(MAT_ORDER)}

def create_poly_object(name, verts, faces, face_materials, parent=head):
    me = bpy.data.meshes.new(name + "_Mesh")
    for m_key in MAT_ORDER:
        me.materials.append(MATS[m_key])
        
    bm = bmesh.new()
    bm_verts = [bm.verts.new(v) for v in verts]
    bm.verts.ensure_lookup_table()
    
    for f_indices, m_key in zip(faces, face_materials):
        try:
            face_v = [bm_verts[i] for i in f_indices]
            f = bm.faces.new(face_v)
            f.material_index = MAT_INDEX_MAP[m_key]
        except Exception as e:
            print(f"Face add error {f_indices}: {e}")
            
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    
    for p in me.polygons:
        p.use_smooth = False
        
    obj = bpy.data.objects.new(name, me)
    scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
        # DO NOT set matrix_parent_inverse, so local (0,0,0) stays at parent head pivot (z=1.55)
    return obj

# -------------------------------------------------------------------------
# 3. Round 16 Cranium & Jaw Overhaul (Zero Chin Holes, Masculine Square Chin)
# -------------------------------------------------------------------------
V_map = {}
def add_v(name, pos):
    V_map[name] = Vector(pos)

# Sagittal Centerline (x = 0)
add_v('crown_front',   (0.000, -0.038,  0.152))
add_v('forehead_hi',    (0.000, -0.066,  0.136))
add_v('forehead_mid',   (0.000, -0.076,  0.112))
add_v('glabella_top',   (0.000, -0.082,  0.093))
add_v('glabella_bot',   (0.000, -0.086,  0.080))
add_v('sellion',        (0.000, -0.088,  0.070))
add_v('rhinion',        (0.000, -0.100,  0.046))
add_v('supratip',       (0.000, -0.108,  0.026))
add_v('nasal_tip',      (0.000, -0.114,  0.016))
add_v('infratip',       (0.000, -0.103,  0.008))
add_v('subnasale',      (0.000, -0.089,  0.002))
add_v('philtrum_trough',(0.000, -0.086, -0.008))
add_v('upper_lip',      (0.000, -0.090, -0.016))
add_v('mouth_center',   (0.000, -0.083, -0.023))
add_v('lower_lip',      (0.000, -0.086, -0.030))
add_v('chin_groove',    (0.000, -0.076, -0.043))
add_v('chin_apex',      (0.000, -0.083, -0.059))
add_v('chin_base',      (0.000, -0.068, -0.074))
add_v('submental',      (0.000, -0.045, -0.082)) # Closes under-chin gap
add_v('throat',         (0.000, -0.025, -0.088)) # Neck front

# Cranium rear sagittal
add_v('crown_mid',      (0.000,  0.030,  0.160))
add_v('crown_rear',     (0.000,  0.080,  0.140))
add_v('occiput_hi',     (0.000,  0.102,  0.100))
add_v('occiput_mid',    (0.000,  0.098,  0.040))
add_v('occiput_lo',     (0.000,  0.080, -0.020))
add_v('nape',           (0.000,  0.055, -0.075))

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
    
    # Eyebrows (Sword Brow Ridge)
    add_v(f'glabella_lat_{s}',     (s * 0.014, -0.085, 0.086))
    add_v(f'brow_in_{s}',          (s * 0.015, -0.091, 0.089))
    add_v(f'brow_mid_{s}',         (s * 0.043, -0.088, 0.096)) # Arched sword brow peak
    add_v(f'brow_tail_{s}',        (s * 0.072, -0.062, 0.075)) # Downward temple taper
    
    # Eye Socket Crease (Deep Upper Eyelid Fold)
    add_v(f'crease_in_{s}',        (s * 0.018, -0.084, 0.077))
    add_v(f'crease_mid_{s}',       (s * 0.041, -0.081, 0.081))
    add_v(f'crease_out_{s}',       (s * 0.063, -0.060, 0.073))
    
    # Eye Contour (Almond Eye)
    add_v(f'eye_in_{s}',           (s * 0.019, -0.080, 0.063))
    add_v(f'eye_top_{s}',          (s * 0.038, -0.077, 0.073))
    add_v(f'eye_out_{s}',          (s * 0.058, -0.057, 0.067))
    add_v(f'eye_bot_{s}',          (s * 0.038, -0.074, 0.057))
    
    # Iris, Pupil, Catchlight
    add_v(f'iris_in_{s}',          (s * 0.027, -0.078, 0.065))
    add_v(f'iris_out_{s}',         (s * 0.048, -0.069, 0.065))
    add_v(f'pupil_top_{s}',        (s * 0.038, -0.076, 0.068))
    add_v(f'pupil_bot_{s}',        (s * 0.038, -0.073, 0.062))
    add_v(f'glint_{s}',            (s * 0.042, -0.077, 0.070))
    
    # Orbit Floor
    add_v(f'orbit_fl_in_{s}',      (s * 0.022, -0.075, 0.049))
    add_v(f'orbit_fl_mid_{s}',     (s * 0.042, -0.069, 0.045))
    add_v(f'orbit_fl_out_{s}',     (s * 0.065, -0.052, 0.049))
    
    # Slender Classical Nose Bridge & Wings
    add_v(f'nose_slope_hi_{s}',    (s * 0.009, -0.090, 0.063))
    add_v(f'nose_slope_mid_{s}',   (s * 0.011, -0.098, 0.040))
    add_v(f'nose_slope_lo_{s}',    (s * 0.013, -0.104, 0.024))
    add_v(f'ala_crest_{s}',        (s * 0.022, -0.096, 0.014))
    add_v(f'ala_base_{s}',         (s * 0.023, -0.086, 0.004))
    
    # Cheeks & Zygoma
    add_v(f'zygoma_apex_{s}',      (s * 0.082, -0.036, 0.056))
    add_v(f'cheek_ant_{s}',        (s * 0.048, -0.062, 0.028))
    add_v(f'cheek_mid_{s}',        (s * 0.064, -0.048, 0.024))
    add_v(f'cheek_hollow_{s}',     (s * 0.065, -0.040, 0.004))
    
    # Philtrum & Mouth
    add_v(f'philtrum_col_{s}',     (s * 0.008, -0.088, -0.008))
    add_v(f'upper_lip_peak_{s}',   (s * 0.013, -0.091, -0.014))
    add_v(f'mouth_corner_{s}',     (s * 0.029, -0.074, -0.0205))
    add_v(f'lower_lip_lat_{s}',    (s * 0.017, -0.083, -0.029))
    
    # Watertight Boxed Chin & Jaw (54mm Wide Square Chin)
    add_v(f'chin_lat_apex_{s}',    (s * 0.027, -0.080, -0.060))
    add_v(f'chin_lat_base_{s}',    (s * 0.027, -0.066, -0.075))
    add_v(f'submental_lat_{s}',    (s * 0.030, -0.042, -0.080))
    add_v(f'jaw_body_{s}',         (s * 0.054, -0.042, -0.055))
    add_v(f'jaw_angle_{s}',        (s * 0.070,  0.006, -0.035))
    
    # Ears
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
    add_facet(['forehead_mid', f'forehead_mid_lat_{s}', f'brow_in_{s}', 'glabella_top'], 'skin_mid') if s==1 else add_facet(['forehead_mid', 'glabella_top', f'brow_in_{s}', f'forehead_mid_lat_{s}'], 'skin_mid')
    add_facet([f'forehead_mid_lat_{s}', f'forehead_lat_lo_{s}', f'brow_mid_{s}', f'brow_in_{s}'], 'skin_mid') if s==1 else add_facet([f'forehead_mid_lat_{s}', f'brow_in_{s}', f'brow_mid_{s}', f'forehead_lat_lo_{s}'], 'skin_mid')
    add_facet([f'forehead_lat_lo_{s}', f'temple_lo_{s}', f'brow_tail_{s}', f'brow_mid_{s}'], 'skin_mid') if s==1 else add_facet([f'forehead_lat_lo_{s}', f'brow_mid_{s}', f'brow_tail_{s}', f'temple_lo_{s}'], 'skin_mid')

    # Glabella Keystone
    add_facet(['glabella_top', f'brow_in_{s}', f'glabella_lat_{s}', 'glabella_bot'], 'skin_highlight') if s==1 else add_facet(['glabella_top', 'glabella_bot', f'glabella_lat_{s}', f'brow_in_{s}'], 'skin_highlight')
    add_facet(['glabella_bot', f'glabella_lat_{s}', 'sellion'], 'skin_mid') if s==1 else add_facet(['glabella_bot', 'sellion', f'glabella_lat_{s}'], 'skin_mid')

    # Eyebrows (Sword Brow Ridge)
    add_facet([f'brow_in_{s}', f'brow_mid_{s}', f'crease_mid_{s}', f'crease_in_{s}'], 'beard_dark') if s==1 else add_facet([f'brow_in_{s}', f'crease_in_{s}', f'crease_mid_{s}', f'brow_mid_{s}'], 'beard_dark')
    add_facet([f'brow_mid_{s}', f'brow_tail_{s}', f'crease_out_{s}', f'crease_mid_{s}'], 'beard_dark') if s==1 else add_facet([f'brow_mid_{s}', f'crease_mid_{s}', f'crease_out_{s}', f'brow_tail_{s}'], 'beard_dark')

    # Deep Upper Eyelid Crease
    add_facet([f'crease_in_{s}', f'crease_mid_{s}', f'eye_top_{s}', f'eye_in_{s}'], 'skin_deep') if s==1 else add_facet([f'crease_in_{s}', f'eye_in_{s}', f'eye_top_{s}', f'crease_mid_{s}'], 'skin_deep')
    add_facet([f'crease_mid_{s}', f'crease_out_{s}', f'eye_out_{s}', f'eye_top_{s}'], 'skin_deep') if s==1 else add_facet([f'crease_mid_{s}', f'eye_top_{s}', f'eye_out_{s}', f'crease_out_{s}'], 'skin_deep')

    # Eye Inset: Sclera + Amber Iris + Dark Pupil
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

    # Nose Bridge
    add_facet(['sellion', f'nose_slope_hi_{s}', f'eye_in_{s}', f'crease_in_{s}'], 'skin_mid') if s==1 else add_facet(['sellion', f'crease_in_{s}', f'eye_in_{s}', f'nose_slope_hi_{s}'], 'skin_mid')
    add_facet(['sellion', 'rhinion', f'nose_slope_mid_{s}', f'nose_slope_hi_{s}'], 'skin_highlight') if s==1 else add_facet(['sellion', f'nose_slope_hi_{s}', f'nose_slope_mid_{s}', 'rhinion'], 'skin_highlight')
    add_facet(['rhinion', 'supratip', f'nose_slope_lo_{s}', f'nose_slope_mid_{s}'], 'skin_highlight') if s==1 else add_facet(['rhinion', f'nose_slope_mid_{s}', f'nose_slope_lo_{s}', 'supratip'], 'skin_highlight')
    add_facet(['supratip', 'nasal_tip', f'ala_crest_{s}', f'nose_slope_lo_{s}'], 'skin_highlight') if s==1 else add_facet(['supratip', f'nose_slope_lo_{s}', f'ala_crest_{s}', 'nasal_tip'], 'skin_highlight')

    # Subnasal Tip & Alar wings
    add_facet(['nasal_tip', 'infratip', f'ala_crest_{s}'], 'skin_shadow') if s==1 else add_facet(['nasal_tip', f'ala_crest_{s}', 'infratip'], 'skin_shadow')
    add_facet(['infratip', 'subnasale', f'ala_base_{s}', f'ala_crest_{s}'], 'skin_shadow') if s==1 else add_facet(['infratip', f'ala_crest_{s}', f'ala_base_{s}', 'subnasale'], 'skin_shadow')

    # Cheeks & Zygoma
    add_facet([f'nose_slope_hi_{s}', f'nose_slope_mid_{s}', f'orbit_fl_in_{s}', f'eye_in_{s}'], 'skin_mid') if s==1 else add_facet([f'nose_slope_hi_{s}', f'eye_in_{s}', f'orbit_fl_in_{s}', f'nose_slope_mid_{s}'], 'skin_mid')
    add_facet([f'nose_slope_mid_{s}', f'nose_slope_lo_{s}', f'ala_crest_{s}', f'orbit_fl_in_{s}'], 'skin_highlight') if s==1 else add_facet([f'nose_slope_mid_{s}', f'orbit_fl_in_{s}', f'ala_crest_{s}', f'nose_slope_lo_{s}'], 'skin_highlight')
    add_facet([f'ala_crest_{s}', f'cheek_ant_{s}', f'orbit_fl_mid_{s}', f'orbit_fl_in_{s}'], 'skin_highlight') if s==1 else add_facet([f'ala_crest_{s}', f'orbit_fl_in_{s}', f'orbit_fl_mid_{s}', f'cheek_ant_{s}'], 'skin_highlight')
    add_facet([f'orbit_fl_mid_{s}', f'cheek_ant_{s}', f'cheek_mid_{s}', f'orbit_fl_out_{s}'], 'skin_highlight') if s==1 else add_facet([f'orbit_fl_mid_{s}', f'orbit_fl_out_{s}', f'cheek_mid_{s}', f'cheek_ant_{s}'], 'skin_highlight')
    add_facet([f'orbit_fl_out_{s}', f'cheek_mid_{s}', f'zygoma_apex_{s}'], 'skin_highlight') if s==1 else add_facet([f'orbit_fl_out_{s}', f'zygoma_apex_{s}', f'cheek_mid_{s}'], 'skin_highlight')
    add_facet([f'crease_out_{s}', f'brow_tail_{s}', f'temple_lo_{s}', f'orbit_fl_out_{s}'], 'skin_mid') if s==1 else add_facet([f'crease_out_{s}', f'orbit_fl_out_{s}', f'temple_lo_{s}', f'brow_tail_{s}'], 'skin_mid')
    add_facet([f'temple_lo_{s}', f'zygoma_apex_{s}', f'orbit_fl_out_{s}'], 'skin_mid') if s==1 else add_facet([f'temple_lo_{s}', f'orbit_fl_out_{s}', f'zygoma_apex_{s}'], 'skin_mid')

    # Philtrum Column & Mustache
    add_facet(['subnasale', f'ala_base_{s}', f'mouth_corner_{s}', f'upper_lip_peak_{s}', f'philtrum_col_{s}'], 'beard_dark') if s==1 else add_facet(['subnasale', f'philtrum_col_{s}', f'upper_lip_peak_{s}', f'mouth_corner_{s}', f'ala_base_{s}'], 'beard_dark')
    add_facet(['subnasale', f'philtrum_col_{s}', 'philtrum_trough'], 'skin_mid') if s==1 else add_facet(['subnasale', 'philtrum_trough', f'philtrum_col_{s}'], 'skin_mid')
    add_facet(['philtrum_trough', f'philtrum_col_{s}', f'upper_lip_peak_{s}', 'upper_lip'], 'skin_shadow') if s==1 else add_facet(['philtrum_trough', 'upper_lip', f'upper_lip_peak_{s}', f'philtrum_col_{s}'], 'skin_shadow')

    # Lips
    add_facet(['upper_lip', f'upper_lip_peak_{s}', f'mouth_corner_{s}', 'mouth_center'], 'skin_shadow') if s==1 else add_facet(['upper_lip', 'mouth_center', f'mouth_corner_{s}', f'upper_lip_peak_{s}'], 'skin_shadow')
    add_facet(['mouth_center', f'mouth_corner_{s}', f'lower_lip_lat_{s}', 'lower_lip'], 'skin_highlight') if s==1 else add_facet(['mouth_center', 'lower_lip', f'lower_lip_lat_{s}', f'mouth_corner_{s}'], 'skin_highlight')

    # CRUCIAL FIX: Seal the triangle between mouth corner, lower lip lat, and chin lat apex!
    add_facet([f'mouth_corner_{s}', f'lower_lip_lat_{s}', f'chin_lat_apex_{s}'], 'beard_dark') if s==1 else add_facet([f'mouth_corner_{s}', f'chin_lat_apex_{s}', f'lower_lip_lat_{s}'], 'beard_dark')

    # Soul patch & Chin
    add_facet(['lower_lip', f'lower_lip_lat_{s}', 'chin_groove'], 'skin_shadow') if s==1 else add_facet(['lower_lip', 'chin_groove', f'lower_lip_lat_{s}'], 'skin_shadow')
    add_facet(['chin_groove', f'lower_lip_lat_{s}', f'chin_lat_apex_{s}', 'chin_apex'], 'beard_dark') if s==1 else add_facet(['chin_groove', 'chin_apex', f'chin_lat_apex_{s}', f'lower_lip_lat_{s}'], 'beard_dark')
    add_facet(['chin_apex', f'chin_lat_apex_{s}', f'chin_lat_base_{s}', 'chin_base'], 'beard_dark') if s==1 else add_facet(['chin_apex', 'chin_base', f'chin_lat_base_{s}', f'chin_lat_apex_{s}'], 'beard_dark')

    # Mid Cheek & Jaw beard
    add_facet([f'ala_crest_{s}', f'ala_base_{s}', f'mouth_corner_{s}', f'cheek_ant_{s}'], 'skin_mid') if s==1 else add_facet([f'ala_crest_{s}', f'cheek_ant_{s}', f'mouth_corner_{s}', f'ala_base_{s}'], 'skin_mid')
    add_facet([f'cheek_ant_{s}', f'mouth_corner_{s}', f'cheek_hollow_{s}', f'cheek_mid_{s}'], 'skin_shadow') if s==1 else add_facet([f'cheek_ant_{s}', f'cheek_mid_{s}', f'cheek_hollow_{s}', f'mouth_corner_{s}'], 'skin_shadow')
    add_facet([f'cheek_mid_{s}', f'cheek_hollow_{s}', f'zygoma_apex_{s}'], 'skin_mid') if s==1 else add_facet([f'cheek_mid_{s}', f'zygoma_apex_{s}', f'cheek_hollow_{s}'], 'skin_mid')
    
    # Cheek Hollow to Ear & Jaw Angle
    add_facet([f'zygoma_apex_{s}', f'cheek_hollow_{s}', f'ear_tragus_{s}', f'ear_crus_{s}'], 'skin_mid') if s==1 else add_facet([f'zygoma_apex_{s}', f'ear_crus_{s}', f'ear_tragus_{s}', f'cheek_hollow_{s}'], 'skin_mid')
    add_facet([f'zygoma_apex_{s}', f'ear_crus_{s}', f'ear_helix_hi_{s}', f'temple_lo_{s}'], 'hair_base') if s==1 else add_facet([f'zygoma_apex_{s}', f'temple_lo_{s}', f'ear_helix_hi_{s}', f'ear_crus_{s}'], 'hair_base')
    add_facet([f'cheek_hollow_{s}', f'jaw_body_{s}', f'jaw_angle_{s}', f'ear_lobe_{s}'], 'beard_dark') if s==1 else add_facet([f'cheek_hollow_{s}', f'ear_lobe_{s}', f'jaw_angle_{s}', f'jaw_body_{s}'], 'beard_dark')
    add_facet([f'cheek_hollow_{s}', f'ear_lobe_{s}', f'ear_tragus_{s}'], 'skin_shadow') if s==1 else add_facet([f'cheek_hollow_{s}', f'ear_tragus_{s}', f'ear_lobe_{s}'], 'skin_shadow')

    add_facet([f'mouth_corner_{s}', f'chin_lat_apex_{s}', f'jaw_body_{s}', f'cheek_hollow_{s}'], 'beard_dark') if s==1 else add_facet([f'mouth_corner_{s}', f'cheek_hollow_{s}', f'jaw_body_{s}', f'chin_lat_apex_{s}'], 'beard_dark')
    add_facet([f'chin_lat_apex_{s}', f'chin_lat_base_{s}', f'jaw_body_{s}'], 'beard_dark') if s==1 else add_facet([f'chin_lat_apex_{s}', f'jaw_body_{s}', f'chin_lat_base_{s}'], 'beard_dark')
    add_facet([f'chin_lat_base_{s}', f'jaw_angle_{s}', f'jaw_body_{s}'], 'beard_dark') if s==1 else add_facet([f'chin_lat_base_{s}', f'jaw_body_{s}', f'jaw_angle_{s}'], 'beard_dark')

    # Anatomical Ears
    add_facet([f'ear_crus_{s}', f'ear_helix_hi_{s}', f'ear_antihelix_{s}'], 'skin_highlight') if s==1 else add_facet([f'ear_crus_{s}', f'ear_antihelix_{s}', f'ear_helix_hi_{s}'], 'skin_highlight')
    add_facet([f'ear_helix_hi_{s}', f'ear_helix_mid_{s}', f'ear_antihelix_{s}'], 'skin_highlight') if s==1 else add_facet([f'ear_helix_hi_{s}', f'ear_antihelix_{s}', f'ear_helix_mid_{s}'], 'skin_highlight')
    add_facet([f'ear_helix_mid_{s}', f'ear_helix_lo_{s}', f'ear_lobe_{s}', f'ear_antihelix_{s}'], 'skin_mid') if s==1 else add_facet([f'ear_helix_mid_{s}', f'ear_antihelix_{s}', f'ear_lobe_{s}', f'ear_helix_lo_{s}'], 'skin_mid')
    add_facet([f'ear_crus_{s}', f'ear_antihelix_{s}', f'ear_concha_{s}', f'ear_tragus_{s}'], 'skin_shadow') if s==1 else add_facet([f'ear_crus_{s}', f'ear_tragus_{s}', f'ear_concha_{s}', f'ear_antihelix_{s}'], 'skin_shadow')
    add_facet([f'ear_antihelix_{s}', f'ear_lobe_{s}', f'ear_concha_{s}'], 'skin_shadow') if s==1 else add_facet([f'ear_antihelix_{s}', f'ear_concha_{s}', f'ear_lobe_{s}'], 'skin_shadow')
    add_facet([f'ear_tragus_{s}', f'ear_concha_{s}', f'ear_lobe_{s}'], 'skin_mid') if s==1 else add_facet([f'ear_tragus_{s}', f'ear_lobe_{s}', f'ear_concha_{s}'], 'skin_mid')
    add_facet([f'ear_helix_mid_{s}', f'mastoid_{s}', f'ear_helix_lo_{s}'], 'skin_shadow') if s==1 else add_facet([f'ear_helix_mid_{s}', f'ear_helix_lo_{s}', f'mastoid_{s}'], 'skin_shadow')
    add_facet([f'ear_helix_lo_{s}', f'mastoid_{s}', f'ear_lobe_{s}'], 'skin_shadow') if s==1 else add_facet([f'ear_helix_lo_{s}', f'ear_lobe_{s}', f'mastoid_{s}'], 'skin_shadow')

    # 100% Watertight Sealed Chin Base & Neck (Zero Holes!)
    add_facet(['chin_base', 'submental', f'submental_lat_{s}', f'chin_lat_base_{s}'], 'beard_dark') if s==1 else add_facet(['chin_base', f'chin_lat_base_{s}', f'submental_lat_{s}', 'submental'], 'beard_dark')
    add_facet(['submental', 'throat', f'submental_lat_{s}'], 'skin_shadow') if s==1 else add_facet(['submental', f'submental_lat_{s}', 'throat'], 'skin_shadow')
    add_facet([f'chin_lat_base_{s}', f'submental_lat_{s}', f'jaw_angle_{s}'], 'beard_dark') if s==1 else add_facet([f'chin_lat_base_{s}', f'jaw_angle_{s}', f'submental_lat_{s}'], 'beard_dark')
    add_facet([f'submental_lat_{s}', f'neck_scm_{s}', f'jaw_angle_{s}'], 'skin_shadow') if s==1 else add_facet([f'submental_lat_{s}', f'jaw_angle_{s}', f'neck_scm_{s}'], 'skin_shadow')
    add_facet([f'submental_lat_{s}', 'throat', f'neck_scm_{s}'], 'skin_shadow') if s==1 else add_facet([f'submental_lat_{s}', f'neck_scm_{s}', 'throat'], 'skin_shadow')
    add_facet([f'jaw_angle_{s}', f'ear_lobe_{s}', f'mastoid_{s}', f'neck_scm_{s}'], 'skin_shadow') if s==1 else add_facet([f'jaw_angle_{s}', f'neck_scm_{s}', f'mastoid_{s}', f'ear_lobe_{s}'], 'skin_shadow')
    add_facet([f'mastoid_{s}', f'neck_lat_{s}', f'neck_scm_{s}'], 'skin_shadow') if s==1 else add_facet([f'mastoid_{s}', f'neck_scm_{s}', f'neck_lat_{s}'], 'skin_shadow')
    add_facet([f'mastoid_{s}', 'nape', f'neck_lat_{s}'], 'skin_shadow') if s==1 else add_facet([f'mastoid_{s}', f'neck_lat_{s}', 'nape'], 'skin_shadow')

    # Cranium rear & crown
    add_facet(['crown_front', 'crown_mid', f'parietal_hi_{s}'], 'hair_highlight') if s==1 else add_facet(['crown_front', f'parietal_hi_{s}', 'crown_mid'], 'hair_highlight')
    add_facet(['crown_mid', 'crown_rear', f'parietal_mid_{s}', f'parietal_hi_{s}'], 'hair_base') if s==1 else add_facet(['crown_mid', f'parietal_hi_{s}', f'parietal_mid_{s}', 'crown_rear'], 'hair_base')
    add_facet(['crown_rear', 'occiput_hi', f'occiput_lat_{s}', f'parietal_mid_{s}'], 'hair_base') if s==1 else add_facet(['crown_rear', f'parietal_mid_{s}', f'occiput_lat_{s}', 'occiput_hi'], 'hair_base')
    add_facet(['occiput_hi', 'occiput_mid', f'mastoid_{s}', f'occiput_lat_{s}'], 'hair_base') if s==1 else add_facet(['occiput_hi', f'occiput_lat_{s}', f'mastoid_{s}', 'occiput_mid'], 'hair_base')
    add_facet(['occiput_mid', 'occiput_lo', 'nape', f'mastoid_{s}'], 'hair_base') if s==1 else add_facet(['occiput_mid', f'mastoid_{s}', 'nape', 'occiput_lo'], 'hair_base')
    add_facet(['crown_front', f'parietal_hi_{s}', f'temple_hi_{s}', f'forehead_lat_hi_{s}'], 'hair_highlight') if s==1 else add_facet(['crown_front', f'forehead_lat_hi_{s}', f'temple_hi_{s}', f'parietal_hi_{s}'], 'hair_highlight')
    add_facet([f'parietal_hi_{s}', f'parietal_mid_{s}', f'ear_helix_hi_{s}', f'temple_hi_{s}'], 'hair_base') if s==1 else add_facet([f'parietal_hi_{s}', f'temple_hi_{s}', f'ear_helix_hi_{s}', f'parietal_mid_{s}'], 'hair_base')
    add_facet([f'parietal_mid_{s}', f'occiput_lat_{s}', f'mastoid_{s}', f'ear_helix_hi_{s}'], 'hair_base') if s==1 else add_facet([f'parietal_mid_{s}', f'ear_helix_hi_{s}', f'mastoid_{s}', f'occiput_lat_{s}'], 'hair_base')

create_poly_object("TargetLowPolyHeadUnified_R16", vert_list, faces_list, faces_mat, parent=head)
print(f"Head R16 created: {len(vert_list)} verts, {len(faces_list)} faces.")

# 4. Attire & Hair for R16
cowlick_v = [
    Vector(( 0.000, -0.068, 0.160)), # 0
    Vector(( 0.026, -0.082, 0.148)), # 1
    Vector(( 0.052, -0.086, 0.128)), # 2
    Vector(( 0.072, -0.078, 0.098)), # 3
    Vector(( 0.016, -0.092, 0.126)), # 4
    Vector(( 0.040, -0.094, 0.108)), # 5
    Vector((-0.026, -0.082, 0.148)), # 6
    Vector((-0.052, -0.086, 0.128)), # 7
    Vector((-0.072, -0.078, 0.098)), # 8
    Vector((-0.016, -0.092, 0.126)), # 9
    Vector((-0.040, -0.094, 0.108)), # 10
    Vector(( 0.000, -0.084, 0.136)), # 11
]
cowlick_f = [
    [0, 1, 4, 11], [1, 2, 5, 4], [2, 3, 5],
    [0, 11, 9, 6], [6, 9, 10, 7], [7, 10, 8],
]
cowlick_m = ['hair_highlight', 'hair_base', 'hair_highlight', 'hair_highlight', 'hair_base', 'hair_highlight']
create_poly_object("TargetLowPolyCowlick_R16", cowlick_v, cowlick_f, cowlick_m, parent=head)

crest_v = [
    Vector(( 0.000, -0.030, 0.162)), # 0
    Vector(( 0.032, -0.012, 0.166)), # 1
    Vector((-0.032, -0.012, 0.166)), # 2
    Vector(( 0.000,  0.038, 0.170)), # 3
    Vector(( 0.048,  0.032, 0.164)), # 4
    Vector((-0.048,  0.032, 0.164)), # 5
]
crest_f = [[0, 1, 3], [0, 3, 2], [1, 4, 3], [2, 3, 5]]
crest_m = ['hair_highlight', 'hair_base', 'hair_highlight', 'hair_base']
create_poly_object("TargetLowPolyCrownCrest_R16", crest_v, crest_f, crest_m, parent=head)

for s in [-1, 1]:
    sl_v = [
        Vector((s * 0.076, -0.044,  0.116)),
        Vector((s * 0.092, -0.048,  0.114)),
        Vector((s * 0.084, -0.034,  0.110)),
        Vector((s * 0.084, -0.068,  0.066)),
        Vector((s * 0.100, -0.062,  0.062)),
        Vector((s * 0.094, -0.046,  0.056)),
        Vector((s * 0.076, -0.059,  0.012)),
        Vector((s * 0.092, -0.052,  0.008)),
        Vector((s * 0.086, -0.038,  0.002)),
        Vector((s * 0.070, -0.064, -0.042)),
        Vector((s * 0.084, -0.054, -0.048)),
        Vector((s * 0.078, -0.040, -0.050)),
        Vector((s * 0.064, -0.056, -0.082)),
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
    sl_m = ['hair_highlight', 'hair_base', 'hair_highlight', 'hair_base',
            'hair_highlight', 'hair_base', 'hair_highlight', 'hair_base']
    create_poly_object(f"TargetLowPolySideLock_R16_{s}", sl_v, sl_f, sl_m, parent=head)

# Save Round 16
r16_blend = BASE / 'assets/models/optimized/human-courier-production-v2/head-round16/courier.blend'
r16_blend.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(r16_blend))
print(f"Saved: {r16_blend}")
