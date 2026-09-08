import bpy,json
from pathlib import Path
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
with bpy.data.libraries.load(str(root/'assets/models/originals/supplemental/blender-r3/scoutAircraft.blend'),link=False) as (src,dst):
 dst.scenes=src.scenes
scout_scene=dst.scenes[0]
scout_scene.name='Scout Aircraft Art V1'
bpy.context.window.scene=scout_scene
print(json.dumps([{'name':o.name,'type':o.type,'materials':[m.name for m in o.data.materials] if o.type=='MESH' else [],'loc':list(o.location),'props':{k:str(o[k])[:160] for k in o.keys()}} for o in scout_scene.objects],indent=2))
