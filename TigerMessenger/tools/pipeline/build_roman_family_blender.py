"""Independent background Blender authoring; original archives are read-only."""
import argparse, bpy, hashlib, json, math, struct, sys, shutil
from pathlib import Path
from mathutils import Matrix, Vector

BASE=Path(__file__).resolve().parents[2]
OUT=BASE/'assets/models/optimized/roman-family-v1'
EVIDENCE=BASE/'artifacts/pipeline/roman-family-blender'
C=Matrix.Rotation(math.pi/2,4,'X'); CI=C.inverted()
SKIP_RENDER=False
REFINE_HELMET=False
REFINE_FACE=False
def ident(o):return o.get('three_node_id',o.get('roman_family_added_id'))
def added_by_id(tag):return next((o for o in bpy.context.scene.objects if o.get('roman_family_added_id')==tag),None)

def material(name,color,metal=0):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
    p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1)
    p.inputs['Roughness'].default_value=.72;p.inputs['Metallic'].default_value=metal
    return m

def mesh(name,vertices,faces,mat,parent,tag):
    data=bpy.data.meshes.new(name);data.from_pydata([C.to_3x3()@Vector(v) for v in vertices],[],faces);data.update()
    o=bpy.data.objects.new(name,data);bpy.context.scene.collection.objects.link(o);o.parent=parent
    o['roman_family_added_id']=tag;o['roman_family_role']=name
    if mat:data.materials.append(mat)
    return o

def cube_data(center,size):
    v=[tuple(center[k]+size[k]*s[k]/2 for k in range(3)) for s in [(-1,-1,-1),(-1,-1,1),(-1,1,-1),(-1,1,1),(1,-1,-1),(1,-1,1),(1,1,-1),(1,1,1)]]
    return v,[(0,4,6,2),(1,3,7,5),(0,1,5,4),(2,6,7,3),(0,2,3,1),(4,5,7,6)]

def box(name,center,size,mat,parent,tag):
    v,f=cube_data(center,size);return mesh(name,v,f,mat,parent,tag)

def setm(o,m):o.matrix_basis=C@m@CI
def local(o):return CI@o.matrix_basis@C
def flat(m):return [m[r][c] for c in range(4) for r in range(4)]
def hidden(o):
    o.hide_render=True;o.hide_set(True);o['candidateHidden']=True
    for ch in o.children:hidden(ch)

def append_glb(path,parent,prefix):
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(path))
    imported=set(bpy.data.objects)-before;result=[]
    for o in imported:
        if o.type=='MESH':
            o.parent=parent;o.matrix_basis=Matrix.Identity(4);o['roman_family_added_id']='add:'+prefix+':'+o.name
            o['roman_family_role']=prefix;result.append(o)
    for o in imported:
        if o.type!='MESH':bpy.data.objects.remove(o,do_unlink=True)
    return result

def hand(parent,target,axis,mat,tag,hole=None,wrist=None):
    # Closed faceted fingers curve around a real open cylindrical grip hole.
    verts=[];faces=[]
    def piece(v,f):
        offset=len(verts);verts.extend(v);faces.extend(tuple(i+offset for i in face) for face in f)
    existing=added_by_id('add:hand'+tag)
    q=Vector((0,1,0)).rotation_difference(Vector(axis).normalized())
    if wrist is not None:
        y=Vector(axis).normalized();x=Vector(wrist)-y*Vector(wrist).dot(y);x.normalize();z=x.cross(y).normalized()
        q=Matrix((x,y,z)).transposed().to_quaternion()
    if existing:
        setm(existing,Matrix.Translation(Vector(target))@q.to_matrix().to_4x4());return existing
    hole=hole if hole is not None else (.009 if tag=='L' else .014)
    piece(*cube_data((-(hole+.008),0,0),(.016,.052,.043)))
    for y in [-.018,-.006,.006,.018]:
        for i in range(7):
            a0=-2.25+i*4.5/7;a1=-2.25+(i+1)*4.5/7
            vv=[(r*math.cos(a),y+dy,r*math.sin(a)) for r in [hole,hole+.011] for a in [a0,a1] for dy in [-.005,.005]]
            piece(vv,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)])
    # A real opposed thumb makes left/right chirality visible at the grip.
    piece(*cube_data((-.010,.025,.016),(.027,.012,.013)))
    piece(*cube_data((.005,.019,.011),(.014,.014,.013)))
    if tag=='L':verts=[(v[0],v[1],-v[2]) for v in verts];faces=[tuple(reversed(f)) for f in faces]
    o=mesh('Closed_gripping_hand_'+tag,verts,faces,mat,parent,'add:hand'+tag)
    setm(o,Matrix.Translation(Vector(target))@q.to_matrix().to_4x4())
    return o

