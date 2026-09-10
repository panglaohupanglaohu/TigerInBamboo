"""Read-only archived Blender source renders for the next Saihoji concept batch."""
import bpy, hashlib, json, math, sys
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
SOURCES={
 'leviathanIsland':('assets/models/originals/leviathan/blender-r3/leviathanIsland.blend','assets/models/originals/leviathan/leviathanIsland.source.json','Original whale/island/flora factory; excludes six runtime-attached garden scenes.'),
 'ancientPineTree':('assets/models/originals/blender-r3/pine.blend','assets/models/originals/pine.source.json','Archive ID pine; provenance factory createAncientPineTree.'),
 'vanguardTrooper':('assets/models/originals/supplemental/blender-r3/vanguardTrooper.blend','assets/models/originals/supplemental/vanguardTrooper.source.json','Original vanguard heavy trooper, original weapons and armor.'),
 'moebiusAircraft':('assets/models/originals/blender-r3/moebiusAircraft.blend','assets/models/originals/moebiusAircraft.source.json','Original single craft. No independent AircraftSquad archive was found; this does not claim to show its runtime formation.'),
 'soccoCraft':('assets/models/originals/supplemental/blender-r3/soccoCraft.blend','assets/models/originals/supplemental/soccoCraft.source.json','Original SOCCO craft, seats and ramp.'),
 'gatePodEscort_pod-08-9':('assets/models/originals/supplemental/blender-r3/gatePodEscort_pod-08-9.blend','assets/models/originals/supplemental/gatePodEscort_pod-08-9.source.json','Original escort pod 08-9, including tranquilizer muzzle.'),
 'gatePodEscort_pod-41-7':('assets/models/originals/supplemental/blender-r3/gatePodEscort_pod-41-7.blend','assets/models/originals/supplemental/gatePodEscort_pod-41-7.source.json','Original escort pod 41-7, including tranquilizer muzzle.'),
 'gatePodEscort_pod-55-2':('assets/models/originals/supplemental/blender-r3/gatePodEscort_pod-55-2.blend','assets/models/originals/supplemental/gatePodEscort_pod-55-2.source.json','Original escort pod 55-2, including tranquilizer muzzle.'),
}

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def signature(objects):
    data=[]
    for o in objects:
        data.append((o.get('three_node_id'),[list(row) for row in o.matrix_basis],o.hide_render,o.hide_viewport))
        if o.type=='MESH':data.append(([list(v.co) for v in o.data.vertices],[list(p.vertices) for p in o.data.polygons],[(m.name,list(m.diffuse_color),len(m.node_tree.nodes) if m.node_tree else 0,len(m.node_tree.links) if m.node_tree else 0) for m in o.data.materials if m]))
    return hashlib.sha256(json.dumps(data).encode()).hexdigest()

def run(asset):
    blend,snapshot,scope=SOURCES[asset];source=ROOT/blend;before=sha(source)
    bpy.ops.wm.open_mainfile(filepath=str(source));scene=bpy.context.scene
    objects=[o for o in scene.objects if 'three_node_id' in o];sig=signature(objects)
    bpy.context.view_layer.update()
    visible=[o for o in objects if o.type=='MESH' and not o.hide_render]
    points=[o.matrix_world@v.co for o in visible for v in o.data.vertices]
    lo=Vector(tuple(min(p[k] for p in points) for k in range(3)));hi=Vector(tuple(max(p[k] for p in points) for k in range(3)));center=(lo+hi)*.5
    radius=max((hi-lo).length*.5,.1)
    scene.render.engine='CYCLES';scene.cycles.samples=24
    scene.render.resolution_x=1200;scene.render.resolution_y=1200;scene.render.resolution_percentage=100
    scene.view_settings.view_transform='AgX'
    world=bpy.data.worlds.new('Read-only reference studio');world.use_nodes=True
    world.node_tree.nodes['Background'].inputs[0].default_value=(.34,.39,.45,1);world.node_tree.nodes['Background'].inputs[1].default_value=.65;scene.world=world
    for name,offset,power,size in [('Key',(2,-3,4),200,4),('Fill',(-2,-1,2),80,3),('Rim',(0,3,3),140,2)]:
        light=bpy.data.objects.new('Reference_'+name,bpy.data.lights.new('Reference_'+name,'AREA'));scene.collection.objects.link(light)
        light.location=center+Vector(offset)*radius;light.data.energy=power*radius*radius;light.data.size=size*radius
        light.rotation_euler=(center-light.location).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.objects.new('Reference_Camera',bpy.data.cameras.new('Reference_Camera'));scene.collection.objects.link(cam);scene.camera=cam
    direction=Vector((3,-4,2.2)).normalized();cam.location=center+direction*radius*6
    cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.clip_start=max(radius*.0001,.00001);cam.data.clip_end=radius*20
    bpy.context.view_layer.update();inv=cam.matrix_world.inverted();projected=[inv@p for p in points]
    xs=[p.x for p in projected];ys=[p.y for p in projected]
    cam.location+=cam.rotation_euler.to_matrix()@Vector(((max(xs)+min(xs))/2,(max(ys)+min(ys))/2,0))
    cam.data.ortho_scale=max(max(xs)-min(xs),max(ys)-min(ys))*1.12
    image=OUT/(asset+'-source-three-quarter.png');scene.render.filepath=str(image);bpy.ops.render.render(write_still=True)
    assert sha(source)==before,'Read-only source hash changed'
    assert signature(objects)==sig,'Source geometry, local transforms, visibility or material graph changed in memory'
    row={'asset':asset,'sourceBlend':blend,'sourceBlendSha256':before,'sourceSnapshot':snapshot,'sourceSnapshotSha256':sha(ROOT/snapshot),'scope':scope,'render':str(image.relative_to(ROOT)),'renderSha256':sha(image),'sourceNodes':len(objects),'visibleMeshObjects':len(visible),'blenderBounds':[list(lo),list(hi)],'sourceGeometryTransformsVisibilityMaterialGraphsUnchanged':True,'sourceFileUnchanged':True,'foregroundUsed':False,'sourceFileSaved':False,'lighting':'Same normalized three area lights + world, AgX, Cycles 24; original material graphs and source lights retained.','camera':{'view':'same three-quarter direction (3,-4,2.2) in Blender coordinates','framing':'per-asset actual visible projected bounds plus 12% margin','orthographicScale':cam.data.ortho_scale}}
    (OUT/(asset+'.json')).write_text(json.dumps(row,indent=2)+'\n');print('SOURCE_REFERENCE_READY',asset,flush=True)

if __name__=='__main__':
    chosen=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(SOURCES)
    for asset in chosen:run(asset)
    reports=[json.loads(p.read_text()) for p in OUT.glob('*.json') if p.name!='manifest.json']
    (OUT/'manifest.json').write_text(json.dumps({'status':'read-only original source renders; no optimization or image generation','assets':reports,'missingIndependentArchive':['moebiusAircraftSquad runtime formation']},indent=2)+'\n')
