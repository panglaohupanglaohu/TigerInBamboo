"""Read-only source based Kun mouth candidate. Run in background Blender only."""
import bpy, json, math, hashlib, struct, sys
from pathlib import Path
from mathutils import Matrix, Vector

ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/models/optimized/kun-battle-v1'
ART=ROOT/'artifacts/pipeline/kun-battle-v1'
SOURCE=ROOT/'assets/models/originals/leviathan/blender-r3/leviathanIsland.blend'
SNAP=ROOT/'assets/models/originals/leviathan/leviathanIsland.source.json'
C=Matrix.Rotation(math.pi/2,4,'X');CI=C.inverted(); H=Vector((24,-11.5,0))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def seam(p):return p.y-(H.y+(p.x-H.x)*(-7.4-H.y)/(43-H.x))
def flat(m):return [m[r][c] for c in range(4) for r in range(4)]
def mat(name,col):
 m=bpy.data.materials.new(name);m.diffuse_color=(*col,1);m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF');bs.inputs['Base Color'].default_value=(*col,1);bs.inputs['Roughness'].default_value=.85
 return m
def mesh(name,vs,fs,parent,material,tag,colors=None):
 d=bpy.data.meshes.new(name);d.from_pydata([C.to_3x3()@Vector(p) for p in vs],[],fs);d.update()
 o=bpy.data.objects.new(name,d);bpy.context.scene.collection.objects.link(o);o.parent=parent;o['kun_added_id']=tag
 if material:d.materials.append(material)
 if colors:
  a=d.color_attributes.new(name='OriginalColor',type='FLOAT_COLOR',domain='POINT')
  for v,col in zip(a.data,colors):v.color=(*col[:3],1)
 return o
def clip(poly,fn,positive=True):
 out=[]
 for a,b in zip(poly,poly[1:]+poly[:1]):
  da=fn(a[0])*(1 if positive else -1);db=fn(b[0])*(1 if positive else -1)
  if da>=-1e-7:out.append(a)
  if (da>0 and db<0) or (da<0 and db>0):
   t=da/(da-db);out.append((a[0].lerp(b[0],t),a[1].lerp(b[1],t)))
 return out
def poly_mesh(name,polys,parent,material,tag,transform=lambda p:p):
 vs=[];cs=[];fs=[]
 for poly in polys:
  if len(poly)<3:continue
  k=len(vs);vs.extend(transform(p) for p,c in poly);cs.extend(c for p,c in poly)
  fs.extend((k,k+i,k+i+1) for i in range(1,len(poly)-1))
 return mesh(name,vs,fs,parent,material,tag,cs)
def inflate_weight(p):
 return max(0,min(1,(p.x-H.x)/5))*max(0,min(1,(43-p.x)/7))*max(0,min(1,(-seam(p))/3))
def tube(name,points,r,parent,material,tag):
 vs=[];fs=[]
 for i,p in enumerate(points):
  tangent=points[(i+1)%len(points)]-points[i-1];tangent.normalize()
  a=tangent.cross(Vector((0,1,0))).normalized();b=tangent.cross(a).normalized()
  vs.extend(p+r*(math.cos(j*math.tau/6)*a+math.sin(j*math.tau/6)*b) for j in range(6))
 for i in range(len(points)):
  for j in range(6):fs.append((i*6+j,i*6+(j+1)%6,((i+1)%len(points))*6+(j+1)%6,((i+1)%len(points))*6+j))
 return mesh(name,vs,fs,parent,material,tag)

