"""Read-only diagnosis of this project's isolated DSH; never prints its bootstrap token."""
import argparse,http.cookiejar,json,pathlib,re,urllib.request,urllib.error

def diagnose(root):
 report={'service':'dsh-superagent','modelExecutionVerified':False,'profile':'scene-authoring'}
 log=root/'logs/dsh.log'
 if not log.exists():return {**report,'status':'not-started'}
 urls=re.findall(r'https?://127\.0\.0\.1:8932[^\s\x1b]*',log.read_text(errors='replace'))
 opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 try:
  for url in urls:opener.open(url.rstrip(')\"\''),timeout=5).read(128)
  req=urllib.request.Request('http://127.0.0.1:8932/orchestrator/api/state',headers={'Origin':'http://127.0.0.1:8932','X-Orchestrator-Request':'1'})
  with opener.open(req,timeout=5) as response:data=json.load(response)
  problem=data.get('setup',{}).get('problem')
  return {**report,'status':'setup-required' if problem else 'runtime-ready','http':200,'setupProblem':problem,'workerLoad':data.get('load'),'note':'Authenticated runtime state only. Does not verify model execution or local scene Source.'}
 except Exception as error:return {**report,'status':'unavailable','http':getattr(error,'code',None),'error':type(error).__name__}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--output',required=True);args=parser.parse_args();report=diagnose(pathlib.Path.home()/'.local/share/tigermessenger-superagent');pathlib.Path(args.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
