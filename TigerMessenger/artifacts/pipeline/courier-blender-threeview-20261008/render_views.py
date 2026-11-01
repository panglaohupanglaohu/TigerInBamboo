import bpy, sys, os, math
from mathutils import Vector
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
OUT = os.path.abspath(ARGS[0])
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, 'courier-threeview.blend'))
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
sc.cycles.device = 'CPU'
sc.cycles.samples = int(os.environ.get('SAMPLES', 24))
sc.cycles.use_denoising = False
sc.render.resolution_x, sc.render.resolution_y = 440, 1000
sc.render.film_transparent = False
sc.view_settings.view_transform = 'Standard'
sc.render.use_freestyle = True
sc.render.line_thickness_mode = 'ABSOLUTE'
sc.render.line_thickness = 1.3
fs = sc.view_layers[0].freestyle_settings
ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('L')
if ls.linestyle is None: ls.linestyle = bpy.data.linestyles.new('LS')
ls.linestyle.color = (0.12, 0.08, 0.06)
ls.select_by_visibility = True
ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False

w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.86, 0.78, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 1.1

sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 2.6; sun.angle = math.radians(8)
so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'; cam.ortho_scale = 1.95
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co

target = Vector((0, 0, 0.9))
views = {'front': Vector((0, -1, 0)), 'side': Vector((-1, 0, 0)), 'back': Vector((0, 1, 0)),
         'threequarter': Vector((0.75, -1, 0.15))}
only = ARGS[1:] or list(views)
for name in only:
    d = views[name].normalized()
    co.location = target + d * 5
    co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    ld = (d + Vector((-0.6, 0, 0.9))).normalized() if name != 'side' else Vector((-0.6, -0.5, 0.8)).normalized()
    so.rotation_euler = (-ld).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, f'render-{name}.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', name)
