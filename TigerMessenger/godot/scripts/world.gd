extends Node3D
## Native playable edition. Terrain rendering and physics share ONE mesh.
## WFC is compiled by the existing JS solver; no approximate second solver.
const R := 32.0
const Player = preload("res://scripts/player.gd")
const BOOKSHOP_ART = preload("res://assets/art-pilots/bookshop-art-v3.glb")
const BookshopInk = preload("res://scripts/bookshop_ink.gd")
const BookshopMaterials = preload("res://scripts/bookshop_materials.gd")
const BookshopSurroundings = preload("res://scripts/bookshop_surroundings.gd")
var bookshop: Node3D
var player: CharacterBody3D
var chapters: Array = []
var chapter := 0
var beacons: Array[Node3D] = []
var actors: Dictionary = {}
var planes: Array[Node3D] = []
var hud: Label
var narrative: RichTextLabel
var action: Button
var start_panel: PanelContainer
var started := false
var protection := 0.0
var cooldown := 0.0
var clock := 0.0
var ui_clock := 0.0
var soundtrack: AudioStreamPlayer
var sounds: Dictionary = {}
var safe_route: Array[Vector3] = []
var smoke_test := false
var smoke_frames := 0
var capture := false
var route_test := false

func direction(theta: float, longitude: float = 0.0) -> Vector3:
	return Vector3(sin(theta)*cos(longitude), cos(theta), sin(theta)*sin(longitude))

func elevation(d: Vector3) -> float:
	# Two continents and a broad causeway; gentle walking slopes, no noise cracks.
	var north := pow(maxf(0, d.dot(direction(.5))), 8) * 2.5
	var south := pow(maxf(0, d.dot(direction(2.5))), 8) * 2.2
	var route := exp(-pow(d.z * 7, 2)) * 1.4
	return maxf(north, maxf(south, route)) - .5 + .12 * sin(d.x * 17) * cos(d.y * 13)

func surface(d: Vector3, lift: float = 0.0) -> Vector3:
	return d * (R + elevation(d) + lift)

func orient(node: Node3D, d: Vector3) -> void:
	var forward := Vector3.FORWARD.slide(d).normalized()
	if forward.length_squared() < .01: forward = Vector3.RIGHT.slide(d).normalized()
	node.basis = Basis(forward.cross(d), d, -forward).orthonormalized()

func asset(id: String, parent: Node3D, at: Vector3, scale_value: float = 1.0) -> Node3D:
	var model: Node3D = load("res://assets/%s.glb" % id).instantiate()
	parent.add_child(model)
	model.position = at
	model.scale = Vector3.ONE * scale_value
	return model

func tint_mesh(mesh: Mesh, color: Color) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	var mat := StandardMaterial3D.new()
	mat.albedo_color = color
	mat.roughness = .9
	instance.material_override = mat
	return instance

func _ready() -> void:
	smoke_test = "--smoke-test" in OS.get_cmdline_user_args()
	capture = "--capture" in OS.get_cmdline_user_args()
	route_test = "--route-test" in OS.get_cmdline_user_args()
	for pair in [["forward",KEY_W],["back",KEY_S],["left",KEY_A],["right",KEY_D],["sprint",KEY_SHIFT],["jump",KEY_SPACE],["interact",KEY_R],["shield",KEY_1],["lure",KEY_2]]:
		InputMap.add_action(pair[0])
		var e := InputEventKey.new(); e.physical_keycode = pair[1]
		InputMap.action_add_event(pair[0], e)
	chapters = JSON.parse_string(FileAccess.get_file_as_string("res://data/chapters.json"))
	build_environment()
	build_terrain()
	build_places()
	build_audio()
	player = Player.new()
	player.name = "Messenger"
	player.position = surface(direction(.12), 1.5)
	player.checkpoint = player.position
	player.heading = Vector3.RIGHT
	add_child(player)
	# The original bookshop is seven metres tall; leave room above the player.
	player.arm.spring_length = 14.0
	player.enabled = false
	player.footstep.connect(func(): play_sound("step"))
	build_ui()
	if smoke_test or capture or route_test:
		begin()
		print("NATIVE_READY: terrain + imported GLB + %d chapters + %d aircraft" % [chapters.size(), planes.size()])

func build_environment() -> void:
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("172c36")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("afcfc8")
	env.ambient_light_energy = .4
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.environment = env
	add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.name = "WarmSun"
	sun.rotation_degrees = Vector3(-48,-28,0)
	sun.light_color = Color("ffe2ac")
	sun.light_energy = .45
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 90
	add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(35,145,0)
	fill.light_color = Color("70a8c3")
	fill.light_energy = .14
	add_child(fill)

