"""Background Blender refinement of the archived original aircraft, not a new craft."""
import bpy,bmesh,json,math,hashlib,struct
from pathlib import Path
from mathutils import Vector
BASE=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
OUT=BASE/'assets/models/optimized/moebius-aircraft-v1';EV=BASE/'artifacts/pipeline/moebius-aircraft-v1'
OUT.mkdir(parents=True,exist_ok=True);EV.mkdir(parents=True,exist_ok=True)
SOURCE=BASE/'assets/models/originals/blender-r3/moebiusAircraft.blend';SNAP=BASE/'assets/models/originals/moebiusAircraft.source.json'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
hashes={'blend':sha(SOURCE),'snapshot':sha(SNAP)};snap=json.loads(SNAP.read_text());records={n['id']:n for n in snap['nodes']}
bpy.ops.wm.open_mainfile(filepath=str(SOURCE));source_scene=bpy.context.scene
original={o.get('three_node_id'):o for o in source_scene.objects if o.get('three_node_id')}
scene=bpy.data.scenes.new('Moebius Aircraft V1 Candidate');bpy.context.window.scene=scene;nodes={}
for sid,o in original.items():
 c=o.copy()
 if o.type in ['MESH','LIGHT']:c.data=o.data.copy()
 scene.collection.objects.link(c);nodes[sid]=c
for sid,o in original.items():nodes[sid].parent=nodes.get(o.parent.get('three_node_id'))if o.parent else None;nodes[sid].matrix_parent_inverse=o.matrix_parent_inverse.copy()
bpy.context.view_layer.update()
root=nodes['n0'];root['candidate_id']='moebius-aircraft-v1';root['source_blend_sha256']=hashes['blend'];root['candidate_status']='structure candidate, engine behavior integration pending'
visible=[sid for sid,o in original.items()if o.type=='MESH'and not o.hide_render]
outline=[sid for sid,o in original.items()if o.type=='MESH'and o.hide_render and records[sid]['visible']]
effects=['n62','n63','n64'];added=[]
def count(ns):return sum(sum(len(p.vertices)-2 for p in o.data.polygons)for o in ns if o.type=='MESH'and not o.hide_render)
original_tri=count(original.values())
# Portable source palette; retain original metadata and effective transparency.
materials={}
for mid,src in snap['materials'].items():
 m=bpy.data.materials.new('AircraftV1_Source_'+mid);m.use_nodes=True;bs=m.node_tree.nodes.get('Principled BSDF');alpha=src.get('opacity',1)if src.get('transparent',False)else 1
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
# Preserve the original neon vertex-color data in the portable material graph.
energy=nodes['n14'];m=materials['m4'];bs=m.node_tree.nodes.get('Principled BSDF')
if energy.data.color_attributes:
 vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name=energy.data.color_attributes.active_color.name
 mix=m.node_tree.nodes.new('ShaderNodeMix');mix.data_type='RGBA';mix.blend_type='MULTIPLY';mix.inputs[0].default_value=1;mix.inputs[6].default_value=(*snap['materials']['m4']['color'],1)
 m.node_tree.links.new(vc.outputs['Color'],mix.inputs[7]);m.node_tree.links.new(mix.outputs[2],bs.inputs['Base Color'])
def newmat(name,color,emission=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=0;b.inputs['Roughness'].default_value=.7;b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=emission;m['candidate_new_material']=True;return m
seammat=newmat('AircraftV1_OrangePanelSeam',(.18,.039,.005));throatmat=newmat('AircraftV1_RecessedIntake',(.026,.058,.059));cyanmat=newmat('AircraftV1_IntakeIndicator',(.023,.42,.46),.5)
# Source Three.js coordinate -> archived Blender basis (+Y up becomes +Z).
def conv(p):return Vector((p[0],-p[2],p[1]))
def mesh_root(name,verts,faces,mat,sid=None,parent='n0',slots=None):
 o=nodes[sid]if sid else bpy.data.objects.new(name,bpy.data.meshes.new(name))
 if not sid:scene.collection.objects.link(o);o.parent=nodes[parent];o['candidate_node_id']=name;o['candidate_added']=True;o['source_parent_id']=parent;added.append(o)
 bpy.context.view_layer.update();inv=o.matrix_world.inverted()@root.matrix_world
 mesh=bpy.data.meshes.new(name+'_geometry');mesh.from_pydata([inv@conv(v)for v in verts],[],faces);mesh.update()
 bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.000001);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update()
 for m in ([mat]+(slots or [])):mesh.materials.append(m)
 o.data=mesh;o['candidate_geometry']='moebius-aircraft-v1';return o
