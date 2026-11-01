"""compare.py r0 r1 out.png : beauty tiles of two rounds side by side per station, plus scores"""
import sys,json,numpy as np
from PIL import Image,ImageDraw
from swamp_score import tiles
a,b,out=sys.argv[1:4];S=['entrance','rim','middle','lake','stairs']
sa={json.loads(l)['station']:json.loads(l) for l in open(f'{a}/scores.jsonl')};sb={json.loads(l)['station']:json.loads(l) for l in open(f'{b}/scores.jsonl')}
W,H=400,300;sheet=Image.new('RGB',(W*3+12,H*5+5*20),(18,18,22));d=ImageDraw.Draw(sheet)
for i,s in enumerate(S):
    y=i*(H+20)
    ta=Image.fromarray(tiles(f'{a}/{s}.jpg')[0].astype(np.uint8));tb=Image.fromarray(tiles(f'{b}/{s}.jpg')[0].astype(np.uint8))
    tg=Image.open(f'{a}/target-{s}.png') if __import__('os').path.exists(f'{a}/target-{s}.png') else Image.open(f'r0/target-{s}.png')
    sheet.paste(ta,(0,y+20));sheet.paste(tb,(W+6,y+20));sheet.paste(tg.resize((W,H)),(2*W+12,y+20))
    d.text((4,y+4),f'{s}  {a}: {sa[s]["total"]}',fill=(230,230,230));d.text((W+10,y+4),f'{b}: {sb[s]["total"]}',fill=(230,230,230));d.text((2*W+16,y+4),'target',fill=(230,230,230))
sheet.save(out);print('mean',a,round(sum(v['total'] for v in sa.values())/5,1),b,round(sum(v['total'] for v in sb.values())/5,1))
