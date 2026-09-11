extends RefCounted
## Replays the validated sampled connector; does not spawn or assign story ships.
var poses:Array[Transform3D]=[]
var distances:Array[float]=[]
var length:float=0.0
func load_route()->bool:
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-harbor-approach.json"))
    if not data is Dictionary or not data.get("verified",false) or data.get("poses",[]).size()<2:return false
    poses.clear();distances.clear();length=0
    for pose in data.poses:
        var p=pose.position;var q=pose.quaternion
        var transform=Transform3D(Basis(Quaternion(q[0],q[1],q[2],q[3]).normalized()),Vector3(p[0],p[1],p[2]))
        if not poses.is_empty():length+=poses[-1].origin.distance_to(transform.origin)
        poses.append(transform);distances.append(length)
    return length>0
func sample(progress:float)->Transform3D:
    if poses.is_empty():return Transform3D.IDENTITY
    var distance:float=clampf(progress,0,1)*length
    for i in range(1,poses.size()):
        if distance<=distances[i]:
            var weight:float=(distance-distances[i-1])/maxf(0.00001,distances[i]-distances[i-1])
            return poses[i-1].interpolate_with(poses[i],weight)
    return poses[-1]

func sample_departure(progress:float)->Transform3D:
    # Leave the berth stern-first; keep the validated orientation at each point.
    return sample(1.0-clampf(progress,0.0,1.0))
