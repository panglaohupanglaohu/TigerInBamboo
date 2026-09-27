import bpy,json
from pathlib import Path
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
out=root/'assets/models/optimized/moebius-v10'
report={}
for kind in ['city','gate']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(out/f'{kind}-r10.glb'))
 meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
 invalid=sum(1 for o in meshes for v in o.data.vertices if not all(__import__('math').isfinite(c) for c in v.co))
 bpy.ops.wm.save_as_mainfile(filepath=str(out/f'{kind}-r10.blend'))
 report[kind]={'meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'nonfinite':invalid,'scope':'Static source-derived archive; runtime line effects, shaders and gameplay are not migrated.'}
(out/'blender-r10-check.json').write_text(json.dumps(report,indent=2))
