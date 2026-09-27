"""Separate background Blender process; never opens/saves the user's foreground file."""
import bpy,json,math
from pathlib import Path
root=Path(__file__).resolve().parent
report=[]
for name in ('locust','ant','beetle'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(root/'models'/f'{name}.glb'))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    invalid=0; triangles=0
    for o in meshes:
        o.data.calc_loop_triangles()
        triangles+=len(o.data.loop_triangles)
        invalid+=sum(not all(math.isfinite(v) for v in vertex.co) for vertex in o.data.vertices)
    assert meshes and invalid==0, name
    for image in bpy.data.images:
        if image.source=='FILE':
            try:image.pack()
            except RuntimeError:pass
    bpy.context.scene['source']='Actual TigerMessenger robot GLB, static asset. Procedural Three.js patina is not baked.'
    bpy.ops.wm.save_as_mainfile(filepath=str(root/'models'/f'{name}.blend'))
    report.append({'name':name,'imported_meshes':len(meshes),'triangles':triangles,'invalid_vertices':invalid,'materials':len(bpy.data.materials),'images':len(bpy.data.images),'blend_saved':True})
(root/'models'/'blender-import-check.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
