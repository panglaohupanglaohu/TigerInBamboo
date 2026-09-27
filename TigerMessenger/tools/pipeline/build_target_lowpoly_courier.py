import bpy
import bmesh
import math
from math import pi, sin, cos
from mathutils import Vector, Matrix, Euler, Quaternion
import sys
import json
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
DEST = BASE / 'assets/models/optimized/human-courier-production-v2'
REVIEW = BASE / 'artifacts/pipeline/courier-renders'
DEST.mkdir(exist_ok=True, parents=True)
REVIEW.mkdir(exist_ok=True, parents=True)

# 8-Color Palette strictly sampled from user target image (media_1789766326409.png)
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

def create_mesh_obj(name, verts, faces, mat_name, parent=None):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    for poly in mesh.polygons:
        poly.use_smooth = False # True low-poly flat shading
    obj = bpy.data.objects.new(name, mesh)
    if mat_name in PALETTE:
        mat = get_or_create_material(mat_name, PALETTE[mat_name], 
                                     roughness=0.35 if 'gold' in mat_name else 0.85,
                                     metallic=0.65 if 'gold' in mat_name else 0.0)
        obj.data.materials.append(mat)
    bpy.context.scene.collection.objects.link(obj)
    if parent:
        obj.parent = parent
    return obj

print("Helper functions ready.")
