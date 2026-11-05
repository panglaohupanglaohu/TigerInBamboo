"""Project-origin local Source proxy. Loopback only; never forwards native auth to the browser."""
import argparse,json,pathlib,urllib.error
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from local_source_client import session,request
ORIGINS={'http://localhost:8931','http://127.0.0.1:8931'}
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def origin(self):return self.headers.get('Origin')
 def respond(self,status,value):
  data=json.dumps(value,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.send_header('Cache-Control','no-store')
  if self.origin() in ORIGINS:self.send_header('Access-Control-Allow-Origin',self.origin());self.send_header('Vary','Origin')
  self.end_headers();self.wfile.write(data)
 def allowed(self):
  if self.origin() not in ORIGINS:self.respond(403,{'error':'origin-not-allowed'});return False
  return True
 def do_OPTIONS(self):
  if not self.allowed():return
  self.send_response(204);self.send_header('Access-Control-Allow-Origin',self.origin());self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Content-Type');self.end_headers()
 def do_GET(self):
  if not self.allowed():return
  if self.path!='/health':self.respond(404,{'error':'unknown-operation'});return
  result={'service':'tm-scene-source-bridge','bridgeReady':True,'intakeReady':False,'workerReady':False,'modelExecutionVerified':False}
  try:
   client=session();_,source=request(client,'/scene-source/status');_,native=request(client,'/orchestrator/api/state');_,models=request(client,'/orchestrator/api/models');result.update(intakeReady=bool(source.get('intakeReady')),deploymentReady=bool(source.get('deploymentReady')),paused=bool(native.get('paused')),routableProviders=len(models.get('routableProviders',[])),running=native.get('load',{}).get('running',0),setupProblem=native.get('setup',{}).get('problem'))
  except Exception as error:result.update(nativeUnavailable=True,error=type(error).__name__)
  self.respond(200,result)
 def do_POST(self):
  if not self.allowed():return
  if self.path!='/requests':self.respond(404,{'error':'unknown-operation'});return
  if not self.headers.get('Content-Type','').startswith('application/json'):self.respond(415,{'error':'json-required'});return
  try:length=int(self.headers.get('Content-Length','0'))
  except ValueError:length=0
  if not 0<length<=2_000_000:self.respond(413,{'error':'invalid-request-size'});return
  try:
   payload=json.loads(self.rfile.read(length));code,result=request(session(),'/scene-source/requests',payload);self.respond(code,result)
  except urllib.error.HTTPError as error:
   self.respond(error.code,{'error':'native-source-rejected','status':error.code})
  except (ValueError,UnicodeError):self.respond(400,{'error':'invalid-json'})
  except Exception as error:self.respond(503,{'error':'native-source-unavailable','type':type(error).__name__})
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8933);args=parser.parse_args();server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler);print('Scene Source bridge listening on loopback port',args.port,flush=True)
 try:server.serve_forever()
 except KeyboardInterrupt:pass
 finally:server.server_close()
