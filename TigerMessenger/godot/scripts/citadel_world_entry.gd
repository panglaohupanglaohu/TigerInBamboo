extends "res://scripts/original_world.gd"
## Entry into the existing spherical world; does not invent a separate castle.
func _ready() -> void:
    super._ready()
    var index := regions.find("odysseyCitadel")
    if index < 0:
        status.text = "高山圣城原场景入口缺失"
        return
    region_list.select(index)
    _focus_region(index)
    _build_assault_view()
    # Historical revision tests mount their own fixture; normal scene loads the released batch.
    var explicit_revision=false
    for arg in OS.get_cmdline_user_args():
        if arg.begins_with("--terrain-revision=") or arg.begins_with("--placement-r") or arg=="--citadel-layout=legacy":explicit_revision=true
    if not explicit_revision:
        preload("res://scripts/citadel_layout_release.gd").mount(self,true)
    status.text = "高山圣城 · 原场景与 WFC 城堡
右侧可启动三兵种通行演练；完整攻城接入中"

var assault_route=preload("res://scripts/citadel_assault_route.gd").new()
var landmarks:Dictionary={}
var _cutaway_hidden:Array[Node3D]=[]
var carry_preview:Array[Node3D]=[]
var traversal_is_old_shore:=false
var traversal_context=preload("res://scripts/citadel_collision_context.gd").new()
var traversal
var traversal_epoch:=0
var traversal_accumulator:=0.0
var traversal_in_west_city:=false
var town_cavity=preload("res://scripts/citadel_town_cavity.gd").new()
var shell_candidate=preload("res://scripts/citadel_tower_shell.gd").new()
var shell_toggle:CheckButton
var stair_candidate=preload("res://scripts/citadel_stair_candidate.gd").new()
var stair_toggle:CheckButton
var route_toggle:CheckButton
func _build_assault_view()->void:
    for spec in [["塔内旋梯","highland-central-interior-rotating-staircase"],["顶层夺取点","highland-castle-top-capture-deck"],["木马","citadel-trojan-horse[73]"]]:
        landmarks[spec[0]]=_find_landmark(model,spec[1])
    if is_instance_valid(castle_adapter.trojan_horse):landmarks["木马"]=castle_adapter.trojan_horse
    for spec in [["新城广场","west-city-plaza-deck"],["木马高台","citadel-original-horse-terrace"],["新城港口","west-city-harbor-quay"],["前港登陆口","citadel-front-harbor"]]:
        var current=castle_adapter.west_city.find_children(spec[1],"Node3D",true,false)
        landmarks[spec[0]]=current[0] if current.size()==1 and current[0].is_visible_in_tree() else null
    var loaded:bool=assault_route.bind(castle_adapter.original)
    if loaded:stair_candidate.bind(landmarks["塔内旋梯"],assault_route.anchors)
    shell_candidate.bind(landmarks["塔内旋梯"].get_parent())
    if not town_cavity.bind(castle_adapter.candidate,landmarks["塔内旋梯"].get_parent()):
        status.text="旧城与塔入口几何未能绑定；不可验收通行"
    var layer=CanvasLayer.new();add_child(layer)
    var panel=VBoxContainer.new();layer.add_child(panel)
    var place=func():panel.position=Vector2(maxf(16,get_viewport().get_visible_rect().size.x-285),18)
    get_viewport().size_changed.connect(place);place.call()
    window_lights.bind(castle_adapter.candidate,castle_adapter.west_city)
    window_lights.bind_environment(self)
    var window_toggle=CheckButton.new();window_toggle.text="点亮城灯"
    window_toggle.toggled.connect(window_lights.set_enabled);panel.add_child(window_toggle)
    var title=Label.new();title.text="圣城攻城 · 原场景核对";panel.add_child(title)
    for label in landmarks:
        var button=Button.new();button.text=label;button.disabled=landmarks[label]==null
        button.pressed.connect(_focus_landmark.bind(label));panel.add_child(button)
    stair_toggle=CheckButton.new();stair_toggle.text="连续楼梯候选 · 检视";stair_toggle.toggled.connect(_set_stairs);panel.add_child(stair_toggle)
    shell_toggle=CheckButton.new();shell_toggle.text="空腔塔身候选 · 检视";shell_toggle.toggled.connect(_set_shell);panel.add_child(shell_toggle)
    var interior=Button.new();interior.text="检视旋梯内部";interior.pressed.connect(_inspect_stair_interior);panel.add_child(interior)
    var soldiers=Button.new();soldiers.text="检视三兵种携行";soldiers.pressed.connect(_show_carry_preview);panel.add_child(soldiers)
    for spec in [["短剑兵","gladius"],["长矛兵","spear"],["弓箭兵","longbow"]]:
        var walk=Button.new();walk.text=spec[0]+" · 通行演练";walk.pressed.connect(_start_traversal.bind(spec[1]));panel.add_child(walk)
    var west_walk=Button.new();west_walk.text="短剑兵 · 新圣城行军";west_walk.pressed.connect(_start_traversal.bind("gladius",true));panel.add_child(west_walk)
    var front_walk=Button.new();front_walk.text="短剑兵 · 前港登陆到广场";front_walk.pressed.connect(_start_traversal.bind("gladius",true,true));panel.add_child(front_walk)
    if preload("res://scripts/citadel_surface_variant.gd").harbor_enabled():
        var shore_walk=Button.new();shore_walk.text="短剑兵 · 旧港沿坡入城";shore_walk.pressed.connect(_start_traversal.bind("gladius",true,false,true));panel.add_child(shore_walk)
    var horse_walk=Button.new();horse_walk.text="短剑兵 · 木马台到主城阶梯";horse_walk.pressed.connect(_start_traversal.bind("gladius",true,false,false,true));panel.add_child(horse_walk)
    var reset_walk=Button.new();reset_walk.text="重置通行演练";reset_walk.pressed.connect(_reset_traversal);panel.add_child(reset_walk)
    var entry=Button.new();entry.text="进攻入口";entry.disabled=not loaded;entry.pressed.connect(_focus_approach);panel.add_child(entry)
    var toggle=CheckButton.new();toggle.text="显示原作路线 · 待通行验收";toggle.disabled=not loaded
    route_toggle=toggle
    toggle.toggled.connect(assault_route.set_visible);panel.add_child(toggle)
    var note=Label.new();note.text="金色：外部路线\n青色：塔内五层旋梯\n当前尚未启动攻城";panel.add_child(note)
    if loaded:
        stair_toggle.button_pressed=true
        shell_toggle.button_pressed=true
    if not loaded:status.text+="\n原作路线数据未加载，不能开始攻城"

