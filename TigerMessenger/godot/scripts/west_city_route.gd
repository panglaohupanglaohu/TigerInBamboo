extends RefCounted

func points() -> Array[Vector3]:
    var source = JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-west-city-route.json"))
    var result:Array[Vector3]=[]
    if not source is Dictionary:return result
    for row in source.get("points",[]):
        var next=Vector3(row[0],row[1],row[2])
        if result.is_empty():result.append(next);continue
        var previous:Vector3=result[-1]
        var count=maxi(1,int(ceil(previous.distance_to(next)/0.34)))
        for i in range(1,count+1):result.append(previous.lerp(next,float(i)/count))
    return result
