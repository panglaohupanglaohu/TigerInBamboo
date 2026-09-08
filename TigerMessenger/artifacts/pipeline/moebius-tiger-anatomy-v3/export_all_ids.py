import bpy
from pathlib import Path
s=bpy.data.scenes['Tiger Anatomy V3'];bpy.context.window.scene=s
for o in s.objects:
 if o.get('candidateHiddenOutline'):o.hide_viewport=False;o.hide_set(False);o.hide_render=False
 o.select_set(bool(o.get('three_node_id')or o.get('candidateAddition')))
bpy.ops.export_scene.gltf(filepath='/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/godot/assets/art-pilots/moebius-tiger-anatomy-v3.glb',export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
for o in s.objects:
 if o.get('candidateHiddenOutline'):o.hide_set(True);o.hide_render=True
print('Export ordering fixed: unhide then select all original outline IDs')
