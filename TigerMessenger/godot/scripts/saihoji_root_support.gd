extends RefCounted
## Reversible continuous island support; tree roots/seed/parent never move.
var node:MeshInstance3D
var report:Dictionary={}
var top_triangles:Array=[]
var dry_plate_radius:=160.3
func triangle_radius(a:Vector3,b:Vector3,c:Vector3)->float:
    var u=b-a;var v=c-a;var n=u.cross(v).normalized();var p=n*n.dot(a)
    var w=p-a;var den=u.dot(u)*v.dot(v)-u.dot(v)*u.dot(v)
    if absf(den)>0.00000001:
        var s=(w.dot(u)*v.dot(v)-w.dot(v)*u.dot(v))/den
        var t=(w.dot(v)*u.dot(u)-w.dot(u)*u.dot(v))/den
        if s>=0.0 and t>=0.0 and s+t<=1.0:return p.length()
    var result:=INF
    for edge in [[a,b],[b,c],[c,a]]:
        var d:Vector3=edge[1]-edge[0]
        result=minf(result,(edge[0]+d*clampf(-edge[0].dot(d)/maxf(d.length_squared(),0.0000001),0.0,1.0)).length())
    return result
func _inside(p:Vector2,original:PackedVector2Array,roots:Array)->bool:
    if Geometry2D.is_point_in_polygon(p,original):return true
    for r in roots:
        var center=Vector2(r.center[0],r.center[2])
        var radius:float=r.support_radius
        if p.distance_to(center)<=radius+0.002:return true
        var shore=Vector2(r.shore[0],r.shore[1])
        var edge=shore-center
        var near=center+edge*clampf((p-center).dot(edge)/maxf(edge.length_squared(),0.001),0.0,1.0)
        if p.distance_to(near)<=radius:return true
    return false
func apply(island:Node3D)->Dictionary:
    if is_instance_valid(node):return report
    var data=JSON.parse_string(FileAccess.get_file_as_string("res://assets/saihoji-pines-v1/root-support.json"))
    var pts=PackedVector2Array();var xyz=PackedVector3Array()
    for p in data.points:pts.append(Vector2(p[0],p[2]));xyz.append(Vector3(p[0],p[1],p[2]))
    var old=PackedVector2Array()
    for p in data.original_outline:old.append(Vector2(p[0],p[1]))
    var idx=Geometry2D.triangulate_delaunay(pts)
    var vertices=PackedVector3Array();var colors=PackedColorArray();var normals=PackedVector3Array();var edges:Dictionary={}
    var area:=0.0
    for k in range(0,idx.size(),3):
        var a=idx[k];var b=idx[k+1];var c=idx[k+2]
        if not _inside((pts[a]+pts[b]+pts[c])/3.0,old,data.roots):continue
        if not _inside((pts[a]+pts[b])*0.5,old,data.roots) or not _inside((pts[b]+pts[c])*0.5,old,data.roots) or not _inside((pts[c]+pts[a])*0.5,old,data.roots):continue
        var n=(xyz[b]-xyz[a]).cross(xyz[c]-xyz[a]).normalized()
        if n.y<0.0:var swap=b;b=c;c=swap;n=-n
        top_triangles.append([xyz[a],xyz[b],xyz[c]])
        area+=absf((pts[b]-pts[a]).cross(pts[c]-pts[a]))*0.5
        var shade=0.88+float((a*13+b*7+c)%17)/100.0
        for i in [a,c,b]:vertices.append(xyz[i]);normals.append(n);colors.append(Color(0.14,0.17,0.07)*shade)
        for e in [[a,b],[b,c],[c,a]]:
            var key="%d:%d"%[mini(e[0],e[1]),maxi(e[0],e[1])]
            if edges.has(key):edges.erase(key)
            else:edges[key]=e
    var boundary:=0
    for e in edges.values():
        var a:Vector3=xyz[e[0]];var b:Vector3=xyz[e[1]]
        var al=a;var bl=b;al.y=-1.5;bl.y=-1.5
        var n=(b-a).cross(al-a).normalized()
        for v in [a,b,al,b,bl,al]:vertices.append(v);normals.append(n);colors.append(Color(0.075,0.085,0.052))
        boundary+=1
    var mesh=ArrayMesh.new();var arrays=[];arrays.resize(Mesh.ARRAY_MAX)
    arrays[Mesh.ARRAY_VERTEX]=vertices;arrays[Mesh.ARRAY_NORMAL]=normals;arrays[Mesh.ARRAY_COLOR]=colors
    mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
    var mat=StandardMaterial3D.new();mat.vertex_color_use_as_albedo=true;mat.vertex_color_is_srgb=false;mat.roughness=1.0;mat.cull_mode=BaseMaterial3D.CULL_DISABLED
    mesh.surface_set_material(0,mat)
    node=MeshInstance3D.new();node.name="SaihojiContinuousRootSupport";node.mesh=mesh;island.add_child(node)
    dry_plate_radius=0.0
    for tri in top_triangles:
        for p in tri:
            dry_plate_radius=maxf(dry_plate_radius,sqrt(160.617*160.617-0.25*(p.x*p.x+p.z*p.z))-0.5*p.y)
    # Triangle interiors can be closer to the sphere center than their vertices.
    for iteration in 4:
        var minimum:=INF
        for tri in top_triangles:
            var a:Vector3=tri[0]*0.5+Vector3.UP*dry_plate_radius
            var b:Vector3=tri[1]*0.5+Vector3.UP*dry_plate_radius
            var c:Vector3=tri[2]*0.5+Vector3.UP*dry_plate_radius
            minimum=minf(minimum,triangle_radius(a,b,c))
        if minimum>=160.617:break
        dry_plate_radius+=160.617-minimum+0.0001
    report={"tree_transforms_modified":false,"top_triangles":top_triangles.size(),"boundary_edges":boundary,"area_world":area*0.25,"original_area_world":float(data.original_area_local)*0.25,"added_area_world":(area-float(data.original_area_local))*0.25,"automatic_navigation":false,"candidate":true,"dry_plate_radius":dry_plate_radius,"old_plate_radius":160.3,"minimum_surface_radius":160.617,"maximum_original_wave_radius":160.567,"world_root_scale":0.5}
    return report
func height_at(p:Vector3)->float:
    var best:float=-INF
    for t in top_triangles:
        var hit=Geometry3D.ray_intersects_triangle(Vector3(p.x,20,p.z),Vector3.DOWN,t[0],t[1],t[2])
        if hit!=null:best=maxf(best,hit.y)
    return best
func restore()->void:
    if is_instance_valid(node):node.queue_free()
    top_triangles.clear()
    dry_plate_radius=160.3
