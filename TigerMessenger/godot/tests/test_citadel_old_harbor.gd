extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w);await process_frame
    var rows:Array=[];var passed:=true
    for name in ["old-harbor-scene","citadel-navona-canal-plaza","navona-harbor-causeway"]:
        var copies=w.castle_adapter.west_city.find_children(name,"Node3D",true,false)
        var archived:Array=[]
        for node in w.model.find_children("*","Node3D",true,false):
            if w.castle_adapter.west_city.is_ancestor_of(node):continue
            var source:String=str(node.get_meta("extras",{}).get("sourcePath",""))
            if source.begins_with(name+"[") and not source.contains("/"):archived.append(node)
        var ok:bool=copies.size()==1 and archived.size()==1 and copies[0].is_visible_in_tree() and not archived[0].is_visible_in_tree()
        var pos:=Vector3.ZERO
        if copies.size()==1:pos=w.castle_adapter.original.to_local(copies[0].global_position)
        if name=="old-harbor-scene":ok=ok and absf(pos.x+72)<0.01 and absf(pos.z-32)<0.01
        rows.append({"name":name,"copies":copies.size(),"archived":archived.size(),"position":[pos.x,pos.y,pos.z],"passed":ok});passed=passed and ok
    var report:={"objects":rows,"passed":passed,"scope":"Unique visible relocated original assets and old harbor position; not port navigation or battle migration."}
    print(JSON.stringify(report));FileAccess.open("res://../artifacts/pipeline/citadel-west-city/godot-old-harbor.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
    w.free();quit(0 if passed else 1)
