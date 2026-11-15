/** Discovery for existing live controls. Counts controls, never source modules or algorithms. */
export function mountEnvironmentDiscovery(host){
 const body=host.querySelector('.environment-body');if(!body)return;
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const panel=el('div');panel.className='environment-discovery';const count=el('p');count.id='environment-control-count';count.setAttribute('role','status');
 const search=el('input');search.type='search';search.placeholder='搜索全部场景能力，如：倒影、描边、导航';search.setAttribute('aria-label','搜索全部场景能力');
 const actions=el('div');actions.className='environment-discovery-actions';const expand=el('button','展开可用分组'),collapse=el('button','收起分组');expand.type=collapse.type='button';actions.append(expand,collapse);
 const note=el('small','常用区只显示部分开关；更多功能在下面分组。北境专属项需切到北境；源码模块和可操作开关分别统计。');panel.append(count,search,actions,note);body.prepend(panel);
 const groups=[...body.querySelectorAll('details')],checkboxes=[...body.querySelectorAll('input[type=checkbox]')],labels=checkboxes.map(box=>({box,label:box.closest('label')})).filter(r=>r.label);
 const badges=new Map();for(const d of groups){const boxes=[...d.querySelectorAll('input[type=checkbox]')];if(!boxes.length)continue;const summary=d.querySelector(':scope>summary');const badge=el('small');badge.className='environment-group-count';summary.append(badge);badges.set(d,{badge,boxes});}
 let beforeSearch=null;
 function filter(){const q=search.value.trim().toLowerCase();if(q&&!beforeSearch)beforeSearch=new Map(groups.map(d=>[d,d.open]));
  for(const {label}of labels)label.hidden=!!q&&!label.textContent.toLowerCase().includes(q);
  // Process nested groups first so parent visibility follows matching descendants.
  for(const d of [...groups].reverse()){
   const summary=d.querySelector(':scope>summary'),ownTitle=summary?.childNodes[0]?.textContent?.toLowerCase()||'',rows=labels.filter(r=>d.contains(r.label));
   const titleMatch=!!q&&ownTitle.includes(q);if(titleMatch)for(const r of rows)r.label.hidden=false;
   const match=!q||titleMatch||(rows.length?rows.some(r=>!r.label.hidden):d.textContent.toLowerCase().includes(q));d.hidden=!match;if(q&&match)d.open=true;
  }
  if(!q&&beforeSearch){for(const [d,open]of beforeSearch)d.open=open;beforeSearch=null;}
 }
 function sync(){const enabled=checkboxes.filter(b=>!b.disabled).length;const text=`全部 ${checkboxes.length} 个开关 · 当前可操作 ${enabled} · 场景/依赖受限 ${checkboxes.length-enabled}`;if(count.dataset.signature!==text){count.replaceChildren(el('span','全部 '+checkboxes.length+' 个开关'),el('span','当前可操作 '+enabled),el('span','受限 '+(checkboxes.length-enabled)));count.dataset.signature=text;}count.dataset.total=checkboxes.length;count.dataset.available=enabled;
  for(const {badge,boxes}of badges.values()){const available=boxes.filter(b=>!b.disabled).length,next=` ${boxes.length} 项 · 可用 ${available}`;if(badge.textContent!==next)badge.textContent=next;}
 }
 search.oninput=filter;expand.onclick=()=>{for(const d of groups)if(!d.hidden&&(!badges.has(d)||badges.get(d).boxes.some(b=>!b.disabled)))d.open=true;};collapse.onclick=()=>{search.value='';filter();for(const d of groups)d.open=false;};
 const timer=setInterval(sync,500);sync();return{sync,dispose(){clearInterval(timer);panel.remove();for(const {badge}of badges.values())badge.remove();}};
}
