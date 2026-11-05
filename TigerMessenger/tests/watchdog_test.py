import pathlib,sys,tempfile,unittest,datetime
from unittest.mock import patch,MagicMock
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]/'tools/scene-authoring'))
import watchdog
class WatchdogTests(unittest.TestCase):
 def test_occupied_port_never_spawns_or_kills(self):
  spawn=MagicMock();result=watchdog.start_missing('bridge',occupied=lambda p:True,spawn=spawn);self.assertFalse(result['started']);spawn.assert_not_called()
 def test_only_owned_service_can_start_and_credentials_not_inherited(self):
  with tempfile.TemporaryDirectory() as temp:
   root=pathlib.Path(temp);(root/'logs').mkdir();node=root/'node';node.touch();script=root/'bridge.py';script.touch();spawn=MagicMock(return_value=MagicMock(pid=123))
   with patch.object(watchdog,'ROOT',root),patch.object(watchdog,'NODE',node),patch.object(watchdog,'service_spec',return_value=([str(node),str(script)],8933)),patch.dict(watchdog.os.environ,{'EXAMPLE_API_KEY':'should-not-pass'}):
    result=watchdog.start_missing('bridge',occupied=lambda p:False,spawn=spawn)
   self.assertTrue(result['started']);self.assertNotIn('EXAMPLE_API_KEY',spawn.call_args.kwargs['env']);self.assertTrue(spawn.call_args.kwargs['start_new_session'])
 def test_healthy_services_never_trigger_recovery(self):
  with patch.object(watchdog,'diagnose',return_value={'status':'runtime-ready'}),patch.object(watchdog,'bridge_health',return_value={'bridgeReady':True,'intakeReady':True,'deploymentReady':True,'paused':True,'routableProviders':0}),patch.object(watchdog,'start_missing') as start:
   result=watchdog.tick(True);start.assert_not_called();self.assertFalse(result['modelExecutionVerified']);self.assertTrue(result['paused'])
 def test_expired_window_never_recovers_failed_services(self):
  with patch.object(watchdog,'diagnose',return_value={'status':'unavailable'}),patch.object(watchdog,'bridge_health',return_value={'bridgeReady':False}),patch.object(watchdog,'start_missing') as start:
   watchdog.tick(True,datetime.datetime.now(datetime.timezone.utc)-datetime.timedelta(seconds=1));start.assert_not_called()
 def test_unknown_service_rejected(self):
  with self.assertRaises(ValueError):watchdog.service_spec('game')
if __name__=='__main__':unittest.main()
