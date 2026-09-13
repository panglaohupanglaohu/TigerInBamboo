extends RefCounted
var report: Dictionary = {}
var ship: Node3D
var previous: Array = []
var adapter = preload("res://scripts/saihoji_warship_adapter.gd").new()
var boarding_controller
var boarding_gate

func bind(world: Node3D) -> bool:
    var hosts = world.castle_adapter.west_city.find_children("citadel-front-harbor", "Node3D", true, false)
    if hosts.size() != 1: return false
    var front: Node3D = hosts[0]
    # Replace the same patrol slot if it is included in the original snapshot.
    previous = world.model.find_children("ocean-warship-0*", "Node3D", true, false)
    for node in previous: node.visible = false
    ship = load(adapter.MODEL).instantiate()
    ship.name = "ocean-warship-0-front-port"
    front.add_child(ship)
    ship.position = Vector3(39.986712877064,-4.403200209945,100.248986480844)
    ship.quaternion = Quaternion(-.03088737415325818,-.9793345273455887,-.10954532137472281,-.16718156666217138)
    ship.scale = Vector3.ONE * 1.84
    var row: Dictionary = adapter.bind(ship)
    if row.is_empty(): ship.queue_free(); return false
    adapter.tick(row, 0, false)
    report = {"source_slot":"ocean-warship-0","replaced_snapshot_nodes":previous.size(),"scale":1.84,"boarding_validated":false,"scope":"same original ship at shared front-port pose; native piloting and unloading pending"}
    return true

func set_enabled(value: bool) -> void:
    if is_instance_valid(ship): ship.visible = value
    for node in previous:
        if is_instance_valid(node): node.visible = not value

func bind_released(world: Node3D) -> bool:
    if not is_instance_valid(ship): return false
    var data = JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-released-holding-berth.json"))
    if not data is Dictionary or data.get("frame") != "castleContainer": return false
    var castle: Node3D = world.castle_adapter.original
    ship.reparent(castle)
    var p: Array = data.position
    var q: Array = data.quaternion
    var s: Array = data.scale
    ship.position = Vector3(p[0],p[1],p[2])
    ship.quaternion = Quaternion(q[0],q[1],q[2],q[3])
    ship.scale = Vector3(s[0],s[1],s[2])
    ship.visible = true
    report = {"source_slot":data.sourceSlot,"frame":data.frame,"boarding_validated":false,"released_holding":true,"scope":"same original patrol adapter moved to Web-exported holding pose; no native boarding or unloading claim"}
    return bind_boarding_geometry(world)

func bind_boarding_geometry(world: Node3D) -> bool:
    var data = JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-boarding-r04-wide-candidate.json"))
    if not data is Dictionary: return false
    var city: Node3D = world.castle_adapter.west_city
    var q = data.native.quaternion
    ship.reparent(city)
    ship.position = Vector3(data.native.position[0],data.native.position[1],data.native.position[2])
    ship.quaternion = Quaternion(q[0],q[1],q[2],q[3])
    ship.scale = Vector3(data.native.scale[0],data.native.scale[1],data.native.scale[2])
    var row = adapter.bind(ship)
    boarding_controller = preload("res://scripts/citadel_boarding_candidate.gd").new()
    if not boarding_controller.bind(adapter,row,data.landing): return false
    var arrays=[]; arrays.resize(Mesh.ARRAY_MAX)
    var vertices=PackedVector3Array()
    for p in data.landing.vertices: vertices.append(Vector3(p[0],p[1],p[2]))
    var indices=PackedInt32Array(data.landing.indices)
    for i in range(0,indices.size(),3):
        var n=indices[i+1];indices[i+1]=indices[i+2];indices[i+2]=n
    arrays[Mesh.ARRAY_VERTEX]=vertices;arrays[Mesh.ARRAY_INDEX]=indices
    var mesh=ArrayMesh.new();mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
    var material=StandardMaterial3D.new();material.albedo_color=Color("785438")
    var bearing=MeshInstance3D.new();bearing.name="citadel-boarding-bearing";bearing.mesh=mesh;bearing.material_override=material;city.add_child(bearing)
    var step=MeshInstance3D.new();step.name="citadel-boarding-step"
    var box=BoxMesh.new();box.size=Vector3(data.step.size[0],data.step.size[1],data.step.size[2]);step.mesh=box;step.material_override=material
    city.add_child(step);step.position=Vector3(data.step.center[0],data.step.center[1],data.step.center[2])
    boarding_gate=boarding_controller.create_lifecycle()
    report={"source_slot":"ocean-warship-0","boarding_geometry_installed":true,"boarding_validated":false,"scope":"Same measured Web berth, Blender geometry, bearing and step. Native player boarding interaction remains pending."}
    return true
