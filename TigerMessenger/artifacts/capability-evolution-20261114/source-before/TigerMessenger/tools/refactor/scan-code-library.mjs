/** Physical source inventory. Parses modules with esbuild; never executes library code. */
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {build} from '../../node_modules/esbuild/lib/main.js';
const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const digest=raw=>createHash('sha256').update(raw).digest('hex');
const excluded=new Set(['node_modules','.git','artifacts','.workbuddy']);
function filesUnder(root){return fs.readdirSync(root,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>excluded.has(e.name)?[]:e.isDirectory()?filesUnder(path.join(root,e.name)):[path.join(root,e.name)]);}
export async function scanCodeLibrary({root=workspace}={}){
 const lib=path.join(root,'townscaper-web/REACodeRefactoring'),original=path.join(root,'townscaper-web/REACode');
 const files=filesUnder(lib),modulePaths=files.filter(p=>p.startsWith(lib+'/src/')&&/\.(?:m?js)$/.test(p));
 const before=new Map(modulePaths.map(p=>[p,fs.readFileSync(p)]));
 const meta=await build({absWorkingDir:lib,entryPoints:modulePaths.map(p=>path.relative(lib,p)),outbase:'.',outdir:'__inventory_only__',bundle:false,write:false,metafile:true,logLevel:'silent'});
 const parsed=new Map();for(const output of Object.values(meta.metafile.outputs)){const input=Object.keys(output.inputs)[0];if(input)parsed.set(input,output);}
 const known=new Set(modulePaths.map(p=>path.relative(lib,p)));
 const modules=modulePaths.map(p=>{
  const relative=path.relative(lib,p),raw=before.get(p),text=raw.toString('utf8'),out=parsed.get(relative);
  if(!out)throw Error('未解析模块 '+relative);
  const dependencies=[],external=[];
  for(const imp of out.imports){const spec=imp.path.split(/[?#]/)[0];if(spec.startsWith('.')){const rel=path.posix.normalize(path.posix.join(path.posix.dirname(relative),spec));dependencies.push({path:rel,exists:known.has(rel),kind:imp.kind});}else external.push({path:spec,kind:imp.kind});}
  const copy=path.join(root,'TigerMessenger/src/vendor/townscaper-rea-refactoring',relative);
  return {id:'module:'+relative,path:relative,sha256:digest(raw),bytes:raw.length,exports:out.exports,dependencies,external,directory:relative.split('/')[1],context:/\b(?:window|document)\s*\./.test(text)?'main-thread':external.some(i=>i.path==='three')?'three-context':'data-candidate',gameCopy:!fs.existsSync(copy)?'absent':digest(fs.readFileSync(copy))===digest(raw)?'identical':'different'};
 });
 // Reject a scan if the producer changed bytes or file membership while it was read.
 const after=filesUnder(lib).filter(p=>p.startsWith(lib+'/src/')&&/\.(?:m?js)$/.test(p));
 if(after.length!==modulePaths.length||after.some((p,i)=>p!==modulePaths[i]||!before.get(p)?.equals(fs.readFileSync(p))))throw Error('SOURCE_CHANGING: 请重试扫描');
 const oldStatusPath=path.join(root,'TigerMessenger/src/scene-authoring/catalog/reacode-file-status.json');
 const oldStatus=fs.existsSync(oldStatusPath)?JSON.parse(fs.readFileSync(oldStatusPath,'utf8')):{rows:[]};
 const oldByPath=new Map(oldStatus.rows.map(r=>[r.source,r]));
 const coveragePath=path.join(lib,'learn/coverage.json'),coverage=fs.existsSync(coveragePath)?JSON.parse(fs.readFileSync(coveragePath,'utf8')):{modules:[]},coverageByPath=new Map(coverage.modules.map(r=>[r.source,r]));
 const aliasPath=path.join(root,'TigerMessenger/tools/refactor/reacode-target-aliases.json'),aliases=fs.existsSync(aliasPath)?JSON.parse(fs.readFileSync(aliasPath,'utf8')):{};
 const originalFiles=filesUnder(original).filter(p=>/\.(?:js|mjs|html)$/.test(p));
 const originalModules=originalFiles.filter(p=>/\.(?:m?js)$/.test(p)),originalExports=new Map();
 if(originalModules.length){const parsedOriginal=await build({absWorkingDir:original,entryPoints:originalModules.map(p=>path.relative(original,p)),outbase:'.',outdir:'__inventory_only__',bundle:false,write:false,metafile:true,logLevel:'silent'});for(const output of Object.values(parsedOriginal.metafile.outputs)){const input=Object.keys(output.inputs)[0];if(input)originalExports.set(input,output.exports);}}
 const byModule=new Map(modules.map(m=>[m.path,m]));
 function exportsOf(targets){const seen=new Set(),names=new Set();function visit(p){if(seen.has(p))return;seen.add(p);const mod=byModule.get(p);if(!mod)return;for(const name of mod.exports)names.add(name);for(const d of mod.dependencies)visit(d.path);}targets.forEach(t=>visit(t.path));return [...names].sort();}

 const alignment=originalFiles.map(p=>{const source=path.relative(original,p),raw=fs.readFileSync(p),old=oldByPath.get(source),targets=new Set([...(coverageByPath.get(source)?.targets||[]),...(old?.targets||[]).map(t=>t.path),...(aliases[source]?.targets||[])]);
  if(fs.existsSync(path.join(lib,source)))targets.add(source);
  if(source.startsWith('src/'))for(const mod of modules)if(path.basename(mod.path)===path.basename(source))targets.add(mod.path);
  const targetFiles=[...targets].sort().map(relative=>{const target=path.resolve(lib,relative);if(!target.startsWith(lib+'/'))throw Error('invalid target');return{path:relative,exists:fs.existsSync(target),sha256:fs.existsSync(target)?digest(fs.readFileSync(target)):null};});
  const sourceExports=originalExports.get(source)||[],targetExports=exportsOf(targetFiles),unmatchedExports=sourceExports.filter(name=>!targetExports.includes(name));
  const sameEvidence=old?.sha256===digest(raw)&&targetFiles.every(t=>{const prior=old?.targets?.find(x=>x.path===t.path);return prior?.sha256===t.sha256;});
  return {source,sha256:digest(raw),originalExports:sourceExports,targetExports,unmatchedExports,apiNote:unmatchedExports.length?'原导出未找到同名候选，需核对改名/替代消费者，不能直接判定功能缺失。':null,kind:old?.kind||'未分类',clips:coverageByPath.get(source)?.clips||old?.clips||[],mappingReason:aliases[source]?.reason||null,coverageStatus:coverageByPath.get(source)?.status||null,targets:targetFiles,status:!targetFiles.some(t=>t.exists)?'missing-target':old?.verifiedDelivery&&sameEvidence?'scoped-verified':'requires-parity-review',previousState:old?.state||null,evidenceCurrent:!!sameEvidence,gap:!targetFiles.some(t=>t.exists)?'未找到物理迁移落点；需阅读原代码和来源视频后迁移。':coverageByPath.get(source)?.gap||old?.gap||'候选文件存在，尚未证明行为等价。'};
 });
 const identity={modules:modules.map(m=>[m.path,m.sha256]),alignment:alignment.map(r=>[r.source,r.sha256,r.targets,r.status,r.gap])};
 return {schemaVersion:2,generatedAt:new Date().toISOString(),snapshotId:'sha256:'+digest(JSON.stringify(identity)),sourceRoot:'townscaper-web/REACodeRefactoring',counts:{sourceModules:modules.length,sourceFiles:files.filter(p=>p.startsWith(lib+'/src/')).length,rootHtml:files.filter(p=>path.dirname(p)===lib&&p.endsWith('.html')).length,testCode:files.filter(p=>p.startsWith(lib+'/tests/')&&/\.(?:js|mjs|cjs)$/.test(p)).length,originalFiles:alignment.length,missingTargets:alignment.filter(r=>r.status==='missing-target').length},modules,alignment,limits:['Exports/imports are parsed syntax, not behavioral verification.','Context is a static clue; data candidates require an explicit Worker adapter.','Alignment uses physical targets and previous scoped evidence, never filename-only completion.','Snapshot detects observed byte changes, not producer-wide transactional consistency.']};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const manifest=await scanCodeLibrary();
 if(process.argv.includes('--stdout'))process.stdout.write(JSON.stringify(manifest));
 else {const out=path.join(workspace,'TigerMessenger/src/scene-authoring/catalog/refactored-code-library.json');fs.writeFileSync(out,JSON.stringify(manifest));console.log(JSON.stringify(manifest.counts));}
}
