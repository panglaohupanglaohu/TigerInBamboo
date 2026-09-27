import bpy
import bmesh
import math
from math import pi, sin, cos
from mathutils import Vector, Matrix, Euler
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]

def run_round(round_num):
    print(f"==================================================")
    print(f"   Building Round {round_num} (Stage {round_num})")
    print(f"==================================================")
    
    source_blend = BASE / 'assets/models/optimized/human-courier-production-v2/head-round1/courier.blend'
    bpy.ops.wm.open_mainfile(filepath=str(source_blend))

    scene = bpy.context.scene
    head = bpy.data.objects.get('head')
    assert head, "Head object must exist"

    # Purge previous test objects
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

    # 1. Material Palette
    PALETTE = {
        'skin_highlight': (0.870, 0.730, 0.590, 1.0) if round_num >= 26 else (0.860, 0.720, 0.580, 1.0), # Forehead, bridge highlight, cheek apex
        'skin_mid':       (0.750, 0.580, 0.430, 1.0), # Warm sun-kissed tan skin
        'skin_shadow':    (0.560, 0.400, 0.280, 1.0) if round_num >= 26 else (0.580, 0.420, 0.300, 1.0), # Orbit recess, jaw shadow, subnasal
        'skin_deep':      (0.320, 0.200, 0.140, 1.0) if round_num >= 27 else (0.350, 0.220, 0.150, 1.0), # Deep upper eyelid crease & nostrils
        'lip_rose':       (0.730, 0.470, 0.410, 1.0) if round_num >= 28 else ((0.710, 0.460, 0.400, 1.0) if round_num >= 19 else (0.580, 0.400, 0.300, 1.0)), # Warm rosy lips
        'lip_shadow':     (0.460, 0.260, 0.220, 1.0), # Mentolabial crease
        'beard_dark':     (0.130, 0.105, 0.095, 1.0) if round_num >= 29 else ((0.140, 0.115, 0.105, 1.0) if round_num >= 17 else (0.190, 0.160, 0.150, 1.0)), # Rich dark espresso
        'beard_stubble':  (0.410, 0.300, 0.230, 1.0) if round_num >= 29 else ((0.440, 0.330, 0.260, 1.0) if round_num >= 20 else (0.580, 0.420, 0.300, 1.0)), # Cheek 5 o'clock stubble
        'hair_base':      (0.115, 0.095, 0.088, 1.0) if round_num >= 30 else ((0.125, 0.105, 0.098, 1.0) if round_num >= 17 else (0.165, 0.135, 0.125, 1.0)), # Deep dark hair base
        'hair_highlight': (0.220, 0.180, 0.160, 1.0), # Hair lock ridge highlights
        'shirt_ivory':    (0.880, 0.850, 0.780, 1.0), # Crisp ivory linen shirt
        'shirt_shadow':   (0.740, 0.700, 0.620, 1.0), # Shirt fold shadow
        'cape_wine':      (0.380, 0.110, 0.130, 1.0), # Rich wine cowl
        'cape_wine_hi':   (0.500, 0.150, 0.170, 1.0), # Wine cape fold highlight
        'tunic_teal':     (0.150, 0.280, 0.270, 1.0), # Teal lining fold
        'clasp_gold':     (0.750, 0.580, 0.220, 1.0) if round_num >= 30 else (0.720, 0.560, 0.240, 1.0), # Antique gold brooch & bun ring
        'clasp_gold_hi':  (0.880, 0.730, 0.340, 1.0), # Clasp highlight
        'iris_amber':     (0.720, 0.480, 0.180, 1.0) if round_num >= 27 else (0.660, 0.450, 0.190, 1.0), # Warm glowing amber iris
        'sclera_white':   (0.940, 0.910, 0.860, 1.0) if round_num >= 27 else (0.920, 0.890, 0.840, 1.0), # Crisp eye sclera
        'pupil_black':    (0.040, 0.030, 0.025, 1.0), # Deep dark pupil
        'eye_highlight':  (1.000, 1.000, 1.000, 1.0), # Sparkling specular eye catchlight
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
            bsdf.inputs['Metallic'].default_value = metallic
        return mat

    for k, v in PALETTE.items():
        get_or_create_material(
            k, v,
            roughness=0.35 if 'gold' in k else (0.25 if 'highlight' in k and 'eye' in k else 0.88),
            metallic=0.85 if 'gold' in k else 0.0
        )

    def create_poly_object(name, verts, faces, face_materials, parent=head):
        me = bpy.data.meshes.new(name + "_Mesh")
        bm = bmesh.new()
        bm_verts = [bm.verts.new(v) for v in verts]
        bm.verts.ensure_lookup_table()
        
        mat_slot_map = {}
        for f_idx, f_indices in enumerate(faces):
            try:
                face_v = [bm_verts[i] for i in f_indices]
                f = bm.faces.new(face_v)
                m_name = face_materials[f_idx]
                if m_name not in mat_slot_map:
                    mat = bpy.data.materials.get(m_name)
                    me.materials.append(mat)
                    mat_slot_map[m_name] = len(me.materials) - 1
                f.material_index = mat_slot_map[m_name]
            except Exception as e:
                print(f"Face add error {f_indices}: {e}")
                
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        
        for p in me.polygons:
            p.use_smooth = False
            
        obj = bpy.data.objects.new(name, me)
        bpy.context.scene.collection.objects.link(obj)
        if parent:
            obj.parent = parent
            obj.matrix_parent_inverse = Matrix.Identity(4)
        return obj

    # -------------------------------------------------------------
    # 2. Sagittal & Bilateral Head Vertices (Rounds 16 ~ 25)
    # -------------------------------------------------------------
    V_map = {}
    def add_v(name, pos):
        V_map[name] = Vector(pos)

    # Sagittal Centerline (x = 0)
    add_v('crown_front',   (0.000, -0.035,  0.152))
    add_v('forehead_hi',    (0.000, -0.065,  0.136))
    add_v('forehead_mid',   (0.000, -0.076,  0.112))
    add_v('glabella_top',   (0.000, -0.082,  0.093))
    add_v('glabella_bot',   (0.000, -0.086,  0.080))
    add_v('sellion',        (0.000, -0.088,  0.070))
    
    # Nose projection (refined, slender classical bridge)
    nose_proj = -0.114 if round_num >= 18 else -0.118
    add_v('rhinion',        (0.000, -0.099,  0.046))
    add_v('supratip',       (0.000, -0.107,  0.026))
    add_v('nasal_tip',      (0.000, nose_proj, 0.016))
    add_v('infratip',       (0.000, -0.103,  0.008))
    add_v('subnasale',      (0.000, -0.089,  0.002))
    
    # Philtrum & Mouth Centerline
    lip_proj = -0.089 if round_num >= 19 else -0.092
    add_v('philtrum_trough',(0.000, -0.086, -0.008))
    add_v('upper_lip',      (0.000, lip_proj, -0.016))
    add_v('mouth_center',   (0.000, -0.083, -0.023))
    add_v('lower_lip',      (0.000, -0.086, -0.030))
    add_v('chin_groove',    (0.000, -0.076, -0.043))
    
    # Chin & Watertight Throat Transition (Zero Holes!)
    chin_p = -0.083 if round_num >= 16 else -0.087
    add_v('chin_apex',      (0.000, chin_p, -0.059))
    add_v('chin_base',      (0.000, -0.068, -0.074))
    add_v('submental',      (0.000, -0.045, -0.082)) # Submental plate closing hole
    add_v('throat',         (0.000, -0.025, -0.088)) # Direct neck front weld

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
        
        # Eyebrows: Sword Brow Arch & Sharp Lateral Drop (R17+ / R26+ Heroic Sword Brow Peak)
        brow_z = 0.100 if round_num >= 26 else (0.096 if round_num >= 17 else 0.092)
        brow_in_y = -0.093 if round_num >= 26 else -0.091
        add_v(f'glabella_lat_{s}',     (s * 0.014, -0.086, 0.087))
        add_v(f'brow_in_{s}',          (s * 0.015, brow_in_y, 0.090))
        add_v(f'brow_mid_{s}',         (s * 0.043, -0.089, brow_z))
        add_v(f'brow_tail_{s}',        (s * 0.073, -0.061, 0.076))
        
        # Eye Socket Crease (Deep Upper Eyelid Fold)
        add_v(f'crease_in_{s}',        (s * 0.018, -0.084, 0.077))
        add_v(f'crease_mid_{s}',       (s * 0.041, -0.082, 0.082))
        add_v(f'crease_out_{s}',       (s * 0.063, -0.060, 0.073))
        
        # Eye Contour: Heroic Open Almond Eye (R17+ / R27+ Catchlight Almond)
        eye_open = 0.054 if round_num >= 27 else (0.056 if round_num >= 17 else 0.059)
        add_v(f'eye_in_{s}',           (s * 0.019, -0.081, 0.063))
        add_v(f'eye_top_{s}',          (s * 0.038, -0.078, 0.074))
        add_v(f'eye_out_{s}',          (s * 0.059, -0.057, 0.067))
        add_v(f'eye_bot_{s}',          (s * 0.038, -0.074, eye_open))
        
        # Iris & Pupil & Catchlight (R27+)
        add_v(f'iris_in_{s}',          (s * 0.027, -0.078, 0.065))
        add_v(f'iris_out_{s}',         (s * 0.048, -0.069, 0.065))
        add_v(f'pupil_top_{s}',        (s * 0.038, -0.076, 0.068))
        add_v(f'pupil_bot_{s}',        (s * 0.038, -0.073, 0.062))
        add_v(f'glint_{s}',            (s * 0.042, -0.078, 0.071)) # Specular eye highlight facet
        
        # Orbit Floor
        add_v(f'orbit_fl_in_{s}',      (s * 0.022, -0.075, 0.049))
        add_v(f'orbit_fl_mid_{s}',     (s * 0.042, -0.069, 0.045))
        add_v(f'orbit_fl_out_{s}',     (s * 0.065, -0.052, 0.049))
        
        # Slender Classical Nose Bridge & Wings (R18+)
        n_mid_x = 0.010 if round_num >= 18 else 0.013
        add_v(f'nose_slope_hi_{s}',    (s * 0.009, -0.090, 0.063))
        add_v(f'nose_slope_mid_{s}',   (s * n_mid_x, -0.098, 0.040))
        add_v(f'nose_slope_lo_{s}',    (s * 0.013, -0.104, 0.024))
        add_v(f'ala_crest_{s}',        (s * 0.022, -0.096, 0.014))
        add_v(f'ala_base_{s}',         (s * 0.023, -0.086, 0.004))
        
        # Cheeks & Zygoma
        add_v(f'zygoma_apex_{s}',      (s * 0.082, -0.036, 0.056))
        add_v(f'cheek_ant_{s}',        (s * 0.048, -0.062, 0.028))
        add_v(f'cheek_mid_{s}',        (s * 0.064, -0.048, 0.024))
        add_v(f'cheek_hollow_{s}',     (s * 0.065, -0.040, 0.004))
        
        # Philtrum & Mouth (R19+ / R28+ Cupid's Bow & Resolute Lips)
        corner_z = -0.0195 if round_num >= 28 else (-0.0205 if round_num >= 19 else -0.0235)
        peak_y = -0.092 if round_num >= 28 else -0.091
        add_v(f'philtrum_col_{s}',     (s * 0.0075, -0.088, -0.007))
        add_v(f'upper_lip_peak_{s}',   (s * 0.0135, peak_y, -0.0135))
        add_v(f'mouth_corner_{s}',     (s * 0.029, -0.074, corner_z))
        add_v(f'lower_lip_lat_{s}',    (s * 0.017, -0.084, -0.0285))
        
        # Watertight Boxed Chin & Jaw (R16+ & R20+)
        chin_w = 0.027 if round_num >= 16 else 0.024
        add_v(f'chin_lat_apex_{s}',    (s * chin_w, -0.080, -0.060))
        add_v(f'chin_lat_base_{s}',    (s * chin_w, -0.066, -0.075))
        add_v(f'submental_lat_{s}',    (s * 0.030,  -0.042, -0.080))
        add_v(f'jaw_body_{s}',         (s * 0.054,  -0.042, -0.055))
        add_v(f'jaw_angle_{s}',        (s * 0.070,   0.006, -0.035))
        
        # Ears (R23+)
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
        add_facet([f'temple_hi_{s}', f'temple_lo_{s}', f'forehead_lat_lo_{s}'], 'skin_mid') if s==1 else add_facet([f'temple_hi_{s}', f'forehead_lat_lo_{s}', f'temple_lo_{s}'], 'skin_mid')
        add_facet([f'temple_hi_{s}', f'ear_helix_hi_{s}', f'temple_lo_{s}'], 'hair_base') if s==1 else add_facet([f'temple_hi_{s}', f'temple_lo_{s}', f'ear_helix_hi_{s}'], 'hair_base')

        # Glabella Keystone
        add_facet(['glabella_top', f'brow_in_{s}', f'glabella_lat_{s}', 'glabella_bot'], 'skin_highlight') if s==1 else add_facet(['glabella_top', 'glabella_bot', f'glabella_lat_{s}', f'brow_in_{s}'], 'skin_highlight')
        add_facet(['glabella_bot', f'glabella_lat_{s}', 'sellion'], 'skin_mid') if s==1 else add_facet(['glabella_bot', 'sellion', f'glabella_lat_{s}'], 'skin_mid')
        # Seal inner brow / sellion gap
        add_facet(['sellion', f'glabella_lat_{s}', f'brow_in_{s}', f'crease_in_{s}'], 'skin_mid') if s==1 else add_facet(['sellion', f'crease_in_{s}', f'brow_in_{s}', f'glabella_lat_{s}'], 'skin_mid')

        # Eyebrows (Sword Brow Ridge)
        add_facet([f'brow_in_{s}', f'brow_mid_{s}', f'crease_mid_{s}', f'crease_in_{s}'], 'beard_dark') if s==1 else add_facet([f'brow_in_{s}', f'crease_in_{s}', f'crease_mid_{s}', f'brow_mid_{s}'], 'beard_dark')
        add_facet([f'brow_mid_{s}', f'brow_tail_{s}', f'crease_out_{s}', f'crease_mid_{s}'], 'beard_dark') if s==1 else add_facet([f'brow_mid_{s}', f'crease_mid_{s}', f'crease_out_{s}', f'brow_tail_{s}'], 'beard_dark')

        # Deep Upper Eyelid Crease
        add_facet([f'crease_in_{s}', f'crease_mid_{s}', f'eye_top_{s}', f'eye_in_{s}'], 'skin_deep') if s==1 else add_facet([f'crease_in_{s}', f'eye_in_{s}', f'eye_top_{s}', f'crease_mid_{s}'], 'skin_deep')
        add_facet([f'crease_mid_{s}', f'crease_out_{s}', f'eye_out_{s}', f'eye_top_{s}'], 'skin_deep') if s==1 else add_facet([f'crease_mid_{s}', f'eye_top_{s}', f'eye_out_{s}', f'crease_out_{s}'], 'skin_deep')
        # Seal outer eye corner
        add_facet([f'crease_out_{s}', f'eye_out_{s}', f'orbit_fl_out_{s}'], 'skin_deep') if s==1 else add_facet([f'crease_out_{s}', f'orbit_fl_out_{s}', f'eye_out_{s}'], 'skin_deep')

        # Eye Contour with Sclera, Amber Iris, Pupil and Catchlight (R17+)
        add_facet([f'eye_in_{s}', f'eye_top_{s}', f'iris_in_{s}'], 'sclera_white') if s==1 else add_facet([f'eye_in_{s}', f'iris_in_{s}', f'eye_top_{s}'], 'sclera_white')
        add_facet([f'eye_in_{s}', f'iris_in_{s}', f'eye_bot_{s}'], 'sclera_white') if s==1 else add_facet([f'eye_in_{s}', f'eye_bot_{s}', f'iris_in_{s}'], 'sclera_white')
        
        # Iris & Pupil & Specular Catchlight
        if round_num >= 17:
            add_facet([f'iris_in_{s}', f'eye_top_{s}', f'pupil_top_{s}'], 'iris_amber') if s==1 else add_facet([f'iris_in_{s}', f'pupil_top_{s}', f'eye_top_{s}'], 'iris_amber')
            add_facet([f'iris_in_{s}', f'pupil_bot_{s}', f'eye_bot_{s}'], 'iris_amber') if s==1 else add_facet([f'iris_in_{s}', f'eye_bot_{s}', f'pupil_bot_{s}'], 'iris_amber')
            add_facet([f'iris_in_{s}', f'pupil_top_{s}', f'glint_{s}', f'pupil_bot_{s}'], 'pupil_black') if s==1 else add_facet([f'iris_in_{s}', f'pupil_bot_{s}', f'glint_{s}', f'pupil_top_{s}'], 'pupil_black')
            add_facet([f'pupil_top_{s}', f'eye_top_{s}', f'glint_{s}'], 'eye_highlight') if s==1 else add_facet([f'pupil_top_{s}', f'glint_{s}', f'eye_top_{s}'], 'eye_highlight')
            add_facet([f'eye_top_{s}', f'iris_out_{s}', f'glint_{s}'], 'iris_amber') if s==1 else add_facet([f'eye_top_{s}', f'glint_{s}', f'iris_out_{s}'], 'iris_amber')
            add_facet([f'pupil_bot_{s}', f'glint_{s}', f'iris_out_{s}', f'eye_bot_{s}'], 'iris_amber') if s==1 else add_facet([f'pupil_bot_{s}', f'eye_bot_{s}', f'iris_out_{s}', f'glint_{s}'], 'iris_amber')
        else:
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

        # Nose Bridge (Slender Classical 5-Facet Bridge)
        add_facet(['sellion', f'nose_slope_hi_{s}', f'eye_in_{s}', f'crease_in_{s}'], 'skin_mid') if s==1 else add_facet(['sellion', f'crease_in_{s}', f'eye_in_{s}', f'nose_slope_hi_{s}'], 'skin_mid')
        add_facet(['sellion', 'rhinion', f'nose_slope_mid_{s}', f'nose_slope_hi_{s}'], 'skin_highlight') if s==1 else add_facet(['sellion', f'nose_slope_hi_{s}', f'nose_slope_mid_{s}', 'rhinion'], 'skin_highlight')
        add_facet(['rhinion', 'supratip', f'nose_slope_lo_{s}', f'nose_slope_mid_{s}'], 'skin_highlight') if s==1 else add_facet(['rhinion', f'nose_slope_mid_{s}', f'nose_slope_lo_{s}', 'supratip'], 'skin_highlight')
        add_facet(['supratip', 'nasal_tip', f'ala_crest_{s}', f'nose_slope_lo_{s}'], 'skin_highlight') if s==1 else add_facet(['supratip', f'nose_slope_lo_{s}', f'ala_crest_{s}', 'nasal_tip'], 'skin_highlight')

        # Subnasal Tip & Alar wings
        add_facet(['nasal_tip', 'infratip', f'ala_crest_{s}'], 'skin_shadow') if s==1 else add_facet(['nasal_tip', f'ala_crest_{s}', 'infratip'], 'skin_shadow')
        add_facet(['infratip', 'subnasale', f'ala_base_{s}', f'ala_crest_{s}'], 'skin_deep' if round_num >= 18 else 'skin_shadow') if s==1 else add_facet(['infratip', f'ala_crest_{s}', f'ala_base_{s}', 'subnasale'], 'skin_deep' if round_num >= 18 else 'skin_shadow')

        # Cheeks & Zygoma
        add_facet([f'nose_slope_hi_{s}', f'nose_slope_mid_{s}', f'orbit_fl_in_{s}', f'eye_in_{s}'], 'skin_mid') if s==1 else add_facet([f'nose_slope_hi_{s}', f'eye_in_{s}', f'orbit_fl_in_{s}', f'nose_slope_mid_{s}'], 'skin_mid')
        add_facet([f'nose_slope_mid_{s}', f'nose_slope_lo_{s}', f'ala_crest_{s}', f'orbit_fl_in_{s}'], 'skin_highlight') if s==1 else add_facet([f'nose_slope_mid_{s}', f'orbit_fl_in_{s}', f'ala_crest_{s}', f'nose_slope_lo_{s}'], 'skin_highlight')
        add_facet([f'ala_crest_{s}', f'cheek_ant_{s}', f'orbit_fl_mid_{s}', f'orbit_fl_in_{s}'], 'skin_highlight') if s==1 else add_facet([f'ala_crest_{s}', f'orbit_fl_in_{s}', f'orbit_fl_mid_{s}', f'cheek_ant_{s}'], 'skin_highlight')
        add_facet([f'orbit_fl_mid_{s}', f'cheek_ant_{s}', f'cheek_mid_{s}', f'orbit_fl_out_{s}'], 'skin_highlight') if s==1 else add_facet([f'orbit_fl_mid_{s}', f'orbit_fl_out_{s}', f'cheek_mid_{s}', f'cheek_ant_{s}'], 'skin_highlight')
        add_facet([f'orbit_fl_out_{s}', f'cheek_mid_{s}', f'zygoma_apex_{s}'], 'skin_highlight') if s==1 else add_facet([f'orbit_fl_out_{s}', f'zygoma_apex_{s}', f'cheek_mid_{s}'], 'skin_highlight')
        add_facet([f'crease_out_{s}', f'brow_tail_{s}', f'temple_lo_{s}', f'orbit_fl_out_{s}'], 'skin_mid') if s==1 else add_facet([f'crease_out_{s}', f'orbit_fl_out_{s}', f'temple_lo_{s}', f'brow_tail_{s}'], 'skin_mid')
        add_facet([f'temple_lo_{s}', f'zygoma_apex_{s}', f'orbit_fl_out_{s}'], 'skin_mid') if s==1 else add_facet([f'temple_lo_{s}', f'orbit_fl_out_{s}', f'zygoma_apex_{s}'], 'skin_mid')

        # Philtrum Column & Mustache (R20+)
        add_facet(['subnasale', f'ala_base_{s}', f'mouth_corner_{s}', f'upper_lip_peak_{s}', f'philtrum_col_{s}'], 'beard_dark') if s==1 else add_facet(['subnasale', f'philtrum_col_{s}', f'upper_lip_peak_{s}', f'mouth_corner_{s}', f'ala_base_{s}'], 'beard_dark')
        add_facet(['subnasale', f'philtrum_col_{s}', 'philtrum_trough'], 'skin_mid') if s==1 else add_facet(['subnasale', 'philtrum_trough', f'philtrum_col_{s}'], 'skin_mid')
        add_facet(['philtrum_trough', f'philtrum_col_{s}', f'upper_lip_peak_{s}', 'upper_lip'], 'skin_shadow') if s==1 else add_facet(['philtrum_trough', 'upper_lip', f'upper_lip_peak_{s}', f'philtrum_col_{s}'], 'skin_shadow')

        # Lips: Warm Rosy Tone (R19+)
        lip_mat = 'lip_rose' if round_num >= 19 else 'skin_shadow'
        lip_hi = 'lip_rose' if round_num >= 19 else 'skin_highlight'
        add_facet(['upper_lip', f'upper_lip_peak_{s}', f'mouth_corner_{s}', 'mouth_center'], lip_mat) if s==1 else add_facet(['upper_lip', 'mouth_center', f'mouth_corner_{s}', f'upper_lip_peak_{s}'], lip_mat)
        add_facet(['mouth_center', f'mouth_corner_{s}', f'lower_lip_lat_{s}', 'lower_lip'], lip_hi) if s==1 else add_facet(['mouth_center', 'lower_lip', f'lower_lip_lat_{s}', f'mouth_corner_{s}'], lip_hi)

        # CRUCIAL FIX: 100% Seal the triangle between mouth corner, lower lip lat, and chin lat apex!
        add_facet([f'mouth_corner_{s}', f'lower_lip_lat_{s}', f'chin_lat_apex_{s}'], 'beard_dark') if s==1 else add_facet([f'mouth_corner_{s}', f'chin_lat_apex_{s}', f'lower_lip_lat_{s}'], 'beard_dark')

        # Soul patch & Mentolabial Sulcus
        add_facet(['lower_lip', f'lower_lip_lat_{s}', 'chin_groove'], 'lip_shadow' if round_num >= 19 else 'skin_shadow') if s==1 else add_facet(['lower_lip', 'chin_groove', f'lower_lip_lat_{s}'], 'lip_shadow' if round_num >= 19 else 'skin_shadow')
        add_facet(['chin_groove', f'lower_lip_lat_{s}', f'chin_lat_apex_{s}', 'chin_apex'], 'beard_dark') if s==1 else add_facet(['chin_groove', 'chin_apex', f'chin_lat_apex_{s}', f'lower_lip_lat_{s}'], 'beard_dark')
        add_facet(['chin_apex', f'chin_lat_apex_{s}', f'chin_lat_base_{s}', 'chin_base'], 'beard_dark') if s==1 else add_facet(['chin_apex', 'chin_base', f'chin_lat_base_{s}', f'chin_lat_apex_{s}'], 'beard_dark')

        # Mid Cheek & Jaw beard & Stubble (R20+)
        stubble_mat = 'beard_stubble' if round_num >= 20 else 'skin_shadow'
        add_facet([f'ala_crest_{s}', f'ala_base_{s}', f'mouth_corner_{s}', f'cheek_ant_{s}'], 'skin_mid') if s==1 else add_facet([f'ala_crest_{s}', f'cheek_ant_{s}', f'mouth_corner_{s}', f'ala_base_{s}'], 'skin_mid')
        add_facet([f'cheek_ant_{s}', f'mouth_corner_{s}', f'cheek_hollow_{s}', f'cheek_mid_{s}'], stubble_mat) if s==1 else add_facet([f'cheek_ant_{s}', f'cheek_mid_{s}', f'cheek_hollow_{s}', f'mouth_corner_{s}'], stubble_mat)
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
        # Seal ear helix to mastoid
        add_facet([f'ear_helix_hi_{s}', f'ear_helix_mid_{s}', f'mastoid_{s}'], 'hair_base') if s==1 else add_facet([f'ear_helix_hi_{s}', f'mastoid_{s}', f'ear_helix_mid_{s}'], 'hair_base')

        # 100% Watertight Sealed Chin Base, Submental Plate & Neck (Round 16+ Fixes Chin Hole!)
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

    create_poly_object(f"TargetLowPolyHeadUnified_R{round_num}", vert_list, faces_list, faces_mat, parent=head)
    print(f"Head R{round_num} created: {len(vert_list)} verts, {len(faces_list)} faces.")

    # -------------------------------------------------------------
    # 3. Volumetric Hair System (R21+ Cascading Back Hair & Bun)
    # -------------------------------------------------------------
    # Forehead Fringe & Cowlicks (R22+ Parted Wavy Fringe)
    cowlick_v = [
        Vector(( 0.000, -0.068, 0.160)), # 0 Apex root
        Vector(( 0.026, -0.082, 0.148)), # 1 Right crest ridge
        Vector(( 0.052, -0.086, 0.128)), # 2 Right mid
        Vector(( 0.072, -0.078, 0.098)), # 3 Right swoop tip
        Vector(( 0.016, -0.092, 0.126)), # 4 Right undercut
        Vector(( 0.040, -0.094, 0.108)), # 5 Right undercut mid
        Vector((-0.026, -0.082, 0.148)), # 6 Left crest ridge
        Vector((-0.052, -0.086, 0.128)), # 7 Left mid
        Vector((-0.072, -0.078, 0.098)), # 8 Left swoop tip
        Vector((-0.016, -0.092, 0.126)), # 9 Left undercut
        Vector((-0.040, -0.094, 0.108)), # 10 Left undercut mid
        Vector(( 0.000, -0.084, 0.136)), # 11 Parting notch shadow
    ]
    cowlick_f = [
        [0, 1, 4, 11], [1, 2, 5, 4], [2, 3, 5],
        [0, 11, 9, 6], [6, 9, 10, 7], [7, 10, 8],
    ]
    cowlick_m = [
        'hair_highlight', 'hair_base', 'hair_highlight',
        'hair_highlight', 'hair_base', 'hair_highlight'
    ]
    create_poly_object(f"TargetLowPolyCowlick_R{round_num}", cowlick_v, cowlick_f, cowlick_m, parent=head)

    # Top Crown Wavy Crests
    crest_v = [
        Vector(( 0.000, -0.030, 0.165)), # 0
        Vector(( 0.036, -0.012, 0.168)), # 1
        Vector((-0.036, -0.012, 0.168)), # 2
        Vector(( 0.000,  0.038, 0.174)), # 3
        Vector(( 0.052,  0.032, 0.168)), # 4
        Vector((-0.052,  0.032, 0.168)), # 5
    ]
    crest_f = [[0, 1, 3], [0, 3, 2], [1, 4, 3], [2, 3, 5]]
    crest_m = ['hair_highlight', 'hair_base', 'hair_highlight', 'hair_base']
    create_poly_object(f"TargetLowPolyCrownCrest_R{round_num}", crest_v, crest_f, crest_m, parent=head)

    # Cascading Back Hair (R21+: Massive Flowing Wavy Mane to Shoulders)
    if round_num >= 21:
        back_hair_v = [
            Vector(( 0.000,  0.075,  0.138)), # 0 Root top
            Vector((-0.070,  0.065,  0.125)), # 1 Left top
            Vector(( 0.070,  0.065,  0.125)), # 2 Right top
            Vector(( 0.000,  0.098,  0.085)), # 3 Tier 1 center ridge
            Vector((-0.098,  0.055,  0.070)), # 4 Tier 1 left wave
            Vector(( 0.098,  0.055,  0.070)), # 5 Tier 1 right wave
            Vector(( 0.000,  0.092,  0.020)), # 6 Tier 2 center trough
            Vector((-0.118,  0.045,  0.005)), # 7 Tier 2 left crest
            Vector(( 0.118,  0.045,  0.005)), # 8 Tier 2 right crest
            Vector(( 0.000,  0.088, -0.055)), # 9 Tier 3 center crest
            Vector((-0.124,  0.040, -0.065)), # 10 Tier 3 left wave
            Vector(( 0.124,  0.040, -0.065)), # 11 Tier 3 right wave
            Vector(( 0.000,  0.082, -0.125)), # 12 Shoulder drape center
            Vector((-0.115,  0.045, -0.135)), # 13 Shoulder drape left tip
            Vector(( 0.115,  0.045, -0.135)), # 14 Shoulder drape right tip
        ]
        back_hair_f = [
            [0, 1, 4, 3], [0, 3, 5, 2],
            [3, 4, 7, 6], [3, 6, 8, 5],
            [6, 7, 10, 9], [6, 9, 11, 8],
            [9, 10, 13, 12], [9, 12, 14, 11],
        ]
        back_hair_m = [
            'hair_base', 'hair_highlight',
            'hair_highlight', 'hair_base',
            'hair_base', 'hair_highlight',
            'hair_highlight', 'hair_base',
        ]
        create_poly_object(f"TargetLowPolyBackHair_R{round_num}", back_hair_v, back_hair_f, back_hair_m, parent=head)

    # Half-Up Bun & Clasp (R21+)
    if round_num >= 21:
        bun_v = [
            Vector(( 0.000,  0.095,  0.075)), # 0 Base front
            Vector(( 0.040,  0.105,  0.090)), # 1 Base right
            Vector((-0.040,  0.105,  0.090)), # 2 Base left
            Vector(( 0.000,  0.118,  0.125)), # 3 Apex top
            Vector(( 0.046,  0.132,  0.122)), # 4 Apex right
            Vector((-0.046,  0.132,  0.122)), # 5 Apex left
            Vector(( 0.000,  0.155,  0.092)), # 6 Rear apex
            Vector(( 0.038,  0.142,  0.070)), # 7 Rear right
            Vector((-0.038,  0.142,  0.070)), # 8 Rear left
            Vector(( 0.000,  0.124,  0.052)), # 9 Base rear
        ]
        bun_f = [
            [0, 1, 4, 3], [0, 3, 5, 2], [3, 4, 6], [3, 6, 5],
            [4, 7, 6], [5, 6, 8], [1, 7, 4], [2, 5, 8],
            [0, 9, 7, 1], [0, 2, 8, 9], [7, 9, 6], [8, 6, 9]
        ]
        bun_m = [
            'hair_highlight', 'hair_base', 'hair_highlight', 'hair_base',
            'hair_highlight', 'hair_base', 'hair_base', 'hair_highlight',
            'hair_base', 'hair_highlight', 'hair_base', 'hair_highlight'
        ]
        create_poly_object(f"TargetLowPolyBun_R{round_num}", bun_v, bun_f, bun_m, parent=head)

        # Bun Gold Band
        band_v = [
            Vector(( 0.000,  0.092,  0.072)), # 0
            Vector(( 0.042,  0.102,  0.088)), # 1
            Vector((-0.042,  0.102,  0.088)), # 2
            Vector(( 0.000,  0.115,  0.122)), # 3
            Vector(( 0.000,  0.098,  0.075)), # 4
            Vector(( 0.044,  0.108,  0.091)), # 5
            Vector((-0.044,  0.108,  0.091)), # 6
            Vector(( 0.000,  0.121,  0.125)), # 7
        ]
        band_f = [[0, 1, 5, 4], [1, 3, 7, 5], [3, 2, 6, 7], [2, 0, 4, 6]]
        band_m = ['clasp_gold'] * 4
        create_poly_object(f"TargetLowPolyBunBand_R{round_num}", band_v, band_f, band_m, parent=head)

    # Side Locks (R22+ Extended 3D Wave Flow Framing Cheeks)
    for s in [-1, 1]:
        if round_num >= 22:
            sl_v = [
                Vector((s * 0.068, -0.040,  0.125)), # 0 inner root
                Vector((s * 0.078, -0.044,  0.120)), # 1 ridge top
                Vector((s * 0.072, -0.034,  0.115)), # 2 outer top
                Vector((s * 0.072, -0.058,  0.066)), # 3 crest 1 inner
                Vector((s * 0.082, -0.054,  0.062)), # 4 crest 1 ridge
                Vector((s * 0.076, -0.042,  0.056)), # 5 crest 1 outer
                Vector((s * 0.064, -0.056,  0.012)), # 6 trough 1 inner
                Vector((s * 0.074, -0.050,  0.008)), # 7 trough 1 ridge
                Vector((s * 0.068, -0.038,  0.002)), # 8 trough 1 outer
                Vector((s * 0.058, -0.060, -0.042)), # 9 crest 2 inner
                Vector((s * 0.068, -0.052, -0.048)), # 10 crest 2 ridge
                Vector((s * 0.062, -0.038, -0.050)), # 11 crest 2 outer
                Vector((s * 0.052, -0.054, -0.086)), # 12 tip
            ]
        else:
            sl_v = [
                Vector((s * 0.068, -0.040,  0.125)),
                Vector((s * 0.078, -0.044,  0.120)),
                Vector((s * 0.072, -0.034,  0.115)),
                Vector((s * 0.072, -0.056,  0.060)),
                Vector((s * 0.080, -0.050,  0.056)),
                Vector((s * 0.074, -0.040,  0.052)),
                Vector((s * 0.064, -0.054,  0.000)),
                Vector((s * 0.072, -0.048, -0.004)),
                Vector((s * 0.066, -0.038, -0.008)),
                Vector((s * 0.058, -0.052, -0.045)),
                Vector((s * 0.064, -0.046, -0.050)),
                Vector((s * 0.060, -0.038, -0.052)),
                Vector((s * 0.054, -0.048, -0.080)),
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
        create_poly_object(f"TargetLowPolySideLock_R{round_num}_{s}", sl_v, sl_f, sl_m, parent=head)

    # -------------------------------------------------------------
    # 4. Attire: Ivory Shirt, Wine Cowl, Teal Fold, Sun Brooch
    # -------------------------------------------------------------
    # Opened V-Neck Linen Shirt (R23+)
    if round_num >= 23:
        shirt_v = [
            Vector(( 0.000, -0.042, -0.070)), # 0 Center V-neck top
            Vector((-0.050, -0.035, -0.075)), # 1 Left collar crest
            Vector(( 0.050, -0.035, -0.075)), # 2 Right collar crest
            Vector((-0.062,  0.015, -0.082)), # 3 Left lateral
            Vector(( 0.062,  0.015, -0.082)), # 4 Right lateral
            Vector(( 0.000, -0.078, -0.118)), # 5 Deep V notch
            Vector((-0.076, -0.052, -0.120)), # 6 Left lapel fold
            Vector(( 0.076, -0.052, -0.120)), # 7 Right lapel fold
            Vector((-0.088,  0.020, -0.122)), # 8 Left base
            Vector(( 0.088,  0.020, -0.122)), # 9 Right base
            Vector(( 0.000,  0.056, -0.084)), # 10 Rear neck top
            Vector(( 0.000,  0.065, -0.122)), # 11 Rear base
        ]
        shirt_f = [
            [0, 1, 6, 5], [0, 5, 7, 2], [1, 3, 8, 6], [2, 7, 9, 4],
            [3, 10, 11, 8], [4, 9, 11, 10]
        ]
        shirt_m = ['shirt_ivory', 'shirt_ivory', 'shirt_shadow', 'shirt_ivory',
                   'shirt_shadow', 'shirt_shadow']
        create_poly_object(f"TargetLowPolyShirt_R{round_num}", shirt_v, shirt_f, shirt_m, parent=head)

    # Draped Wine Red Cowl Cloak (R24+)
    if round_num >= 24:
        cowl_v = [
            Vector(( 0.000, -0.106, -0.076)), # 0
            Vector((-0.098, -0.078, -0.060)), # 1
            Vector(( 0.098, -0.078, -0.060)), # 2
            Vector((-0.145, -0.045, -0.068)), # 3
            Vector(( 0.145, -0.045, -0.068)), # 4
            Vector((-0.125,  0.065, -0.074)), # 5
            Vector(( 0.125,  0.065, -0.074)), # 6
            Vector(( 0.000,  0.085, -0.080)), # 7
            Vector((-0.042, -0.120, -0.120)), # 8 Front drape left
            Vector(( 0.042, -0.120, -0.120)), # 9 Front drape right
            Vector(( 0.000, -0.138, -0.134)), # 10 Deep front fold
            Vector((-0.128, -0.092, -0.124)), # 11
            Vector(( 0.128, -0.092, -0.124)), # 12
            Vector((-0.182, -0.038, -0.130)), # 13
            Vector(( 0.182, -0.038, -0.130)), # 14
            Vector((-0.150,  0.088, -0.134)), # 15
            Vector(( 0.150,  0.088, -0.134)), # 16
            Vector(( 0.000,  0.108, -0.144)), # 17
        ]
        cowl_f = [
            [1, 8, 10, 11], [1, 0, 8], [0, 2, 9, 8], [8, 9, 10], [2, 12, 10, 9],
            [1, 11, 13, 3], [2, 4, 14, 12], [3, 13, 15, 5], [4, 6, 16, 14],
            [5, 15, 17, 7], [6, 7, 17, 16],
        ]
        cowl_m = [
            'cape_wine_hi', 'cape_wine_hi', 'cape_wine', 'cape_wine_hi', 'cape_wine',
            'cape_wine', 'cape_wine', 'cape_wine', 'cape_wine', 'cape_wine', 'cape_wine',
        ]
        create_poly_object(f"TargetLowPolyCowl_R{round_num}", cowl_v, cowl_f, cowl_m, parent=head)

        # Teal Inner Lining Fold
        teal_v = [
            Vector(( 0.000, -0.110, -0.068)), # 0
            Vector((-0.092, -0.082, -0.054)), # 1
            Vector(( 0.092, -0.082, -0.054)), # 2
            Vector(( 0.000, -0.118, -0.072)), # 3
            Vector((-0.100, -0.088, -0.058)), # 4
            Vector(( 0.098, -0.088, -0.058)), # 5
        ]
        teal_f = [[0, 1, 4, 3], [0, 3, 5, 2]]
        teal_m = ['tunic_teal', 'tunic_teal']
        create_poly_object(f"TargetLowPolyTealLining_R{round_num}", teal_v, teal_f, teal_m, parent=head)

        # Antique Gold Sun Brooch (R24+)
        brooch_v = [
            Vector((-0.094, -0.088, -0.046)), # 0 Center jewel
            Vector((-0.118, -0.082, -0.066)), # 1 Left ray
            Vector((-0.070, -0.082, -0.066)), # 2 Right ray
            Vector((-0.094, -0.076, -0.086)), # 3 Bottom ray
            Vector((-0.094, -0.106, -0.066)), # 4 Top ray
            Vector((-0.094, -0.086, -0.038)), # 5 Outer apex
            Vector((-0.126, -0.080, -0.066)), # 6 Outer left
            Vector((-0.062, -0.080, -0.066)), # 7 Outer right
            Vector((-0.094, -0.074, -0.094)), # 8 Outer bottom
        ]
        brooch_f = [
            [0, 1, 4], [0, 4, 2], [1, 3, 4], [2, 4, 3],
            [0, 5, 1], [0, 2, 5], [1, 6, 3], [2, 3, 7],
            [1, 3, 8], [3, 2, 8]
        ]
        brooch_m = ['clasp_gold_hi', 'clasp_gold', 'clasp_gold_hi', 'clasp_gold',
                    'clasp_gold_hi', 'clasp_gold', 'clasp_gold', 'clasp_gold',
                    'clasp_gold', 'clasp_gold']
        create_poly_object(f"TargetLowPolyBrooch_R{round_num}", brooch_v, brooch_f, brooch_m, parent=head)
    else:
        # Base clean cowl for R16-R23
        base_cowl_v = [
            Vector(( 0.000, -0.095, -0.080)),
            Vector((-0.090, -0.070, -0.075)),
            Vector(( 0.090, -0.070, -0.075)),
            Vector((-0.130,  0.020, -0.085)),
            Vector(( 0.130,  0.020, -0.085)),
            Vector(( 0.000,  0.075, -0.090)),
            Vector((-0.035, -0.110, -0.125)),
            Vector(( 0.035, -0.110, -0.125)),
            Vector((-0.120, -0.080, -0.130)),
            Vector(( 0.120, -0.080, -0.130)),
            Vector((-0.160,  0.010, -0.135)),
            Vector(( 0.160,  0.010, -0.135)),
            Vector(( 0.000,  0.095, -0.140)),
        ]
        base_cowl_f = [
            [0, 1, 8, 6], [0, 6, 7], [0, 7, 9, 2], [1, 3, 10, 8], [2, 9, 11, 4],
            [3, 5, 12, 10], [4, 11, 12, 5],
        ]
        base_cowl_m = ['cape_wine'] * len(base_cowl_f)
        create_poly_object(f"TargetLowPolyCowl_R{round_num}", base_cowl_v, base_cowl_f, base_cowl_m, parent=head)

    # Save Round blend file
    out_blend = BASE / f'assets/models/optimized/human-courier-production-v2/head-round{round_num}/courier.blend'
    out_blend.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out_blend))
    print(f"Saved: {out_blend}")

    # If final round (R25 or R30), sync directly to production head/courier.blend
    if round_num in (25, 30):
        prod_blend = BASE / 'assets/models/optimized/human-courier-production-v2/head/courier.blend'
        bpy.ops.wm.save_as_mainfile(filepath=str(prod_blend))
        print(f"Synced to production: {prod_blend}")

if __name__ == '__main__':
    args = [a for a in sys.argv if a.isdigit()]
    if args:
        run_round(int(args[0]))
    else:
        for r in range(26, 31):
            run_round(r)
