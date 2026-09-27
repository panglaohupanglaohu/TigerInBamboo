import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();const logs=[];p.on('console',m=>{const t=m.text();if(/support|Old city|oldCity|buildOldCitySupport|re-export/i.test(t))logs.push(m.type()+': '+t.slice(0,300));});
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(2500);
const r=await p.evaluate(async()=>{const t=window.__tm;const spur=t.scene.getObjectByName('citadel-old-city-support-spur');const parent=t.scene.getObjectByName('citadel-old-shore-approach');
let err=null;try{const m=await import('/TigerMessenger/src/world/citadel/oldCitySupport.js');let castle;t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
 const data=(await import('/TigerMessenger/assets/models/optimized/citadel-old-city-support/oldCitySupportR02.js')).default;castle.updateWorldMatrix(true,true);
 const f=castle.getObjectByName('highland-town-foundation-platform');const T=t.THREE;const local=castle.matrixWorld.clone().invert().multiply(f.matrixWorld);const expected=new T.Matrix4().fromArray(data.castleMatrix).invert().multiply(new T.Matrix4().fromArray(data.foundationMatrix));
 err={castleDiff:Math.max(...castle.matrixWorld.elements.map((v,i)=>Math.abs(v-data.castleMatrix[i]))),localDiff:Math.max(...local.elements.map((v,i)=>Math.abs(v-expected.elements[i]))),routeLen:[castle.userData.oldShoreApproach?.route?.length,data.route.length],routeDiff:Math.max(...(castle.userData.oldShoreApproach?.route||[]).map((p,i)=>Math.max(...p.map((v,j)=>Math.abs(v-(data.route[i]?.[j]??1e9))))))};}catch(e){err=String(e);}
return {spur:!!spur,parent:!!parent,check:err};});
console.log(JSON.stringify(r));console.log(logs.slice(0,5).join('\n'));}finally{await b.close();}