def segment(o,start,end,radius=.022):
    # Mesh unit cylinder along local -Y, scaled by the actual segment length.
    d=Vector(end)-Vector(start);q=Vector((0,-1,0)).rotation_difference(d.normalized())
    vv=[]
    for y,r in [(0,radius),(-1,radius*.8)]:
        vv.extend((r*math.cos(i*math.tau/8),y,r*math.sin(i*math.tau/8)) for i in range(8))
    ff=[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
    data=bpy.data.meshes.new(o.name+'_articulated');data.from_pydata([C.to_3x3()@Vector(v) for v in vv],[],ff);data.update()
    for m in o.data.materials:data.materials.append(m)
    old=o.data;o.data=data
    if old.users==0 and ('articulated' in old.name):bpy.data.meshes.remove(old)
    setm(o,Matrix.Translation(Vector(start))@q.to_matrix().to_4x4()@Matrix.Diagonal((1,d.length,1,1)))

def arm(nodes,label,shoulder,target,axis,skin,hint=None,hole=None,straight=False):
    pivot=nodes['n17' if label=='L' else 'n20'];upper=nodes['n18' if label=='L' else 'n21']
    setm(pivot,Matrix.Translation(Vector(shoulder)))
    dest=Vector(target)-Vector(shoulder);direction=dest.normalized();length=max(.105,dest.length*(.505 if straight else .53))
    a=dest.length/2;h=math.sqrt(max(0,length*length-a*a))
    hint=Vector(hint or (-.6,-.4,1 if label=='L' else -1));hint=(hint-direction*hint.dot(direction)).normalized()
    elbow=direction*a+hint*h
    segment(upper,(0,0,0),elbow)
    fore=added_by_id('add:forearm'+label) or mesh('Forearm_'+label,[],[],skin,pivot,'add:forearm'+label);segment(fore,elbow,dest,.019)
    sleeve=added_by_id('add:sleeve'+label) or mesh('Short_blue_sleeve_'+label,[],[],nodes['n3'].data.materials[0],pivot,'add:sleeve'+label)
    segment(sleeve,-elbow.normalized()*.010,elbow.normalized()*.040,.027)
    return hand(pivot,dest,axis,skin,label,hole,wrist=dest-elbow)

def rod(o,start,end,radius,mat):
    d=Vector(end)-Vector(start);q=Vector((0,1,0)).rotation_difference(d.normalized())
    if not o.get('candidateRod'):
        vv=[(radius*math.cos(i*math.tau/8),y,radius*math.sin(i*math.tau/8)) for y in [-.5,.5] for i in range(8)]
        ff=[tuple(range(7,-1,-1)),tuple(range(8,16))]+[(i,(i+1)%8,(i+1)%8+8,i+8) for i in range(8)]
        temp=mesh('Correct_endpoint_rod',vv,ff,mat,o.parent,'add:temp');o.data=temp.data;bpy.data.objects.remove(temp,do_unlink=True);o['candidateRod']=True
    setm(o,Matrix.Translation((Vector(start)+Vector(end))*.5)@q.to_matrix().to_4x4()@Matrix.Diagonal((1,d.length,1,1)))

def curved_limb(o,sign,mat):
    vv=[];centers=[(0,.023),(.012,.080),(.027,.16),(.022,.235),(0,.29)]
    for j,(x,y) in enumerate(centers):
        radius=.011*(1-j*.12)
        vv.extend((x+radius*math.cos(i*math.tau/8),sign*y,radius*.75*math.sin(i*math.tau/8)) for i in range(8))
    ff=[tuple(range(7,-1,-1)),tuple(range(32,40))]+[(j*8+i,j*8+(i+1)%8,(j+1)*8+(i+1)%8,(j+1)*8+i) for j in range(4) for i in range(8)]
    temp=mesh('Curved_longbow_limb',vv,ff,mat,o.parent,'add:temp');o.data=temp.data;setm(o,Matrix.Identity(4));bpy.data.objects.remove(temp,do_unlink=True)

def arrow_visible(nodes,visible):
    for key in ['n67','n68','n70','n72']:
        o=nodes[key];o.hide_render=False;o.hide_set(False);o.hide_viewport=False
        if 'candidateHidden' in o:del o['candidateHidden']
    nodes['n67']['dynamicVisible']=visible

def setup_archer(nodes,skin,bronze):
    wood=nodes['n54'].data.materials[0];stringmat=material('Taut flax bowstring',(.045,.034,.025))
    curved_limb(nodes['n54'],1,wood);curved_limb(nodes['n59'],-1,wood)
    setm(nodes['n56'],Matrix.Translation((0,.29,0)))
    setm(nodes['n61'],Matrix.Translation((0,-.29,0)))
    nock=bpy.data.objects.new('String_nock_anchor',None);bpy.context.scene.collection.objects.link(nock);nock.parent=nodes['n50'];nock['roman_family_added_id']='add:string-nock'
    setm(nodes['n74'],Matrix.Translation((-.062,.20,-.025))@Matrix.Rotation(-.18,4,'X')@Matrix.Rotation(-.12,4,'Z'))
    # Real open quiver with three shafts inside its mouth, instead of the source's offset floating bundle.
    vv=[]
    for y,radius in [(-.078,.030),(.078,.032),(.078,.027),(-.074,.025)]:
        vv.extend((radius*math.cos(i*math.tau/10),y,radius*math.sin(i*math.tau/10)) for i in range(10))
    ff=[tuple(range(9,-1,-1)),tuple(range(30,40))]
    for ring,next_ring in [(0,1),(1,2),(2,3)]:
        ff.extend((ring*10+i,ring*10+(i+1)%10,next_ring*10+(i+1)%10,next_ring*10+i) for i in range(10))
    temp=mesh('Open_back_quiver',vv,ff,nodes['n75'].data.materials[0],nodes['n74'],'add:temp');nodes['n75'].data=temp.data;bpy.data.objects.remove(temp,do_unlink=True);setm(nodes['n75'],Matrix.Identity(4))
    for j,(shaft_id,feather_id) in enumerate([('n77','n79'),('n81','n83'),('n85','n87')]):
        x=(j-1)*.012;z=(j-1)*.004
        setm(nodes[shaft_id],Matrix.Translation((x,.07,z)))
        setm(nodes[feather_id],Matrix.Translation((x,.148,z)))
    strapmat=material('Archer diagonal leather strap',(.12,.065,.035))
    # Front diagonal follows the surface of the new tunic; back section reaches the original quiver.
    strap=mesh('Diagonal_quiver_strap',[],[],strapmat,nodes['n2'],'add:quiver-strap-front')
    v=[]
    for x,y,z in [(.043,.145,.044),(.044,.11,.026),(.037,.065,-.015),(.035,.025,-.045)]:
        v.extend([(x-.003,y,z-.007),(x+.003,y,z-.007),(x-.003,y,z+.007),(x+.003,y,z+.007)])
    order=[0,1,3,2]
    f=[(0,1,3,2),(12,14,15,13)]+[(4*j+order[i],4*j+order[(i+1)%4],4*(j+1)+order[(i+1)%4],4*(j+1)+order[i]) for j in range(3) for i in range(4)]
    temp=mesh('Strap_ribbon',v,f,strapmat,nodes['n2'],'add:temp');strap.data=temp.data;bpy.data.objects.remove(temp,do_unlink=True)
    buckle=box('Quiver_strap_buckle',(.046,.105,.02),(.008,.023,.023),bronze,nodes['n2'],'add:quiver-buckle')
    for j,(start,end) in enumerate([((.035,.147,.044),(-.038,.147,.044)),((-.038,.147,.044),(-.050,.075,.008)),((-.050,.075,.008),(-.037,.024,-.040))]):
        o=mesh('Quiver_back_strap_'+str(j),[],[],strapmat,nodes['n2'],'add:quiver-back-strap-'+str(j));rod(o,start,end,.006,strapmat)
    # Three separate bent fingers hook the string; this is deliberately not a pole-gripping fist.
    verts=[];faces=[]
    def add(v,f):
        offset=len(verts);verts.extend(v);faces.extend(tuple(offset+i for i in face) for face in f)
    add(*cube_data((-.023,0,0),(.017,.044,.022)))
    for y in [-.014,0,.014]:
        path=[Vector((-.023,y,-.010)),Vector((-.009,y,-.010)),Vector((.003,y,-.004)),Vector((.002,y,.003))]
        for a,b in zip(path,path[1:]):
            vv,ff=cube_data((0,0,0),(.007,(b-a).length+.002,.007))
            q=Vector((0,1,0)).rotation_difference((b-a).normalized())
            add([q@Vector(p)+(a+b)*.5 for p in vv],ff)
    add(*cube_data((-.018,-.022,.010),(.022,.008,.009)))
    hook=mesh('Three_hooked_string_fingers',verts,faces,skin,nodes['n20'],'add:handR');hook['graspType']='three separated hooked fingers at nock'
    # Retain the original arrow feather node, with a narrow proportional feather profile.
    m=local(nodes['n72']);setm(nodes['n72'],m@Matrix.Diagonal((.62,.42,.50,1)))
    return nock,stringmat

def pose_archer(nodes,sample,skin,nock,stringmat):
    draw=max(0,min(1,sample['draw']));phase=sample['phase'];time=sample['phaseTime']
    sm={v['id']:Matrix([[v['matrix'][col*4+row] for col in range(4)] for row in range(4)]) for v in sample['transforms']}
    setm(nodes['n2'],sm['n2'])
    for key,side in [('n23',1),('n26',-1)]:
        # A stable shooting stance follows the authored hip bob/lean, keeping upper thighs inside lames.
        setm(nodes[key],sm['n2']@Matrix.Translation((side*.006,0,side*.031))@Matrix.Rotation(-side*.10,4,'X'))
    # A single lateral plane clears full-size headwear, chest and skirt, while the hands reach it.
    grip=Vector((.235,.317,-.079));setm(nodes['n50'],Matrix.Translation(grip))
    top=Matrix.Rotation(draw*.15,4,'Z');bottom=Matrix.Rotation(-draw*.15,4,'Z')
    setm(nodes['n53'],top);setm(nodes['n58'],bottom)
    pull=.027+.216*draw;nk=Vector((-pull,.025,0))
    setm(nock,Matrix.Translation(nk))
    a=top@Vector((0,.29,0));b=bottom@Vector((0,-.29,0))
    rod(nodes['n63'],a,nk,.0018,stringmat);rod(nodes['n65'],b,nk,.0018,stringmat)
    arrow=Matrix.Translation(grip+nk+Vector((.17,0,0)))
    visible=sample['contacts']['arrowVisible'];arrow_visible(nodes,visible)
    if not visible:arrow=arrow@Matrix.Diagonal((.000001,.000001,.000001,1))
    setm(nodes['n67'],arrow)
    right=grip+nk
    if phase in ('loose','follow','recover'):right=Vector((-.008-.035*min(time/.35,1),.342-.06*min(time/.35,1),-.079))
    elif phase=='reach':right=Vector((-.062,.35,-.025))
    arm(nodes,'L',sm['n2']@Vector((0,.135,.067)),grip,(0,1,0),skin,hint=(0,-1,-.4),hole=.014,straight=True)
    arm(nodes,'R',sm['n2']@Vector((-.012,.135,-.045)),right,(0,1,0),skin,hint=(-1,.15,0),hole=.004)
    return visible

def portable_pose(name,frame,extra=None):
    return {'name':name,'frame':frame,'transforms':{ident(o):flat(local(o)) for o in bpy.context.scene.objects if ident(o)},**(extra or {})}

def apply_portable(pose):
    byid={ident(o):o for o in bpy.context.scene.objects if ident(o)}
    for key,value in pose['transforms'].items():
        setm(byid[key],Matrix([[value[col*4+row] for col in range(4)] for row in range(4)]))
    bpy.context.view_layer.update()

def bake_poses(poses,preview):
    scene=bpy.context.scene;scene.render.fps=120;scene.frame_start=1;scene.frame_end=poses[-1]['frame']
    byid={ident(o):o for o in scene.objects if ident(o)}
    # Bone-free original hierarchy: transform keys on the same retained pivots and added segments.
    dynamic=[key for key in poses[0]['transforms'] if any(p['transforms'][key]!=poses[0]['transforms'][key] for p in poses[1:])]
    for pose in poses:
        for key in dynamic:
            o=byid[key];value=pose['transforms'][key];m=C@Matrix([[value[col*4+row] for col in range(4)] for row in range(4)])@CI
            o.rotation_mode='QUATERNION';o.matrix_basis=m
            for data_path in ['location','rotation_quaternion','scale']:o.keyframe_insert(data_path=data_path,frame=pose['frame'],group='Candidate '+key)
    for key in dynamic:
        action=byid[key].animation_data.action
        curves=getattr(action,'fcurves',None)
        if curves is None:curves=[curve for layer in action.layers for strip in layer.strips for bag in strip.channelbags for curve in bag.fcurves]
        for curve in curves:
            for point in curve.keyframe_points:point.interpolation='CONSTANT' if key=='n67' and curve.data_path=='scale' else 'LINEAR'
    scene.frame_set(preview['frame']);apply_portable(preview)

def sculpt_tunic(nodes):
    # Faceted short-sleeved cuirass/tunic silhouette: broad chest, shoulder slope and fitted waist.
    profiles=[(.021,.032,.050),(.078,.037,.059),(.135,.040,.071),(.160,.023,.029)]
    outline=[(1,0),(.80,.65),(.5,1),(-.8,1),(-1,.4),(-1,-.4),(-.8,-1),(.5,-1),(.80,-.65)]
    stagger=[-.013,.012,.006,-.007,.009,-.011,.005,-.008,.011]
    vertices=[]
    for row,(y,depth,width) in enumerate(profiles):
        for i,(x,z) in enumerate(outline):
            yy=y+(stagger[i] if row==1 else (-.016 if row==3 and i==0 else 0))
            if row==2 and i in (0,1,8):yy-=.008
            vertices.append((x*depth,yy,z*width))
    faces=[tuple(range(8,-1,-1))]
    for j in range(3):
        for i in range(9):
            a=j*9+i;b=j*9+(i+1)%9;c=(j+1)*9+(i+1)%9;d=(j+1)*9+i
            if (j+i)%3==0:faces.extend([(a,b,d),(b,c,d)])
            else:faces.append((a,b,c,d))
    # Open shallow V collar: inner rim gives cloth thickness without covering the neck.
    vertices.extend((x*.85,y-.004,z*.85) for x,y,z in vertices[27:36])
    faces.extend((27+i,27+(i+1)%9,36+(i+1)%9,36+i) for i in range(9))
    temp=mesh('Sculpted_blue_tunic',vertices,faces,nodes['n3'].data.materials[0],nodes['n2'],'add:temp')
    nodes['n3'].data=temp.data;setm(nodes['n3'],Matrix.Identity(4));bpy.data.objects.remove(temp,do_unlink=True)

def refine_helmet(helmet):
    """Preserve v3 calotte/socket/studs; replace the box brow, cheek and rear plates."""
    points=[CI.to_3x3()@v.co for v in helmet.data.vertices]
    vertices=[];faces=[];mapping={}
    sets=[(.2075,.2225),(.210,.207,.159,.156),(.163,.213)]
    for poly in helmet.data.polygons:
        pp=[points[i] for i in poly.vertices]
        removed=any(all(any(abs(p.y-y)<1e-5 for y in group) for p in pp) for group in sets)
        if removed:continue
        face=[]
        for i in poly.vertices:
            if i not in mapping:mapping[i]=len(vertices);vertices.append(tuple(points[i]))
            face.append(mapping[i])
        faces.append(tuple(face))
    def add(v,f):
        off=len(vertices);vertices.extend(v);faces.extend(tuple(off+i for i in face) for face in f)
    # Forehead band follows the bowl ellipse instead of a straight protruding crossbar.
    v=[];zs=[-.051,-.026,0,.026,.051]
    for z in zs:
        x=.040*math.sqrt(max(0,1-(z/.058)**2))+.003
        v.extend([(x-.006,.212,z),(x,.212,z),(x-.006,.221,z),(x,.221,z)])
    order=[0,1,3,2];f=[(0,2,3,1),(16,17,19,18)]
    f.extend((j*4+order[i],j*4+order[(i+1)%4],(j+1)*4+order[(i+1)%4],(j+1)*4+order[i]) for j in range(4) for i in range(4));add(v,f)
    for sign in [-1,1]:
        profile=[(-.012,.211),(.031,.210),(.026,.158),(-.009,.163)]
        v=[(x,y,sign*z) for z in [.043,.048] for x,y in profile]
        add(v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    # Short central nasal tab, with a narrower lower end and a visible face opening either side.
    v=[(x,y,z) for x in [.042,.048] for y,z in [(.214,-.009),(.214,.009),(.187,.005),(.187,-.005)]]
    add(v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)])
    # Three curved rear panels flare only at the lower edge and taper along the neck.
    v=[]
    for z in [-.043,-.014,.014,.043]:
        topx=-.038*math.sqrt(max(0,1-(z/.06)**2))-.002
        lowerz=z*.83;lowerx=-.051*math.sqrt(max(0,1-(lowerz/.051)**2))
        v.extend([(topx,.212,z),(topx-.005,.212,z),(lowerx,.160,lowerz),(lowerx-.005,.160,lowerz)])
    f=[(0,1,3,2),(12,14,15,13)]
    f.extend((j*4+order[i],j*4+order[(i+1)%4],(j+1)*4+order[(i+1)%4],(j+1)*4+order[i]) for j in range(3) for i in range(4));add(v,f)
    temp=mesh('Fitted_galea_with_nasal',vertices,faces,helmet.data.materials[0],helmet.parent,'add:temp');helmet.data=temp.data;bpy.data.objects.remove(temp,do_unlink=True)
    helmet['candidateRefinement']='v3 bowl/socket/studs retained; curved brow, tapered cheek guards, nasal tab, curved nape'

