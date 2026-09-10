"""Independent background Blender authoring; original archives are read-only."""
import argparse, bpy, hashlib, json, math, struct, sys
from pathlib import Path
from mathutils import Matrix, Vector

BASE=Path(__file__).resolve().parents[2]
OUT=BASE/'assets/models/optimized/roman-family-v1'
EVIDENCE=BASE/'artifacts/pipeline/roman-family-blender'
C=Matrix.Rotation(math.pi/2,4,'X'); CI=C.inverted()
SKIP_RENDER=False

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

def hand(parent,target,axis,mat,tag):
    # Closed faceted fingers curve around a real open cylindrical grip hole.
    verts=[];faces=[]
    def piece(v,f):
        offset=len(verts);verts.extend(v);faces.extend(tuple(i+offset for i in face) for face in f)
    hole=.009 if tag=='L' else .014
    piece(*cube_data((-(hole+.008),0,0),(.016,.052,.043)))
    for y in [-.018,-.006,.006,.018]:
        for i in range(7):
            a0=-2.25+i*4.5/7;a1=-2.25+(i+1)*4.5/7
            vv=[(r*math.cos(a),y+dy,r*math.sin(a)) for r in [hole,hole+.011] for a in [a0,a1] for dy in [-.005,.005]]
            piece(vv,[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)])
    o=mesh('Closed_gripping_hand_'+tag,verts,faces,mat,parent,'add:hand'+tag)
    q=Vector((0,1,0)).rotation_difference(Vector(axis).normalized())
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
    o.data=data
    setm(o,Matrix.Translation(Vector(start))@q.to_matrix().to_4x4()@Matrix.Diagonal((1,d.length,1,1)))

def arm(nodes,label,shoulder,target,axis,skin):
    pivot=nodes['n17' if label=='L' else 'n20'];upper=nodes['n18' if label=='L' else 'n21']
    setm(pivot,Matrix.Translation(Vector(shoulder)))
    dest=Vector(target)-Vector(shoulder);direction=dest.normalized();length=max(.105,dest.length*.53)
    a=dest.length/2;h=math.sqrt(max(0,length*length-a*a))
    hint=Vector((-.6,-.4,1 if label=='L' else -1));hint=(hint-direction*hint.dot(direction)).normalized()
    elbow=direction*a+hint*h
    segment(upper,(0,0,0),elbow)
    fore=mesh('Forearm_'+label,[],[],skin,pivot,'add:forearm'+label);segment(fore,elbow,dest,.019)
    sleeve=mesh('Short_blue_sleeve_'+label,[],[],nodes['n3'].data.materials[0],pivot,'add:sleeve'+label)
    segment(sleeve,(0,.004,0),elbow.normalized()*.042,.031)
    return hand(pivot,dest,axis,skin,label)

def sculpt_tunic(nodes):
    # Faceted short-sleeved cuirass/tunic silhouette: broad chest, shoulder slope and fitted waist.
    profiles=[(.021,.033,.050),(.066,.043,.062),(.112,.048,.074),(.140,.035,.071),(.160,.023,.030)]
    vertices=[]
    for row,(y,depth,width) in enumerate(profiles):
        vertices.extend((x*depth,y,z*width) for x,z in [(1,.55),(.62,1),(-.62,1),(-1,.55),(-1,-.55),(-.62,-1),(.62,-1),(1,-.55)])
    faces=[tuple(range(7,-1,-1)),tuple(range(32,40))]
    for j in range(4):
        for i in range(8):
            a=j*8+i;b=j*8+(i+1)%8;c=(j+1)*8+(i+1)%8;d=(j+1)*8+i
            if j in (1,2) and i in (0,2,4,6):faces.extend([(a,b,d),(b,c,d)])
            else:faces.append((a,b,c,d))
    temp=mesh('Sculpted_blue_tunic',vertices,faces,nodes['n3'].data.materials[0],nodes['n2'],'add:temp')
    nodes['n3'].data=temp.data;setm(nodes['n3'],Matrix.Identity(4));bpy.data.objects.remove(temp,do_unlink=True)

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

