"""Approved citadel target -> original Blender white-stone hero candidate.
Run with Blender --background --python this.py -- --revision 01.
No Web integration. Refuses to replace any existing revision.
Blender Z-up, statue faces -Y; GLB exporter maps to engine Y-up.
"""
import argparse
import json
import math
from pathlib import Path
import sys
import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--revision', default='01')
parser.add_argument('--no-render', action='store_true')
args = parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
if not args.revision.replace('-', '').replace('_', '').isalnum():
    raise ValueError('revision must be alphanumeric')
name = 'citadel-hero-statue-r' + args.revision
OUT = ROOT/'assets/models/optimized/citadel-statue'
REVIEW = ROOT/'artifacts/pipeline/citadel-statue'/name
blend = OUT/(name+'.blend')
glb = OUT/(name+'.glb')
if blend.exists() or glb.exists() or REVIEW.exists():
    raise FileExistsError('Candidate revision exists; use a new --revision')
OUT.mkdir(parents=True, exist_ok=True)
REVIEW.mkdir(parents=True)
# This script is intended for an isolated background process only.
if not bpy.app.background:
    raise RuntimeError('Use --background; never replace the foreground Blender scene')
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
asset = bpy.data.collections.new(name)
bpy.context.scene.collection.children.link(asset)

def material(name, color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    bsdf=m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value=(*color,1)
    bsdf.inputs['Roughness'].default_value=.86
    return m
stone=material('hero-warm-limestone',(.81,.79,.72))
highlight=material('carved-edge-ivory',(.91,.88,.80))
recess=material('stone-cut-recess',(.64,.64,.60))
base_stone=material('pedestal-limestone',(.75,.73,.68))

def keep(o,mat):
    for col in list(o.users_collection): col.objects.unlink(o)
    asset.objects.link(o);o.data.materials.append(mat)
    return o

def cube(label,loc,size,mat=stone,bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1,location=loc)
    o=bpy.context.object;o.name=label;o.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel:
        mod=o.modifiers.new('small-carved-edge','BEVEL');mod.width=bevel;mod.segments=1
        bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
    return keep(o,mat)

def ellipsoid(label,loc,scale,mat=stone,segments=12,rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,radius=1,location=loc)
    o=bpy.context.object;o.name=label;o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    return keep(o,mat)

def bone(label,a,b,r1,r2,mat=stone):
    a,b=Vector(a),Vector(b);delta=b-a
    bpy.ops.mesh.primitive_cone_add(vertices=10,radius1=r1,radius2=r2,depth=delta.length,location=(a+b)*.5)
    o=bpy.context.object;o.name=label;o.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return keep(o,mat)

def loft(label,rings,segments=32,fold=.035,mat=stone):
    # rings: z, x offset, y offset, half width, half depth.
    verts=[]
    for z,x,y,rx,ry in rings:
        for i in range(segments):
            a=math.tau*i/segments
            wave=1+fold*math.cos(a*8)+fold*.3*math.sin(a*3+z)
            verts.append((x+rx*math.cos(a)*wave,y+ry*math.sin(a)*wave,z))
    faces=[]
    for row in range(len(rings)-1):
        for i in range(segments):
            j=(i+1)%segments;faces.append((row*segments+i,row*segments+j,(row+1)*segments+j,(row+1)*segments+i))
    faces += [tuple(reversed(range(segments))),tuple((len(rings)-1)*segments+i for i in range(segments))]
    mesh=bpy.data.meshes.new(label);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(label,mesh);asset.objects.link(o);mesh.materials.append(mat)
    return o

# Square, visibly layered pedestal; maximum corner span 3.8 units.
cube('pedestal-bottom-step',(0,0,.13),(2.66,2.66,.26),base_stone,.07)
cube('pedestal-second-step',(0,0,.38),(2.35,2.35,.24),highlight,.04)
cube('pedestal-foot-moulding',(0,0,.59),(1.97,1.97,.18),stone,.04)
cube('pedestal-solid-shaft',(0,0,1.52),(1.70,1.70,1.72),base_stone,.07)
cube('pedestal-cap-lower',(0,0,2.43),(1.92,1.92,.17),stone,.04)
cube('pedestal-cap-upper',(0,0,2.62),(2.16,2.16,.21),highlight,.045)
cube('figure-carved-plinth',(0,-.025,2.80),(1.35,.92,.15),stone,.03)
# Contrapposto legs: left supporting, right slightly bent and stepped forward.
ellipsoid('left-sandal',(-.25,-.105,2.955),(.20,.32,.10),segments=12)
ellipsoid('right-sandal',(.25,-.27,2.955),(.19,.33,.10),segments=12)
bone('left-calf',(-.25,.005,3.00),(-.28,.045,3.80),.12,.19)
bone('left-thigh',(-.28,.045,3.80),(-.19,.015,4.46),.19,.245)
bone('right-calf',(.25,-.17,3.00),(.31,-.075,3.72),.12,.18)
bone('right-thigh',(.31,-.075,3.72),(.22,.07,4.43),.18,.245)
ellipsoid('left-knee',(-.28,-.025,3.79),(.185,.18,.20))
ellipsoid('right-knee',(.31,-.16,3.73),(.18,.18,.20))
# Knee-length tunic plus diagonal over-shoulder drapery, not a cylindrical post.
loft('tunic-deep-vertical-carved-folds',[(3.77,0,.06,.58,.31),(4.04,0,.035,.56,.31),(4.45,.01,0,.46,.30),(4.76,-.015,0,.39,.27)],fold=.105)
loft('human-torso-tunic',[(4.45,.01,0,.45,.28),(4.82,-.025,0,.38,.26),(5.12,-.035,.005,.48,.31),(5.48,-.03,.015,.59,.30),(5.68,-.025,.02,.49,.23)],fold=.025)
loft('cloth-belt',[(4.67,-.015,0,.414,.285),(4.80,-.015,0,.411,.286)],fold=.02,mat=highlight)
# Draped left shoulder panel: a real surface with broad slanting folds.
verts=[];faces=[]
for row in range(9):
    t=row/8
    for col in range(9):
        u=col/8
        x=-.48+.84*t+.22*(u-.5)
        z=5.68-.90*t
        y=-.27-.047*math.cos(u*math.tau*3)-.027*math.sin(t*math.pi)
        verts.append((x,y,z))
for row in range(8):
    for col in range(8):
        a=row*9+col;faces.append((a,a+1,a+10,a+9))
mesh=bpy.data.meshes.new('diagonal-toga-folds');mesh.from_pydata(verts,[],faces);mesh.update()
o=bpy.data.objects.new('diagonal-toga-folds',mesh);asset.objects.link(o);mesh.materials.append(highlight)
mod=o.modifiers.new('cloth-stone-thickness','SOLIDIFY');mod.thickness=.045
bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
# Mantle down the back, shaped to shoulders and thinning toward the calves.
loft('back-mantle',[(3.59,-.26,.26,.22,.065),(4.12,-.25,.25,.35,.09),(4.80,-.20,.27,.41,.11),(5.39,-.15,.25,.46,.10),(5.62,-.16,.17,.41,.09)],segments=24,fold=.08)
# Both upper arms connect naturally at shoulders. Right forearm rests across chest.
ellipsoid('left-shoulder',(-.54,.015,5.42),(.23,.255,.28))
bone('left-upper-arm',(-.57,.00,5.38),(-.69,-.005,4.90),.18,.135)
ellipsoid('left-elbow',(-.69,-.005,4.9),(.135,.145,.15))
bone('left-forearm',(-.69,-.005,4.90),(-.65,-.18,4.46),.135,.10)
ellipsoid('left-hand',(-.65,-.18,4.36),(.12,.095,.17))
for i in range(4): bone('left-finger-%d'%i,(-.73+i*.043,-.24,4.39),(-.73+i*.043,-.24,4.24),.027,.022)
ellipsoid('right-shoulder',(.49,.015,5.41),(.22,.25,.27))
bone('right-upper-arm',(.54,.005,5.38),(.66,-.09,5.02),.18,.135)
ellipsoid('right-elbow',(.66,-.09,5.02),(.135,.14,.15))
bone('right-forearm',(.66,-.09,5.02),(.13,-.37,5.22),.13,.09)
ellipsoid('right-hand',(.045,-.385,5.245),(.17,.095,.095))
for i in range(4): bone('right-finger-%d'%i,(-.06,-.415,5.18+i*.043),(-.16,-.407,5.18+i*.043),.025,.022)
# Anatomical neck, chin, cheeks, brow and projecting nose; unpainted carved eyes.
bone('neck',(-.035,.015,5.59),(-.045,.015,6.05),.16,.17)
loft('head-skull-and-jaw',[(5.96,-.055,-.025,.14,.155),(6.07,-.055,-.018,.22,.19),(6.26,-.055,0,.265,.22),(6.45,-.055,.025,.275,.225),(6.64,-.055,.045,.205,.19),(6.72,-.055,.045,.07,.07)],segments=16,fold=0)
ellipsoid('chin',(-.055,-.17,6.06),(.13,.08,.09))
ellipsoid('left-cheek',(-.215,-.155,6.23),(.095,.065,.11))
ellipsoid('right-cheek',(.105,-.155,6.23),(.095,.065,.11))
ellipsoid('left-ear',(-.326,.005,6.28),(.045,.075,.115))
ellipsoid('right-ear',(.217,.005,6.28),(.045,.075,.115))
bone('nose-bridge',(-.055,-.201,6.40),(-.055,-.293,6.245),.045,.067)
ellipsoid('nose-tip',(-.055,-.29,6.235),(.07,.04,.045))
for side in (-1,1):
    x=-.055+side*.105
    ellipsoid('carved-eye-socket-%s'%side,(x,-.203,6.335),(.079,.026,.039),recess,10,6)
    ellipsoid('stone-eyelid-%s'%side,(x,-.224,6.34),(.062,.017,.024),stone,10,6)
    bone('brow-%s'%side,(x-.072,-.204,6.39),(x+.065,-.207,6.385),.025,.024,highlight)
ellipsoid('upper-lip',(-.055,-.216,6.151),(.09,.025,.02))
ellipsoid('lower-lip',(-.055,-.215,6.124),(.084,.023,.025))
# Close-cropped carved hair. Locks stay within the approved 6.8 total height.
for i in range(12):
    a=math.tau*i/12
    ellipsoid('hair-lock-%02d'%i,(-.055+.22*math.cos(a),.05+.17*math.sin(a),6.59+.035*math.cos(a*2)),(.085,.075,.11),stone,8,6)
ellipsoid('hair-crown',(-.055,.05,6.68),(.18,.15,.12),stone,12,6)
# Recalculate closed mesh normals; preserve deliberate faceting.
for o in asset.objects:
    if o.type!='MESH': continue
    bm=bmesh.new();bm.from_mesh(o.data)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
    bm.to_mesh(o.data);bm.free();o.data.update()
# Clean export selection contains only statue meshes, never stage, cameras, lights.
for o in asset.objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)
bpy.ops.object.select_all(action='DESELECT')
scene=bpy.context.scene
scene.render.engine='CYCLES';scene.cycles.samples=24
scene.render.resolution_x=720;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.world.color=(.22,.25,.30)
scene.view_settings.view_transform='AgX'
# Stage is intentionally outside the exported asset collection.
stage_mat=material('review-stage',(.13,.16,.20))
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.015));bpy.context.object.name='review-ground';bpy.context.object.data.materials.append(stage_mat)
for label,loc,energy,size in [('key',(-5,-7,10),1500,7),('fill',(5,-1,7),900,6),('rim',(0,5,9),1800,5)]:
    data=bpy.data.lights.new(label,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    light=bpy.data.objects.new(label,data);scene.collection.objects.link(light);light.location=loc
    light.rotation_euler=(Vector((0,0,3.8))-light.location).to_track_quat('-Z','Y').to_euler()
cam_data=bpy.data.cameras.new('review-camera');cam=bpy.data.objects.new('review-camera',cam_data);scene.collection.objects.link(cam)
cam_data.type='ORTHO';cam_data.ortho_scale=8.1;scene.camera=cam
views={'front':(0,-15,6.2),'side':(15,0,6.2),'back':(0,15,6.2),'three-quarter':(9,-14,7.1)}
rendered=[]
for label,loc in views.items():
    cam.location=loc;cam.rotation_euler=(Vector((0,0,3.35))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(REVIEW/(label+'.png'))
    if not args.no_render: bpy.ops.render.render(write_still=True);rendered.append(scene.render.filepath)
# Store useful primary review camera in the editable source file.
cam.location=views['three-quarter'];cam.rotation_euler=(Vector((0,0,3.35))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
verts=[o.matrix_world@Vector(corner) for o in asset.objects for corner in o.bound_box]
lo=[min(v[i] for v in verts) for i in range(3)];hi=[max(v[i] for v in verts) for i in range(3)]
report={'status':'candidate-needs-visual-review','sourceTarget':'assets/concepts/citadel/citadel-battle-target-v1.png','blend':str(blend),'glb':str(glb),'renders':rendered,'meshObjects':len(asset.objects),'vertices':sum(len(o.data.vertices) for o in asset.objects),'boundsBlenderZUp':{'min':lo,'max':hi},'totalHeight':hi[2]-lo[2],'baseCornerSpan':2.66*math.sqrt(2),'front':'Blender -Y; engine +Z after glTF conversion','scope':'Original carved hero candidate; no Web/Godot integration and no visual approval claimed.'}
(REVIEW/'report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report))
