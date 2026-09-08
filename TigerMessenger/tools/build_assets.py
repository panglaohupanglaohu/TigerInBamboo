"""Run with Blender --background --python tools/build_assets.py.
Source units: metres, Z up; glTF + web mesh export: metres, Y up.
Each asset has a ground-centred origin and a single flat-shaded mesh.
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets' / 'kit'
OUT.mkdir(parents=True, exist_ok=True)
(ROOT / 'art').mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)

def material(name, rgb, emission=0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*rgb, 1)
    p.inputs['Roughness'].default_value = .88
    if emission:
        p.inputs['Emission Color'].default_value = (*rgb, 1)
        p.inputs['Emission Strength'].default_value = emission
    return m

ivory = material('Warm limestone', (.77,.69,.51))
plaster = material('Chalk plaster', (.90,.83,.66))
rose = material('Terracotta', (.57,.20,.13))
blue = material('Blue slate', (.16,.31,.34))
teal = material('Celadon', (.24,.52,.44))
ink = material('Ink', (.045,.085,.10))
wood = material('Walnut', (.23,.12,.07))
gold = material('Letter gold', (.95,.59,.17))
glow = material('Amber glass', (1,.51,.10), 1.6)
mint = material('Crystal cyan', (.23,.72,.74), .25)
orange = material('Fox coat', (.76,.22,.075))
dark = material('Tiger indigo', (.065,.12,.18))
green = material('Moss', (.19,.37,.24))
parts = []

def finish(obj, name, mat):
    obj.name = name
    obj.data.materials.append(mat)
    parts.append(obj)
    return obj

def box(name, at, size, mat, bevel=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=at)
    o = bpy.context.object
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod=o.modifiers.new('Small crafted edges','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(o,name,mat)

def cone(name, at, r1, r2, depth, mat, vertices=8):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=depth, location=at)
    return finish(bpy.context.object,name,mat)

def ico(name, at, size, mat, sub=1):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1, location=at)
    o=bpy.context.object; o.scale=size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o,name,mat)

def mesh(name, verts, faces, mat):
    data=bpy.data.meshes.new(name); data.from_pydata(verts,[],faces); data.update()
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o)
    return finish(o,name,mat)

def roof(z, mat):
    return mesh('Gabled roof',[(-1.18,-1.15,z),(1.18,-1.15,z),(1.18,1.15,z),(-1.18,1.15,z),(0,-1.15,z+.95),(0,1.15,z+.95)],[(0,1,4),(3,5,2),(0,4,5,3),(1,2,5,4),(0,3,2,1)],mat)

def window(x,z):
    box('Recess',(x,-1.018,z),(.40,.05,.66),ink)
    box('Glass',(x,-1.05,z),(.29,.025,.49),glow)
    box('Sill',(x,-1.10,z-.36),(.51,.22,.09),ivory)
    box('Mullion',(x,-1.072,z),(.035,.03,.51),wood)

def house(mat=plaster):
    box('Foundation',(0,0,.14),(2.12,2.12,.28),ivory,.025)
    box('Wall',(0,0,1.36),(2,2,2.45),mat,.035)
    box('Cornice',(0,0,2.51),(2.15,2.15,.16),ivory)
    roof(2.61,rose if mat==plaster else blue)
    window(-.57,1.82); window(.57,1.82)
    box('Door',(0,-1.035,.68),(.54,.05,1.09),wood)
    box('Door lintel',(0,-1.08,1.29),(.65,.14,.10),ivory)
    box('Step',(0,-1.22,.15),(.88,.52,.18),ivory)
    cone('Chimney',(.58,.35,3.10),.18,.18,1.0,ivory,4)

def bookshop():
    house(teal)
    box('Sign',(0,-1.12,1.33),(1.64,.12,.26),wood)
    for x in (-.65,-.4,-.15,.1,.35,.6): box('Book spine',(x,-1.18,1.32),(.13,.04,.17),gold if x<0 else plaster)
    for x in (-.72,.72): box('Awning support',(x,-1.65,.7),(.06,.06,1.3),wood)
    box('Awning',(0,-1.35,1.48),(1.85,.87,.13),rose)

def tower():
    cone('Tower plinth',(0,0,.18),1.22,1.17,.36,ivory)
    cone('Tower',(0,0,1.9),1.0,1.0,3.6,plaster)
    cone('Crown',(0,0,3.7),1.2,1.2,.32,ivory)
    for i in range(8):
        a=i*math.tau/8; b=box('Merlon',(math.cos(a)*1.04,math.sin(a)*1.04,4.03),(.45,.45,.55),ivory); b.rotation_euler.z=a
    box('Arrow slit',(0,-1.005,2.5),(.14,.04,.7),ink)

def gate():
    for x in (-1.8,1.8): box('Gate pier',(x,0,1.6),(1,1.7,3.2),ivory,.06)
    # Wedge voussoirs form a real empty arch; no invisible door slab.
    for i in range(9):
        a=math.pi*i/9; b=math.pi*(i+1)/9
        vs=[]
        for y in (-.85,.85):
            for r,t in ((1.3,a),(1.3,b),(2.05,b),(2.05,a)): vs.append((math.cos(t)*r,y,1.55+math.sin(t)*r))
        mesh('Arch stone',vs,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],ivory)

def tree():
    cone('Trunk',(0,0,.7),.16,.11,1.4,wood,6)
    for i in range(3): cone('Pine tier',(0,0,1.1+i*.55),.95-i*.2,.05,1.0,green,7)

def animal(tiger=False):
    coat=dark if tiger else orange
    ico('Body',(0,0,.68),(.34,.66,.37),coat,2)
    ico('Head',(0,-.62,.88),(.35,.32,.32),coat,1)
    ico('Muzzle',(0,-.86,.77),(.22,.17,.15),plaster)
    for x in (-.21,.21):
        cone('Ear',(x,-.61,1.19),.14,.02,.32,coat,4)
        for y in (-.38,.38):
            box('Leg',(x,y,.29),(.14,.18,.48),coat,.035)
            box('Paw',(x,y-.04,.07),(.20,.26,.14),plaster,.025)
        ico('Eye',(x,-.865,.92),(.046,.027,.045),glow)
    for i in range(4): ico('Tail',(0,.68+i*.17,.66+i*.13),(.15-i*.014,.25,.17),plaster if i==3 else coat)
    if tiger:
        for y in (-.32,0,.30):
            for x in (-.29,.29): box('Flank stripe',(x,y,.76),(.055,.09,.39),ink)

def aircraft():
    ico('Organic hull',(0,0,1.0),(.7,1.8,.47),plaster,2)
    ico('Cockpit',(0,-.8,1.22),(.46,.64,.24),mint,2)
    for s in (-1,1):
        top=[(s*.45,-.8,1),(s*3,.8,1.15),(s*2.8,1.3,.99),(s*.4,1.0,.78)]
        bottom=[(x,y,z-.08) for x,y,z in top]
        wing=mesh('Swept wing',top+bottom,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],blue)
        if s < 0:
            for polygon in wing.data.polygons: polygon.flip()
        cone('Engine',(s*.77,.75,.73),.2,.28,.75,ink)
        ico('Engine glow',(s*.77,.75,.31),(.17,.17,.12),glow)
    cone('Suction core',(0,0,.55),.32,.45,.28,gold)

def messenger():
    cone('Coat',(0,0,.65),.31,.23,.72,teal,7)
    ico('Head',(0,0,1.23),(.24,.24,.25),plaster,2)
    cone('Hat',(0,0,1.45),.39,.22,.16,blue,8)
    for x in (-.14,.14): box('Boot',(x,0,.13),(.17,.29,.26),wood,.03)
    box('Satchel',(.31,.08,.65),(.20,.40,.40),rose,.04)
    box('Letter',(.0,-.29,.77),(.36,.055,.24),plaster)

def postbox():
    cone('Foot',(0,0,.10),.33,.27,.20,ivory,6)
    box('Post',(0,0,.58),(.16,.16,1),wood)
    box('Mailbox',(0,0,1.18),(.62,.43,.53),teal,.06)
    box('Slot',(0,-.224,1.25),(.42,.018,.055),ink)
    ico('Wax seal',(0,-.24,1.09),(.075,.025,.075),gold)

builders={'house':house,'bookshop':bookshop,'tower':tower,'gate':gate,'pine':tree,'fox':animal,'tiger':lambda:animal(True),'aircraft':aircraft,'messenger':messenger,'postbox':postbox}
exported={}; roots=[]
for name,builder in builders.items():
    parts=[]; builder()
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts: p.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join()
    obj=bpy.context.object; obj.name=name
    bpy.context.scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
    for poly in obj.data.polygons: poly.use_smooth=False
    bpy.ops.export_scene.gltf(filepath=str(OUT/f'{name}.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=False)
    obj.data.calc_loop_triangles()
    positions=[]; normals=[]; colors=[]
    for tri in obj.data.loop_triangles:
        col=obj.data.materials[tri.material_index].diffuse_color[:3]
        for vi in tri.vertices:
            v=obj.data.vertices[vi].co; n=tri.normal
            positions.extend([round(v.x,5),round(v.z,5),round(-v.y,5)])
            normals.extend([round(n.x,5),round(n.z,5),round(-n.y,5)])
            colors.extend([round(c,5) for c in col])
    exported[name]={'positions':positions,'normals':normals,'colors':colors,'triangles':len(positions)//9}
    roots.append(obj)
(OUT/'meshes.json').write_text(json.dumps({'version':1,'units':'metres','up':'Y','assets':exported},separators=(',',':')))
(OUT/'manifest.json').write_text(json.dumps({'version':1,'generator':'Blender','assets':[{'id':k,'file':k+'.glb','triangles':v['triangles']} for k,v in exported.items()]},indent=2))

# Editable source arranged as a contact sheet.
for i,o in enumerate(roots): o.location=(i%5*6,i//5*7,0)
world=bpy.context.scene.world or bpy.data.worlds.new('Studio'); bpy.context.scene.world=world
world.color=(.16,.20,.21)
bpy.ops.object.camera_add(location=(20,-24,25))
cam=bpy.context.object; direction=Vector((12,3,1))-cam.location
cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler(); cam.data.type='ORTHO'; cam.data.ortho_scale=32
scene=bpy.context.scene; scene.camera=cam
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'; scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True; scene.display.shading.show_cavity=True
scene.display.shading.cavity_type='BOTH'; scene.display.shading.background_type='WORLD'
scene.render.resolution_x=1500; scene.render.resolution_y=800; scene.render.resolution_percentage=100
scene.render.filepath=str(OUT/'contact-sheet.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'art'/'TigerMessenger-kit.blend'))
bpy.ops.render.render(write_still=True)
print('TIGER_ASSETS_OK', json.dumps({k:v['triangles'] for k,v in exported.items()}))
