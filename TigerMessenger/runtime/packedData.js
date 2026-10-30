// Keep startup downloads bounded, and report the actual failed resource.
let active=0;const queue=[];
async function slot(fn){if(active>=4)await new Promise(resolve=>queue.push(resolve));active++;try{return await fn();}finally{active--;queue.shift()?.();}}
export async function loadPackedData(file){
 const url=new URL(file,import.meta.url);
 return slot(async()=>{
  for(let attempt=0;attempt<3;attempt++)try{
   const response=await fetch(url);if(!response.ok)throw new Error(`HTTP ${response.status}`);
   if(typeof DecompressionStream==='undefined')throw new Error('This browser needs gzip DecompressionStream support');
   const stream=response.body.pipeThrough(new DecompressionStream('gzip'));
   return JSON.parse(await new Response(stream).text());
  }catch(error){if(attempt===2)throw new Error(`模型数据加载失败：${url.pathname} (${error.message})`,{cause:error});await new Promise(resolve=>setTimeout(resolve,400*(attempt+1)));}
 });
}
