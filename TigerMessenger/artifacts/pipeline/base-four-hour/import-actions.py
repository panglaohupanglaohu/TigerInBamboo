import bpy,json,math
from pathlib import Path
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/base-four-hour/models')
reports=[]
for name in ['locust','ant','beetle']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=str(root/(name+'-actions.glb')))
 actions=[{'name':a.name,'range':list(a.frame_range),'slots':len(a.slots) if hasattr(a,'slots') else None} for a in bpy.data.actions]
 objects=[{'name':o.name,'type':o.type,'tracks':[t.name for t in o.animation_data.nla_tracks] if o.animation_data else []} for o in bpy.data.objects]
 bpy.ops.wm.save_as_mainfile(filepath=str(root/(name+'-actions.blend')))
 reports.append({'robot':name,'actions':actions,'objects':objects,'meshes':sum(o.type=='MESH' for o in bpy.data.objects)})
(root/'blender-import.json').write_text(json.dumps(reports,indent=2))
print('ARTICULATED_IMPORT',json.dumps([{'robot':r['robot'],'actions':[a['name'] for a in r['actions']],'meshes':r['meshes']} for r in reports]))