def sculpt_face(nodes):
    """Warm low-poly human head: forehead, cheek planes, narrow jaw and a small nasal bridge."""
    verts=[];faces=[]
    profiles=[(.142,.022,.013,.016),(.157,.031,.025,.027),(.181,.033,.031,.038),(.203,.032,.031,.037),(.228,.027,.027,.030),(.240,.015,.018,.019)]
    outline=[(1,0),(.9,.55),(.35,1),(-.6,.9),(-1,.4),(-1,-.4),(-.6,-.9),(.35,-1),(.9,-.55)]
    for y,front,back,width in profiles:
        verts.extend((x*(front if x>=0 else back),y,z*width) for x,z in outline)
    faces.extend([tuple(range(8,-1,-1)),tuple(range(45,54))])
    for j in range(5):
        for i in range(9):
            a=j*9+i;b=j*9+(i+1)%9;c=(j+1)*9+(i+1)%9;d=(j+1)*9+i
            faces.append((a,b,c,d))
    def add(v,f):
        offset=len(verts);verts.extend(v);faces.extend(tuple(offset+i for i in face) for face in f)
    add([(.031,.203,-.007),(.031,.203,.007),(.048,.181,0),(.034,.173,-.007),(.034,.173,.007)],[(0,1,2),(0,2,3),(1,4,2),(3,2,4),(0,3,4,1)])
    for sign in [-1,1]:
        add([(-.006,.201,sign*.039),(.006,.195,sign*.043),(.005,.178,sign*.043),(-.007,.174,sign*.037),(-.011,.188,sign*.038)],[(0,1,2,3,4)])
    skin=nodes['n7'].data.materials[0]
    temp=mesh('Faceted_human_face',verts,faces,skin,nodes['n2'],'add:temp');nodes['n7'].data=temp.data;setm(nodes['n7'],Matrix.Identity(4));bpy.data.objects.remove(temp,do_unlink=True)
    nodes['n7']['candidateRefinement']='retained n7 identity; human forehead/cheek/jaw/nose/ear planes fitted inside galea'

