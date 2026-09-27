import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(2000);
const r=await p.evaluate(()=>{const t=window.__tm,T=t.THREE;const c=t.scene.getObjectByName('castleContainer');c.updateMatrixWorld(true);const inv=c.matrixWorld.clone().invert();const out=[];
c.traverse(o=>{if(!o.isMesh||!o.visible||o.userData.isOutline)return;const box=new T.Box3().setFromObject(o);if(box.isEmpty())return;const ce=box.getCenter(new T.Vector3()).applyMatrix4(inv);if(ce.x<-95||ce.x>-18||ce.z<-45||ce.z>28||ce.y<-2)return;
 const ms=Array.isArray(o.material)?o.material:[o.material];if(ms.some(m=>m?.isShaderMaterial||m?.onBeforeCompile&&m.onBeforeCompile.toString().length>40||m?.map))out.push({n:o.name,p:o.parent?.name,types:ms.map(m=>m?.type),hasMap:ms.some(m=>!!m?.map),obc:ms.some(m=>m?.onBeforeCompile&&m.onBeforeCompile.toString().length>40),uniforms:ms.filter(m=>m?.uniforms).map(m=>Object.keys(m.uniforms).slice(0,8)),size:Math.round(box.getSize(new T.Vector3()).length())});});
return out;});
console.log(JSON.stringify(r,null,0));}finally{await b.close();}
