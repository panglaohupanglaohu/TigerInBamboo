"""Color-only Blender/GLB revisions. Never re-export geometry or restore old source colors."""
import bpy,json,struct,hashlib,math,sys,importlib.util,copy
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[2]
TARGETS={
'vanguard':{'source':'vanguard-battle-v1','name':'vanguard-color-v2','target':'vanguard-trooper-target-v1.png','palette':{
'm0':('charcoal blue-gray primary armor','#343D49'),'m4':('joints gloves trunnion backpack vents','#20252B'),
'm2':('warm gray-brown chest face thigh shoulder armor','#8B857B'),'m9':('secondary blue-gray limb armor','#303B49'),
'm11':('left shoulder cannon gray-brown casing, remove yellow','#827D73'),'m8':('muted brick waist connectors','#9E4534'),
'm6':('red face signal strip','#BF5140'),'m7':('pale green visor','#B4CF7B'),'m13':('ice blue cannon emitter','#B8E5F0'),
'm14':('coral-red laser blade','#FF7057'),'m15':('warm laser halo','#FF956F')}},
'socco':{'source':'socco-craft-v1','name':'socco-color-v2','target':'socco-craft-target-v1.png','palette':{
'm0':('coral brick-red principal hull and upper casing','#B94F3E'),'m3':('warm ivory flotation and lower hull','#D6CCBA'),
'm5':('darker brick-red seams nose rings and door frame','#A44737'),'m15':('deep brown keel skids','#544435'),
'm11':('wood ramp ribs boarding threshold and interior benches','#8B694B'),'m12':('wood boarding ramp and supporting structure','#947151'),
'm10':('dark warm hardware and nose apertures','#292824'),'m14':('dark propulsion core','#252522'),
'm8':('pilot warm gray uniform','#7B7A6D'),'m9':('pilot helmet neutral gray','#8D8D7E')}}}
def sha_bytes(x):return hashlib.sha256(x).hexdigest()
def sha(p):return sha_bytes(p.read_bytes())
def linear(h):
    cs=[int(h[i:i+2],16)/255 for i in [1,3,5]]
    return [c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4 for c in cs]
def readglb(p):
    raw=p.read_bytes();length,typ=struct.unpack_from('<II',raw,12)
    return json.loads(raw[20:20+length]),raw[20+length:],typ
def ident(o):return o.get('three_node_id') or o.get('vanguard_added_id') or o.get('candidate_node_id')
def mesh_digest(sc):
    h=hashlib.sha256();count=0
    for o in sorted(sc.objects,key=lambda x:x.name):
        if o.type!='MESH':continue
        count+=1
        data={'name':o.name,'parent':o.parent.name if o.parent else None,'matrixBasis':list(v for r in o.matrix_basis for v in r),
          'vertices':[list(v.co) for v in o.data.vertices],'polygons':[(list(p.vertices),p.material_index,p.use_smooth) for p in o.data.polygons],
          'uv':[[list(x.uv) for x in u.data] for u in o.data.uv_layers],'hidden':o.hide_render}
        h.update(json.dumps(data,separators=(',',':')).encode())
    return h.hexdigest(),count
def timeline(sc):
    frames=range(sc.frame_start,sc.frame_end+1) if any(o.animation_data for o in sc.objects) else [sc.frame_current]
    hashes=[];tagged=[o for o in sc.objects if ident(o)]
    for frame in frames:
        sc.frame_set(frame);bpy.context.view_layer.update()
        h=hashlib.sha256()
        for o in sorted(tagged,key=lambda x:str(ident(x))):
            h.update(str(ident(o)).encode());h.update(struct.pack('<16f',*(v for r in o.matrix_basis for v in r)))
        hashes.append([frame,h.hexdigest()])
    return hashes
def apply_material(m,row):
    bs=next((x for x in m.node_tree.nodes if x.type=='BSDF_PRINCIPLED'),None) if m.use_nodes else None
    rgba=row['newBaseColorLinear'];m.diffuse_color=rgba
    if bs:
        bs.inputs['Base Color'].default_value=rgba
        # Preserve original actual emission strength; set its color to match the
        # original GLB effective factor ratio, only for already emissive surfaces.
        if row.get('newEmissiveLinear') is not None:
            strength=float(bs.inputs['Emission Strength'].default_value)
            if strength>0:bs.inputs['Emission Color'].default_value=(*[x/strength for x in row['newEmissiveLinear']],1)
    encoded=m.get('three_source')
    if encoded:
        src=json.loads(encoded);m['color_v2_original_three_source']=encoded
        src['color']=rgba[:3]
        if row.get('newEmissiveLinear') is not None:
            strength=src.get('emissiveIntensity',1) or 1;src['emissive']=[x/strength for x in row['newEmissiveLinear']]
        m['three_source']=json.dumps(src)
    m['color_revision']=2;m['color_srgb_hex']=row['srgbHex'];m['color_semantic']=row['semantic']
