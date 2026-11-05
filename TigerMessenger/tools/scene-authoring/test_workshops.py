"""Repeatable workshop checks; unique reports, no user-browser profile or service mutation."""
import argparse,datetime,json,os,pathlib,shutil,subprocess,sys,time
ROOT=pathlib.Path(__file__).resolve().parents[3]
def main():
 p=argparse.ArgumentParser();p.add_argument('--output');p.add_argument('--skip-browser',action='store_true');a=p.parse_args()
 stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
 out=pathlib.Path(a.output).resolve() if a.output else ROOT/'TigerMessenger/artifacts/workshop-tests'/stamp
 out.mkdir(parents=True,exist_ok=False)
 node=os.environ.get('NODE_PATH_BIN') or shutil.which('node') or str(pathlib.Path.home()/'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
 report={'at':stamp,'output':str(out),'checks':[],'browserIsolation':'new non-persistent Playwright context; never user profile'}
 suites=[('learning-snapshot',[sys.executable,'TigerMessenger/tests/learning_snapshot_test.py']),('unit',[node,'--test',*[f'TigerMessenger/tests/{n}.test.mjs' for n in ['pipeline-execution','experiment-session','game-entry-ui','capability-scanner','capability-library','learning-declaration','learning-snapshot','learning-cache','learning-diff','learning-video-card','pipeline-model','scene-authoring','target-canopy-candidate']]]),('source-bridge',[sys.executable,'TigerMessenger/tests/source_bridge_test.py']),('watchdog',[sys.executable,'TigerMessenger/tests/watchdog_test.py'])]
 if not a.skip_browser:suites.append(('browser',[node,'TigerMessenger/tests/workshops-browser.mjs',str(out)]))
 for name,command in suites:
  start=time.monotonic()
  try:
   r=subprocess.run(command,cwd=ROOT,capture_output=True,text=True,timeout=420)
   (out/(name+'.log')).write_text(r.stdout+'\n'+r.stderr)
   report['checks'].append({'name':name,'status':'PASS' if r.returncode==0 else 'FAIL','exitCode':r.returncode,'seconds':round(time.monotonic()-start,2)})
  except (OSError,subprocess.TimeoutExpired) as e:
   report['checks'].append({'name':name,'status':'BLOCKED','error':type(e).__name__})
  (out/'summary.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(report,ensure_ascii=False,indent=2));return int(any(c['status']!='PASS' for c in report['checks']))
if __name__=='__main__':sys.exit(main())
