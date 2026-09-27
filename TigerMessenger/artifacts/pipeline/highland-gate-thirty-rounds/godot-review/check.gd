extends SceneTree
func _initialize():
 var doc=GLTFDocument.new()
 var state=GLTFState.new()
 var asset="/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/assets/models/optimized/highland-gate/highland-gate-r30.glb"
 var result=doc.append_from_file(asset,state)
 if result!=OK:
  push_error("GLB import failed: "+str(result))
  quit(1)
  return
 var node=doc.generate_scene(state)
 if node==null:
  quit(2)
  return
 root.add_child(node)
 var count=0
 var bad=0
 for mesh in node.find_children("*","MeshInstance3D",true,false):
  count+=1
  for i in range(mesh.mesh.get_surface_count()):
   var vertices=mesh.mesh.surface_get_arrays(i)[Mesh.ARRAY_VERTEX]
   for v in vertices:
    if not v.is_finite(): bad+=1
 var report={"meshes":count,"nonfinite_vertices":bad,"passed":count>0 and bad==0,"scope":"Isolated Godot GLB import check; native game routes and physics not migrated"}
 var file=FileAccess.open("res://../r30-godot.json",FileAccess.WRITE)
 file.store_string(JSON.stringify(report,"  "))
 print(JSON.stringify(report))
 quit(0 if count>0 and bad==0 else 3)
