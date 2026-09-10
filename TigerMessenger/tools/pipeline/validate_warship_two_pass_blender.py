"""Saved-file tests for the changed hull, explicit target-eye contract and unchanged motion."""
import bpy,json,sys,importlib.util
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2];VERSION=int(sys.argv[sys.argv.index('--version')+1]);NAME='warship-battle-v'+str(VERSION)
ART=ROOT/'artifacts/pipeline'/NAME;OUT=ROOT/'assets/models/optimized'/NAME;OLD=ROOT/'artifacts/pipeline/warship-battle-v1'
if '--no-render' not in sys.argv:sys.argv.append('--no-render')
for name in ['validate_and_roundtrip.py','audit_seats.py','check_oar_neighbors.py']:
    text=(OLD/name).read_text().replace('warship-battle-v1.blend',NAME+'.blend').replace('warship-battle-v1.glb',NAME+'.glb').replace('warship-battle-v1.assembly.json',NAME+'.assembly.json')
    text=text.replace('spec.loader.exec_module(s)','spec.loader.exec_module(s);s.OUT=Path('+repr(str(OUT))+');s.ART=Path('+repr(str(ART))+');s.g.ART=s.ART')
    if name=='validate_and_roundtrip.py':
        # Root/ram invariants remain; hull/eyes are deliberately changed and have
        # explicit checks below, so their old coordinate-equality test is inapplicable.
        text=text.replace("fixed=['n0','n51']+[n['id'] for n in source['nodes'] if 1.77<n['matrix'][12]<1.82 and abs(n['matrix'][14])>.45]","fixed=['n0','n51']")
        text=text.replace("for tag in ['n1','n51','n23','n25','n47','n49']:","for tag in ['n51']:")
    ns={'__file__':str(OLD/name),'__name__':'__main__'};exec(compile(text,str(OLD/name),'exec'),ns)
# Reuse exact retained triangle-edge tests, not the authoring deformation functions.
s=ns['s'];geo=ns['geo'];crossings=ns['crossings']
a=json.loads((OUT/(NAME+'.assembly.json')).read_text());v2=json.loads((ROOT/'assets/models/optimized/warship-battle-v2/warship-battle-v2.assembly.json').read_text())
assert a['poseFrames']==v2['poseFrames'],'Motion contract changed'
bpy.ops.wm.open_mainfile(filepath=str(OUT/(NAME+'.blend')));sc=bpy.context.scene;obs={s.ident(o):o for o in sc.objects if s.ident(o)}
body=[obs['n'+str(n)+':i'+str(i)] for i in range(26) for n in [220,221,222,223,224,225,226,229,230]]
body=[o for o in body if o.type=='MESH' and not o.hide_render]
moving=[obs['n'+str(64+5*i)] for i in range(26)]+[obs['add:oar-handle-'+str(i)] for i in range(26)]
changed=[obs[k] for k in a['geometryRevision']['changedOriginalOrV1MeshIDs'] if k in obs and obs[k].type=='MESH' and not obs[k].hide_render]
hull=geo([obs['n1']]);new_solid=geo([obs[k] for k in ['add:bow-hinge-lip','add:bow-landing-knee-1.77','add:bow-landing-knee-2.11','add:bow-landing']])
fail=[];eyecenters={};maxEyeMotion=0
for frame in range(1,302):
    sc.frame_set(frame);bpy.context.view_layer.update()
    hits=crossings(geo(body),hull)
    oarhits=crossings(geo(moving),hull)
    landinghits=crossings(geo(body+moving),new_solid)
    if hits or oarhits or landinghits:fail.append({'frame':frame,'bodyHull':hits,'oarsHull':oarhits,'bodyOarsLanding':landinghits})
    for key in ['n23','n25','n47','n49']:
        o=obs[key];center=sum((s.CI.to_3x3()@(o.matrix_world@v.co) for v in o.data.vertices),Vector())/len(o.data.vertices)
        if frame==1:eyecenters[key]=list(center)
        maxEyeMotion=max(maxEyeMotion,(center-Vector(eyecenters[key])).length)
        if center.x>=-1.85:raise AssertionError(('eye not at curled end',key,frame,list(center)))
sc.frame_set(212);bpy.context.view_layer.update()
floor=[o for k,o in obs.items() if o.type=='MESH' and not o.hide_render and (k in ['n231','add:bow-landing','add:bow-hinge-lip'] or k.startswith('add:deck-plank-') or k.startswith('add:boarding-plank-'))]
floorBVH=geo(floor)[3];missing=[];supportHeights=[];maxStep=0
for xi in range(18):
    x=1.77+xi*.02;last=None
    for zi in range(25):
        z=.38+zi*.01;origin=s.C.to_3x3()@Vector((x,2,z));point,normal,index,distance=floorBVH.ray_cast(origin,Vector((0,0,-1)),3)
        if point is None:missing.append([x,z]);continue
        height=(s.CI.to_3x3()@point).y;supportHeights.append(height)
        if last is not None:maxStep=max(maxStep,abs(height-last))
        last=height
# New deck's route is deliberately not certified by this static attachment test.
eyeGeometryContacts=crossings(geo([obs[k] for k in ['n23','n25','n47','n49']]),hull)
report={'passed':not fail and not missing and not eyeGeometryContacts and maxEyeMotion<1e-6,
 'version':VERSION,'all301MotionRecordsExactlyEqualV2':True,'newShapeFrames':301,
 'newShapeScope':'Actual new hull versus 26 original torso/skirt/head/helmet/crest/legs and all shafts/handles; new landing support versus those bodies/oars. Existing deck/seat and different-oar checks independently rerun.',
 'failedFrames':fail,'eyeRootCentersThree':eyecenters,'maxEyeCenterMotion':maxEyeMotion,'eyeHullTriangleContacts':eyeGeometryContacts,
 'boardingJunction':{'hingeThree':[1.94,.664,.48],'poseFrame':212,'actualFloorRaySamples':18*25,'missingSupport':missing,'topHeightRange': [min(supportHeights),max(supportHeights)],'maximumAdjacentHeightStep':maxStep,'scope':'Actual landing/lip/deployed board floor support across x1.77..2.11,z.38...62; does not validate a walking character or25-person path.'},
 'limits':['No all-body self collision certification.','No25-person scheduler; V1 single-actor path NOT revalidated on reshaped deck.','Static GLB and authored saved review poses, no runtime integration.']}
(ART/'new-shape-validation.json').write_text(json.dumps(report,indent=2))
print('NEW_SHAPE',json.dumps({k:v for k,v in report.items() if k not in ['failedFrames','eyeRootCentersThree','newShapeScope','limits']}),flush=True)
