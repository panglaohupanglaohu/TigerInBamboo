const e=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
export async function renderRefactorFiles(host,{query='',signal}={}){
 const note=e('p','正在读取全目录文件清单…');host.append(note);
 try{
  const response=await fetch(new URL('./catalog/reacode-file-status.json',import.meta.url),{cache:'no-store',signal});if(!response.ok)throw Error('清单 HTTP '+response.status);const data=await response.json();if(!Array.isArray(data.rows)||data.total!==data.rows.length)throw Error('清单格式错误');if(signal?.aborted)return;
  note.textContent=`REACode 全目录 ${data.total} 个代码文件：${data.extensions['.js']} JS、${data.extensions['.mjs']} MJS、${data.extensions['.html']} HTML。清单生成于 ${data.generatedAt}。`;
  host.append(e('p',data.warning),e('p','这份清单包含170模块以外的页面内联代码、学习界面与开发工具；候选落点不算完成。'));
  const bar=e('div'),filter=e('select'),search=e('input');filter.setAttribute('aria-label','重构完成状态');search.type='search';search.placeholder='搜索原文件、重构落点或缺口';search.setAttribute('aria-label','搜索全目录重构状态');search.value=query;
  for(const name of ['全部',...Object.keys(data.states)]){const option=e('option',name==='全部'?name:name+'（'+data.states[name]+'）');option.value=name;filter.append(option);}bar.append(filter,search);host.append(bar);
  const count=e('p'),table=e('table');table.className='refactor-file-table';const head=e('thead'),tr=e('tr');for(const name of ['原文件','类别 / 状态','重构落点','验证范围与未完成项'])tr.append(e('th',name));head.append(tr);const body=e('tbody');table.append(head,body);const scroll=e('div');scroll.className='refactor-file-scroll';scroll.append(table);host.append(count,scroll);
  const refRoot=new URL('../townscaper-web/REACodeRefactoring/',location.href),origRoot=new URL('../townscaper-web/REACode/',location.href),workspace=new URL('../',location.href);
  function link(text,path,root){const a=e('a',text);a.href=new URL(path,root);a.target='_blank';a.rel='noopener';return a;}
  function draw(){body.replaceChildren();const q=search.value.toLowerCase(),rows=data.rows.filter(r=>(filter.value==='全部'||r.state===filter.value)&&JSON.stringify(r).toLowerCase().includes(q));count.textContent=`显示 ${rows.length}/${data.total} 文件 · 本轮验证通过 ${data.rows.filter(r=>r.verifiedDelivery).length} 项（限声明范围）`;
   for(const r of rows){const row=e('tr'),source=e('td'),state=e('td'),targets=e('td'),gap=e('td');source.append(link(r.source,r.source,origRoot),e('small',r.lines+' 行 · '+r.sha256.slice(0,12)));state.append(e('strong',r.state),e('p',r.kind));for(const t of r.targets)targets.append(t.exists?link(t.path,t.path,refRoot):e('span',t.path+'（文件缺失）'));if(!r.targets.length)targets.append(e('span','待建立明确落点'));gap.append(e('p',r.scope||'尚无文件级验证回执'),e('p',r.gap));for(const ev of r.evidence)gap.append(ev.exists?link('验证证据',ev.path,ev.root==='workspace'?workspace:refRoot):e('span','证据路径未找到'));row.append(source,state,targets,gap);body.append(row);}}
  filter.onchange=draw;search.oninput=draw;draw();
 }catch(error){if(signal?.aborted)return;note.textContent='全目录清单读取失败：'+error.message;}
}
