import json,math,sys
from pathlib import Path
import numpy as np
from PIL import Image,ImageDraw,ImageFont
base=Path(__file__).resolve().parents[2]/'artifacts/pipeline/citadel-cliff-shore-route-20261006'
d=json.load(open(base/(sys.argv[1] if len(sys.argv)>1 else 'engineering-layout-data.json'))); W,H=1800,940
im=Image.new('RGB',(W,H),'#eef2f0');draw=ImageDraw.Draw(im);font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',17);small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',13)
def top(p):return(45+(p[0]+155)/310*780,100+(p[2]+85)/205*700)
M=np.array(d['castleMatrix']).reshape((4,4),order='F');q=d['camera']['quaternion'];x,y,z,w=q
R=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
C=np.array(d['camera']['position']);tan=math.tan(math.radians(d['camera']['fov']/2));aspect=d['camera']['aspect']
def cam(p):return R.T@((M@np.array([*p,1]))[:3]-C)
def front(p):
 a=cam(p);return(890+(a[0]/(-a[2]*tan*aspect)+1)*435,230+(1-a[1]/(-a[2]*tan))*180)
def colour(tri):
 n=np.cross(np.array(tri[1])-tri[0],np.array(tri[2])-tri[0]);n=n/(np.linalg.norm(n)or 1);return '#91aa79'if n[1]>.83 else '#b2aaa0'
for tri in d['topTriangles']:draw.polygon([top(p)for p in tri],fill=colour(tri))
for tri in sorted(d['topTriangles'],key=lambda t:sum(cam(p)[2]for p in t)):
 ps=[front(p)for p in tri]
 if all(-3000<a<4000 and -3000<b<4000 for a,b in ps):draw.polygon(ps,fill=colour(tri))
for plat in d['platforms']:
 x,z=plat['center'];rx,rz=plat['radii'];pts=[[x+rx*math.cos(i*math.pi/50),plat.get('height',0),z+rz*math.sin(i*math.pi/50)]for i in range(101)]
 draw.line([top(p)for p in pts],fill='#34464a',width=2)
for key,line in d['lines'].items():
 col='#c53636'if key=='red-replacement'else'#2170ba'if key=='blue-replacement'else'#a070af'
 for f in[top,front]:draw.line([f(p)for p in line],fill=col,width=3 if'replacement'in key else 2)
for f in[top,front]:draw.line([f(p)for p in d['oldBridge']],fill='#252e32',width=3)
for k,p in d['junctions'].items():
 a=top([p[0],0,p[1]]);draw.ellipse([a[0]-5,a[1]-5,a[0]+5,a[1]+5],fill='#f5ca42');draw.text((a[0]+8,a[1]-20),k+' bridge bank',font=small,fill='#172c37')
for z in[-50,0,50,100]:
 a=top([-155,0,z]);draw.text((5,a[1]-8),str(z),font=small,fill='#253b43')
for x in[-100,-50,0,50,100]:
 a=top([x,0,-85]);draw.text((a[0]-15,80),str(x),font=small,fill='#253b43')
draw.text((40,22),'ENGINEERING LAYOUT - exact authored triangles, not game rendering',font=font,fill='#172c37')
draw.text((40,50),'TOP / castle X-Z metres; +Z toward foreground sea',font=small,fill='#172c37')
draw.text((900,120),'FRONT / recorded r47 camera projection',font=font,fill='#172c37')
draw.text((900,150),'Rails drawn on top for diagnosis; occlusion is NOT verified by this diagram.',font=small,fill='#172c37')
draw.text((40,850),'Red / blue: replacement rails. Purple: retained old global lines. Black: original upper bridge.',font=font,fill='#172c37')
draw.text((40,880),'No buildings or new bridge solids drawn. Platform outlines are footprints. This is not visual acceptance.',font=font,fill='#172c37')
im.save(base/(sys.argv[2] if len(sys.argv)>2 else 'independent-engineering-layout.png'))
