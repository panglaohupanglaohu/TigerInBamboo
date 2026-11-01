# coding: utf-8
"""Decode every frame in presentation order; retain timestamps and contact sheets."""
from pathlib import Path
import sys,json
import cv2
from PIL import Image,ImageDraw
root=Path(__file__).resolve().parents[1]
for id in sys.argv[1:]:
 out=root/'artifacts/coverage'/id;out.mkdir(parents=True,exist_ok=True)
 cap=cv2.VideoCapture(str(root.parents[1]/'REA-agent/gifs'/(id+'.mp4')));fps=cap.get(cv2.CAP_PROP_FPS);rows=[];batch=[];page=0
 def sheet(batch,page):
  canvas=Image.new('RGB',(1200,1360),'#eff4f3');d=ImageDraw.Draw(canvas)
  for j,(idx,t,im) in enumerate(batch):
   x=j%10*120;y=j//10*136;im.thumbnail((118,118));canvas.paste(im,(x,y));d.text((x+2,y+118),f'{idx:04d} {t:.3f}s',fill='#20343c')
  canvas.save(out/f'sheet-{page:02}.jpg',quality=90)
 i=0
 while True:
  ok,bgr=cap.read()
  if not ok:break
  t=cap.get(cv2.CAP_PROP_POS_MSEC)/1000
  im=Image.fromarray(cv2.cvtColor(bgr,cv2.COLOR_BGR2RGB));im.save(out/f'frame-{i:04}.jpg',quality=88)
  rows.append({'frame':i,'seconds':t});batch.append((i,t,im));i+=1
  if len(batch)==100:sheet(batch,page);batch=[];page+=1
 if batch:sheet(batch,page)
 cap.release();(out/'frames.json').write_text(json.dumps({'id':id,'fps':fps,'decoded':i,'frames':rows},indent=2));print(id,i,'decoded frames')
