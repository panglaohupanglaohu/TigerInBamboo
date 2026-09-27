import json, math
from PIL import Image, ImageDraw
p='artifacts/pipeline/base-four-hour/'
d=json.load(open(p+'route-map.json'));im=Image.new('RGB',(1200,1100),'#e1e6e3');g=ImageDraw.Draw(im)
def xy(a):return (600+a[0]*3.7,590+a[2]*3.7)
for c in d['courts']:g.polygon([xy(v) for v in c['corners']],fill='#d2b398',outline='black');g.text(xy(c['corners'][0]),c['name'],fill='black')
last=None
for a in d['pts']:
 if last and abs(a['u']-last['u'])<.001:g.line([xy(last['p']),xy(a['p'])],fill='#355f80',width=3)
 if round(a['u']*5000)%40==0:g.text(xy(a['p']),str(round(a['u'],3)),fill='#832c25')
 last=a
im.save(p+'route-map.png')
