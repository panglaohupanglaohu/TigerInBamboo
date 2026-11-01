import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {installSwampHarborScene,overviewCamera,HARBOR_OVERVIEW}=await import('../../src/world/swampHarborScene.js');
const {pruneTaggedOfficialOceanOccludeds}=await import('../../src/core/officialOceanOcclusionPruning.js');
const {crystalV7SwampDir}=await import('../../src/world/crystalV7Layout.js');
const {createSwampLivingPathConstraints}=await import('../../src/world/swampGregLivingPaths.js');


const start=performance.now();
const swamp=createMoebiusSwampPlacement({seed:7711,scale:.5});
placeMoebiusSwampOnSphere(swamp,crystalV7SwampDir(),160,.5,0);
const inner=swamp.userData.inner,activity=inner.userData.flowerBoyActivities;
const h=installSwampHarborScene({swamp,departure:'original',workerScale:1});
const nav=activity.navigation,yard=inner.userData.shipyard;
assert.ok(!h.farBoat,'formal original departure, no far proxy');
const actors=[...inner.userData.whales.map((o,i)=>({key:'whale-'+i,o})),{key:'escort-whale',o:yard.escort},{key:'original-longship',o:yard.departure},{key:'original-dock-ship',o:yard.dock},{key:'repair-barge',o:yard.barge},{key:'feeding-child',o:activity.feeder}];
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
const bounds=o=>{const result=[];o.traverse(m=>{if(!m.isMesh||m.userData.isOutline||!visible(m))return;if(m.material?.transparent&&m.material.opacity<.2)return;m.geometry.computeBoundingBox();const box=m.geometry.boundingBox.clone().applyMatrix4(inner.matrixWorld.clone().invert().multiply(m.matrixWorld));result.push({box,name:m.name||m.uuid,mesh:m});});return result;};
const sep=(a,b)=>Math.max(a.min.x-b.max.x,b.min.x-a.max.x,a.min.y-b.max.y,b.min.y-a.max.y,a.min.z-b.max.z,b.min.z-a.max.z);
const pairs=new Map(),near=[];let snapshots=[];
for(let k=0;k<=600;k++){
 const time=k*.25;swamp.userData.update(.25,time,{});h.update(time);inner.updateWorldMatrix(true,true);
 const other=actors.map(a=>({...a,parts:bounds(a.o)}));
 for(const r of nav.records){const boatParts=bounds(r.boat);
  for(const a of other){const key=r.index+':'+a.key;let min=Infinity,partNames=null;
   for(const b of boatParts)for(const p of a.parts){const d=sep(b.box,p.box);if(d<min){min=d;partNames=[b.name,p.name];}}
   let out=pairs.get(key);if(!out){out={boat:r.index,actor:a.key,minSignedMeshAABBGap:Infinity,overlapSamples:0,overlapTimes:[]};pairs.set(key,out);}
   if(min<out.minSignedMeshAABBGap){out.minSignedMeshAABBGap=min;out.atTime=time;out.parts=partNames;out.boatPosition=r.boat.position.toArray();out.actorPosition=a.o.position.toArray();}
   if(min<=0){out.overlapSamples++;out.overlapTimes.push(time);if(near.length<100)near.push({time,boat:r.index,actor:a.key,gap:min,parts:partNames});}
  }
 }
 if(k%40===0)snapshots.push({time,boats:nav.records.map(r=>({index:r.index,pos:r.boat.position.toArray(),paddleState:r.boat.userData.paddleMotion})),actors:other.map(a=>({key:a.key,pos:a.o.position.toArray(),visible:visible(a.o),meshCount:a.parts.length}))});
}
const triangles=m=>{const matrix=inner.matrixWorld.clone().invert().multiply(m.matrixWorld),p=m.geometry.attributes.position,idx=m.geometry.index,out=[];
 for(let i=0;i<(idx?.count||p.count);i+=3){const vs=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(matrix));out.push({vs,box:new T.Box3().setFromPoints(vs)});}return out;};
const intersect=(a,b)=>{const ea=[a[1].clone().sub(a[0]),a[2].clone().sub(a[1]),a[0].clone().sub(a[2])],eb=[b[1].clone().sub(b[0]),b[2].clone().sub(b[1]),b[0].clone().sub(b[2])],na=ea[0].clone().cross(ea[1]),nb=eb[0].clone().cross(eb[1]),axes=[na,nb];
 for(const x of ea)for(const y of eb)axes.push(x.clone().cross(y));
 for(const x of [...ea,...eb])axes.push(na.clone().cross(x));
 for(const axis of axes){if(axis.lengthSq()<1e-15)continue;axis.normalize();const pa=a.map(v=>v.dot(axis)),pb=b.map(v=>v.dot(axis));if(Math.max(...pa)<Math.min(...pb)-1e-7||Math.max(...pb)<Math.min(...pa)-1e-7)return false;}return true;};
const narrow=[];
for(const pair of [...pairs.values()].filter(p=>p.minSignedMeshAABBGap<=0)){
 let first=null,checks=0,checkedSamples=0;
 for(const time of pair.overlapTimes){
  swamp.userData.update(.25,time,{});h.update(time);inner.updateWorldMatrix(true,true);
  const r=nav.records.find(r=>r.index===pair.boat),actor=actors.find(a=>a.key===pair.actor),a=bounds(r.boat),b=bounds(actor.o);checkedSamples++;
  outer:for(const x of a)for(const y of b){if(!x.box.intersectsBox(y.box))continue;const ta=triangles(x.mesh),tb=triangles(y.mesh);
   for(const u of ta)for(const v of tb){if(!u.box.intersectsBox(v.box))continue;checks++;if(intersect(u.vs,v.vs)){first={time,boatMesh:x.name,actorMesh:y.name,boatTriangle:u.vs.map(v=>v.toArray()),actorTriangle:v.vs.map(v=>v.toArray())};break outer;}}
  }
  if(first)break;
 }
 narrow.push({boat:pair.boat,actor:pair.actor,worstBoundsTime:pair.atTime,checkedSamples,trianglePairsTested:checks,surfaceIntersection:!!first,first});
}
console.log(JSON.stringify({seed:7711,departure:'original',proxyCreated:!!h.farBoat,period:{from:0,to:150,step:.25,frames:601},coordinates:'inner local; multiply by measured uniform world scale to world metres',innerWorldScale:inner.getWorldScale(new T.Vector3()).toArray(),boundsMethod:'current visible mesh geometry bounding boxes transformed through actual matrixWorld; signed axis-separation lower bound, negative value is possible contact not proof of triangle intersection',pairs:[...pairs.values()],narrowPhaseAllOverlapTimes:narrow,potentialOverlapSamples:near,snapshots,GPU:'not tested; no source changes'},null,2));
