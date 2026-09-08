extends SceneTree
## 独立运行：godot --headless --path godot --script res://scripts/test_asset_review.gd
## 测试真实检视场景的布局、取景、输入、缺失状态及旧资源释放；不替代图像验收。

var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("_run")


func _check(condition: bool, message: String) -> void:
	if not condition:
		failures.append(message)
		push_error(message)


func _run() -> void:
	root.size = Vector2i(1280, 800)
	var packed: PackedScene = load("res://scenes/asset_review.tscn")
	var review = packed.instantiate()
	root.add_child(review)
	await process_frame
	await process_frame
	review.set_process(false)
	_check(review.assets.size() > 0, "原作清单应能加载")
	_check(review.list.item_count == review.assets.size(), "列表必须包含每个清单项")
	_check(review.model_view.own_world_3d, "模型必须使用独立三维视口")
	_check(not review.list.get_global_rect().intersects(review.view_container.get_global_rect()), "列表不能覆盖模型视口")
	_check(not review.info.get_global_rect().intersects(review.view_container.get_global_rect()), "说明不能覆盖模型视口")
	_check(review.model_view.size.x > 200 and review.model_view.size.y > 180, "模型视口必须有实际绘制空间")
	if not review.assets.is_empty():
		_check(review.list.get_item_text(0).contains(str(review.assets[0].get("label", ""))), "列表显示原作名称")

	_check(review.candidates.get("scoutAircraft") == "res://scenes/scout_candidate.tscn", "候选检视入口必须来自统一注册表")
	for i in range(review.assets.size()):
		if review.assets[i].get("id") == "scoutAircraft":
			review._select(i)
			_check(not review.candidate_button.disabled, "侦察机应允许检视候选")
			break
	review._select(0)

	_check(review.current.scene_file_path == "res://assets/art-pilots/bookshop-art-v3.glb", "默认应加载书店当前第三轮版本")
	review.archive_toggle.button_pressed = true
	_check(review.current.scene_file_path == "res://assets/originals/bookshop.glb", "归档切换应回到原版")
	review.archive_toggle.button_pressed = false
	_check(review.current.scene_file_path == "res://assets/art-pilots/bookshop-art-v3.glb", "应能切回当前版本")

	if DisplayServer.get_name() != "headless":
		await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(ProjectSettings.globalize_path("res://../artifacts/world-migration/registry-current-bookshop.png"))

	# 偏移、旋转、宽扁模型；隐藏的巨大网格不得影响自动取景。
	review._release_current()
	var sample := Node3D.new()
	sample.position = Vector3(43, 27, -15)
	sample.rotation.y = 0.45
	var mesh := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(200, 20, 100)
	mesh.mesh = box
	sample.add_child(mesh)
	var hidden := MeshInstance3D.new()
	var hidden_box := BoxMesh.new()
	hidden_box.size = Vector3.ONE * 10000
	hidden.mesh = hidden_box
	hidden.visible = false
	sample.add_child(hidden)
	review.world_root.add_child(sample)
	review.current = sample
	review._reset_view()
	_check(review.pivot.global_position.distance_to(sample.global_position) < 0.01, "相机围绕实际包围盒中心")
	_check(review.frame_radius < 300, "隐藏网格不应扩大取景")
	var bounds: AABB = review._aabb(sample)
	for step in range(8):
		review.orbit = step * TAU / 8.0
		review._update_camera()
		for corner in range(8):
			var point: Vector3 = bounds.get_endpoint(corner)
			_check(not review.camera.is_position_behind(point), "旋转时包围盒不能落在相机背后")
			var projected: Vector2 = review.camera.unproject_position(point)
			_check(Rect2(Vector2.ZERO, Vector2(review.model_view.size)).has_point(projected), "旋转时整体应位于模型视口内")

	var before_zoom: float = review.zoom_factor
	var wheel := InputEventMouseButton.new()
	wheel.button_index = MOUSE_BUTTON_WHEEL_UP
	wheel.pressed = true
	review._view_input(wheel)
	_check(review.zoom_factor < before_zoom, "滚轮应拉近模型")
	var press := InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	review._view_input(press)
	var motion := InputEventMouseMotion.new()
	motion.relative = Vector2(30, 12)
	var before_orbit: float = review.orbit
	review._view_input(motion)
	_check(review.orbit != before_orbit, "拖动应旋转视角")
	press.pressed = false
	review._input(press)
	_check(not review.dragging, "释放鼠标应结束拖动")
	review._toggle_rotation()
	_check(not review.orbiting and review.rotate_button.text == "继续旋转", "暂停状态与按钮一致")
	review._reset_view()
	_check(is_equal_approx(review.zoom_factor, 1.0) and is_zero_approx(review.orbit), "重置恢复初始取景")

	# partial 即使没有 lost 也显示未完成；切换到缺失资源必须释放旧项。
	var sample_id := sample.get_instance_id()
	var missing: Dictionary = {"id": "__review_test_missing", "label": "缺失测试", "godot": {"res": "res://assets/originals/__review_test_missing.glb"}}
	review.assets.append(missing)
	review.list.add_item("缺失测试")
	review.export_report["__review_test_missing"] = {"status": "partial", "lost": []}
	review._select(review.assets.size() - 1)
	_check(not is_instance_id_valid(sample_id), "切换时旧模型应立即释放")
	_check(review.current == null and review.empty_hint.visible, "缺失资源应明确显示空状态")
	_check(review.info.text.contains(review.PARTIAL_NOTICE), "partial 必须提示材质和动画未完成")
	_check(review.info.text.contains("尚未导出"), "缺失资源必须给出原因")

	# 窄桌面窗口重排，仍不让列表和说明压住模型区域。
	root.size = Vector2i(900, 650)
	await process_frame
	await process_frame
	_check(not review.list.get_global_rect().intersects(review.view_container.get_global_rect()), "窄窗口列表不能遮挡模型")
	_check(not review.info.get_global_rect().intersects(review.view_container.get_global_rect()), "窄窗口说明不能遮挡模型")
	review.queue_free()
	await process_frame
	if failures.is_empty():
		print("ASSET_REVIEW_TEST_OK: layout, names, framing, orbit/zoom/reset, partial warning, missing resource, release")
		quit(0)
	else:
		print("ASSET_REVIEW_TEST_FAILED: %d" % failures.size())
		quit(1)