def run():
 sourcehash=sha(SOURCE);data=json.loads(SNAP.read_text());bpy.ops.wm.open_mainfile(filepath=str(SOURCE));sc=bpy.context.scene
 nodes={o['three_node_id']:o for o in sc.objects if 'three_node_id' in o};root=nodes['n0'];body=nodes['n1']
 baseline={k:(o.parent.get('three_node_id') if o.parent else None,flat(o.matrix_basis)) for k,o in nodes.items()}
 island=[n['id'] for n in data['nodes'] if 102<=int(n['id'][1:])<=174]
 island_hash={k:sha_bytes(json.dumps(([list(v.co) for v in nodes[k].data.vertices] if nodes[k].type=='MESH' else [],flat(nodes[k].matrix_basis)))) for k in island}
 g=data['geometries']['g0'];ps=g['attributes']['position']['values'];cs=g['attributes']['color']['values'];idx=g['index']['values'] if isinstance(g['index'],dict) else g['index']
 vertices=[(Vector((ps[i]*4.5,ps[i+1]*1.3-4.4,ps[i+2]*2.2)),Vector(cs[i:i+3])) for i in range(0,len(ps),3)]
 fixed=[];lower=[]
 for t in range(0,len(idx),3):
  poly=[vertices[j] for j in idx[t:t+3]];rear=clip(poly,lambda p:p.x-H.x,False);fore=clip(poly,lambda p:p.x-H.x)
  if len(rear)>=3:fixed.append(rear)
  upper=clip(fore,seam);bottom=clip(fore,seam,False)
  if len(upper)>=3:fixed.append(upper)
  if len(bottom)>=3:lower.append(bottom)
 # Preserve the original body object and transform; only split its head surface.
 tmp=poly_mesh('Kun upper hull',fixed,root,body.data.materials[0],'add:temp',lambda p:Vector((p.x/4.5,(p.y+4.4)/1.3,p.z/2.2)))
 body.data=tmp.data;bpy.data.objects.remove(tmp,do_unlink=True)
 nodes['n2'].hide_render=True;nodes['n2']['candidateHidden']=True
 jaw=bpy.data.objects.new('Kun lower jaw pivot',None);sc.collection.objects.link(jaw);jaw.parent=root;jaw.location=C.to_3x3()@H;jaw['kun_added_id']='add:jaw-pivot'
 shell=poly_mesh('Kun lower jaw warm pale shell',lower,jaw,body.data.materials[0],'add:jaw-shell',lambda p:p-H)
 shell.shape_key_add(name='Basis');inflate=shell.shape_key_add(name='ThroatInflation')
 for v in inflate.data:
  p=CI.to_3x3()@v.co+H;v.co.z-=7*inflate_weight(p)
 boundary={tuple(round(float(x),5) for x in p) for poly in lower for p,c in poly if abs(seam(p))<1e-4}
 rim=sorted([Vector(p) for p in boundary],key=lambda p:math.atan2(p.z,p.x-32))
 interior=mat('Kun non-emissive warm dark gray lower mouth',(.105,.096,.083));roofmat=mat('Kun non-emissive charcoal upper palate',(.070,.064,.057));lipmat=mat('Kun pale lip edge',(.64,.61,.55));line=mat('Kun fine closed mouth seam',(.065,.062,.058))
 center=sum(rim,Vector())/len(rim)
 # Recessed roof and jaw lining create a true dark volume when the jaw opens.
 roof=[center+Vector((0,.08,0))]+[p+Vector((0,.025,0)) for p in rim]
 fs=[(0,i+1,(i+1)%len(rim)+1) for i in range(len(rim))]
 mesh('Kun mouth roof',roof,fs,root,roofmat,'add:mouth-roof')
 inner=[center+(p-center)*.88+Vector((0,-.65,0)) for p in rim]
 floor=[center-H+Vector((0,-3.5,0))]+[p-H for p in inner]
 mesh('Kun recessed lower mouth lining',floor,[tuple(reversed(f)) for f in fs],jaw,interior,'add:mouth-floor')
 band=[p-H+Vector((0,-.08,0)) for p in rim]+[p-H for p in inner]
 mesh('Kun thick warm pale jaw rim',band,[(i,(i+1)%len(rim),(i+1)%len(rim)+len(rim),i+len(rim)) for i in range(len(rim))],jaw,lipmat,'add:jaw-rim-thickness')
 tube('Kun upper mouth line',rim,.065,root,line,'add:upper-lip-line')
 lowerlip=tube('Kun lower pale lip',[p-H+Vector((0,-.11,0)) for p in rim],.15,jaw,lipmat,'add:lower-lip')
 lowerlip.shape_key_add(name='Basis');lip_open=lowerlip.shape_key_add(name='LipFullness')
 for i,p in enumerate(rim):
  centerlocal=C.to_3x3()@(p-H+Vector((0,-.11,0)))
  for j in range(6):v=lip_open.data[i*6+j];v.co=centerlocal+(v.co-centerlocal)*2.6
 # Rear gular membrane follows the jaw hinge without moving the island or eyes.
 arc={tuple(round(float(x),5) for x in p) for poly in lower for p,c in poly if abs(p.x-H.x)<1e-4}
 arc=sorted([Vector(p) for p in arc],key=lambda p:math.atan2(p.y-H.y,p.z))
 vs=[p+Vector((-1,0,0)) for p in arc]+arc;faces=[(i,i+1,len(arc)+i+1,len(arc)+i) for i in range(len(arc)-1)]
 throat=mesh('Kun flexible rear throat',vs,faces,root,lipmat,'add:throat-membrane');throat.shape_key_add(name='Basis')
 turn_sin=throat.shape_key_add(name='JawTurnSin');turn_cos=throat.shape_key_add(name='JawTurnCos');maximum=math.radians(38)
 for i,p in enumerate(arc):
  d=p-H
  turn_sin.data[len(arc)+i].co=C.to_3x3()@(p+Vector((d.y,-d.x,0))*math.sin(maximum))
  turn_cos.data[len(arc)+i].co=C.to_3x3()@(p+Vector((-d.x,-d.y,0))*(1-math.cos(maximum)))
 throat['jawCoupling']='Exact rotation: JawTurnSin=sin(theta)/sin(38deg); JawTurnCos=(1-cos(theta))/(1-cos(38deg)); theta=38deg*jawOpen01'
 poses=[('closed',1,0,0),('open',31,1,.45),('engulf',61,1,1),('recover',91,.4,.35),('closed_end',121,0,0)]
 sc.render.fps=30;sc.frame_start=1;sc.frame_end=121
 samples=[]
 for frame in range(1,122):
  a,b=next(((a,b) for a,b in zip(poses,poses[1:]) if a[1]<=frame<=b[1]),(poses[-1],poses[-1]))
  t=(frame-a[1])/max(1,b[1]-a[1]);t=t*t*(3-2*t);amount=a[2]+(b[2]-a[2])*t;pouch=a[3]+(b[3]-a[3])*t;theta=maximum*amount
  jaw.rotation_euler=(0,theta,0);jaw.keyframe_insert('rotation_euler',frame=frame)
  turn_sin.value=math.sin(theta)/math.sin(maximum);turn_sin.keyframe_insert('value',frame=frame)
  turn_cos.value=(1-math.cos(theta))/(1-math.cos(maximum));turn_cos.keyframe_insert('value',frame=frame)
  inflate.value=pouch;inflate.keyframe_insert('value',frame=frame)
  lip_open.value=amount;lip_open.keyframe_insert('value',frame=frame)
  samples.append({'frame':frame,'jawOpen01':amount,'throatInflation':pouch,'jawLocalMatrix':flat(CI@jaw.matrix_basis@C),'morphs':{'add:throat-membrane':{'JawTurnSin':turn_sin.value,'JawTurnCos':turn_cos.value},'add:jaw-shell':{'ThroatInflation':pouch},'add:lower-lip':{'LipFullness':amount}}})
 for name,f,amount,pouch in poses:sc.timeline_markers.new(name,frame=f)
 for owner in [jaw,throat.data.shape_keys,shell.data.shape_keys,lowerlip.data.shape_keys]:
  action=owner.animation_data.action
  for layer in action.layers:
   for strip in layer.strips:
    for bag in strip.channelbags:
     for curve in bag.fcurves:
      for key in curve.keyframe_points:key.interpolation='LINEAR'
 sc.frame_set(1);bpy.context.view_layer.update()
 setup_review(sc,nodes,root)
 OUT.mkdir(parents=True,exist_ok=True);ART.mkdir(parents=True,exist_ok=True)
 for o in nodes.values():
  if o.hide_render:o['candidateHidden']=True
 root['candidateVersion']='kun-battle-v1';root['runtimeGardenScenesBaked']=False
 bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'kun-battle-v1.blend'))
 for name,f,amount,pouch in poses[:3]:
  sc.frame_set(f);sc.render.filepath=str(ART/(name+'-three-quarter.png'));bpy.ops.render.render(write_still=True)
  print('KUN_RENDER_READY',name,flush=True)
 for name,f,amount,pouch in poses[:3]:
  sc.frame_set(f);cam=sc.camera;center=root.matrix_world@(C.to_3x3()@Vector((33,-10,0)))
  cam.location=center+Vector((3,-4,1.2)).normalized()*100;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=17
  sc.render.filepath=str(ART/(name+'-mouth-detail.png'));bpy.ops.render.render(write_still=True)
  cam.location=center+Vector((1.1,-4,-1.0)).normalized()*100;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=19
  sc.render.filepath=str(ART/(name+'-mouth-side-below.png'));bpy.ops.render.render(write_still=True)
 sc.frame_set(1);export_glb(nodes)
 assert sha(SOURCE)==sourcehash
 assert all((o.parent.get('three_node_id') if o.parent else None,flat(o.matrix_basis))==baseline[k] for k,o in nodes.items())
 assert all(sha_bytes(json.dumps(([list(v.co) for v in nodes[k].data.vertices] if nodes[k].type=='MESH' else [],flat(nodes[k].matrix_basis))))==island_hash[k] for k in island)
 report={'stage':'mouth candidate, visual review pending','sourceBlend':str(SOURCE.relative_to(ROOT)),'sourceSha256':sourcehash,'reference':{'path':'assets/concepts/kun-battle-target-v1.png','sha256':sha(ROOT/'assets/concepts/kun-battle-target-v1.png')},'originalNodes':len(nodes),'originalParentsAndMatricesUnchanged':True,'islandGeometryAndMatricesUnchanged':True,'islandNode':'n102','plateY':6.08,'runtimeGardenScale':.43,'rootScale':.5,'runtimeGardenScenesBaked':False,'axes':'Three +X forward,+Y up; Blender C=RotX(+90deg)','jawPivotThree':list(H),'jawRotationThreeZDegrees':-38,'addedNodes':[{'id':o['kun_added_id'],'parentId':o.parent.get('kun_added_id',o.parent.get('three_node_id')),'name':o.name,'localMatrix':flat(CI@o.matrix_basis@C)} for o in sc.objects if 'kun_added_id' in o],'poses':[{'name':n,'frame':f,'jawOpen01':a,'throatInflation':p} for n,f,a,p in poses],'poseFrames':samples,'fps':30,'glbPose':'closed, frame 1; morph targets retained, no animation clips','throatCoupling':throat['jawCoupling'],'morphEndpointIndices':list(range(len(arc),len(arc)*2)),'morphEndpointOriginalPoints':[list(p) for p in arc],'runtimeIntegrated':False,'limitations':['Authored 121-frame review cycle; not original battle timing or gameplay acceptance.','Between-frame subframe interpolation is linear; exact coupling is sampled at 30 Hz and analytic formula is provided.','The six runtime garden scenes must still be attached to original n102; reference-image decorative garden is not baked.']}
 report['files']={p.name:{'path':str(p.relative_to(ROOT)),'sha256':sha(p)} for p in [OUT/'kun-battle-v1.blend',OUT/'kun-battle-v1.glb']}
 report['glbMaterialContract']='Original source linear base colors, opacity, metallic, roughness and basic-material emissive colors restored explicitly after glTF export. Original toon/brush engine shader parity is not claimed.'
 (OUT/'kun-battle-v1.assembly.json').write_text(json.dumps(report,indent=2))
 # Source comparison uses the same fixed studio setup and whole-body bounds.
 bpy.ops.wm.open_mainfile(filepath=str(SOURCE));sc=bpy.context.scene;ns={o['three_node_id']:o for o in sc.objects if 'three_node_id' in o};bpy.context.view_layer.update();setup_review(sc,ns,ns['n0']);sc.render.filepath=str(ART/'before-three-quarter.png');bpy.ops.render.render(write_still=True)
 assert sha(SOURCE)==sourcehash

