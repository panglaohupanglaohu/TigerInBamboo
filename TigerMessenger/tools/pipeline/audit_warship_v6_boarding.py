"""Read-only saved GLB deployment intersection / representative volume audit."""
import bpy,json,math,hashlib,os
from pathlib import Path
from mathutils import Matrix,Vector
from mathutils.bvhtree import BVHTree
P=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger')
version=os.environ.get('TIGER_WARSHIP_AUDIT_VERSION','v6')
S=P/('assets/models/optimized/warship-battle-'+version)
O=P/('artifacts/pipeline/warship-'+version+'-boarding-audit');O.mkdir(exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(S/('warship-battle-'+version+'.glb')))
d=json.loads((S/('warship-battle-'+version+'.assembly.json')).read_text())
ids={}
for o in bpy.data.objects:
    k=o.get('three_node_id',o.get('three_instance_key',o.get('warship_added_id')))
    if k: ids[k]=o
C=Matrix(((1,0,0,0),(0,0,-1,0),(0,1,0,0),(0,0,0,1)))
def mat(a):return C@Matrix([a[i:i+4] for i in range(0,16,4)]).transposed()@C.inverted()
def pos(v):return C.to_3x3()@Vector(v)
def key(o):return o.get('three_node_id',o.get('three_instance_key',o.get('warship_added_id',o.name)))
def hidden(o):
    while o:
        if o.get('candidateHidden') or o.get('candidate_hidden_source_geometry') or o.get('three_visible') is False:return True
        o=o.parent
    return False
def mesh(o):
    vs=[o.matrix_world@v.co for v in o.data.vertices]
    return BVHTree.FromPolygons(vs,[list(p.vertices) for p in o.data.polygons]),vs
hinge=ids['add:boarding-hinge']
board=set(hinge.children_recursive)
meshes=[o for o in bpy.data.objects if o.type=='MESH' and not hidden(o)]
def apply(frame,stowed=False):
    for k,a in d['poseFrames'][frame]['transforms'].items():
        if k in ids: ids[k].matrix_local=mat(a)
    if stowed:hinge.matrix_local=mat(d['boarding']['stowedMatrix'])
    bpy.context.view_layer.update()
hits=[]
for frame in range(180,212):
    apply(frame,frame==180)
    obstacles=[(o,*mesh(o)) for o in meshes if o not in board]
    for b in board:
        if b.type!='MESH':continue
        bv,vs=mesh(b)
        lo=Vector([min(v[i] for v in vs) for i in range(3)]);hi=Vector([max(v[i] for v in vs) for i in range(3)])
        for o,ov,ovs in obstacles:
            if any(max(v[i] for v in ovs)<lo[i] or min(v[i] for v in ovs)>hi[i] for i in range(3)):continue
            pairs=bv.overlap(ov)
            if pairs:hits.append({'frame':frame,'board':key(b),'obstacle':key(o),'name':o.name,'triangle_pairs':len(pairs),'board_center_gltf':list(C.inverted().to_3x3()@sum(vs,Vector())/len(vs))})
apply(211)
foot=ids['add:boarding-foot'].matrix_world.translation
origin=hinge.matrix_world.translation
# Root trajectory: central deck at x=.8, then hinge, then along actual saved board.
start=pos([.8,.69,0]);turn=pos([origin.x,.69,0])
points=[start,turn,origin+pos([0,.04,0]),foot+pos([0,.04,0])]
obstacles=[(o,*mesh(o)) for o in meshes]
volume_hits=[]
support=[]
for seg in range(3):
    for step in range(31):
        root=points[seg].lerp(points[seg+1],step/30)
        best=None
        for o,bv,vs in obstacles:
            hit=bv.ray_cast(root+pos([0,.02,0]),pos([0,-1,0]),.22)
            if hit[0] is not None and (best is None or hit[3]<best['ray_distance']):best={'node':key(o),'ray_distance':hit[3],'gap':hit[3]-.02}
        support.append({'segment':seg,'step':step,'root_gltf':list(C.inverted().to_3x3()@root),'support':best})
        for o,bv,vs in obstacles:
            # Cylinder radius .14 / height .65; vertical slices exclude supporting floor.
            minimum=999
            for h in [.04,.10,.18,.28,.40,.52,.64]:
                sample=root+pos([0,h,0])
                for angle in range(16):
                    direction=pos([math.cos(angle*math.tau/16),0,math.sin(angle*math.tau/16)])
                    near=bv.ray_cast(sample,direction,.14)
                    if near[0] is not None:minimum=min(minimum,near[3])
            if minimum<.14:volume_hits.append({'segment':seg,'step':step,'root_gltf':list(C.inverted().to_3x3()@root),'obstacle':key(o),'name':o.name,'axis_surface_distance':minimum})
report={'source_sha256':hashlib.sha256((S/('warship-battle-'+version+'.glb')).read_bytes()).hexdigest(),'assumptions':{'radius':.14,'height':.65,'root_start_gltf':[.8,.69,0],'sampling':'31 roots/segment, 7 vertical slices x16 horizontal rays; triangle intersections exact, volume sweep sampled; absence of hits is not clearance proof'},'deployment_frames':[180,211],'deployment_intersections':hits,'representative_volume_collisions':volume_hits,'support':support,'path_gltf':[list(C.inverted().to_3x3()@p) for p in points],'scope':'Read-only imported v6 GLB plus saved assembly. No old v1 path result reused.'}
grip_error=0.0
for frame in range(301):
    apply(frame)
    for grip in d['grips']:
        target=ids[grip['oar']].matrix_world@pos(grip['point'])
        grip_error=max(grip_error,(target-ids[grip['hand']].matrix_world.translation).length)
report['grip_check']={'frames':301,'hands':len(d['grips']),'maximum_error':grip_error,'rower_torsos':sum(1 for k in ids if k.startswith('n220:i'))}
(O/'report.json').write_text(json.dumps(report,indent=2))
print('AUDIT',json.dumps({'deployment_hits':len(hits),'volume_hits':len(volume_hits),'board_obstacles':sorted(set(h['obstacle'] for h in hits)),'volume_obstacles':sorted(set(h['obstacle'] for h in volume_hits))}))
