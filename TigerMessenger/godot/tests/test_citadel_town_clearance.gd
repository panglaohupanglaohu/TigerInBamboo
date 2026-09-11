extends SceneTree
func _initialize()->void:call_deferred("run")
func run()->void:
    var scene=Node3D.new();root.add_child(scene)
    var town=Node3D.new();scene.add_child(town)
    var tower=Node3D.new();scene.add_child(tower)
    var obstruction=MeshInstance3D.new();var slab=BoxMesh.new();slab.size=Vector3(12,0.2,12)
    obstruction.mesh=slab;obstruction.position=Vector3(0,4,0);town.add_child(obstruction)
    var clearance=preload("res://scripts/citadel_town_cavity.gd").new()
    assert(clearance.bind(town,tower));assert(clearance.changes.size()==1)
    clearance.set_enabled(true)
    await physics_frame;await physics_frame;await process_frame
    assert(clearance.verify_geometry())
    var generated:CSGMesh3D=clearance.candidate
    assert(not obstruction.visible and generated.use_collision)
    clearance.set_enabled(false)
    assert(obstruction.visible and not generated.use_collision and generated.collision_layer==0)
    clearance.unbind();assert(not is_instance_valid(generated));assert(obstruction.visible)
    obstruction.position.x=30
    assert(clearance.bind(town,tower))
    assert(clearance.changes.is_empty() and clearance.report.verified_empty_without_cut)
    assert(clearance.verify_geometry())
    clearance.unbind();scene.free()
    print(JSON.stringify({"passed":true,"inserted_obstruction_cut":true,"actual_empty_geometry_verified":true,"collision_and_visibility_restored":true,"scope":"Synthetic tower-clearance geometry and lifecycle regression"}))
    quit()