# Revolved solid profile: actual bore wall and lip, not a painted opening.
def lathe(profile,segments=12):
 vv=[];ff=[]
 for z,r in profile:
  for i in range(segments):a=2*math.pi*i/segments;vv.append((math.sin(a)*r,math.cos(a)*r,z))
 for j in range(len(profile)-1):
  for i in range(segments):a=j*segments+i;b=j*segments+(i+1)%segments;ff.append((a,b,b+segments,a+segments))
 return vv,ff
v,f=lathe([(3.1,0),(3.1,.42),(3.17,.435),(4.50,.19),(4.58,.18),(4.58,.135),(4.43,.132),(4.15,.10),(4.15,0)])
nose=mesh_root('OriginalNoseHollowCollector',v,f,materials['m6'],'n22',slots=[throatmat])
for poly in nose.data.polygons:
 if poly.index>=5*12:poly.material_index=1
# Extend original detached probe back to its new intake support; local transform untouched.
o=nodes['n30'];inv=o.matrix_world.inverted()@root.matrix_world
for v in o.data.vertices:
 rp=root.matrix_world.inverted()@o.matrix_world@v.co;z=-rp.y;t=(z-4.85)/.7;rp.y=-(4.48+t*1.07);v.co=inv@rp
# Small original-color mechanical struts connecting probe to throat.
def rod(name,a,b,r,mat,parent='n0',sides=6):
 a=Vector(a);b=Vector(b);d=(b-a).normalized();ref=Vector((1,0,0))if abs(d.x)<.8 else Vector((0,1,0));u=d.cross(ref).normalized();w=d.cross(u);vv=[]
 for p in [a,b]:
  for i in range(sides):vv.append(tuple(p+r*(u*math.cos(2*math.pi*i/sides)+w*math.sin(2*math.pi*i/sides))))
 ff=[tuple(reversed(range(sides))),tuple(range(sides,2*sides))]+[(i,(i+1)%sides,(i+1)%sides+sides,i+sides)for i in range(sides)]
 return mesh_root(name,vv,ff,mat,parent=parent)
for i in range(3):
 a=i*2*math.pi/3;rod('intake-probe-support-'+str(i),(0,0,4.49),(.132*math.cos(a),.132*math.sin(a),4.48),.013,materials['m7'])
# A recessed status iris; dynamic suction particles stay an engine effect.
v,f=lathe([(4.17,.08),(4.18,.08),(4.18,0)],12);mesh_root('intake-cyan-iris',v,f,cyanmat)
# Original longitudinal cage hoops remain unchanged; feet tie them to the cone.
for i,z in enumerate([3.5,3.9,4.3]):
 radius=.435+(.19-.435)*(z-3.17)/(4.50-3.17)
 for side in [-1,1]:rod('intake-cage-foot-%d-%d'%(i,side),(0,side*radius,z),(0,side*.4,z),.027,materials['m7'])
# Conformal narrow hull seam lines at three original profile stations.
def radius(z):
 u=z/7+.5;return max(math.sin(math.pi*(u*.92+.04))*1.35*(.55+.45*math.sin(math.pi*u)),.02)
def torus_at_z(z,r,tube,major=12,minor=4):
 vv=[];ff=[]
 for i in range(major):
  a=2*math.pi*i/major
  for j in range(minor):b=2*math.pi*j/minor;rr=r+tube*math.cos(b);vv.append((math.sin(a)*rr,math.cos(a)*rr,z+tube*math.sin(b)))
 for i in range(major):
  for j in range(minor):ff.append((i*minor+j,((i+1)%major)*minor+j,((i+1)%major)*minor+(j+1)%minor,i*minor+(j+1)%minor))
 return vv,ff
for i,z in enumerate([-1.4,.65,2.6]):
 v,f=torus_at_z(z,radius(z)+.007,.006);mesh_root('hull-panel-seam-'+str(i),v,f,seammat)
