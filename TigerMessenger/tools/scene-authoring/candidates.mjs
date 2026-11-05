import {createHash,randomUUID} from 'node:crypto';
import {mkdir,writeFile,link,unlink,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {executeSupportedPreview} from '../../src/scene-authoring/pipeline-execution.js';
const canonical=value=>value&&typeof value==='object'?(Array.isArray(value)?value.map(canonical):Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]))):value;
export const snapshotHash=snapshot=>createHash('sha256').update(JSON.stringify(canonical({scene:snapshot.scene,data:snapshot.data,settings:snapshot.settings,recipe:snapshot.recipe,locks:snapshot.locks||{}}))).digest('hex');
export function makeCandidate(snapshot){return {version:1,id:randomUUID(),createdAt:new Date().toISOString(),baseHash:snapshotHash(snapshot),origin:'local-deterministic-runner',proposal:executeSupportedPreview(snapshot)};}
export function inspectCandidate(candidate,current){
 if(candidate?.version!==1||!candidate.proposal)throw Error('候选格式无效');
 if(candidate.baseHash!==snapshotHash(current))return {applicable:false,reason:'工作区或锁定内容已改变；保留你的当前版本，请重新生成候选'};
 if(candidate.proposal.scene!==current.scene||candidate.proposal.data!==current.data)return {applicable:false,reason:'此执行器不允许改写建筑或地形'};
 for(const key of current.locks?.settings||[])if(candidate.proposal.settings[key]!==current.settings[key])return {applicable:false,reason:'候选试图改写锁定参数'};
 // Recompute allowed output; reject hand-edited or incompatible proposals as well.
 const expected=executeSupportedPreview(current);
 if(JSON.stringify(canonical(candidate.proposal))!==JSON.stringify(canonical(expected)))return {applicable:false,reason:'候选与受检执行结果不一致'};
 return {applicable:true,reason:'候选可供显式预览；仍需人工编辑、验证与定稿'};
}
export async function persistCandidate(directory,candidate){
 if(!/^[0-9a-f-]{36}$/.test(candidate.id))throw Error('候选ID无效');
 await mkdir(directory,{recursive:true});const path=join(directory,candidate.id+'.json'),temp=path+'.tmp-'+randomUUID();await writeFile(temp,JSON.stringify(candidate,null,2),{flag:'wx',mode:0o600});try{await link(temp,path);}finally{await unlink(temp);}return path;
}
export async function loadCandidate(path){return JSON.parse(await readFile(path,'utf8'));}