func build_terrain() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := 64
	var slices := 128
	for i in range(rings):
		for j in range(slices):
			var a := direction(PI*i/rings, TAU*j/slices)
			var b := direction(PI*(i+1)/rings, TAU*j/slices)
			var c := direction(PI*i/rings, TAU*(j+1)/slices)
			var d := direction(PI*(i+1)/rings, TAU*(j+1)/slices)
			# Godot front faces are CLOCKWISE (opposite Three.js).
			for tri in [[a,b,c],[b,d,c]]:
				var center: Vector3 = (tri[0]+tri[1]+tri[2]).normalized()
				var col := Color("5e886e") if center.y > -.12 else Color("9aabb9")
				if elevation(center) < .22: col = Color("c8bb91")
				col = col.lightened(sin(i*13+j*7)*.025)
				for v in tri:
					st.set_color(col)
					st.add_vertex(surface(v))
	st.generate_normals()
	var terrain := MeshInstance3D.new()
	terrain.name = "Terrain_Visual_And_Collision"
	terrain.mesh = st.commit()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.roughness = 1
	terrain.material_override = mat
	add_child(terrain)
	terrain.create_trimesh_collision()
	var sea := SphereMesh.new()
	sea.radius = R-.20; sea.height = sea.radius*2
	sea.radial_segments = 96; sea.rings = 48
	var ocean := tint_mesh(sea,Color("367c87"))
	ocean.name = "Ocean"
	add_child(ocean)

func build_places() -> void:
	var context_source := BookshopSurroundings.load_source()
	var context_skipped: Array = []
	set_meta("bookshop_context_enabled", not context_source.is_empty())
	var angles := [.28,.74,1.12,1.49,2.12,2.64]
	var models := ["bookshop","gate","pine","postbox","pine","tower"]
	for i in range(angles.size()):
		var d := direction(angles[i])
		var root := Node3D.new()
		root.name = chapters[i].target
		add_child(root)
		root.position = surface(d,.03)
		orient(root,d)
		beacons.append(root)
		# The meridian route runs along local X; keep landmark buildings beside it.
		if i == 0:
			build_bookshop(root)
		else:
			var model := asset(models[i],root,Vector3(0,0,3),1.0)
			add_static_collision(model,models[i])
		asset("postbox",root,Vector3.ZERO,.8)
		var label := Label3D.new()
		label.text = chapters[i].place
		label.position = Vector3(0,2.3,0)
		label.font_size = 44; label.pixel_size = .006
		label.modulate = Color("ffe3a3")
		label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		root.add_child(label)
		var disk := CylinderMesh.new()
		disk.top_radius = 1.0; disk.bottom_radius = 1.0; disk.height = .10
		root.add_child(tint_mesh(disk,Color("d4b26f")))
	actors.fox = asset("fox",beacons[3],Vector3(1.0,0,.5))
	actors.tiger = asset("tiger",beacons[4],Vector3(1.0,0,.5))
	var town: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/town.json"))
	# Occupancy and role come from the JS WFC result. One asset per column;
	# the highest cell selects the roof/tower instead of stacking whole roofs.
	var top: Dictionary = {}
	for m in town.modules:
		var key := "%s,%s" % [m.x,m.z]
		if not top.has(key) or m.y > top[key].y: top[key] = m
	for i in [0,5]:
		for m in top.values():
			var id := "tower" if m.family == "tower" or m.y > 0 else "house"
			var point: Vector3 = beacons[i].to_global(Vector3(m.x*3.1,0,m.z*3.1))
			# The Blender garden is 12.8 m wide; do not spawn the old town kit through it.
			if i == 0 and point.distance_to(bookshop.global_position) < 8.2: continue
			var ground := surface(point.normalized())
			if not context_source.is_empty() and BookshopSurroundings.should_skip_legacy(bookshop, ground):
				context_skipped.append({"kind": id, "position": str(ground)})
				continue
			var model := asset(id,self,ground,.72)
			orient(model,point.normalized()); model.scale = Vector3.ONE * .72
			add_static_collision(model,id)
	var rng := RandomNumberGenerator.new(); rng.seed = 20260906
	for i in range(110):
		var theta := rng.randf_range(.1,3.0)
		var lon := rng.randf_range(-.7,.7)
		var d := direction(theta,lon)
		if absf(d.z) < .10 or elevation(d) < .24: continue
		# Consume the original scale draw even when skipping; distant trees keep
		# exactly the same RNG sequence, transforms and placements as before.
		var pine_scale := rng.randf_range(.6,1.2)
		var ground := surface(d)
		if not context_source.is_empty() and BookshopSurroundings.should_skip_legacy(bookshop, ground):
			context_skipped.append({"kind": "pine", "position": str(ground)})
			continue
		var pine := asset("pine",self,ground,pine_scale)
		var scale_saved := pine.scale
		orient(pine,d); pine.scale = scale_saved
	for i in range(3):
		var plane := asset("aircraft",self,Vector3.ZERO,1.4)
		planes.append(plane)
	# Readable stepping stones trace the rescue route on the actual sphere.
	for i in range(90):
		var d := direction(.12+2.57*i/89)
		var tile := BoxMesh.new(); tile.size = Vector3(.6,.055,.42)
		var stone := tint_mesh(tile,Color("cbbb8e"))
		add_child(stone); stone.position = surface(d,.055); orient(stone,d)
	set_meta("bookshop_context_skipped", context_skipped)
	if not context_source.is_empty():
		var context := BookshopSurroundings.new()
		context.name = "Bookshop_Original_Surroundings"
		context.world = self
		context.bookshop = bookshop
		context.source = context_source
		add_child(context)

