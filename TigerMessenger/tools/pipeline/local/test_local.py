import json,os,threading,unittest
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from unittest.mock import patch
from doctor import check_qwen,diagnose
from qwen_probe import parse_tool_response,probe

def tool_message(arguments='{"nonce":"local-pipeline-probe"}'):
    return {'choices':[{'message':{'tool_calls':[{'id':'call_local','type':'function','function':{'name':'report_probe','arguments':arguments}}]}}]}

class Handler(BaseHTTPRequestHandler):
    calls=0
    def log_message(self,*args):pass
    def respond(self,payload,status=200):
        self.send_response(status);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(payload).encode())
    def do_GET(self):
        if self.path=='/error/models':return self.respond({'secret':'do-not-report-server-body'},401)
        self.respond({'data':[{'id':'Qwen/Qwen3.8-27B'}]})
    def do_POST(self):
        Handler.calls+=1;body=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
        self.respond(tool_message() if body.get('tools') else {'choices':[{'message':{'content':'LOCAL_PIPELINE_OK'}}]})

class LocalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),Handler);cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
        cls.url=f'http://127.0.0.1:{cls.server.server_port}/v1'
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join()
    def config(self):return {'configured':True,'baseURL':self.url,'model':'Qwen/Qwen3.8-27B','timeoutSeconds':.5}
    def test_unconfigured(self):
        self.assertEqual(check_qwen({})['status'],'not_configured');self.assertFalse(probe({'qwen':{}})['passed'])
    def test_models_and_no_inference(self):
        before=Handler.calls;r=check_qwen(self.config());self.assertTrue(r['ready']);self.assertFalse(r['inferenceVerified']);self.assertEqual(before,Handler.calls)
        c=self.config();c['model']='missing';self.assertEqual(check_qwen(c)['status'],'configured_model_not_listed')
    def test_error_body_not_reported(self):
        c=self.config();c['baseURL']=self.url.replace('/v1','/error');r=check_qwen(c)
        self.assertEqual(r['error'],'http_401');self.assertNotIn('do-not-report',json.dumps(r))
    def test_tool_contract(self):
        self.assertTrue(parse_tool_response(tool_message())['passed'])
        for value in [{},{'choices':[{'message':'bad'}]},tool_message('not JSON'),tool_message('{"nonce":"wrong"}'),{'choices':[{'message':{'content':'report_probe({})'}}]}]:self.assertFalse(parse_tool_response(value)['passed'])
    def test_probe_fake_only(self):
        before=Handler.calls;r=probe({'qwen':self.config()});self.assertTrue(r['passed']);self.assertEqual(Handler.calls-before,2);self.assertEqual(r['toolsExecuted'],0)
    def test_unknown_remote_blocked(self):
        c=self.config();c['baseURL']='https://unconfigured.invalid/v1';self.assertEqual(check_qwen(c)['error'],'nonlocal_endpoint_not_authorized')
    def test_credentials_not_printed(self):
        c=self.config();c['apiKeyEnv']='LOCAL_TEST_KEY'
        with patch.dict(os.environ,{'LOCAL_TEST_KEY':''}):self.assertEqual(check_qwen(c)['error'],'api_key_environment_variable_missing')
        with patch.dict(os.environ,{'LOCAL_TEST_KEY':'private-test-value'}):self.assertNotIn('private-test-value',json.dumps(check_qwen(c)))
    def test_doctor_missing_is_not_ready(self):
        r=diagnose({});self.assertFalse(r['pipelineReady']);self.assertFalse(r['blenderConnection']['mcpExecutionVerified']);self.assertEqual(r['godotBinary']['status'],'binary_missing');self.assertEqual(r['llada']['status'],'not_configured')

if __name__=='__main__':unittest.main()
