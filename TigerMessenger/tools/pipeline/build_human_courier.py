"""Approved Sultan-inspired original courier. Local Blender authoring, no external pack.
Coordinates in helpers: Three.js Y up, +Z forward; metres, feet at zero.
Run with Blender --background --factory-startup --python this_file.
"""
import bpy, math, json, shutil
from pathlib import Path
from mathutils import Vector, Matrix
from math import sin, cos, pi

BASE = Path(__file__).resolve().parents[2]
OUT = BASE / 'assets/models/optimized/human-courier-v1'
REVIEW = BASE / 'artifacts/pipeline/human-courier-v1'
OUT.mkdir(parents=True, exist_ok=True); REVIEW.mkdir(parents=True, exist_ok=True)
TARGET = Path('/Users/panglaohu/.codex/generated_images/01a09b54-6e3f-74c2-890e-59ce0261217e/exec-5ab6319b-94d5-4f67-b74c-ae4156dba452.png')
if TARGET.exists(): shutil.copy2(TARGET, OUT/'approved-target.png')
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
C = Matrix.Rotation(pi/2, 4, 'X'); CI = C.inverted()
def vec(p): return C.to_3x3() @ Vector(p)
M = {}
def mat(name, hexcolor, metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)],1)
    m.diffuse_color=tuple((v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4) for v in m.diffuse_color[:3])+(1,)
    m.use_nodes=True; b=m.node_tree.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value=m.diffuse_color; b.inputs['Roughness'].default_value=.79; b.inputs['Metallic'].default_value=metal
    M[name]=m; return m
for n,c in [('skin','B58A65'),('skin_light','C59A75'),('skin_shadow','946A4D'),('hair','211E1A'),('hair_light','393027'),('beard','4B3B2D'),('ivory','D9CCB0'),('shirt_shadow','B9AD96'),('teal','294A49'),('teal_light','3A5955'),('teal_shadow','203B3C'),('wine','682A2C'),('wine_light','843B35'),('wine_shadow','49252A'),('leather','553C29'),('leather_light','79583B'),('pants','3A322A'),('sole','292823'),('paper','E9D8AE'),('eyes','DBCAAA'),('iris','72532A')]: mat(n,c)
mat('gold','B89A55',.5)
def attach(o,parent):
    if parent:
        w=o.matrix_world.copy(); o.parent=parent; o.matrix_world=w
    return o
def joint(name,p,parent=None):
    o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=vec(p)
    bpy.context.view_layer.update(); return attach(o,parent)
