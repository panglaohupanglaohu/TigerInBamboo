import urllib.request,urllib.parse,pathlib,concurrent.futures,re,json
out=pathlib.Path(__file__).parent
base='https://cdn-a.blazestreaming.com/out/v1/a686e1dcad4343cd83992d04fd897d27/38549d9a185b445888c6fbc2e2e792e9/50413c5b8a95441e919f0a1579606e47/'
master=urllib.request.urlopen(base+'index.m3u8').read().decode();(out/'master.m3u8').write_text(master)
uri=base+'9a8835ea959b45d58552db887cfd9f42/cbf0efaa7e8742959383a02621409d7c/index_3_0.m3u8'
pl=urllib.request.urlopen(uri).read().decode();(out/'english.m3u8').write_text(pl)
urls=[urllib.parse.urljoin(uri,l) for l in pl.splitlines() if l and not l.startswith('#')]
def read(u):
 for n in range(3):
  try:return urllib.request.urlopen(u,timeout=25).read().decode()
  except Exception:
   if n==2:raise
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as p: texts=list(p.map(read,urls))
cues={}
for t in texts:
 for b in re.split(r'\n\s*\n',t):
  m=re.search(r'(\d\d:\d\d:\d\d\.\d+) --> (\d\d:\d\d:\d\d\.\d+)[^\n]*\n([\s\S]+)',b)
  if m:cues[(m[1],m[2],m[3].strip())]=1
cs=sorted(cues)
(out/'english-cues.json').write_text(json.dumps([{'start':a,'end':b,'text':c} for a,b,c in cs],ensure_ascii=False,indent=2))
(out/'english-deduplicated.vtt').write_text('WEBVTT\n\n'+'\n\n'.join(a+' --> '+b+'\n'+c for a,b,c in cs)+'\n')
(out/'english-readable.txt').write_text('\n'.join(a+' '+c.replace('\n',' ') for a,b,c in cs)+'\n')
print('segments',len(texts),'unique cues',len(cs),'first',cs[0],'last',cs[-1])
