import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv.includes('--before')?'before':'after';
const out=new URL('../../artifacts/pipeline/citadel-backdrop-shore/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('target-hillside-rock-foundations'),null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city');
  const {officialOceanLevelAt}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js');
  t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;t.scene.updateMatrixWorld(true);
  const root=city.getObjectByName('citadel-new-city-backdrop-range');
  const meshes=root.children.filter(o=>o.name.startsWith('citadel-backdrop-ridge-'));
  const bands=meshes.map(m=>{
   const a=m.geometry.attributes.position,edges=new Map(),verts=new Map();
   for(let i=0;i<a.count;i+=3){const keys=[];for(let j=0;j<3;j++){const p=new T.Vector3().fromBufferAttribute(a,i+j),k=p.toArray().map(x=>Math.round(x*10000)).join(',');verts.set(k,p);keys.push(k);}
    for(let j=0;j<3;j++){const k=[keys[j],keys[(j+1)%3]].sort().join('|');edges.set(k,(edges.get(k)||0)+1);}}
   const boundary=new Set([...edges].filter(([,n])=>n===1).flatMap(([k])=>k.split('|')));
   const heights=[...boundary].map(k=>{const p=m.localToWorld(verts.get(k).clone());return p.length()-160-officialOceanLevelAt(p);});
   return {name:m.name,vertices:a.count,boundaryVertices:heights.length,boundaryAboveWater:heights.filter(h=>h>0).length,maxBoundaryAltitude:Math.max(...heights)};
  });
  const treeSupports=[];
  for(const forest of root.children.filter(m=>m.isInstancedMesh)){
   const ridge=root.children.find(m=>m.name.startsWith('citadel-backdrop-ridge-')&&m.position.equals(forest.position));
   const matrix=new T.Matrix4(),ray=new T.Raycaster();ray.layers.enableAll();let missing=0,maxGap=-Infinity;
   for(let i=0;i<forest.count;i++){
    forest.getMatrixAt(i,matrix);const p=new T.Vector3().setFromMatrixPosition(matrix).applyMatrix4(forest.matrixWorld),up=p.clone().normalize();
    ray.set(p.clone().addScaledVector(up,5),up.clone().negate());ray.far=10;
    const hit=ray.intersectObject(ridge,false)[0];if(!hit)missing++;else maxGap=Math.max(maxGap,hit.distance-5);
   }
   treeSupports.push({ridge:ridge.name,trees:forest.count,missing,maxGap});
  }
  return {bands,treeSupports,conformance:root.userData.oceanConformance??null};
 });
 for(const [name,position,target] of [['sea-right',[170,0,-40],[8,18,-105]],['sea-rear',[-110,0,-220],[8,22,-105]],['city',[12,42,141],[34,19,16]]]){
  await page.evaluate(({name,position,target})=>{
   const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('highland-west-city'),p=c.localToWorld(new T.Vector3(...position));
   if(name!=='city')p.normalize().multiplyScalar(168);
   t.camera.position.copy(p);t.camera.up.copy(name==='city'?new T.Vector3(0,1,0).transformDirection(c.matrixWorld):p.clone().normalize());
   t.camera.lookAt(c.localToWorld(new T.Vector3(...target)));t.camera.fov=52;t.camera.far=3000;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);
  },{name,position,target});
  await page.waitForTimeout(1100);await page.screenshot({path:new URL(`${phase}-${name}.png`,out).pathname});
 }
 report.errors=errors;
 await writeFile(new URL(`${phase}.json`,out),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
 if(phase==='after'&&(errors.length||report.bands.some(b=>b.boundaryAboveWater)||report.treeSupports.some(t=>t.missing||t.maxGap>0.05)))throw Error('Backdrop shoreline boundary failed');
} finally {await browser.close();}
