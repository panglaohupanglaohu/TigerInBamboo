"""Read-only source inventory. Hashes and import edges are evidence, not semantic equivalence."""
import argparse, hashlib, json, re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args()
workspace=Path(__file__).resolve().parents[3];original=workspace/'townscaper-web/REACode';ref=workspace/'townscaper-web/REACodeRefactoring'
coverage=json.loads((ref/'learn/coverage.json').read_text());mapped={m['source']:m for m in coverage['modules']}
rows=[]
for base in ['src','engine']:
 for path in sorted((original/base).rglob('*.js')):
  key=path.relative_to(original).as_posix();text=path.read_text();m=mapped.get(key,{});targets=[]
  for target in m.get('targets',[]):
   file=ref/target
   targets.append({'path':target,'exists':file.is_file(),'sha256':hashlib.sha256(file.read_bytes()).hexdigest() if file.is_file() else None})
  rows.append({'source':key,'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'imports':re.findall(r'(?:from\s*|import\s*)[\'\"]([^\'\"]+)[\'\"]',text),'targets':targets,'upstreamStatus':m.get('status','未登记'),'gap':m.get('gap','需建立职责与目标映射'),'domains':sorted({t['path'].split('/')[1] for t in targets if t['path'].startswith('src/')}),'mapped':key in mapped})
report={'scope':'Original src/engine JS; no execution, no behavior equivalence claim','modules':rows,'counts':{'actualSources':len(rows),'mapped':sum(r['mapped'] for r in rows),'unmapped':sum(not r['mapped'] for r in rows),'missingTargets':sum(not t['exists'] for r in rows for t in r['targets'])},'staleMappings':sorted(set(mapped)-{r['source'] for r in rows})}
Path(a.output).write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report['counts']))