root=joint('Courier',(0,0,0)); body=joint('body',(0,.94,0),root)
def mesh(name,verts,faces,material,parent=body,palette=None):
    me=bpy.data.meshes.new(name); me.from_pydata([vec(p) for p in verts],[],faces); me.update()
    o=bpy.data.objects.new(name,me); bpy.context.collection.objects.link(o)
    for m in (palette or [material]): me.materials.append(M[m])
    if palette:
        for f in me.polygons: f.material_index=(f.index*7+f.index//5)%len(palette)
    attach(o,parent); return o
def rings(name,sections,material,parent=body,n=12,palette=None):
    # (height, centre x, centre z, width radius, depth radius)
    v=[(x+rx*cos(2*pi*i/n),y,z+rz*sin(2*pi*i/n)) for y,x,z,rx,rz in sections for i in range(n)]
    f=[tuple(range(n-1,-1,-1))]
    for j in range(len(sections)-1):
        for i in range(n): f.append((j*n+i,j*n+(i+1)%n,(j+1)*n+(i+1)%n,(j+1)*n+i))
    f.append(tuple((len(sections)-1)*n+i for i in range(n)))
    return mesh(name,v,[tuple(reversed(face)) for face in f],material,parent,palette)
def orb(name,p,s,material,parent=body,segments=12,ringsn=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=ringsn,location=vec(p))
    o=bpy.context.object; o.name=name; o.scale=(s[0],s[2],s[1]); o.data.materials.append(M[material]); bpy.context.view_layer.update(); return attach(o,parent)
def bar(name,a,b,r,material,parent=body,r2=None,n=8):
    d=vec(b)-vec(a); bpy.ops.mesh.primitive_cone_add(vertices=n,radius1=r,radius2=r if r2 is None else r2,depth=d.length,location=(vec(a)+vec(b))/2)
    o=bpy.context.object; o.name=name; o.rotation_mode='QUATERNION'; o.rotation_quaternion=d.to_track_quat('Z','Y'); o.data.materials.append(M[material]); bpy.context.view_layer.update(); return attach(o,parent)
def box(name,p,s,material,parent=body,bevel=.008):
    bpy.ops.mesh.primitive_cube_add(size=1,location=vec(p)); o=bpy.context.object; o.name=name; o.scale=(s[0],s[2],s[1]); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(M[material])
    if bevel:
        mod=o.modifiers.new('Soft worn edges','BEVEL'); mod.width=bevel; mod.segments=1
        bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update(); return attach(o,parent)
def ribbon(name,points,width,material,parent=body):
    v=[]
    for x,y,z in points: v.extend([(x-width/2,y,z),(x+width/2,y,z)])
    return mesh(name,v,[(i*2,i*2+1,i*2+3,i*2+2) for i in range(len(points)-1)],material,parent)

# Tailored torso and split coat: a tapered ribcage, real waist, broad shoulders.
rings('Waistcoat',[(.90,0,0,.145,.095),(1.03,0,0,.153,.107),(1.22,0,0,.194,.113),(1.39,0,0,.223,.106),(1.45,0,0,.154,.084)],'teal',palette=['teal','teal','teal_light','teal_shadow'])
rings('Linen_neck_opening',[(1.40,0,0,.105,.080),(1.47,0,0,.075,.061)],'ivory')
for s in [-1,1]:
    mesh('Folded_linen_collar',[(s*.021,1.475,.052),(s*.082,1.455,.050),(s*.104,1.388,.102),(s*.042,1.411,.121)],[(0,1,2,3)],'ivory')
    ribbon('Vest_lapel',[(s*.09,1.405,.119),(s*.054,1.28,.128),(s*.007,1.15,.124)],.012,'gold')
rings('Neck',[(1.44,0,0,.055,.047),(1.55,0,.006,.056,.046)],'skin',n=12)
# Coat has separate panels following each hip, leaving a real front split for gait.
for side,label in [(-1,'R'),(1,'L')]:
    leg=joint('leg'+label,(side*.092,.93,0),root)
    rings('Trouser_thigh_'+label,[(.47,side*.093,0,.061,.061),(.75,side*.09,0,.074,.076),(.95,side*.089,0,.074,.080)],'pants',leg)
    knee=joint('knee'+label,(side*.093,.51,0),leg)
    rings('Boot_shaft_'+label,[(.105,side*.094,.005,.054,.064),(.20,side*.094,0,.048,.051),(.44,side*.094,0,.065,.056),(.50,side*.094,0,.061,.055)],'leather',knee,n=10)
    orb('Boot_toe_'+label,(side*.094,.068,.06),(.063,.058,.128),'leather',knee)
    box('Boot_sole_'+label,(side*.094,.024,.044),(.13,.035,.226),'sole',knee,bevel=.015)
    for k in range(5):
        y=.17+k*.056
        ribbon('Boot_wrap_'+label+str(k),[(side*.094-.05,y,.041),(side*.094,y+.026,.061),(side*.094+.051,y+.046,.038)],.016,'leather_light',knee)
    for k in [0,3]: box('Boot_buckle_'+label+str(k),(side*.094+.05,.2+k*.056,.04),(.019,.023,.010),'gold',knee,.003)
    # Small thigh-following panels avoid a rigid skirt crossing both legs.
    verts=[(side*.017,.98,.111),(side*.149,.98,.076),(side*.19,.615,.091),(side*.024,.595,.133), (side*.16,.98,-.055),(side*.187,.63,-.08)]
    mesh('Split_coat_'+label,verts,[(0,1,2,3),(1,4,5,2)],'teal',leg,['teal','teal_light'])
    ribbon('Coat_vertical_gold_'+label,[(side*.025,.955,.117),(side*.026,.60,.139)],.008,'gold',leg)
    bar('Coat_hem_gold_'+label,(side*.025,.613,.138),(side*.178,.631,.097),.005,'gold',leg)
rings('Back_coat',[(.625,0,-.029,.17,.079),(.94,0,-.015,.147,.091)],'teal_shadow')
rings('Belt',[(.936,0,0,.160,.113),(.990,0,0,.160,.113)],'leather',n=16)
box('Belt_buckle',(0,.964,.119),(.054,.039,.015),'gold',bevel=.004)
box('Buckle_inset',(0,.965,.130),(.034,.024,.007),'leather',bevel=.002)

# Rolled shirt sleeves, forearms and recognizable hands, with joint pivots.
for side,label in [(-1,'R'),(1,'L')]:
    shoulder=(side*.207,1.376,0); elbow=(side*.278,1.123,.015); wrist=(side*.325,.912,.049)
    arm=joint('arm'+label,shoulder,body)
    bar('Linen_sleeve_'+label,elbow,shoulder,.063,'ivory',arm,r2=.074,n=12)
    orb('Shirt_shoulder_'+label,shoulder,(.078,.070,.075),'ivory',arm)
    bar('Rolled_cuff_'+label,(side*.272,1.125,.015),(side*.262,1.172,.013),.066,'shirt_shadow',arm,n=12)
    forearm=joint('elbow'+label,elbow,arm)
    bar('Forearm_'+label,wrist,elbow,.032,'skin',forearm,r2=.045,n=12)
    hand=joint('hand'+label,wrist,forearm)
    orb('Palm_'+label,(side*.329,.874,.052),(.032,.05,.020),'skin',hand)
    for f in range(4):
        x=side*.329+(f-1.5)*.012
        bar('Finger_'+label+str(f),(x,.863,.058),(x,.824+abs(f-1.5)*.009,.073),.0065,'skin',hand,n=6)
    bar('Thumb_'+label,(side*.309,.885,.063),(side*.297,.85,.084),.010,'skin',hand,n=6)

# Face: sculpted cross sections with jaw, cheekbones and a projecting nose.
head=joint('head',(0,1.55,0),body)
rings('Face',[(1.508,0,.021,.040,.046),(1.54,0,.010,.063,.061),(1.592,0,.003,.077,.072),(1.657,0,0,.078,.073),(1.708,0,-.007,.070,.070),(1.737,0,-.012,.046,.051)],'skin',head,n=16)
for s in [-1,1]:
    orb('Ear'+str(s),(s*.079,1.616,-.004),(.017,.028,.019),'skin',head)
    orb('Eye_socket'+str(s),(s*.032,1.645,.066),(.026,.012,.011),'skin_shadow',head)
    orb('Eye'+str(s),(s*.032,1.645,.074),(.014,.004,.003),'eyes',head)
    orb('Iris'+str(s),(s*.032,1.645,.078),(.0042,.004,.002),'iris',head)
    orb('Pupil'+str(s),(s*.032,1.645,.080),(.002,.0035,.0015),'hair',head)
    bar('Brow'+str(s),(s*.013,1.662,.076),(s*.054,1.665,.065),.005,'hair',head,r2=.003,n=6)
mesh('Nose', [(-.012,1.66,.068),(.012,1.66,.068),(-.014,1.608,.089),(.014,1.608,.089),(0,1.617,.109),(0,1.665,.077)],[(0,5,4,2),(5,1,3,4),(2,4,3),(0,2,3,1)],'skin_light',head)
orb('Lower_lip',(0,1.574,.076),(.022,.005,.005),'skin_shadow',head)
for s in [-1,1]:
    bar('Moustache'+str(s),(s*.004,1.588,.080),(s*.027,1.582,.073),.005,'beard',head,r2=.003,n=6)
    bar('Jaw_stubble'+str(s),(s*.063,1.586,.043),(s*.038,1.535,.057),.004,'beard',head,r2=.004,n=8)
orb('Chin_stubble',(0,1.532,.060),(.036,.012,.012),'beard',head)
# Cap and flowing swept locks: keep forehead and eyes clear.
orb('Hair_crown',(0,1.719,-.014),(.083,.046,.075),'hair',head,segments=16)
for i in range(15):
    a=pi*.10+i/(14)*pi*.80
    x=.078*cos(a)*1.1; z=-.02-.05*sin(a)
    for s in [-1,1]:
        if s==1 and i>6: continue
        xx=x if s==-1 else -x
        p=[(xx*.7,1.747,z*.7),(xx,1.69,z),(xx*1.05+.008*sin(i),1.61,z-.01),(xx*1.10,1.52,z-.012),(xx*.9,1.47+.025*sin(i),z+.002)]
        for j in range(4): bar('Wavy_lock_%s_%s_%s'%(i,s,j),p[j],p[j+1],.015-j*.002,'hair_light' if i%4==0 else 'hair',head,r2=.012-j*.002,n=6)
for s in [-1,1]:
    for i in range(3):
        a=(s*(.025+i*.015),1.744,.02)
        b=(s*(.06+i*.008),1.696,.050)
        c=(s*(.065+i*.006),1.624-i*.018,.044)
        bar('Swept_fringe',a,b,.014,'hair',head,r2=.011)
        bar('Temple_curl',b,c,.011,'hair',head,r2=.004)
orb('Half_tied_knot',(0,1.733,-.087),(.026,.023,.023),'hair',head)

# Asymmetric cloak, burgundy folded collar and sun brooch on wearer's right.
cape=joint('cape',(0,1.39,-.08),body)
v=[]; rows=9; cols=13
for j in range(rows):
    t=j/(rows-1)
    for i in range(cols):
        u=i/(cols-1); x=(u-.5)*(.60-.03*t)
        y=1.395-t*(.75+.12*(1-u))+.016*sin(u*pi*6)*t
        # Keep the hanging cloth behind the coat and the backwards stride.
        z=-.112-.046*sin(u*pi)-t*.160-.026*sin(t*pi)+.012*cos(u*pi*8)*t
        v.append((x,y,z))
f=[(j*cols+i,j*cols+i+1,(j+1)*cols+i+1,(j+1)*cols+i) for j in range(rows-1) for i in range(cols-1)]
front=[(-.32,1.45,.050),(-.16,1.49,.090),(.10,1.47,.140),(.32,1.45,.060),(.205,1.31,.145),(-.12,1.43,.145),(-.32,1.35,.095)]
offset=len(v);v.extend(front)
f.extend(tuple(offset+i for i in face) for face in [(0,1,5,6),(1,2,5),(2,3,4,5)])
# Shared vertices stitch both shoulders to the back and chest panel: one cloth.
for start,a,b in [(0,offset,offset+1),(9,offset+2,offset+3)]:
    ridge=len(v)
    for i in range(4):v.append((v[start+i][0],1.485,-.008))
    for i in range(3):f.append((start+i,start+i+1,ridge+i+1,ridge+i))
    f.append((ridge,a,b,ridge+3,ridge+2,ridge+1))
mesh('Cloak_folds',v,f,'wine',cape,['wine','wine_shadow','wine','wine_light','wine'])
for i in range(cols-1): bar('Cloak_gold_hem',v[(rows-1)*cols+i],v[(rows-1)*cols+i+1],.005,'gold',cape,n=6)
orb('Sun_brooch',(-.171,1.422,.108),(.023,.023,.009),'gold')
for i in range(12):
    a=2*pi*i/12; bar('Brooch_ray',(-.171+.026*cos(a),1.422+.026*sin(a),.108),(-.171+.034*cos(a),1.422+.034*sin(a),.108),.0025,'gold',n=6)

# Cross-body satchel (LEFT), sealed letter in RIGHT hand, rolled map and compass.
ribbon('Satchel_front_strap',[(-.17,1.41,.113),(-.065,1.24,.123),(.05,1.07,.128),(.19,.90,.109)],.033,'leather')
ribbon('Strap_edge',[(-.18,1.41,.116),(-.075,1.24,.126),(.04,1.07,.131),(.18,.90,.112)],.004,'leather_light')
bag=box('Messenger_satchel',(.211,.85,.029),(.185,.207,.105),'leather',bevel=.019)
box('Satchel_flap',(.211,.895,.09),(.188,.099,.020),'leather_light',bevel=.010)
for x in [.137,.286]:
    box('Bag_seam',(x,.841,.088),(.007,.156,.009),'leather_light',bevel=.002)
    box('Bag_rivet',(x,.929,.106),(.008,.008,.005),'gold',bevel=.002)
mesh('Fox_clasp',[(.196,.878,.110),(.198,.9,.111),(.211,.888,.115),(.226,.9,.111),(.226,.878,.110),(.211,.863,.118)],[(0,1,2),(2,3,4),(0,2,5),(2,4,5)],'gold')
bar('Map_roll',(-.13,1.003,-.295),(.19,1.003,-.295),.027,'paper',cape,n=12)
for x in [-.07,.12]:
    bar('Map_tie',(x-.008,1.003,-.295),(x+.008,1.003,-.295),.029,'leather',cape,n=12)
    ribbon('Map_suspension',[(x,1.13,-.237),(x,1.032,-.295)],.013,'leather',cape)
bar('Compass_chain',(-.089,.96,.127),(-.11,.876,.139),.003,'gold',n=6)
orb('Compass',(-.11,.864,.14),(.024,.029,.009),'gold')
orb('Compass_face',(-.11,.864,.149),(.017,.021,.002),'paper')
bar('Compass_needle',(-.117,.852,.153),(-.102,.877,.153),.002,'wine',n=6)
letter=joint('letter',(-.323,.841,.088),bpy.data.objects['handR'])
box('Envelope',(-.323,.837,.083),(.111,.068,.009),'paper',letter,.002)
bar('Envelope_flap_a',(-.377,.869,.090),(-.323,.834,.090),.001,'leather_light',letter,n=4)
bar('Envelope_flap_b',(-.269,.869,.090),(-.323,.834,.090),.001,'leather_light',letter,n=4)
orb('Wax_seal',(-.323,.834,.092),(.010,.010,.003),'wine',letter)

# Export only authored asset hierarchy. Runtime keeps all named joints.
bpy.context.view_layer.update()
asset=[root,*root.children_recursive]
# Match shoulder outer width to the standing boots, including the linen sleeve.
# Warp joint origins and mesh vertices together, preserving all named attachments.
world={o:o.matrix_world.copy() for o in asset}
def worldpoints(o):return [CI.to_3x3()@(world[o]@p.co) for p in o.data.vertices]
feet=[p for o in asset if o.type=='MESH' and o.name.startswith('Boot_sole') for p in worldpoints(o)]
shoulders=[p for o in asset if o.type=='MESH' and o.name.startswith(('Shirt_shoulder','Linen_sleeve')) for p in worldpoints(o) if p.y>=1.30]
foot_width=max(p.x for p in feet)-min(p.x for p in feet)
shoulder_width=max(p.x for p in shoulders)-min(p.x for p in shoulders)
factor=foot_width/shoulder_width
def warp(p):
    p=p.copy();weight=max(0,min(1,(p.y-1.02)/.28))
    if p.y>1.49:weight=max(0,(1.508-p.y)/.018)
    p.x*=1+(factor-1)*weight;return p
new_world={}
for o in asset:
    m=world[o].copy();m.translation=vec(warp(CI.to_3x3()@m.translation));new_world[o]=m
for o in asset:
    if o.type=='MESH':
        inverse=new_world[o].inverted()
        for vertex in o.data.vertices:vertex.co=inverse@vec(warp(CI.to_3x3()@(world[o]@vertex.co)))
        o.data.update()
for o in asset:o.matrix_world=new_world[o]
bpy.context.view_layer.update()
(REVIEW/'shoulder-proportions.json').write_text(json.dumps({'bootOuterWidth':foot_width,'previousShoulderWidth':shoulder_width,'shoulderScale':factor,'targetShoulderWidth':foot_width,'scope':'Standing boot soles and upper sleeve/shoulder surfaces; head proportions retained'},indent=2))
for o in bpy.context.selected_objects: o.select_set(False)
for o in asset: o.select_set(True)
bpy.context.view_layer.objects.active=root
bpy.ops.export_scene.gltf(filepath=str(OUT/'human-courier.glb'),use_selection=True,export_yup=True)
nodes=[]
for o in asset:
    entry={'name':o.name,'parent':o.parent.name if o.parent in asset else None,'matrix':[round(v,7) for col in (CI@o.matrix_local@C).transposed() for v in col]}
    if o.type=='MESH':
        me=o.data; me.calc_loop_triangles(); parts=[]
        for mi,m in enumerate(me.materials):
            pos=[]; normal=[]
            for tri in me.loop_triangles:
                if tri.material_index!=mi: continue
                for vi in tri.vertices:
                    pos.extend(round(v,6) for v in CI.to_3x3()@me.vertices[vi].co)
                    normal.extend(round(v,6) for v in CI.to_3x3()@tri.normal)
            if pos: parts.append({'material':m.name,'position':pos,'normal':normal})
        entry['parts']=parts
    nodes.append(entry)
data={'version':1,'heightMetres':1.78,'forward':'+Z','nodes':nodes,'materials':{n:{'color':list(m.diffuse_color)[:3],'metalness':.5 if n=='gold' else 0} for n,m in M.items()}}
(OUT/'geometry.js').write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
(OUT/'manifest.json').write_text(json.dumps({'source':'human-courier.blend','target':'approved-target.png','method':'local Blender authored geometry; no external 3D service','polygons':sum(len(o.data.polygons) for o in asset if o.type=='MESH'),'status':'model candidate; user visual acceptance pending','forward':'+Z','joints':[o.name for o in asset if o.type=='EMPTY']},indent=2))

# Studio rendering belongs only to this asset file, never to the shared game scene.
floor=box('Studio_floor',(0,-.033,0),(200,.04,200),'shirt_shadow',None,0)
scene=bpy.context.scene; scene.render.engine='CYCLES'; scene.cycles.samples=32
scene.world.color=(.24,.24,.24)
scene.render.resolution_x=1100; scene.render.resolution_y=1200; scene.render.resolution_percentage=100
scene.view_settings.view_transform='AgX'
def area(name,p,power,size):
    bpy.ops.object.light_add(type='AREA',location=vec(p)); o=bpy.context.object; o.name=name; o.data.energy=power; o.data.shape='DISK'; o.data.size=size; o.rotation_euler=(vec((0,1,0))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key',(-3,4,4),400,4); area('Fill',(3,2,2),160,3); area('Rim',(1,3,-3),350,3)
bpy.ops.object.camera_add(); cam=bpy.context.object; cam.data.type='ORTHO'; cam.data.ortho_scale=2.02; scene.camera=cam
def render(name,p):
    cam.location=vec(p); cam.rotation_euler=(vec((0,.88,0))-cam.location).to_track_quat('-Z','Y').to_euler(); scene.render.filepath=str(REVIEW/(name+'.png')); bpy.ops.render.render(write_still=True)
render('front-three-quarter',(2.2,1.7,4.5))
render('back-three-quarter',(-2.4,1.65,-4.5))
cam.location=vec((2.2,1.7,4.5)); cam.rotation_euler=(vec((0,.88,0))-cam.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'human-courier.blend'))
print('COURIER_BUILD_COMPLETE',OUT)
