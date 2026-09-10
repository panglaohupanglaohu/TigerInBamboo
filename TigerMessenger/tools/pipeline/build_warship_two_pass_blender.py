"""Two retained Blender revisions: target-main-view eyes, then refined double-ended hull.
Source/V2 read-only; all 301 rowing/body/boarding transforms retained exactly.
"""
import bpy,bmesh,json,math,sys,importlib.util
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]
sp=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(sp);sp.loader.exec_module(s)
VERSION=int(sys.argv[sys.argv.index('--version')+1]) if '--version' in sys.argv else 3
NAME='warship-battle-v'+str(VERSION)
BASE=ROOT/'assets/models/optimized/warship-battle-v2'
s.OUT=ROOT/'assets/models/optimized'/NAME;s.ART=ROOT/'artifacts/pipeline'/NAME;s.g.ART=s.ART
s.OUT.mkdir(parents=True,exist_ok=True);s.ART.mkdir(parents=True,exist_ok=True)
original_hash={str(p.relative_to(ROOT)):s.sha(p) for p in [s.SOURCE,s.SNAP,BASE/'warship-battle-v2.blend',BASE/'warship-battle-v2.glb']}
a=json.loads((BASE/'warship-battle-v2.assembly.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(BASE/'warship-battle-v2.blend'))
sc=bpy.context.scene;sc.frame_set(1);bpy.context.view_layer.update()
obs={s.ident(o):o for o in sc.objects if s.ident(o)}
root=obs['n0'];changed=[]
# Calibration uses the same unchanged V2 frame51 geometry before either revision.
sc.frame_set(51);bpy.context.view_layer.update();s.v.studio(sc);sc.render.resolution_x=1200;sc.render.resolution_y=900
basepoints=[o.matrix_world@v.co for o in obs.values() if o.type=='MESH' and not o.hide_render for v in o.data.vertices]
def camera(direction):
    center=sum(basepoints,Vector())/len(basepoints);cam=sc.camera;cam.location=center+Vector(direction).normalized()*12;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    bpy.context.view_layer.update();inv=cam.matrix_world.inverted();points=[inv@p for p in basepoints];xs=[p.x for p in points];ys=[p.y for p in points]
    cam.location+=cam.rotation_euler.to_matrix()@Vector(((max(xs)+min(xs))/2,(max(ys)+min(ys))/2,0))
    cam.data.ortho_scale=max(max(xs)-min(xs),(max(ys)-min(ys))*1200/900)*1.13
    bpy.context.view_layer.update()
    return {'matrix':[v for row in cam.matrix_world for v in row],'orthoScale':cam.data.ortho_scale}
cams={name:camera(d) for name,d in [('three-quarter',(4,-5,3)),('top',(0,-.01,5))]}
sc.frame_set(1);bpy.context.view_layer.update()
# Cubic interpolation gives a succession of actual ring sections, not one scaled box.
stations=([-2.52,.28],[-2.40,.55],[-2.22,.82],[-2.02,.98],[-1.85,1.0],[1.60,1.0],[1.80,.99],[1.94,.96],[2.10,.82],[2.30,.28]) if VERSION==3 else ([-2.52,.07],[-2.40,.34],[-2.22,.72],[-2.02,.96],[-1.85,1.0],[1.60,1.0],[1.80,.98],[1.94,.92],[2.10,.65],[2.30,.055])
def width(x):
    if x<=stations[0][0]:return stations[0][1]
    for (x0,w0),(x1,w1) in zip(stations,stations[1:]):
        if x<=x1:
            t=(x-x0)/(x1-x0);t=t*t*(3-2*t);return w0+(w1-w0)*t
    return stations[-1][1]
def shell_width(x,y):
    w=width(x)
    if VERSION==4:
        # Narrow lower chine at the ends while retaining the original broad midship.
        end=max(0,min(1,(-x-1.85)/.55),min(1,(x-1.60)/.70))
        lower=max(0,min(1,(.30-y)/.34))
        w*=1-.34*end*lower
    return w
def deform(key,is_hull=False,landing=False,upper_aft=False):
    o=obs[key];o.data=o.data.copy();bm=bmesh.new();bm.from_mesh(o.data)
    m=s.rootmat(o,root);im=m.inverted()
    # Work in actor-local THREE coordinates; BMesh split interpolates existing UVs.
    for v in bm.verts:v.co=m@(s.CI.to_3x3()@v.co)
    for x in sorted(set([z[0] for z in stations]+[1.74,2.14]+[round(-2.52+i*.05,3) for i in range(15)]+[round(1.6+i*.05,3) for i in range(15)])):
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=(x,0,0),plane_no=(1,0,0),clear_inner=False,clear_outer=False)
    if is_hull:
        for y in [.0,.12,.25,.40,.56,.70,.84]:
            bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=(0,y,0),plane_no=(0,1,0),clear_inner=False,clear_outer=False)
    for v in bm.verts:
        p=v.co.copy()
        if is_hull and VERSION==4 and -2.16<p.x<1.90:
            # Source extruded top cap rose through the first seated pair.
            # Keep its top below the physical .65/.663 deck, without moving crew.
            fade=max(0,min(1,(p.x+2.16)/.16));fade=fade*fade*(3-2*fade)
            if p.y>.644:p.y-=fade*(p.y-.644)
        # The existing boarding station is an asymmetric supported landing ledge.
        # Keep its +Z attachment edge under the unchanged x1.94 hinge.
        if upper_aft:
            if p.x<-2.10:p.x=-2.10+(p.x+2.10)*1.7
            cap=max(.025,.5*width(p.x)-.018);p.z=max(-cap,min(cap,p.z))
        elif landing and p.z>0 and p.x<=2.14:
            p.z*=1 if p.z>=.30 else width(p.x)
        else:p.z*=shell_width(p.x,p.y) if is_hull else width(p.x)
        v.co=s.C.to_3x3()@(im@p)
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.update();s.v.ensure_uv(o);changed.append(key)
for key in ['n1','n3','n5','n7','n27','n29','n31','n231','n233','n253']:
    deform(key,is_hull=key=='n1')
