"""Offline candidate search only; never changes production slots or trees."""
import json, math, time
from pathlib import Path
import numpy as np
import check_kun_exact_contacts as exact

ROOT=Path(__file__).resolve().parents[2]
INPUT=Path('/tmp/tigermessenger-kun-contact-geometry.json')
OUT=ROOT/'artifacts/pipeline/saihoji-target-integration/kun-cover-replacement-candidates.json'
TARGETS=['pine-3011-cover-15','pine-3011-cover-17','pine-3011-cover-20','pine-1401-cover-19','pine-1428-cover-28','pine-4110-cover-32','pine-1997-cover-34','pine-4137-cover-36','pine-1247-cover-38','pine-2162-cover-44','pine-2153-cover-46','pine-1229-cover-49']

def clip_y(poly,y,above):
    out=[]
    for a,b in zip(poly,poly[1:]+poly[:1]):
        ia=(a[1]>=y) if above else (a[1]<=y)
        ib=(b[1]>=y) if above else (b[1]<=y)
        if ia:out.append(a)
        if ia!=ib:out.append(a+(b-a)*((y-a[1])/(b[1]-a[1])))
    return out

def projected_distance(poly,p):
    a=np.asarray(poly)[:,[0,2]];b=np.roll(a,-1,axis=0);ab=b-a
    cross=ab[:,0]*(p[1]-a[:,1])-ab[:,1]*(p[0]-a[:,0])
    if np.all(cross>=-1e-9) or np.all(cross<=1e-9):return 0.0
    t=np.clip(np.sum((p-a)*ab,axis=1)/np.maximum(np.sum(ab*ab,axis=1),1e-18),0,1)
    return np.linalg.norm(a+t[:,None]*ab-p,axis=1).min()

