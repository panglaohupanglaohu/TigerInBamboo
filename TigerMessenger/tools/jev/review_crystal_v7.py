"""Hash-bound visual observations and compact checks; one cached Jev call."""
import argparse, hashlib, json, os
from pathlib import Path
from evaluate import evaluate
root=Path(__file__).resolve().parents[2]
out=root/'artifacts/pipeline/jev'
live=root/'artifacts/pipeline/crystal-v7-live'
parser=argparse.ArgumentParser();parser.add_argument('--prepare-only',action='store_true');args=parser.parse_args()
observations=json.loads((out/'crystal-v7-visual-observations.json').read_text())
for item in observations['sources']:
 if hashlib.sha256((root/item['path']).read_bytes()).hexdigest()!=item['sha256']:
  raise SystemExit('Render changed: refresh Astra observations before calling Jev')
checks=json.loads((live/'baseline.json').read_text())
port=json.loads((root/'artifacts/pipeline/moebius-crystal-city-target/mother-port-live-check.json').read_text())
state={'task':'Select next Crystal V7 spatial iteration from current game evidence',
 'target':'Three crystal towers enclose visible swamp water, connected stone shores and side harbors; railway behind core city.',
 'visual_observations':observations,
 'checks':[{'name':'Three live towers, dynamic swamp, port and no browser errors','required':True,'passed':len(checks['towers'])==3 and checks['swampUpdate']=='function' and checks['port'] and not checks['errors']},
 {'name':'Bridge ground samples (not full traversal)','required':True,'passed':bool(checks['groundChecks']) and all(c['ok'] for c in checks['groundChecks'])},
 {'name':'Existing mother port keyboard boarding','required':True,'passed':port.get('passed')},
 {'name':'Complete new shore walking route and story regression','required':True,'passed':None}],
 'constraints':['Preserve live swamp object and updates','Preserve mother port anchor','Do not hide objects only for screenshots','Prioritize square moss patch occlusion and canyon shoulder overlap before small decorative details','No release approval or asset edits by Jev'],
 'evidence_revision':hashlib.sha256((live/'baseline.json').read_bytes()).hexdigest()}
out.mkdir(exist_ok=True)
(out/'crystal-v7-evidence.json').write_text(json.dumps(state,ensure_ascii=False,indent=2)+'\n')
key=Path.home()/'.config/tigermessenger/typesafe.key'
if args.prepare_only:
 print('Evidence prepared; no network request.');raise SystemExit(0)
if not (os.environ.get('JEV_API_KEY') or (key.is_file() and key.read_text().strip())):
 print('Jev not called: missing JEV_API_KEY or ~/.config/tigermessenger/typesafe.key. Evidence is ready.');raise SystemExit(2)
try:
 result=evaluate(state)
except Exception as error:
 result={'next_step':'review','auto_apply':False,'error':type(error).__name__,'detail':str(error) if isinstance(error,(RuntimeError,ValueError)) else 'Connection or local configuration failed','cache_hit':False}
 (out/'crystal-v7-decision.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(result,ensure_ascii=False));raise SystemExit(1)
(out/'crystal-v7-decision.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(result,ensure_ascii=False))
