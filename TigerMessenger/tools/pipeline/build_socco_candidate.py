"""Background Blender refinement of the archived original aircraft, not a new craft."""
import bpy,bmesh,json,math,hashlib,struct
from pathlib import Path
from mathutils import Vector
BASE=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
OUT=BASE/'assets/models/optimized/socco-craft-v1';EV=BASE/'artifacts/pipeline/socco-craft-v1'
OUT.mkdir(parents=True,exist_ok=True);EV.mkdir(parents=True,exist_ok=True)
SOURCE=BASE/'assets/models/originals/supplemental/blender-r3/soccoCraft.blend';SNAP=BASE/'assets/models/originals/supplemental/soccoCraft.source.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
hashes={'blend':sha(SOURCE),'snapshot':sha(SNAP)};snap=json.loads(SNAP.read_text());records={n['id']:n for n in snap['nodes']}
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));source_scene=bpy.context.scene
original={o.get('three_node_id'):o for o in source_scene.objects if o.get('three_node_id')}
scene=bpy.data.scenes.new('SOCCO V1 Candidate');bpy.context.window.scene=scene;nodes={}
for sid,o in original.items():
 c=o.copy()
 if o.type in ['MESH','LIGHT']:c.data=o.data.copy()
 scene.collection.objects.link(c);nodes[sid]=c
for sid,o in original.items():nodes[sid].parent=nodes.get(o.parent.get('three_node_id'))if o.parent else None;nodes[sid].matrix_parent_inverse=o.matrix_parent_inverse.copy()
bpy.context.view_layer.update()
root=nodes['n0'];root['candidate_id']='socco-craft-v1';root['source_blend_sha256']=hashes['blend'];root['candidate_status']='structure candidate, engine behavior integration pending'
visible=[sid for sid,o in original.items()if o.type=='MESH'and not o.hide_render]
outline=[sid for sid,o in original.items()if o.type=='MESH'and o.hide_render and records[sid]['visible']]
effects=['n86'];added=[]
def count(ns):return sum(sum(len(p.vertices)-2 for p in o.data.polygons)for o in ns if o.type=='MESH'and not o.hide_render)
original_tri=count(original.values())
# Portable source palette; retain original metadata and effective transparency.
materials={}
for mid,src in snap['materials'].items():
 m=bpy.data.materials.new('SoccoV1_Source_'+mid);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');alpha=src.get('opacity',1)if src.get('transparent',False)else 1
 bs.inputs['Base Color'].default_value=(*src.get('color',[1,1,1]),alpha);bs.inputs['Alpha'].default_value=alpha;bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.72
 em=src.get('emissive',[0,0,0]);strength=src.get('emissiveIntensity',1)
 if src['type']=='MeshBasicMaterial':em=src.get('color',[1,1,1]);strength=.35
 bs.inputs['Emission Color'].default_value=(*em,1);bs.inputs['Emission Strength'].default_value=strength
 m['three_uuid']=mid;m['three_source']=json.dumps(src);m['candidate_effective_alpha']=alpha;m['candidate_material_limit']='Principled approximation; Toon ramp and additive blending remain engine work'
 if src.get('transparent',False):m.surface_render_method='BLENDED'
 if src.get('side')==2:m.use_backface_culling=False
 else:m.use_backface_culling=True
 materials[mid]=m
for sid,o in nodes.items():
 o['source_visible']=records[sid]['visible'];o['source_archive_hide_render']=original[sid].hide_render
 if o.type=='MESH':
  mids=records[sid].get('materials',[]);o.data.materials.clear()
  for mid in mids:o.data.materials.append(materials[mid])
def newmat(name,color,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=0;b.inputs['Roughness'].default_value=.7;b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission;m['candidate_new_material']=True;return m

# Source Three.js coordinate -> archived Blender basis (+Y up becomes +Z).
def conv(p):return Vector((p[0],-p[2],p[1]))
def mesh_root(name,verts,faces,mat,sid=None,parent='n0',slots=None,weld=True):
 o=nodes[sid]if sid else bpy.data.objects.new(name,bpy.data.meshes.new(name))
 if not sid:scene.collection.objects.link(o);o.parent=nodes[parent];o['candidate_node_id']=name;o['candidate_added']=True;o['source_parent_id']=parent;added.append(o)
 bpy.context.view_layer.update();inv=o.matrix_world.inverted()@root.matrix_world
 mesh=bpy.data.meshes.new(name+'_geometry');mesh.from_pydata([inv@conv(v)for v in verts],[],faces);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh)
 if weld:bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001)
 bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
 for m in ([mat]+(slots or [])):mesh.materials.append(m)
 o.data=mesh;o['candidate_geometry']='moebius-aircraft-v1';return o
