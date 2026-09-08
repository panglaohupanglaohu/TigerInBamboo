import assert from 'node:assert/strict';
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();
 await page.route('**/configuration-contract.html',route=>route.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js","three/addons/":"/TigerMessenger/vendor/jsm/"}}</script>'}));
 await page.goto('http://127.0.0.1:8767/TigerMessenger/configuration-contract.html');
 const results=await page.evaluate(async()=>{
  const {rebuildCitadelTownIncremental}=await import('/TigerMessenger/src/world/odysseyCitadel.js');
  const castle={userData:{layers:[{children:[{name:'original-geometry-sentinel'}]}],wfcTownV1:true,wfcSeed:37,wfcTopology:'legacy-faces',townCtxCache:{sentinel:'preserve'},townSpec:{sentinel:'saved-source'}}};
  const before=JSON.stringify(castle),cases=[];
  for(const options of [{wfcSeed:38},{wfcTownV1:false},{wfcTopology:'legacy-grid'}]){
   const dirty=new Set(['0,0,0']);
   const result=rebuildCitadelTownIncremental(castle,null,dirty,options);
   cases.push({options,result,stateUnchanged:JSON.stringify(castle)===before,dirtyUnchanged:[...dirty].join()==='0,0,0'});
  }
  const noDirtyChange=rebuildCitadelTownIncremental(castle,null,[],{wfcSeed:99});
  const unchanged=rebuildCitadelTownIncremental(castle,null,[],{wfcSeed:37,wfcTownV1:true,wfcTopology:'legacy-faces'});
  return {cases,noDirtyChange,unchanged,stateUnchanged:JSON.stringify(castle)===before};
 });
 for(const c of results.cases){assert.equal(c.result.requiresFullRebuild,true);assert.equal(c.result.ok,false);assert.equal(c.stateUnchanged,true);assert.equal(c.dirtyUnchanged,true);}
 assert.equal(results.noDirtyChange.requiresFullRebuild,true);assert.equal(results.unchanged.ok,true);assert.equal(results.stateUnchanged,true);
 console.log('CITADEL_INCREMENTAL_CONFIGURATION_OK '+JSON.stringify(results));
}finally{await browser.close();}
