"""Isolated Blender scene: current runtime baseline + current terrain mesh.
Does not load or overwrite the GUI session. Stage 0 baseline, not art approval.
"""
import bpy, json, math, os
from pathlib import Path
from mathutils import Vector
ROOT=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
OUT=ROOT/'artifacts/pipeline/citadel-terrain-rebuild'
STAGE=os.environ.get('CITADEL_TERRAIN_STAGE','01')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(OUT/'current-castle-baseline.glb'))
for ob in list(bpy.data.objects):
    if ob.name.startswith('citadel-oskar-grid-mountain-surface') or ob.name.startswith('backlit-highlight'):
        bpy.data.objects.remove(ob,do_unlink=True)
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=str(ROOT/'godot/assets/art-pilots/citadel-west-city-v1.glb'))
added=set(bpy.data.objects)-before
terrain=next(ob for ob in added if ob.type=='MESH' and ob.name.startswith('citadel-oskar-grid-mountain-surface'))
world=terrain.matrix_world.copy();terrain.parent=None;terrain.matrix_world=world
for ob in added:
    if ob!=terrain:bpy.data.objects.remove(ob,do_unlink=True)
terrain['stage']='0B-first-heightfield-pass'
# Preserve the heightfield and its runtime support; Blender normal cleanup
# is local to this working copy until a separately verified export is chosen.
import bmesh
bm=bmesh.new();bm.from_mesh(terrain.data)
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(terrain.data);bm.free()
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=12
scene.render.resolution_x=1000;scene.render.resolution_y=650;scene.render.resolution_percentage=100
scene.world=bpy.data.worlds.new('Blue dusk working world');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.11,.19,.29,1)
scene.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
sun=bpy.data.lights.new('Working sunlight','SUN');sun.energy=2.0
obj=bpy.data.objects.new('Working sunlight',sun);scene.collection.objects.link(obj);obj.rotation_euler=(math.radians(25),math.radians(-20),math.radians(-25))
cam=bpy.data.objects.new('Fixed target-facing review',bpy.data.cameras.new('Fixed target-facing review'));scene.collection.objects.link(cam)
cam.location=(0,-150,24);cam.rotation_euler=(Vector((16,-12,15))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='PERSP';cam.data.angle=math.radians(50);scene.camera=cam
scene.render.filepath=str(OUT/f'blender-stage-{STAGE}.png')
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'terrain-stage-{STAGE}.blend'))
(OUT/f'blender-stage-{STAGE}.json').write_text(json.dumps({'source':'current-castle-baseline.glb + latest runtime terrain','terrain_vertices':len(terrain.data.vertices),'terrain_faces':len(terrain.data.polygons),'terrain_normals_recalculated':True,'blender_candidate_not_reexported':True,'art_approved':False},indent=2))
bpy.ops.render.render(write_still=True)
