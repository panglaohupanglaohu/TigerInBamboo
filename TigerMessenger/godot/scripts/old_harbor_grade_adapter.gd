extends RefCounted
var report:Dictionary={}
var replacement:Node3D
func bind(world:Node3D)->bool:
    if not preload("res://scripts/citadel_surface_variant.gd").harbor_enabled():return true
    if not preload("res://scripts/citadel_surface_variant.gd").enabled():
        report={"passed":false,"reason":"requires --common-frame"};return false
    var originals=world.castle_adapter.west_city.find_children("old-harbor-scene","Node3D",true,false)
    if originals.size()!=1:
        report={"passed":false,"matched":originals.size()};return false
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/old-harbor-ocean-grade.json"))
    if not data is Dictionary:return false
    var packed=load("res://assets/art-pilots/old-harbor-ocean-grade.glb") as PackedScene
    if packed==null:return false
    replacement=packed.instantiate();replacement.name="OldHarborOceanGrade"
    world.model.add_child(replacement)
    var m=data.harborMatrix
    replacement.global_transform=world.model.global_transform*Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
    world.castle_adapter._adapt_materials(replacement)
    var terrain=world.castle_adapter.west_city.find_children("citadel-oskar-grid-mountain-surface","MeshInstance3D",true,false)
    if terrain.size()!=1 or replacement.find_children("citadel-old-shore-approach","Node3D",true,false).size()!=1:
        replacement.queue_free();report={"passed":false,"reason":"shore integration topology mismatch"};return false
    var previous_forest=world.castle_adapter.west_city.find_children("highland-canopy-groves","Node3D",true,false)
    var current_forest=replacement.find_children("highland-canopy-groves","Node3D",true,false)
    var has_round=data.get("mountainForest",{}).get("retainedRound",[]).size()>0
    if previous_forest.size()>1 or current_forest.size()>1 or (has_round and current_forest.size()!=1):
        replacement.queue_free();report={"passed":false,"reason":"mountain forest source identity mismatch"};return false
    for forest in previous_forest:forest.visible=false
    terrain[0].visible=false
    var current_seals=replacement.find_children("citadel-coastal-cliff-seal","MeshInstance3D",true,false)
    if current_seals.size()==1:
        for previous_seal in world.castle_adapter.west_city.find_children("citadel-coastal-cliff-seal","MeshInstance3D",true,false):previous_seal.visible=false
    originals[0].visible=false
    report={"passed":true,"originals_replaced":1,"source":"actual Web citadelOldHarbor candidate","scope":"Original port, boat, crew, shore stairs and matching cut terrain; native logistics pending"}
    return true
