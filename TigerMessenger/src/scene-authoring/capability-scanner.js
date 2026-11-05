// Read the library's declarative JSON assignment, never eval library JavaScript.
export function scanPipelineText(text){
 const match=text.match(/^\s*window\.PIPELINE\s*=\s*([\s\S]*?)\s*;?\s*$/);
 if(!match)throw Error('不是已识别的能力库格式');
 const data=JSON.parse(match[1].replace(/;\s*$/,'')),found=[],seen=new Set();
 if(!Array.isArray(data.lanes))throw Error('能力库缺少lanes');
 for(const lane of data.lanes)for(const [group,rows]of lane.groups||[])for(const item of rows){
  const base=['rea',lane.key,item.id||'local',item.toggle||'entry'].join('.');let id=base,seq=1;while(seen.has(id))id=base+'.'+(++seq);seen.add(id);
  found.push({id,kind:lane.name,name:String(item.name),icon:'◇',color:lane.color||'#9ab4b0',mode:'recipe',scanned:true,source:item.where||'库记录未标实现位置',description:'扫描登记，尚无场景执行适配。'+(item.where?'':'未找到记录中的实现入口。'),checks:'来源 / 接口 / 依赖 / 执行验证',provenance:{note:'自动扫描自REACodeRefactoring/learn/pipeline.js；库登记状态不等于当前场景可执行。',modules:[],records:[{id:item.id||'无帖子ID',lane:lane.key,laneName:lane.name,group,name:item.name,where:item.where||'',status:item.status||'未登记',toggle:item.toggle,project:'以库记录为准'}]}});
 }
 return found;
}
export function registerScannedCapabilities(target,entries){
 if(!Array.isArray(entries)||entries.length>2000)throw Error('扫描能力列表无效');
 for(const entry of entries){if(typeof entry.id!=='string'||!entry.id.startsWith('rea.')||typeof entry.name!=='string'||!entry.provenance?.records?.length)throw Error('扫描能力字段无效');if(!target.some(c=>c.id===entry.id))target.push({...entry,mode:'recipe',controls:[],scanned:true});}
}
