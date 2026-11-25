"""JEV 批量分类：把还没归线的文件（REACode 原版 + 重构库模块）分到能力线。只用紧凑文字证据；
置信度 <0.85 记为待复核，不自动归线。缓存按请求内容，重复运行不重复付费。结果写 catalog/capability-tree-jev.json。"""
import json, subprocess, hashlib, os, time, urllib.request, urllib.error, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]; NODE=os.environ.get('NODE_PATH_BIN','/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node')
ENDPOINT='https://jevtypesafeai.com/api/v1/decide'; CACHE=Path.home()/'.cache/tigermessenger/jev'; OUT=ROOT/'TigerMessenger/src/scene-authoring/catalog/capability-tree-jev.json'
data=json.loads(subprocess.run([NODE,str(ROOT/'TigerMessenger/tools/refactor/tree-unassigned.mjs')],capture_output=True,text=True,check=True).stdout)
criteria={l['id']:(l['name']+'：'+l['question'])[:90] for l in data['lines']}; criteria['none']='学习页面、数据、第三方或入口壳，不属于任何一条能力线'
sys.path.insert(0,str(ROOT/'TigerMessenger/tools/jev')); from ask import ask, item_key, CACHE as ITEM_CACHE
TASK='Assign each source file to the single capability line it implements.'; INSTR='Which capability line does this file belong to? Use only its path, exports and header note.'
rows=data['rows']; items={r['key']:{'repo':r['repo'],'path':r['path'],'exports':r['exports'],'note':r['note'][:900]} for r in rows}
if '--seed-cache' in sys.argv:   # 一次性：把旧版整批缓存得到的结果写成单项缓存
    old=json.loads(OUT.read_text()).get('assignments',{}); ITEM_CACHE.mkdir(parents=True,exist_ok=True,mode=0o700); n=0
    for k,it in items.items():
        if k in old: (ITEM_CACHE/(item_key(TASK,'choice',criteria,INSTR,it)+'.json')).write_text(json.dumps({'choice':old[k]['line'],'confidence':old[k]['confidence'],'model':old[k].get('model')},ensure_ascii=False,sort_keys=True)); n+=1
    print('seeded',n)
res=ask(TASK,items,criteria,'choice',INSTR,0.85,6)
results={k:{'line':v['choice'],'confidence':v['confidence'],'accepted':v['accepted'] and v['choice']!='none','model':v.get('model')} for k,v in res['decisions'].items()}
acc=sum(1 for v in results.values() if v['accepted']); usage=res['usage']
OUT.write_text(json.dumps({'generatedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'endpoint':ENDPOINT,'threshold':0.85,'scope':'文字证据分类（路径 / 导出 / 文件头），不是源码审阅；低于阈值待人工复核','files':len(rows),'answered':len(results),'accepted':acc,'usage':usage,'assignments':results},ensure_ascii=False,indent=1)+'\n')
print(json.dumps({'files':len(rows),'answered':len(results),'accepted':acc,'usage':usage},ensure_ascii=False))
