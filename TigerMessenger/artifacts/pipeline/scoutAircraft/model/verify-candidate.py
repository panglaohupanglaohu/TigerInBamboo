import bpy,json,hashlib
from pathlib import Path
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
def capture(path):
 bpy.ops.wm.open_mainfile(filepath=str(root/path))
 scene=next(s for s in bpy.data.scenes if any(o.get('three_node_id')=='n45' for o in s.objects))
 nodes={o.get('three_node_id'):{'matrix':[list(r) for r in o.matrix_local],'parent':o.parent.get('three_node_id') if o.parent else None,'type':o.type,'userdata':o.get('three_userData')} for o in scene.objects if o.get('three_node_id')}
 dg=bpy.context.evaluated_depsgraph_get();triangles=0
 for o in scene.objects:
  if o.type=='MESH' and not o.hide_render:
   mesh=o.evaluated_get(dg).to_mesh();mesh.calc_loop_triangles();triangles+=len(mesh.loop_triangles);o.evaluated_get(dg).to_mesh_clear()
 return nodes,triangles
original,ot=capture('assets/models/originals/supplemental/blender-r3/scoutAircraft.blend')
candidate,ct=capture('assets/models/optimized/scoutAircraft-art-v1.blend')
report={'originalNodeCount':len(original),'candidateOriginalNodeCount':len(candidate),'allOriginalIdsParentsTransformsUserdataEqual':original==candidate,'originalVisibleTriangles':ot,'candidateVisibleTriangles':ct,'deltaTriangles':ct-ot,'candidateSha256':hashlib.sha256((root/'assets/models/optimized/scoutAircraft-art-v1.blend').read_bytes()).hexdigest()}
(root/'artifacts/pipeline/scoutAircraft/model/verification.json').write_text(json.dumps(report,indent=2));print(json.dumps(report));assert original==candidate
