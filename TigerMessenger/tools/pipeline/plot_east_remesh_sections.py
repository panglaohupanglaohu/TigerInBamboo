import json
from pathlib import Path
from PIL import Image, ImageDraw
base=Path(__file__).resolve().parents[2]/'artifacts/pipeline/citadel-east-shore-route-20261006'
d=json.loads((base/'remesh-expanded-shift-audit.json').read_text());im=Image.new('RGB',(1200,820),'#f7f4ee');dr=ImageDraw.Draw(im)
dr.text((24,16),'CPU cross-sections: terrain retreat / PUBLIC SUPPORT PRESERVED / LIMITED DOUBLE-LANE CPU CHECK PASSED; NOT INSTALLED',fill='black')
dr.text((24,38),'Grey original rock | orange proposed rock | blue actual sea | green protected footprint samples',fill='black')
for k,s in enumerate(d['crossSections']):
 col=k%2; row=k//2;ox=35+col*595;oy=78+row*245;w=550;h=190
 def p(x,y):return(ox+(x-60)/50*w,oy+h-(y+65)/85*h)
 for y in [-60,-40,-20,0,20]:
  dr.line([p(60,y),p(110,y)],fill='#dddddd');dr.text((ox, p(60,y)[1]),str(y),fill='#555555')
 dr.text((ox,oy-18),'castle z='+str(s['z'])+'; x=60..110; Y=-65..20',fill='black')
 for name,color,width in [('before','#7b8792',2),('after','#d26434',3),('sea','#2e9dbe',2)]:
  pts=[p(q['x'],q[name]) for q in s['row'] if q[name] is not None]
  if pts:dr.line(pts,fill=color,width=width)
 for q in s['row']:
  if q['protected'] and q['before'] is not None:
   x,y=p(q['x'],q['before']);dr.ellipse((x-2,y-2,x+2,y+2),fill='#309340')
dr.text((635,592),'2949 support samples preserved (max 0.000002m)',fill='black')
dr.text((635,615),'Red: 0 surface poses / 0 inside points',fill='#ac3020')
dr.text((635,638),'Blue: 0 surface poses / 0 inside points',fill='#ac3020')
dr.text((635,667),'GPU, actors and upper structures still need review.',fill='black')
im.save(base/'remesh-expanded-sections.png')
