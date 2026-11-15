const sha=async text=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');
/** Verify live local files, not just a prebuilt "passed" flag. Fail closed on any change. */
export async function loadBacklogDeliveries(learn){
 try{
  const r=await fetch(new URL('./catalog/learning-backlog-deliveries.json',import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('交付清单未就绪');const data=await r.json(),proof=Object.entries(data.proofHashes||{});
  if(data.version!==1||!Array.isArray(data.items)||proof.length<1||proof.length>60)throw Error('交付证据格式错误');
  await Promise.all(proof.map(async([path,hash])=>{if(!/^(townscaper-web\/REACodeRefactoring\/|TigerMessenger\/artifacts\/workshop-tests\/)/.test(path)||path.includes('..'))throw Error('证据路径无效');const r=await fetch(new URL('../../../'+path,import.meta.url),{cache:'no-store',signal:AbortSignal.timeout(8000)});if(!r.ok||await sha(await r.text())!==hash)throw Error('证据或代码已变化：'+path);}));
  const same=study=>{const x=learn?.items.find(x=>x.id===study.id);return x&&JSON.stringify(Object.fromEntries(['id','decodedFrames','reviewEvidence','reviewStages'].map(k=>[k,x[k]??null])))===JSON.stringify(study)&&x.reviewStages?.allFramesReviewed===true;};
  return{items:data.items.filter(row=>row.studies?.length&&row.studies.every(same)),verified:true};
 }catch(error){return{items:[],verified:false,error:error.message};}
}
