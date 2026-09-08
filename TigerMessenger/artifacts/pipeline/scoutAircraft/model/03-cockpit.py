import bpy,json,bmesh
from pathlib import Path
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
scene=bpy.data.scenes['Scout Aircraft Art V1'];bpy.context.window.scene=scene
byid={o.get('three_node_id'):o for o in scene.objects if o.get('three_node_id')}
body=byid['n1'];body.data=body.data.copy()
bm=bmesh.new();bm.from_mesh(body.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(body.data);bm.free()
bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.5,depth=1.5,location=(0,-.72,.93))
cutter=bpy.context.object;cutter.name='TemporaryCockpitCut'
mod=body.modifiers.new('Cockpit cavity inside original canopy','BOOLEAN');mod.operation='DIFFERENCE';mod.solver='EXACT';mod.object=cutter
bpy.context.view_layer.objects.active=body
bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.data.objects.remove(cutter,do_unlink=True)
mat=bpy.data.materials.new('ScoutArtV1_CockpitDarkLiner');mat.diffuse_color=(.037,.066,.082,1);mat.use_nodes=True
bs=mat.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=mat.diffuse_color;bs.inputs['Roughness'].default_value=.72
# An open cylindrical liner and floor, wholly contained under the original glass.
verts=[];faces=[]
import math
for z in [.185,.47]:
 for i in range(16):
  a=i*math.tau/16;verts.append((.496*math.cos(a),-.72+.496*math.sin(a),z))
for i in range(16):faces.append((i,(i+1)%16,(i+1)%16+16,i+16))
faces.append(tuple(reversed(range(16))))
mesh=bpy.data.meshes.new('ScoutCockpitLinerMesh');mesh.from_pydata(verts,[],faces);mesh.materials.append(mat)
liner=bpy.data.objects.new('scout-cockpit-inner-liner',mesh);scene.collection.objects.link(liner);liner.parent=byid['n0'];liner['optimization_added']='Cockpit interior within original canopy; no seat or weapons'
bs=next(n for n in byid['n9'].data.materials[0].node_tree.nodes if n.type=='BSDF_PRINCIPLED');bs.inputs['IOR'].default_value=1.2;bs.inputs['Base Color'].default_value=(.86,.96,.98,1);bs.inputs['Coat Weight'].default_value=.08
out=root/'assets/models/optimized/scoutAircraft-art-v1.blend';bpy.data.libraries.write(str(out),{scene},fake_user=True,compress=True)
p=root/'artifacts/pipeline/scoutAircraft/model/model-report.json';report=json.loads(p.read_text());report['changes'].append('Round 2: contained 16-sided cockpit cavity and dark open liner under original canopy, no exterior silhouette change');report['cockpitInterior']='Factory had no seat. Added only recessed liner; concept seat remains unimplemented.';report['addedMeshCount']=1;report['originalNodeCount']=len(byid);p.write_text(json.dumps(report,indent=2));print(json.dumps(report))