for key in sorted(k for k in obs if k.startswith('add:deck-plank-')):deform(key)
deform('add:bow-landing',landing=True)
if VERSION==4:
    for key in ['n281','n283']:deform(key,upper_aft=True)
def replace(key,vertices,faces,mats,material_indices=None):
    o=obs[key];im=s.rootmat(o,root).inverted();me=bpy.data.meshes.new(NAME+' '+key);me.from_pydata([s.C.to_3x3()@(im@Vector(p)) for p in vertices],[],faces);me.update()
    for mat in mats:me.materials.append(mat)
    if material_indices:
        for f,i in zip(me.polygons,material_indices):f.material_index=i
    o.data=me;s.v.ensure_uv(o);changed.append(key)
cream=obs['n23'].data.materials[0];ink=obs['n25'].data.materials[0]
# Follow target MAIN 3q curled-end eye placement. +X ram/navigation is untouched.
for side,white,pupil in [(-1,'n23','n25'),(1,'n47','n49')]:
    cx=-1.96 if VERSION==4 else -2.12;cy=.47 if VERSION==4 else .49
    outline=[(-.185,0),(-.12,.060),(-.035,.085),(.070,.070),(.155,.025),(.18,0),(.115,-.055),(.015,-.073),(-.095,-.05)]
    verts=[]
    for scale,offset in [(1,.010),(.84,.014)]:
        for dx,dy in outline:
            x=cx+dx*scale;y=cy+dy*scale;verts.append((x,y,side*(.5*shell_width(x,y)+offset)))
    faces=[];indices=[];n=len(outline)
    for i in range(n):faces.append((i,(i+1)%n,(i+1)%n+n,i+n));indices.append(1)
    faces.append(tuple(range(n,n*2)));indices.append(0)
    if VERSION==4:
        # Small explicit triangles follow the curved shell; avoid a non-planar
        # n-gon cutting through the hull and fragmenting the white eye.
        count=32;verts=[(cx,cy,side*(.5*shell_width(cx,cy)+.028))];faces=[];indices=[]
        for radius in [.25,.5,.75,.86,1.0]:
            for j in range(count):
                t=j*math.tau/count;x=cx+.185*radius*math.cos(t);y=cy+.078*radius*math.sin(t)*abs(math.sin(t))**.25
                verts.append((x,y,side*(.5*shell_width(x,y)+.028)))
        for j in range(count):faces.append((0,1+j,1+(j+1)%count));indices.append(0)
        for ring in range(4):
            for j in range(count):
                p=1+ring*count+j;q=1+ring*count+(j+1)%count;r=q+count;u=p+count
                faces.extend([(p,q,r),(p,r,u)]);indices.extend([1 if ring==3 else 0]*2)
    if side<0:faces=[tuple(reversed(f)) for f in faces]
    replace(white,verts,faces,[cream,ink],indices)
    verts=[]
    for i in range(12):
        t=i*math.tau/12;x=cx-.008+.051*math.cos(t);y=cy+.006+.061*math.sin(t);verts.append((x,y,side*(.5*shell_width(x,y)+.021)))
    face=tuple(range(12))
    if VERSION==4:
        verts=[(x,y,side*(abs(z)+.028)) for x,y,z in verts];x=cx-.008;y=cy+.006
        verts.append((x,y,side*(.5*shell_width(x,y)+.049)))
        faces=[(12,j,(j+1)%12) for j in range(12)]
        replace(pupil,verts,faces if side>0 else [tuple(reversed(f)) for f in faces],[ink])
    else:replace(pupil,verts,[face if side>0 else tuple(reversed(face))],[ink])
