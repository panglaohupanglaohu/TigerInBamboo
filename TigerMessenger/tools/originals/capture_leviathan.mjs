import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url),out=new URL('assets/models/originals/leviathan/',root);
const sha=b=>createHash('sha256').update(b).digest('hex');
await mkdir(out,{recursive:true});
const source='src/assets/leviathanIsland.js',runtime='src/scenes/saihojiGarden.js';
const provenance={id:'leviathanIsland',label:'苔庭·太古浮岛白鲸',source,factory:'buildEcoLeviathanIsland',options:{seed:9901},seed:9901,runtimeSource:runtime,sourceSha256:sha(await readFile(new URL(source,root))),runtimeSourceSha256:sha(await readFile(new URL(runtime,root))),captureScope:'Original factory defaults in local coordinates. Includes whale, factory island plate, flora and dynamic nodes; excludes six garden scenes attached by saihojiGarden.js. Not swamp_whale, not optimized.'};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('**/leviathan-capture.html',r=>r.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js","three/addons/":"/TigerMessenger/vendor/jsm/"}}</script>'}));
 await page.goto('http://127.0.0.1:8767/TigerMessenger/leviathan-capture.html');
 const snapshot=await page.evaluate(async provenance=>{
  const {captureObject}=await import('/TigerMessenger/tools/originals/capture.js');
  const {buildEcoLeviathanIsland}=await import('/TigerMessenger/src/assets/leviathanIsland.js');
  const asset=buildEcoLeviathanIsland({seed:9901});
  const snapshot=captureObject(asset.group,provenance);
  snapshot.runtimeExports=Object.fromEntries(Object.entries(asset).filter(([,v])=>typeof v==='function').map(([k,v])=>[k,{runtimeFunction:v.toString()}]));
  return snapshot;
 },provenance);
 const ids=new Set(snapshot.nodes.map(n=>n.id)),unresolved=[];
 const walk=v=>{if(!v||typeof v!=='object')return;if(v.nodeRef&&!ids.has(v.nodeRef))unresolved.push(v.nodeRef);for(const child of Object.values(v))walk(child)};walk(snapshot.nodes);
 if(unresolved.length)throw Error('Unresolved node refs '+JSON.stringify(unresolved));
 const bytes=JSON.stringify(snapshot);await writeFile(new URL('leviathanIsland.source.json',out),bytes,{flag:'wx'});
 await writeFile(new URL('catalog-entry.json',out),JSON.stringify({...provenance,family:'leviathanIsland',variant:'factory-default-local',nodes:snapshot.nodes.length,snapshotSha256:sha(bytes),unresolvedNodeRefs:unresolved,stages:{captured:true,blenderArchived:false,optimized:false,godotImported:false,worldBehaviorVerified:false}},null,2));
 console.log(JSON.stringify({nodes:snapshot.nodes.length,bytes:bytes.length,sha256:sha(bytes)}));
}finally{await browser.close();}
