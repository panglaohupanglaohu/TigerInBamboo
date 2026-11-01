import urllib.request,urllib.parse,pathlib,concurrent.futures,subprocess,json
out=pathlib.Path(__file__).parent
ff='/tmp/greg-video-tools/imageio_ffmpeg/binaries/ffmpeg-macos-aarch64-v7.1'
base='https://cdn-a.blazestreaming.com/out/v1/a686e1dcad4343cd83992d04fd897d27/38549d9a185b445888c6fbc2e2e792e9/50413c5b8a95441e919f0a1579606e47/'
url=base+'9a8835ea959b45d58552db887cfd9f42/cbf0efaa7e8742959383a02621409d7c/index_1.m3u8'
pl=urllib.request.urlopen(url).read().decode();(out/'1080p.m3u8').write_text(pl)
segments=[];start=0;dur=0
for l in pl.splitlines():
 if l.startswith('#EXTINF:'):dur=float(l[8:].split(',')[0])
 elif l and not l.startswith('#'):segments.append((start,dur,urllib.parse.urljoin(url,l)));start+=dur
marks=[448,463,490,524,560,633,661,683,765,790,835,854,948,970,1020,1312,1328,1345,1364,1388,1410,1440,1478,1495,1540,1580,1626,1665,1698,1742,1765,1803]
def get(t):
 a,d,u=next(s for s in segments if s[0]<=t<s[0]+s[1]); name=f'{t//60:02d}-{t%60:02d}'
 dest=out/'segments'/f'{name}.ts';dest.parent.mkdir(exist_ok=True)
 if not dest.exists():dest.write_bytes(urllib.request.urlopen(u,timeout=30).read())
 frame=out/'frames'/f'{name}.png';frame.parent.mkdir(exist_ok=True)
 subprocess.run([ff,'-y','-loglevel','error','-i',str(dest),'-ss',str(t-a),'-frames:v','1','-threads','1',str(frame)],check=True)
 assert frame.exists(), str(frame)
 return {'second':t,'segmentStart':a,'source':u,'frame':str(frame)}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as p:results=list(p.map(get,marks))
(out/'frame-index.json').write_text(json.dumps(results,indent=2));print('sampled',len(results),'frames;duration',start)
