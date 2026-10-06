"""Remove only the old single-track guard inside the gate galleries.
Match authored box vertices to the retained original rail samples, not arbitrary
near-track faces; preserve decks, arches, piers and the gallery's newer guards.
"""
import json,math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
asset=ROOT/'assets/models/optimized/gate-of-sighs/gateSiteData.js'
D=json.loads((ROOT/'artifacts/pipeline/gate-of-sighs-build/site-source.json').read_text());rail=D['rail']
def lerp(a,b,t):return [x+(y-x)*t for x,y in zip(a,b)]
def norm(v):
 l=math.sqrt(sum(x*x for x in v));return [x/l for x in v]
def rp(s,x,y):
 k=max(0,min(len(rail)-2,int((s+140)/2)));a,b=rail[k:k+2];t=(s-a['s'])/2
 p=lerp(a['p'],b['p'],t);r=norm(lerp(a['right'],b['right'],t));u=norm(lerp(a['up'],b['up'],t))
 return [p[i]+r[i]*x+u[i]*y for i in range(3)]
# Spatial buckets plus tolerance accommodate Blender's float32 export.
expected={}
boundary=[]
def box(mat,stations,profile):
 for s in stations:
  for x,y in profile:
   p=rp(s,x,y);
   if abs(s)==26:boundary.append(p)
   key=tuple(math.floor(v*100) for v in p);expected.setdefault((mat,key),[]).append(p)
for k in range(140):
 a=-140+k*2;b=a+2
 if not -26<(a+b)/2<26:continue
 for side in [-1,1]:
  box('trim',[a,b],[(side*2.25,-.2),(side*2.48,-.2),(side*2.48,.28),(side*2.25,.28)])
  box('rock',[a,b],[(side*2.30,1.08),(side*2.43,1.08),(side*2.43,1.20),(side*2.30,1.20)])
for s in range(-140,141,5):
 if abs(s)>26:continue
 for side in [-1,1]:box('trim',[s-.13,s+.13],[(side*2.26,.28),(side*2.48,.28),(side*2.48,1.2),(side*2.26,1.2)])
def matches(mat,p):
 key=tuple(math.floor(v*100) for v in p)
 for dx in [-1,0,1]:
  for dy in [-1,0,1]:
   for dz in [-1,0,1]:
    for q in expected.get((mat,(key[0]+dx,key[1]+dy,key[2]+dz)),[]):
     if sum((a-b)**2 for a,b in zip(p,q))<1e-7:return True
 return False
raw=asset.read_text();data=json.loads(raw.removeprefix('export default ').strip().removesuffix(';'));counts={}
for part in data['parts']:
 mat=next((m for m in ['rock','trim'] if part['name']==f'gate-site-GateSite_{m}-solid'),None)
 if not mat:continue
 keep=[];ps=part['positions']
 for i in range(0,len(ps),9):
  if all(any(sum((a-b)**2 for a,b in zip(ps[j:j+3],q))<1e-7 for q in boundary) for j in range(i,i+9,3)) or not all(matches(mat,ps[j:j+3]) for j in range(i,i+9,3)):keep.extend(range(i,i+9))
 counts[mat]=(len(ps)-len(keep))//9
 for key in ['positions','normals','colors']:part[key]=[part[key][i] for i in keep]
removed=sum(counts.values());assert removed in [0,1496],counts
if removed:
 data['triangles']-=removed;data['gateGalleryLegacyGuardRemoved']={'stationRange':[-26,26],'triangles':removed}
 asset.write_text('export default '+json.dumps(data,separators=(',',':'))+';\n')
print(json.dumps({'removedTriangles':counts,'total':removed}))
