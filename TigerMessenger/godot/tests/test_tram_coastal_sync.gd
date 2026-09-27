extends SceneTree
## Coastal tram sync: old line hidden, new line mounted, castle frame matches Web,
## stations sit on the rail, and a target-angle capture for visual comparison.
var checks:Array=[]
func check(label:String,ok:bool,detail=null)->void:
	checks.append({"name":label,"passed":ok,"detail":detail})
func _initialize()->void:call_deferred("run")
func run()->void:
	root.size=Vector2i(1600,1000)
	var world=load("res://scenes/original_world.tscn").instantiate()
	root.add_child(world)
	for i in 3:await process_frame
	var sync:Dictionary=world.tram_sync
	check("old archived tram line hidden",int(sync.get("old_hidden",0))>=1,sync.get("old_hidden"))
	check("coastal tram geometry mounted",int(sync.get("new_meshes",0))>1000,sync.get("new_meshes"))
	var route:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://data/tram-coastal-route-v1.json"))
	check("two holy-city stations exported",route.stations.size()==2)
	var castle:Node3D=world.castle_adapter.original
	var m:Array=route.webCastleMatrix
	var web:=Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
	var g:=castle.global_transform
	var pos_err:=g.origin.distance_to(web.origin)
	var axis_err:=maxf(g.basis.x.normalized().distance_to(web.basis.x.normalized()),maxf(g.basis.y.normalized().distance_to(web.basis.y.normalized()),g.basis.z.normalized().distance_to(web.basis.z.normalized())))
	check("Godot castle frame equals Web castle frame",pos_err<0.5 and axis_err<0.01,{"position_error":pos_err,"axis_error":axis_err})
	var pts:Array=route.centreline
	for st in route.stations:
		var sp:=Vector3(st.world[0],st.world[1],st.world[2])
		var best:=INF
		for p in pts:best=minf(best,sp.distance_to(Vector3(p[0],p[1],p[2])))
		check("station %s beside rail"%st.id,best<16.0,best)
	var cam:=Camera3D.new();world.add_child(cam);cam.fov=52;cam.far=4000;cam.current=true
	var up:=g.basis.y.normalized()
	cam.global_position=g*Vector3(-20,70,215)
	cam.look_at(g*Vector3(-5,5,40),up)
	for i in 4:await process_frame
	if DisplayServer.get_name()!="headless":
		await RenderingServer.frame_post_draw
		var err=root.get_texture().get_image().save_png("res://../artifacts/pipeline/citadel-tram-iterations/godot-r26-target.png")
		check("target-angle capture saved",err==OK)
	var passed:=checks.all(func(c):return c.passed)
	var f=FileAccess.open("res://../artifacts/pipeline/citadel-tram-iterations/godot-tram-sync-check.json",FileAccess.WRITE)
	f.store_string(JSON.stringify({"passed":passed,"checks":checks,"scope":"Static geometry and data sync only; Godot tram motion/riding not migrated"},"  "))
	print(JSON.stringify({"passed":passed,"checks":checks}))
	quit(0 if passed else 1)
