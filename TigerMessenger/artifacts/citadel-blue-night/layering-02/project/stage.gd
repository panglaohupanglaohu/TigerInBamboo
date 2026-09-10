extends RefCounted
static func material(c:String)->StandardMaterial3D:
    var m=StandardMaterial3D.new()
    m.albedo_color=Color(c)
    m.roughness=0.85
    return m
static func block(root:Node3D,n:String,p:Vector3,s:Vector3,m:Material)->void:
    var o=MeshInstance3D.new()
    o.name=n
    var b=BoxMesh.new()
    b.size=s
    o.mesh=b
    o.material_override=m
    root.add_child(o)
    o.position=p
static func install(root:Node3D)->Dictionary:
    var stone=material("acb9be")
    var soil=material("263b2d")
    for band in [[6,4],[-6,9],[-18,15]]:
        var z=float(band[0])
        var h=float(band[1])
        block(root,"Terrace retaining masonry",Vector3(0,5+h/2,z),Vector3(42,h,12),stone)
    # Continuous stairs along the outer shoulders connect the new ground tiers.
    for entry in [[12,0,4],[0,4,9],[-12,9,15]]:
        var z=float(entry[0])
        var lower=float(entry[1])
        var delta=float(entry[2])-lower
        for side in [-1,1]:
            for i in range(20):
                var h=lower+delta*(i+1)/20.0
                block(root,"Terrace stair",Vector3(side*22,5+h/2,z+3-i*.3),Vector3(2,h,.32),stone)
    var gardens=[]
    for row in [[9,9],[-3,14],[-17,20]]:
        for side in [-1,1]:
            var p=Vector3(side*22.6,float(row[1]),float(row[0])+(-1.5 if side==1 else 0.5))
            block(root,"Courtyard support",Vector3(p.x,(p.y+5)/2,p.z),Vector3(5,p.y-5,5),stone)
            block(root,"Courtyard soil",p+Vector3(0,.12,0),Vector3(4,.24,4),soil)
            for j in range(2 if side==1 else 3):
                var variant="cypress" if (j==1 or (side==1 and float(row[0])<0)) else "broadleaf"
                var t=load("res://assets/"+variant+"-reference-v1.glb").instantiate()
                root.add_child(t)
                t.position=p+Vector3((j-1)*1.35,.25,(j%2)*1.2-.8)
                t.scale=Vector3.ONE*(1.0 if variant=="cypress" else (0.9 if side==1 else 1.13))
            gardens.append(p)
            var fixture=load("res://assets/lamp.glb").instantiate()
            root.add_child(fixture)
            fixture.position=p+Vector3(-side*1.5,.25,1.8)
            var light=OmniLight3D.new()
            root.add_child(light)
            light.position=fixture.position+Vector3(.48,1.95,0)
            light.light_color=Color("ffc07a")
            light.light_energy=2.8
            light.omni_range=9
            light.shadow_enabled=true
    # Preserve the actual curved waterfront surface and sample its triangles.
    var boat=load("res://assets/castle-tour-boat.glb").instantiate()
    root.add_child(boat)
    boat.position=Vector3(3,0,33)
    for w in root.find_children("*","MeshInstance3D",true,false):
        if String(w.name)!="highland-waterfront-water":continue
        var f=w.mesh.get_faces()
        for i in range(0,f.size(),3):
            var hit=Geometry3D.segment_intersects_triangle(Vector3(3,40,33),Vector3(3,-40,33),w.global_transform*f[i],w.global_transform*f[i+1],w.global_transform*f[i+2])
            if hit!=null:boat.position.y=hit.y+.12;break
    boat.rotation.y=-0.12
    for x in [-2.15,2.15]:
        var lamp=OmniLight3D.new()
        boat.add_child(lamp)
        lamp.position=Vector3(x,1.8,.9)
        lamp.light_color=Color("ffb553")
        lamp.light_energy=4
        lamp.omni_range=6
        lamp.shadow_enabled=true
    return {"ground_tiers":[5,9,14,20],"garden_count":gardens.size(),"boat_position":[boat.position.x,boat.position.y,boat.position.z],"boat":"Blender castle sightseeing boat","navigation_validated":false}
