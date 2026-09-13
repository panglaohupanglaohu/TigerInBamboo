import bpy, json, time, os
BASE = "/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/citadel-battle-blender"
res = {}
bpy.ops.mesh.primitive_uv_sphere_add(location=(0,0,0))
bpy.ops.object.light_add(type='SUN', location=(4,-4,6))
sc = bpy.context.scene
sc.render.resolution_x, sc.render.resolution_y = 320, 200
for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "CYCLES"):
    try:
        sc.render.engine = eng
    except Exception as e:
        res[eng] = "unavailable: %s" % e
        continue
    sc.render.filepath = os.path.join(BASE, "probe_%s.png" % eng)
    t0 = time.time()
    try:
        bpy.ops.render.render(write_still=True)
        res[eng] = {"ok": os.path.exists(sc.render.filepath + ".png") or os.path.exists(sc.render.filepath),
                    "sec": round(time.time()-t0, 2)}
    except Exception as e:
        res[eng] = "render failed: %s" % e
json.dump(res, open(os.path.join(BASE, "engine-probe.json"), "w"), indent=1)
print("ENGINE_PROBE", res)
