import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
// The real scene generator, URL defaults and ordered city/mountain steps run
// unchanged. Only browser drawing APIs are stubbed for this CPU startup check.
const context=new Proxy({canvas:{width:2,height:2},createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:(_,__,w=2,h=2)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},cloneNode(){return element();},setAttribute(){},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.ImageData=class{constructor(data,width,height){this.data=data;this.width=width;this.height=height;}};
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element,addEventListener(){},body:element()};globalThis.location={search:'?tour=crystal-v7&autostart=1',href:'http://localhost:8931/TigerMessenger/index.html?tour=crystal-v7&autostart=1'};
// In-memory storage never reads, clears or writes the user's browser saves.
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};globalThis.window={addEventListener(){},removeEventListener(){},localStorage,location,innerWidth:1280,innerHeight:800};globalThis.HTMLImageElement=class{};globalThis.Image=class extends HTMLImageElement{constructor(){super();Object.assign(this,element(),{complete:true});}};
const {messengerIslandScene}=await import('../../src/scenes/messengerIsland.js');

const {installSwampBridgeClearance}=await import('../../src/world/swampBridgeClearance.js');
test('formal relocated lake keeps decks and outer bearings while removing both measured near-bank obstructions',()=>{
 const scene=new T.Scene(),gen=messengerIslandScene.loadSteps({scene,planetRadius:160});let reached=false;
 try{for(let i=0;i<140;i++){const next=gen.next();if(next.done)break;if(String(next.value).includes('信使主岛已构建')){reached=true;break;}}}finally{gen.return();}
 assert.ok(reached);scene.updateMatrixWorld(true);const inner=scene.getObjectByName('moebius-swamp-zone');
 assert.ok(inner.userData.gregBridgeClearance?.ok,'formal scene must install after relocateCrystalCore');
 inner.userData.gregBridgeClearance.dispose();
 const crowns=[];inner.traverse(o=>{if(o.isInstancedMesh&&o.name==='greg-coral-fan-crown')crowns.push({o,count:o.count,matrix:[...o.instanceMatrix.array]});});
 const protectedMeshes=[];scene.traverse(o=>{if(o.isMesh&&(o.parent?.name==='moebius-city-viaduct'||o.name==='gate-site-GateSite_stone-walk'))protectedMeshes.push({o,geometry:o.geometry,positions:[...o.geometry.attributes.position.array]});});
 const objects=[];scene.traverse(o=>{if(!o.isMesh)return;for(let a=o;a;a=a.parent)if(a===inner||!a.visible)return;objects.push(o);});
 const hits=behind=>{const p=new T.Vector3(16.815,32.5,-17.487),d=new T.Vector3(-8,32.5,-7).sub(p).normalize();p.addScaledVector(d,-behind);const a=inner.localToWorld(p.clone()),b=inner.localToWorld(p.clone().add(d));return new T.Raycaster(a,b.sub(a).normalize(),0,60).intersectObjects(objects,false);};
 assert.equal(hits(0)[0].object.name,'gate-site-GateSite_stone-solid');assert.ok(hits(0)[0].distance<4.1);assert.ok(hits(15)[0].distance<3.4);
 const report=installSwampBridgeClearance(scene,inner);assert.equal(report.removedPiers,23);assert.equal(report.removedGatePiers,2);assert.equal(report.removedGenericPiers,21);assert.equal(report.retainedPiers,149);assert.ok(report.spanWorld>43&&report.spanWorld<44);assert.equal(report.spandrelPosts,26);assert.ok(report.bankClearanceWorld>17);assert.ok(report.archBottomInnerY>67);assert.ok(hits(0)[0].distance>19);assert.ok(hits(15)[0].distance>27);
 protectedMeshes.forEach(({o,geometry,positions})=>{assert.equal(o.geometry,geometry);assert.deepEqual([...geometry.attributes.position.array],positions);});
 let trimmedSeen=0;const arch=inner.getObjectByName('greg-lake-high-bridge-bearing-arches'),fans=[],inverse=inner.matrixWorld.clone().invert(),fanMaterial=new T.MeshBasicMaterial({side:T.DoubleSide});
 inner.traverse(o=>{if(!o.isInstancedMesh||!o.visible||o.name!=='greg-coral-fan-crown')return;for(let i=0;i<o.count;i++){const matrix=new T.Matrix4();o.getMatrixAt(i,matrix);if(matrix.determinant()===0){trimmedSeen++;continue;}matrix.premultiply(o.matrixWorld).premultiply(inverse);const proxy=new T.Mesh(o.geometry,fanMaterial);proxy.matrix.copy(matrix);proxy.matrixAutoUpdate=false;proxy.updateMatrixWorld(true);proxy.userData={group:o.parent.name,source:o.userData.canopySource,instance:i,anchor:new T.Vector3().setFromMatrixPosition(matrix).toArray()};fans.push(proxy);}});
 const ap=arch.geometry.attributes.position,ray=new T.Raycaster();let leafEdgeCrossings=0;const samples=[],leaves=new Map();
 for(let i=0;i<ap.count;i+=3)for(let j=0;j<3;j++){const a=new T.Vector3().fromBufferAttribute(ap,i+j),b=new T.Vector3().fromBufferAttribute(ap,i+(j+1)%3),d=b.clone().sub(a);ray.set(a,d.clone().normalize());ray.far=d.length();const hits=ray.intersectObjects(fans,false);if(hits.length){for(const h of hits){const k=JSON.stringify(h.object.userData);leaves.set(k,(leaves.get(k)||0)+1);}leafEdgeCrossings++;if(samples.length<3)samples.push(hits[0].point.toArray());}}
 fanMaterial.dispose();console.log('actual crown / new bridge edge intersections',JSON.stringify({leafEdgeCrossings,samples,leaves:[...leaves].map(([key,hits])=>({...JSON.parse(key),hits}))}));
 console.log('formal lake bridge report',JSON.stringify(report));
 crowns.forEach(({o,count,matrix})=>{assert.equal(o.count,count);for(let i=0;i<count;i++)for(const j of [12,13,14])assert.equal(o.instanceMatrix.array[i*16+j],matrix[i*16+j]);});
 const hash=arrays=>{const h=createHash('sha256');for(const a of arrays)h.update(Buffer.from(new Float32Array(a).buffer));return h.digest('hex');};
 const matrixHashes={before:hash(crowns.map(c=>c.matrix)),changed:hash(crowns.map(c=>c.o.instanceMatrix.array))};
 report.dispose();crowns.forEach(({o,matrix})=>assert.deepEqual([...o.instanceMatrix.array],matrix));matrixHashes.restored=hash(crowns.map(c=>c.o.instanceMatrix.array));assert.equal(matrixHashes.before,matrixHashes.restored);
 const evidence={...report,matrixHashes,externalEdgeCrossings:leafEdgeCrossings,explicitlyExcludedTrimmedProbes:trimmedSeen,visibleCrownCounts:{rimSlots:366,rimVisible:364,centralVisible:7,totalVisible:371}};delete evidence.dispose;
 writeFileSync(new URL('../../artifacts/pipeline/greg-lake-implementation-20261007/bridge-clearance-report.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log('canopy matrix hashes',JSON.stringify(matrixHashes));
 assert.equal(trimmedSeen,2);assert.equal(report.leafClearance.visibleInstancesAfter,364);assert.equal(report.leafClearance.changedInstances.length,7);assert.equal(report.leafClearance.trimmedInstances.length,2);assert.equal(report.leafClearance.remainingBidirectionalIntersections,0);assert.equal(leafEdgeCrossings,0);assert.equal(report.leafClearance.instanceCountBefore,report.leafClearance.instanceCountAfter);
});