def build(kind):
    cfg=TARGETS[kind];name=cfg['name'];old=ROOT/'assets/models/optimized'/cfg['source'];out=ROOT/'assets/models/optimized'/name;art=ROOT/'artifacts/pipeline'/name
    out.mkdir(parents=True,exist_ok=True);art.mkdir(parents=True,exist_ok=True)
    oldglb=old/(cfg['source']+'.glb');oldblend=old/(cfg['source']+'.blend')
    sourcehash={str(p.relative_to(ROOT)):sha(p) for p in [oldglb,oldblend]};doc,tail,typ=readglb(oldglb);before=copy.deepcopy(doc);rows=[]
    for i,m in enumerate(doc['materials']):
        uuid=m.get('extras',{}).get('three_uuid')
        if uuid not in cfg['palette']:continue
        role,h=cfg['palette'][uuid];rgba=m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1]);new=[*linear(h),rgba[3]]
        row={'materialIndex':i,'materialUUID':uuid,'semantic':role,'srgbHex':h,'oldBaseColorLinear':rgba,'newBaseColorLinear':new,'oldEmissiveLinear':m.get('emissiveFactor')}
        m.setdefault('pbrMetallicRoughness',{})['baseColorFactor']=new
        em=m.get('emissiveFactor')
        if em and max(em)>0:
            ratios=[em[c]/rgba[c] for c in range(3) if rgba[c]>1e-6];strength=sum(ratios)/len(ratios)
            newem=[c*strength for c in new[:3]];m['emissiveFactor']=newem;row['newEmissiveLinear']=newem
        else:row['newEmissiveLinear']=None
        ex=m.setdefault('extras',{});ex['color_revision']=2;ex['color_srgb_hex']=h;ex['color_semantic']=role
        if ex.get('three_source'):
            src=json.loads(ex['three_source']);ex['color_v2_original_three_source']=ex['three_source'];src['color']=new[:3]
            if row['newEmissiveLinear'] is not None:
                strength=src.get('emissiveIntensity',1) or 1;src['emissive']=[x/strength for x in row['newEmissiveLinear']]
            ex['three_source']=json.dumps(src)
        rows.append(row)
    # Only the material JSON section changes. No mesh primitive or binary mutation.
    assert {k:v for k,v in doc.items() if k!='materials'}=={k:v for k,v in before.items() if k!='materials'}
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    newglb=out/(name+'.glb');newglb.write_bytes(struct.pack('<III',0x46546c67,2,20+len(js)+len(tail))+struct.pack('<II',len(js),typ)+js+tail)
    reread,retail,_=readglb(newglb);assert retail==tail
    mapping={'asset':name,'source':str(oldglb.relative_to(ROOT)),'target':str((ROOT/'assets/concepts'/cfg['target']).relative_to(ROOT)),'targetSHA256':sha(ROOT/'assets/concepts'/cfg['target']),'colorSpace':'Hex palette is sRGB; piecewise IEC sRGB EOTF applied once to produce Blender and glTF linear baseColorFactor. Alpha untouched.','authority':'Use these GLB material factors. Material three_source color is also updated; archived old source retained in color_v2_original_three_source. No original snapshot or source file edited.','materials':rows}
    (out/'material-mapping.json').write_text(json.dumps(mapping,indent=2))
    print('GLB_STABLE',name,sha(newglb),flush=True)
    bpy.ops.wm.open_mainfile(filepath=str(oldblend));sc=bpy.context.scene;start=sc.frame_current
    geometry_before,count=mesh_digest(sc);timeline_before=timeline(sc);sc.frame_set(start);bpy.context.view_layer.update()
    lookup={r['materialUUID']:r for r in rows};used={m for o in sc.objects if o.type=='MESH' for m in o.data.materials if m};applied=[]
    for m in used:
        uuid=m.get('three_uuid')
        if uuid in lookup:apply_material(m,lookup[uuid]);applied.append(uuid)
    geometry_after,_=mesh_digest(sc);timeline_after=timeline(sc);sc.frame_set(start);bpy.context.view_layer.update()
    assert geometry_before==geometry_after
    assert timeline_before==timeline_after
    bpy.context.preferences.filepaths.save_version=0;bpy.ops.wm.save_as_mainfile(filepath=str(out/(name+'.blend')))
    # Reopen the saved candidate to verify the evidence concerns disk state.
    bpy.ops.wm.open_mainfile(filepath=str(out/(name+'.blend')));sc=bpy.context.scene;saved_geometry,_=mesh_digest(sc);saved_timeline=timeline(sc);assert saved_geometry==geometry_before;assert saved_timeline==timeline_before
    validation={'passed':True,'sourceFilesUnchanged':sourcehash,'geometryMeshCount':count,'sourceAndSavedGeometryUVParentBasisHash':geometry_before,'savedGeometryAndUVExactlyUnchanged':True,'savedTimelineFramesCompared':len(timeline_before),'savedTimelineExactlyUnchanged':True,'glbBinaryChunkSHA256':sha_bytes(tail),'glbBinaryExactlyUnchanged':True,'allNonMaterialGLBJsonExactlyUnchanged':True,'nodes':len(doc['nodes']),'meshes':len(doc['meshes']),'materialUUIDsChanged':sorted(applied),'transparencyAndAlphaUnchanged':True,'originalEmissionStrengthRatiosRetained':True,'colorOnly':True,'runtimeIntegrated':False}
    assert all(sha(ROOT/p)==value for p,value in sourcehash.items())
    (out/'validation.json').write_text(json.dumps(validation,indent=2));(art/'validation.json').write_text(json.dumps(validation,indent=2))
    # Fresh GLB renders, identical per-kind framing and studio setup.
    sp=importlib.util.spec_from_file_location('vh',ROOT/'tools/pipeline/build_vanguard_blender.py')
    # Helper path selected below rather than importing an authoring entrypoint.
    helper=ROOT/'tools/pipeline/build_vanguard_battle_blender.py'
    sp=importlib.util.spec_from_file_location('vh',helper);vh=importlib.util.module_from_spec(sp);sp.loader.exec_module(vh)
    render_records=[]
    for label,path in [('before',oldglb),('after',newglb)]:
        bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(path));sc=bpy.context.scene;vh.studio(sc);sc.render.resolution_x=1100;sc.render.resolution_y=1000
        imported={ident(o):o for o in sc.objects if ident(o)}
        if kind=='socco':
            # Same known ground-resolved deploy pose in both color comparisons.
            hinge=imported['n87'];hinge.rotation_mode='XYZ';hinge.rotation_euler.x=-.2011
        bpy.context.view_layer.update()
        if label=='after':
            errors=[]
            for m in bpy.data.materials:
                uuid=m.get('three_uuid')
                if uuid not in lookup:continue
                bs=next(x for x in m.node_tree.nodes if x.type=='BSDF_PRINCIPLED');actual=[*list(bs.inputs['Base Color'].default_value)[:3],float(bs.inputs['Alpha'].default_value)];delta=max(abs(x-y) for x,y in zip(actual,lookup[uuid]['newBaseColorLinear']))
                errors.append({'uuid':uuid,'maxLinearBaseError':delta})
            validation['freshGLBMaterialReadback']=errors;assert errors and max(x['maxLinearBaseError'] for x in errors)<1e-6
            (out/'validation.json').write_text(json.dumps(validation,indent=2));(art/'validation.json').write_text(json.dumps(validation,indent=2))
        points=[o.matrix_world@v.co for o in sc.objects if o.type=='MESH' and not o.hide_render for v in o.data.vertices]
        views=[('three-quarter',(3,-4,2.2))] if kind=='vanguard' else [('three-quarter',(4,-6,3.2)),('ramp-rear',(-4,6,3))]
        for view,direction in views:
            center=sum(points,Vector())/len(points);cam=sc.camera;cam.location=center+Vector(direction).normalized()*20;cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.view_layer.update();inv=cam.matrix_world.inverted();pts=[inv@p for p in points];xs=[p.x for p in pts];ys=[p.y for p in pts];cam.location+=cam.rotation_euler.to_matrix()@Vector(((max(xs)+min(xs))/2,(max(ys)+min(ys))/2,0));cam.data.ortho_scale=max(max(xs)-min(xs),(max(ys)-min(ys))*1.1)*1.12
            sc.render.filepath=str(art/(label+'-'+view+'.png'));bpy.ops.render.render(write_still=True)
            render_records.append({'label':label,'view':view,'inputGLB':sha(path),'cameraMatrix':[v for row in cam.matrix_world for v in row],'orthoScale':cam.data.ortho_scale,'viewTransform':sc.view_settings.view_transform,'look':sc.view_settings.look,'exposure':sc.view_settings.exposure})
    (art/'render-provenance.json').write_text(json.dumps({'renders':render_records,'crew':'SOCCO empty craft; no old crew color mixed into comparison','geometryPose':'Vanguard static original GLB pose. SOCCO n87 local rotationX=-.2011 used for both before/after review only; saved file actions unmodified.'},indent=2))
    print('FINISHED',name,flush=True)
if __name__=='__main__':
    for kind in (sys.argv[sys.argv.index('--asset')+1:] if '--asset' in sys.argv else ['vanguard','socco']):build(kind)
