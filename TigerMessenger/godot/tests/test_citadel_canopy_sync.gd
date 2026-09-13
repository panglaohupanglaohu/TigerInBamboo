extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var expected=JSON.parse_string(FileAccess.get_file_as_string("res://../artifacts/pipeline/citadel-canopy-ground/after.json"))
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    var groups:Array=[]
    for n in w.castle_adapter.original.find_children("highland-mountain-slope-vegetation","Node3D",true,false):
        if n.is_visible_in_tree():groups.append(n)
    var inverse:Transform3D=w.castle_adapter.original.global_transform.affine_inverse()
    var rows:Array=[]
    var passed:bool=groups.size()==1
    if passed:
        for row in expected.trees:
            var matches=groups[0].find_children(row.name,"Node3D",true,false)
            var gap:float=999
            if matches.size()==1 and matches[0].is_visible_in_tree():
                var point:Vector3=inverse*matches[0].global_position
                var wanted=Vector3(row.castlePosition[0],row.castlePosition[1],row.castlePosition[2])
                gap=point.distance_to(wanted)
            rows.append({"name":row.name,"web_position_error":gap})
            passed=passed and gap<.005
    var report={"visible_groves":groups.size(),"trees":rows,"passed":passed,"scope":"Actual Godot visible replacement roots match Web ground-tested positions; archived grove hidden. No full-scene vegetation acceptance."}
    var f=FileAccess.open("res://../artifacts/pipeline/citadel-canopy-ground/godot-sync.json",FileAccess.WRITE);f.store_string(JSON.stringify(report,"  "));f.close()
    print(JSON.stringify(report));w.free();quit(0 if passed else 1)
