extends SceneTree
func _initialize()->void:
    var world=load("res://scripts/saihoji_battle_world.gd").new()
    var line=world._line(Color.WHITE,0.025)
    var pairs=[ [Vector3(4,7,-2),Vector3(-3,11,9)], [Vector3.ZERO,Vector3.RIGHT*7], [Vector3(8,-7,5),Vector3(8,4,5)] ]
    var checks:Array=[]
    for pair in pairs:
        world._place_line(line,pair[0],pair[1],0.025)
        checks.append({"start_error":(line.transform*Vector3(0,-0.5,0)).distance_to(pair[0]),"end_error":(line.transform*Vector3(0,0.5,0)).distance_to(pair[1])})
    var passed:bool=checks.all(func(row):return row.start_error<0.00001 and row.end_error<0.00001)
    print(JSON.stringify({"checks":checks,"passed":passed,"scope":"Cylinder endpoints match the actual rope/beam anchors for diagonal, horizontal and vertical directions"}))
    line.free();world.director.free();world.music.free();world.free();quit(0 if passed else 1)
