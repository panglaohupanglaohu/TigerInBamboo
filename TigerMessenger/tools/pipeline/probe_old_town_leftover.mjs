import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(2000);
const r=await p.evaluate(()=>{const t=window.__tm,T=t.THREE;const c=t.scene.getObjectByName('castleContainer');c.updateMatrixWorld(true);const inv=c.matrixWorld.clone().invert();const out=[];
c.traverse(o=>{if(!o.isMesh||!o.visible||o.userData.isOutline)return;const box=new T.Box3().setFromObject(o);if(box.isEmpty())return;const ce=box.getCenter(new T.Vector3()).applyMatrix4(inv);if(ce.x<-95||ce.x>-18||ce.z<-45||ce.z>28||ce.y<-2)return;
 if(o.isInstancedMesh){const ic=o.instanceColor;out.push({inst:o.name,p:o.parent?.name,count:o.count,hasIC:!!ic,first:ic?[ic.array[0],ic.array[1],ic.array[2]].map(v=>+v.toFixed(2)):null,mat:(o.material?.color?"#"+o.material.color.getHexString():null)});}for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m?.color)continue;const h={};m.color.getHSL(h);if(h.h>.45&&h.h<.75&&h.l>.2&&h.l<.62)out.push({n:o.name,p:o.parent?.name,pp:o.parent?.parent?.name,t:m.type,c:'#'+m.color.getHexString(),vc:!!m.vertexColors,cnt:o.geometry?.attributes?.position?.count});}});
return out.slice(0,20);});
console.log(JSON.stringify(r,null,0));}finally{await b.close();}
