import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});
const r=await p.evaluate(async()=>{const t=window.__tm,T=t.THREE;const city=t.scene.getObjectByName('highland-west-city');let castle;t.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});t.scene.updateMatrixWorld(true);
const {citadelCoastalFrame}=await import('/TigerMessenger/src/world/citadel/coastalTramRoute.js');const F=citadelCoastalFrame();
const cityInv=city.matrixWorld.clone().invert();const rel=new T.Matrix4().multiplyMatrices(cityInv,F);
const deck=city.getObjectByName('west-city-bridge-deck');const bl0=city.getObjectByName('west-city-bridge-landing-0'),bl1=city.getObjectByName('west-city-bridge-landing-1');
const toCity=v=>new T.Vector3(...v).applyMatrix4(rel).toArray().map(x=>Math.round(x*100)/100);
return {parent:city.parent?.name,castleIsFrame:castle.matrixWorld.equals(F),rel:rel.toArray().map(x=>Math.round(x*1e5)/1e5),landing0:bl0?.position.toArray(),landing1:bl1?.position.toArray(),
rail:[[3.5,46.6],[-3.2,42],[-11,35],[-19,33],[-25,33.5]].map(([x,z])=>toCity([x,5.03,z])),A:toCity([-22.21,5.03,5.9]),B:toCity([6.32,5.03,45.71])};});
console.log(JSON.stringify(r));}finally{await b.close();}
