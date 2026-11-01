"""Build the swamp tiger v3: metaball anatomy -> remeshed skin, ears/eyes/nose, armature, auto weights, glb.
Coordinates in the spec are three.js tiger-local (x right, y up, z forward), 'ref units' (paw spacing 3.3), scaled by K."""
import bpy, bmesh, math, sys, os, json
from mathutils import Vector, Matrix, Quaternion
OUT=os.path.abspath(sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else '.')
K=1.36
def B(p):  # three -> blender
    x,y,z=p;return Vector((x*K,-z*K,y*K))
for o in list(bpy.data.objects): bpy.data.objects.remove(o)
sc=bpy.context.scene
F=0.574
def family(name,res=0.035,thr=0.6):
    mb=bpy.data.metaballs.new(name);mb.resolution=res;mb.render_resolution=res;mb.threshold=thr
    o=bpy.data.objects.new(name,mb);sc.collection.objects.link(o);return mb
def ell(mb,c,r,stiff=2.0):
    e=mb.elements.new();e.type='ELLIPSOID';e.co=B(c);e.radius=K;e.stiffness=stiff
    e.size_x=r[0]/F;e.size_y=r[2]/F;e.size_z=r[1]/F;return e
def cap(mb,a,b,ra,rb=None,stiff=2.0,n=None):
    rb=ra if rb is None else rb;A,Bv=Vector(a),Vector(b);L=(Bv-A).length
    n=n or max(1,int(L/(0.9*min(ra,rb)))+1)
    for i in range(n):
        t0,t1=i/n,(i+1)/n;p0=A.lerp(Bv,t0);p1=A.lerp(Bv,t1);r=ra+(rb-ra)*(t0+t1)/2
        e=mb.elements.new();e.type='CAPSULE';mid=(p0+p1)/2;e.co=B(mid);e.radius=r*K/F;e.stiffness=stiff
        d=(B(p1)-B(p0));e.size_x=d.length/2/(1) ;
        e.rotation=Vector((1,0,0)).rotation_difference(d.normalized())
SPEC=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'spec.json')))
body=family('TB',res=SPEC.get('res',0.035))
for e in SPEC['ellipsoids']: ell(body,e['c'],e['r'],e.get('s',2.0))
for c in SPEC['capsules']: cap(body,c['a'],c['b'],c['ra'],c.get('rb'),c.get('s',2.0))
def mirror(p):return [-p[0],p[1],p[2]]
for side in (1,-1):
    for c in SPEC['legs']:
        a=list(c['a']);b=list(c['b']);
        if side<0:a,b=mirror(a),mirror(b)
        cap(body,a,b,c['ra'],c.get('rb'),c.get('s',2.0))
    for e in SPEC['paired']:
        cc=list(e['c']);
        if side<0:cc=mirror(cc)
        ell(body,cc,e['r'],e.get('s',2.0))
dg=bpy.context.evaluated_depsgraph_get()
def bake(o,name):
    dg=bpy.context.evaluated_depsgraph_get();me=bpy.data.meshes.new_from_object(o.evaluated_get(dg))
    ob=bpy.data.objects.new(name,me);sc.collection.objects.link(ob);return ob
skin=bake(bpy.data.objects['TB'],'tiger_skin')
bpy.data.objects.remove(bpy.data.objects['TB'])
# clean remesh + light smoothing + decimate
m=skin.modifiers.new('rm','REMESH');m.mode='VOXEL';m.voxel_size=SPEC.get('voxel',0.03)*K
m2=skin.modifiers.new('sm','CORRECTIVE_SMOOTH') if False else skin.modifiers.new('sm','SMOOTH');m2.factor=0.5;m2.iterations=SPEC.get('smooth',6)
m3=skin.modifiers.new('dc','DECIMATE');m3.ratio=SPEC.get('decimate',0.35)
skin2=bake(skin,'tiger_skin_final');bpy.data.objects.remove(skin);skin=skin2;skin.name='tiger_skin'
for p in skin.data.polygons:p.use_smooth=True
print('skin verts',len(skin.data.vertices),'tris',sum(len(p.vertices)-2 for p in skin.data.polygons))
# ---------- ears / eyes / nose ----------
def sphere_obj(name,c,r,seg=20,rings=12,rot=None):
    me=bpy.data.meshes.new(name);bm=bmesh.new();bmesh.ops.create_uvsphere(bm,u_segments=seg,v_segments=rings,radius=1)
    for v in bm.verts: v.co=Vector((v.co.x*r[0],v.co.z*r[2]*-1 if False else -v.co.y*r[2],v.co.z*r[1])) if False else Vector((v.co.x*r[0]*K,v.co.y*r[2]*K,v.co.z*r[1]*K))
    if rot is not None:
        bmesh.ops.rotate(bm,verts=bm.verts,cent=(0,0,0),matrix=rot)
    for v in bm.verts: v.co+=B(c)
    bm.to_mesh(me);bm.free();o=bpy.data.objects.new(name,me);sc.collection.objects.link(o)
    for p in me.polygons:p.use_smooth=True
    return o
