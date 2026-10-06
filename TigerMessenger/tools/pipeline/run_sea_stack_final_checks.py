"""Run the coastal unit/integration checks and preserve exact source evidence."""
from pathlib import Path
import argparse, datetime, hashlib, json, shutil, subprocess
ROOT=Path(__file__).resolve().parents[2]
p=argparse.ArgumentParser();p.add_argument('--round',default='final');args=p.parse_args()
out=ROOT/'artifacts/pipeline/twelve-apostles-three-hour';out.mkdir(parents=True,exist_ok=True)
node=shutil.which('node') or '/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
sources=sorted((ROOT/'src/world').glob('seaStack*.js'))+[ROOT/'src/world/gateSeaStacks.js']
source_hashes={str(f.relative_to(ROOT)):sha(f) for f in sources}
results=[]
for name in ['surface','vegetation','lighting','shore_contact','surface_contract']:
 script=ROOT/f'tools/pipeline/test_sea_stack_{name}.mjs'
 started=datetime.datetime.now(datetime.timezone.utc).isoformat()
 try:
  run=subprocess.run([node,str(script)],cwd=ROOT,text=True,capture_output=True,timeout=240)
  result={'check':name,'startedAt':started,'exitCode':run.returncode,'testSHA256':sha(script),'sourceSHA256':source_hashes,'stdout':run.stdout,'stderr':run.stderr}
 except subprocess.TimeoutExpired as error:
  result={'check':name,'startedAt':started,'exitCode':None,'timeoutSeconds':240,'stdout':str(error.stdout or ''),'stderr':str(error.stderr or '')}
 (out/f'{args.round}-{name}-tests.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 results.append({'check':name,'passed':result['exitCode']==0,'report':f'{args.round}-{name}-tests.json'})
 print(name, 'PASS' if result['exitCode']==0 else 'FAIL',flush=True)
 changed=[str(f.relative_to(ROOT)) for f in sources if sha(f)!=source_hashes[str(f.relative_to(ROOT))]]
 if changed:raise SystemExit('Source changed during checks: '+', '.join(changed))
summary={'executedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'round':args.round,'checks':results,'allPassed':all(x['passed'] for x in results),'sourceSHA256':source_hashes}
(out/f'{args.round}-test-suite.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
raise SystemExit(0 if summary['allPassed'] else 1)
