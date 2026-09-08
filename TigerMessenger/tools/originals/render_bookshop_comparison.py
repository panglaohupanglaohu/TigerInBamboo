import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
out=root/'assets/models/optimized/verification';out.mkdir(exist_ok=True)
for name,relative in [('before','assets/models/originals/blender-r3/bookshop.blend'),('after','assets/models/optimized/bookshop.blend')]:
    bpy.ops.wm.open_mainfile(filepath=str(root/relative))
    scene=bpy.context.scene
    scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO';scene.display.shading.color_type='MATERIAL'
    scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=False
    scene.display.shading.background_type='WORLD';scene.world.color=(.16,.18,.19)
    scene.render.resolution_x=720;scene.render.resolution_y=720;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
    camera=bpy.data.objects.new('VerificationCamera',bpy.data.cameras.new('VerificationCamera'));scene.collection.objects.link(camera)
    camera.location=(12,-20,13);target=Vector((-.5,-.3,3.5))
    camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='ORTHO';camera.data.ortho_scale=12
    scene.camera=camera;scene.render.filepath=str(out/f'bookshop-{name}.png')
    bpy.ops.render.render(write_still=True)
print('BOOKSHOP_COMPARISON_RENDERED')
