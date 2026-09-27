import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await p.waitForFunction(()=>!!window.__tm?.scene.getObjectByName('citadel-new-city-lighting'),null,{timeout:180000});
 const result=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),root=c.getObjectByName('citadel-new-city-lighting');
  t.P.timeOfDay=.85;t.P.daySpeed=0;
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const lights=root.children.filter(o=>o.isPointLight).map(o=>({name:o.name,intensity:o.intensity,visible:o.visible,layers:o.layers.mask,position:o.position.toArray(),parents:(()=>{const r=[];for(let n=o.parent;n;n=n.parent)r.push({name:n.name,visible:n.visible});return r;})()}));
  return {phase:t.P.timeOfDay,weight:root.userData.nightWeight,lights,profile:c.userData.releasedLighting,materials:['main-gate-wall','west-city-plaza-deck'].map(name=>{const o=c.getObjectByName(name);return {name,layers:o.layers.mask,type:o.material.type,roughness:o.material.roughness};})};
 });
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/light-state.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await b.close();}