func _find_landmark(root_node:Node,key:String)->Node3D:
    var source:String=str(root_node.get_meta("extras",{}).get("sourcePath",""))
    if root_node is Node3D and (source==key or (not key.contains("[") and source.get_slice("/",source.get_slice_count("/")-1).begins_with(key+"["))):return root_node
    for child in root_node.get_children():
        var found=_find_landmark(child,key)
        if found:return found
    return null

func _focus_landmark(label:String,keep_traversal:bool=false)->void:
    if not keep_traversal and traversal!=null:_reset_traversal()
    _restore_cutaway()
    if label=="木马" and is_instance_valid(castle_adapter.original_horse):
        landmarks[label]=castle_adapter.trojan_horse if castle_adapter.enabled and is_instance_valid(castle_adapter.trojan_horse) else castle_adapter.original_horse
    var landmark:Node3D=stair_candidate.root if label=="塔内旋梯" and stair_candidate.active else landmarks[label]
    if not is_instance_valid(landmark):return
    var box=AABB();var seeded:=false
    for mesh in landmark.find_children("*","MeshInstance3D",true,false):
        if not mesh.is_visible_in_tree():continue
        var bounds:AABB=mesh.global_transform*mesh.get_aabb()
        box=box.merge(bounds) if seeded else bounds;seeded=true
    center=box.get_center() if seeded else landmark.global_position
    up=center.normalized();distance=clampf(box.size.length()*0.9,5,100) if seeded else 14.0
    pitch=0.35;_camera();status.text=label+" · 原作实际位置\n移动与战斗尚待接入"