def rod(name,a,b,r,mat,parent='n0',sides=6):
 a=Vector(a);b=Vector(b);d=(b-a).normalized();ref=Vector((1,0,0))if abs(d.x)<.8 else Vector((0,1,0));u=d.cross(ref).normalized();w=d.cross(u);vv=[]
 for p in [a,b]:
  for i in range(sides):vv.append(tuple(p+r*(u*math.cos(2*math.pi*i/sides)+w*math.sin(2*math.pi*i/sides))))
 ff=[tuple(reversed(range(sides))),tuple(range(sides,2*sides))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides)for i in range(sides)]
 return mesh_root(name,vv,ff,mat,parent=parent)

def boxes(name,items,mat,sid=None,parent='n0',bevel=.02):
 vv=[];ff=[]
 for center,size in items:
  x,y,z=center;a,b,c=[v/2 for v in size];off=len(vv)
  vv.extend([(x+sx*a,y+sy*b,z+sz*c)for sx,sy,sz in [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]])
  ff.extend(tuple(off+i for i in face)for face in [(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)])
 o=mesh_root(name,vv,ff,mat,sid,parent,weld=False)
 if bevel:
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Small original panel edge relief','BEVEL');mod.width=bevel;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o
# Hollow the original solid boxes, retaining their outer dimensions and IDs.
boxes('SoccoOriginalHullOpenHold',[((-1.24,.35,-.2),(.12,2.5,4.6)),((1.24,.35,-.2),(.12,2.5,4.6)),((0,1.53,-.2),(2.6,.14,4.6)),((0,.35,2.03),(2.6,2.5,.14))],materials['m0'],'n1',bevel=0)
boxes('SoccoOriginalBellyHollow',[((-1.275,-.62,.1),(.11,1.55,4)),((1.275,-.62,.1),(.11,1.55,4)),((0,-1.44,.1),(2.44,.10,4))],materials['m3'],'n9',bevel=0)
# Original rounded flotation geometry remains intact. Active battle seats stop
# before its inner curved bow; the fourteen source anchors are all preserved.
# Original fixed rear skid and its detached ribs crossed the actual boarding corridor.
# Reuse their IDs as flanking hinge-side structure, not an extra ramp across the door.
boxes('SoccoOriginalFixedSkidSideMounts',[((-1.14,-1.22,-2.68),(.22,.26,.9)),((1.14,-1.22,-2.68),(.22,.26,.9))],materials['m12'],'n32')
for i,sid in enumerate(['n36','n37','n38','n39','n40','n41','n42','n43','n44']):
 x=(-1 if i%2==0 else 1)*1.14;z=-2.35-(i//2)*.13;boxes('SoccoOriginalSkidRib'+sid,[((x,-1.06,z),(.20,.035,.07))],materials['m11'],sid,bevel=0)
# Repackage the original propulsion assembly beneath the floor. Original group
# positions/parents are kept; only its obstructing internal geometry is compacted.
for sid in ['n25','n27','n29','n31']:
 o=nodes[sid];inv=o.matrix_world.inverted()@root.matrix_world
 for v in o.data.vertices:
  pnt=root.matrix_world.inverted()@o.matrix_world@v.co;x,y,z=pnt.x,pnt.z,-pnt.y
  q=conv((x*.8,-1.76+(y+1.28)*.30,-1.65+(z+3.15)*.58));v.co=inv@q
# Original ramp slab now has a slim landing tip; all ribs/kerbs stay on n87.
# Root coordinates are authored in the preserved hinge's original flat rest pose.
v=[(-.95,-1.47,-2.62),(.95,-1.47,-2.62),(.95,-1.33,-2.62),(-.95,-1.33,-2.62),(-.95,-1.41,-5.52),(.95,-1.41,-5.52),(.95,-1.39,-5.52),(-.95,-1.39,-5.52)]
f=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)]
mesh_root('SoccoOriginalRampTaperedTip',v,f,materials['m12'],'n88')
# Real rear doorway and visible hinge barrels. Clear opening ±.98 x, floor -1.29.
boxes('socco-door-frame',[((-1.09,.10,-2.51),(.14,2.98,.16)),((1.09,.10,-2.51),(.14,2.98,.16)),((0,1.51,-2.51),(2.04,.18,.16))],materials['m5'])
for x in [-.93,.93]:rod('socco-hinge-pin-'+str(x),(x-.12,-1.4,-2.62),(x+.12,-1.4,-2.62),.09,materials['m10'])
# Boarding threshold joins original hold floor to the original hinge, no floating step.
boxes('socco-boarding-threshold',[((0,-1.35,-2.50),(1.90,.12,.30))],materials['m11'],bevel=.012)
# Small bolted seams and cockpit rim; existing shell, pilot, color and silhouette remain.
for sid in ['n3','n7','n16','n57']:
 o=nodes[sid];bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(o.data);bm.free();bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Original casing edge relief','BEVEL');mod.width=.025;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
