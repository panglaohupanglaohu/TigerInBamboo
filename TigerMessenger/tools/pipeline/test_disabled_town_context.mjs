import assert from 'node:assert/strict';
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('**/disabled-context-contract.html',r=>r.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js","three/addons/":"/TigerMessenger/vendor/jsm/"}}</script>'}));
 await page.route('**/odysseyCitadel.js',async route=>{
  const response=await route.fetch();let source=await response.text();
  const marker='const failedWfc = assembly.wfcReports.filter(report => !report.ok);';
  if(!source.includes(marker))throw Error('Candidate capture marker changed');
  source=source.replace(marker,'globalThis.__testCandidate?.(assembly, candidateCache);\n  '+marker);
  // Expose only the former disabled assembly invocation as an independent test
  // oracle. This wrapper is network-only and is never written into production.
  source+=`\nexport function __testLegacyDisabledAssembly(castle, spec) {
   const blueprint=createCitadelBlueprint({spec,contour:castle.userData.contourSpec??CITADEL.contourTerrain,floors:castle.userData.floors,instanceId:castle.userData.instanceId,skipOuterTerrain:true,townBaseLift:castle.userData.townBaseLift??.6});
   return buildCitadelTerraceTownAssembly(blueprint.town.layout,blueprint.terrain.config,{floors:blueprint.floors,townCtxCache:null,wfcTownV1:false,wfcSeed:43,wfcTopology:'legacy-faces',baseYOverride:castle.userData.townBaseLift??.6,surfaceProvider:'uniform-town-base',leanDecor:true,skipDecor:false,gridV6:castle.userData.gridV6??null,townscaperColors:true,highlandColors:false});
  }`;
  await route.fulfill({response,body:source});
 });
 await page.goto('http://127.0.0.1:8767/TigerMessenger/disabled-context-contract.html');
 const report=await page.evaluate(async()=>{
  const M=await import('/TigerMessenger/src/world/odysseyCitadel.js');
  const blank=()=>Array.from({length:25},()=>'.'.repeat(25));
  const spec={version:2,gridSize:25,floors:3,terraces:Array.from({length:5},()=>({levels:[blank(),blank(),blank()]}))};
  for(let t=0;t<3;t++)for(let y=0;y<2;y++)for(let z=10;z<13;z++)spec.terraces[t].levels[y][z]='..........000............';
  const castle=M.buildOdysseyCitadel({spec,floors:3,skipOuterTerrain:true,instanceId:'canal-junction',skipDecor:false,wfcTownV1:false,wfcSeed:43,wfcTopology:'legacy-faces'});
  const signature=assembly=>{
   assembly.group.updateMatrixWorld(true);
   return assembly.terraceLevels.map(groups=>{
    let hash=2166136261,meshes=0,triangles=0;
    const mix=v=>{for(const ch of JSON.stringify(v)){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619)}};
    for(const group of groups)group.traverse(o=>{if(!o.isMesh)return;meshes++;const g=o.geometry;triangles+=(g.index?.count??g.attributes.position.count)/3;
     mix(o.name);mix(o.matrixWorld.elements);mix(g.index?Array.from(g.index.array):null);
     for(const key of Object.keys(g.attributes).sort()){mix(key);mix(Array.from(g.attributes[key].array));}
     for(const m of Array.isArray(o.material)?o.material:[o.material])mix({type:m.type,color:m.color?.getHex(),opacity:m.opacity,transparent:m.transparent,vertexColors:m.vertexColors});
    });
    return {hash:(hash>>>0).toString(16),meshes,triangles};
   });
  };
  const expected=signature(M.__testLegacyDisabledAssembly(castle,spec));
  let actual=null,cacheIsNull=false;
  globalThis.__testCandidate=(assembly,cache)=>{actual=signature(assembly);cacheIsNull=cache===null};
  const result=M.rebuildCitadelTown(castle,spec,{wfcTownV1:false,wfcSeed:43,wfcTopology:'legacy-faces'});
  return {expected,actual,cacheIsNull,committedCacheIsNull:castle.userData.townCtxCache===null,success:!!result&&!result.error};
 });
 assert.deepEqual(report.actual,report.expected);assert.equal(report.cacheIsNull,true);assert.equal(report.committedCacheIsNull,true);assert.equal(report.success,true);
 console.log('DISABLED_TOWN_CONTEXT_OK '+JSON.stringify(report));
}finally{await browser.close();}
