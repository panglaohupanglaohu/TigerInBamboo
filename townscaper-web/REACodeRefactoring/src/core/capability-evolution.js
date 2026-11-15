/** Author chronology, separate from local study batches, source existence and runtime acceptance. */
export const RELATION_LABELS={extends:'扩展 A → A+',improves:'改进 A → A+',explains:'同项机制说明',combines:'组合来源',reuses:'复用',adapts:'跨场景适配',revisits:'再次探索',alternative:'方案分支',supersedes:'局部方案替代'};
const TOPICS={grid:'网格与拓扑',terrain:'地形',build:'建筑',water:'水',light:'光照',life:'生命与植被',texture:'纹理',fx:'效果与战斗',nav:'导航',tools:'工具',game:'游戏演示',show:'展示与参考'};
const modulesIn=text=>[...new Set(String(text||'').match(/src\/[\w/-]+\.(?:m?js)\b/g)||[])];
export function postTime(id){
 if(typeof id!=='string'||!/^\d{16,20}$/.test(id))return null;
 const n=BigInt(id);if(n>(1n<<63n)-1n)return null;
 const ms=Number((n>>22n)+1288834974657n);return new Date(ms).toISOString();
}
const compare=(a,b)=>(a.publishedAt||'9999').localeCompare(b.publishedAt||'9999')||a.id.localeCompare(b.id);
export function buildCapabilityEvolution(learn,pipeline){
 if(!Array.isArray(learn?.items)||!Array.isArray(pipeline?.lanes))throw Error('演进来源格式无效');
 const spec=pipeline.evolution||{schemaVersion:1,families:[],relations:[]};
 if(spec.schemaVersion!==1||!Array.isArray(spec.families)||!Array.isArray(spec.relations))throw Error('演进关系版本无效');
 const records=new Map(),methods=new Map(),issues=[];
 const sphereIds=new Set(spec.sphereClips||[]);let pipelineRows=0;const unanchoredMethods=[];
 for(const lane of pipeline.lanes)for(const [group,steps]of lane.groups)for(const item of steps){pipelineRows++;if(!item.id){unanchoredMethods.push({lane:lane.key,group,...item});continue;}const id=String(item.id);if(!methods.has(id))methods.set(id,[]);methods.get(id).push({lane:lane.key,laneName:lane.name,group,...item});}
 for(const item of learn.items){const id=String(item.id);if(records.has(id))throw Error('重复来源帖子 '+id);
  const publishedAt=postTime(id),date=publishedAt?.slice(0,10)||item.date||null,rows=methods.get(id)||[];
  const modules=modulesIn([item.where,...rows.map(r=>r.where)].join(' '));
  const early=item.project==='townscaper'&&date<'2019-01-01';
  const record={...item,id,publishedAt,date,recordedDate:item.date||null,dateBasis:publishedAt?'post-id-utc':'recorded-only',dateConflict:!!(publishedAt&&item.date&&item.date!==date),projectLabel:early?'早期实验（原标签 Townscaper，归属待核）':item.project==='next'?'后续未命名世界实验':item.project==='badnorth'?'Bad North':item.project==='townscaper'?'Townscaper':'其他/早期实验',projectConflict:early,methods:rows,modules,families:[],incoming:[],outgoing:[]};
  if(record.dateConflict)issues.push({type:'date-conflict',id,recorded:item.date,published:date});
  if(early)issues.push({type:'project-label',id,label:item.project});
  record.phase=early?'early':sphereIds.has(id)?'sphere':['badnorth','townscaper','next'].includes(item.project)?item.project:'other';
  if(item.status==='partial'){
   const review=spec.completionReviews?.[id],e=review?.sourceEvidence;
   const current=!!(review&&['高','中','低'].includes(review.priority)&&e?.status===item.status&&e?.note===(item.note||'')&&e?.where===(item.where||''));
   record.completion=review?{...review,current,priority:current?review.priority:'待复核'}:{priority:'待评估',current:false,nextAction:'尚未补工程优先级批注。'};
   if(!current)issues.push({type:'completion-review-needed',id});
  }
  records.set(id,record);
 }
 for(const [id,rows]of methods)if(!records.has(id)){issues.push({type:'pipeline-without-study',id});records.set(id,{id,date:postTime(id)?.slice(0,10)||null,publishedAt:postTime(id),dateBasis:'post-id-utc',recordedDate:null,projectLabel:'来源归属待核',methods:rows,modules:modulesIn(rows.map(r=>r.where).join(' ')),families:[],incoming:[],outgoing:[]});}
 const relationKeys=new Set();
 const relations=spec.relations.map(edge=>{
  if(!Object.hasOwn(RELATION_LABELS,edge.type)||!records.has(edge.fromId)||!records.has(edge.toId)||!edge.reason||!Array.isArray(edge.evidence)||!edge.evidence.length)throw Error('无效演进关系');
  const key=[edge.fromId,edge.toId,edge.type].join(':');if(relationKeys.has(key))throw Error('重复演进关系');relationKeys.add(key);
  const valid=edge.evidence.every(e=>['text','note'].includes(e.field)&&typeof e.value==='string'&&e.value.length>0&&records.get(e.id)?.[e.field]===e.value);
  if(edge.type==='supersedes'&&compare(records.get(edge.fromId),records.get(edge.toId))>=0)throw Error('替代关系必须指向后续版本');
  const row={...edge,id:key,valid,label:RELATION_LABELS[edge.type],assessment:edge.type==='revisits'?'按主题和时间梳理，传承关系仍需核对':edge.basis==='existing-review'?'依据已有视频审核，非本轮重看':'依据已保存作者文字；关系解释为本次梳理'};
  if(!valid)issues.push({type:'relation-evidence-changed',id:key});records.get(edge.toId).incoming.push(key);records.get(edge.fromId).outgoing.push(key);return row;
 });
 const families=spec.families.map(f=>{
  if(!f.id||!f.name||!Array.isArray(f.clips)||!Array.isArray(f.preferred))throw Error('无效演进主题');
  const ids=[...new Set(f.clips)];for(const id of [...ids,...f.preferred])if(!records.has(id))throw Error('演进主题引用缺失帖子 '+id);
  for(const id of ids)records.get(id).families.push(f.id);
  const clips=ids.sort((a,b)=>compare(records.get(a),records.get(b)));
  return {...f,clips,from:records.get(clips[0])?.date,to:records.get(clips.at(-1))?.date,selectionPolicy:'按场景和缺口选择；preferred 仅为研究入口，不提升执行/验收状态'};
 });
 if(new Set(families.map(f=>f.id)).size!==families.length)throw Error('重复演进主题');
 // All remaining posts stay visible, including art references and unrelated experiments.
 for(const r of records.values())if(!r.families.length){const id='topic:'+(r.topic||'unknown');let family=families.find(f=>f.id===id);if(!family){family={id,name:(TOPICS[r.topic]||'未归类')+' · 待梳理关系',clips:[],preferred:[],unreviewed:true,scope:'只有时间排序与原主题，未据此建立技术传承。',recommendation:'先核原文/原片，再决定与已有能力的关系。'};families.push(family);}family.clips.push(r.id);r.families.push(id);}
 const events=[...records.values()].sort(compare),linked=new Set(relations.filter(r=>r.valid).flatMap(r=>[r.fromId,r.toId]));
 const moduleIndex={};for(const event of events)for(const path of event.modules){const m=moduleIndex[path]??={clips:[],families:[],firstPostAt:event.date,lastPostAt:event.date};m.clips.push(event.id);m.lastPostAt=event.date;m.families=[...new Set([...m.families,...event.families])];}
 const phases=['badnorth','townscaper','next','sphere','early','other'].map(id=>({id,name:({badnorth:'Bad North',townscaper:'Townscaper',next:'next · 后续未命名实验',sphere:'sphere · 球面世界',early:'早期实验',other:'其他来源'})[id],posts:events.filter(e=>e.phase===id).length,partial:events.filter(e=>e.phase===id&&e.status==='partial').length}));
 return {schemaVersion:1,phases,priorityPolicy:spec.priorityPolicy,revision:spec.revision||'unreviewed',reviewBasis:spec.reviewBasis||'尚未人工梳理演进关系',datePolicy:spec.datePolicy,projectPolicy:spec.projectPolicy,families,relations,events,moduleIndex,issues,unanchoredMethods,counts:{partial:events.filter(e=>e.status==='partial').length,priorityCounts:Object.fromEntries(['高','中','低','待评估','待复核'].map(p=>[p,events.filter(e=>e.completion?.priority===p).length])),posts:events.length,pipelineRows,unanchoredMethods:unanchoredMethods.length,pipelineLinkedRows:[...methods.values()].reduce((n,r)=>n+r.length,0),pipelinePosts:methods.size,withoutPipeline:events.filter(r=>!r.methods.length).length,reviewedFamilies:spec.families.length,relations:relations.length,validRelations:relations.filter(r=>r.valid).length,relatedPosts:linked.size,withoutRelation:events.filter(r=>!linked.has(r.id)).length,dateConflicts:events.filter(r=>r.dateConflict).length,projectLabelsToReview:events.filter(r=>r.projectConflict).length}};
}
export async function evolutionFingerprint(model){const bytes=new TextEncoder().encode(JSON.stringify(model));return 'sha256:'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');}
