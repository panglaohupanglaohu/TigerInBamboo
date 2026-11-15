"""A4 single-leaf PDF, including a continuous cover across the first two leaves."""
from pathlib import Path
from io import BytesIO
import json
from PIL import Image, ImageOps
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from pypdf import PdfReader
root=Path(__file__).resolve().parents[1];recipe=json.loads((root/'recipes/crystal-tiger-rescue.json').read_text());chapter=root/'chapters'/recipe['id'];out=root/'output/pdf';out.mkdir(parents=True,exist_ok=True)
manifest=json.loads((chapter/'manifest.json').read_text());assert manifest['realCapture'] and len(manifest['shots'])==len(recipe['shots'])
pdfmetrics.registerFont(TTFont('Chinese','/System/Library/Fonts/Supplemental/Arial Unicode.ttf'))
W,H=595.276,841.89;pad=34;ink=HexColor('#293d3d');paper=HexColor('#fbf7ec');frames=[]
file=out/'crystal-tiger-rescue.pdf';c=Canvas(str(file),pagesize=(W,H));c.setTitle('水晶城 · 把春天带回家');c.setAuthor('CartonBook · TigerMessenger');c.setSubject('56页原创游戏实景漫画；Edena镜头与册页节奏研习')
def image(id,x,y,w,h):
 p=chapter/'shots'/f'{id}.png';im=Image.open(p).convert('RGB');im=ImageOps.fit(im,(max(1,int(w*1.8)),max(1,int(h*1.8))),centering=(.5,.5));b=BytesIO();im.save(b,format='JPEG',quality=85,optimize=True);b.seek(0);c.drawImage(ImageReader(b),x,y,width=w,height=h)
def txt(text,x,y,size=10,color=ink):
 c.setFillColor(color);c.setFont('Chinese',size);c.drawString(x,y,text)
def wrap(text,maxwidth,size):
 lines=[];line=''
 for ch in text:
  if pdfmetrics.stringWidth(line+ch,'Chinese',size)>maxwidth:lines.append(line);line=ch
  else:line+=ch
 if line:lines.append(line)
 return lines
def background():c.setFillColor(paper);c.rect(0,0,W,H,fill=1,stroke=0)
def frame(id,caption,x,y,w,h):
 lines=wrap(caption,w-4,10);capH=max(24,len(lines)*15+8);ih=h-capH
 image(id,x,y+capH,w,ih);c.setStrokeColor(ink);c.setLineWidth(.6);c.rect(x,y+capH,w,ih,stroke=1,fill=0)
 for i,line in enumerate(lines):txt(line,x+1,y+capH-14-i*15,10)
 assert ih>80
 frames.append({'id':id,'captionLines':len(lines),'height':ih})
# Draw the same wide image translated by one leaf, keeping the cover continuous.
im=Image.open(chapter/'shots/cover.png').convert('RGB');im=ImageOps.fit(im,(2100,1485));data=BytesIO();im.save(data,format='JPEG',quality=92);data.seek(0);cover=ImageReader(data)
for n in range(2):
 c.drawImage(cover,-n*W,0,width=2*W,height=H)
 c.setFillColor(paper)
 if n==0:
  txt('水还在，桥还在。',57,100,16);txt('等你们来。',57,75,16)
 else:
  txt('信使纪事 · 第二册',263,758,11);txt('把春天',260,681,52);txt('带回家',260,611,52);txt('水晶城与湖沼之虎',263,565,15)
 txt(str(n+1),W-35,19,8);c.showPage()
for p in recipe['pages']:
 background();txt(p['chapter'],pad,H-30,9);txt(f"{p['number']:02}",W-pad-16,H-30,9);txt(p['title'],pad,H-67,20)
 x,y,w,h=pad,49,W-2*pad,H-144;g=14
 mode=p['layout'].split('-')[-1]
 if mode=='vertical':rects=[(x,y,w*.48-g/2,h),(x+w*.48+g/2,y+(h+g)/2,w*.52-g/2,(h-g)/2),(x+w*.48+g/2,y,w*.52-g/2,(h-g)/2)]
 elif mode=='reply':rects=[(x,y+h*.55+g/2,(w-g)/2,h*.45-g/2),(x+(w+g)/2,y+h*.55+g/2,(w-g)/2,h*.45-g/2),(x,y,w,h*.55-g/2)]
 else:
  weights={'establish':[1.5,1,1],'detail':[1.4,.8,1.4],'battle':[1,1.5,1],'quiet':[1,1,1.7]}.get(mode,[1,1,1]);heights=[(h-2*g)*v/sum(weights) for v in weights];top=y+h;rects=[]
  for hh in heights:top-=hh;rects.append((x,top,w,hh));top-=g
 for id,caption,rect in zip(p['panels'],p['captions'],rects):frame(id,caption,*rect)
 txt('把春天带回家',pad,20,8);txt(str(p['number']),W-pad-12,20,8);c.showPage()
c.save();reader=PdfReader(file);assert len(reader.pages)==56
text=''.join(p.extract_text() for p in reader.pages);assert '芭蕉与荷' in text and '我们是一家人' in text
import shutil
shutil.copyfile(file,chapter/'book.pdf')
(root/'artifacts/crystal-rescue/pdf-qa.json').write_text(json.dumps({'pages':len(reader.pages),'frames':len(frames),'missingImages':0,'captionMinimumFont':10,'pageSize':[W,H],'bytes':file.stat().st_size,'textVerified':True},ensure_ascii=False,indent=2))
print('PDF',file, len(reader.pages),'pages',file.stat().st_size,'bytes')
