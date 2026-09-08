"""Export one edited asset from the OPEN .blend without regenerating modelling.
blender --background art/TigerMessenger-kit.blend --python tools/export_asset.py -- house
"""
import bpy
import json
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
if len(args) != 1:
    raise RuntimeError('Pass one mesh name after -- (e.g. house)')
name = args[0]
obj = bpy.data.objects.get(name)
if obj is None or obj.type != 'MESH':
    raise RuntimeError(f'Mesh {name!r} does not exist')
out = root / 'assets' / 'kit'
catalog = json.loads((out / 'meshes.json').read_text())
if name not in catalog['assets']:
    raise RuntimeError('New asset: register it in the kit manifest first')
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True); bpy.context.view_layer.objects.active = obj
saved_location = obj.location.copy()
try:
    obj.location = (0, 0, 0)
    bpy.context.view_layer.update()
    bpy.ops.export_scene.gltf(filepath=str(out / f'{name}.glb'), export_format='GLB', use_selection=True, export_yup=True, export_animations=False)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = obj.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    mesh.calc_loop_triangles()
    positions, normals, colors = [], [], []
    matrix = evaluated.matrix_world
    normal_matrix = matrix.to_3x3().inverted().transposed()
    for triangle in mesh.loop_triangles:
        mat = mesh.materials[triangle.material_index]
        principled = mat.node_tree.nodes.get('Principled BSDF') if mat.use_nodes else None
        color = principled.inputs['Base Color'].default_value[:3] if principled else mat.diffuse_color[:3]
        normal = (normal_matrix @ triangle.normal).normalized()
        for index in triangle.vertices:
            v = matrix @ mesh.vertices[index].co
            positions.extend([round(v.x,5),round(v.z,5),round(-v.y,5)])
            normals.extend([round(normal.x,5),round(normal.z,5),round(-normal.y,5)])
            colors.extend([round(c,5) for c in color])
    catalog['assets'][name] = {'positions':positions,'normals':normals,'colors':colors,'triangles':len(positions)//9}
    evaluated.to_mesh_clear()
    (out/'meshes.json').write_text(json.dumps(catalog,separators=(',',':')))
    manifest = json.loads((out/'manifest.json').read_text())
    for entry in manifest['assets']:
        if entry['id']==name: entry['triangles']=len(positions)//9
    (out/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print('ASSET_EXPORT_OK',name,len(positions)//9,'triangles')
finally:
    obj.location = saved_location
