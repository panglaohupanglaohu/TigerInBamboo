import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 await page.route('**/pipeline-test.html',r=>r.fulfill({contentType:'text/html',body:`<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js","three/addons/":"/TigerMessenger/vendor/jsm/"}}</script>`}));
 await page.goto('http://127.0.0.1:8767/TigerMessenger/pipeline-test.html');
 const result=await page.evaluate(async()=>{
  const {HIGHLAND_TOWNSCAPER_TOWN_SPEC:spec,normalizeCitadelTerraceLayout,migrateLegacyTownChars}=await import('/TigerMessenger/src/world/citadelTown.js');
  const {solveTownSelection}=await import('/TigerMessenger/src/world/citadel/wfcTownSelection.js');
  const {createFaceLayerGraph,createLegacyFaceLayout}=await import('/TigerMessenger/src/world/citadel/faceLayerGraph.js');
  const layout=normalizeCitadelTerraceLayout(spec,spec.floors),rows=[];
  for(let terrace=0;terrace<layout.terraces.length;terrace++){
   const grid=new Map();layout.terraces[terrace].levels.forEach((r,y)=>r.forEach((row,z)=>[...migrateLegacyTownChars(row)].forEach((ch,x)=>{if(ch!=='.')grid.set(`${x},${y},${z}`,ch)})));
   if(!grid.size)continue;
   for(const seed of [1,37,20260808]){
    const t=performance.now(),r=solveTownSelection({grid,seed});
    const graph=createFaceLayerGraph(createLegacyFaceLayout(grid)),ft=performance.now(),face=solveTownSelection({grid,graph,seed});
    if(!face.ok || face.hash!==r.hash)throw Error('Shared-edge assignment changed original source layout');
    rows.push({faceGraph:{ok:face.ok,hash:face.hash,topologyHash:graph.topologyHash,ms:performance.now()-ft},terrace,seed,cells:grid.size,ok:r.ok,hash:r.hash,ms:performance.now()-t,unresolved:r.unresolved,stats:r.stats});
   }
  }
  return {source:'HIGHLAND_TOWNSCAPER_TOWN_SPEC default source layout, not browser saved edits',rows,passed:rows.every(r=>r.ok),scope:'pure production selection at real source layout scale; not geometry or gameplay acceptance'};
 });
 await mkdir('TigerMessenger/artifacts/pipeline/townscaper-contract',{recursive:true});
 await writeFile('TigerMessenger/artifacts/pipeline/townscaper-contract/castle-scale.json',JSON.stringify(result,null,2));
 console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
}finally{await browser.close();}