func build_bookshop(waypoint: Node3D) -> void:
	bookshop = BOOKSHOP_ART.instantiate()
	bookshop.name = "Bookshop_Blender_Art_V3"
	add_child(bookshop)
	var d := waypoint.to_global(Vector3(0, 0, 6.5)).normalized()
	bookshop.position = surface(d, .02)
	orient(bookshop, d)
	bookshop.rotate_object_local(Vector3.UP, PI)
	bookshop.set_meta("source_blend", "assets/models/optimized/bookshop-art-v3.blend")
	bookshop.set_meta("runtime_asset", BOOKSHOP_ART.resource_path)
	var facade_fill := OmniLight3D.new()
	facade_fill.name = "Bookshop_Facade_Fill"
	facade_fill.position = Vector3(1.5, 5.5, 7)
	facade_fill.omni_range = 16
	facade_fill.light_energy = .65
	facade_fill.light_color = Color("ffe8d0")
	bookshop.add_child(facade_fill)
	var garden := bookshop.find_child("Curved garden ground", true, false) as MeshInstance3D
	# Only the garden skirt is adapted to this smaller native planet. Building,
	# joinery, sign texture, source scale and the saved Blender/GLB stay intact.
	var adapted := ArrayMesh.new()
	for s in range(garden.mesh.get_surface_count()):
		var arrays := garden.mesh.surface_get_arrays(s)
		var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
		for v in range(vertices.size()):
			vertices[v].y += bookshop_garden_offset(vertices[v])
		arrays[Mesh.ARRAY_VERTEX] = vertices
		var surface_mesh := ArrayMesh.new()
		surface_mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		var st := SurfaceTool.new()
		st.create_from(surface_mesh, 0)
		st.generate_normals()
		st.set_material(garden.mesh.surface_get_material(s))
		st.commit(adapted)
	garden.mesh = adapted
	garden.create_trimesh_collision()
	for child in bookshop.get_children():
		if child is Node3D and str(child.name).begins_with("Entrance path"):
			child.position.y += bookshop_garden_offset(child.position)
			# Decorative low stones share the continuous garden collision below;
			# separate vertical lips would snag the walking capsule at every stone.
	var building := bookshop.find_child("hard-to-find-bookshop", true, false)
	for child in building.get_children():
		# Actual wall, bays and two entrance steps; no oversized box across the forecourt.
		if child is MeshInstance3D and str(child.name).get_slice("_", 0) in ["n5", "n7", "n9", "n13", "n25", "n41", "n43", "n45"]:
			child.create_trimesh_collision()
	BookshopInk.attach(bookshop)
	BookshopMaterials.set_enabled(bookshop)

func bookshop_garden_offset(point: Vector3) -> float:
	var radius := Vector2(point.x, point.z).length()
	var blend := smoothstep(3.2, 6.4, radius)
	var ground := bookshop.to_local(surface(bookshop.to_global(Vector3(point.x, 0, point.z)).normalized()))
	# Original garden rings follow y = .34 - .012 r². The edge blends just
	# into the terrain, while the flat inner forecourt and steps retain their height.
	return (ground.y - .025 - (.34 - .012 * radius * radius)) * blend

