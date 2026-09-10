extends RefCounted
## Reversible hip-hinge readiness pose for the approved rigid-leg Roman family.
## The current source has no knee joints: this is a forward lean, not a crouch.
## Bind once in the imported neutral pose; fade to zero before combat animation.
const LEAN_RADIANS := -0.42
var parts: Array[Node3D] = []
var neutral: Array[Transform3D] = []
var pivot := Vector3.ZERO
var weight := 0.0
var bound := false

func bind(_actor: Node3D, nodes: Dictionary) -> bool:
    reset()
    parts.clear(); neutral.clear(); bound = false
    var body: Node3D = nodes.get("n2")
    var left: Node3D = nodes.get("n23")
    var right: Node3D = nodes.get("n26")
    if not body or not left or not right: return false
    var parent := body.get_parent()
    if left.get_parent() != parent or right.get_parent() != parent: return false
    pivot = (left.position + right.position) * 0.5
    # Arms and equipment are siblings, so hinging the entire upper assembly
    # preserves the approved hands-to-grips transforms for all three weapons.
    for child in parent.get_children():
        if child is Node3D and child != left and child != right:
            parts.append(child); neutral.append(child.transform)
    bound = not parts.is_empty()
    return bound

func update(value: float) -> void:
    if not bound: return
    weight = clampf(value, 0.0, 1.0)
    var rotation := Basis(Vector3.BACK, LEAN_RADIANS * weight)
    var hinge := Transform3D(rotation, pivot - rotation * pivot)
    for i in parts.size():
        if is_instance_valid(parts[i]): parts[i].transform = hinge * neutral[i]

func reset() -> void:
    for i in parts.size():
        if is_instance_valid(parts[i]): parts[i].transform = neutral[i]
    weight = 0.0
