import test from 'node:test';
import assert from 'node:assert/strict';
import {coastalStackGeometry} from '../../src/world/seaStackCoastalGeometry.js';

test('coastal variants are connected oriented solids with supported terraces',()=>{
 const variants=new Set();let maxTriangles=0,maxMs=0;
 for(let seed=0;seed<40;seed++){
  const g=coastalStackGeometry(12,48,seed),p=g.attributes.position,ids=g.index.array;
  variants.add(g.userData.terraces.variant);maxTriangles=Math.max(maxTriangles,ids.length/3);maxMs=Math.max(maxMs,g.userData.terraces.constructionMs);
  const edges=new Map(),adj=Array.from({length:p.count},()=>[]);let area=0,volume=0;
  for(let i=0;i<ids.length;i+=3){
   const a=ids[i],b=ids[i+1],c=ids[i+2];
   const ax=p.getX(a),ay=p.getY(a),az=p.getZ(a),bx=p.getX(b),by=p.getY(b),bz=p.getZ(b),cx=p.getX(c),cy=p.getY(c),cz=p.getZ(c);
   const nx=(by-ay)*(cz-az)-(bz-az)*(cy-ay),ny=(bz-az)*(cx-ax)-(bx-ax)*(cz-az),nz=(bx-ax)*(cy-ay)-(by-ay)*(cx-ax),l=Math.hypot(nx,ny,nz);
   if(ny/l>.92&&ay>-20&&ay<10)area+=l/2;
   volume+=(ax*(by*cz-bz*cy)+ay*(bz*cx-bx*cz)+az*(bx*cy-by*cx))/6;
   for(const [u,v] of [[a,b],[b,c],[c,a]]){const key=[Math.min(u,v),Math.max(u,v)].join(':');edges.set(key,(edges.get(key)||0)+(u<v?1:-1));adj[u].push(v);adj[v].push(u);}
  }
  assert.ok([...edges.values()].every(n=>n===0),`winding ${seed}`);
  const seen=new Set([ids[0]]),queue=[ids[0]];for(let j=0;j<queue.length;j++)for(const v of adj[queue[j]])if(!seen.has(v)){seen.add(v);queue.push(v);}
  assert.equal(seen.size,p.count,`connected ${seed}`);assert.ok(volume>0,`outward ${seed}`);assert.ok(area>2,`real ledge ${seed}`);
  assert.equal(g.boundingBox.min.y,-24);assert.ok(g.userData.terraces.footprintRadius<15);assert.ok(ids.length/3<10000);
  g.dispose();
 }
 assert.equal(variants.size,3);console.log({variants:[...variants],maxTriangles,maxConstructionMs:maxMs});
});