for x in [-1.19,1.19]:
 boxes('socco-shell-edge-strip-'+str(x),[((x,1.595,-.2),(.035,.018,4.45))],materials['m5'],bevel=.005)
 for z in [-2.36,-.2,1.96]:rod('socco-panel-bolt-'+str((x,z)),(x,1.61,z),(x,1.635,z),.027,materials['m11'])
# Open-cap nose rims make the original two dark ports legible (source cap covered them).
for sid,cx,cy,r in [('n22',.62,.92,.34),('n24',.62,.12,.28)]:
 vv=[];ff=[];steps=12
 for z,rad in [(3.38,r*1.12),(3.49,r*1.12),(3.49,r*.94),(3.40,r*.94)]:
  for i in range(steps):a=2*math.pi*i/steps;vv.append((cx+rad*math.cos(a),cy+rad*math.sin(a),z))
 for j in range(4):
  for i in range(steps):ff.append((j*steps+i,j*steps+(i+1)%steps,((j+1)%4)*steps+(i+1)%steps,((j+1)%4)*steps+i))
 mesh_root('SoccoOriginalNosePort'+sid,vv,ff,materials['m5'],sid)
# Underside braces make the folded ramp readable from outside too; these are
# children of the original hinge and follow the same opening motion.
boxes('socco-ramp-outer-braces',[((0,-1.49,-2.95-i*.43),(1.80,.04,.09))for i in range(6)],materials['m11'],parent='n87',bevel=.004)
# 14 original anchors remain the factory capacity; battle occupancy chooses 7.
ACTIVE=[0,1,2,4,5,8,9];seat_ids=['n'+str(109+i)for i in ACTIVE];root['candidate_active_seat_indices']=ACTIVE;root['candidate_factory_capacity']=14
# Real foldable side seats are optional transport furnishings, below standing feet
# when stowed. Active troops use preserved standing boarding anchors, per factory.
for sx in [-1,1]:boxes('socco-folded-side-bench-'+str(sx),[((sx*.87,-1.05,-.4),(.10,.26,3.75))],materials['m11'],bevel=.01)
# Source ramp matrix is retained at rest. A new clip/adapter controls the source
# hinge from upright closed to ground-resolved shallow open, not old -78 degrees.
L=2.9;TIP_HALF=.01;CLOSED=math.pi/2;GROUND=-1.99;angle=math.asin((GROUND+1.4)/math.sqrt(L*L+TIP_HALF*TIP_HALF))+math.atan(TIP_HALF/L)
contract={'sourceAsset':'soccoCraft','factorySeats':14,'battleActiveSeats':ACTIVE,'seatNodeIDs':seat_ids,'allSeatNodeIDs':['n'+str(i)for i in range(109,123)],'hinge':'n87','hingeRootPosition':[0,-1.4,-2.62],'rampLength':L,'rampTipHalfThickness':TIP_HALF,'closedAngleRad':CLOSED,'fixtureGroundLocalY':GROUND,'fixtureOpenAngleRad':angle,'maxBoardingSlopeRad':math.radians(25),'runtimeGroundEquation':'a=asin((ground_y-hinge_y)/sqrt(L^2+tip_half^2))+atan(tip_half/L); raycast actual ground in craft local frame, then sample/refine endpoint. Reposition craft if slope exceeds 25 deg or endpoint is unreachable.','passengerPath':'rear-most rows exit first; keep own x lane inside hold/ramp, then converge after ramp foot; no direct diagonal through occupied rows','sourceNodeMatricesRetainedAtArchiveRest':True,'changedGeometryNodes':['n1','n3','n7','n9','n16','n22','n24','n25','n27','n29','n31','n32','n36','n37','n38','n39','n40','n41','n42','n43','n44','n57','n88'],'propulsionRepack':'Original lower assembly geometrically compacted under floor around center(0,-1.76,-1.65), factors(.8,.30,.58); eliminates original pod intersecting boarding ramp; source node matrices unchanged.','oldRampIssue':'factory setSoccoRamp(0) leaves deck horizontal; -1.36 at 1 points steeply down. New closed is +pi/2 and deployed angle resolves ground.'}
contract.update({'newCrewTransport': {'asset': 'vanguard-battle-v1', 'glbPose': 'static idle frame 1; original emitter nodes n62,n63 hidden during transport', 'activeRootLocalXOffsetBySeatSide': {'left': -0.12, 'right': 0.09}, 'resultingCraftLocalXLanes': [-0.4, 0.43], 'footSupport': 'Per-frame support raycasts under actual boot soles; keep 0.001 contact skin. Do not use only root Y or fixed ramp angle.', 'bodyScale': 1, 'sourceAnchorsChanged': False}, 'capacityScope': '14 original seat anchors retained; this battle validates 7 occupants, not 14 simultaneous bodies. 3 SOCCO x7 + 3 GatePod x2 =27.'})
(EV/'boarding-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
bpy.context.view_layer.update();matrix_error=max(abs(o.matrix_basis[i][j]-original[sid].matrix_basis[i][j])for sid,o in nodes.items()for i in range(4)for j in range(4));assert matrix_error<1e-6
# Batch new static details by parent and material; never merge original animated nodes.
from collections import defaultdict
batches=defaultdict(list)
for o in added:batches[(o['source_parent_id'],o.data.materials[0].name)].append(o)
new_added=[]
for (pid,mname),objects in batches.items():
 if len(objects)==1:new_added.extend(objects);continue
 verts=[];faces=[];parts=[]
 for o in objects:
  trans=nodes[pid].matrix_world.inverted()@o.matrix_world;offset=len(verts);verts.extend(trans@v.co for v in o.data.vertices);faces.extend(tuple(i+offset for i in p.vertices)for p in o.data.polygons);parts.append(o['candidate_node_id'])
 mesh=bpy.data.meshes.new('SoccoStaticDetails_'+mname);mesh.from_pydata(verts,[],faces);mesh.materials.append(bpy.data.materials[mname]);o=bpy.data.objects.new('socco-details-'+pid+'-'+mname,mesh);scene.collection.objects.link(o);o.parent=nodes[pid];o['candidate_node_id']=o.name;o['candidate_added']=True;o['source_parent_id']=pid;o['candidate_components']=json.dumps(parts);new_added.append(o)
 for old in objects:bpy.data.objects.remove(old,do_unlink=True)
added=new_added
# Export node IDs and visibility data before creating any passenger review fixture.
outline=[sid for sid,n in records.items()if n.get('userData',{}).get('isOutline')]
export=bpy.data.scenes.new('SOCCO V1 Export');copies={}
for sid,o in nodes.items():
 if sid in outline:
  c=bpy.data.objects.new(o.name,None)
  for k,v in o.items():c[k]=v
  c['candidate_hidden_outline']=True
 else:c=o.copy()
 export.collection.objects.link(c);copies[sid]=c
for sid,o in nodes.items():
 c=copies[sid];c.parent=copies.get(records[sid]['parent']);c.matrix_parent_inverse=o.matrix_parent_inverse.copy();c.matrix_basis=o.matrix_basis.copy();c.hide_render=False;c.hide_viewport=False
for o in added:
 c=o.copy();export.collection.objects.link(c);c.parent=copies[o['source_parent_id']];c.matrix_basis=o.matrix_basis.copy()
bpy.context.window.scene=export
for o in export.objects:o.select_set(True)
bpy.context.view_layer.objects.active=copies['n0'];glb=OUT/'socco-craft-v1.glb';bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
# Actual reimport, with original visibility contract and the same original hinge.
roundtrip=bpy.data.scenes.new('SOCCO V1 GLB Reimport');bpy.context.window.scene=roundtrip;bpy.ops.import_scene.gltf(filepath=str(glb));rn={o.get('three_node_id'):o for o in roundtrip.objects if o.get('three_node_id')};assert set(rn)==set(nodes)
for o in roundtrip.objects:
 if o.get('candidate_hidden_outline',False)or o.get('source_visible')==False:o.hide_render=True
# Keep spray VFX in GLB. Studio review disables it in all three states, not model.
for ns in [original,nodes,rn]:ns['n86'].hide_render=True
# Passenger fixture loads the real archived vanguard, not a proxy or new soldier.
TROOP=BASE/'assets/models/originals/supplemental/blender-r3/vanguardTrooper.blend';troop_hash=sha(TROOP)
with bpy.data.libraries.load(str(TROOP),link=False)as(src,dst):dst.objects=list(src.objects)
loaded=[o for o in dst.objects if o and o.get('three_node_id')];tn={o['three_node_id']:o for o in loaded};troop_root=tn['n0'];troop_source=json.loads((BASE/'assets/models/originals/supplemental/vanguardTrooper.source.json').read_text());troop_records={n['id']:n for n in troop_source['nodes']}
# Fold weapons for transport through original part joints, preserving their meshes.
parts=troop_records['n0']['userData']['parts']
tn[parts['armR']['nodeRef']].rotation_mode='XYZ'
tn[parts['armL']['nodeRef']].rotation_mode='XYZ'
tn[parts['armR']['nodeRef']].rotation_euler=(0,0,0)
tn[parts['armL']['nodeRef']].rotation_euler=(-math.pi,0,0)
# Turn the laser blade off in transport (original effect geometries stay archived).
blade=tn[parts['blade']['nodeRef']]
for ob in blade.children:
 if ob.type=='MESH'and ob.data.materials and any('MeshBasicMaterial'in m.name for m in ob.data.materials):ob.hide_render=True
# Source soldier archive can also contain preview shader links; use source colors.
for ob in loaded:
 if ob.type!='MESH':continue
 for i,mat in enumerate(list(ob.data.materials)):
  src=json.loads(mat.get('three_source','{}'));m=bpy.data.materials.new('PassengerReview_'+mat.name);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*src.get('color',[.2,.2,.2]),1);bs.inputs['Roughness'].default_value=.8;ob.data.materials[i]=m
