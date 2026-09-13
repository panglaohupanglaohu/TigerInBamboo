extends RefCounted

# Shared layout assembly for the released scene and historical revision checks.
static func revision()->String:
    for arg in OS.get_cmdline_user_args():
        if arg.begins_with("--terrain-revision="):
            var value=arg.get_slice("=",1)
            assert(value in ["6","7","8","9"],"Unsupported terrain revision")
            return value.pad_zeros(2)
    return "06"

static func mount(world:Node, released:bool=false)->Node3D:
    var original:Node3D=world.castle_adapter.original
    var port=released or OS.get_cmdline_user_args().has("--placement-r04")
    var plaza=port or OS.get_cmdline_user_args().has("--placement-r03")
    var massing=plaza or OS.get_cmdline_user_args().has("--placement-r02")
    var placement=massing or OS.get_cmdline_user_args().has("--placement-r01")
    var asset="placement-r03" if plaza else ("placement-r02" if massing else ("placement-r01" if placement else "r"+revision()))
    if port:asset="placement-r04"
    var patch:Node3D=load("res://assets/art-pilots/citadel-master-terrain-"+asset+".glb").instantiate()
    var names=["citadel-oskar-grid-mountain-surface","citadel-coastal-cliff-seal"]
    for name in names:
        assert(patch.find_children(name,"MeshInstance3D",true,false).size()==1,"Candidate mesh missing: "+name)
    for n in original.find_children("*","MeshInstance3D",true,false):
        if str(n.name) in names:n.visible=false
    if placement:
        var retired=0
        for n in original.find_children("*","Node3D",true,false):
            var label=str(n.name)
            if plaza and label in ["west-city-plaza-deck","west-city-plaza-foundation","west-city-plaza-paving-ring","citadel-original-horse-terrace","citadel-plaza-edge-garden","citadel-plaza-retaining-wall","citadel-terrace-garden","citadel-mountain-cypress-groves","highland-mountain-slope-vegetation","highland-canopy-groves","highland-slope-shrub-vegetation"]:
                n.visible=false
            if massing and label=="citadel-target-castle-silhouette":
                n.visible=false
            if (label.begins_with("town-terrace-") and "-level-" in label) or label=="highland-town-foundation-platform" or label=="citadel-front-harbor":
                n.visible=false
                retired+=1
            if label=="target-hillside-rock-foundations":
                n.get_parent().visible=false
                retired+=1
        assert(retired>0,"No original layout nodes retired")
        assert(patch.find_child("old-city-staggered-parcels",true,false)!=null)
        assert(patch.find_child("citadel-front-harbor",true,false)!=null)
        patch.set_meta("retired_layout_nodes",retired)
        if massing:assert(patch.find_child("citadel-target-castle-silhouette",true,false)!=null)
    original.add_child(patch)
    patch.name="CitadelReleasedLayout" if released else "MasterTerrain-"+asset+"-TestOnly"
    patch.transform=Transform3D.IDENTITY
    if port:world.landmarks["前港登陆口"]=patch.find_child("citadel-front-harbor",true,false)
    if port:world.set_meta("front_harbor_data_path","res://data/common-frame-citadel-placement-r04-front-route.json")
    if OS.get_cmdline_user_args().has("--full-harbor-route"):
        world.set_meta("front_harbor_data_path","res://data/common-frame-citadel-placement-r05-full-route.json")
    if plaza:
        var data_path="res://data/citadel-placement-r03-plaza.json"
        var data=JSON.parse_string(FileAccess.get_file_as_string(data_path))
        var city:Node3D=original.find_child("highland-west-city",true,false)
        world.castle_adapter.trojan_horse.global_position=city.to_global(Vector3(data.horse[0],data.horse[1],data.horse[2]))
        world.set_meta("horse_exit_data_path",data_path)
        world.landmarks["新城广场"]=patch.find_child("west-city-plaza-deck",true,false)
        world.landmarks["木马高台"]=patch.find_child("citadel-original-horse-terrace",true,false)
    # Derived mountain rim geometry must not keep the previous silhouette.
    for name in names:
        var surface:MeshInstance3D=patch.find_children(name,"MeshInstance3D",true,false)[0]
        for rim in original.find_children("backlit-highlight-"+name,"MeshInstance3D",true,false):
            rim.mesh=surface.mesh
            rim.global_transform=surface.global_transform
    world.castle_adapter._adapt_materials(patch)
    if released:
        world.window_lights.bind_released(patch,original)
        world.front_harbor_berth_adapter.bind_released(world)
    return patch
