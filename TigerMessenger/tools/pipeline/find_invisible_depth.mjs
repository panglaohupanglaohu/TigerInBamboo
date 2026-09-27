// Find meshes that write depth but draw (almost) nothing: they cut transparent clouds.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage({viewport:{width:1280,height:800}});await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(2000);
const r=await p.evaluate(()=>{const t=window.__tm,T=t.THREE;const out=[];
t.scene.traverse(o=>{if(!o.isMesh||!o.visible)return;let v=o;while(v){if(!v.visible)return;v=v.parent;}const ms=Array.isArray(o.material)?o.material:[o.material];
 for(const m of ms){if(!m||!m.visible)continue;const invisible=m.colorWrite===false||(m.transparent&&m.opacity<0.06)||(m.userData&&m.userData.occluder);
  if(invisible&&m.depthWrite!==false){o.geometry.computeBoundingSphere?.();const bs=o.geometry.boundingSphere;const s=o.getWorldScale(new T.Vector3());out.push({name:o.name,parent:o.parent?.name,type:m.type,colorWrite:m.colorWrite,opacity:m.opacity,depthWrite:m.depthWrite,radius:bs?Math.round(bs.radius*Math.max(s.x,s.y,s.z)):null,renderOrder:o.renderOrder});}}});
 out.sort((a,b)=>(b.radius||0)-(a.radius||0));return out.slice(0,25);});
console.log(JSON.stringify(r,null,1));}finally{await b.close();}