def studio():
    s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24
    s.render.resolution_x=900;s.render.resolution_y=1000;s.render.resolution_percentage=100
    s.world=bpy.data.worlds.new('Candidate studio');s.world.use_nodes=True
    s.world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.39,.45,1)
    s.world.node_tree.nodes['Background'].inputs[1].default_value=.65
    s.view_settings.view_transform='AgX'
    cam=bpy.data.objects.new('Review Camera',bpy.data.cameras.new('Review Camera'));s.collection.objects.link(cam);s.camera=cam
    cam.data.type='ORTHO';cam.data.ortho_scale=1.5
    for name,loc,power,size in [('Key',(2,-3,4),200,4),('Fill',(-2,-1,2),80,3),('Rim',(0,3,3),140,2)]:
        o=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));s.collection.objects.link(o);o.location=loc;o.data.energy=power;o.data.size=size
        o.rotation_euler=(Vector((0,0,.5))-o.location).to_track_quat('-Z','Y').to_euler()
    return cam

def render(cam,path,view,focus=None):
    if SKIP_RENDER:return
    bpy.context.view_layer.update()
    points=[o.matrix_world@v.co for o in bpy.context.scene.objects if ident(o) and o.type=='MESH' and not o.hide_render and not o.get('candidateHidden') and (not focus or ident(o) in focus) for v in o.data.vertices]
    lo=Vector(tuple(min(p[k] for p in points) for k in range(3)));hi=Vector(tuple(max(p[k] for p in points) for k in range(3)))
    target=(lo+hi)*.5
    direction=Vector({'three-quarter':(2.7,-3.2,1.5),'front':(3,0,.2),'back':(-2.7,2.5,1.3),'side':(0,-3,.25),'opposite-side':(0,3,.25),'top':(.001,0,4)}[view]).normalized()
    cam.location=target+direction*4
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update();inv=cam.matrix_world.inverted();projected=[inv@p for p in points]
    xs=[p.x for p in projected];ys=[p.y for p in projected]
    offset=cam.rotation_euler.to_matrix()@Vector(((max(xs)+min(xs))/2,(max(ys)+min(ys))/2,0));cam.location+=offset
    scene=bpy.context.scene;cam.data.ortho_scale=max(max(ys)-min(ys),(max(xs)-min(xs))*scene.render.resolution_y/scene.render.resolution_x)*1.12
    bpy.context.scene.render.filepath=str(path);bpy.ops.render.render(write_still=True)

