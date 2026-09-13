extends RefCounted
var phase="stowed"
var progress=0.0
var occupants:Dictionary={}
var setter:Callable
func bind(callback:Callable)->void:
    setter=callback;setter.call(0.0)
func deploy(stopped:bool)->bool:
    if not stopped or not occupants.is_empty() or phase=="retracting":return false
    if phase=="stowed":phase="deploying"
    return true
func retract()->bool:
    if not occupants.is_empty() or phase=="deploying":return false
    if phase=="deployed":phase="retracting"
    return true
func enter(identity:String)->bool:
    if identity.is_empty() or phase!="deployed" or occupants.has(identity):return false
    occupants[identity]=true;return true
func leave(identity:String)->bool:return occupants.erase(identity)
func can_sail()->bool:return phase=="stowed" and occupants.is_empty()
func tick(dt:float)->bool:
    if not is_finite(dt) or dt<0:return false
    if phase=="deploying":
        progress=minf(1,progress+dt/1.5)
        if progress==1:phase="deployed"
    elif phase=="retracting":
        progress=maxf(0,progress-dt/1.5)
        if progress==0:phase="stowed"
    setter.call(progress);return true
