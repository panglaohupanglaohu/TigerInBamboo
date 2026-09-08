"""Read the saved v3 entrance stones in background Blender; never save the source."""
import bpy
import bmesh
import hashlib
import json
import math
from pathlib import Path
from mathutils import Matrix

root = Path(__file__).resolve().parents[2]
source = root / 'assets/models/optimized/bookshop-art-v3.blend'
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.data.scenes['Bookshop Art V1']
bpy.context.window.scene = scene
shop = next(o for o in scene.objects if o.name == 'hard-to-find-bookshop' and o.parent is None)
stones = sorted((o for o in scene.objects if o.name.startswith('Entrance path ') and o.type == 'MESH'), key=lambda o: o.name)
assert len(stones) == 4
axis = Matrix.Rotation(-math.pi / 2, 4, 'X')
depsgraph = bpy.context.evaluated_depsgraph_get()
records = []
for stone in stones:
    evaluated = stone.evaluated_get(depsgraph)
    mesh = evaluated.to_mesh()
    # The authored cube face lists wind inward. Correct the temporary evaluated
    # export only, so Web front-face rendering/raycasting sees solid stone tops.
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(mesh)
    bm.free()
    mesh.calc_loop_triangles()
    transform = axis @ shop.matrix_world.inverted() @ stone.matrix_world
    positions = []
    for triangle in mesh.loop_triangles:
        for vertex in triangle.vertices:
            positions.extend(round(v, 7) for v in transform @ mesh.vertices[vertex].co)
    records.append({'name': stone.name, 'position': positions,
                    'bottom': min(positions[1::3]), 'triangles': len(positions) // 9})
    evaluated.to_mesh_clear()
data = {'version': 3, 'source': str(source.relative_to(root)),
        'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
        'color': list(stones[0].data.materials[0].diffuse_color[:3]), 'stones': records}
output = root / 'assets/models/optimized/bookshopPathData.js'
output.write_text('// Evaluated original v3 entrance stones; source preserved.\nexport default ' + json.dumps(data, separators=(',', ':')) + ';\n')
folder = root / 'artifacts/bookshop-path'
folder.mkdir(exist_ok=True)
report = {'source': data['source'], 'sha256': data['sha256'], 'stones': len(records),
          'triangles': sum(s['triangles'] for s in records), 'bytes': output.stat().st_size,
          'sourceModified': False, 'derivedWinding': 'outward', 'output': str(output.relative_to(root))}
(folder / 'export.json').write_text(json.dumps(report, indent=2))
print('BOOKSHOP_PATH_EXPORT_OK', json.dumps(report))