func add_static_collision(model: Node3D, id: String) -> void:
	if id == "pine" or id == "postbox": return
	var body := StaticBody3D.new()
	model.add_child(body)
	if id == "gate":
		for x in [-1.8,1.8]:
			var col := CollisionShape3D.new(); var box := BoxShape3D.new()
			box.size = Vector3(1,3.2,1.7); col.shape = box; col.position=Vector3(x,1.6,0); body.add_child(col)
	else:
		var col := CollisionShape3D.new(); var box := BoxShape3D.new()
		box.size = Vector3(2.1,3.8 if id=="tower" else 2.7,2.1)
		col.shape=box; col.position.y=box.size.y*.5; body.add_child(col)

func build_audio() -> void:
	for key in ["step","letter","power"]:
		var stream := AudioStreamWAV.new()
		stream.format = AudioStreamWAV.FORMAT_16_BITS
		stream.mix_rate = 22050
		var duration := .065 if key=="step" else .48
		var data := PackedByteArray()
		data.resize(int(22050*duration)*2)
		var frequency := 180.0 if key=="step" else (660.0 if key=="letter" else 330.0)
		for i in range(data.size()/2):
			var t := float(i)/22050
			var env := pow(1.0-t/duration,2)
			var wave := sin(TAU*frequency*t) + .3*sin(TAU*frequency*1.5*t)
			data.encode_s16(i*2,int(wave*env*3800))
		stream.data = data
		sounds[key]=stream
	soundtrack=AudioStreamPlayer.new(); soundtrack.volume_db=-10; add_child(soundtrack)

func play_sound(id: String) -> void:
	if not started or DisplayServer.get_name() == "headless": return
	soundtrack.stream=sounds[id]; soundtrack.play()

func build_ui() -> void:
	var layer := CanvasLayer.new(); add_child(layer)
	var panel := PanelContainer.new(); panel.position=Vector2(24,24); panel.custom_minimum_size=Vector2(330,180)
	layer.add_child(panel)
	var style := StyleBoxFlat.new(); style.bg_color=Color(.07,.14,.16,.94)
	style.set_corner_radius_all(14); style.content_margin_left=20; style.content_margin_right=20; style.content_margin_top=16; style.content_margin_bottom=16
	panel.add_theme_stylebox_override("panel",style)
	var stack := VBoxContainer.new(); stack.add_theme_constant_override("separation",10); panel.add_child(stack)
	var title := Label.new(); title.text="TIGER MESSENGER  /  家书"; title.add_theme_color_override("font_color",Color("ecc788")); stack.add_child(title)
	hud=Label.new(); hud.add_theme_font_size_override("font_size",17); stack.add_child(hud)
	action=Button.new(); action.text="[R] 交付家书"; action.pressed.connect(interact); stack.add_child(action)
	var power_row := HBoxContainer.new(); stack.add_child(power_row)
	for spec in [["1 · 英雄掩护",12.0],["2 · 佯动诱敌",22.0]]:
		var b := Button.new(); b.text=spec[0]; b.pressed.connect(func(): use_power(spec[1])); power_row.add_child(b)
	narrative=RichTextLabel.new(); narrative.custom_minimum_size=Vector2(285,108); narrative.bbcode_enabled=true; narrative.fit_content=true
	narrative.add_theme_font_size_override("normal_font_size",14); stack.add_child(narrative)
	var tips:=Label.new(); tips.text="WASD 行走 · Shift 疾跑 · 空格跳跃\n右键拖动转向 · 滚轮镜头 · M 静音\n脚下金色石径连接六封家书"; tips.add_theme_font_size_override("font_size",12); tips.modulate=Color("abc5ba"); stack.add_child(tips)
	start_panel=PanelContainer.new(); start_panel.position=Vector2(430,265); start_panel.custom_minimum_size=Vector2(440,245)
	start_panel.add_theme_stylebox_override("panel",style); layer.add_child(start_panel)
	var intro:=VBoxContainer.new(); intro.add_theme_constant_override("separation",20); start_panel.add_child(intro)
	var heading:=Label.new(); heading.text="借一封信，去把家人接回来。"; heading.add_theme_font_size_override("font_size",25); intro.add_child(heading)
	var text:=Label.new(); text.text="传统文明与莫比斯世界，落在同一颗星球。\n以信使为名，借英雄的力量争取时间。\n红狐和虎虎，正在等你。"; intro.add_child(text)
	var button:=Button.new(); button.text="开始救援"; button.pressed.connect(begin); intro.add_child(button)
	refresh_ui()

func begin() -> void:
	started=true; player.enabled=true; start_panel.hide(); play_sound("letter")

