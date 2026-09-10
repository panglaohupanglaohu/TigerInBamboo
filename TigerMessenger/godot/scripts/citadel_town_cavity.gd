extends RefCounted
## Cut only the verified town slab through the sacred tower; retain its source mesh.
var source:MeshInstance3D
var candidate:CSGMesh3D
var source_visible:=true
var report:Dictionary={}
func bind(town:Node3D,tower:Node3D)->bool:
    source=town.get_node_or_null("castle-shared-edge-town-candidate/citadel-layer-1/town-terrace-0-level-1/Mesh114") as MeshInstance3D
    if source==null:return false
    var b:=source.get_aabb()
    if absf(b.size.y-0.19)>0.001 or b.size.x<19.0 or b.size.z<19.0:return false
    source_visible=source.visible
    candidate=CSGMesh3D.new();candidate.name="TownSlabWithTowerOpening";candidate.mesh=source.mesh
    source.get_parent().add_child(candidate);candidate.transform=source.transform
    candidate.use_collision=true
    var local:Transform3D=candidate.global_transform.affine_inverse()*tower.global_transform
    var cut=CSGBox3D.new();cut.operation=CSGShape3D.OPERATION_SUBTRACTION;cut.size=Vector3(6.7,2,6.0);candidate.add_child(cut)
    cut.transform=local*Transform3D(Basis.IDENTITY,Vector3(0,4.1,0))
    var doorway=CSGBox3D.new();doorway.operation=CSGShape3D.OPERATION_SUBTRACTION;doorway.size=Vector3(1.75,2,0.8);candidate.add_child(doorway)
    doorway.transform=local*Transform3D(Basis.IDENTITY,Vector3(0,4.1,3.35))
    report={"source":source.get_meta("extras",{}).get("sourcePath",""),"slab_bounds":b,"tower_opening":Vector2(6.7,6.0),"door_corridor_width":1.75,"method":"CSG subtraction on the existing mesh; source retained","visual_verified":false}
    set_enabled(false);return true
func set_enabled(value:bool)->void:
    if not is_instance_valid(candidate):return
    source.visible=false if value else source_visible
    candidate.visible=value;candidate.collision_layer=5 if value else 0
