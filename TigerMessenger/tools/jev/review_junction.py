"""Refresh compact current evidence then evaluate once (cached if unchanged)."""
import json
from pathlib import Path
from evaluate import evaluate
root=Path(__file__).resolve().parents[2]
d=root/'artifacts/pipeline/canal-junction-target'
route=json.loads((d/'route-check.json').read_text())
harbor=json.loads((d/'harbor-probe.json').read_text())
observations=json.loads((root/'artifacts/pipeline/jev/junction-visual-observations.json').read_text())
if observations['image_sha256'] != __import__('hashlib').sha256((d/'dressed-final.png').read_bytes()).hexdigest():
    raise SystemExit('Render changed: refresh Astra visual observations before Jev evaluation')
state={
 'task':'Canal-junction target iteration and level-generation triage',
 'target':'Terraced colorful waterside castle, blue roofs, walk-through arch, open courtyard and harbor.',
 'visual_observations':observations,
 'checks':[
  {'name':'dock-to-keep pedestrian path','required':True,'passed':route.get('passed')},
  {'name':'candidate harbor local routes','required':True,'passed':len(harbor.get('routes',[]))==2 and all(r.get('passed') for r in harbor.get('routes',[]))},
  {'name':'actual dynamic boat sailing and boarding','required':True,'passed':None}],
 'constraints':['Preserve saved custom castles','Do not enable full-fleet dispatch based on local harbor tests','Keep authored path clear'],
 'evidence_revision':{n:__import__('hashlib').sha256((d/n).read_bytes()).hexdigest() for n in ['route-check.json','harbor-probe.json','dressed-final.png']}
}
out=root/'artifacts/pipeline/jev';out.mkdir(exist_ok=True)
(out/'junction-evidence.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
result=evaluate(state)
(out/'junction-decision.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False))
