extends RefCounted
## Shared Web guard posts, using the original approved red family.
## Static deployment only; ownership transfers to combat when native siege is connected.
var root:Node3D
var poses:Array=[]
func mount(world:Node3D)->bool:
    if is_instance_valid(root):return true
    var file="res://data/new-city-garrison.json"
    if not FileAccess.file_exists(file):return false
    var data=JSON.parse_string(FileAccess.get_file_as_string(file))
    if not data is Dictionary or data.get("rows",[]).size()!=28:return false
    root=Node3D.new();root.name="NewCityGarrisonPosts";world.add_child(root)
    root.global_transform=world.castle_adapter.original.global_transform
    var facing:Vector3=Vector3(data.face[0],data.face[1],data.face[2]).normalized()
    for row in data.rows:
        var role:String=row.role
        if role not in ["spear","gladius","longbow"]:dispose();return false
        var path="res://assets/roman-family-v1/romanSoldier_%s_red"%role
        var actor=load(path+".glb").instantiate();root.add_child(actor)
        actor.name="Guard_%02d_%s"%[row.index,role]
        var p=row.position;actor.position=Vector3(p[0],p[1],p[2])
        actor.basis=Basis(facing,Vector3.UP,facing.cross(Vector3.UP))
        actor.set_meta("guard_post_id",row.post);actor.set_meta("role",role)
        var pose=preload("res://scripts/roman_carry_pose.gd").new()
        if not pose.bind(actor,role,JSON.parse_string(FileAccess.get_file_as_string(path+".assembly.json"))):dispose();return false
        pose.set_enabled(true);poses.append(pose)
    root.set_meta("source",data.source)
    root.set_meta("scope","Static shared guard posts; native siege pending")
    return true
func dispose()->void:
    poses.clear()
    if is_instance_valid(root):root.free()
    root=null
