extends RefCounted
## Local window preview, retaining source materials for an exact day reset.
## The Web siege's captured-room state machine is not ported by this adapter.
var rows:Array=[]
var enabled:=false
var points:Array[OmniLight3D]=[]
var lanterns:Array=[]
var old_points:Array[OmniLight3D]=[]
var tier_profile:Dictionary={}
func bind(old_city:Node3D,new_city:Node3D)->void:
    if not rows.is_empty():return
    if preload("res://scripts/citadel_surface_variant.gd").harbor_enabled() and not OS.get_cmdline_user_args().has("--legacy-city-lighting"):
        var profile=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-tier-lighting.json"))
        if profile is Dictionary:tier_profile=profile
    for city in [old_city,new_city]:
        if not is_instance_valid(city):continue
        var warm:=StandardMaterial3D.new()
        warm.albedo_color=Color("ffc979" if city==new_city else "ff9a55")
        warm.emission_enabled=true
        warm.emission=warm.albedo_color
        warm.emission_energy_multiplier=2.2
        warm.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
        for mesh in city.find_children("*","MeshInstance3D",true,false):
            if mesh.mesh==null:continue
            for surface in range(mesh.mesh.get_surface_count()):
                var source=mesh.get_active_material(surface)
                if str(mesh.name).begins_with("town-window"):
                    rows.append({"mesh":mesh,"surface":surface,"day":source,"night":warm,"city":"new" if city==new_city else "old"})
                elif source is StandardMaterial3D and source.emission_enabled and source.emission.v>0.001 and (str(mesh.name).begins_with("target-castle-exterior") or source.resource_name.begins_with("claude-house-win_")):
                    # Keep the authored pink/amber window hue rather than replacing
                    # every newly imported window with the legacy shared yellow.
                    var day=source.duplicate() as StandardMaterial3D
                    var night=source.duplicate() as StandardMaterial3D
                    var hue:Color=source.emission
                    hue=hue/hue.v
                    day.emission=hue;night.emission=hue
                    day.emission_energy_multiplier=0.04
                    night.emission_energy_multiplier=1.55
                    mesh.set_surface_override_material(surface,day)
                    rows.append({"mesh":mesh,"surface":surface,"day":day,"night":night,"city":"new" if city==new_city else "old"})
    var hosts=new_city.find_children("highland-west-city","Node3D",true,false)
    if hosts.size()==1:
        var data=JSON.parse_string(FileAccess.get_file_as_string(preload("res://scripts/citadel_surface_variant.gd").data_path("res://data/citadel-new-city-lighting.json")))
        if data is Dictionary:
            for spec in tier_profile.get("new",data.points):
                var light:=OmniLight3D.new();light.name="NewCityLight_"+str(spec.id)
                light.position=Vector3(spec.position[0],spec.position[1],spec.position[2])
                light.light_color=Color.hex((int(spec.color)<<8)|255)
                light.omni_range=float(spec.radius);light.omni_attenuation=2.0
                light.shadow_enabled=false;light.light_energy=0
                light.set_meta("night_energy",float(spec.get("godotEnergy",float(spec.intensity)/15.0)))
                hosts[0].add_child(light);points.append(light)
        for mesh in hosts[0].find_children("new-city-lantern-head*","MeshInstance3D",true,false):
            for i in range(mesh.mesh.get_surface_count()):
                var mat=mesh.get_active_material(i).duplicate() as StandardMaterial3D
                if mat==null:continue
                mat.emission_enabled=true;mat.emission=Color("ffad64");mat.emission_energy_multiplier=0
                mesh.set_surface_override_material(i,mat);lanterns.append(mat)
    # Reuse the first four authored old-city lamp holders, just as the Web
    # light-volume system budgets four real lights. Parent transforms retain
    # the current old-city offset/yaw; no second hard-coded city position.
    var castle=new_city.get_parent()
    if not tier_profile.is_empty():
        var hosts_old=castle.find_children("highland-light-volumes","Node3D",true,false)
        if hosts_old.size()==1:
            for spec in tier_profile.old:
                var light=OmniLight3D.new();light.name="OldCityTier_"+str(spec.id)
                light.position=Vector3(spec.position[0],spec.position[1],spec.position[2])
                light.light_color=Color.hex((int(spec.color)<<8)|255);light.omni_range=spec.radius
                light.light_energy=0;light.omni_attenuation=2;light.shadow_enabled=false
                light.set_meta("night_energy",spec.godotEnergy)
                hosts_old[0].add_child(light)
                # The archive's legacy light holder predates the old-city yaw.
                # Place from the actual Web world point, not that stale frame.
                var source=tier_profile.expectedWorld.filter(func(row):return row.side=="old")[old_points.size()].world
                light.global_position=castle.get_parent().to_global(Vector3(source[0],source[1],source[2]))
                old_points.append(light)
    else:
        for i in range(4):
            var holders=castle.find_children("highland-light-volume-highland-lamp-"+str(i),"Node3D",true,false)
            if holders.size()!=1:continue
            var holder=holders[0]
            var shells=holder.find_children("lamp-volume-shell","Node3D",true,false)
            var light=OmniLight3D.new();light.name="OldCityLamp_"+str(i)
            light.position=shells[0].position if shells.size()==1 else Vector3(0,2,0)
            light.light_color=Color("ff6f32");light.light_energy=0
            light.omni_range=13;light.omni_attenuation=2;light.shadow_enabled=false
            holder.add_child(light);old_points.append(light)
