"""Independent bounded supervisor for this project's loopback services. Never enables model execution."""
import argparse,datetime,fcntl,hashlib,json,os,pathlib,re,socket,subprocess,sys,time,urllib.request
from check_dsh import diagnose
ROOT=pathlib.Path.home()/'.local/share/tigermessenger-superagent'
NODE=pathlib.Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
HERE=pathlib.Path(__file__).resolve().parent

def port_open(port):
 try:
  with socket.create_connection(('127.0.0.1',port),timeout=1):return True
 except OSError:return False

def bridge_health():
 req=urllib.request.Request('http://127.0.0.1:8933/health',headers={'Origin':'http://localhost:8931'})
 try:
  with urllib.request.urlopen(req,timeout=12) as response:body=json.load(response)
  return body if body.get('service')=='tm-scene-source-bridge' else {'bridgeReady':False,'error':'identity-mismatch'}
 except Exception as error:return {'bridgeReady':False,'error':type(error).__name__}

def service_spec(name):
 if name=='dsh':return [str(NODE),str(ROOT/'runtime/node_modules/@deepseek-ai/dsh/lib/bin.js'),'--profile','scene-authoring'],8932
 if name=='bridge':return [sys.executable,str(HERE/'source_bridge.py')],8933
 raise ValueError('Unknown owned service')

def start_missing(name,occupied=port_open,spawn=subprocess.Popen):
 argv,port=service_spec(name)
 if occupied(port):return {'started':False,'reason':'port-occupied-no-action'}
 if not pathlib.Path(argv[0]).is_file() or not pathlib.Path(argv[1]).is_file():return {'started':False,'reason':'owned-runtime-missing'}
 env={k:v for k,v in os.environ.items() if not re.search(r'TOKEN|API_KEY|SECRET|PASSWORD',k,re.I)}
 env['DSH_HOME']=str(ROOT/'dsh-home');env['PATH']=str(ROOT/'package-manager/node_modules/.bin')+os.pathsep+str(NODE.parent)+os.pathsep+'/usr/bin:/bin'
 logs=ROOT/'logs';logs.mkdir(parents=True,exist_ok=True);path=logs/('dsh.log' if name=='dsh' else 'source-bridge.log')
 with open(path,'w') as output:
  os.chmod(path,0o600);process=spawn(argv,cwd=str(ROOT),env=env,stdout=output,stderr=subprocess.STDOUT,start_new_session=True,close_fds=True)
 return {'started':True,'pid':process.pid,'service':name}

def tick(recover=False,deadline=None):
 native=diagnose(ROOT);bridge=bridge_health();actions=[]
 # An occupied but unhealthy port may belong to something else. Never kill or replace it.
 recover=recover and (deadline is None or datetime.datetime.now(datetime.timezone.utc)<deadline)
 if recover and native.get('status') in ('not-started','unavailable'):actions.append(start_missing('dsh'))
 if recover and not bridge.get('bridgeReady'):actions.append(start_missing('bridge'))
 return {'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'nativeStatus':native['status'],'bridgeReady':bool(bridge.get('bridgeReady')),'intakeReady':bool(bridge.get('intakeReady')),'deploymentReady':bool(bridge.get('deploymentReady')),'paused':bridge.get('paused'),'routableProviders':bridge.get('routableProviders'),'modelExecutionVerified':False,'actions':actions}

def write_state(path,value):
 path.parent.mkdir(parents=True,exist_ok=True);temp=path.with_suffix('.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,indent=2));os.replace(temp,path)

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--once',action='store_true');parser.add_argument('--recover',action='store_true');parser.add_argument('--until',help='UTC ISO deadline required for a loop');parser.add_argument('--interval',type=int,default=30);args=parser.parse_args()
 if not args.once and not args.until:parser.error('--until required for bounded supervision')
 deadline=datetime.datetime.fromisoformat(args.until.replace('Z','+00:00')) if args.until else None
 if deadline and deadline.tzinfo is None:parser.error('--until must include UTC offset')
 directory=ROOT/'watchdog';directory.mkdir(parents=True,exist_ok=True)
 lock=open(directory/'instance.lock','a+')
 try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
 except BlockingIOError:raise SystemExit('Owned watchdog is already running')
 previous=None
 while True:
  if deadline and datetime.datetime.now(datetime.timezone.utc)>=deadline:
   write_state(directory/'status.json',{'stopped':True,'reason':'window-ended','at':datetime.datetime.now(datetime.timezone.utc).isoformat()});break
  result=tick(args.recover,deadline);write_state(directory/'status.json',result)
  signature=json.dumps({k:v for k,v in result.items() if k!='at'},sort_keys=True)
  if signature!=previous:
   with open(directory/'changes.jsonl','a') as events:events.write(json.dumps(result,ensure_ascii=False)+'\n')
   previous=signature
  if args.once:print(json.dumps(result,ensure_ascii=False));break
  time.sleep(max(5,min(60,args.interval)))
