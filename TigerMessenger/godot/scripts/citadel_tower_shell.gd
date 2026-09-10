extends RefCounted
## Reversible hollow box sections at the original transforms and bounds.
var root:Node3D
var originals:Array[Dictionary]=[]
var bodies:Array[StaticBody3D]=[]
var report:Dictionary={}
const WALL=0.12
func bind(tower:Node3D)->bool:
    root=Node3D.new();root.name="HollowTowerCandidate";tower.add_child(root)
    var required=["highland-central-tower-foundation","highland-central-tower-lower","highland-central-tower-middle","highland-central-tower-upper","highland-central-obelisk-chamber","highland-central-lower-band-0","highland-central-lower-band-1","highland-central-middle-band-0","highland-central-upper-band-0","highland-castle-top-capture-deck"]
    # Validate the whole replacement before hiding any source node.
    for key in required:
        if not tower.get_node_or_null(NodePath(key)) is MeshInstance3D:
            root.queue_free();report={"error":"Missing original section "+key};return false
    var maximum_error:=0.0
    for key in required:
        var source:MeshInstance3D=tower.get_node(NodePath(key))
        originals.append({"node":source,"visible":source.visible})
        var group=Node3D.new();group.name=key+"-shell";root.add_child(group);group.transform=source.transform
        var bounds: AABB=source.get_aabb();var size:Vector3=bounds.size;var center:Vector3=bounds.get_center()
        var material:Material=source.get_active_material(0)
        _box(group,Vector3(WALL,size.y,size.z),center+Vector3((size.x-WALL)*0.5,0,0),material)
        _box(group,Vector3(WALL,size.y,size.z),center-Vector3((size.x-WALL)*0.5,0,0),material)
        _box(group,Vector3(size.x-2*WALL,size.y,WALL),center-Vector3(0,0,(size.z-WALL)*0.5),material)
        var front:float=center.z+(size.z-WALL)*0.5
        if key=="highland-central-tower-foundation":
            # Retain the authored 1.75 x 2.8 portal at tower y=4.95, +Z facade.
            var bottom:float=3.55-source.position.y;var top:float=6.35-source.position.y
            var side:float=(size.x-2*WALL-1.75)*0.5
            for sign_value in [-1,1]:_box(group,Vector3(side,size.y,WALL),Vector3(sign_value*(0.875+side*0.5),center.y,front),material)
            _box(group,Vector3(1.75,bottom-bounds.position.y,WALL),Vector3(0,(bottom+bounds.position.y)*0.5,front),material)
            _box(group,Vector3(1.75,bounds.end.y-top,WALL),Vector3(0,(top+bounds.end.y)*0.5,front),material)
        else:_box(group,Vector3(size.x-2*WALL,size.y,WALL),Vector3(center.x,center.y,front),material)
        var union=AABB();var seeded:=false
        for m in group.get_children():
            var b:AABB=m.transform*m.get_aabb();union=union.merge(b) if seeded else b;seeded=true
        maximum_error=maxf(maximum_error,maxf(union.position.distance_to(bounds.position),union.end.distance_to(bounds.end)))
    var portal=tower.get_node_or_null("highland-central-sacred-portal")
    if portal!=null:originals.append({"node":portal,"visible":portal.visible})
    report={"sections":required.size(),"wall_thickness":WALL,"outer_bounds_max_error":maximum_error,"portal_width":1.75,"portal_height":2.8,"portal_floor":3.55,"entry_stairs_connected":false,"capture_deck_opened":true,"walkability_validated":false,"collision_boxes":bodies.size()}
    set_enabled(false);return true
func _box(parent:Node3D,size:Vector3,position:Vector3,material:Material)->void:
    var mesh=MeshInstance3D.new();var box=BoxMesh.new();box.size=size;mesh.mesh=box;mesh.material_override=material;parent.add_child(mesh);mesh.position=position
    var body=StaticBody3D.new();mesh.add_child(body);var c=CollisionShape3D.new();var shape=BoxShape3D.new();shape.size=size;c.shape=shape;body.add_child(c);bodies.append(body)
func set_enabled(value:bool)->void:
    if not is_instance_valid(root):return
    root.visible=value
    for row in originals:row.node.visible=false if value else row.visible
    for body in bodies:body.collision_layer=1 if value else 0
