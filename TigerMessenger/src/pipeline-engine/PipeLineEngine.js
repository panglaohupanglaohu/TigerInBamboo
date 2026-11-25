/** Worker-safe execution kernel. Capability algorithms stay in their source libraries. */
export const ENGINE_NAME='PipeLineEngine';
export const ENGINE_VERSION=1;
const bad=(message)=>{throw new Error('PipeLineEngine：'+message);};
function canonical(value,depth=0,budget={nodes:0}){
 if(++budget.nodes>1000000)bad('数据节点超出预算');
 if(depth>40)bad('数据层级超出预算');
 if(value===null||typeof value==='boolean'||typeof value==='string')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))bad('数据含非有限数值');return JSON.stringify(value);}
 if(Array.isArray(value)||ArrayBuffer.isView(value))return '['+Array.from(value,x=>canonical(x===undefined?null:x,depth+1,budget)).join(',')+']';
 if(value&&typeof value==='object'){const proto=Object.getPrototypeOf(value);if(proto!==Object.prototype&&proto!==null)bad('只接受结构化能力数据');return '{'+Object.keys(value).filter(k=>value[k]!==undefined).sort().map(k=>{if(['__proto__','constructor','prototype'].includes(k))bad('无效字段');return JSON.stringify(k)+':'+canonical(value[k],depth+1,budget);}).join(',')+'}';}
 bad('不接受函数或可执行代码');
}
export async function engineHash(value){const data=new TextEncoder().encode(canonical(value));if(data.length>16*1024*1024)bad('数据超出16MB预算');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');}
function normalizeParams(meta,given={}){
 if(!given||typeof given!=='object'||Array.isArray(given))bad(meta.id+' 参数无效');const schema=meta.params||{},out={};
 for(const key of Object.keys(given))if(!Object.hasOwn(schema,key))bad(meta.id+' 未声明参数 '+key);
 for(const [key,s]of Object.entries(schema)){let value=given[key]??s.default;if(s.type==='bool'){if(typeof value!=='boolean')bad(meta.id+'.'+key+' 必须是布尔值');}else if(s.type==='choice'){if(!Array.isArray(s.options)||!s.options.includes(value))bad(meta.id+'.'+key+' 必须是 '+JSON.stringify(s.options||[])+' 之一');}else{if(typeof value!=='number'||!Number.isFinite(value))bad(meta.id+'.'+key+' 必须是有限数值');value=Math.max(s.min??-Infinity,Math.min(s.max??Infinity,value));if(s.step===1||s.type==='int')value=Math.round(value);}out[key]=value;}return out;
}
export function executionContext(tier,sceneId){return{tier,sceneId:tier==='planet'?'planet':String(sceneId||'morris-lake')};}
export function assertEngineContext(expected,context){if(canonical(expected)!==canonical(context))bad('执行目标已经切换，请回到原场景或重新生成候选');}
export function assertExecutionScope(execution,context){if(!execution||execution.name!==ENGINE_NAME||execution.version!==ENGINE_VERSION||execution.status!=='executed')bad('缺少有效执行回执，请刷新后重新执行');assertEngineContext(execution.context,context);}
export async function validateEngineOutput(result){
 const{engine,...output}=result||{};if(!engine||engine.name!==ENGINE_NAME||engine.version!==ENGINE_VERSION||engine.status!=='executed')bad('执行回执无效');
 const planHash=await engineHash({adapter:engine.adapter,catalogHash:engine.catalogHash,context:engine.context,steps:engine.steps});
 if(planHash!==engine.planHash||await engineHash(output)!==engine.outputHash)bad('候选或执行计划与引擎回执不一致');return engine;
}
export function assertEngineCommit(candidate,context){
 const execution=candidate?.run?.engine||candidate?.engine;assertExecutionScope(execution,context);
 if(candidate?.previewed!==true)bad('候选尚未成功预览，不能写入');
 const v=candidate?.verification;if(!v||!['pass','warn'].includes(v.status)||!Array.isArray(v.checks)||!v.checks.length||v.checks.some(c=>!['pass','warn'].includes(c.status)))bad('候选尚未通过验证，不能写入');
 if((candidate.report||[]).some(r=>['missing','error','fail'].includes(r.status)))bad('能力执行不完整，不能写入');return execution;
}
export class PipeLineEngine{
 constructor(adapter){if(!adapter?.id||typeof adapter.catalog!=='function'||typeof adapter.scan!=='function'||typeof adapter.execute!=='function')bad('能力适配器无效');this.adapter=adapter;}
 catalog(){const rows=this.adapter.catalog();if(!Array.isArray(rows)||rows.length>2048)bad('能力库格式或数量无效');const ids=new Set();for(const c of rows){if(!c?.id||ids.has(c.id)||c.executable!==true||!c.implementation)bad('能力库存在重复、占位或缺实现的条目');ids.add(c.id);}return structuredClone(rows);}
 async compile(steps,{context={}}={}){
  if(!Array.isArray(steps)||steps.length>128)bad('管线须为最多128步');const catalog=this.catalog(),byId=new Map(catalog.map(c=>[c.id,c])),normalized=[],seen=new Set(),all=new Set(steps.filter(s=>s&&s.enabled!==false).map(s=>s.id));
  for(const raw of steps){if(!raw||typeof raw!=='object')bad('步骤格式无效');if(raw.enabled!==undefined&&typeof raw.enabled!=='boolean')bad('启用状态必须是布尔值');if(raw.enabled===false)continue;const cap=byId.get(raw.id);if(!cap)bad('未找到可执行能力 '+raw.id);for(const id of cap.requires||[])if(!seen.has(id))bad(cap.id+' 需要先执行 '+id);for(const id of cap.conflicts||[])if(all.has(id))bad(cap.id+' 与 '+id+' 冲突');const step={id:cap.id,params:normalizeParams(cap,raw.params)};if(raw.targets!==undefined){canonical(raw.targets);step.targets=structuredClone(raw.targets);}normalized.push(step);seen.add(cap.id);}
  if(!normalized.length)bad('管线没有可执行步骤');const catalogHash=await engineHash(catalog),planHash=await engineHash({adapter:this.adapter.id,catalogHash,context,steps:normalized});return{adapter:this.adapter.id,context:structuredClone(context),catalogHash,planHash,steps:normalized,implementations:normalized.map(s=>({id:s.id,module:byId.get(s.id).implementation}))};
 }
 async scan(input,{context={},onEvent=()=>{}}={}){const capabilities=this.catalog(),catalogHash=await engineHash(capabilities);const result=await this.adapter.scan(structuredClone(input),onEvent);return{...result,capabilities,engine:{name:ENGINE_NAME,version:ENGINE_VERSION,adapter:this.adapter.id,status:'scanned',context:structuredClone(context),catalogHash}};}
 async run(input,steps,{context={},onEvent=()=>{}}={}){
  const plan=await this.compile(steps,{context}),copy=structuredClone(input),inputHash=await engineHash(copy);onEvent({phase:'execute',plan});
  let result;try{result=await this.adapter.execute(copy,plan.steps,id=>onEvent({phase:'step',step:id}));}catch(error){bad('能力执行失败：'+error.message);}
  if(!result||!Array.isArray(result.report)||result.report.length!==plan.steps.length||result.report.some((r,i)=>r.id!==plan.steps[i].id||['missing','error','fail'].includes(r.status)))bad('适配器未完整执行所声明管线');
  const outputHash=await engineHash(result);return{...result,engine:{name:ENGINE_NAME,version:ENGINE_VERSION,status:'executed',adapter:plan.adapter,context:plan.context,catalogHash:plan.catalogHash,planHash:plan.planHash,inputHash,outputHash,steps:plan.steps,implementations:plan.implementations}};
 }
}
