import {ENGINE_NAME,ENGINE_VERSION} from './PipeLineEngine.js';
import {createWorkerEngine} from './worker-adapters.js?v=nav-r1';
/** Existing Worker transport/heartbeats stay compatible with WorkerSlot and Watchdog. */
export function installPipeLineWorker(kind){
 const engine=createWorkerEngine(kind);engine.catch(()=>{});let busy=false;
 const inputOf=m=>kind==='voxel'?{data:m.data,allowed:m.allowed,focusCells:m.focusCells}:kind==='materials'?m.materials:kind==='object'?m.layout:kind==='battle'||kind==='mountain'||kind==='fx'||kind==='apostles-terrain'?m.site:m.recipe;
 globalThis.onmessage=async({data:m})=>{const job=m?.job;let owned=false;try{
  if(busy)throw Error('PipeLineEngine：Worker正在执行另一个任务');if(!['scan','match','run','catalog'].includes(m?.type))throw Error('PipeLineEngine：未知任务类型');busy=true;owned=true;
  const e=await engine,context=m.context||{tier:kind,sceneId:kind==='planet'?'planet':null},event=x=>postMessage({job,heartbeat:true,stage:x.step?'执行能力 '+x.step:'PipeLineEngine · '+(x.phase||'scan'),...(x.step?{step:x.step}:{})});
  event({phase:'prepare'});let result;
  if(m.type==='catalog')result={capabilities:e.catalog(),engine:{name:ENGINE_NAME,version:ENGINE_VERSION,adapter:kind}};
  else if(m.type==='run')result=await e.run(inputOf(m),m.steps,{context,onEvent:event});
  else result=await e.scan(inputOf(m),{context,onEvent:event});
  const raster=result.summary?.raster?.px;postMessage({job,ok:true,result},raster?[raster.buffer]:[]);
 }catch(error){postMessage({job,ok:false,error:error?.message||String(error)});}finally{if(owned)busy=false;}};
 return engine;
}
