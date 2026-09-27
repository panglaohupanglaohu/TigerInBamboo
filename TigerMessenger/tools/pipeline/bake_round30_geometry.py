import bpy
import json
import math
from math import pi
from mathutils import Matrix
from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
source_blend = BASE / 'assets/models/optimized/human-courier-production-v2/head-round30/courier.blend'
bpy.ops.wm.open_mainfile(filepath=str(source_blend))

C = Matrix.Rotation(pi / 2, 4, 'X')
CI = C.inverted()

# Collect objects to export
asset_objects = []
root = bpy.data.objects.get("Courier")
assert root, "Courier root object not found!"

def collect_tree(obj):
    # Skip hidden or studio objects
    if obj.name in ['Studio_floor', 'floor', 'TargetCam', 'KeyLight', 'FillLight', 'RimLight']:
        return
    if obj.name.startswith("Anatomy_beard_fiber") or obj.name.startswith("Fiber"):
        return
    asset_objects.append(obj)
    for child in obj.children:
        collect_tree(child)

collect_tree(root)
print(f"Collected {len(asset_objects)} objects for web export.")

nodes = []
for o in asset_objects:
    local_m = CI @ o.matrix_local @ C
    matrix = [round(v, 7) for col in local_m.transposed() for v in col]
    entry = {
        'name': o.name,
        'parent': o.parent.name if o.parent and o.parent in asset_objects else None,
        'matrix': matrix
    }
    if o.type == 'MESH':
        me = o.data
        me.calc_loop_triangles()
        parts = []
        for mi, mat in enumerate(me.materials):
            if not mat: continue
            pos = []
            normal = []
            for tri in me.loop_triangles:
                if tri.material_index != mi: continue
                for vi in tri.vertices:
                    v_co = CI.to_3x3() @ me.vertices[vi].co
                    pos.extend(round(v, 6) for v in v_co)
                    v_no = CI.to_3x3() @ tri.normal
                    normal.extend(round(v, 6) for v in v_no)
            if pos:
                parts.append({
                    'material': mat.name,
                    'position': pos,
                    'normal': normal
                })
        if parts:
            entry['parts'] = parts
    nodes.append(entry)

materials = {}
for mat in bpy.data.materials:
    bsdf = mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes and mat.node_tree else None
    if bsdf:
        col = list(bsdf.inputs['Base Color'].default_value)[:3]
        rough = bsdf.inputs['Roughness'].default_value if 'Roughness' in bsdf.inputs else 0.85
        metal = bsdf.inputs['Metallic'].default_value if 'Metallic' in bsdf.inputs else 0.0
        materials[mat.name] = {
            'color': [round(float(c), 4) for c in col],
            'roughness': round(float(rough), 3),
            'metalness': round(float(metal), 3)
        }
    elif hasattr(mat, 'diffuse_color'):
        col = list(mat.diffuse_color)[:3]
        materials[mat.name] = {
            'color': [round(float(c), 4) for c in col],
            'roughness': 0.85,
            'metalness': 0.5 if 'gold' in mat.name else 0.0
        }

data = {
    'version': 1,
    'heightMetres': 1.78,
    'forward': '+Z',
    'nodes': nodes,
    'materials': materials
}

json_str = 'export default ' + json.dumps(data, separators=(',', ':')) + ';\n'

targets = [
    BASE / 'assets/models/optimized/human-courier-production-v2/head-38/geometry.js',
    BASE / 'assets/models/optimized/human-courier-production-v2/head/geometry.js',
]

for t in targets:
    t.parent.mkdir(parents=True, exist_ok=True)
    t.write_text(json_str, encoding='utf-8')
    print(f"Successfully baked web geometry to {t} ({len(json_str)} bytes)")
