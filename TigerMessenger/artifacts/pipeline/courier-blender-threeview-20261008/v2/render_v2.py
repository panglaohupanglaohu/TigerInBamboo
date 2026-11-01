import bpy, sys, os, math, json
from mathutils import Vector, Matrix, Euler
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
OUT = os.path.abspath(ARGS[0]); MODE = ARGS[1] if len(ARGS) > 1 else 'views'
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT, 'courier-v2.blend'))
sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'
sc.cycles.samples = int(os.environ.get('SAMPLES', 24)); sc.cycles.use_denoising = False
sc.view_settings.view_transform = 'Standard'
sc.render.use_freestyle = True; sc.render.line_thickness_mode = 'ABSOLUTE'; sc.render.line_thickness = 1.2
fs = sc.view_layers[0].freestyle_settings
ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new('L')
if ls.linestyle is None: ls.linestyle = bpy.data.linestyles.new('LS')
ls.linestyle.color = (0.12, 0.08, 0.06); ls.select_silhouette = True; ls.select_border = True; ls.select_crease = False
w = bpy.data.worlds.new('W'); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.9, 0.86, 0.78, 1)
w.node_tree.nodes['Background'].inputs[1].default_value = 1.1
sun = bpy.data.lights.new('sun', 'SUN'); sun.energy = 2.6; sun.angle = math.radians(8)
so = bpy.data.objects.new('sun', sun); sc.collection.objects.link(so)
cam = bpy.data.cameras.new('cam'); cam.type = 'ORTHO'
co = bpy.data.objects.new('cam', cam); sc.collection.objects.link(co); sc.camera = co
J = {o.name: o for o in bpy.data.objects if o.type == 'EMPTY' and o.name != 'Courier'}
C = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))
def set_three(n, x=0.0, y=0.0, z=0.0):
    e = J[n]; e.rotation_mode = 'QUATERNION'
    e.rotation_quaternion = (C @ Euler((x, y, z), 'XYZ').to_matrix() @ C.transposed()).to_quaternion()
def walk_pose(running, phase=math.pi / 2):
    amp = 0.62 if running else 0.36; sw = math.sin(phase) * amp; kf = 1.45 if running else 1.18; arm = 0.82 if running else 0.62
    return {'legL': (sw,), 'legR': (-sw,), 'kneeL': (max(0, -sw) * kf,), 'kneeR': (max(0, sw) * kf,),
            'armL': (-sw * arm, 0, 0.05), 'armR': (sw * arm, 0, -0.05),
            'elbowL': (-0.18 - max(0, -sw) * 0.26,), 'elbowR': (-0.18 - max(0, sw) * 0.26,),
            'handL': (-math.sin(phase - 0.42) * (0.26 if running else 0.16),), 'handR': (math.sin(phase - 0.42) * (0.26 if running else 0.16),)}
POSES = {
    'idle 待机': {'armL': (0, 0, 0.04), 'armR': (0, 0, -0.04), 'elbowL': (-0.1,), 'elbowR': (-0.1,)},
    'walk 走': walk_pose(False), 'run 跑': walk_pose(True),
    'letter 拿信': {'armL': (0, 0, 0.05), 'elbowL': (-0.12,), 'armR': (-0.62, -0.15, -0.22), 'elbowR': (-0.72, 0.12, 0), 'handR': (0.22,)},
    'ride 骑乘': {'legL': (-1.15,), 'legR': (-1.15,), 'kneeL': (1.3,), 'kneeR': (1.3,), 'armL': (-0.48, 0, 0.05), 'armR': (-0.48, 0, -0.05), 'elbowL': (-0.68,), 'elbowR': (-0.68,)},
    'jump 跳': {'legL': (-0.28,), 'legR': (0.22,), 'kneeL': (0.45,), 'kneeR': (0.65,), 'armL': (0, 0, 0.04), 'armR': (0, 0, -0.04), 'elbowL': (-0.1,), 'elbowR': (-0.1,)},
}
def pose(name):
    for n in J:
        if n != 'body': set_three(n)
    for n, v in POSES[name].items(): set_three(n, *v)
    show = name.startswith('letter')
    for o in bpy.data.objects:
        if o.get('joint') == 'letter': o.hide_render = not show
    # seated: drop the root so feet are not the reference (cosmetic for the sheet only)
    bpy.data.objects['Courier'].location = (0, 0, -0.42 if name.startswith('ride') else (0.08 if name.startswith('jump') else 0))
    bpy.context.view_layer.update()
def shoot(d, path, res=(440, 1000), scale=1.95, target=(0, 0, 0.92)):
    sc.render.resolution_x, sc.render.resolution_y = res; cam.ortho_scale = scale
    d = Vector(d).normalized(); t = Vector(target)
    co.location = t + d * 5; co.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    ld = (d + Vector((-0.6, 0, 0.9))).normalized() if abs(d.x) < 0.9 else Vector((-0.6, -0.5, 0.8)).normalized()
    so.rotation_euler = (-ld).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = path; bpy.ops.render.render(write_still=True)
if MODE == 'views':
    pose('idle 待机')
    for n, d in {'front': (0, -1, 0), 'side': (-1, 0, 0), 'back': (0, 1, 0), 'threequarter': (0.75, -1, 0.15)}.items():
        shoot(d, os.path.join(OUT, f'v2-{n}.png')); print('view', n)
else:
    for i, n in enumerate(POSES):
        pose(n); shoot((-0.85, -1, 0.12), os.path.join(OUT, f'v2-pose-{i}.png'), res=(420, 800), scale=2.1, target=(0, 0, 0.95)); print('pose', n)
