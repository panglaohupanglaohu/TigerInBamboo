from pathlib import Path
import json,hashlib,shutil
D=Path('CartonBook/artifacts/crystal-rescue');C=Path('CartonBook/chapters/crystal-tiger-rescue');r=json.load(open('CartonBook/recipes/crystal-tiger-rescue.json'));entries={s['shotId']:s for s in json.load(open(D/'family-final-result.json'))}
for file in ['family-islet-result.json']:
 for s in json.load(open(D/file)):
  if not s['ok']:raise ValueError(str(s))
  entries[s['shotId']]=s
# Editorial reprises use existing live captures with explicit provenance, not manufactured shots.
reprises={'p01-2':'p02-1','p02-3':'p02-1','p06-3':'p02-1','p09-1':'p02-1','p09-3':'p02-1','p17-1':'p14-1','p17-3':'p15-2','p33-2':'p32-1','p48-3':'p02-1','p34-3':'p35-2','p35-3':'p34-1','p36-3':'p34-2','p37-3':'p36-2','p38-3':'p40-1','p39-3':'p38-2','p40-3':'p40-2','p07-2':'p02-1','p44-1':'p25-1','p44-2':'p25-2','p44-3':'p25-3','p45-2':'p23-1','p46-3':'p47-1','p51-2':'p04-1','p03-1':'p01-1','p03-3':'p01-3','p07-1':'p10-1','p07-3':'p05-3','p51-1':'p49-1','p51-3':'p54-1'}
# Read all sources before overwriting a destination.
images={src:(C/'shots'/f'{src}.png').read_bytes() for src in set(reprises.values())}
for dest,src in reprises.items():
 (C/'shots'/f'{dest}.png').write_bytes(images[src]);entries[dest]={**entries[src],'shotId':dest,'file':dest+'.png','reusedFrom':'shots/'+src+'.png','editorialReason':'场所回接或遮挡废片替换；保留实拍来源'}
for s in entries.values():s['sha256']=hashlib.sha256((C/'shots'/s['file']).read_bytes()).hexdigest()
ordered=[entries[s['id']] for s in r['shots']];assert len(ordered)==163 and all(s['ok'] and s['captureClean'] for s in ordered)
json.dump(ordered,open(D/'family-final-result.json','w'),ensure_ascii=False,indent=2)
p=r['pages'][15];p['captions'][0]='奥德休斯望着苔庭的方向，等他送出信号。'
# Preserve every page's narrative text alongside the publication recipe.
json.dump(r,open('CartonBook/recipes/crystal-tiger-rescue.json','w'),ensure_ascii=False,indent=2)
text='# 水晶城 · 把春天带回家 · 最终逐页故事板\n\n2页跨页封面 + 54页叙事 = 56页。父亲为信使，母亲为不能说话的红狐，虎虎为女儿。Edena 研究、截图来源及拍摄边界见 EDENA-STUDY.md、artifacts/crystal-rescue/capture-limits.md。\n\n'
for p in r['pages']:text+=f'## 第{p["number"]}页 · {p["title"]}\n\n'+ '\n\n'.join(p['captions'])+'\n\n'+p['layout']+' / '+' → '.join(p['panels'])+'\n\n'
Path('CartonBook/docs/CRYSTAL-TIGER-STORYBOARD.md').write_text(text)
print('ASSEMBLED',len(ordered),'frames;',len({s['sha256'] for s in ordered}),'distinct live images')
