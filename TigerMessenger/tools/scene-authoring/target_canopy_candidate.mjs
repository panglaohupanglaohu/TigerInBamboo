// Node-side, detached execution boundary. No scene, storage, renderer or adoption API.
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

export const CANOPY_CAPABILITY={id:'rea.canopy.surface-nets',module:'src/core/canopy.js',exportName:'buildCanopy',input:'canopy.blobs.v1'};
const sourceUrl=new URL('../../../townscaper-web/REACodeRefactoring/src/core/canopy.js',import.meta.url);
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>'sha256:'+createHash('sha256').update(typeof v==='string'?v:JSON.stringify(canonical(v))).digest('hex');
const revision=value=>typeof value==='string'&&/^sha256:[a-f0-9]{64}$/.test(value);
function onlyKeys(value,keys,label){if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.keys(value).some(k=>!keys.includes(k)))throw Error(label+'格式或字段无效');}
function target(value){
 onlyKeys(value,['scene','id','revision','part'],'目标');
 if(value.scene!=='morris-lake'||typeof value.id!=='string'||!value.id.length||value.id.length>128||value.id.startsWith('runtime-mesh:')||!revision(value.revision)||value.part!=='canopy')throw Error('需要稳定对象ID、树冠部位和目标revision');
 return structuredClone(value);
}
function inputs(value){
 onlyKeys(value,['format','blobs'],'算法输入');
 if(value.format!==CANOPY_CAPABILITY.input)throw Error('该算法需要显式球团输入适配；不能直接作用于现有叶片卡片');
 if(!Array.isArray(value.blobs)||!value.blobs.length||value.blobs.length>32)throw Error('球团数量无效');
 for(const b of value.blobs){onlyKeys(b,['x','y','z','r'],'球团');if(![b.x,b.y,b.z,b.r].every(Number.isFinite)||Math.max(Math.abs(b.x),Math.abs(b.y),Math.abs(b.z),b.r)>1000||b.r<=0)throw Error('球团坐标或半径无效');}
 return structuredClone(value);
}
function parameters(value={}){
 onlyKeys(value,['resolution','passes','hardStiff','softStiff'],'参数');
 const p={resolution:14,passes:6,hardStiff:.15,softStiff:.3,...value};
 if(!Number.isInteger(p.resolution)||p.resolution<6||p.resolution>24||!Number.isInteger(p.passes)||p.passes<0||p.passes>12||![p.hardStiff,p.softStiff].every(v=>Number.isFinite(v)&&v>=0&&v<=.5))throw Error('参数超出隔离候选预算');
 return p;
}
async function source(){
 // Fixed allowlisted source only. Import the exact bytes whose revision we report,
 // avoiding a mutable-file/import-cache mismatch while upstream learning continues.
 const text=await readFile(sourceUrl,'utf8'),module=await import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
 if(typeof module.buildCanopy!=='function')throw Error('树冠能力导出缺失');
 return {revision:hash(text),build:module.buildCanopy};
}
function pack(targetRef,input,params,sourceRevision){
 const binding={version:1,capabilityRef:{id:CANOPY_CAPABILITY.id,module:CANOPY_CAPABILITY.module,exportName:CANOPY_CAPABILITY.exportName,revision:sourceRevision},targetRef:target(targetRef),inputs:inputs(input),params:parameters(params),writeSet:{objectId:targetRef.id,part:'canopy'}};
 return {...binding,nodeFingerprint:hash(binding)};
}
export async function createTargetCanopyNode({targetRef,inputs:input,params}){
 // Check target/input compatibility before importing or running the algorithm.
 const checkedTarget=target(targetRef),checkedInput=inputs(input),checkedParams=parameters(params);
 return pack(checkedTarget,checkedInput,checkedParams,(await source()).revision);
}
function verifyOutput(geometry){
 const {positions,triangles,normals}=geometry;
 if(!Array.isArray(positions)||!positions.length||!Array.isArray(triangles)||!triangles.length||!Array.isArray(normals)||normals.length!==positions.length)throw Error('树冠输出结构无效');
 for(const p of [...positions,...normals])if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('树冠输出包含无效坐标');
 const edges=new Map();
 for(const t of triangles){if(!Array.isArray(t)||t.length!==3||t.some(i=>!Number.isInteger(i)||i<0||i>=positions.length)||new Set(t).size!==3)throw Error('树冠输出索引无效');for(let k=0;k<3;k++){const a=t[k],b=t[(k+1)%3],key=a<b?a+':'+b:b+':'+a;edges.set(key,(edges.get(key)||0)+1);}}
 if([...edges.values()].some(count=>count!==2))throw Error('树冠输出未通过闭合边检查');
 return {finite:true,indexed:true,closedEdges:true,vertices:positions.length,triangles:triangles.length};
}
export async function runTargetCanopyCandidate(node,{liveTargetRef}={}){
 onlyKeys(node,['version','capabilityRef','targetRef','inputs','params','writeSet','nodeFingerprint'],'节点');
 if(node.version!==1||!revision(node.capabilityRef?.revision))throw Error('能力版本无效');
 const checked=pack(node.targetRef,node.inputs,node.params,node.capabilityRef.revision);
 if(JSON.stringify(canonical(checked))!==JSON.stringify(canonical(node)))throw Error('节点绑定或参数已改变，请重新建立候选');
 if(hash(target(liveTargetRef))!==hash(checked.targetRef))throw Error('目标或revision已变化，拒绝重定向/覆盖');
 const actual=await source();if(actual.revision!==checked.capabilityRef.revision)throw Error('能力源码revision已变化，请重新审核');
 const geometry=actual.build(structuredClone(checked.inputs.blobs),checked.params),checks=verifyOutput(geometry);
 return {version:1,status:'detached-candidate',targetRef:checked.targetRef,capabilityRef:checked.capabilityRef,nodeFingerprint:checked.nodeFingerprint,writeSet:checked.writeSet,geometry,geometryFingerprint:hash(geometry),checks,canApplyToScene:false,scope:'Detached algorithm result only. Target adaptation, review/adoption, scene history and version persistence are not connected.'};
}
