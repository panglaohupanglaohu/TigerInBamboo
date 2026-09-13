import bpy, json, os, sys
out = {"blender": bpy.app.version_string, "cwd": os.getcwd(),
       "argv": sys.argv[-3:], "engines": [e.bl_idname for e in bpy.types.RenderEngine.__subclasses__()][:8]}
p = "/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/citadel-battle-blender/probe.json"
json.dump(out, open(p, "w"), indent=1)
print("PROBE_OK", out)