def archive_hidden_glb(path):
    raw=path.read_bytes();length,typ=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+length]);tail=raw[20+length:]
    for n in doc.get('nodes',[]):
        if n.get('extras',{}).get('candidateHidden') and 'mesh' in n:
            n['extras']['archivedHiddenMeshIndex']=n.pop('mesh')
    data=json.dumps(doc,separators=(',',':')).encode();data+=b' '*((-len(data))%4)
    path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(data)+len(tail))+struct.pack('<II',len(data),typ)+data+tail)

def build(role,side):
    OUT.mkdir(parents=True,exist_ok=True);EVIDENCE.mkdir(parents=True,exist_ok=True)
    asset=f'romanSoldier_{role}_{side}';ev=EVIDENCE/asset;ev.mkdir(exist_ok=True)
    source=BASE/f'assets/models/originals/supplemental/blender-r3/{asset}.blend';sha=hashlib.sha256(source.read_bytes()).hexdigest()
    bpy.ops.wm.open_mainfile(filepath=str(source))
    nodes={o['three_node_id']:o for o in bpy.context.scene.objects if 'three_node_id' in o}
    original=[{'id':i,'parentId':o.parent.get('three_node_id') if o.parent else None} for i,o in nodes.items()]
    for o in nodes.values():
        if o.hide_render:o['candidateHidden']=True
        if o.type=='MESH':
            for m in o.data.materials:
                if not m:continue
                col=tuple(m.diffuse_color);m.use_nodes=True;m.node_tree.nodes.clear()
                p=m.node_tree.nodes.new('ShaderNodeBsdfPrincipled');p.inputs['Base Color'].default_value=col;p.inputs['Roughness'].default_value=.8
                output=m.node_tree.nodes.new('ShaderNodeOutputMaterial');m.node_tree.links.new(p.outputs['BSDF'],output.inputs['Surface'])
    samples=json.loads((BASE/'artifacts/pipeline/roman-family-blender-validation/source-poses.json').read_text())['longbowSamples']
    hold_index=next(i for i,s in enumerate(samples) if s['phase']=='hold')
    cam=studio()
    if role=='longbow':
        saved_basis={key:o.matrix_basis.copy() for key,o in nodes.items()}
        for record in samples[hold_index]['transforms']:
            value=record['matrix'];setm(nodes[record['id']],Matrix([[value[col*4+row] for col in range(4)] for row in range(4)]))
        for key in ['n67','n68','n70','n72']:nodes[key].hide_render=False
        render(cam,ev/'before-three-quarter.png','three-quarter')
        for key,value in saved_basis.items():nodes[key].matrix_basis=value
    else:render(cam,ev/'before-three-quarter.png','three-quarter')
    armor=append_glb(BASE/'godot/assets/art-pilots/roman-armor-v3-direction.glb',nodes['n2'],'armor')
    hidden(nodes['n5']);hidden(nodes['n9'])
    # Align the retained broad torso/head axes and left/right stance to +X facing.
    # Only candidate transforms change; original IDs, parent links and archives survive.
    for key in ['n3','n7']:
        m=local(nodes[key]);position=m.translation.copy();m.translation=(0,0,0)
        setm(nodes[key],Matrix.Translation(position)@Matrix.Rotation(math.pi/2,4,'Y')@m)
    for o in armor:
        o.data=o.data.copy()
        for vertex in o.data.vertices:
            p=CI.to_3x3()@vertex.co
            if not o.name.startswith('Helmet') or p.y<.1:
                p=Matrix.Rotation(math.pi/2,3,'Y')@p
            elif abs(abs(p.z)-.043)<1e-5 and (abs(p.y-.175)<1e-5 or abs(p.y-.213)<1e-5) and -.044<p.x<-.032:
                # Replace the vertical rear rectangle with a tapered, sloping nape flange.
                if p.y<.19:p.y=.163;p.x-=.010;p.z*=.84
            vertex.co=C.to_3x3()@p
        o.data.update()
    if REFINE_HELMET:refine_helmet(next(o for o in armor if o.name.startswith('Helmet')))
    setm(nodes['n23'],Matrix.Translation((.006,.17,.031))@Matrix.Rotation(-.10,4,'X'))
    setm(nodes['n26'],Matrix.Translation((-.006,.17,-.031))@Matrix.Rotation(.10,4,'X'))
    sculpt_tunic(nodes)
    if REFINE_FACE:sculpt_face(nodes)
    for key in ['n11','n13','n15']:
        # Source fan already lies in XY, along the actual +X nose-to-nape axis.
        m=Matrix.Translation((0,-.018,0))@local(nodes[key]);setm(nodes[key],m)
    skin=nodes['n18'].data.materials[0];bronze=material('Candidate bronze',(.53,.27,.075),.4)
    # The actual figure remains at its original root; all grips are in figure-local coordinates.
    setm(nodes['n2'],Matrix.Translation((0,.17,0)))
    if role!='longbow':
        left=Vector((.075,.235,.13));shieldrot=Matrix.Rotation(-.45,4,'Y')
        setm(nodes['n32'],Matrix.Translation(left-shieldrot.to_3x3()@Vector((-.055,0,0)))@shieldrot)
        append_glb(BASE/'godot/assets/art-pilots/roman-shield-handle-v1.glb',nodes['n32'],'shield-handle')
        arm(nodes,'L',(0,.305,.067),left,(0,1,0),skin,hint=(.25,-1,-.2))
    if role=='gladius':
        right=Vector((.115,.19,-.08));axis=Vector((.90,-.42,-.08)).normalized()
        rot=Vector((0,1,0)).rotation_difference(axis).to_matrix().to_4x4()
        setm(nodes['n50'],Matrix.Translation(right-axis*.04)@rot)
        arm(nodes,'R',(0,.305,-.067),right,axis,skin)
        # Replace the box tip by an actual pointed, double-bevel short sword while retaining node n53.
        v=[(-.016,-.1,0),(0,-.1,.006),(.016,-.1,0),(0,-.1,-.006),(-.014,.065,0),(0,.065,.004),(.014,.065,0),(0,.065,-.004),(0,.115,0)]
        f=[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,8),(5,6,8),(6,7,8),(7,4,8),(3,2,1,0)]
        temp=mesh('Pointed_gladius',v,f,bronze,nodes['n50'],'add:temp');nodes['n53'].data=temp.data;bpy.data.objects.remove(temp,do_unlink=True)
        box('Sword_guard',(0,.081,0),(.062,.013,.022),bronze,nodes['n50'],'add:sword-guard')
        box('Sword_pommel',(0,0,0),(.027,.018,.024),bronze,nodes['n50'],'add:sword-pommel')
        poses=[portable_pose('ready',1)]
        for name,frame,point,direction in [('guard',25,(.03,.34,-.09),(-.2,.98,0)),('strike',49,(.18,.28,-.08),(.99,.10,-.02))]:
            axis=Vector(direction).normalized();point=Vector(point)
            setm(nodes['n50'],Matrix.Translation(point-axis*.04)@Vector((0,1,0)).rotation_difference(axis).to_matrix().to_4x4())
            arm(nodes,'R',(0,.305,-.067),point,axis,skin)
            poses.append(portable_pose(name,frame))
        restore={**poses[0],'frame':73,'name':'recover'};poses.append(restore);bake_poses(poses,poses[0])
    elif role=='spear':
        right=Vector((.10,.26,-.10));axis=Vector((.06,.998,-.01)).normalized()
        rot=Vector((0,1,0)).rotation_difference(axis).to_matrix().to_4x4()
        setm(nodes['n41'],Matrix.Translation(right)@rot)
        arm(nodes,'R',(0,.305,-.067),right,axis,skin,hole=.011)
        shaft=local(nodes['n42']);setm(nodes['n42'],shaft@Matrix.Diagonal((.68,1,.68,1)))
        leather=material('Spear leather grip',(.16,.075,.035))
        wrap=mesh('Spear_grip_wrap',[],[],leather,nodes['n41'],'add:spear-grip-wrap')
        rod(wrap,(0,-.035,0),(0,.035,0),.0105,leather)
        v=[(0,-.085,0),(-.027,-.020,0),(0,-.020,.009),(.027,-.020,0),(0,-.020,-.009),(0,.085,0)]
        f=[(0,1,2),(0,2,3),(0,3,4),(0,4,1),(1,5,2),(2,5,3),(3,5,4),(4,5,1)]
        temp=mesh('Leaf_spearhead',v,f,bronze,nodes['n41'],'add:temp');nodes['n48'].data=temp.data;bpy.data.objects.remove(temp,do_unlink=True)
        poses=[portable_pose('ready',1)]
        for frame,amount in [(25,.5),(49,1),(73,.5),(97,0)]:
            direction=Vector((.06+.94*amount,.998*(1-amount)+.04*amount,-.01)).normalized()
            point=right+Vector((.065*amount,.01*amount,0))
            setm(nodes['n41'],Matrix.Translation(point)@Vector((0,1,0)).rotation_difference(direction).to_matrix().to_4x4())
            arm(nodes,'R',(0,.305,-.067),point,direction,skin,hole=.011)
            poses.append(portable_pose('thrust' if amount==1 else 'ready_to_thrust',frame))
        bake_poses(poses,poses[0]);cam.data.ortho_scale=2.1;cam['reviewTargetZ']=.85
    elif role=='longbow':
        nock,stringmat=setup_archer(nodes,skin,bronze);poses=[]
        for i,sample in enumerate(samples):
            visible=pose_archer(nodes,sample,skin,nock,stringmat)
            poses.append(portable_pose(sample['phase'],i+1,{'sourceIndex':i,'phase':sample['phase'],'released':sample['released'],'arrowVisible':visible}))
        preview=poses[hold_index];apply_portable(preview);cam.data.ortho_scale=1.65
        bake_poses(poses,preview)
    else:raise ValueError(role)
    for view in ['three-quarter','front','back','side','opposite-side','top']:render(cam,ev/f'after-{view}.png',view)
    for view in ['three-quarter','side']:
        render(cam,ev/f'left-arm-{view}.png',view,focus=['n18','add:forearmL','add:sleeveL','add:handL'])
    if role=='longbow':
        chosen={}
        for p in poses:
            if p['phase'] not in chosen:chosen[p['phase']]=p
        for phase,p in chosen.items():
            bpy.context.scene.frame_set(p['frame']);apply_portable(p);render(cam,ev/f'phase-{phase}.png','three-quarter')
        bpy.context.scene.frame_set(preview['frame']);apply_portable(preview)
    elif role in ('gladius','spear'):
        p=poses[2];bpy.context.scene.frame_set(p['frame']);apply_portable(p);render(cam,ev/f'after-{p["name"]}.png','three-quarter')
        bpy.context.scene.frame_set(poses[0]['frame']);apply_portable(poses[0])
    nodes['n0']['candidateVersion']='roman-family-v1-review';nodes['n0']['sourceSha256']=sha
    bpy.context.view_layer.update()
    added=[o for o in bpy.context.scene.objects if 'roman_family_added_id' in o]
    assembly={'asset':asset,'status':'visual_review_candidate','source':{'blend':str(source.relative_to(BASE)),'sha256':sha},'coordinateContract':{'up':'+Y','forward':'+X','matrices':'column-major local Three coordinates'},'originalNodes':original,'addedNodes':[{'id':ident(o),'parentId':ident(o.parent) if o.parent else None,'name':o.name} for o in added], 'anchors':{'handL':{'nodeId':'add:handL','point':[0,0,0]},'handR':{'nodeId':'add:handR','point':[0,0,0]},'shieldGrip':{'nodeId':'n32','point':[-.055,0,0]},'weaponGrip':{'nodeId':'n50','point':[0,.04,0]}},'preview':{'name':'ready','frame':1},'poseFrames':[{'name':'ready','frame':1,'transforms':{ident(o):flat(local(o)) for o in list(nodes.values())+added}}],'limitations':['First complete gladius candidate; pending independent visual and contact review.','No all-pose leg/skirt intersection certification.']}
    helmet=next(o for o in armor if o.name.startswith('Helmet'))
    upper=[CI.to_3x3()@v.co for v in helmet.data.vertices if v.co.z>.15]
    extrema=[max(p.x for p in upper),min(p.x for p in upper)]
    centers=[sum((p for p in upper if abs(p.x-x)<1e-5),Vector())/sum(abs(p.x-x)<1e-5 for p in upper) for x in extrema]
    for key,point in zip(['helmetFront','helmetRear'],centers):
        assembly['anchors'][key]={'nodeId':ident(helmet),'point':list(point)}
    assembly['headwearDirection']={'frontAxis':'+X','crestPlane':'XY','crestThinAxis':'Z','sourceCrestRotationY':0,'crestOffsetY':-.018,'helmetAnchorStatus':'actual upper helmet mesh vertices'}
    reference=BASE/'assets/concepts'/({'gladius':'roman-soldier-target-v2.png','spear':'roman-spearman-target-v1.png','longbow':'roman-archer-target-v1.png'}[role])
    assembly['reference']={'path':str(reference.relative_to(BASE)),'sha256':hashlib.sha256(reference.read_bytes()).hexdigest()}
    assembly['source']['snapshot']=f'assets/models/originals/supplemental/{asset}.source.json'
    assembly['headwearDirection']['refinedHelmet']=REFINE_HELMET
    assembly['headwearDirection']['refinedFace']=REFINE_FACE
    assembly['reviewLighting']={'engine':'Cycles','samples':24,'viewTransform':'AgX','materials':'original body/crest/skin color values retained; added blade uses authored bronze','camera':'orthographic fixed angle by view; scale/center fitted to actual visible geometry including weapon'}
    assembly['poseFrames']=poses
    assembly['limitations']=['Candidate pending independent geometry/visual acceptance.','GLB is the complete static review pose; Blender timeline and portable matrices provide authored motion for review, not automatic runtime acceptance.']
    if role=='spear':
        assembly['anchors']['weaponGrip']={'nodeId':'n41','point':[0,0,0]}
        assembly['spearGripStatus']='New actual leather wrap and closed hand centered on shaft at local Y=0; not inherited source floating position.'
    elif role=='longbow':
        assembly['anchors'].update(weaponGrip={'nodeId':'n50','point':[0,0,0]},bowTipTop={'nodeId':'n53','point':[0,.29,0]},bowTipBottom={'nodeId':'n58','point':[0,-.29,0]},nock={'nodeId':'add:string-nock','point':[0,0,0]},arrowNock={'nodeId':'n67','point':[-.17,0,0]})
        del assembly['anchors']['shieldGrip']
        assembly['preview']={'name':'hold','frame':hold_index+1,'sourceIndex':hold_index}
        assembly['bowConstruction']={'planeFigureZ':-.079,'limbTipLength':.29,'stringRadius':.0018,'endpoints':'actual transformed limb tip to nock, quaternion +Y to segment','sourceEvents':'480 samples at 120Hz, same phase/released/visibility events','sourceStringMatricesReused':False,'stance':'stable lateral shooting stance follows source hip bob/lean; source leg flourish is not copied','rightHand':'three hooked fingers, full-draw nock figure (-.008,.342,-.079)'}
    (OUT/f'{asset}.assembly.json').write_text(json.dumps(assembly,indent=2))
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{asset}.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    # Include hidden original archives in the binary, then disable their mesh instantiation explicitly.
    for o in list(nodes.values())+added:o.hide_set(False);o.hide_viewport=False;o.select_set(True)
    bpy.context.view_layer.objects.active=nodes['n0']
    path=OUT/f'{asset}.glb';bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_current_frame=True)
    archive_hidden_glb(path)
    assert hashlib.sha256(source.read_bytes()).hexdigest()==sha
    (ev/'build-report.json').write_text(json.dumps({'asset':asset,'originalNodeCount':len(nodes),'addedNodes':len(added),'sourceUnchanged':True,'blend':str(OUT/f'{asset}.blend'),'glb':str(path),'status':'pending_visual_review'},indent=2))
    print('CANDIDATE_READY',asset,flush=True)

