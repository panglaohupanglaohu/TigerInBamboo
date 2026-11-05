import {parseLearningDeclaration} from './learning-declaration.js';
const REQUIRED=['learn/architecture.js','learn/pipeline.js','learn/data.js','learn/coverage.json','learn/coverage-progress.json'];
const OPTIONAL=['learn/refactoring-status.js','learn/coverage-overrides.json'];
const allowed=new Set([...REQUIRED,...OPTIONAL]);
async function hash(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
// Prepare the entire new value first; this function never updates UI, globals or saved recipes.
export async function decodeLearningSnapshot(snapshot){
 if(snapshot?.schemaVersion!==1||snapshot.sourceRoot!=='REACodeRefactoring'||!Array.isArray(snapshot.files)||!Array.isArray(snapshot.missing)||!snapshot.sources)throw Error('学习快照格式无效');
 const paths=snapshot.files.map(f=>f.path);if(new Set(paths).size!==paths.length||paths.some(p=>!allowed.has(p))||Object.keys(snapshot.sources).some(p=>!paths.includes(p))||REQUIRED.some(p=>!paths.includes(p)))throw Error('学习快照文件清单无效');
 const missing=OPTIONAL.filter(p=>!paths.includes(p)).sort();if(JSON.stringify(missing)!==JSON.stringify(snapshot.missing))throw Error('学习快照缺失清单不一致');
 await Promise.all(snapshot.files.map(async file=>{const source=snapshot.sources[file.path];if(typeof source!=='string'||source.length>2*1024*1024||await hash(source)!==file.sha256)throw Error('学习快照内容校验失败：'+file.path);}));
 const files=[...snapshot.files].sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0).map(f=>({path:f.path,sha256:f.sha256}));
 if('sha256:'+await hash(JSON.stringify({files,missing}))!==snapshot.snapshotId)throw Error('学习快照版本校验失败');
 const s=snapshot.sources,arch=parseLearningDeclaration(s['learn/architecture.js'],'ARCH'),pipeline=parseLearningDeclaration(s['learn/pipeline.js'],'PIPELINE'),learn=parseLearningDeclaration(s['learn/data.js'],'LEARN'),coverage=JSON.parse(s['learn/coverage.json']),progress=JSON.parse(s['learn/coverage-progress.json']);
 if(!Array.isArray(arch.layers)||!Array.isArray(arch.flow)||arch.layers.some(l=>!Array.isArray(l.modules))||!Array.isArray(pipeline.lanes)||!Array.isArray(learn.items)||!Array.isArray(coverage.modules)||!coverage.counts||!Array.isArray(progress.completed)||!Array.isArray(progress.next))throw Error('学习快照数据结构无效');
 if(arch.flow.some(row=>!Array.isArray(row)||row.length<3)||arch.layers.some(layer=>!layer||layer.modules.some(row=>!Array.isArray(row)||row.length<2))||pipeline.lanes.some(lane=>!lane||!Array.isArray(lane.groups)||lane.groups.some(row=>!Array.isArray(row)||!Array.isArray(row[1])||row[1].some(item=>!item||typeof item!=='object')))||learn.items.some(item=>!item||typeof item!=='object')||progress.next.some(task=>!task||typeof task!=='object'||(task.clips&&!Array.isArray(task.clips)))||(progress.latest?.links&&!Array.isArray(progress.latest.links)))throw Error('学习快照显示结构无效');
 if(snapshot.sourceUpdatedAt!==progress.updatedAt)throw Error('学习快照更新时间不一致');
 return {snapshotId:snapshot.snapshotId,sourceUpdatedAt:snapshot.sourceUpdatedAt,arch,pipeline,learn,coverage,progress,status:s['learn/refactoring-status.js']?parseLearningDeclaration(s['learn/refactoring-status.js'],'REFACTOR_STATUS'):null,overrides:s['learn/coverage-overrides.json']?JSON.parse(s['learn/coverage-overrides.json']):null};
}
