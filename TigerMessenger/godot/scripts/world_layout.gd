extends Node3D
## Navigation planning overlay. Does not move or replace original geometry.
var terrain_data: Dictionary = {}
var terrain: Node3D
var layout: Dictionary
var camera: Camera3D
var globe: Node3D
var details: Label
var yaw := 0.7
var pitch := 0.25
var distance := 490.0
var dragging := false
var points: Dictionary = {}

func unit(lat: float, lon: float) -> Vector3:
    var a := deg_to_rad(lat)
    var b := deg_to_rad(lon)
    return Vector3(cos(a)*cos(b), sin(a), cos(a)*sin(b))

func material(color: Color) -> StandardMaterial3D:
    var m := StandardMaterial3D.new()
    m.albedo_color = color
    m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
    return m

func line(vertices: PackedVector3Array, color: Color) -> void:
    var mesh := ImmediateMesh.new()
    mesh.surface_begin(Mesh.PRIMITIVE_LINE_STRIP, material(color))
    for v in vertices: mesh.surface_add_vertex(v)
    mesh.surface_end()
    var item := MeshInstance3D.new()
    item.mesh = mesh
    globe.add_child(item)

func arc(a: Vector3, b: Vector3, color: Color, radius: float = 163.0) -> void:
    var vertices := PackedVector3Array()
    for i in range(49): vertices.append(a.slerp(b, i/48.0).normalized()*radius)
    line(vertices,color)

func _ready() -> void:
    layout=JSON.parse_string(FileAccess.get_file_as_string("res://data/world-layout-v2.json"))
    var env := WorldEnvironment.new()
    env.environment=Environment.new()
    env.environment.background_mode=Environment.BG_COLOR
    env.environment.background_color=Color("071825")
    add_child(env)
    globe=Node3D.new()
    add_child(globe)
    # Shift planning globe right to leave a dedicated readable sidebar.
    var ocean := MeshInstance3D.new()
    var sphere := SphereMesh.new()
    sphere.radius=160; sphere.height=320; sphere.radial_segments=96; sphere.rings=48
    ocean.mesh=sphere; ocean.material_override=material(Color("153b51"))
    globe.add_child(ocean)
    if ResourceLoader.exists("res://assets/terrain/world-terrain-v3.glb"):
        terrain = load("res://assets/terrain/world-terrain-v3.glb").instantiate()
        globe.add_child(terrain)
        terrain_data = JSON.parse_string(FileAccess.get_file_as_string("res://data/world-terrain-v3.json"))
        var sun := DirectionalLight3D.new()
        sun.rotation_degrees = Vector3(-35,-25,0)
        sun.light_energy = 1.4
        add_child(sun)
        env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
        env.environment.ambient_light_color = Color("b2c9d1")
        env.environment.ambient_light_energy = 0.6
    for lat in range(-60,61,30):
        var ring := PackedVector3Array()
        for lon in range(-180,181,3): ring.append(unit(lat,lon)*160.5)
        line(ring,Color("29596b"))
    for lon in range(-180,180,30):
        var meridian := PackedVector3Array()
        for lat in range(-90,91,3): meridian.append(unit(lat,lon)*160.5)
        line(meridian,Color("29596b"))
    for region in layout.regions:
        var p := unit(region.targetLat,region.targetLon)
        points[region.id]=p
        var color := Color("7fbaa0")
        if str(region.role).contains("science"):color=Color("77c4ee")
        elif str(region.role).contains("cross"):color=Color("dda86d")
        elif region.role=="experimental":color=Color("ca9adb")
        elif region.sourceLandmark==null:color=Color("8192a5")
        var tangent := p.cross(Vector3.UP).normalized()
        var bitangent := p.cross(tangent).normalized()
        var ring := PackedVector3Array()
        var angle := deg_to_rad(float(region.angularRadius))
        for i in range(65):
            var t := TAU*i/64.0
            ring.append((p*cos(angle)+(tangent*cos(t)+bitangent*sin(t))*sin(angle))*162)
        line(ring,color)
        var marker := MeshInstance3D.new()
        var dot := SphereMesh.new();dot.radius=2.0;dot.height=4.0
        marker.mesh=dot;marker.material_override=material(color);marker.position=p*(164+maxf(0,float(terrain_data.get("regionalHeights",{}).get(region.id,0))))
        globe.add_child(marker)
        var label := Label3D.new()
        label.text=region.label;label.position=p*(170+maxf(0,float(terrain_data.get("regionalHeights",{}).get(region.id,0))));label.font_size=32;label.pixel_size=.15
        label.billboard=BaseMaterial3D.BILLBOARD_ENABLED
        label.modulate=color;label.no_depth_test=false
        globe.add_child(label)
    for route in layout.routes:
        if route.get("dynamic",false):
            for i in range(route.waypoints.size()-1):
                var a:Dictionary=route.waypoints[i];var b:Dictionary=route.waypoints[i+1]
                arc(unit(a.lat,a.lon),unit(b.lat,b.lon),Color("c29bdf"),165)
        elif route.from!=route.to:
            var terrain_route: Dictionary = terrain_data.get("routes",{}).get(route.id,{})
            if not terrain_route.is_empty():
                var path := PackedVector3Array()
                for row in terrain_route.points:
                    var v: Array = row.position
                    path.append(Vector3(v[0],v[1],v[2]))
                var blocked: bool = (route.mode=="sea" and float(terrain_route.landFraction)>0.15) or (route.mode in ["ground","tram"] and float(terrain_route.landFraction)<0.99)
                line(path,Color("df8665") if blocked else Color("e5b870"))
            else:
                arc(points[route.from],points[route.to],Color("e5b870") if route.storyOrder!=null else Color("497789"))
    camera=Camera3D.new();camera.near=5;camera.far=2000;camera.fov=50;camera.h_offset=-65
    add_child(camera);camera.current=true
    _ui();_camera()