func interact() -> void:
	if not started or chapter >= chapters.size(): return
	if player.position.distance_to(beacons[chapter].position)>3.7: return
	narrative.text=chapters[chapter].text
	chapter+=1
	player.checkpoint=player.position+player.position.normalized()*.15
	if chapter==3: protection=90
	if chapter==5: protection=maxf(protection,45)
	play_sound("letter")
	refresh_ui()

func use_power(seconds: float) -> void:
	if not started or chapter<2 or cooldown>0: return
	protection=maxf(protection,seconds); cooldown=35; play_sound("power")

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("interact"): interact()
	if event.is_action_pressed("shield"): use_power(12)
	if event.is_action_pressed("lure"): use_power(22)
	if event is InputEventKey and event.pressed and event.keycode==KEY_M:
		AudioServer.set_bus_mute(0,not AudioServer.is_bus_mute(0))

func refresh_ui() -> void:
	if not is_instance_valid(hud): return
	if chapter>=chapters.size():
		hud.text="家书已送达 · 一家人重逢"; action.disabled=true; return
	var distance:=player.position.distance_to(beacons[chapter].position)
	var toward: Vector3 = (beacons[chapter].position-player.position).slide(player.position.normalized()).normalized()
	var angle: float=player.heading.signed_angle_to(toward,player.position.normalized())
	var bearing: String = "↑ 前方" if absf(angle)<.4 else ("↓ 身后" if absf(angle)>2.5 else ("← 左侧" if angle>0 else "→ 右侧"))
	hud.text="%s\n%s · %.0f m\n掩护 %.0f s · 技能冷却 %.0f s" % [chapters[chapter].title,bearing,distance,protection,cooldown]
	action.text="[R] "+chapters[chapter].action; action.disabled=distance>3.7

func _process(dt: float) -> void:
	if not started: return
	clock+=dt; protection=maxf(0,protection-dt); cooldown=maxf(0,cooldown-dt)
	ui_clock+=dt
	if ui_clock>.15: ui_clock=0; refresh_ui()
	for i in range(planes.size()):
		var theta:=1.14 if protection>0 else 2.12
		var d:=direction(theta+sin(clock*.19+i*.7)*.09,cos(clock*.19+i*.7)*.17)
		planes[i].position=d*(R+8+i*.7); orient(planes[i],d); planes[i].scale=Vector3.ONE*1.4
	for id in ["fox","tiger"]:
		if chapter < (4 if id=="fox" else 5): continue
		var companion: Node3D=actors[id]
		var side: float=-1 if id=="fox" else 1
		var d: Vector3=(player.position-player.heading*1.7+player.global_basis.x*side).normalized()
		var point:=surface(d,.06)
		companion.global_position=companion.global_position.lerp(point,1-exp(-dt*6))
		var up:=point.normalized(); var fwd: Vector3=player.heading.slide(up).normalized()
		companion.global_basis=Basis(up.cross(fwd),up,fwd).orthonormalized()
	if smoke_test:
		smoke_frames+=1
		if clock > 3.0:
			smoke_test=false
			if player.position.length()<31 or not player.is_on_floor():
				for k in range(player.get_slide_collision_count()):
					var hit=player.get_slide_collision(k)
					print("CONTACT ",hit.get_normal()," UP ",player.up_direction," dot ",hit.get_normal().dot(player.up_direction))
				push_error("NATIVE_PHYSICS_FAILED radius=%s grounded=%s" % [player.position.length(),player.is_on_floor()])
				get_tree().quit(1)
				return
			print("NATIVE_PHYSICS_OK radius=",player.position.length())
			for i in range(chapters.size()):
				player.position=beacons[i].position
				interact()
			assert(chapter==6,"Rescue sequence failed")
			print("NATIVE_CAMPAIGN_OK: six chapters completed")
			get_tree().quit()
	if capture and clock > 3.0:
		capture=false
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("res://../test-results/native.png")
		print("NATIVE_CAPTURE_OK")
		get_tree().quit()

func _physics_process(_dt: float) -> void:
	if not route_test or not started: return
	if chapter >= chapters.size():
		Input.action_release("forward")
		print("NATIVE_ROUTE_OK: walked all six waypoints using CharacterBody3D in ",snapped(clock,.1)," s")
		get_tree().quit()
		return
	if clock > 90:
		push_error("NATIVE_ROUTE_FAILED at chapter %s" % chapter)
		get_tree().quit(1)
		return
	var toward: Vector3 = beacons[chapter].position-player.position
	player.heading = toward.slide(player.position.normalized()).normalized()
	if toward.length() < 3.6:
		Input.action_release("forward")
		interact()
	else: Input.action_press("forward")
