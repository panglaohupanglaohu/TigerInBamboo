from PIL import Image, ImageDraw, ImageFont
import json, pathlib
root=pathlib.Path(__file__).parent
models=json.loads((root/'cpu-models.json').read_text())
im=Image.new('RGB',(1440,930),'#f5f1e9');d=ImageDraw.Draw(im)
try: font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',22);small=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',15)
except: font=small=ImageFont.load_default()
d.text((28,16),'Actual mesh projection: old city layout before / after',fill='#25343c',font=font)
d.text((28,48),'CPU top view of factory geometry. No GPU render, terrain seating or visual acceptance is claimed.',fill='#555555',font=small)
for idx,model in enumerate(models):
 ox=idx*720; project=lambda p:(ox+355+p[0]*12,458+p[2]*12)
 d.rounded_rectangle((ox+12,84,ox+708,871),radius=12,fill='#dce5df',outline='#bac6c2')
 tris=[(sum(v[1] for v in t)/3,m['color'],t) for m in model['meshes'] for t in m['triangles']]
 for y,c,t in sorted(tris,key=lambda x:x[0]):d.polygon([project(p) for p in t],fill=c)
 r=model['report'];center=r['layoutRedistribution']['towerPosition']
 for h in r['houses']:
  p=project(h['position']);d.ellipse((p[0]-3,p[1]-3,p[0]+3,p[1]+3),fill='#40211b')
 if idx:
  for route in r['radialLayout']['routes']:
   if len(route['points'])>1:d.line([project(p) for p in route['points']],fill='#378997',width=2)
  for h in r['houses']:d.line([project(center),project(h['position'])],fill='#967c6280',width=1)
 p=project(center);d.ellipse((p[0]-6,p[1]-6,p[0]+6,p[1]+6),outline='#732622',width=2)
 for label,p in [('entry',r['entry']['position']),('water feed',r['exits']['waterfallFeed']),('bridge',r['exits']['bridge'])]:
  x,y=project(p);d.ellipse((x-3,y-3,x+3,y+3),fill='#9e263b');d.text((x-30,y+8),label,fill='#9e263b',font=small)
 d.text((ox+28,98),'BEFORE: axial rollback' if idx==0 else 'AFTER: 15 reused houses, tower-centred streets',fill='#223940',font=font)
 d.text((ox+28,805),f"Tower floor {center[1]:.1f} m / {len(r['houses'])} stable editable houses",fill='#33454c',font=small)
 if idx:d.text((ox+28,830),'Main stair: 0.2814 m tread / 0.20 m rise. External anchors retained.',fill='#33454c',font=small)
d.text((28,895),'Geometry includes actual podiums, door voids, ring walks and stair flights. Post-placement wings excluded.',fill='#555555',font=small)
im.save(root/'cpu-before-after-top.png')
