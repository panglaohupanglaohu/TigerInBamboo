import json,math,collections
from pathlib import Path
root=Path('/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/artifacts/pipeline/citadel-five-hour-20261005')
d=json.loads((root/'r14-overview-day-cloud-plants-rock-patch.json').read_text());ts=d['triangles']
def sub(a,b):return [x-y for x,y in zip(a,b)]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def norm(a):return math.sqrt(dot(a,a))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def verts(t):return [t['positions'][i:i+3] for i in [0,3,6]]
def key(v):return tuple(round(x,4) for x in v)
def stat(t):
 a,b,c=verts(t);n=cross(sub(b,a),sub(c,a));lengths=[norm(sub(a,b)),norm(sub(b,c)),norm(sub(c,a))];area=norm(n)/2;unit=[v/norm(n) for v in n]
 return {'face':t['faceIndex'],'vertices':[a,b,c],'edgeLengths':lengths,'area':area,'minAltitude':2*area/max(lengths),'normal':unit,'xzArea':abs(n[1])/2,'xzAreaRatio':abs(n[1])/norm(n),'shore':t['shore']}
t=next(t for t in ts if t['faceIndex']==32405);s=stat(t);tv=set(map(key,verts(t)));neighbors=[]
for q in ts:
 shared=len(tv&set(map(key,verts(q))))
 if shared and q!=t:
  z=stat(q);z['sharedVertices']=shared;z['dihedralDeg']=math.degrees(math.acos(max(-1,min(1,dot(s['normal'],z['normal'])))));neighbors.append(z)
def heights(x,z):
 out=[]
 for q in ts:
  a,b,c=verts(q);det=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2])
  if abs(det)<1e-10:continue
  u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/det;v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/det
  if min(u,v,1-u-v)>=-1e-6:out.append((u*a[1]+v*b[1]+(1-u-v)*c[1],q['faceIndex']))
 return sorted(out,reverse=True)
probes=[{'x':x,'z':z,'hits':heights(x,z)} for x in [0,1.24673,2,3] for z in [-16,-15.21581,-14]]
xz=collections.defaultdict(set)
for q in ts:
 for x,y,z in verts(q):xz[round(x,4),round(z,4)].add(round(y,4))
multi=[{'xz':k,'ys':sorted(v)} for k,v in xz.items() if max(v)-min(v)>.05 and -3<k[0]<5 and -19<k[1]<-11]
out={'target':s,'neighbors':neighbors,'verticalProbes':probes,'sameXZNearby':multi,'patchTriangleCount':len(ts),'sourceMapping':'not exported; final face cannot identify pre-landform/pre-relief triangle'}
(root/'r14-rock-patch-analysis.json').write_text(json.dumps(out,indent=2));print(json.dumps(out,indent=2)[:15000])
