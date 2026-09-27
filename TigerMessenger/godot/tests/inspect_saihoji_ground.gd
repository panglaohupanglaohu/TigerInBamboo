extends SceneTree
func _initialize(): call_deferred("run")
func run():
 var w=load("res://scenes/saihoji_battle_world.tscn").instantiate();root.add_child(w)
 while not w.ready_for_battle and w.load_error.is_empty(): await physics_frame
 w.set_physics_process(false)
 var rows=[]
 for n in w.concealment_visual.node.find_children("*", "Node3D",true,false):
  if str(n.name).contains("_original_pine_"):
   rows.append({"name":str(n.name),"local":w.concealment_visual.node.to_local(n.global_position),"ground":w.concealment_visual.node.to_local(w._ground(n.global_position)),"scale":n.scale})
 print(JSON.stringify({"trees":rows,"ground":w.landing_planner.report,"concealment":w.concealment_result}))
 w.queue_free();await process_frame;quit()
