import {decodeLearningSnapshot} from './learning-snapshot.js';
export const CACHE_LIMIT=1536*1024;
// Separate bounded IndexedDB slot; never opens or evicts scene/version/localStorage data.
export function learningCacheStorage(indexedDB=globalThis.indexedDB){
 async function operation(mode,value){if(!indexedDB)throw Error('浏览器未提供学习缓存');return new Promise((resolve,reject)=>{let db,tx,done=false,phase='opening';const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);db?.close();error?reject(error):resolve(result);};const timer=setTimeout(()=>{try{tx?.abort();}catch{}finish(Error('学习缓存响应超时（'+mode+' / '+phase+'）'));},3000);let open;try{open=indexedDB.open('tm-learning-cache-v1',1);}catch(error){finish(error);return;}open.onupgradeneeded=()=>{if(done){open.transaction?.abort();return;}if(!open.result.objectStoreNames.contains('snapshots'))open.result.createObjectStore('snapshots');};open.onerror=()=>finish(Error('学习缓存打开失败'));open.onblocked=()=>finish(Error('学习缓存被占用'));open.onsuccess=()=>{db=open.result;phase='transaction';if(done){db.close();return;}try{tx=db.transaction('snapshots',mode);let result;const request=mode==='readonly'?tx.objectStore('snapshots').get('last'):tx.objectStore('snapshots').put(value,'last');request.onsuccess=()=>{result=request.result;phase='commit';};tx.oncomplete=()=>finish(null,result);tx.onabort=tx.onerror=()=>finish(Error('学习缓存空间或事务不可用'));}catch(error){finish(error);}};});}
 return {read:()=>operation('readonly'),write:value=>operation('readwrite',value)};
}
export function createLearningCache(storage=learningCacheStorage()){
 const size=value=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
 return {
  async read(){const row=await storage.read();if(!row)return null;if(!row.snapshot||size(row)>CACHE_LIMIT)throw Error('学习缓存大小或格式无效');return {snapshot:row.snapshot,data:await decodeLearningSnapshot(row.snapshot),cachedAt:row.cachedAt};},
  async write(snapshot){const row={snapshot,cachedAt:new Date().toISOString()};if(size(row)>CACHE_LIMIT)throw Error('学习资料超过缓存上限');await decodeLearningSnapshot(snapshot);await storage.write(row);return row.cachedAt;}
 };
}
