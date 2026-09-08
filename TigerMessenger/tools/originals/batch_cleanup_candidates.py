"""Create conservative Blender review candidates; never replace runtime assets.

Source/factory review and engine appearance checks remain required before use.
Unsupported data and any failed per-mesh check preserve the original mesh.
"""
import bpy, json, hashlib
from pathlib import Path

root = Path(__file__).resolve().parents[2]
source = root / 'assets/models/originals/blender-r3'
output = root / 'assets/models/optimized/batch-candidates-v2'
output.mkdir(exist_ok=True)

def surface(mesh):
    return {
        'positions': [tuple(mesh.vertices[l.vertex_index].co) for l in mesh.loops],
        'normals': [tuple(n.vector) for n in mesh.corner_normals],
        'uv': {a.name: [tuple(x.uv) for x in a.data] for a in mesh.uv_layers},
        'materials': [p.material_index for p in mesh.polygons],
        'smooth': [p.use_smooth for p in mesh.polygons],
        'sizes': [p.loop_total for p in mesh.polygons],
    }

def cleanup(mesh, users):
    if mesh.shape_keys or mesh.color_attributes or any(o.vertex_groups or o.modifiers for o in users):
        return None, 'preserved: deformation or color attributes'
    if not mesh.polygons or any(e.is_loose for e in mesh.edges):
        return None, 'preserved: line/point geometry'
    # Preserve generic data layers whose semantics need individual review.
    permitted = {'position', '.edge_verts', '.corner_vert', '.corner_edge', '.select_vert', '.select_poly', '.select_edge', 'material_index', 'sharp_face', 'sharp_edge', 'custom_normal'} | {a.name for a in mesh.uv_layers}
    unknown = [a.name for a in mesh.attributes if a.name not in permitted]
    if unknown:
        return None, 'preserved: additional attributes ' + ','.join(unknown)
    coords = [tuple(v.co) for v in mesh.vertices]
    unique, vertices, indices = {}, [], []
    for co in coords:
        if co not in unique:
            unique[co] = len(vertices)
            vertices.append(co)
        indices.append(unique[co])
    if len(vertices) == len(coords):
        return None, 'already has no exact duplicate positions'
    faces = [[indices[i] for i in p.vertices] for p in mesh.polygons]
    if any(len(set(f)) != len(f) for f in faces):
        return None, 'preserved: welding would collapse a face'
    original = surface(mesh)
    new = bpy.data.meshes.new(mesh.name + ' · exact weld candidate')
    try:
        new.from_pydata(vertices, [], faces)
        new.update()
        for material in mesh.materials:
            new.materials.append(material)
        new.polygons.foreach_set('material_index', original['materials'])
        new.polygons.foreach_set('use_smooth', original['smooth'])
        for name, values in original['uv'].items():
            layer = new.uv_layers.new(name=name)
            layer.data.foreach_set('uv', [v for uv in values for v in uv])
        new.normals_split_custom_set(original['normals'])
        for key in mesh.keys():
            new[key] = mesh[key]
        actual = surface(new)
        for key in ['positions', 'uv', 'materials', 'smooth', 'sizes']:
            if actual[key] != original[key]:
                raise ValueError('surface mismatch: ' + key)
        error = max((abs(a - b) for x, y in zip(actual['normals'], original['normals']) for a, b in zip(x, y)), default=0)
        if error >= 1e-4:
            raise ValueError('normal roundtrip exceeds tolerance')
        return new, {'verticesBefore': len(coords), 'verticesAfter': len(vertices), 'normalError': error, 'faceCornerPositionError': 0, 'uvError': 0}
    except Exception as e:
        bpy.data.meshes.remove(new)
        return None, 'preserved: ' + str(e)

results = []
catalog = json.loads((root / 'assets/models/originals/catalog.json').read_text())
for entry in catalog:
    ident = entry['id']
    target = output / (ident + '.blend')
    report_path = output / (ident + '.json')
    if target.exists():
        results.append(json.loads(report_path.read_text()) if report_path.exists() else {'id': ident, 'status': 'existing file retained; report absent'})
        continue
    try:
        archive = source / (ident + '.blend')
        bpy.ops.wm.open_mainfile(filepath=str(archive))
        objects = {o.name: (o.parent.name if o.parent else None, tuple(v for row in o.matrix_basis for v in row), o.hide_render) for o in bpy.data.objects}
        meshes = list({o.data for o in bpy.data.objects if o.type == 'MESH'})
        report = {'id': ident, 'status': 'Blender candidate; source review and engine parity pending', 'sourceSHA256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'runtimeIntegrated': False, 'meshes': []}
        for mesh in meshes:
            users = [o for o in bpy.data.objects if o.type == 'MESH' and o.data == mesh]
            new, detail = cleanup(mesh, users)
            report['meshes'].append({'mesh': mesh.name, 'result': detail})
            if new:
                for obj in users:
                    obj.data = new
                bpy.data.meshes.remove(mesh)
        assert objects == {o.name: (o.parent.name if o.parent else None, tuple(v for row in o.matrix_basis for v in row), o.hide_render) for o in bpy.data.objects}
        changed = [r['result'] for r in report['meshes'] if isinstance(r['result'], dict)]
        report['changedMeshes'] = len(changed)
        report['removedEditVertices'] = sum(r['verticesBefore'] - r['verticesAfter'] for r in changed)
        bpy.context.scene['batch_candidate_report'] = json.dumps(report)
        bpy.ops.wm.save_as_mainfile(filepath=str(target), compress=True)
        report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2))
        results.append(report)
        print('CANDIDATE_SAVED', ident, report['changedMeshes'], report['removedEditVertices'], flush=True)
    except Exception as e:
        results.append({'id': ident, 'status': 'failed; original retained', 'error': str(e)})
        print('CANDIDATE_FAILED', ident, str(e), flush=True)
    (output / 'batch-report.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
print('BATCH_FINISHED', len(results), flush=True)
