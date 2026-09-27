import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});await page.waitForFunction(()=>window.__tm?.messenger,null,{timeout:180000});
 const report=await page.evaluate(()=>{const t=window.__tm,T=t.THREE,water=t.scene.getObjectByName('planet-v8-curved-ocean'),bed=t.scene.getObjectByName('planet-surface');t.scene.updateMatrixWorld(true);
  let minWaterPlane=Infinity,minWaterRadius=Infinity,waterFaces=0,maxBedRadius=0;const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),n=new T.Vector3(),p=water.geometry.attributes.position,idx=water.geometry.index;
  for(let i=0;i<(idx?.count??p.count);i+=3){a.fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(water.matrixWorld);b.fromBufferAttribute(p,idx?idx.getX(i+1):i+1).applyMatrix4(water.matrixWorld);c.fromBufferAttribute(p,idx?idx.getX(i+2):i+2).applyMatrix4(water.matrixWorld);n.crossVectors(b.clone().sub(a),c.clone().sub(a));if(n.lengthSq()<1e-12)continue;minWaterPlane=Math.min(minWaterPlane,Math.abs(n.normalize().dot(a)));minWaterRadius=Math.min(minWaterRadius,new T.Triangle(a,b,c).closestPointToPoint(new T.Vector3(),new T.Vector3()).length());waterFaces++;}
  const positions=bed.geometry.attributes.position;for(let i=0;i<positions.count;i++)maxBedRadius=Math.max(maxBedRadius,a.fromBufferAttribute(positions,i).applyMatrix4(bed.matrixWorld).length());
  return {waterFaces,minWaterPlane,minWaterRadius,maxBedRadius,gap:minWaterRadius-maxBedRadius,entireBedBelowWater:maxBedRadius<minWaterRadius,scope:'Minimum exact distance to all actual ocean triangles vs maximum radius of original base-planet vertices; infinite triangle planes are reported only as a conservative diagnostic. This global bound does not prove uniform cover; per-vertex radial cover is required before editing.'};
 });
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/global-seabed-cover.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
