"""Authenticated client for this project's isolated loopback Source; no token leaves memory."""
import http.cookiejar,json,pathlib,re,urllib.request
ROOT=pathlib.Path.home()/'.local/share/tigermessenger-superagent'
BASE='http://127.0.0.1:8932'
def session():
 opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 for url in re.findall(r'https?://127\.0\.0\.1:8932[^\s\x1b]*',(ROOT/'logs/dsh.log').read_text(errors='replace')):opener.open(url.rstrip(')\"\''),timeout=5).read(128)
 return opener

def request(opener,path,payload=None,origin=BASE):
 if not path.startswith('/scene-source/') and not path.startswith('/orchestrator/api/'):raise ValueError('Unsupported local route')
 data=None if payload is None else json.dumps(payload).encode()
 headers={'Origin':origin,'X-Orchestrator-Request':'1'}
 if data is not None:headers['Content-Type']='application/json'
 with opener.open(urllib.request.Request(BASE+path,data=data,headers=headers),timeout=10) as response:return response.status,json.load(response)
if __name__=='__main__':
 import argparse
 p=argparse.ArgumentParser();p.add_argument('action',choices=['status','submit']);p.add_argument('--request-file');a=p.parse_args();opener=session()
 if a.action=='status':code,value=request(opener,'/scene-source/status')
 else:
  if not a.request_file:p.error('--request-file required')
  code,value=request(opener,'/scene-source/requests',json.loads(pathlib.Path(a.request_file).read_text()))
 print(json.dumps({'http':code,'result':value},ensure_ascii=False))
