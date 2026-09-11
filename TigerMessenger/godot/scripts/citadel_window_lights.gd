extends RefCounted
## Local window preview, retaining source materials for an exact day reset.
## The Web siege's captured-room state machine is not ported by this adapter.
var rows:Array=[]
var enabled:=false
var points:Array[OmniLight3D]=[]
var lanterns:Array=[]
func bind(old_city:Node3D,new_city:Node3D)->void:
    if not rows.is_empty():return
    for city in [old_city,new_city]:
        if not is_instance_valid(city):continue
        var warm:=StandardMaterial3D.new()
        warm.albedo_color=Color("ffc979" if city==new_city else "ff9a55")
        warm.emission_enabled=true
        warm.emission=warm.albedo_color
        warm.emission_energy_multiplier=2.2
        warm.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
        for mesh in city.find_children("*","MeshInstance3D",true,false):
            if not str(mesh.name).begins_with("town-window") or mesh.mesh==null:continue
            for surface in range(mesh.mesh.get_surface_count()):
                rows.append({"mesh":mesh,"surface":surface,"day":mesh.get_active_material(surface),"night":warm,"city":"new" if city==new_city else "old"})
    var hosts=new_city.find_children("highland-west-city","Node3D",true,false)
    if hosts.size()==1:
        var data=JSON.parse_string(FileAccess.get_file_as_string("res://data/citadel-new-city-lighting.json"))
        if data is Dictionary:
            for spec in data.points:
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
var environment_rows:Array=[]
var sun_rows:Array=[]
func bind_environment(world:Node)->void:
    if not environment_rows.is_empty():return
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
    return {"environment_matching":environment_rows.all(func(row):return is_equal_approx(row.env.ambient_light_energy,0.5 if enabled else row.energy) and row.env.background_color==(Color("223950") if enabled else row.background)),"environment_count":environment_rows.size(),"energies":points.map(func(p):return p.light_energy),"point_lights":points.size(),"lit_points":points.filter(func(p):return p.light_energy>0).size(),"counts":counts,"enabled":enabled,"matching":matching,"total":rows.size()}
