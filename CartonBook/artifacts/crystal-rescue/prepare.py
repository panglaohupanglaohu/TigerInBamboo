import json,math
from pathlib import Path
D=Path('CartonBook/artifacts/crystal-rescue');root=Path('CartonBook');story=json.load(open(D/'story.json'));assets=json.load(open(D/'assets.json'))
# Preserve family identities and the live game's code phrase.
for i,row in enumerate(story):
 if i+1 in range(34,46) or i+1 in [50,53]:row[2]=row[2].replace('他停在','她停在').replace('他一直','她一直').replace('他仍','她仍').replace('他自己','她自己').replace('他的影子','她的影子').replace('他不愿','她不愿').replace('让他离开','让她离开')
story[4][2]='苍竹的信夹在航线册里，纸上有潮气。|女儿虎虎困在湖沼，母亲化作红狐，仍守着旧港的八音盒。|最后一行写着：别让她一个人等。'
story[36][2]='“两家秋雨一家声，你猜。”|信使没有再靠近，等女儿自己认出来。|红狐站在旁边，一动不动。'
story[37][2]='“芭蕉与荷。”|父亲说完，才发觉自己一直屏着气。|虎虎终于把头转向了他们。'
story[40][2]='“我是虎虎，你的虎虎，你的姑娘！”|“你晒黑了，姑娘。”父亲说，声音忽然哑了。|红狐站在他们身旁，许久没有移开目光。'
story[52][2]='“我爱她，也爱她的妈妈。我们是一家人。”|话说完以后，他们仍安静坐了一会儿。|还有很多事要慢慢说，今天先一起回家。'
json.dump(story,open(D/'story.json','w'),ensure_ascii=False,indent=2)
shots=[];pages=[]
shots.append({'id':'cover','camera':{'object':assets['city'],'auto':True,'angle':[.55,.60,1.25],'scale':1.1,'fov':55}})
# Each page has a geographic shot, a character/detail shot, and a return to context.
styles=['edena-establish','edena-vertical','edena-reply','edena-detail','edena-battle','edena-quiet']
secondary={'city':'garden','port':'city','shore':'port','garden':'city','gate':'heroes','heroes':'gate','moss':'gate','swamp':'water','roots':'swamp','path':'shelf','ecology':'water','water':'ecology','shelf':'path','fox':'fox','tiger':'tiger','citadel':'gate'}
chapters=['一 · 水晶城的来信','二 · 门外的约定','三 · 湖沼不再沉默','四 · 两家秋语','五 · 谁也不落下','六 · 城与湖沼']
for i,(title,place,words) in enumerate(story,1):
 texts=words.split('|');ids=[]
 for j in range(3):
  id=f'p{i:02}-{j+1}';k=place if j!=1 else secondary[place];obj=assets[k]
  if k=='swamp':
   eye=[[42,65,64],[22,40,28],[-22,40,28]][(i+j)%3];cam={'object':obj,'eye':eye,'aim':[0,1,0],'fov':48,'waitMs':100}
  elif k in ['tiger','fox']:
   eye=([18,10,20],[-18,10,20],[2,16,24])[(i+j)%3] if k=='tiger' else ([3,2,3],[-3,2,3],[-3,3,-3])[(i+j)%3]
   cam={'object':obj,'eye':eye,'aim':[0,3,1] if k=='tiger' else [0,.3,0],'fov':55,'waitMs':100}
  else:
   angle=[[.65,.7,1.2],[-.65,.45,1.05],[.45,.25,1.2]][j]
   if k in ['path','roots','ecology','shore','gate','moss']:angle[1]+=.4
   cam={'object':obj,'auto':True,'angle':angle,'scale':.75 if j==1 else 1.0,'fov':50 if j==1 else 58}
  shot={'id':id,'title':title,'caption':texts[j],'camera':cam,'page':i,'purpose':['建立空间与行动方向','人物反应或物件细节','回到场所并引出下一页'][j]}
  if j==0 and i in [5,11,16,28,41,46]:shot['rescueThrough']={5:1,11:2,16:3,28:4,41:5,46:6}[i]
  if j==0 and i in [1,49]:shot['playerAt']=assets['port']
  shots.append(shot);ids.append(id)
 pages.append({'number':i+2,'storyPage':i,'title':title,'chapter':chapters[(i-1)//9],'layout':styles[(i-1)%len(styles)],'panels':ids,'captions':texts})
recipe={'id':'crystal-tiger-rescue','title':'水晶城 · 把春天带回家','subtitle':'信使、红狐与湖沼之虎','physicalPages':56,'narrativePages':54,'sourceUrl':'http://localhost:8931/TigerMessenger/','study':'Edena: 尺度、视线、静默、重复中的变化；双页封面，54页逐页编排','shots':shots,'pages':pages}
json.dump(recipe,open(root/'recipes/crystal-tiger-rescue.json','w'),ensure_ascii=False,indent=2)
json.dump({'id':'final-capture','shots':shots,'output':str((root/'chapters/crystal-tiger-rescue/shots').resolve())},open(D/'command.json','w'),ensure_ascii=False,indent=2)
md='# 水晶城 · 把春天带回家\n\n56个书本页：2页连续跨页封面 + 54页叙事。原作身份：父亲=信使，母亲=不能说话的红狐，女儿=湖沼之虎。剧情根据原家书、现有救援主线与本册新编排；城与湖沼相互照料为本册主题。\n\n'
for i,(title,place,words) in enumerate(story,1):
 md+=f'## 第{i+2}页 · {title}\n\n'+words.replace('|','\n\n')+'\n\n镜头：'+ ' → '.join(f'`p{i:02}-{j+1}` {shots[1+(i-1)*3+j]["purpose"]}' for j in range(3))+'。\n\n'
(root/'docs/CRYSTAL-TIGER-STORYBOARD.md').write_text(md)
(D/'asset-scene-map.json').write_text(json.dumps({k:{'object':v,'storyPages':[i for i,row in enumerate(story,1) if row[1]==k]} for k,v in assets.items()},ensure_ascii=False,indent=2))
print(len(pages),'narrative pages;',len(shots),'unique shots')