def export_glb(nodes):
 sc=bpy.context.scene;bpy.ops.object.select_all(action='DESELECT')
 selected=list(nodes.values())+[o for o in sc.objects if 'kun_added_id' in o]
 for o in selected:o.hide_viewport=False;o.hide_set(False);o.select_set(True)
 path=OUT/'kun-battle-v1.glb';bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_extras=True,export_yup=True,export_animations=False,export_current_frame=True,export_morph=True,export_vertex_color='ACTIVE',export_all_vertex_colors=True)
 raw=path.read_bytes();length,typ=struct.unpack_from('<II',raw,12);doc=json.loads(raw[20:20+length]);tail=raw[20+length:]
 original_matrices={n['id']:n['matrix'] for n in json.loads(SNAP.read_text())['nodes']}
 for n in doc.get('nodes',[]):
  node_id=n.get('extras',{}).get('three_node_id')
  if node_id in original_matrices:
   # The exporter recomputes child matrices through scaled world matrices, losing
   # up to 2e-5 on archived outline identity transforms. Preserve source numbers.
   for key in ['translation','rotation','scale']:n.pop(key,None)
   n['matrix']=original_matrices[node_id]
  if n.get('extras',{}).get('candidateHidden') and 'mesh' in n:n['extras']['archivedHiddenMeshIndex']=n.pop('mesh')
 for material in doc.get('materials',[]):
  encoded=material.get('extras',{}).get('three_source')
  if not encoded:continue
  original=json.loads(encoded);color=original.get('color',[1,1,1])
  pbr=material.setdefault('pbrMetallicRoughness',{});pbr['baseColorFactor']=[*color,original.get('opacity',1)]
  pbr['metallicFactor']=original.get('metalness',0);pbr['roughnessFactor']=original.get('roughness',.85)
  material['emissiveFactor']=color if original.get('type')=='MeshBasicMaterial' else original.get('emissive',[0,0,0])
  material['extras']['originalColorFactorRestored']=True
 js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
 path.write_bytes(struct.pack('<III',0x46546c67,2,20+len(js)+len(tail))+struct.pack('<II',len(js),typ)+js+tail)

