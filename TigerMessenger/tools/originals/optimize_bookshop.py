"""Lossless render-surface cleanup on the imported original bookshop only."""
import bpy,json
from pathlib import Path
root=Path(__file__).resolve().parents[2]
src=root/'assets/models/originals/blender-r3/bookshop.blend'
out=root/'assets/models/optimized/bookshop.blend'
out.parent.mkdir(exist_ok=True)
if out.exists():raise RuntimeError('Working copy exists; preserve it and use a new revision')
bpy.ops.wm.open_mainfile(filepath=str(src))
meshes={o.data for o in bpy.data.objects if o.type=='MESH'}
before=after=faces=0;max_position_error=max_normal_error=max_uv_error=0
for old in meshes:
    users=[o for o in bpy.data.objects if o.type=='MESH' and o.data==old]
    if old.shape_keys or any(o.vertex_groups or o.modifiers for o in users):raise RuntimeError('Do not weld a rigged/deformed mesh')
    if old.color_attributes:raise RuntimeError('This cleanup is scoped to the original bookshop without color layers')
    coords=[tuple(v.co) for v in old.vertices]
    normals=[tuple(n.vector) for n in old.corner_normals]
    loops=[l.vertex_index for l in old.loops]
    uv_layers={layer.name:[tuple(v.uv) for v in layer.data] for layer in old.uv_layers}
    original_faces=[list(poly.vertices) for poly in old.polygons]
    material_indices=[p.material_index for p in old.polygons]
    smooth=[p.use_smooth for p in old.polygons]
    unique={};verts=[];remap=[]
    for co in coords:
        if co not in unique:unique[co]=len(verts);verts.append(co)
        remap.append(unique[co])
    new_faces=[[remap[i] for i in f] for f in original_faces]
    # No triangles are dissolved, removed, reordered or added.
    assert all(len(set(f))==len(f) for f in new_faces)
    new=bpy.data.meshes.new(old.name+' · welded')
    new.from_pydata(verts,[],new_faces);new.update()
    for mat in old.materials:new.materials.append(mat)
    new.polygons.foreach_set('material_index',material_indices)
    new.polygons.foreach_set('use_smooth',smooth)
    for name,uvs in uv_layers.items():
        layer=new.uv_layers.new(name=name);layer.data.foreach_set('uv',[v for uv in uvs for v in uv])
    if normals:new.normals_split_custom_set(normals)
    for key in old.keys():new[key]=old[key]
    for i,loop in enumerate(new.loops):
        a=coords[loops[i]];b=new.vertices[loop.vertex_index].co
        max_position_error=max(max_position_error,max(abs(a[k]-b[k]) for k in range(3)))
        max_normal_error=max(max_normal_error,max(abs(normals[i][k]-new.corner_normals[i].vector[k]) for k in range(3)))
    for name,uvs in uv_layers.items():
        actual=list(new.uv_layers[name].data)
        for i,uv in enumerate(uvs):max_uv_error=max(max_uv_error,max(abs(uv[k]-actual[i].uv[k]) for k in range(2)))
    assert material_indices==[p.material_index for p in new.polygons]
    before+=len(coords);after+=len(verts);faces+=len(original_faces)
    for obj in users:obj.data=new
    bpy.data.meshes.remove(old)
assert max_position_error==0 and max_uv_error==0 and max_normal_error<1e-4
report={'asset':'original bookshop','source':str(src.relative_to(root)),'result':str(out.relative_to(root)),'verticesBefore':before,'verticesAfter':after,'facesUnchanged':faces,'maxFaceCornerPositionError':max_position_error,'maxFaceCornerNormalError':max_normal_error,'maxUVError':max_uv_error,'materialIndicesUnchanged':True,'runtimeIntegrated':False,'renderParity':'Original Three shader adaptation still pending; no runtime replacement'}
bpy.context.scene['optimization_report']=json.dumps(report)
bpy.ops.wm.save_as_mainfile(filepath=str(out),compress=True)
(out.parent/'bookshop.optimization.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print('ORIGINAL_BOOKSHOP_CLEANUP_OK',json.dumps(report))
