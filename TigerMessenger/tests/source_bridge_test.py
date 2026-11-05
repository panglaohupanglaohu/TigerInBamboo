import importlib.util,json,pathlib,sys,threading,unittest,urllib.request,urllib.error
from unittest.mock import patch
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'tools/scene-authoring'))
import source_bridge
class BridgeTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.server=source_bridge.ThreadingHTTPServer(('127.0.0.1',0),source_bridge.Handler);cls.base='http://127.0.0.1:'+str(cls.server.server_port);cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
 @classmethod
 def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join()
 def request(self,path,origin='http://localhost:8931',data=None,headers=None):
  return urllib.request.urlopen(urllib.request.Request(self.base+path,data=data,headers={'Origin':origin,**(headers or {})}),timeout=3)
 def test_cross_origin_is_rejected_before_native_access(self):
  with patch.object(source_bridge,'session') as session:
   with self.assertRaises(urllib.error.HTTPError) as e:self.request('/health',origin='https://untrusted.invalid')
   self.assertEqual(e.exception.code,403);session.assert_not_called()
 def test_native_failure_is_reported_without_false_worker_ready(self):
  with patch.object(source_bridge,'session',side_effect=TimeoutError()):
   with self.request('/health') as response:body=json.load(response)
   self.assertTrue(body['bridgeReady']);self.assertFalse(body['intakeReady']);self.assertFalse(body['workerReady']);self.assertTrue(body['nativeUnavailable'])
 def test_submit_requires_json_and_bounded_size(self):
  with self.assertRaises(urllib.error.HTTPError) as e:self.request('/requests',data=b'x')
  self.assertEqual(e.exception.code,415)
  with self.assertRaises(urllib.error.HTTPError) as e:self.request('/requests',data=b'{}',headers={'Content-Type':'application/json','Content-Length':'2000001'})
  self.assertEqual(e.exception.code,413)
 def test_unknown_routes_are_not_generic_authenticated_proxy(self):
  with self.assertRaises(urllib.error.HTTPError) as e:self.request('/orchestrator/api/settings')
  self.assertEqual(e.exception.code,404)
if __name__=='__main__':unittest.main()
