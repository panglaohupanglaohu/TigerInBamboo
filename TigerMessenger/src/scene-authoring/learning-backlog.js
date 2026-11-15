const sha=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,'0')).join('');
export const STAGES={learning:'待学习',implementation:'待实现',validation:'待验证',review:'待核对',source:'待补来源'};
export async function reconcileBacklog(progress,coverage,ledger,deliveries=null){
 const lookup=new Map();for(const item of ledger?.items||[])for(const r of item.records||[])lookup.set(r.fingerprint,item);
 const grouped=new Map();
 for(const [i,record] of progress.next.entries()){
  const fingerprint=await sha(JSON.stringify({title:record.title,clips:[...(record.clips||[])].sort()})),review=lookup.get(fingerprint),id=review?.id||'unreviewed-'+fingerprint;
  if(!grouped.has(id)){
   const evidenceValid=review?.evidence?.every(e=>coverage.modules.some(m=>m.source===e.module&&m.evidence===e.path&&m.status===e.status&&m.gap===e.gap&&m.frameReview===true));
   const closed=review?.state==='closed'&&evidenceValid;
   grouped.set(id,{id,title:review?.title||record.title,state:closed?'closed':'open',stages:!review||review.state==='closed'&&!closed?['review']:review.stages,reason:!review?'新增或文字变化，尚未人工核对；不沿用旧核销。':review.state==='closed'&&!closed?'核销依据已变化，重新核对。':review.reason,evidence:review?.evidence||[],records:[]});
  }
  grouped.get(id).records.push({...record,originalIndex:i,fingerprint});
 }
 if(deliveries?.verified)for(const row of deliveries.items||[]){const item=grouped.get(row.id);if(!item||!item.records.every(r=>row.fingerprints.includes(r.fingerprint))||!Object.hasOwn(STAGES,row.stage))continue;item.delivery=row;item.stages=[row.stage];if(row.closed){item.state='closed';item.reason='本轮核对已有全帧学习和后续实现证据后核销旧学习排期；不是本轮重新学习。';}else item.reason='本轮核对了学习来源并交付下列代码；未完成部分继续保留。';}
 const items=[...grouped.values()],active=items.filter(x=>x.state==='open'),closed=items.filter(x=>x.state==='closed');
 return {items,active,closed,rawCount:progress.next.length,merged:progress.next.length-items.length,counts:Object.fromEntries(Object.keys(STAGES).map(k=>[k,active.filter(x=>x.stages[0]===k).length]))};
}
export function renderBacklog(host,report,{link,el}){
 host.append(el('p',`原始记录 ${report.rawCount} 条 → 合并重复 ${report.merged} 条 → 已核销 ${report.closed.length} 项 → 当前待办 ${report.active.length} 项。按首要动作计数；一项可含后续实现或验证要求。`));
 host.append(el('p','核销依据是已有记录与来源证据，不代表本轮重新运行测试；学习、实现、当前游戏验收分别记账。新记录或核销依据变化自动进入待核对。'));
 function rows(parent,items){for(const item of items){const card=document.createElement('details');card.dataset.backlogId=item.id;card.dataset.backlogState=item.state;
 card.append(el('summary',item.title+` · ${item.records.length} 条来源记录`),el('p',item.reason));
 if(item.delivery){card.append(el('strong','本轮核对与交付'));if(item.delivery.entry)card.append(link('打开已实现功能 ↗',item.delivery.entry));for(const text of item.delivery.done)card.append(el('p','✓ '+text));for(const study of item.delivery.studies)card.append(link('全片审阅：'+study.id+' · '+study.decodedFrames+'帧',study.reviewEvidence));if(item.delivery.remaining.length){card.append(el('strong','剩余要求'));for(const text of item.delivery.remaining)card.append(el('p',text));}}
 if(item.stages.length>1)card.append(el('p','后续动作：'+item.stages.slice(1).map(k=>STAGES[k]).join(' → ')));
 for(const e of item.evidence)card.append(link('核销证据：'+e.module,e.path),el('p',e.gap));
 const raw=document.createElement('details');raw.append(el('summary','原始记录与来源（保留全文）'));
 for(const record of item.records){raw.append(el('p',record.title));for(const id of record.clips||[])raw.append(link(id,'../../REA-agent/gifs/'+id+'.mp4'));}card.append(raw);parent.append(card);}}
 for(const [stage,name]of Object.entries(STAGES)){const section=document.createElement('details');section.dataset.backlogStage=stage;section.append(el('summary',name+`（${report.counts[stage]}）`));rows(section,report.active.filter(i=>i.stages[0]===stage));host.append(section);}
 const archived=document.createElement('details');archived.dataset.backlogStage='closed';archived.append(el('summary',`已核销（${report.closed.length}）`));rows(archived,report.closed);host.append(archived);
}
