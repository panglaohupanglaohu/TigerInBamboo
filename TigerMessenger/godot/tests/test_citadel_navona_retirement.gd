extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    var rows:Array=[]
    for name in ["citadel-navona-canal-plaza","navona-harbor-causeway"]:
        for n in w.find_children("*","Node3D",true,false):
            var source:String=str(n.get_meta("extras",{}).get("sourcePath",""))
            if source.begins_with(name+"[") and not source.contains("/"):
                rows.append({"name":name,"visible":n.is_visible_in_tree()})
    var hosts=w.castle_adapter.west_city.find_children("highland-west-city","Node3D",true,false)
    var flag:bool=hosts.size()==1 and hosts[0].get_meta("extras",{}).get("legacyNavonaRetired",false)==true
    var passed:bool=flag and rows.size()==2
    for row in rows:passed=passed and not row.visible
    var report={"retirement_exported":flag,"archived_nodes":rows,"passed":passed,"scope":"Actual Godot archived basin and causeway hidden under current imported replacement policy; no marine battle migration."}
    var f=FileAccess.open("res://../artifacts/pipeline/citadel-navona-retirement/godot-check.json",FileAccess.WRITE);f.store_string(JSON.stringify(report,"  "));f.close()
    print(JSON.stringify(report));w.free();quit(0 if passed else 1)
