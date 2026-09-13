extends RefCounted
## Current shared layout. Explicit legacy flags retain the previous diagnostic view.
static func enabled()->bool:return not OS.get_cmdline_user_args().has("--legacy-surface")
static func harbor_enabled()->bool:return enabled() and not OS.get_cmdline_user_args().has("--legacy-old-harbor")
static func data_path(path:String)->String:
    if not enabled() or path.get_file().begins_with("common-frame-"):return path
    return path.get_base_dir()+"/common-frame-"+path.get_file()
static func delta()->Transform3D:
    var source=JSON.parse_string(FileAccess.get_file_as_string(data_path("res://data/citadel-placement.json")))
    assert(source is Dictionary and source.get("surface") is Dictionary,"Missing common-frame placement export")
    var m:Array=source.surface.delta
    assert(m.size()==16,"Invalid common-frame transform")
    return Transform3D(Basis(Vector3(m[0],m[1],m[2]),Vector3(m[4],m[5],m[6]),Vector3(m[8],m[9],m[10])),Vector3(m[12],m[13],m[14]))
