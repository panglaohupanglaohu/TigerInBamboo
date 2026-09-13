import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const output=new URL('../../artifacts/pipeline/citadel-master-terrain/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');
 await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('new-city-rock-shoulder'),null,{timeout:180000});
 const data=await page.evaluate(async()=>{
  const {scene,THREE:T}=window.__tm,c=scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city');
  c.updateWorldMatrix(true,true);
  const rocks=['citadel-oskar-grid-mountain-surface','citadel-coastal-cliff-seal','new-city-rock-shoulder','highland-ravine-wall-west','old-shore-blender-rock-support','target-hillside-rock-foundations'];
  const sites=['highland-town-foundation-platform','west-city-plaza-foundation','middle-terrace-solid','west-city-crown-retaining-wall-0','horse-terrace-foundation'];
  const parts=[];c.traverseVisible(o=>{
   if(!o.isMesh||!rocks.includes(o.name)&&!sites.includes(o.name))return;
   const g=o.geometry,base=new T.Matrix4().multiplyMatrices(c.matrixWorld.clone().invert(),o.matrixWorld),m=new T.Matrix4(),im=new T.Matrix4(),p=new T.Vector3();
   for(let k=0;k<(o.isInstancedMesh?o.count:1);k++){
    if(o.isInstancedMesh){o.getMatrixAt(k,im);m.multiplyMatrices(base,im);}else m.copy(base);
    const vertices=[];for(let i=0;i<g.attributes.position.count;i++)vertices.push(p.fromBufferAttribute(g.attributes.position,i).applyMatrix4(m).toArray());
    const indices=g.index?Array.from(g.index.array):vertices.map((_,i)=>i);
    parts.push({name:o.name,kind:rocks.includes(o.name)?'rock':'site',vertices,indices});
   }
  });
  const {createOceanHeightSampler}=await import('/TigerMessenger/src/world/citadel/oceanSurface.js');
  const ocean=createOceanHeightSampler(c,160),waterVertices=[],waterIndices=[];
  for(let j=0;j<=35;j++)for(let i=0;i<=42;i++){const x=-150+i*6,z=-70+j*6;waterVertices.push([x,ocean(x,z),z]);}
  for(let j=0;j<35;j++)for(let i=0;i<42;i++){const a=j*43+i;waterIndices.push(a,a+43,a+44,a,a+44,a+1);}
  parts.push({name:'measured-official-sea-envelope',kind:'water',vertices:waterVertices,indices:waterIndices});
  const {OLD_CITY_YAW}=await import('/TigerMessenger/src/world/citadel/oldCityOrientation.js');
  const oldFrame=new T.Matrix4().multiplyMatrices(c.matrixWorld.clone().invert(),c.getObjectByName('citadel-oskar-grid-mountain-surface').matrixWorld).multiply(new T.Matrix4().makeRotationY(OLD_CITY_YAW));
  const spec=c.userData.townSpec,n=spec.gridSize||25,oldLots=[];
  for(const terrace of spec.terraces)for(let z=0;z<n;z++)for(let x=0;x<n;x++)if(terrace.levels.some(level=>(level[z]?.[x]||'.')!=='.'))oldLots.push({x:(x-(n-1)/2)*2,z:(z-(n-1)/2)*2,base:c.userData.townBaseYs[terrace.terraceIndex]});
  const convert=v=>c.worldToLocal(city.localToWorld(new T.Vector3(...v))).toArray();
  return {source:'Actual default 8931 terrain and selected construction volumes; no candidate deformation',frame:'castleContainer metres; Blender mapping x,-z,y',parts,oldFrame:oldFrame.toArray(),oldLots,routes:[city.userData.frontHarborRoute,city.userData.plazaToKeepRoute].filter(Boolean),camera:{eye:convert([108,42,140]),look:convert([59,14,65])},cityMatrix:new T.Matrix4().multiplyMatrices(c.matrixWorld.clone().invert(),city.matrixWorld).toArray()};
 });
 await writeFile(new URL('source.json',output),JSON.stringify(data));
 console.log(JSON.stringify({parts:data.parts.length,triangles:data.parts.reduce((s,p)=>s+p.indices.length/3,0)}));
}finally{await browser.close();}