def main():
    started=time.monotonic();data=json.loads(INPUT.read_text())
    garden=json.loads((ROOT/'godot/data/saihoji-target-garden-20260919.json').read_text())
    covers=json.loads((ROOT/'godot/data/saihoji-kun-cover-points.json').read_text())['points']
    faces=np.concatenate([exact.triangles(m['positions']) for m in garden['meshes'] if m['name']=='leviathan-crust-plate' or m['name'].startswith('leviathan-moss-bed-')])
    xz=faces[:,:,[0,2]];norm=np.cross(faces[:,1]-faces[:,0],faces[:,2]-faces[:,0]);norm/=np.linalg.norm(norm,axis=1)[:,None];norm[norm[:,1]<0]*=-1
    trees=[(t['seed'],t['id'],exact.triangles(t['faces'])) for t in data['trees']]
    trees=[(s,i,f,exact.bounds(f)) for s,i,f in trees]
    tf=np.concatenate([f for _,_,f,_ in trees]);tmin=tf.min(axis=1);tmax=tf.max(axis=1)
    models={key:[(m['name'],exact.triangles(m['faces'])) for m in meshes] for key,meshes in data['models'].items()}
    positions=np.asarray([r['localPoint'] for r in covers]);byid={r['id']:i for i,r in enumerate(covers)}
    def support(p):
        a=xz[:,0];b=xz[:,1];c=xz[:,2]
        det=(b[:,1]-c[:,1])*(a[:,0]-c[:,0])+(c[:,0]-b[:,0])*(a[:,1]-c[:,1])
        valid=np.abs(det)>1e-9;safe=np.where(valid,det,1)
        u=((b[:,1]-c[:,1])*(p[0]-c[:,0])+(c[:,0]-b[:,0])*(p[1]-c[:,1]))/safe
        v=((c[:,1]-a[:,1])*(p[0]-c[:,0])+(a[:,0]-c[:,0])*(p[1]-c[:,1]))/safe
        good=valid&(u>=-1e-7)&(v>=-1e-7)&(u+v<=1+1e-7)&(norm[:,1]>=math.cos(math.radians(32)))
        if not good.any():return None
        heights=u*faces[:,0,1]+v*faces[:,1,1]+(1-u-v)*faces[:,2,1];heights[~good]=-np.inf
        i=int(heights.argmax());return heights[i],norm[i]
    def body_clear(p,y):
        # Radius .38m / island scale .5 = .76 local. Height1.22m=2.44 local.
        mask=(tmin[:,0]<=p[0]+.76)&(tmax[:,0]>=p[0]-.76)&(tmin[:,2]<=p[1]+.76)&(tmax[:,2]>=p[1]-.76)&(tmin[:,1]<=y+2.44)&(tmax[:,1]>=y)
        for tri in tf[mask]:
            poly=clip_y(list(tri),y,True)
            if len(poly)<3:continue
            poly=clip_y(poly,y+2.44,False)
            if len(poly)>=3 and projected_distance(poly,p)<.76:return False
        return True
    offsets=sorted([(x*.25,z*.25) for x in range(-16,17) for z in range(-16,17) if x*x+z*z<=256],key=lambda p:p[0]**2+p[1]**2)
    attempts=[];accepted=[]
    for slot in TARGETS:
        if len(accepted)>=3 or time.monotonic()-started>480:break
        index=byid[slot];original=positions[index].copy();others=np.delete(positions,index,axis=0)[:,[0,2]]
        counts={'tested':0,'spacing':0,'pool':0,'support':0,'body':0,'exact_contact_or_uncertain':0};found=None
        for dx,dz in offsets:
            if time.monotonic()-started>480:break
            p=original[[0,2]]+[dx,dz];counts['tested']+=1
            if np.linalg.norm(others-p,axis=1).min()<1.45-1e-7:counts['spacing']+=1;continue
            if any(((p[0]-q['x'])/(q['rx']+.76))**2+((p[1]-q['z'])/(q['rz']+.76))**2<=1 for q in garden['pools']):counts['pool']+=1;continue
            hit=support(p)
            if hit is None:counts['support']+=1;continue
            y,up=hit
            if not body_clear(p,y):counts['body']+=1;continue
            # Try one specific role/facing, certify both actual poses, and do
            # not imply that untested weapon roles or moving attacks pass.
            for role in ['gladius','spear','longbow']:
                basecases=[c for c in data['cases'] if c['id']==slot and c['role']==role and c['pose']=='neutral']
                for base in basecases:
                    matrix=np.asarray(base['matrix']).reshape(4,4,order='F').copy()
                    old=support(original[[0,2]])
                    foot_offset=matrix[1,3]-old[0]
                    forward=matrix[:3,2];forward-=up*np.dot(up,forward);forward/=np.linalg.norm(forward)
                    matrix[:3,:3]=2*np.column_stack([np.cross(up,forward),up,forward]);matrix[:3,3]=[p[0],y,p[1]];matrix[:3,3]+=up*foot_offset
                    evidence=[];valid=True
                    for pose in ['neutral','conceal_lean']:
                        for name,mesh in models[f'{role}:{pose}']:
                            a=exact.transformed(mesh,matrix.flatten(order='F'));ab=exact.bounds(a)
                            for seed,treeid,b,bb in trees:
                                if not exact.overlap(ab,bb):continue
                                result=exact.inspect(a,b)
                                if result['status']!='clear':
                                    evidence.append({'pose':pose,'mesh':name,'pine_seed':seed,'tree_id':treeid,**result});valid=False;break
                            if not valid:break
                        if not valid:break
                    if valid:
                        found={'id':slot,'original':original.tolist(),'candidate':[float(p[0]),float(y),float(p[1])],'displacement_local':math.hypot(dx,dz),'minimum_slot_spacing_local':float(np.linalg.norm(others-p,axis=1).min()),'role':role,'yaw_degrees':base['yaw_degrees'],'matrix':matrix.flatten(order='F').tolist(),'poses':['neutral','conceal_lean'],'all_visible_meshes_checked':{pose:len(models[f'{role}:{pose}']) for pose in ['neutral','conceal_lean']},'all_tree_parts_checked':len(trees),'surface_contacts':0,'uncertain':False,'body_cylinder_clear':True,'pool_margin_local':.76}
                        break
                    counts['exact_contact_or_uncertain']+=1
                if found:break
            if found:break
        attempts.append({'id':slot,'counts':counts,'found':found is not None})
        if found:accepted.append(found);positions[index]=found['candidate'];print('accepted',slot,flush=True)
        result={'scope':'offline replacement candidates only, no production edits; existing49 positions fixed per search, accepted replacements participate in subsequent spacing; max4 local displacement; no travel-path or action-sweep proof','elapsed_seconds':time.monotonic()-started,'accepted':accepted,'attempts':attempts,'criteria':{'spacing_local':1.45,'pool_margin_local':.76,'body_radius_m':.38,'body_height_m':1.22,'island_world_scale':.5},'uncertainty_policy':'any uncertain exact result rejects candidate'}
        OUT.write_text(json.dumps(result,indent=2));print(slot,counts,flush=True)
    print('report',OUT,flush=True)

if __name__=='__main__':main()