func _focus_approach()->void:
    if traversal!=null:_reset_traversal()
    _restore_cutaway()
    var point:Array=assault_route.anchors.stairRoute[0]
    center=assault_route.node.to_global(Vector3(point[0],point[1],point[2]));up=center.normalized();distance=18;pitch=0.4;_camera()
    status.text="进攻入口 · 外部路线接塔内五层旋梯\n显示路线不等于通过碰撞验收"

func assault_evidence()->Dictionary:
    var found:Dictionary={}
    for label in landmarks:
        var n:Node3D=landmarks[label]
        found[label]={"found":is_instance_valid(n),"source":n.get_meta("extras",{}).get("sourcePath","") if is_instance_valid(n) else ""}
    return {"landmarks":found,"route":assault_route.report,"stairs":stair_candidate.report,"shell":shell_candidate.report,"town_cavity":town_cavity.report,"scene":"res://scenes/citadel_world.tscn","playable_siege":false}

func _restore_cutaway()->void:
    for item in _cutaway_hidden:
        if is_instance_valid(item):item.visible=true
    _cutaway_hidden.clear()

func _inspect_stair_interior(keep_traversal:bool=false)->void:
    _focus_landmark("塔内旋梯",keep_traversal)
    var stairs:Node3D=landmarks.get("塔内旋梯")
    if not is_instance_valid(stairs):return
    # Reversible inspection only: source geometry and collision are untouched.
    for child in stairs.get_parent().get_children():
        if child is Node3D and child!=stairs and child!=stair_candidate.root and child.visible:
            _cutaway_hidden.append(child);child.visible=false
    route_toggle.button_pressed=true
    status.text="旋梯内部 · 临时隐藏塔壳供核对
切换定位恢复塔壳；右侧可启动通行演练"

func _set_shell(value:bool)->void:
    if traversal!=null:_reset_traversal()
    _restore_cutaway()
    shell_candidate.set_enabled(value)
    town_cavity.set_enabled(value)

func _show_carry_preview()->void:
    for actor in carry_preview:
        if is_instance_valid(actor):actor.queue_free()
    carry_preview.clear()
    stair_toggle.button_pressed=true;shell_toggle.button_pressed=true
    _inspect_stair_interior();route_toggle.button_pressed=false
    var tower:Node3D=landmarks["塔内旋梯"].get_parent()
    var kinds=["gladius","spear","longbow"]
    for i in range(3):
        var path="res://assets/roman-family-v1/romanSoldier_%s_blue"%kinds[i]
        var actor:Node3D=load(path+".glb").instantiate();add_child(actor);carry_preview.append(actor)
        var pose=preload("res://scripts/roman_carry_pose.gd").new()
        if not pose.bind(actor,kinds[i],JSON.parse_string(FileAccess.get_file_as_string(path+".assembly.json"))):continue
        pose.set_enabled(true)
        var lowest:=INF
        for id in ["n23","n26"]:
            var meshes=pose.nodes[id].find_children("*","MeshInstance3D",true,false)
            if pose.nodes[id] is MeshInstance3D:meshes.append(pose.nodes[id])
            for mesh in meshes:
                if not mesh.is_visible_in_tree():continue
                var box:AABB=actor.global_transform.affine_inverse()*mesh.global_transform*mesh.get_aabb();lowest=minf(lowest,box.position.y)
        var index:int=[0,5,12][i]
        var foot:Vector3=stair_candidate.route[index]
        var forward:=Vector3(0,0,-1) if i<2 else Vector3.RIGHT
        actor.global_transform=tower.global_transform*Transform3D(Basis(forward,Vector3.UP,forward.cross(Vector3.UP)),foot-Vector3.UP*lowest)
    var target:Vector3=tower.to_global(Vector3(0.6,4.25,2.9))
    camera.position=tower.to_global(Vector3(3.0,5.3,4.5));camera.look_at(target,tower.global_basis.y.normalized())
    status.text="三兵种携行 · 原模型与真实握点