def render(cam,path,view):
    if SKIP_RENDER:return
    target=Vector((.08,0,.61));cam.location={'three-quarter':(2.7,-3.2,1.8),'front':(3,0,.9),'back':(-2.7,2.5,1.6),'side':(0,-3,1),'top':(0,0,4)}[view]
    cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler()
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
    cam=studio();render(cam,ev/'before-three-quarter.png','three-quarter')
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
    setm(nodes['n23'],Matrix.Translation((.006,.17,.039))@Matrix.Rotation(-.12,4,'X'))
    setm(nodes['n26'],Matrix.Translation((-.006,.17,-.039))@Matrix.Rotation(.12,4,'X'))
    sculpt_tunic(nodes)
    for key in ['n11','n13','n15']:
        # Source fan already lies in XY, along the actual +X nose-to-nape axis.
        m=Matrix.Translation((0,-.018,0))@local(nodes[key]);setm(nodes[key],m)
    skin=nodes['n18'].data.materials[0];bronze=material('Candidate bronze',(.53,.27,.075),.4)
    # The actual figure remains at its original root; all grips are in figure-local coordinates.
    setm(nodes['n2'],Matrix.Translation((0,.17,0)))
    left=Vector((.075,.235,.13));shieldrot=Matrix.Rotation(-.45,4,'Y')
    setm(nodes['n32'],Matrix.Translation(left-shieldrot.to_3x3()@Vector((-.055,0,0)))@shieldrot)
    append_glb(BASE/'godot/assets/art-pilots/roman-shield-handle-v1.glb',nodes['n32'],'shield-handle')
    arm(nodes,'L',(0,.305,.067),left,(0,1,0),skin)
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
    else:raise RuntimeError('Role authoring pending first gladius visual review')
    for view in ['three-quarter','front','back','side','top']:render(cam,ev/f'after-{view}.png',view)
    nodes['n0']['candidateVersion']='roman-family-v1-review';nodes['n0']['sourceSha256']=sha
    bpy.context.view_layer.update()
    added=[o for o in bpy.context.scene.objects if 'roman_family_added_id' in o]
    def ident(o):return o.get('three_node_id',o.get('roman_family_added_id'))
    assembly={'asset':asset,'status':'visual_review_candidate','source':{'blend':str(source.relative_to(BASE)),'sha256':sha},'coordinateContract':{'up':'+Y','forward':'+X','matrices':'column-major local Three coordinates'},'originalNodes':original,'addedNodes':[{'id':ident(o),'parentId':ident(o.parent) if o.parent else None,'name':o.name} for o in added], 'anchors':{'handL':{'nodeId':'add:handL','point':[0,0,0]},'handR':{'nodeId':'add:handR','point':[0,0,0]},'shieldGrip':{'nodeId':'n32','point':[-.055,0,0]},'weaponGrip':{'nodeId':'n50','point':[0,.04,0]}},'preview':{'name':'ready','frame':1},'poseFrames':[{'name':'ready','frame':1,'transforms':{ident(o):flat(local(o)) for o in list(nodes.values())+added}}],'limitations':['First complete gladius candidate; pending independent visual and contact review.','No all-pose leg/skirt intersection certification.']}
    helmet=next(o for o in armor if o.name.startswith('Helmet'))
    upper=[CI.to_3x3()@v.co for v in helmet.data.vertices if v.co.z>.15]
    extrema=[max(p.x for p in upper),min(p.x for p in upper)]
    centers=[sum((p for p in upper if abs(p.x-x)<1e-5),Vector())/sum(abs(p.x-x)<1e-5 for p in upper) for x in extrema]
    for key,point in zip(['helmetFront','helmetRear'],centers):
        assembly['anchors'][key]={'nodeId':ident(helmet),'point':list(point)}
    assembly['headwearDirection']={'frontAxis':'+X','crestPlane':'XY','crestThinAxis':'Z','sourceCrestRotationY':0,'crestOffsetY':-.018,'helmetAnchorStatus':'actual upper helmet mesh vertices'}
    (OUT/f'{asset}.assembly.json').write_text(json.dumps(assembly,indent=2))
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT/f'{asset}.blend'))
    bpy.ops.object.select_all(action='DESELECT')
    # Include hidden original archives in the binary, then disable their mesh instantiation explicitly.
    for o in list(nodes.values())+added:o.hide_set(False);o.hide_viewport=False;o.select_set(True)
    bpy.context.view_layer.objects.active=nodes['n0']
    path=OUT/f'{asset}.glb';bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,export_yup=True)
    archive_hidden_glb(path)
    assert hashlib.sha256(source.read_bytes()).hexdigest()==sha
    (ev/'build-report.json').write_text(json.dumps({'asset':asset,'originalNodeCount':len(nodes),'addedNodes':len(added),'sourceUnchanged':True,'blend':str(OUT/f'{asset}.blend'),'glb':str(path),'status':'pending_visual_review'},indent=2))
    print('CANDIDATE_READY',asset,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--role',default='gladius');p.add_argument('--side',default='blue');p.add_argument('--skip-render',action='store_true');a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    SKIP_RENDER=a.skip_render
    build(a.role,a.side)
