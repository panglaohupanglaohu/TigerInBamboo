import urllib.request,json,pathlib,subprocess,concurrent.futures,hashlib,math
from PIL import Image,ImageDraw
out=pathlib.Path(__file__).parent
ff='/tmp/greg-video-tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
ids=['2007828421796409856','1856039493368750245','1855943032069095662']
def process(i):
 d=json.loads((out/(i+'.json')).read_text());t=d['tweet'];assert t['author']['screen_name']=='ShedworksGreg'
 m=t['media']['videos'][0];url=m['url'];assert url.startswith('https://video.twimg.com/')
 dest=out/(i+'.mp4')
 if not dest.exists():dest.write_bytes(urllib.request.urlopen(url,timeout=40).read())
 frames=out/i;frames.mkdir(exist_ok=True)
 subprocess.run([ff,'-y','-loglevel','error','-i',str(dest),'-vf','fps=2','-threads','1',str(frames/'%04d.png')],check=True)
 files=sorted(frames.glob('*.png'));sheets=[]
 for n in range(math.ceil(len(files)/16)):
  sheet=Image.new('RGB',(1600,1016),'#f3efdf');draw=ImageDraw.Draw(sheet);draw.text((12,5),i+' | 2 fps temporal samples | not continuous video viewing',fill='black')
  for k,f in enumerate(files[n*16:(n+1)*16]):
   im=Image.open(f).convert('RGB');im.thumbnail((394,221));x=(k%4)*400;y=30+(k//4)*246
   sheet.paste(im,(x,y));draw.text((x+5,y+223),f'{(n*16+k)/2:.2f}s',fill='black')
  p=out/(i+f'-sheet-{n}.jpg');sheet.save(p,quality=92);sheets.append(str(p))
 return {'id':i,'author':t['author']['screen_name'],'post':'https://x.com/ShedworksGreg/status/'+i,'retrieval':'public FxTwitter metadata; original video.twimg.com media','text':t['text'],'duration':m['duration'],'url':url,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'frames':len(files),'samplingFPS':2,'sheets':sheets}
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as ex:rows=list(ex.map(process,ids))
(out/'media-manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
for row in rows:print(json.dumps({k:row[k] for k in ['id','duration','frames','sheets']},ensure_ascii=False))