# A true aft nozzle rim, retaining original n19 transform and its source identity.
v,f=torus_at_z(-2.75,.55,.055,12,6);mesh_root('OriginalAftNozzleRim',v,f,materials['m5'],'n19')
# Slight fin edge relief preserves all four original panels and brown inserts.
for sid in ['n33','n35','n38','n40','n43','n45','n48','n50']:
 o=nodes[sid];bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o
 bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bm.to_mesh(o.data);bm.free()
 mod=o.modifiers.new('Small original fin edge bevel','BEVEL');mod.width=.018;mod.segments=1;bpy.ops.object.modifier_apply(modifier=mod.name)
# External lime cockpit lens over its preserved source anchor. The source opaque
# hull hid the inner core in a correct PBR export; this lens gives a readable window.
vv=[];ff=[];rings=4;steps=16
for j in range(rings+1):
 rr=j/rings
 for i in range(steps):
  a=i*2*math.pi/steps;x=.48*rr*math.cos(a);z=2.0+.66*rr*math.sin(a);r=radius(z);y=math.sqrt(max(0,r*r-x*x))+.035+.13*(1-rr*rr);vv.append((x,y,z))
for j in range(rings):
 for i in range(steps):ff.append((j*steps+i,j*steps+(i+1)%steps,(j+1)*steps+(i+1)%steps,(j+1)*steps+i))
canopy=mesh_root('cockpit-exterior-lime-lens',vv,ff,materials['m3'],parent='n52')
bm=bmesh.new();bm.from_mesh(canopy.data);bm.normal_update()
if sum(f.normal.z for f in bm.faces)<0:bmesh.ops.reverse_faces(bm,faces=list(bm.faces))
bm.to_mesh(canopy.data);bm.free()
# Dark narrow surround seats the new window on the original hull.
for i in range(steps):rod('cockpit-lens-seat-%02d'%i,vv[rings*steps+i],vv[rings*steps+(i+1)%steps],.018,materials['m7'],parent='n52',sides=4)
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
 mesh=bpy.data.meshes.new('AircraftStaticDetails_'+mname);mesh.from_pydata(verts,[],faces);mesh.materials.append(bpy.data.materials[mname]);o=bpy.data.objects.new('aircraft-details-'+pid+'-'+mname,mesh);scene.collection.objects.link(o);o.parent=nodes[pid];o['candidate_node_id']=o.name;o['candidate_added']=True;o['source_parent_id']=pid;o['candidate_components']=json.dumps(parts);new_added.append(o)
 for old in objects:bpy.data.objects.remove(old,do_unlink=True)
added=new_added
# Record exact source node contracts before export.
bpy.context.view_layer.update();matrix_error=max(abs(o.matrix_basis[i][j]-original[sid].matrix_basis[i][j])for sid,o in nodes.items()for i in range(4)for j in range(4));assert matrix_error<1e-6
assert all((o.parent.get('three_node_id')if o.parent else None)==records[sid]['parent']for sid,o in nodes.items())
contract={'sourceNodes':len(nodes),'sourceParentsExact':True,'sourceLocalMatrixMaxError':matrix_error,'rootUserData':records['n0']['userData'],'hiddenDynamicEffectNodes':effects,'hiddenOutlineNodes':outline,'addedNodes':[{'id':o['candidate_node_id'],'parent':o['source_parent_id']}for o in added],'animationNote':'Source references and matrices preserved. No flight, flame pulse, scan, nectar suction or squad behavior is claimed migrated.'}
(EV/'animation-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
# Export hidden old outlines as metadata; scan effects keep their original mesh.
export=bpy.data.scenes.new('Moebius Aircraft V1 GLB Export');copies={}
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
bpy.context.view_layer.objects.active=copies['n0'];glb=OUT/'moebius-aircraft-v1.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,use_active_scene=True,export_yup=True,export_extras=True)
raw=glb.read_bytes();doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]);checks=[]
for m in doc['materials']:
 mid=m.get('extras',{}).get('three_uuid')
 if not mid:continue
 src=snap['materials'][mid];alpha=src.get('opacity',1)if src.get('transparent',False)else 1;want=src.get('color',[1,1,1])+[alpha];actual=m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1]);error=max(abs(a-b)for a,b in zip(want,actual));assert error<1e-6,(mid,want,actual);checks.append({'id':mid,'factor':actual,'error':error,'alphaMode':m.get('alphaMode','OPAQUE')})
