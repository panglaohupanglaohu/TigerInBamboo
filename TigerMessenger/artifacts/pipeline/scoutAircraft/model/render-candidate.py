"""Read-only background render of the archived original scout. Run with Blender --background --python.
Does not save a .blend, replace materials, or operate the foreground Blender instance.
"""
import bpy, json, hashlib, math
from pathlib import Path
from mathutils import Vector
ROOT = Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
SOURCE = ROOT / "assets/models/optimized/scoutAircraft-art-v1.blend"
OUT = ROOT / "artifacts/pipeline/scoutAircraft/model"
OUT.mkdir(parents=True, exist_ok=True)
before_hash = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH" and not o.hide_render]
points = [o.matrix_world @ Vector(c) for o in meshes for c in o.bound_box]
lo = Vector(tuple(min(p[i] for p in points) for i in range(3)))
hi = Vector(tuple(max(p[i] for p in points) for i in range(3)))
center = (lo + hi) / 2
span = max(hi - lo)
scene.render.engine = "CYCLES"
scene.cycles.samples = 40
scene.cycles.use_denoising = True
scene.render.resolution_x = 1200
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("ScoutReferenceWorld")
scene.world.use_nodes = True
scene.world.node_tree.nodes.get("Background").inputs[0].default_value = (0.68, 0.72, 0.74, 1)
scene.world.node_tree.nodes.get("Background").inputs[1].default_value = .65
scene.view_settings.view_transform = "AgX"
# Fixed front-right above view: original Three +Z nose becomes Blender -Y.
camera = bpy.data.objects.new("ScoutReferenceCamera", bpy.data.cameras.new("ScoutReferenceCamera"))
scene.collection.objects.link(camera)
camera.location = center + Vector((.88, -1.30, .82)).normalized() * span * 3
camera.rotation_euler = (center - camera.location).to_track_quat("-Z", "Y").to_euler()
camera.data.type = "ORTHO"
camera.data.ortho_scale = span * 1.44
scene.camera = camera
for name, offset, power, size in [("Key", (-.65,-1,1.5),900,7),("Fill",(1,.5,.8),500,6)]:
 lamp = bpy.data.lights.new("ScoutReference"+name,"AREA");lamp.energy=power;lamp.shape="DISK";lamp.size=size
 ob=bpy.data.objects.new(lamp.name,lamp);scene.collection.objects.link(ob)
 ob.location=center+Vector(offset)*span
 ob.rotation_euler=(center-ob.location).to_track_quat("-Z","Y").to_euler()
scene.render.filepath = str(OUT / "round-2.png")
bpy.ops.render.render(write_still=True)
report = {"source": str(SOURCE.relative_to(ROOT)), "sourceSha256": before_hash,
 "sourceUnchanged": hashlib.sha256(SOURCE.read_bytes()).hexdigest() == before_hash,
 "render": "artifacts/pipeline/scoutAircraft/model/round-2.png", "renderer": "Cycles", "samples":40,
 "materials": "candidate refined materials", "originalAxes": {"nose":"+Z", "up":"+Y", "right":"+X"},
 "blenderAxes": {"nose":"-Y", "up":"+Z", "right":"+X"},
 "camera": {"location": list(camera.location), "rotationEuler": list(camera.rotation_euler), "orthoScale":camera.data.ortho_scale},
 "bounds": {"min":list(lo),"max":list(hi)}, "visibleMeshCount":len(meshes),
 "limitations":["Blender material interpretation is not Web toon lighting parity", "Hidden Web shader outlines remain excluded by archive import", "Read-only render of separately saved candidate"]}
(OUT / "round-2-render.json").write_text(json.dumps(report,indent=2))
print("SCOUT_REFERENCE_RENDERED", json.dumps(report))