# Support the retained boarding platform and bridge its old 0.025 local edge gap.
wood=obs['add:bow-landing'].data.materials[0];dark=obs['n233'].data.materials[0]
lip=s.box('Boarding hinge continuous landing lip',(.40,.040,.16 if VERSION==4 else .082),(1.94,.644,.45 if VERSION==4 else .47),root,wood,'add:bow-hinge-lip',.002)
for x in [1.77,2.11]:
    # Tapered wooden knee under the projecting +Z landing ledge.
    inside=.5*shell_width(x,.42)-.015
    vv=[(x+dx,y,z) for dx in [-.025,.025] for y,z in [(.62,inside),(.62,.485),(.43,inside)]]
    ff=[(0,2,1),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)]
    s.mesh('Boarding landing structural knee',vv,ff,root,dark,'add:bow-landing-knee-'+str(x))
obs={s.ident(o):o for o in sc.objects if s.ident(o)}
for o in obs.values():
    if o.type=='MESH':s.v.ensure_uv(o)
a.update(stage='v'+str(VERSION)+' target geometry candidate; new saved-file checks required',readyForBattle=False,motionClearancePassed=False,runtimeIntegrated=False)
a['geometryRevision']={'version':VERSION,'reference':'assets/concepts/warship-target-v1.png','referenceSHA256':s.sha(ROOT/'assets/concepts/warship-target-v1.png'),'eyeLayout':'Main 3q target priority: eyes at curled -X end. Reference side view conflicts. +X original navigation/ram unchanged.','eyeCenterThree':[-1.96,.47] if VERSION==4 else [-2.12,.49],'crossSectionWidthStations':stations,'curvedEnds':True,'lowerChineEndNarrowing':VERSION==4,'rowBayHullCapBelowDeck':VERSION==4,'changedOriginalOrV1MeshIDs':changed,'sourceMotion':'warship-battle-v2 all301 pose matrices unchanged','boardingHingeUnchanged':[1.94,.664,.48],'boardingSupport':'Retained +Z ledge, continuous hinge lip and two structural knees; no claim prior single-soldier route remains valid.'}
a['limitations']=['New hull geometry needs its own collision validation; V2 clearance is not inherited.','Static GLB frame1 plus all301 saved source-derived/synchronized poses in Blend and assembly.','No25-person scheduler or runtime integration. Prior V1 single-soldier path has NOT been revalidated on the new deck.','26 original rowers retain their original simple face/helmet family.','Main target image eye layout follows curled -X end while actual original +X ram/navigation remains unchanged.']
a['restTransforms']={k:s.flat(s.local(o)) for k,o in obs.items()}
a['addedNodes']=[{'id':k,'parent':s.ident(o.parent),'name':o.name} for k,o in obs.items() if o.get('warship_added_id')]
a['boarding']['geometryRevalidationRequired']=True;a['boarding']['pathReuse']='Invalid until new hull/deck path audit; do not inherit V1 route.'
bpy.context.preferences.filepaths.save_version=0
sc.frame_set(1);bpy.context.view_layer.update()
bpy.ops.wm.save_as_mainfile(filepath=str(s.OUT/(NAME+'.blend')))
s.export_warship(list(obs.values()),s.OUT/(NAME+'.glb'))
(s.OUT/(NAME+'.assembly.json')).write_text(json.dumps(a,separators=(',',':')))
assert all(s.sha(ROOT/k)==h for k,h in original_hash.items())
(s.ART/'build-provenance.json').write_text(json.dumps({'inputsUnchanged':original_hash,'version':VERSION,'cameras':cams,'changedMeshIDs':changed,'all301PortableMotionFramesIdenticalToV2':True,'geometryClearancePending':True},indent=2))
# Render actual GLB and apply the same frame51 transforms; fixed V2 camera and lighting.
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(s.OUT/(NAME+'.glb')));sc=bpy.context.scene;obs={s.ident(o):o for o in sc.objects if s.ident(o)}
for k,values in a['poseFrames'][50]['transforms'].items():s.setm(obs[k],s.mat(values))
s.v.studio(sc);sc.render.resolution_x=1200;sc.render.resolution_y=900
for name,values in cams.items():
    sc.camera.matrix_world=Matrix([values['matrix'][j*4:j*4+4] for j in range(4)]);sc.camera.data.ortho_scale=values['orthoScale'];sc.render.filepath=str(s.ART/('glb-frame51-'+name+'.png'));bpy.ops.render.render(write_still=True)
if VERSION==4:
    sc.render.resolution_x=1000;sc.render.resolution_y=750;target=s.C.to_3x3()@Vector((-1.96,.47,-.49));sc.camera.location=target+Vector((1,-5,2)).normalized()*5;sc.camera.rotation_euler=(target-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=1.35;sc.render.filepath=str(s.ART/'glb-eye-closeup.png');bpy.ops.render.render(write_still=True)
(s.ART/'render-provenance.json').write_text(json.dumps({'glbSHA256':s.sha(s.OUT/(NAME+'.glb')),'freshImport':True,'poseFrame':51,'cameraBasis':'Identical original V2 frame51 bounds, camera matrices and illumination for v3/v4','images':['glb-frame51-three-quarter.png','glb-frame51-top.png']},indent=2))
print(NAME+' SAVED_RENDERED',flush=True)