roundtrip=bpy.data.scenes.new('Moebius Aircraft V1 GLB Reimport');bpy.context.window.scene=roundtrip;bpy.ops.import_scene.gltf(filepath=str(glb));rn={o.get('three_node_id'):o for o in roundtrip.objects if o.get('three_node_id')};assert set(rn)==set(nodes)
for o in roundtrip.objects:
 if o.get('source_visible')==False or o.get('candidate_hidden_outline',False):o.hide_render=True
# Fair review cameras on source/candidate union, identical lights and exposure.
def bounds(objects):return [o.matrix_world@v.co for o in objects if o.type=='MESH'and not o.hide_render for v in o.data.vertices]
points=bounds(original.values())+bounds(list(nodes.values())+added);lo=Vector(tuple(min(p[i]for p in points)for i in range(3)));hi=Vector(tuple(max(p[i]for p in points)for i in range(3)));center=(lo+hi)/2;span=max(hi-lo);direction=Vector((3,-4,2.2)).normalized()
views=[('full-three-quarter',center,7.8),('intake-interface',conv((0,0,4.0)),2.5),('cockpit-interface',conv((0,.65,1.9)),2.75),('tail-interface',conv((0,0,-2.9)),4.2)];review=[]
for sc,label in [(source_scene,'before'),(scene,'after'),(roundtrip,'glb-roundtrip')]:
 bpy.context.window.scene=sc;sc.render.engine='CYCLES';sc.cycles.samples=16;sc.cycles.max_bounces=4;sc.render.resolution_x=1200;sc.render.resolution_y=1200;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX'
 # Source lights retained at their original values in all three scenes.
 world=bpy.data.worlds.new('AircraftReviewWorld_'+label);world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.38,.41,1);world.node_tree.nodes['Background'].inputs[1].default_value=.7;sc.world=world
 for name,offset,energy,size in [('Key',(-3,-4,6),1100,4),('Fill',(4,-1,3),700,4),('Rim',(1,4,5),1000,3)]:
  ld=bpy.data.lights.new('AircraftReview'+name,'AREA');lamp=bpy.data.objects.new('AircraftReview'+name,ld);sc.collection.objects.link(lamp);lamp.location=center+Vector(offset);lamp.rotation_euler=(center-lamp.location).to_track_quat('-Z','Y').to_euler();ld.energy=energy;ld.size=size
 cd=bpy.data.cameras.new('AircraftReviewCamera');cam=bpy.data.objects.new('AircraftReviewCamera',cd);sc.collection.objects.link(cam);sc.camera=cam;cd.type='ORTHO'
 for view,target,ortho in views:
  cam.location=target+direction*span*2;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=ortho;sc.render.filepath=str(EV/(label+'-'+view+'.png'));bpy.ops.render.render(write_still=True);review.append({'state':label,'view':view,'camera':list(cam.location),'target':list(target),'orthoScale':ortho})
bpy.context.window.scene=scene;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'moebius-aircraft-v1.blend'))
assert hashes=={'blend':sha(SOURCE),'snapshot':sha(SNAP)}
report={'status':'Blender structural candidate, not integrated','sourceHashesBefore':hashes,'sourceHashesAfter':{'blend':sha(SOURCE),'snapshot':sha(SNAP)},'sourceVisibleTriangles':original_tri,'candidateVisibleTriangles':count(list(nodes.values())+added),'candidateVisibleMeshes':sum(o.type=='MESH'and not o.hide_render for o in list(nodes.values())+added),'contract':contract,'glbSha256':sha(glb),'blendSha256':sha(OUT/'moebius-aircraft-v1.blend'),'sourceMaterialChecks':checks,'review':review,'changes':['Open cream intake with recessed inner wall and cyan indicator','Probe geometry extended to intake, three small support struts, original cage feet attached','Three conformal orange hull seams','Lime cockpit external lens and seated border parented to original cockpit anchor','Original aft rim geometry corrected to nozzle axis without modifying node transform','Eight original fin/inset panels receive small edge bevel'],'limits':['Toon ramp and additive blends require engine adaptation','Three scan meshes keep original geometry and source_visible=false metadata; importer must honor it (as roundtrip review does)','No flock, combat, suction or flame animation port is claimed','No runtime integration or LOD switching']}
(EV/'report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'trianglesBefore':original_tri,'trianglesAfter':report['candidateVisibleTriangles'],'sourceHashUnchanged':True,'glb':str(glb)}))
