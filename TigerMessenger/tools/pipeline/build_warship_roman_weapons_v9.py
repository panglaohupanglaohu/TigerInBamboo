"""Stow the 25 landing soldiers' accepted weapons in the ship centre."""
import bpy,bmesh,json,math,importlib.util,hashlib
from pathlib import Path
from mathutils import Matrix,Vector
ROOT=Path(__file__).resolve().parents[2]
sp=importlib.util.spec_from_file_location('ship',ROOT/'tools/pipeline/build_warship_battle_blender.py');s=importlib.util.module_from_spec(sp);sp.loader.exec_module(s)
OUT=ROOT/'assets/models/optimized/warship-battle-v9';ART=ROOT/'artifacts/pipeline/warship-roman-crew'
bpy.ops.wm.open_mainfile(filepath=str(OUT/'warship-battle-v9.blend'))
for o in list(bpy.context.scene.objects):
 if str(s.ident(o)).startswith('add:stored-'):bpy.data.objects.remove(o,do_unlink=True)
obs={s.ident(o):o for o in bpy.context.scene.objects if s.ident(o)};root=obs['n0'];cache={};provenance={}
def donor(role,kind):
 key=(role,kind)
 if key in cache:return cache[key]
 path=ROOT/'assets/models/optimized/roman-family-v1'/('romanSoldier_'+role+'_blue.blend')
 with bpy.data.libraries.load(str(path),link=False) as (src,dst):dst.objects=list(src.objects)
 imports=[o for o in dst.objects if o]
 for o in imports:bpy.context.scene.collection.objects.link(o)
 nodes={o.get('three_node_id',o.get('roman_family_added_id')):o for o in imports if o.get('three_node_id',o.get('roman_family_added_id'))}
 assembly=json.loads(path.with_suffix('.assembly.json').read_text());p=assembly['poseFrames'][0]
 for tag,value in p['transforms'].items():
  if tag in nodes:nodes[tag].animation_data_clear();s.setm(nodes[tag],s.mat(value))
 bpy.context.view_layer.update();pivot=nodes['n32' if kind=='shield' else 'n41' if role=='spear' else 'n50']
 def inside(o):
  if o==pivot:return True
  return o.parent is not None and inside(o.parent)
 pieces=[o for o in imports if o.type=='MESH' and not o.hide_render and not o.get('candidateHidden') and inside(o)]
 vv=[];ff=[];mi=[];mats=[];ids=[]
 for o in pieces:
  m=s.CI@pivot.matrix_world.inverted()@o.matrix_world;off=len(vv);vv.extend(m@v.co for v in o.data.vertices);ids.append(o.get('three_node_id',o.get('roman_family_added_id')))
  remap=[]
  for material in o.data.materials:
   if material not in mats:mats.append(material)
   remap.append(mats.index(material))
  for poly in o.data.polygons:ff.append(tuple(off+i for i in poly.vertices));mi.append(remap[min(poly.material_index,len(remap)-1)])
 rotate=Matrix.Rotation(-math.pi/2,4,'Y') if kind=='shield' else Matrix.Rotation(-math.pi/2,4,'Z')
 vv=[rotate@v for v in vv];center=Vector(tuple((min(v[k] for v in vv)+max(v[k] for v in vv))/2 for k in range(3)));vv=[v-center for v in vv]
 data=bpy.data.meshes.new('Stored_approved_'+role+'_'+kind);data.from_pydata([s.C.to_3x3()@v for v in vv],[],ff)
 for material in mats:data.materials.append(material)
 for poly,index in zip(data.polygons,mi):poly.material_index=index;poly.use_smooth=False
 bm=bmesh.new();bm.from_mesh(data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(data);bm.free();data.update()
 cache[key]=data;provenance[role+'_'+kind]={'source':str(path.relative_to(ROOT)),'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'nodes':ids,'vertices':len(vv)}
 for o in imports:bpy.data.objects.remove(o,do_unlink=True)
 return data
items=[];rolecounts={'spear':0,'gladius':0,'longbow':0};shieldcount=0
for i in range(25):
 ix=i%5;iz=i//5;cheb=max(abs(ix-2),abs(iz-2));man=abs(ix-2)+abs(iz-2);role='spear' if cheb>=2 else 'gladius' if man==2 else 'longbow';j=rolecounts[role];rolecounts[role]+=1
 kinds=['weapon','shield'] if role!='longbow' else ['weapon']
 for kind in kinds:
  data=donor(role,kind);tag='add:stored-weapon-'+str(i)+'-'+kind
  if kind=='shield':
   x=[-1.60,-1.3,-1,-.7,-.4,-.1,.2,.94,1.24,1.54][shieldcount%10];y=.86;z=-.035 if shieldcount<10 else .035;shieldcount+=1
  elif role=='spear':x=-.95 if j<8 else 1.20;y=.706+(j%4)*.021;z=-.02 if j%8<4 else .02
  elif role=='gladius':x=-1.4+j*.35;y=.82;z=0
  else:x=-1.1 if j<3 else 1.15;y=.805+(j%3)*.014;z=0
  o=bpy.data.objects.new('Stowed '+role+' '+kind+' crew '+str(i),data);bpy.context.scene.collection.objects.link(o);o.parent=root;s.setm(o,Matrix.Translation((x,y,z)));o['warship_added_id']=tag;o['warship_crew_index']=i;o['warship_weapon_role']=role;o['warship_weapon_kind']=kind;obs[tag]=o;items.append({'id':tag,'crewIndex':i,'role':role,'kind':kind,'position':[x,y,z]})
# Two centre saddles support the longitudinal slots without a mast collision.
wood=obs['n231'].data.materials[0]
for j,x in enumerate([-1.42,-.49,.94,1.46]):
 o=s.box('Central weapon cradle '+str(j),(.035,.035,.16),(x,.684,0),root,wood,'add:stored-rack-'+str(j),.003);obs[s.ident(o)]=o
a=json.loads((OUT/'warship-battle-v9.assembly.json').read_text());a['storedWeapons']={'slots':items,'roleCounts':rolecounts,'count':25,'pieces':len(items),'crewIndex25':'remaining rowing station, not part of 5x5 landing formation','sourceGeometry':provenance,'layout':'longitudinal central slots split either side of mast; vertical shields in two thin rows'}
for item in items:a['addedNodes'].append({'id':item['id'],'parent':'n0','name':obs[item['id']].name})
for tag,o in obs.items():
 if tag.startswith('add:stored-'):a['restTransforms'][tag]=s.flat(s.local(o))
bpy.context.scene.frame_set(1);bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'warship-battle-v9.blend'));s.export_warship(list(obs.values()),OUT/'warship-battle-v9.glb');(OUT/'warship-battle-v9.assembly.json').write_text(json.dumps(a,separators=(',',':')))
(ART/'stored-weapons.json').write_text(json.dumps(a['storedWeapons'],indent=2))
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(OUT/'warship-battle-v9.glb'));sc=bpy.context.scene;s.v.studio(sc);sc.render.resolution_x=1400;sc.render.resolution_y=1000
for name,center,direction,scale in [('three-quarter',(.25,0,1.75),(5,-7,4),7.9),('crew-close',(-.8,.20,1.09),(.4,3,1.2),1.25),('stored-weapons',(-.10,0,.80),(0,-.01,4),4.3)]:
 target=Vector(center);sc.camera.location=target+Vector(direction);sc.camera.rotation_euler=(target-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.camera.data.ortho_scale=scale;sc.render.filepath=str(ART/(name+'.png'));bpy.ops.render.render(write_still=True)
print('STORED_WEAPONS_READY',hashlib.sha256((OUT/'warship-battle-v9.glb').read_bytes()).hexdigest(),flush=True)
