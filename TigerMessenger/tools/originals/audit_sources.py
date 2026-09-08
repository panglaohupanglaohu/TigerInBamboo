"""Build a source coverage ledger. 'indexed' is not 'manually reviewed'."""
import hashlib,json,re
from pathlib import Path
root=Path(__file__).resolve().parents[2]
reviewed={'src/assets/bookshop.js','src/assets/toon.js','src/core/buildingCatalog.js'}
rows=[]
for p in sorted((root/'src').rglob('*.js')):
    rel=str(p.relative_to(root));s=p.read_text();lines=s.splitlines()
    exports=[{'name':m.group(1),'line':s[:m.start()].count('\n')+1} for m in re.finditer(r'export\s+(?:async\s+)?(?:function|class|const|let)\s+(\w+)',s)]
    imports=re.findall(r'(?:from\s*|import\s*)[\"\']([^\"\']+)[\"\']',s)
    geometry=sorted(set(re.findall(r'new\s+(?:THREE\.)?(\w*Geometry|Mesh|InstancedMesh|SkinnedMesh|Points|LineSegments)\b',s)))
    rows.append({'path':rel,'lines':len(lines),'sha256':hashlib.sha256(s.encode()).hexdigest(),'exports':exports,'imports':imports,'geometryConstructors':geometry,'runtimeFeatures':[key for key in ['onBeforeCompile','ShaderMaterial','CanvasTexture','userData','morphTarget','Skeleton','InstancedMesh'] if key in s],'review':'read for preservation' if rel in reviewed else 'indexed; detailed review pending'})
out=root/'assets/models/originals';out.mkdir(parents=True,exist_ok=True)
(out/'source-ledger.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
model_rows=[r for r in rows if r['geometryConstructors']]
text=['# 原模型代码覆盖清单','', '本表为自动索引，不代表全部代码已经人工通读，也不代表模型已优化。完整依赖和函数入口见 source-ledger.json。','',f'扫描 {len(rows)} 个 JS 文件、{sum(r["lines"] for r in rows):,} 行；其中 {len(model_rows)} 个文件直接创建几何、网格、线或粒子。','', '| 源文件 | 行数 | 原模型相关构造 | 阅读状态 |','|---|---:|---|---|']
for r in model_rows:text.append(f'| `{r["path"]}` | {r["lines"]} | {", ".join(r["geometryConstructors"])} | {r["review"]} |')
(out/'代码覆盖清单.md').write_text('\n'.join(text)+'\n')
print('SOURCE_LEDGER_OK',len(rows),'files;',len(model_rows),'geometry-producing files')
