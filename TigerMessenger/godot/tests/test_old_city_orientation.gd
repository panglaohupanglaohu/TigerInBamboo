extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var w=load("res://scenes/citadel_world.tscn").instantiate();root.add_child(w)
    await process_frame
    var adapter=w.castle_adapter
    var inverse:Transform3D=adapter.original.global_transform.affine_inverse()
    var layers:Array=[]
    for n in adapter.candidate.find_children("citadel-layer-*","Node3D",true,false):
        var transform:Transform3D=inverse*n.global_transform
        layers.append({"name":str(n.name),"yaw_degrees":rad_to_deg(transform.basis.get_euler().y)})
    var foundations:Array=[]
    for n in adapter.west_city.find_children("highland-town-foundation-platform","Node3D",true,false):
        if n.is_visible_in_tree():
            var transform:Transform3D=inverse*n.global_transform
            foundations.append({"yaw_degrees":rad_to_deg(transform.basis.get_euler().y),"origin":str(transform.origin)})
    var passed:bool=layers.size()==12 and foundations.size()==1
    for row in layers:passed=passed and abs(row.yaw_degrees-30)<.01
    for row in foundations:passed=passed and abs(row.yaw_degrees-30)<.01
    var hosts=adapter.west_city.find_children("highland-west-city","Node3D",true,false)
    var new_yaw:float=rad_to_deg((inverse*hosts[0].global_transform).basis.get_euler().y) if hosts.size()==1 else 999
    passed=passed and abs(new_yaw+30)<.01
    var report={"new_city_yaw_degrees":new_yaw,"layers":layers,"foundations":foundations,"passed":passed,"scope":"Visible imported old-city layers and current foundation, actual production scene; new city actual rotation also checked"}
    var f=FileAccess.open("res://../artifacts/pipeline/citadel-old-yaw30-sync/godot-orientation.json",FileAccess.WRITE);f.store_string(JSON.stringify(report,"  "));f.close()
    print(JSON.stringify(report));w.free();quit(0 if passed else 1)
