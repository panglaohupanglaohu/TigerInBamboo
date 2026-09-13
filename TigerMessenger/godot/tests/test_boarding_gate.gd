extends SceneTree
var poses=[]
func _initialize()->void:
    var gate=load("res://scripts/citadel_boarding_gate.gd").new()
    gate.bind(func(p):poses.append(p))
    var checks=[]
    checks.append(not gate.deploy(false));checks.append(not gate.enter("soldier-21"))
    checks.append(gate.deploy(true));gate.tick(.75)
    checks.append(is_equal_approx(gate.progress,.5));checks.append(not gate.enter("soldier-21"));checks.append(not gate.retract())
    gate.tick(.75);checks.append(gate.enter("soldier-21"));checks.append(not gate.enter("soldier-21"));checks.append(gate.enter("messenger"))
    checks.append(not gate.retract());checks.append(not gate.can_sail());checks.append(not gate.leave("unknown"))
    gate.leave("soldier-21");checks.append(not gate.retract())
    gate.leave("messenger");checks.append(gate.retract());checks.append(not gate.enter("late"));checks.append(not gate.deploy(true))
    gate.tick(1.5);checks.append(gate.can_sail());checks.append(poses[-1]==0);checks.append(not gate.tick(NAN))
    var passed=checks.all(func(value):return value)
    print("Boarding lifecycle guards: ",passed," (",checks.size()," assertions)")
    quit(0 if passed else 1)
