"""Install an explicitly chosen saved Blender revision into Web and Godot adapters."""
from pathlib import Path
import argparse,json,hashlib,shutil,subprocess,sys,os,re
p=argparse.ArgumentParser();p.add_argument('--version',type=int,required=True);args=p.parse_args()
r=Path(__file__).resolve().parents[2];name=f'warship-battle-v{args.version}';source=r/'assets/models/optimized'/name
for suffix in ['glb','assembly.json']:
 if not (source/f'{name}.{suffix}').is_file():raise SystemExit(f'Missing saved asset {name}.{suffix}')
assembly=json.loads((source/f'{name}.assembly.json').read_text())
if len(assembly['poseFrames'])!=301:raise SystemExit('Saved pose contract differs; adapt before installing')
out=r/'godot/assets'/name;out.mkdir(exist_ok=True)
for suffix in ['glb','assembly.json']:shutil.copy2(source/f'{name}.{suffix}',out/f'{name}.{suffix}')
record={'source':str(source.relative_to(r)),'sha256':hashlib.sha256((source/f'{name}.glb').read_bytes()).hexdigest(),'revision':args.version,'boardingValidated':False}
(out/'runtime-source.json').write_text(json.dumps(record,indent=2))
adapter=r/'godot/scripts/saihoji_warship_adapter.gd';adapter.write_text(re.sub(r'warship-battle-v\d+',name,adapter.read_text()))
subprocess.run([sys.executable,str(r/'tools/pipeline/export_warship_v6_web.py')],env={**os.environ,'WARSHIP_ASSET_VERSION':str(args.version)},check=True)
(r/'assets/models/optimized/warship-runtime.json').write_text(json.dumps(record,indent=2))
print(json.dumps(record))