parts=[]
for side in (1,-1):
    E=SPEC['ear'];c=[E['c'][0]*side,E['c'][1],E['c'][2]]
    rot=(Matrix.Rotation(math.radians(E['yaw'])*-side,3,'Z')@Matrix.Rotation(math.radians(E['roll'])*side,3,'Y')@Matrix.Rotation(math.radians(E['pitch']),3,'X'))
    o=sphere_obj('ear_'+('L' if side>0 else 'R'),c,E['r'],24,14,rot)
    # cup: push the front face inward (toward -forward) and flatten base
    me=o.data;cen=B(c);fwd=rot@Vector((0,-1,0))
    for v in me.vertices:
        d=v.co-cen;f=d.dot(fwd)
        if f>0: v.co-=fwd*f*1.5
    parts.append(o)
    if SPEC.get('no_eyes'): continue
    Y=SPEC['eye'];c=[Y['c'][0]*side,Y['c'][1],Y['c'][2]]
    rot=Matrix.Rotation(math.radians(Y['yaw'])*-side,3,'Z')@Matrix.Rotation(math.radians(Y['tilt'])*side,3,'Y')
    parts.append(sphere_obj('eye_'+('L' if side>0 else 'R'),c,Y['r'],16,10,rot))
    P=SPEC['pupil'];c=[P['c'][0]*side,P['c'][1],P['c'][2]]
    parts.append(sphere_obj('pupil_'+('L' if side>0 else 'R'),c,P['r'],12,8,rot))
N=SPEC['nose']
# seat the nose pad on the muzzle surface
_sz=max((-v.co.y/K for v in skin.data.vertices if abs(v.co.x/K)<0.03 and abs(v.co.z/K-N['c'][1])<0.03),default=N['c'][2])
N['c']=[N['c'][0],N['c'][1],_sz+N['r'][2]*0.3];print('nose z',round(_sz,3))
no=sphere_obj('nose',N['c'],N['r'],20,10,Matrix.Rotation(math.radians(N['pitch']),3,'X'))
# nose: inverted triangle — shrink bottom in x
for v in no.data.vertices:
    rel=(v.co.z-B(N['c']).z)/(N['r'][1]*K);v.co.x*=0.55+0.45*max(0,min(1,(rel+1)/1.6))
parts.append(no)
# ---------- armature ----------
arm=bpy.data.armatures.new('rig');ao=bpy.data.objects.new('tiger_rig',arm);sc.collection.objects.link(ao)
bpy.context.view_layer.objects.active=ao;ao.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bones={}
def bone(name,h,t,parent=None,deform=True,roll=0):
    b=arm.edit_bones.new(name);b.head=B(h);b.tail=B(t);b.use_deform=deform;b.roll=roll
    if parent:b.parent=bones[parent];b.use_connect=False
    bones[name]=b;return b
R=SPEC['rig']
bone('root',[0,0,0],[0,0,0.4],deform=False)
for b in R['bones']:
    bone(b['n'],b['h'],b['t'],b.get('p','root'),b.get('d',True))
for b in R['paired']:
    for side,suf in ((1,'.L'),(-1,'.R')):
        h=[b['h'][0]*side,b['h'][1],b['h'][2]];t=[b['t'][0]*side,b['t'][1],b['t'][2]]
        p=b.get('p','root');p=p+suf if b.get('pp') else p
        bone(b['n']+suf,h,t,p,b.get('d',True))
# tail chain
T=R['tail'];a=Vector(T['root']);d=Vector(T['dir']).normalized();seg=T['len']/T['n'];prev='pelvis'
for i in range(T['n']):
    h=a+d*seg*i;t=a+d*seg*(i+1);bone(f'tail{i}',list(h),list(t),prev);prev=f'tail{i}'
bpy.ops.object.mode_set(mode='OBJECT')
# ---------- skinning ----------
def bind(obj,group_bone=None):
    obj.parent=ao
    if group_bone:
        vg=obj.vertex_groups.new(name=group_bone);vg.add(list(range(len(obj.data.vertices))),1.0,'REPLACE')
        mod=obj.modifiers.new('arm','ARMATURE');mod.object=ao
    else:
        bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);ao.select_set(True);bpy.context.view_layer.objects.active=ao
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
bind(skin)
for o in parts:
    nm=o.name
    bind(o,'ear.L' if nm=='ear_L' else 'ear.R' if nm=='ear_R' else 'head')
# weight sanity: count verts without groups
nz=sum(1 for v in skin.data.vertices if not any(g.weight>1e-4 for g in v.groups));print('unweighted',nz)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'tiger-v3.blend'))
# ---------- materials / export ----------
def mat(name,col):
    m=bpy.data.materials.new(name);m.use_nodes=True;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*col,1);return m
def srgb(h):
    h=h.lstrip('#');c=[int(h[i:i+2],16)/255 for i in (0,2,4)];return [((x+0.055)/1.055)**2.4 if x>0.04045 else x/12.92 for x in c]
skin.data.materials.append(mat('tiger_coat',srgb('#CD8F48')))
for o in parts:
    k=o.name.split('_')[0]
    o.data.materials.append(mat({'ear':'tiger_ear','eye':'tiger_eye','pupil':'tiger_ink','nose':'tiger_nose'}[k],srgb({'ear':'#34333D','eye':'#C8A66E','pupil':'#34333D','nose':'#B97882'}[k])))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'tiger-v3.glb'),export_format='GLB',use_selection=True,export_skins=True,export_animations=False,export_apply=False,export_yup=True,export_extras=True,export_materials='EXPORT')
print('exported')