入口静态检视；尚未开始逐级行走或攻城"

func _reset_traversal()->void:
    traversal_epoch+=1;traversal_accumulator=0.0
    if traversal!=null:traversal.dispose();traversal=null
    status.text="通行演练已重置"
func _start_traversal(kind:String,west_city:bool=false,front_harbor:bool=false,old_shore:bool=false,horse_exit:bool=false)->void:
    _reset_traversal()
    var token:=traversal_epoch
    for actor in carry_preview:
        if is_instance_valid(actor):actor.queue_free()
    carry_preview.clear()
    _restore_cutaway();stair_toggle.button_pressed=true;shell_toggle.button_pressed=true
    traversal_context.dispose()
    traversal_context.bind(self)
    await get_tree().physics_frame
    await get_tree().physics_frame
    if token!=traversal_epoch:return
    if not town_cavity.verify_geometry():
        status.text="塔入口几何校验失败；通行演练未启动"
        return
    traversal=preload("res://scripts/citadel_roman_traversal.gd").new()
    traversal_in_west_city=west_city
    traversal_is_old_shore=old_shore
    var path:Array=preload("res://scripts/west_city_route.gd").new().points(get_meta("front_harbor_data_path","res://data/citadel-front-harbor-route.json") if front_harbor else "res://data/citadel-plaza-keep-route.json") if west_city else []
    if old_shore:
        path=[]
        var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/old-harbor-ocean-grade.json"))
        for p in data.shore.route:path.append(Vector3(p[0],p[1],p[2]))
    var route_frame=castle_adapter.original if west_city else null
    if horse_exit:
        path=[]
        var data=JSON.parse_string(FileAccess.get_file_as_string(get_meta("horse_exit_data_path","res://data/citadel-horse-plaza-exit.json")))
        for p in data.points:path.append(Vector3(p[0],p[1],p[2]))
        route_frame=castle_adapter.original.find_child("highland-west-city",true,false)
    if not traversal.bind(self,kind,route_frame,path,old_shore):status.text="士兵携行或路线绑定失败";return
    if not west_city:_inspect_stair_interior(true)
    route_toggle.button_pressed=false
func _physics_process(dt:float)->void:
    if traversal==null:return
    traversal_accumulator+=minf(dt,0.1)
    while traversal_accumulator>=1.0/60.0:
        traversal.tick(1.0/60.0);traversal_accumulator-=1.0/60.0
    var row=traversal.evidence()
    status.text="%s · %s / %s 段\n%s"%["旧港沿坡入城" if traversal_is_old_shore else ("新圣城行军" if traversal_in_west_city else "塔内通行演练"),row.completed_steps,row.route_points-1,"已到达；尚未启动攻城" if row.phase=="arrived" else ("碰撞停止："+str(row.blocked.get("part",row.blocked.get("reason",""))) if row.phase=="blocked" else "刚性腿跃步候选；非最终步态")]
    if is_instance_valid(traversal.actor) and row.phase in ["turn","hop"]:
        var a:Node3D=traversal.actor
        camera.position=a.global_position+stair_candidate.root.global_basis.x*3.0+a.global_basis.y*1.7+stair_candidate.root.global_basis.z*2.2
        camera.look_at(a.global_position+a.global_basis.y*0.6,a.global_basis.y)

func _set_stairs(value:bool)->void:
    if traversal!=null:_reset_traversal()
    stair_candidate.set_enabled(value)
func _focus_region(index:int)->void:
    if traversal!=null:_reset_traversal()
    _restore_cutaway()
    super._focus_region(index)

func _exit_tree()->void:
    if traversal!=null:traversal.dispose();traversal=null
    traversal_context.dispose()
    town_cavity.unbind()