def overview():
    """A display-only assembly. No gallery transform is exported into any actor GLB."""
    bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
    display=[]
    for index,(role,side) in enumerate((r,s) for r in ['gladius','spear','longbow'] for s in ['blue','red']):
        asset=f'romanSoldier_{role}_{side}';path=OUT/f'{asset}.blend'
        if not path.is_file():raise FileNotFoundError(path)
        collection=bpy.data.collections.new(asset+' — candidate');scene.collection.children.link(collection)
        with bpy.data.libraries.load(str(path),link=False) as (source,target):target.objects=list(source.objects)
        objects=[o for o in target.objects if o and ident(o)]
        for o in target.objects:
            if o and o not in objects:bpy.data.objects.remove(o,do_unlink=True)
        wrapper=bpy.data.objects.new('DISPLAY_ONLY_'+asset,None);collection.objects.link(wrapper)
        wrapper.location=(0,(index//2-1)*2.2,2.05 if side=='blue' else 0);wrapper['displayOnly']=True;wrapper['exportedActorRootRemainsIdentity']=True
        for o in objects:
            basis=o.matrix_basis.copy();o.animation_data_clear();o.matrix_basis=basis;collection.objects.link(o)
            if o.get('three_node_id')=='n0':o.parent=wrapper
        textdata=bpy.data.curves.new('Label_'+asset,'FONT');textdata.body=role.upper()+' / '+side.upper();textdata.size=.11;textdata.align_x='CENTER'
        label=bpy.data.objects.new('Label_'+asset,textdata);collection.objects.link(label)
        label.location=(.10,wrapper.location.y,wrapper.location.z-.10)
        textdata.materials.append(material('Readable gallery label',(.035,.060,.080)))
        label.rotation_euler=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_euler()
        display.append({'asset':asset,'wrapperTranslationBlender':list(wrapper.location),'gameRootTransformUnmodified':True,'glbSha256':hashlib.sha256((OUT/f'{asset}.glb').read_bytes()).hexdigest()})
    refs=bpy.data.collections.new('REFERENCES — three user target sheets');scene.collection.children.link(refs)
    for index,(role,name) in enumerate([('gladius','roman-soldier-target-v2.png'),('spear','roman-spearman-target-v1.png'),('longbow','roman-archer-target-v1.png')]):
        img=bpy.data.images.load(str(BASE/'assets/concepts'/name),check_existing=True);img.pack()
        empty=bpy.data.objects.new('TARGET_'+role,None);refs.objects.link(empty);empty.empty_display_type='IMAGE';empty.data=img;empty.empty_display_size=3.2
        empty.location=(-.7,(index-1)*2.2,4.5);empty.empty_display_size=2.1;empty.rotation_euler=Matrix(((0,0,1),(1,0,0),(0,1,0))).to_euler();empty['referenceOnly']=True
    cam=studio();scene.render.resolution_x=1900;scene.render.resolution_y=1200
    cam.location=(9,-5,3);target=Vector((0,0,1.85));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=7.5
    scene.render.filepath=str(EVIDENCE/'roman-family-v1-overview.png');bpy.ops.render.render(write_still=True)
    scene['status']='Six complete Blender review candidates, not runtime approval'
    path=OUT/'roman-family-v1-overview.blend';bpy.ops.wm.save_as_mainfile(filepath=str(path))
    (EVIDENCE/'overview-report.json').write_text(json.dumps({'file':str(path.relative_to(BASE)),'display':display,'referenceSheets':3,'referenceImagesPacked':True,'individualGlbGalleryTransformsApplied':False},indent=2))
    print('OVERVIEW_READY',path,flush=True)

def export_saved(role,side):
    asset=f'romanSoldier_{role}_{side}';bpy.ops.wm.open_mainfile(filepath=str(OUT/f'{asset}.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    objects=[o for o in bpy.context.scene.objects if ident(o)]
    for o in objects:o.hide_set(False);o.hide_viewport=False;o.select_set(True)
    bpy.context.view_layer.objects.active=next(o for o in objects if o.get('three_node_id')=='n0')
    path=OUT/f'{asset}.glb'
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_current_frame=True)
    archive_hidden_glb(path)
    print('CURRENT_FRAME_GLB_EXPORTED',asset,bpy.context.scene.frame_current,flush=True)

def render_saved(role,side):
    """Read-only render pass, safe alongside independent validation of stable model files."""
    asset=f'romanSoldier_{role}_{side}';blend=OUT/f'{asset}.blend'
    bpy.ops.wm.open_mainfile(filepath=str(blend));assembly=json.loads((OUT/f'{asset}.assembly.json').read_text())
    ev=EVIDENCE/asset;cam=bpy.context.scene.camera;poses=assembly['poseFrames']
    preview=next(p for p in poses if p['frame']==assembly['preview']['frame'])
    bpy.context.scene.frame_set(preview['frame']);apply_portable(preview)
    for view in ['three-quarter','front','back','side','opposite-side','top']:render(cam,ev/f'after-{view}.png',view)
    for view in ['three-quarter','side']:render(cam,ev/f'left-arm-{view}.png',view,focus=['n18','add:forearmL','add:sleeveL','add:handL'])
    selected={}
    for p in poses:
        label=p.get('phase',p['name'])
        if label not in selected:selected[label]=p
    for label,p in selected.items():
        bpy.context.scene.frame_set(p['frame']);apply_portable(p)
        render(cam,ev/('phase-'+label+'.png' if role=='longbow' else 'after-'+label+'.png'),'three-quarter')
    (ev/'render-manifest.json').write_text(json.dumps({'asset':asset,'blendSha256':hashlib.sha256(blend.read_bytes()).hexdigest(),'assemblySha256':hashlib.sha256((OUT/f'{asset}.assembly.json').read_bytes()).hexdigest(),'inputModelModified':False,'images':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in ev.glob('*.png')}},indent=2))
    print('RENDER_ONLY_COMPLETE',asset,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--role',default='gladius');p.add_argument('--side',default='blue');p.add_argument('--skip-render',action='store_true');p.add_argument('--refine-helmet',action='store_true');p.add_argument('--refine-face',action='store_true');p.add_argument('--overview',action='store_true');p.add_argument('--export-saved',action='store_true');p.add_argument('--render-saved',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    SKIP_RENDER=a.skip_render
    REFINE_HELMET=a.refine_helmet
    REFINE_FACE=a.refine_face
    if a.overview:overview()
    elif a.export_saved:export_saved(a.role,a.side)
    elif a.render_saved:render_saved(a.role,a.side)
    else:build(a.role,a.side)
