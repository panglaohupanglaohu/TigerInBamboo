// Workshop taxonomy is independent of upstream provenance and execution readiness.
export const LAYERS=[
 ['terrain','地形','△','承托、地貌与地表'],['building','建筑','▥','建筑与空间'],['water','水','≈','水面、水岸与流动'],['light','光','☼','光照与时间'],['world','世界','◎','画风、融合与世界规则'],['life','生命','❧','天气、植被与动物'],['effects','烟火','♨','火焰、烟雾与表现'],['vehicles','载具','≋','船、飞行器与车'],['combat','战斗','⚑','遭遇、单位与战役'],['foundation','基础与工具','◇','共享算法、网格与工程支持']
].map(([id,name,icon,description])=>({id,name,icon,description}));
export function classifyCapability(cap){
 if(cap.code&&cap.layerId)return [cap.layerId,(cap.codeMeta?.kind2==='geometry'?'改体素':'显示层')+' · 代码能力'];
 const prefix=cap.id.split('.')[0];
 const explicit={terrain:['terrain','地貌'],building:['building','建筑'],water:['water','水面与水岸'],light:['light','光照'],world:['world','画风与世界'],life:['life','综合生命'],weather:['life','天气'],vegetation:['life','植被'],animals:['life','动物'],effects:['effects',cap.id.endsWith('smoke')?'烟':'火'],vehicles:['vehicles',({boats:'船',aircraft:'飞行器',cars:'车'})[cap.id.split('.')[1]]||'其他载具'],combat:['combat','遭遇']};
 if(!cap.scanned&&explicit[prefix])return explicit[prefix];
 const record=cap.provenance?.records?.[0]||{},lane=record.lane,group=record.group||'',where=record.where||'';
 // Explicit upstream module evidence takes priority over broad lane ownership.
 if(/(?:smoke\.js|烟雾)/i.test(where+' '+record.name))return ['effects','烟'];
 if(/(?:effects\.js|火焰)/i.test(where+' '+record.name))return ['effects','火与特效'];
 if(/(?:atmosphere\.js|风雪|天气)/i.test(where+' '+record.name))return ['life','天气'];
 if(/(?:birds\.js|海鸥|飞鸟|蝴蝶)/i.test(where+' '+record.name))return ['life','动物'];
 if(/(?:boats\.js|长船|船只|航迹)/i.test(where+' '+record.name))return ['vehicles','船'];
 if(lane==='veg')return ['life','植被 · '+group];
 if(lane==='terrain')return ['terrain','地貌方法'];
 if(lane==='build')return ['building',/墙饰/.test(group)?'墙饰':'建筑方法'];
 if(lane==='fusion')return ['world','地形与建筑融合'];
 if(lane==='badnorth')return ['combat',group];
 if(lane==='style')return ['world',group];
 if(lane==='base'){
  if(group==='水层')return ['water','水层方法'];
  if(group==='光照')return ['light','光照方法'];
  return ['foundation',group||'共享能力'];
 }
 return ['foundation','来源待归类'];
}
export function mountCapabilityLibrary(host,{capabilities,getRecipe,onAdd,onSelectLayer=()=>{}}){
 let selected='terrain',query='',methodsOpen=false;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 function render(search=query){query=search;const q=query.trim().toLowerCase(),all=capabilities.filter(c=>!c.legacy),matches=all.filter(c=>!q||(JSON.stringify(c)+' '+classifyCapability(c).join(' ')+' '+LAYERS.find(l=>l.id===classifyCapability(c)[0]).name).toLowerCase().includes(q)),available=LAYERS.filter(l=>matches.some(c=>classifyCapability(c)[0]===l.id));
  if(!available.some(l=>l.id===selected)&&available.length)selected=available[0].id;
  host.replaceChildren();const nav=el('nav',undefined,'layer-nav');nav.setAttribute('aria-label','场景层分类');
  for(const layer of LAYERS){const rows=matches.filter(c=>classifyCapability(c)[0]===layer.id),b=el('button',undefined,'layer-choice');b.type='button';b.dataset.layer=layer.id;b.setAttribute('aria-pressed',String(selected===layer.id));b.disabled=q&&!rows.length;b.append(el('span',layer.icon+' '+layer.name),el('small',String(rows.length)));b.onclick=()=>{selected=layer.id;methodsOpen=false;render();onSelectLayer(layer.id);};nav.append(b);}host.append(nav);
  if(!matches.length){host.append(el('p','没有匹配能力；试试场景层、方法名或来源 ID。','library-empty'));return;}
  const layer=LAYERS.find(l=>l.id===selected),rows=matches.filter(c=>classifyCapability(c)[0]===selected),sceneCaps=rows.filter(c=>!c.scanned),pending=rows.filter(c=>c.scanned);
  const section=el('section',undefined,'layer-content');section.dataset.layer=selected;section.append(el('h3',layer.name+'层'),el('p',layer.description,'muted'));
  function list(entries,parent){const groups=[...new Set(entries.map(c=>classifyCapability(c)[1]))];for(const group of groups){const box=el('section',undefined,'capability-subgroup');box.append(el('h4',group));for(const cap of entries.filter(c=>classifyCapability(c)[1]===group)){const row=el('div',undefined,'capability');row.dataset.capabilityId=cap.id;const title=el('div',undefined,'capability-title');title.append(el('strong',cap.name),el('small',cap.mode==='code'?'⚙ 代码能力 · 可执行':cap.mode==='live'?'● 参数已接入':cap.mode==='editor'?'◐ 手工编辑器':'○ 待执行适配'));const b=el('button',getRecipe().nodes.some(n=>n.id===cap.id)?'已加入':'+');b.setAttribute('aria-label','添加'+cap.name);b.disabled=getRecipe().nodes.some(n=>n.id===cap.id);b.onclick=()=>onAdd(cap);row.append(title,b);box.append(row);}parent.append(box);}}
  section.append(el('h4','场景能力 · '+sceneCaps.length));if(sceneCaps.length)list(sceneCaps,section);else section.append(el('p','这一层尚无已接入的场景执行能力。','muted'));
  const details=el('details',undefined,'method-shelf');details.open=!!q||methodsOpen;details.ontoggle=()=>methodsOpen=details.open;details.append(el('summary','待适配方法 · '+pending.length));details.append(el('p','可加入配方记录意图；不会自动执行或改写场景。','muted'));list(pending,details);section.append(details);host.append(section);
 }
 return {render,selectLayer(id){if(LAYERS.some(l=>l.id===id)){selected=id;methodsOpen=false;render();}}};
}

export function layerInsertionIndex(nodes,capabilities,capability){const layer=classifyCapability(capability)[0];for(let i=nodes.length-1;i>=0;i--){const existing=capabilities.find(c=>c.id===nodes[i].id);if(existing&&classifyCapability(existing)[0]===layer)return i+1;}return nodes.length;}
