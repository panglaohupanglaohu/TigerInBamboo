import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage();
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await p.waitForFunction(()=>!!window.__tm?.scene.getObjectByName('citadel-terrace-planting')?.userData.planting,null,{timeout:180000});
 const result=await p.evaluate(()=>{
  const t=window.__tm,rows=[];
  for(const name of ['citadel-terrace-planting','citadel-terrace-garden','citadel-plaza-edge-garden']){
   const root=t.scene.getObjectByName(name);if(!root)continue;
   let vertices=0,meshes=0,physicalVertices=0,physicalMeshes=0;root.traverse(o=>{if(o.isMesh){meshes++;vertices+=o.geometry.attributes.position.count;if(!o.userData.isOutline){physicalMeshes++;physicalVertices+=o.geometry.attributes.position.count;}}});
   const data=root.userData.planting??root.userData.layout;
   const reasons={};for(const item of data?.omitted??[])reasons[item.reason]=(reasons[item.reason]??0)+1;
   rows.push({name,meshes,vertices,physicalMeshes,physicalVertices,data,reasons});
  }
  const pines=rows[0].data.broadPines??[];
  const broadPinesPassed=pines.length===2&&["west-upper","east-upper"].every(group=>pines.some(p=>p.group===group&&p.size>=1.4))&&pines.every(p=>p.source.geometryApplied&&p.routeDistance>p.crownRadius+2.4&&Math.max(...p.feet)-Math.min(...p.feet)<=.65);
  const garden=rows.find(r=>r.name==='citadel-plaza-edge-garden').data.statueGarden;const statueGardenPassed=garden&&garden.innerRadius>garden.statueFootRadius&&garden.outerRadius<3&&garden.foliageHeight<.6&&garden.shrubs===22;
  return {statueGardenPassed,scope:'Actual runtime placement and source identity; broad pine foot support and conservative route spacing. Not full animated collisions or overall visual quality.',broadPinesPassed,rows};
 });
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/planting-audit.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify(result.rows.map(r=>({name:r.name,trees:r.data?.trees?.length,broadPines:r.data?.broadPines?.length,shrubs:r.data?.shrubs?.length,reasons:r.reasons,meshes:r.meshes}))));
 if(!result.broadPinesPassed||!result.statueGardenPassed)throw new Error('Broad pine placement failed');
}finally{await b.close();}
