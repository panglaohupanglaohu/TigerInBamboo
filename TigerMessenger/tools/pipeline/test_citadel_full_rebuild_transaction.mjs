import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 await page.route('**/full-rebuild-contract.html',r=>r.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js","three/addons/":"/TigerMessenger/vendor/jsm/"}}</script>'}));
 // Test-only network substitution: ban all variants on the second terrace's color.
 // No production file, default setting, or saved layout is changed.
 await page.route('**/wfcTownSelection.js',async route=>{
  const response=await route.fetch();const source=await response.text();
  const needle='export const defaultBanPolicy = townBanPolicy;';
  if(!source.includes(needle))throw Error('Failure-injection contract changed');
  await route.fulfill({response,body:source.replace(needle,'export const defaultBanPolicy = args => globalThis.__testAllTownVariantsBanned && args.char === "1" ? false : townBanPolicy(args);')});
 });
 await page.goto('http://127.0.0.1:8767/TigerMessenger/full-rebuild-contract.html');
 const report=await page.evaluate(async()=>{
  const M=await import('/TigerMessenger/src/world/odysseyCitadel.js');
  const blank=()=>Array.from({length:25},()=>'.'.repeat(25));
  const levels=[blank(),blank(),blank()];levels[0][12]='............00...........';levels[1][12]='............00...........';
  const spec={version:2,gridSize:25,floors:3,terraces:Array.from({length:5},(_,i)=>({levels:i===0?levels:[blank(),blank(),blank()]}))};
  spec.terraces[1].levels[0][12]='............1............';spec.terraces[1].levels[1][12]='............1............';
  const castle=M.buildOdysseyCitadel({spec,floors:3,skipOuterTerrain:true,instanceId:'canal-junction',skipDecor:true,wfcTownV1:true,wfcSeed:37,wfcTopology:'legacy-faces'});
  if(!castle.userData.townCtxCache.terraces[0].wfcTownSelection.value.ok)throw Error('Initial fixture must solve');
  const old={cache:castle.userData.townCtxCache,spec:castle.userData.townSpec,blueprint:castle.userData.blueprint,stats:castle.userData.townStats,children:castle.userData.layers.map(l=>l.children.slice())};
  castle.userData.pendingMerge={sentinel:'pending'};castle.userData.pendingDecorMerge={sentinel:'decor'};castle.userData.mergeDebounceLeft=9;
  const pending=castle.userData.pendingMerge,decor=castle.userData.pendingDecorMerge;
  let oldResourceDisposals=0;
  const resources=new Set();castle.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)resources.add(m);});
  for(const resource of resources)resource.addEventListener('dispose',()=>oldResourceDisposals++);
  const next=structuredClone(spec);next.terraces[0].levels[2][12]='............0............';
  globalThis.__testAllTownVariantsBanned=true;
  const failed=M.rebuildCitadelTown(castle,next,{wfcSeed:41,wfcTopology:'legacy-grid'});
  const preserved={geometry:old.children.every((children,i)=>children.length===castle.userData.layers[i].children.length&&children.every((o,j)=>o===castle.userData.layers[i].children[j])),cache:old.cache===castle.userData.townCtxCache,spec:old.spec===castle.userData.townSpec,blueprint:old.blueprint===castle.userData.blueprint,stats:old.stats===castle.userData.townStats,pending:pending===castle.userData.pendingMerge&&decor===castle.userData.pendingDecorMerge&&castle.userData.mergeDebounceLeft===9,configuration:castle.userData.wfcSeed===37&&castle.userData.wfcTopology==='legacy-faces',oldResourceDisposals};
  globalThis.__testAllTownVariantsBanned=false;
  const success=M.rebuildCitadelTown(castle,next,{wfcSeed:41,wfcTopology:'legacy-grid'});
  const committed={solved:castle.userData.townCtxCache.terraces[0].wfcTownSelection.value.ok,newCache:old.cache!==castle.userData.townCtxCache,newSpec:old.spec!==castle.userData.townSpec,newGeometry:old.children.some((children,i)=>children.some(o=>!castle.userData.layers[i].children.includes(o))),seed:castle.userData.wfcSeed,topology:castle.userData.wfcTopology,pendingCleared:castle.userData.pendingMerge===null&&castle.userData.pendingDecorMerge===null};
  const legacyReturn=M.rebuildCitadelTown(castle,next);
  const disabled=M.rebuildCitadelTown(castle,next,{wfcTownV1:false,wfcTopology:'legacy-faces',wfcSeed:43});
  return {failed,preserved,committed,successStats:success,legacyTwoArgStats:!!legacyReturn&&typeof legacyReturn==='object'&&!legacyReturn.error,disabled:{success:!!disabled&&!disabled.error,flag:castle.userData.wfcTownV1,seed:castle.userData.wfcSeed,topology:castle.userData.wfcTopology,cache:castle.userData.townCtxCache}};
 });
 assert.equal(report.failed.ok,false);assert.equal(report.failed.error,'wfc-unsatisfied');
 assert.equal(report.failed.failedWfc[0].terraceIndex,1);
 for(const [key,value] of Object.entries(report.preserved))assert.equal(value,key==='oldResourceDisposals'?0:true,key);
 for(const key of ['solved','newCache','newSpec','newGeometry','pendingCleared'])assert.equal(report.committed[key],true,key);
 assert.equal(report.committed.seed,41);assert.equal(report.committed.topology,'legacy-grid');assert.equal(report.legacyTwoArgStats,true);
 assert.deepEqual(report.disabled,{success:true,flag:false,seed:43,topology:'legacy-faces',cache:null});
 const out=new URL('../../artifacts/pipeline/townscaper-contract/',import.meta.url);await mkdir(out,{recursive:true});
 await writeFile(new URL('full-rebuild-transaction.json',out),JSON.stringify(report,null,2)+'\n');
 console.log('CITADEL_FULL_REBUILD_TRANSACTION_OK '+JSON.stringify(report));
}finally{await browser.close();}
