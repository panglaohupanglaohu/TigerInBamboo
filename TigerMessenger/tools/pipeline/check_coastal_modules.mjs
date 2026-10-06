import fs from 'node:fs';
import assert from 'node:assert/strict';
import {terraceStackGeometry} from '../../src/world/seaStackTerraces.js';
import {solveCoastalStackWfc} from '../../src/world/seaStackWfc.js';
const results=[],variants=new Set();
for(let seed=0;seed<100;seed++){
 const w=solveCoastalStackWfc(seed);assert.deepEqual(w,solveCoastalStackWfc(seed));assert.equal(w.socketMismatches,0);
 variants.add(w.modules.map(m=>m.id).join(','));
 const g=terraceStackGeometry(10,60,seed),p=g.attributes.position,n=g.attributes.normal;
 assert([...p.array,...n.array].every(Number.isFinite));
 const edges=new Map();let shelfArea=0,volume=0;
 const pt=i=>[p.getX(i),p.getY(i),p.getZ(i)];
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const key=a=>a.map(v=>v.toFixed(5)).join(',');
 for(let i=0;i<p.count;i+=3){
  const tri=[pt(i),pt(i+1),pt(i+2)];
  const area=Math.hypot(...cross(sub(tri[1],tri[0]),sub(tri[2],tri[0])))/2;
  assert(area>1e-7,'nondegenerate faces');
  if(n.getY(i)>.99&&p.getY(i)>-20&&p.getY(i)<26)shelfArea+=area;
  volume+=dot(tri[0],cross(tri[1],tri[2]))/6;
  for(let j=0;j<3;j++){
   const a=key(tri[j]),b=key(tri[(j+1)%3]);const k=[a,b].sort().join('|');
   const v=edges.get(k)||{count:0,orientation:0};v.count++;v.orientation+=a<b?1:-1;edges.set(k,v);
  }
 }
 assert([...edges.values()].every(e=>e.count===2&&e.orientation===0),'closed manifold, matching orientation');
 assert(volume>0);assert(shelfArea>40,'usable ledge area');
 results.push({seed,volume,shelfArea,footprintRatio:g.userData.terraces.footprintRadius/10,modules:w.modules.map(m=>m.id)});g.dispose();
}
const report={seeds:100,deterministic:true,socketMismatches:0,nonFinite:0,openEdges:0,orientationErrors:0,variants:variants.size,maxFootprintRatio:Math.max(...results.map(r=>r.footprintRatio)),minShelfArea:Math.min(...results.map(r=>r.shelfArea)),results};
fs.writeFileSync(new URL('../../artifacts/pipeline/sea-stacks-bad-north/module-checks.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,results:undefined}));
