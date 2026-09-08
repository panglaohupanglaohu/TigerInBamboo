import concurrent.futures,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[2]
report=json.loads((root/'assets/models/originals/capture-report.json').read_text())
def run(entry):
    name=entry['id']
    target=root/'assets/models/originals'/'blender-r3'/f'{name}.blend'
    if target.exists():return {'id':name,'status':'existing archive retained'}
    p=subprocess.run(['/Applications/Blender.app/Contents/MacOS/Blender','--background','--python',str(root/'tools/originals/import_blender.py'),'--',name],capture_output=True,text=True,timeout=600)
    if p.returncode or not target.exists():return {'id':name,'status':'failed','log':(p.stdout+p.stderr)[-1800:]}
    return {'id':name,'status':'original imported; detailed optimization pending'}
results=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
    for row in pool.map(run,report):
        results.append(row);print('BLEND_ARCHIVE',row['id'],row['status'],flush=True)
(root/'assets/models/originals/blender-r3/blender-batch-report.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
