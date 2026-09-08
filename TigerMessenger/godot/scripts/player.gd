extends CharacterBody3D

var heading := Vector3.FORWARD
var camera: Camera3D
var arm: SpringArm3D
var model: Node3D
var checkpoint := Vector3(0, 36, 0)
var enabled := true
var step_time := 0.0
signal footstep

func _ready() -> void:
	up_direction = position.normalized()
	floor_snap_length = 0.65
	floor_max_angle = deg_to_rad(52)
	safe_margin = 0.025
	var shape := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.28
	capsule.height = 1.50
	shape.shape = capsule
	shape.position.y = 0.78
	add_child(shape)
	model = preload("res://assets/messenger.glb").instantiate()
	model.rotation.y = PI
	add_child(model)
	arm = SpringArm3D.new()
	arm.position.y = 1.7
	arm.spring_length = 9.0
	arm.rotation.x = -0.28
	arm.margin = 0.35
	arm.add_excluded_object(get_rid())
	var cast_shape := SphereShape3D.new()
	cast_shape.radius = 0.22
	arm.shape = cast_shape
	add_child(arm)
	camera = Camera3D.new()
	camera.fov = 52
	camera.far = 220
	arm.add_child(camera)
	camera.current = true

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		heading = heading.rotated(position.normalized(), -event.relative.x * 0.004)
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP: arm.spring_length = maxf(3.5, arm.spring_length - 0.7)
		if event.button_index == MOUSE_BUTTON_WHEEL_DOWN: arm.spring_length = minf(17, arm.spring_length + 0.7)

func _physics_process(dt: float) -> void:
	if not enabled: return
	up_direction = global_position.normalized()
	heading = heading.slide(up_direction).normalized()
	if heading.length_squared() < 0.01: heading = Vector3.RIGHT.slide(up_direction).normalized()
	var right := heading.cross(up_direction).normalized()
	global_basis = Basis(right, up_direction, -heading).orthonormalized()
	var move := Input.get_vector("left", "right", "forward", "back")
	var wish := (right * move.x + heading * -move.y)
	var radial := velocity.dot(up_direction)
	var tangential := velocity.slide(up_direction)
	var speed := 9.0 if Input.is_action_pressed("sprint") else 6.5
	tangential = tangential.move_toward(wish * speed, dt * 30)
	velocity = tangential + up_direction * radial
	if is_on_floor() and Input.is_action_just_pressed("jump"):
		velocity += up_direction * (8.0 - minf(radial, 0.0))
	velocity -= up_direction * 20 * dt
	move_and_slide()
	if global_position.length() < 25 or global_position.length() > 70:
		global_position = checkpoint
		velocity = Vector3.ZERO
	if is_on_floor() and wish.length_squared() > .1:
		step_time += dt
		model.position.y = absf(sin(step_time * 15)) * .035
		if step_time > .34:
			footstep.emit()
			step_time = 0
	else: model.position.y = 0
