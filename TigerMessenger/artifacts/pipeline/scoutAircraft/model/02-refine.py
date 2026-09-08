import bpy,json,bmesh,hashlib,math
from pathlib import Path
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
scene=bpy.data.scenes['Scout Aircraft Art V1']
byid={o.get('three_node_id'):o for o in scene.objects}
baseline={i:{'matrix':[list(r) for r in o.matrix_local],'parent':o.parent.get('three_node_id') if o.parent else None,'type':o.type} for i,o in byid.items()}
changes=[]
# All material copies belong only to this appended candidate scene.
material_map={}
for o in scene.objects:
 if o.type!='MESH' or o.hide_render: continue
 for slot in o.material_slots:
  old=slot.material
  if old not in material_map:
   material_map[old]=old.copy();material_map[old].name='ScoutArtV1_'+old.name
  slot.material=material_map[old]
  mat=slot.material
  if not mat.use_nodes: continue
  bs=next((n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
  if bs:
   bs.inputs['Roughness'].default_value=.48
   bs.inputs['Metallic'].default_value=.06
# A true transmission surface, with smooth shading on the existing canopy only.
canopy=byid['n9']; mat=canopy.data.materials[0]
bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bs.inputs['Base Color'].default_value=(.66,.89,.94,1)
bs.inputs['Alpha'].default_value=1
bs.inputs['Transmission Weight'].default_value=.95
bs.inputs['Roughness'].default_value=.095
bs.inputs['Metallic'].default_value=0
bs.inputs['IOR'].default_value=1.36
bs.inputs['Coat Weight'].default_value=.22
for f in canopy.data.polygons:f.use_smooth=True
solid=canopy.modifiers.new('Glass shell 6mm','SOLIDIFY');solid.thickness=.006;solid.offset=-1
changes.append('Original canopy: transmissive 6mm glass, smooth existing facets; silhouette unchanged')
# Weld duplicated export vertices before angle-limited bevel; preserve broad low-poly planes.
bevel_ids=['n3','n12','n14','n16','n18','n20','n22','n24','n35','n37','n39']
for ident in bevel_ids:
 o=byid[ident];o.data=o.data.copy()
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 bevel=o.modifiers.new('Restrained 12mm edge finish','BEVEL');bevel.width=.012;bevel.segments=1;bevel.limit_method='ANGLE';bevel.angle_limit=.6
changes.append('11 existing hard-surface meshes: welded export vertices, 12mm one-segment bevel, original transforms')
# Subtle paint roughness, no invented panel seams or greeble.
for ident in ['n1','n12','n16','n24']:
 mat=byid[ident].data.materials[0];nt=mat.node_tree
 if nt.nodes.get('Paint micro variation'):continue
 bs=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED')
 noise=nt.nodes.new('ShaderNodeTexNoise');noise.name='Paint micro variation';noise.inputs['Scale'].default_value=35;noise.inputs['Detail'].default_value=2
 ramp=nt.nodes.new('ShaderNodeMapRange');ramp.inputs['From Min'].default_value=0;ramp.inputs['From Max'].default_value=1;ramp.inputs['To Min'].default_value=.4;ramp.inputs['To Max'].default_value=.53
 nt.links.new(noise.outputs['Fac'],ramp.inputs['Value']);nt.links.new(ramp.outputs[0],bs.inputs['Roughness'])
# In foreground, show the candidate without changing any original scene datablock.
bpy.context.window.scene=scene
from mathutils import Vector
for screen in bpy.data.screens:
 for area in screen.areas:
  if area.type=='VIEW_3D':
   area.spaces.active.region_3d.view_location=Vector((0,-.6,.2))
   area.spaces.active.region_3d.view_rotation=Vector((.88,-1.3,.82)).to_track_quat('Z','Y')
   area.spaces.active.region_3d.view_distance=10
   area.spaces.active.shading.type='MATERIAL'
out=root/'assets/models/optimized/scoutAircraft-art-v1.blend'
bpy.data.libraries.write(str(out),{scene},fake_user=True,compress=True)
after={i:{'matrix':[list(r) for r in o.matrix_local],'parent':o.parent.get('three_node_id') if o.parent else None,'type':o.type} for i,o in byid.items()}
report={'candidate':str(out.relative_to(root)),'nodeCount':len(byid),'nodeTransformsAndParentsPreserved':baseline==after,'changes':changes,'noPropellerBladesAdded':True,'noNewWeapons':True,'cockpitInterior':'Original factory contains no seat; none invented in round 1','foregroundExistingScenesPreserved':[s.name for s in bpy.data.scenes],'sourceSha256':hashlib.sha256((root/'assets/models/originals/supplemental/blender-r3/scoutAircraft.blend').read_bytes()).hexdigest()}
(root/'artifacts/pipeline/scoutAircraft/model/model-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
