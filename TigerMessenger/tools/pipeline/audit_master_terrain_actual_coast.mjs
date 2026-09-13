import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await browser.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1&citadelMasterTerrain=5');
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.masterTerrainCandidate?.status==='ready',null,{timeout:180000});
 const report=await p.evaluate(async()=>{
  const {scene,THREE:T}=window.__tm,c=scene.getObjectByName('castleContainer');c.updateWorldMatrix(true,true);
  const source=await(await fetch('/TigerMessenger/artifacts/pipeline/citadel-master-terrain/source.json')).json();
  const patch=(await import('/TigerMessenger/assets/models/optimized/citadel-master-terrain/masterTerrainR05.js')).default;
  const {officialOceanLevelAt}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js');
  const signed=p=>p.length()-160-officialOceanLevelAt(p),rows=[];
  const crossing=(a,b)=>{
   let ha=signed(a),hb=signed(b);if(ha*hb>=0)return null;
   let lo=0,hi=1;const v=new T.Vector3();
   for(let i=0;i<35;i++){const mid=(lo+hi)/2;v.copy(a).lerp(b,mid);const h=signed(v);if(h*ha>0){lo=mid;ha=h;}else hi=mid;}
   return a.clone().lerp(b,(lo+hi)/2);
  };
  for(const part of patch.parts){
   const base=source.parts.find(s=>s.name===part.name),before=base.vertices.map(v=>new T.Vector3(...v).applyMatrix4(c.matrixWorld)),after=before.map(v=>v.clone());
   for(const row of part.changes)after[row[0]].set(...row.slice(4)).applyMatrix4(c.matrixWorld);
   const edges=new Set();for(let i=0;i<base.indices.length;i+=3)for(let j=0;j<3;j++){const a=base.indices[i+j],b=base.indices[i+(j+1)%3];edges.add(a<b?a+','+b:b+','+a);}
   let common=0,changed=0,maxShift=0,worst=null;
   for(const edge of edges){const [i,j]=edge.split(',').map(Number),a=crossing(before[i],before[j]),b=crossing(after[i],after[j]);
    if(!!a!==!!b)changed++;else if(a){common++;const shift=a.distanceTo(b);if(shift>maxShift){maxShift=shift;worst={edge,before:c.worldToLocal(a.clone()).toArray(),after:c.worldToLocal(b.clone()).toArray()};}}
   }
   rows.push({mesh:part.name,commonCrossingEdges:common,changedCrossingEdges:changed,maxShift,worst});
  }
  return {scope:'exact officialOceanLevelAt reference surface intersected with straight terrain edges by 35-step bisection; excludes animated water displacement and triangle-interior crossings',rows};
 });
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/r05-actual-coast.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
