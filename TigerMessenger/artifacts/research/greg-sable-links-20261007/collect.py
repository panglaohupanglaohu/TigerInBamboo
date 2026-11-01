import json,pathlib,urllib.request,concurrent.futures,hashlib,subprocess,math
from PIL import Image,ImageDraw
out=pathlib.Path(__file__).parent
ids='1887140576526491902 1853866288071704780 1851648957224534135 1850109738383544750 1849085705915449413 1846894511567286445 1846854816695292046 1818177659928756540 1808858864831377586 861987378910679044 1644041125043523584 1628159716181397504 1625548261921636361 1597649279656812544 1597607628720439297 1585229225920864258 1584539869811908612 1576276605374038016 1540304867134259202 1539286878490439683 1531668497574637570'.split()
ff='/tmp/greg-video-tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
def get(url):
 return urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=35).read()
def process(pair):
 n,i=pair;r={'number':n,'id':i,'requested_url':'https://x.com/i/status/'+i,'reviewed':False}
 try:
  p=out/(i+'.json')
  if not p.exists():p.write_bytes(get('https://api.fxtwitter.com/status/'+i))
  d=json.loads(p.read_text());t=d['tweet'];r.update(author=t['author']['screen_name'],text=t['text'],url=t['url'],media=[])
  for j,m in enumerate(t.get('media',{}).get('all',[])):
   typ=m['type']; url=m['url']; assert url.startswith(('https://video.twimg.com/','https://pbs.twimg.com/'))
   suffix='.mp4' if typ in ('video','gif') else '.jpg';dest=out/(i+f'-{j}'+suffix)
   if not dest.exists():dest.write_bytes(get(url))
   v={'type':typ,'path':str(dest),'source':url,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
   if suffix=='.mp4':
    frames=out/(i+f'-{j}-frames');frames.mkdir(exist_ok=True)
    subprocess.run([ff,'-y','-loglevel','error','-i',str(dest),'-vf','fps=2,scale=480:-2','-threads','1',str(frames/'%05d.jpg')],check=True)
    files=sorted(frames.glob('*.jpg'));v.update(duration=m.get('duration'),samples=len(files),sampling_fps=2,sheets=[])
    for sn in range(math.ceil(len(files)/20)):
     sh=Image.new('RGB',(1600,1060),'#faf7ec');dr=ImageDraw.Draw(sh);dr.text((8,5),f'{n:02} | {i} | media{j} | 2 fps chronological samples',fill='black')
     for k,f in enumerate(files[sn*20:(sn+1)*20]):
      im=Image.open(f);im.thumbnail((395,180));x=k%4*400;y=26+k//4*205;sh.paste(im,(x,y));dr.text((x+5,y+183),f'{(sn*20+k)/2:.1f}s',fill='black')
     sp=out/(i+f'-{j}-sheet-{sn:02}.jpg');sh.save(sp,quality=90);v['sheets'].append(str(sp))
   r['media'].append(v)
  r['status']='retrieved'
 except Exception as e:r.update(status='failed',error=str(e))
 (out/(i+'-manifest.json')).write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps({k:r.get(k) for k in ('number','id','status','error','text')}),flush=True);return r
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:rows=list(ex.map(process,enumerate(ids,1)))
(out/'manifest.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print('COMPLETE',len(rows),sum(len(x.get('media',[])) for x in rows),flush=True)
