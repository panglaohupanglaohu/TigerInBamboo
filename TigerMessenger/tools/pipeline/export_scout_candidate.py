import bpy,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]
source=root/'assets/models/optimized/scoutAircraft-art-v1.blend'
sha=hashlib.sha256(source.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(source))
scene=bpy.data.scenes['Scout Aircraft Art V1'];bpy.context.window.scene=scene
bpy.ops.object.select_all(action='DESELECT')
objects=[o for o in scene.objects if o.get('three_node_id') or o.name=='scout-cockpit-inner-liner']
# Keep 46 original identity/anchor nodes; exclude archived shader-outline shells
# from visibility, not from identity. Their hide_render state must survive export.
for o in objects:
 o.hide_set(False)
 o.hide_viewport=False
 o.hide_render=False
 o.select_set(True)
 if o.get('three_node_id') and o.name.startswith('n'):
  o.name='scout_'+o['three_node_id']
# Flatten Blender preview-only Object Info/Mix color links for glTF.
# Source stays read-only; each material's archived diffuse is its source base color.
for mat in {m for o in objects if o.type=='MESH' for m in o.data.materials if m}:
 if not mat.use_nodes: continue
 bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not bs: continue
 for socket in ['Base Color','Roughness']:
  for link in list(bs.inputs[socket].links): mat.node_tree.links.remove(link)
 bs.inputs['Base Color'].default_value=mat.diffuse_color
 bs.inputs['Roughness'].default_value=.465
# Collapse duplicate slots only after modifier evaluation, preserving node boundaries.
# Exporting duplicate references to the SAME material creates redundant glTF primitives.
slot_rows=[]
canonical={}
def pbr_key(mat):
 if not mat or not mat.use_nodes:return ('identity',mat.as_pointer() if mat else 0)
 bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
 if not bs or any(socket.is_linked for socket in bs.inputs):return ('identity',mat.as_pointer())
 def value(v):
  if isinstance(v,(str,float,int,bool)):return v
  try:return list(v)
  except TypeError:return str(v)
 return json.dumps({'inputs':[(i.name,value(i.default_value)) for i in bs.inputs if hasattr(i,'default_value')],
  'cull':mat.use_backface_culling,'render':mat.surface_render_method,'alphaThreshold':mat.alpha_threshold},sort_keys=True)
for o in objects:
 if o.type!='MESH':continue
 bpy.context.view_layer.objects.active=o
 for modifier in list(o.modifiers):bpy.ops.object.modifier_apply(modifier=modifier.name)
 old=list(o.data.materials);indices=[p.material_index for p in o.data.polygons]
 unique=[];new_indices=[]
 for index in indices:
  # Blender/glTF resolves legacy out-of-range group indices to the last slot.
  # Preserve that effective material, rather than introducing a null/white slot.
  mat=old[min(index,len(old)-1)] if old else None
  key=pbr_key(mat)
  if key not in canonical:canonical[key]=mat
  mat=canonical[key]
  if mat not in unique:unique.append(mat)
  new_indices.append(unique.index(mat))
 o.data.materials.clear()
 for mat in unique:o.data.materials.append(mat)
 for polygon,index in zip(o.data.polygons,new_indices):polygon.material_index=index
 slot_rows.append({'node':o.get('three_node_id',o.name),'before':len(old),'after':len(unique),'beforeFaceGroups':len(set(indices)),'afterFaceGroups':len(set(new_indices)),'faces':len(indices)})
slot_report={'beforeSlots':sum(r['before'] for r in slot_rows),'afterSlots':sum(r['after'] for r in slot_rows),'meshes':slot_rows,'canonicalMaterials':len(canonical),'beforeFaceGroups':sum(r['beforeFaceGroups'] for r in slot_rows),'afterFaceGroups':sum(r['afterFaceGroups'] for r in slot_rows)}
out=root/'godot/assets/art-pilots/scoutAircraft-art-v1.glb';out.parent.mkdir(parents=True,exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_apply=True,export_extras=True,export_cameras=False,export_lights=False,export_yup=True,export_animations=True)
report={'source':str(source.relative_to(root)),'sourceUnchanged':sha==hashlib.sha256(source.read_bytes()).hexdigest(),'glb':str(out.relative_to(root)),'selectedOriginalNodeIds':sorted(o['three_node_id'] for o in objects if o.get('three_node_id')),'addedNodes':['scout-cockpit-inner-liner'],'scene':scene.name,'glbSha256':hashlib.sha256(out.read_bytes()).hexdigest(),'slotOptimization':slot_report,'note':'Godot adapter hides original archived outline shells and translates glass; no world replacement'}
p=root/'artifacts/pipeline/scoutAircraft/godot';p.mkdir(parents=True,exist_ok=True);(p/'export.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