passengers=[]
for slot,sid in enumerate(seat_ids):
 group={}
 for key,ob in tn.items():c=ob.copy();roundtrip.collection.objects.link(c);group[key]=c
 for key,ob in tn.items():group[key].parent=group.get(ob.parent.get('three_node_id'))if ob.parent else None;group[key].matrix_parent_inverse=ob.matrix_parent_inverse.copy()
 tr=group['n0'];tr.rotation_mode='XYZ';tr['review_passenger_slot']=slot;tr.parent=rn[sid];tr.location=(0,0,0);tr.rotation_euler=(0,0,0);passengers.append((tr,group,sid))
# Initial root anchors are foot references; offset source sole so every actual
# trooper rests on the original floor top, instead of hovering above it.
bpy.context.view_layer.update()
for tr,group,sid in passengers:
 pts=[tr.matrix_world.inverted()@ob.matrix_world@v.co for ob in group.values()if ob.type=='MESH'and not ob.hide_render for v in ob.data.vertices];sole=min(v.z for v in pts);tr.location.z=(-1.29-records[sid]['matrix'][13])-sole;tr['candidate_source_sole']=sole
bpy.context.view_layer.update()
# Source / candidate full view plus actual GLB closed, opening, deployed and 7-passenger exit.
def lights(sc):
 bpy.context.window.scene=sc;sc.render.engine='CYCLES';sc.cycles.samples=16;sc.cycles.max_bounces=4;sc.render.resolution_x=1200;sc.render.resolution_y=1200;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX';world=bpy.data.worlds.new('SoccoReviewWorld');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.38,.41,1);world.node_tree.nodes['Background'].inputs[1].default_value=.7;sc.world=world
 for name,pos,energy,size in [('Key',(-3,-5,7),1200,4),('Fill',(5,-1,4),800,4),('Rear',(1,5,5),1400,4)]:
  ld=bpy.data.lights.new(name,'AREA');o=bpy.data.objects.new(name,ld);sc.collection.objects.link(o);o.location=pos;o.rotation_euler=(Vector((0,0,.3))-o.location).to_track_quat('-Z','Y').to_euler();ld.energy=energy;ld.size=size
 cd=bpy.data.cameras.new('SoccoReviewCamera');cam=bpy.data.objects.new('SoccoReviewCamera',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.type='ORTHO';return cam
review=[]
def render(sc,cam,name,target,direction,ortho):
 cam.location=Vector(target)+Vector(direction).normalized()*25;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=ortho;sc.render.filepath=str(EV/(name+'.png'));bpy.ops.render.render(write_still=True);review.append({'name':name,'camera':list(cam.location),'target':target,'ortho':ortho})
for sc,ns,name in [(source_scene,original,'before'),(scene,nodes,'after')]:
 cam=lights(sc);render(sc,cam,name+'-full-three-quarter',(0,.65,.25),(3,-4,2.2),8.5)
cam=lights(roundtrip);rn['n87'].rotation_mode='XYZ'
for k,label in [(0,'closed'),(.5,'opening'),(1,'deployed')]:
 rn['n87'].rotation_euler.x=CLOSED+(angle-CLOSED)*k;bpy.context.view_layer.update();render(roundtrip,cam,'glb-'+label+'-rear-seven',(0,1.4,.1),(2,6,2.4),6.8)
# Endpoint ground plane is a review fixture only, never part of the export.
bpy.ops.mesh.primitive_plane_add(size=15,location=(0,1,GROUND));ground=bpy.context.object;ground.name='ReviewLandingGround';ground.data.materials.append(newmat('ReviewGround',(.15,.17,.14)))
render(roundtrip,cam,'glb-deployed-side-ground',(0,1.2,.1),(6,2,1.4),10.5)
# Exit fixture: genuine seven passengers move along own lane, rear rows first.
rest=[tr.matrix_world.copy()for tr,_,_ in passengers]
for i,(tr,group,sid)in enumerate(passengers):
 tr.parent=rn['n0'];tr.matrix_world=rest[i]
 # stagger along the ramp and landing, with enough space for the same real mesh
 distance=i*.7+.2;h=.07-(.06*min(1,distance/L));x=(-.45 if i%2==0 else .45)
 if distance<=L:y=-1.4+distance*math.sin(angle)+h*math.cos(angle);z=-2.62-distance*math.cos(angle)+h*math.sin(angle)
 else:y=GROUND;z=-2.62-L*math.cos(angle)-(distance-L)
 tr.location=conv((x,y-tr['candidate_source_sole'],z));tr.rotation_euler.z=math.pi
render(roundtrip,cam,'glb-seven-unloading',(0,3.4,-.05),(3,6,3),8.5)
# Restore review fixture and preserve non-destructive authored source matrices.
for tr,group,sid in passengers:tr.hide_render=True
rn['n87'].rotation_euler.x=CLOSED
bpy.context.window.scene=scene;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'socco-craft-v1.blend'))
assert hashes=={'blend':sha(SOURCE),'snapshot':sha(SNAP)};assert troop_hash==sha(TROOP)
report={'status':'Blender functional geometry candidate; runtime integration pending','sourceHashesBefore':hashes,'sourceHashesAfter':{'blend':sha(SOURCE),'snapshot':sha(SNAP)},'trooperSourceHashUnchanged':troop_hash==sha(TROOP),'sourceVisibleTriangles':original_tri,'candidateVisibleTriangles':count(list(nodes.values())+added),'sourceNodeCount':len(nodes),'sourceLocalMatrixMaxError':matrix_error,'addedStaticNodes':len(added),'boardingContract':contract,'glbSha256':sha(glb),'blendSha256':sha(OUT/'socco-craft-v1.blend'),'review':review,'limitations':['Ground solving is a mathematical/review fixture until the world adapter uses actual ground sampling.','Real original vanguard meshes used in review; 7-passenger animated navigation test still separate.','Factory 14-seat contract retained; candidate active battle occupancy 7.','VFX spray hidden only for fair studio review; its original geometry and metadata remain exported.']}
(EV/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'trianglesBefore':original_tri,'trianglesAfter':report['candidateVisibleTriangles'],'glb':str(glb)}))
