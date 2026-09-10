"""One same-camera batch render: 25 original sources alongside 25 actual LOD0 GLBs."""
import bpy,json,math,hashlib,sys
from pathlib import Path
from mathutils import Vector,Matrix
B=Path(__file__).resolve().parents[2];SRC=B/'assets/models/originals/saihoji-pines-r1';OUT=B/'assets/models/optimized/saihoji-pines-v1';EV=B/'artifacts/pipeline/saihoji-pines-v1';manifest=json.loads((SRC/'manifest.json').read_text());page=int(sys.argv[sys.argv.index('--')+1]) if '--' in sys.argv else 0;entries=manifest['files'][page*5:(page+1)*5];assert len(entries)==5;bpy.ops.wm.read_factory_settings(use_empty=True);sc=bpy.context.scene
sc.render.engine='CYCLES';sc.cycles.use_auto_tile=False;sc.cycles.samples=16;sc.cycles.max_bounces=4;sc.render.resolution_x=960;sc.render.resolution_y=750;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX';world=bpy.data.worlds.new('Pine family studio');world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.42,.45,.47,1);world.node_tree.nodes['Background'].inputs[1].default_value=.8;sc.world=world
D=Vector((3,-4,2.2)).normalized();rotation=(-D).to_track_quat('-Z','Y');right=rotation@Vector((1,0,0));up=rotation@Vector((0,1,0));cam=bpy.data.objects.new('25-seed contact sheet camera',bpy.data.cameras.new('25-seed contact sheet camera'));sc.collection.objects.link(cam);cam.location=D*130;cam.rotation_mode='QUATERNION';cam.rotation_quaternion=rotation;cam.data.type='ORTHO';cam.data.ortho_scale=29;cam.data.clip_end=500;sc.camera=cam

def material(name,color,emission=False):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes.get('Principled BSDF');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=.85
 if emission:b.inputs['Emission Color'].default_value=(*color,1);b.inputs['Emission Strength'].default_value=1
 return m
textmat=material('Contact sheet label',(.025,.034,.040),True)
def label(body,pos,size):
 d=bpy.data.curves.new('Label '+body,'FONT');d.body=body;d.align_x='CENTER';d.size=size;o=bpy.data.objects.new('Label '+body,d);sc.collection.objects.link(o);o.location=pos+D*2;o.rotation_mode='QUATERNION';o.rotation_quaternion=rotation;d.materials.append(textmat)
label('SAIHOJI / ORIGINAL PINE SEEDS / PAGE '+str(page+1)+' OF 5',up*10.5,.45);label('Left: original   |   Right: actual GLB   |   Same camera, scale and Cycles light',up*9.8,.25)
# Directional studio lighting keeps all 50 trees under the same illumination.
for name,direction,energy,angle in [('Key',Vector((-3,-4,6)),2.5,.15),('Fill',Vector((4,-1,3)),1.0,.25)]:
 d=bpy.data.lights.new(name,'SUN');d.energy=energy;d.angle=angle;o=bpy.data.objects.new(name,d);sc.collection.objects.link(o);o.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
rows=[];by_seed={r['seed']:r for r in json.loads((OUT/'manifest.json').read_text())['seeds']}
for index,entry in enumerate(entries):
 seed=entry['seed'];stem='ancient-pine-'+str(seed);base=right*((index%2-.5)*12.5)+up*((1-index//2)*6.4-1.0);slot_before=base-right*2.8-up*2.2;slot_after=base+right*2.8-up*2.2
 source=SRC/'blender-r3'/(stem+'.blend');sourcehash=hashlib.sha256(source.read_bytes()).hexdigest()
 with bpy.data.libraries.load(str(source),link=False) as (a,b):b.objects=a.objects
 ns={o.get('three_node_id'):o for o in b.objects if o and o.get('three_node_id')}
 for o in ns.values():sc.collection.objects.link(o)
 pal=json.loads((SRC/(stem+'.source.json')).read_text())['materials']
 for sid in ['n8','n9','n10','n11','n12']:
  o=ns[sid];o.data=o.data.copy()
  for mi,old in enumerate(list(o.data.materials)):o.data.materials[mi]=material('Source '+str(seed)+' '+str(mi),pal[old['three_uuid']]['color'])
 ns['n0'].location+=slot_before;ns['n0']['review_seed']=seed;ns['n0']['review_role']='actual archived source'
 before=set(sc.objects);path=OUT/str(seed)/(stem+'-lod0.glb');hash=hashlib.sha256(path.read_bytes()).hexdigest();bpy.ops.import_scene.gltf(filepath=str(path));imported=set(sc.objects)-before;rn={o.get('three_node_id'):o for o in imported if o.get('three_node_id')};assert len(rn)==17
 rn['n0'].location+=slot_after;rn['n0']['review_seed']=seed;rn['n0']['review_role']='actual GLB reimport'
 for o in imported:
  if o.get('candidate_hidden_source_geometry'):o.hide_render=True
 label(str(seed)+' / '+entry['zone'],base+up*3.45,.33);counts=[r['triangles'] for r in by_seed[seed]['lods']];label('SOURCE',base-right*2.8-up*2.75,.25);label('GLB  '+('/'.join(map(str,counts)))+' tris',base+right*2.8-up*2.75,.23)
 rows.append({'seed':seed,'zone':entry['zone'],'sourceBlendSHA256':sourcehash,'actualGlbSHA256':hash,'sourceObjectCount':17,'importedObjectCount':17,'lodTriangles':counts,'sourceReviewOffset':list(slot_before),'candidateReviewOffset':list(slot_after),'worldPlacementBaked':False})
# 960x750 x conservative 128 bytes/pixel = 92.16 MB temporary ceiling;
# default Combined pass only, 1 page/process. Do not save another scene copy.
assert sc.render.resolution_x*sc.render.resolution_y*128 < 100_000_000
name='five-seeds-page-'+str(page+1)
sc.render.filepath=str(EV/(name+'.png'));bpy.ops.render.render(write_still=True)
(EV/(name+'-evidence.json')).write_text(json.dumps({'rows':rows,'sameCameraLightScale':True,'actualGlbImport':True,'renderEngine':'CYCLES','resolution':[960,750],'samples':16,'renderPasses':1,'scope':'Five pairs per page; all image sources match current candidate GLB hashes. Review board only, not world integration.'},indent=2)+'\n')
print('PINE_CONTACT_PAGE_DONE',page+1,len(rows),flush=True)
