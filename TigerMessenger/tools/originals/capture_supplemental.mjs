import { chromium } from '../../../tools/shot/node_modules/playwright/index.mjs';
import { mkdir,writeFile,readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root=new URL('../../',import.meta.url), out=new URL('assets/models/originals/supplemental/',root);
const sha=b=>createHash('sha256').update(b).digest('hex');
const selected=process.argv.slice(2), base=process.env.TIGER_CAPTURE_BASE_URL||'http://127.0.0.1:8767/TigerMessenger/';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
let report=[];
try {report=JSON.parse(await readFile(new URL('capture-report.json',out),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
function semanticHash(data){
 const clean=v=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='uuid').map(([k,x])=>[k,clean(x)])):typeof v==='string'?v.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,'<uuid>'):v;
 return sha(JSON.stringify(clean(data)));
}
try {
 const page=await browser.newPage();
 await page.goto(new URL('tools/originals/capture_supplemental.html',base).href);
 await page.waitForFunction(()=>window.ready,{},{timeout:30000});
 const catalog=await page.evaluate(()=>window.supplementalCatalog);
 const unknown=selected.filter(id=>!catalog.some(r=>r.id===id));if(unknown.length)throw Error('Unknown ids '+unknown);
 for(const row of catalog) {
  row.sourceSha256=sha(await readFile(new URL(row.source,root)));
  if(row.runtimeSource)row.runtimeSourceSha256=sha(await readFile(new URL(row.runtimeSource,root)));
 }
 await writeFile(new URL('catalog.json',out),JSON.stringify({version:1,scope:'Supplemental standalone capture; historical 72 catalog unchanged',existingCatalogReferences:[{id:'bubblePod',status:'already in original 72; no duplicate capture'}],entries:catalog},null,2));
 for(const row of catalog.filter(r=>!selected.length||selected.includes(r.id))) {
  report=report.filter(r=>r.id!==row.id);
  try {
   // Fresh module caches per factory ensure seeded construction is reproducible.
   await page.reload();await page.waitForFunction(()=>window.ready);
   const {snapshot,probes}=await page.evaluate(id=>window.captureSupplemental(id),row.id);
   const nodeIds=new Set(snapshot.nodes.map(n=>n.id)), unresolved=[];
   function walk(o,path='') { if(!o||typeof o!=='object')return;if(o.nodeRef&&!nodeIds.has(o.nodeRef))unresolved.push(path+':'+o.nodeRef); for(const [k,v] of Object.entries(o))walk(v,path+'.'+k); }
   walk(snapshot.nodes);
   if(unresolved.length)throw Error('Unresolved dynamic node refs '+unresolved.join(','));
   if(probes.some(p=>!p.passed))throw Error('Dynamic factory probe failed '+JSON.stringify(probes));
   Object.assign(snapshot.provenance,{sourceSha256:row.sourceSha256,runtimeSourceSha256:row.runtimeSourceSha256});
   const file=new URL(row.id+'.source.json',out);let status='captured';
   try {await writeFile(file,JSON.stringify(snapshot),{flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;status='existing snapshot retained';}
   const bytes=await readFile(file),saved=JSON.parse(bytes);
   if(saved.provenance.sourceSha256!==row.sourceSha256 || saved.provenance.runtimeSourceSha256!==row.runtimeSourceSha256)throw Error('Source changed since immutable snapshot; create a new revision');
   const semanticSha256=semanticHash(saved);
   if(semanticSha256!==semanticHash(snapshot))throw Error('Reproducibility mismatch against immutable snapshot');
   report.push({id:row.id,status,semanticSha256,reproducedAgainstSaved:true,nodes:saved.nodes.length,geometries:Object.keys(saved.geometries).length,materials:Object.keys(saved.materials).length,textures:Object.keys(saved.textures).length,sha256:sha(bytes),unresolvedNodeRefs:unresolved,probes,stages:{captured:true,blenderImported:false,optimized:false,godotImported:false,gameplayVerified:false},warnings:saved.warnings});
   console.log('SUPPLEMENTAL_CAPTURE',row.id,status,saved.nodes.length);
  } catch(e) {report.push({id:row.id,status:'failed',error:e.message});console.error(row.id,e.message);}
  await writeFile(new URL('capture-report.json',out),JSON.stringify(report,null,2));
 }
} finally {await browser.close();}
if(report.some(r=>r.status==='failed'))process.exitCode=1;
