import json,math
from pathlib import Path
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[2];out=root/'artifacts/pipeline/citadel-east-wall-reshape-20261006';j=json.load(open(out/'audit.json'))
def sub(a,b):return [x-y for x,y in zip(a,b)]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def cross(a,b):return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
def norm(a):
 d=math.sqrt(dot(a,a));return [v/d for v in a]
g=j['candidate']['data'];p=g['attributes']['position']['array'];ix=g['index']['array'];edges={};vol=0
for i in range(0,len(ix),3):
 ids=ix[i:i+3];pts=[p[a*3:a*3+3] for a in ids];vol+=dot(pts[0],cross(pts[1],pts[2]))/6
 for a,b in zip(ids,ids[1:]+ids[:1]):
  e=edges.setdefault(tuple(sorted([a,b])),[0,0]);e[0]+=1;e[1]+=1 if a<b else -1
j['candidateRawTopology']={'nonTwoFaceEdges':sum(e[0]!=2 for e in edges.values()),'directionConflicts':sum(e[0]==2 and e[1]!=0 for e in edges.values()),'signedVolume':vol}
json.dump(j,open(out/'audit.json','w'))
tris=j['sourceTriangles'];flat=[p for t in tris for p in t];lo=[min(p[k] for p in flat) for k in range(3)];hi=[max(p[k] for p in flat) for k in range(3)];center=[(a+b)/2 for a,b in zip(lo,hi)];eye=[center[0]+23,center[1]+5,center[2]+35];forward=norm(sub(center,eye));right=norm(cross(forward,[0,1,0]));up=cross(right,forward)
def project(p):
 q=sub(p,eye);z=dot(q,forward);return 275+dot(q,right)*650/z,400-dot(q,up)*650/z,z
image=Image.new('RGB',(1100,860),'#eef2f4');draw=ImageDraw.Draw(image)
for panel,(title,triangles) in enumerate([('Before: straight 39m wall panel',tris),('After: 0.598m inward relief, 3 unequal bands',j['afterTriangles'])]):
 tile=Image.new('RGB',(550,750),'#eef2f4');d=ImageDraw.Draw(tile)
 for t in sorted(triangles,key=lambda t:sum(project(p)[2] for p in t),reverse=True):
  pts=[project(p)[:2] for p in t];n=norm(cross(sub(t[1],t[0]),sub(t[2],t[0])));v=int(100+95*max(0,dot(n,norm([.4,1,.5]))));d.polygon(pts,fill=(v-12,v,v+10))
 image.paste(tile,(panel*550,60));draw.text((panel*550+22,24),title,fill='#183546')
draw.text((24,812),'CPU perspective, not game screenshot. Local X83..85 / Z79..84. Same camera and physical scale.',fill='#183546');draw.text((24,832),'Actual interior positions changed. Perimeter and total height remain fixed. Not game rendering.',fill='#183546')
image.save(out/'wall-perspective.png');print(j['candidateRawTopology'])
