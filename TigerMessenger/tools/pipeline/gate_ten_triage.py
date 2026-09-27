import json,sys,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2];r=int(sys.argv[1]);observation=sys.argv[2];family=sys.argv[3] if len(sys.argv)>3 else 'taper-bridge'
p=root/'artifacts/pipeline/gate-of-sighs-build'/f'site-{family}-r{r:02d}-source.json'
d=json.loads(p.read_text());e={'round':r,'observations':[observation],'checks':[{'name':'tram swept clearance 5040 rays','required':True,'passed':not d['railFailures']},{'name':'original collision solver terrace ascent','required':True,'passed':d['collisionWalk']['passed']}],'scope':'Astra supplied image observations; Jev only classifies text.'}
folder=root/'artifacts/pipeline/jev';f=folder/f'gate-{family}-r{r:02d}-evidence.json';f.write_text(json.dumps(e));subprocess.run([sys.executable,str(root/'tools/jev/evaluate.py'),str(f),'--output',str(folder/f'gate-{family}-r{r:02d}-decision.json')],check=True)
