// List materials used by meshes inside the old-town footprint (castle-local).
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(2000);
const r=await p.evaluate(()=>{const t=window.__tm,T=t.THREE;const c=t.scene.getObjectByName('castleContainer');c.updateMatrixWorld(true);
const inv=c.matrixWorld.clone().invert();const mats=new Map();const roots=new Map();
c.traverse(o=>{if(!o.isMesh||!o.visible||o.userData.isOutline)return;const box=new T.Box3().setFromObject(o);if(box.isEmpty())return;const ce=box.getCenter(new T.Vector3()).applyMatrix4(inv);
 if(ce.x<-95||ce.x>-18||ce.z<-45||ce.z>28||ce.y<-2)return;
 let top=o;while(top.parent&&top.parent!==c&&top.parent.name!=='citadel-continuous-mountain-terrain-system')top=top.parent;roots.set(top.name,(roots.get(top.name)||0)+1);
 for(const m of (Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;const k=(m.name||'(noname)')+'|'+(m.color?'#'+m.color.getHexString():'')+'|'+m.type+(m.vertexColors?'|vc':'');mats.set(k,(mats.get(k)||0)+1);}});
return {mats:[...mats].sort((a,b)=>b[1]-a[1]).slice(0,40),roots:[...roots].sort((a,b)=>b[1]-a[1]).slice(0,20)};});
console.log(JSON.stringify(r,null,0));}finally{await b.close();}
