import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';

// Runtime census: retain source names and ancestor paths instead of silently
// treating every unhit point as water. Bounds are inventory, not collision proof.
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
  const page=await browser.newPage();
  await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');
  await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('new-city-rock-shoulder'),null,{timeout:180000});
  const data=await page.evaluate(()=>{
    const {scene,THREE:T}=window.__tm;
    const castle=scene.getObjectByName('castleContainer');
    castle.updateWorldMatrix(true,true);
    const inverse=castle.matrixWorld.clone().invert(),meshes=[];
    castle.traverseVisible(o=>{
      if(!o.isMesh||!o.geometry?.attributes.position)return;
      const chain=[];for(let p=o;p&&p!==castle;p=p.parent)chain.unshift(p.name||p.type);
      const matrix=new T.Matrix4().multiplyMatrices(inverse,o.matrixWorld);
      const box=new T.Box3(),p=new T.Vector3(),positions=o.geometry.attributes.position;
      // Exact transformed vertex bounds including every instance; excludes shader displacement.
      const instance=new T.Matrix4(),transform=new T.Matrix4();
      for(let n=0;n<(o.isInstancedMesh?o.count:1);n++){
        if(o.isInstancedMesh){o.getMatrixAt(n,instance);transform.multiplyMatrices(matrix,instance);}else transform.copy(matrix);
        for(let i=0;i<positions.count;i++)box.expandByPoint(p.fromBufferAttribute(positions,i).applyMatrix4(transform));
      }
      const path=chain.join('/');
      const rocks=['citadel-oskar-grid-mountain-surface','citadel-coastal-cliff-seal','new-city-rock-shoulder','highland-ravine-wall-west','old-shore-blender-rock-support','target-hillside-rock-foundations'];
      const category=rocks.includes(o.name)?'rock':/foundation|retaining-wall|terrace-solid|court-solid|plaza-retaining-solid|quay|founded-terrace|terrace-blender-masonry/i.test(o.name)?'built-support':'other';
      meshes.push({name:o.name,path,category,min:box.min.toArray(),max:box.max.toArray(),vertices:positions.count,instanced:!!o.isInstancedMesh,instances:o.count??null});
    });
    return {source:'default 8931 runtime, no candidates',frame:'castleContainer local metres',scope:'visible castle descendant mesh bounds; instance transforms included; shader displacement excluded; bounding boxes do not prove solid support',meshes};
  });
  await writeFile(new URL('../../artifacts/pipeline/citadel-terrain-baseline/support-census.json',import.meta.url),JSON.stringify(data,null,2));
  console.log(JSON.stringify({total:data.meshes.length,selected:data.meshes.filter(m=>m.category!=='other').map(m=>m.name)}));
} finally {await browser.close();}
