extends SceneTree
var failures:Array=[]
var count:=0
func check(value:bool,label:String)->void:
    count+=1
    if not value:failures.append(label)
func _initialize()->void:
    var world=load("res://scripts/saihoji_battle_world.gd").new()
    var oracle:Array=[[1,10,0.47538211406208575],[27,140,0.40803296281956136],[0,0,0],[2147483647,999,0.9624436944723129]]
    for row in oracle:check(abs(world._vt_hash(row[0],row[1])-row[2])<1e-12,"source JS uint32 hash %s"%[row])
    var heavy:Dictionary={"state":"ground","id":"vanguard-1","life":3,"arrow_hits":0,"javelin_hits":0,"melee_hits":0,"node":Node3D.new()}
    for i in range(19):world._damage_heavy(heavy,"arrow")
    for i in range(9):world._damage_heavy(heavy,"javelin")
    for i in range(14):world._damage_heavy(heavy,"melee")
    check(heavy.life==3,"subthreshold damage types never combine")
    world._damage_heavy(heavy,"arrow");check(heavy.life==2 and heavy.arrow_hits==0 and heavy.javelin_hits==9,"twentieth arrow independent wound")
    world._damage_heavy(heavy,"javelin");check(heavy.life==1,"tenth javelin wound")
    world._damage_heavy(heavy,"melee");check(heavy.life==0 and heavy.state=="down","fifteenth melee third wound")
    var blue:Dictionary={"state":"formed","id":"blue-0-0","role":"spear","shield_broken":false,"hp":2,"nodes":{},"node":Node3D.new(),"grudge":0.0}
    world._hit_blue(blue,"blade","vanguard-1");check(blue.shield_broken and blue.hp==2,"first blade breaks shield only")
    check(blue.grudge==9.0,"source retaliation duration")
    world._hit_blue(blue,"blade","vanguard-1");check(blue.state=="down","second blade downs ordinary defender")
    blue.state="formed";blue.hp=2
    world._hit_blue(blue,"bolt","vanguard-1");check(blue.hp==1 and blue.state=="formed","first bolt survives")
    world._hit_blue(blue,"bolt","vanguard-1");check(blue.state=="down","second bolt downs")
    var gun:Dictionary={"bolt_phase":"idle","bolt_t":0.0,"bolt_charge":0.0}
    check(not world._charge_bolt(gun,1.54,true),"no early charged shot")
    check(world._charge_bolt(gun,0.02,true) and gun.bolt_phase=="discharge","1.55 second charge fires")
    world._charge_bolt(gun,0.18,false);check(gun.bolt_phase=="cooldown","0.18 discharge then cooldown")
    world._charge_bolt(gun,0.86,false);check(gun.bolt_phase=="idle","0.85 cooldown then idle")
    world._charge_bolt(gun,0.7,true);world._charge_bolt(gun,0.01,false);check(gun.bolt_phase=="idle" and gun.bolt_charge==0.0,"lost target cancels charge")
    # Failure predicate only: these fixtures do not count as an actual lost battle.
    world.director.running=true;world.director.phase="fight"
    world.reinforcement_count=5;world._check_defeat();check(world.director.running,"future supply prevents failure")
    world.reinforcement_count=6;world.ships.assign([{"state":"out"}]);world._check_defeat();check(world.director.running,"inbound ship prevents failure")
    world.ships[0].state="docked";world.projectiles.assign([{"kind":"arrow"}]);world._check_defeat();check(world.director.running,"in-flight arrow prevents premature failure")
    world.projectiles.clear();world.troops.assign([{"state":"formed","role":"spear"}]);world._check_defeat();check(world.director.running,"living anti-air defender prevents failure")
    world.troops[0].role="gladius";world._check_defeat();check(not world.director.running and world.director.phase=="stopped","irrecoverable anti-air objective stops after supplies and attacks resolve")
    var report:Dictionary={"checks":count,"failures":failures,"passed":failures.is_empty(),"scope":"native combat contracts; vtHash reference evaluated directly from original JS source"}
    print(JSON.stringify(report))
    heavy.node.free();blue.node.free();world.director.free();world.music.free();world.free()
    quit(0 if failures.is_empty() else 1)
