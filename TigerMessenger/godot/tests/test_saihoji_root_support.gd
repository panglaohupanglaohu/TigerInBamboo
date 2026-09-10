extends SceneTree
func _initialize():call_deferred("run")
func run():
    var island=Node3D.new();root.add_child(island)
    var support=load("res://scripts/saihoji_root_support.gd").new();var result=support.apply(island)
    var neighbours:Dictionary={}
    for t in support.top_triangles:
        for v in t:
            if not neighbours.has(v):neighbours[v]=[]
            for w in t:
                if w!=v:neighbours[v].append(w)
    var unseen=neighbours.duplicate();var components:=0
    while not unseen.is_empty():
        var queue:Array=[unseen.keys()[0]];components+=1
        while not queue.is_empty():
            var v=queue.pop_back()
            if not unseen.has(v):continue
            unseen.erase(v)
            for w in neighbours[v]:
                if unseen.has(w):queue.append(w)
    var test_radius=support.triangle_radius(Vector3(-1,2,-1),Vector3(1,2,-1),Vector3(0,2,1))
    result.connected_components=components;result.closest_triangle_error=absf(test_radius-2.0)
    result.raised_plate_y=maxf(6.08,(support.dry_plate_radius-172.0)/0.5)
    result.passed=components==1 and result.closest_triangle_error<0.00001 and result.raised_plate_y==6.08
    FileAccess.open("/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/saihoji-pines-v1/root-support-topology.json",FileAccess.WRITE).store_string(JSON.stringify(result,"  "))
    print(result);quit(0 if result.passed else 1)
