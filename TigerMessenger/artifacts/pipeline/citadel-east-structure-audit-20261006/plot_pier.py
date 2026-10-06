"""Engineering data plot, drawn from the saved actual mesh section only."""
import json, math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
root=Path(__file__).parent
s=json.loads((root/'final-pier-probe.json').read_text())['sections'][0]
rows=s['rows']; image=Image.new('RGB',(1440,780),'#faf9f5');d=ImageDraw.Draw(image)
font=ImageFont.load_default(size=22);small=ImageFont.load_default(size=18);title=ImageFont.load_default(size=29)
left,right,top,bottom=125,1370,185,660
xs=[r['distance']for r in rows];ys=[r[k]for r in rows for k in ['terrainY','deckPlaneY']if r[k] is not None]
x0,x1=min(xs),max(xs);y0,y1=math.floor(min(ys)*2)/2-.25,math.ceil(max(ys)*2)/2+.25
X=lambda x:left+(x-x0)/(x1-x0)*(right-left);Y=lambda y:bottom-(y-y0)/(y1-y0)*(bottom-top)
d.text((left,25),'Pier 5 / side -1: actual final refined rock section',fill='#273b42',font=title)
d.text((left,69),'CPU mesh data; not GPU or engineering-load acceptance',fill='#5d686b',font=font)
for i in range(7):
 y=y0+(y1-y0)*i/6;px=Y(y);d.line((left,px,right,px),fill='#d9dedc',width=1);d.text((18,px-9),f'{y:.2f}',fill='#465358',font=small)
for i in range(7):
 x=x0+(x1-x0)*i/6;px=X(x);d.line((px,top,px,bottom),fill='#e4e5e0',width=1);d.text((px-20,bottom+15),f'{x:.2f}',fill='#465358',font=small)
for key,color in [('terrainY','#547277'),('deckPlaneY','#d57545')]:d.line([(X(r['distance']),Y(r[key]))for r in rows if r[key]is not None],fill=color,width=5)
corner=math.hypot(s['badCorner'][0]-s['center'][0],s['badCorner'][2]-s['center'][2]);px=X(corner);a,b=Y(s['cornerTerrainY']),Y(s['badCorner'][1]);d.line((px,a,px,b),fill='#963e43',width=4);d.ellipse((px-5,a-5,px+5,a+5),fill='#963e43');d.text((px-290,a-40),'Corner intrusion: 0.2743 m',fill='#963e43',font=font)
d.text((left,112),'Rock surface',fill='#547277',font=font);d.text((left+250,112),'Lower-deck footing start plane',fill='#d57545',font=font)
d.text((left,bottom+63),'Section distance from original pier center toward failed corner (m)',fill='#273b42',font=font);d.text((left,top-32),'Castle-local height Y (m)',fill='#465358',font=small)
image.save(root/'final-pier-section.png')