var environment_rows:Array=[]
var sun_rows:Array=[]
func bind_environment(world:Node)->void:
    if not environment_rows.is_empty():return
    # Candidate shoreline shops live in the separately imported original port.
    # Register their own amber materials with the same production day/night switch.
    for group in world.find_children("citadel-old-shore-arcades","Node3D",true,false)+world.find_children("front-harbor-landing-shop-*","Node3D",true,false):
        for mesh in group.find_children("harbor-detail-harbor-amber-window*","MeshInstance3D",true,false):
            for surface in range(mesh.mesh.get_surface_count()):
                var source=mesh.get_active_material(surface) as StandardMaterial3D
                if source==null:continue
                var day=source.duplicate() as StandardMaterial3D
                var night=source.duplicate() as StandardMaterial3D
                day.emission_energy_multiplier=0.0
                night.emission_enabled=true;night.emission=Color("ffab52").srgb_to_linear();night.emission_energy_multiplier=2.1
                rows.append({"mesh":mesh,"surface":surface,"day":day,"night":night,"city":"old"})
                mesh.set_surface_override_material(surface,night if enabled else day)
    for host in world.find_children("*","WorldEnvironment",true,false):
        var env:Environment=host.environment
        if env!=null:environment_rows.append({"env":env,"background":env.background_color,"ambient":env.ambient_light_color,"energy":env.ambient_light_energy})
    for sun in world.find_children("*","DirectionalLight3D",true,false):
        sun_rows.append({"sun":sun,"energy":sun.light_energy,"color":sun.light_color})
func set_enabled(value:bool)->void:
    enabled=value
    for row in environment_rows:
        row.env.background_color=Color("223950") if value else row.background
        row.env.ambient_light_color=Color("8baee6") if value else row.ambient
        row.env.ambient_light_energy=0.5 if value else row.energy
    for row in sun_rows:
        row.sun.light_energy=0.2 if value else row.energy
        row.sun.light_color=Color("84a5d6") if value else row.color
    for light in points:light.light_energy=float(light.get_meta("night_energy")) if value else 0.0
    for light in old_points:light.light_energy=float(light.get_meta("night_energy",4.0)) if value else 0.0
    for mat in lanterns:mat.emission_energy_multiplier=2.0 if value else 0.0
    for row in rows:
        if is_instance_valid(row.mesh):row.mesh.set_surface_override_material(row.surface,row.night if value else row.day)
func evidence()->Dictionary:
    var counts:={"new":0,"old":0}
    var matching:=0
    var seen:={}
    for row in rows:
        if not seen.has(row.mesh):
            seen[row.mesh]=true
            counts[row.city]+=1
        if is_instance_valid(row.mesh) and row.mesh.get_active_material(row.surface)==(row.night if enabled else row.day):matching+=1
    return {"old_point_lights":old_points.size(),"old_lit_points":old_points.filter(func(p):return p.light_energy>0).size(),"environment_matching":environment_rows.all(func(row):return is_equal_approx(row.env.ambient_light_energy,0.5 if enabled else row.energy) and row.env.background_color==(Color("223950") if enabled else row.background)),"environment_count":environment_rows.size(),"energies":points.map(func(p):return p.light_energy),"point_lights":points.size(),"lit_points":points.filter(func(p):return p.light_energy>0).size(),"counts":counts,"enabled":enabled,"matching":matching,"total":rows.size()}
