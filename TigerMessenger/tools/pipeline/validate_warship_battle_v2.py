"""Reuse retained checks against V2 files; no test deletion and no model writes."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
A1=ROOT/'artifacts/pipeline/warship-battle-v1';A2=ROOT/'artifacts/pipeline/warship-battle-v2';O2=ROOT/'assets/models/optimized/warship-battle-v2'
for name in ['validate_and_roundtrip.py','audit_seats.py','check_oar_neighbors.py']:
 text=(A1/name).read_text().replace('warship-battle-v1.blend','warship-battle-v2.blend').replace('warship-battle-v1.glb','warship-battle-v2.glb').replace('warship-battle-v1.assembly.json','warship-battle-v2.assembly.json')
 text=text.replace('spec.loader.exec_module(s)','spec.loader.exec_module(s);s.OUT=Path('+repr(str(O2))+');s.ART=Path('+repr(str(A2))+');s.g.ART=s.ART')
 namespace={'__file__':str(A1/name),'__name__':'__main__'}
 exec(compile(text,str(A1/name),'exec'),namespace)
