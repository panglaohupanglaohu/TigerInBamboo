extends RefCounted
## The UI and clearance audit resolve the same released points, without resampling stairs.
static func resolve(world:Node,west_city:bool=true,front_harbor:bool=false,old_shore:bool=false,horse_exit:bool=false)->Dictionary:
    if not west_city:
        return {"valid":true,"frame":world.stair_candidate.root,"points":world.stair_candidate.route,"surface_following":false,"source":"tower-stairs"}
    var source="res://data/common-frame-citadel-placement-r05-full-route.json"
    var frame:Node3D=world.castle_adapter.original
    var key="points"
    var expected="castleContainer"
    if front_harbor:source=world.get_meta("front_harbor_data_path","res://data/common-frame-citadel-placement-r04-front-route.json")
    if old_shore:
        source="res://data/old-harbor-ocean-grade.json";key="shore"
    if horse_exit:
        source=world.get_meta("horse_exit_data_path","res://data/citadel-placement-r03-plaza.json")
        frame=world.castle_adapter.original.find_child("highland-west-city",true,false)
        expected="highland-west-city authored local"
    if not FileAccess.file_exists(source) or not is_instance_valid(frame):return {"valid":false}
    var data=JSON.parse_string(FileAccess.get_file_as_string(source))
    if not data is Dictionary:return {"valid":false}
    if not old_shore and data.get("frame","")!=expected:return {"valid":false}
    var rows=data.get("shore",{}).get("route",[]) if key=="shore" else data.get("points",[])
    var points:Array[Vector3]=[]
    for p in rows:
        if not p is Array or p.size()!=3:return {"valid":false}
        var point=Vector3(p[0],p[1],p[2])
        if not point.is_finite():return {"valid":false}
        if points.is_empty() or points[-1].distance_to(point)>0.001:points.append(point)
    return {"valid":points.size()>1,"frame":frame,"points":points,"surface_following":true,"source":source}
