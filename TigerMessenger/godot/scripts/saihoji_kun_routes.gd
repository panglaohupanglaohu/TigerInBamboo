extends RefCounted
## Island-local dry-ground graph. No world-space paths survive a Kun transform.
var garden
var cells:Dictionary={}
var trunks:Array=[]
var spacing:=0.6
var radius_local:=0.76
var body_height_metres:=1.22
var report:Dictionary={}
var edge_cache:Dictionary={}

func build(target_garden, pine_entries:Array, body_radius_metres:=0.38)->Dictionary:
    garden=target_garden;cells.clear();trunks.clear();edge_cache.clear()
    radius_local=body_radius_metres/garden.node.global_basis.x.length()
    for entry in pine_entries:
        for id in ["n8","n9"]:
            var mesh:MeshInstance3D=entry.ids.get(id)
            if not is_instance_valid(mesh):continue
            var vertices:=mesh.mesh.get_faces()
            var trans:Transform3D=garden.node.global_transform.affine_inverse()*mesh.global_transform
            var points:=PackedVector3Array()
            for v in vertices:points.append(trans*v)
            var box:=AABB(points[0],Vector3.ZERO)
            for point in points:box=box.expand(point)
            trunks.append({"faces":points,"bounds":box.grow(radius_local)})
    var blocked:=0
    for x in range(-35,36):
        for z in range(-20,21):
            var hit:Dictionary=garden.sample_support(Vector2(x,z)*spacing,radius_local)
            if hit.is_empty():continue
            var p:Vector3=hit.local_position
            if blocked_body(p):blocked+=1;continue
            cells[Vector2i(x,z)]=p
    report={"cells":cells.size(),"trunk_blocked":blocked,"body_radius_metres":body_radius_metres,"body_height_metres":body_height_metres,"spacing_local":spacing,"scope":"dry local graph; role equipment and route endpoints require separate validation"}
    return report

func blocked_body(p:Vector3)->bool:
    var p2:=Vector2(p.x,p.z)
    var height:float=body_height_metres/garden.node.global_basis.y.length()
    for trunk in trunks:
        var box:AABB=trunk.bounds
        if p.x<box.position.x or p.x>box.end.x or p.z<box.position.z or p.z>box.end.z or p.y>box.end.y or p.y+height<box.position.y:continue
        var faces:PackedVector3Array=trunk.faces
        for i in range(0,faces.size(),3):
            var a:=faces[i];var b:=faces[i+1];var c:=faces[i+2]
            if maxf(a.y,maxf(b.y,c.y))<p.y+0.05 or minf(a.y,minf(b.y,c.y))>p.y+height:continue
            var polygon:=_clip_height(PackedVector3Array([a,b,c]),p.y+0.05,true)
            polygon=_clip_height(polygon,p.y+height,false)
            var flat:=PackedVector2Array()
            for vertex in polygon:flat.append(Vector2(vertex.x,vertex.z))
            if flat.size()<2:continue
            if Geometry2D.is_point_in_polygon(p2,flat):return true
            for j in flat.size():
                if p2.distance_to(Geometry2D.get_closest_point_to_segment(p2,flat[j],flat[(j+1)%flat.size()]))<radius_local:return true
    return false

func segment_clear(a:Vector3,b:Vector3)->bool:
    var steps:=maxi(2,int(ceil(a.distance_to(b)/0.15)))
    var previous:=a
    for i in range(steps+1):
        var probe:=a.lerp(b,float(i)/steps)
        var hit:Dictionary=garden.sample_support(Vector2(probe.x,probe.z),radius_local)
        if hit.is_empty():return false
        var p:Vector3=hit.local_position
        if blocked_body(p) or absf(p.y-probe.y)>0.35:return false
        if i>0 and absf(p.y-previous.y)>0.3:return false
        previous=p
    return true

func edge_clear(a:Vector2i,b:Vector2i)->bool:
    var key:=[a,b]
    if not edge_cache.has(key):
        var clear:=segment_clear(cells[a],cells[b]);edge_cache[key]=clear;edge_cache[[b,a]]=clear
    return edge_cache[key]

func route(start:Vector3,finish:Vector3)->Array[Vector3]:
    var result:Array[Vector3]=[]
    if cells.is_empty():return result
    var a:Vector2i=cells.keys()[0];var b:=a
    var da:=INF;var db:=INF
    for key in cells:
        var d:float=cells[key].distance_squared_to(start)
        if d<da:da=d;a=key
        d=cells[key].distance_squared_to(finish)
        if d<db:db=d;b=key
    if not segment_clear(cells[b],finish):return result
    var queue:Array[Vector2i]=[a];var previous:Dictionary={a:a};var cursor:=0
    while cursor<queue.size():
        var key:=queue[cursor];cursor+=1
        if key==b:break
        for offset in [Vector2i.LEFT,Vector2i.RIGHT,Vector2i.UP,Vector2i.DOWN]:
            var next:Vector2i=key+offset
            if previous.has(next) or not cells.has(next) or not edge_clear(key,next):continue
            previous[next]=key;queue.append(next)
    if not previous.has(b):return result
    var key:=b
    while true:
        result.append(cells[key])
        if key==a:break
        key=previous[key]
    result.reverse();result.append(finish)
    return result

func _clip_height(points:PackedVector3Array,level:float,keep_above:bool)->PackedVector3Array:
    var result:=PackedVector3Array()
    if points.is_empty():return result
    for i in points.size():
        var a:=points[i];var b:=points[(i+1)%points.size()]
        var inside_a:bool=a.y>=level if keep_above else a.y<=level
        var inside_b:bool=b.y>=level if keep_above else b.y<=level
        if inside_a:result.append(a)
        if inside_a!=inside_b:result.append(a.lerp(b,(level-a.y)/(b.y-a.y)))
    return result