func _ui() -> void:
    var canvas:=CanvasLayer.new();add_child(canvas)
    var panel:=PanelContainer.new();panel.position=Vector2(16,16);panel.custom_minimum_size=Vector2(290,0)
    canvas.add_child(panel)
    var box:=VBoxContainer.new();panel.add_child(box)
    var title:=Label.new();title.text="全球地势 V3 · 候选\n原地形规则 / 全球陆海与通路";box.add_child(title)
    var source:=Button.new();source.text="返回原作实际世界 · 对照";box.add_child(source)
    source.pressed.connect(func():get_tree().change_scene_to_file("res://scenes/original_world.tscn"))
    var terrain_toggle:=CheckButton.new();terrain_toggle.text="显示地形候选";terrain_toggle.button_pressed=true;box.add_child(terrain_toggle)
    terrain_toggle.toggled.connect(func(on:bool):
        if terrain:terrain.visible=on
    )
    var flip:=Button.new();flip.text="旋转至另一半球";box.add_child(flip)
    flip.pressed.connect(func():yaw+=PI;pitch=-pitch;_camera())
    var list:=ItemList.new();list.custom_minimum_size=Vector2(290,300);box.add_child(list)
    for region in layout.regions:list.add_item(region.label)
    details=Label.new();details.custom_minimum_size=Vector2(290,0);details.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
    details.text="绿：传统文明  蓝：科幻文明\n金线：主线通路  紫线：白鲸迁徙\n灰：后续内容预留\n\n已生成原地形规则的全球地势候选。\n圆圈仍是规划范围；原建筑未搬迁。\n橙红通路与陆海冲突，须修港口/桥/绕行。\n\n拖动转球 · 滚轮缩放"
    box.add_child(details)
    list.item_selected.connect(func(index:int):
        var row:Dictionary=layout.regions[index]
        var p:Vector3=points[row.id]
        yaw=atan2(p.z,p.x);pitch=asin(p.y);_camera()
        details.text="%s\n纬度 %.0f° / 经度 %.0f°\n%s\n\n%s\n\n已采样地势；建筑占地、交通与存档迁移仍待逐区验证。" % [row.label,row.targetLat,row.targetLon,row.purpose,row.contentResponsibility]
    )

func _camera() -> void:
    camera.position=Vector3(cos(pitch)*cos(yaw),sin(pitch),cos(pitch)*sin(yaw))*distance
    camera.look_at(Vector3.ZERO,Vector3.UP)

func _unhandled_input(event: InputEvent) -> void:
    if event is InputEventMouseButton:
        if event.button_index==MOUSE_BUTTON_LEFT:dragging=event.pressed
        if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]:
            distance=clampf(distance*(.9 if event.button_index==MOUSE_BUTTON_WHEEL_UP else 1.1),270,800);_camera()
    if event is InputEventMouseMotion and dragging:
        yaw-=event.relative.x*.008;pitch=clampf(pitch+event.relative.y*.006,-1.4,1.4);_camera()
