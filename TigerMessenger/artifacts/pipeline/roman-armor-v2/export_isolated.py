import bpy,json
from pathlib import Path
base=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
for scene_name,filename in [('Roman Shield Handle V1','roman-shield-handle-v1.glb'),('Roman Armor V2 Refined','roman-armor-v2.glb')]:
 scene=bpy.data.scenes[scene_name];bpy.context.window.scene=scene
 for o in scene.objects:o.select_set(o.parent is not None and o.parent.name.startswith('Roman_') or o.type=='EMPTY' and o.name.startswith('Roman_'))
 bpy.ops.export_scene.gltf(filepath=str(base/'godot/assets/art-pilots'/filename),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
print('Exported single active scene, selection only; preserved mesh geometry and local transforms')