def sha_bytes(s):return hashlib.sha256(s.encode()).hexdigest()
def setup_review(sc,nodes,root):
 sc.render.engine='CYCLES';sc.cycles.samples=24;sc.render.resolution_x=1300;sc.render.resolution_y=1000;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX'
 world=bpy.data.worlds.new('Kun neutral reference studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.39,.45,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;sc.world=world
 points=[o.matrix_world@v.co for o in sc.objects if o.type=='MESH' and not o.hide_render for v in o.data.vertices];lo=Vector(tuple(min(p[k] for p in points) for k in range(3)));hi=Vector(tuple(max(p[k] for p in points) for k in range(3)));center=(lo+hi)/2;radius=(hi-lo).length/2
 for name,off,power,size in [('Key',(2,-3,4),200,4),('Fill',(-2,-1,2),80,3),('Rim',(0,3,3),140,2)]:
  o=bpy.data.objects.new(name,bpy.data.lights.new(name,'AREA'));sc.collection.objects.link(o);o.location=center+Vector(off)*radius;o.data.energy=power*radius*radius;o.data.size=size*radius;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
 cam=bpy.data.objects.new('Kun review camera',bpy.data.cameras.new('Kun review camera'));sc.collection.objects.link(cam);sc.camera=cam;cam.location=center+Vector((3,-4,2.2)).normalized()*radius*6;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=radius*1.75;cam.data.clip_end=radius*20

if __name__=='__main__':run()
