import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {installSwampCoralRim} from '../../src/world/swampCoralRim.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:'?gregLakeRim=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
function closed(geo){const p=geo.attributes.position,edges=new Map();for(let i=0;i<p.count;i+=3){const keys=[0,1,2].map(j=>[p.getX(i+j),p.getY(i+j),p.getZ(i+j)].map(v=>Math.round(v*1e4)).join(','));if(new Set(keys).size<3)continue;for(let j=0;j<3;j++){const k=[keys[j],keys[(j+1)%3]].sort().join('|');edges.set(k,(edges.get(k)||0)+1);}}assert.ok([...edges.values()].every(v=>v===2),'new exterior is closed geometry');}

test('production outer cliff attaches to the real rim, closes its shell and preserves original walking geometry byte for byte',()=>{
 const wrapper=createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=wrapper.userData.inner;
 const actorPositions=[inner.userData.tiger,...inner.userData.towerTrees].map(n=>[n,n.position.clone()]);
 const report=installSwampCoralRim(inner,{enabled:true}),g=inner.getObjectByName('greg-coral-outer-cliff'),rock=g.getObjectByName('greg-coral-outer-cliff-rock'),p=rock.geometry.attributes.position;
 assert.equal(report.outerCliff.renderDraws,2);assert.equal(report.walkMeshes.length,1);assert.equal(report.outerCliff.walkable,false);assert.equal(g.children.length,2);closed(rock.geometry);
 const anchors=report.outerCliff.topAnchors,topPositions=report.walkMeshes[0].geometry.attributes.position.array.slice(),topColors=report.walkMeshes[0].geometry.attributes.color.array.slice();
 for(const a of anchors){assert.equal(a[1],40);let found=false;for(let i=0;i<p.count;i++)if(Math.hypot(p.getX(i)-a[0],p.getY(i)-a[1],p.getZ(i)-a[2])<5e-6){found=true;break;}assert.ok(found);}
 let minRadius=Infinity,minY=Infinity,maxY=-Infinity;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);assert.ok([x,y,z].every(Number.isFinite));minRadius=Math.min(minRadius,Math.hypot(x,z));minY=Math.min(minY,y);maxY=Math.max(maxY,y);
  const d=Math.abs(Math.atan2(Math.sin(Math.atan2(z,x)-.5),Math.cos(Math.atan2(z,x)-.5)));
  assert.ok(d>=report.entranceHalfAngle-1e-6,'no rock or cap enters authored entrance slot');
 }
 assert.ok(minRadius>38);assert.equal(maxY,40);assert.ok(minY<33&&minY>28);assert.ok(report.outerCliff.depthInner[1]-report.outerCliff.depthInner[0]>2);
 inner.updateMatrixWorld(true);const ray=new T.Raycaster();for(let i=0;i<144;i++){
  const a=i*Math.PI/72,d=Math.abs(Math.atan2(Math.sin(a-.5),Math.cos(a-.5)));if(d<report.entranceHalfAngle+.02)continue;
  for(const r of [35.4,37.4,39.4]){
   const origin=inner.localToWorld(new T.Vector3(Math.cos(a)*r,42,Math.sin(a)*r));ray.set(origin,new T.Vector3(0,-1,0).transformDirection(inner.matrixWorld));ray.far=3;
   const hits=ray.intersectObjects(report.walkMeshes,false);assert.ok(hits.some(h=>h.face.normal.y>.99&&Math.abs(inner.worldToLocal(h.point.clone()).y-40)<1e-4),'full two-world-wide walkway remains supported');
  }
 }
 for(const[n,old]of actorPositions)assert.ok(n.position.equals(old));
 report.dispose();assert.equal(inner.getObjectByName('greg-coral-outer-cliff'),undefined);
 location.search='?gregLakeRim=0&gregLakeOuterCliff=0';
 const fallback=installSwampCoralRim(inner,{enabled:true});assert.equal(fallback.outerCliff,null);assert.deepEqual(fallback.walkMeshes[0].geometry.attributes.position.array,topPositions);assert.deepEqual(fallback.walkMeshes[0].geometry.attributes.color.array,topColors);fallback.dispose();location.search='?gregLakeRim=0';
 console.log(JSON.stringify({outerCliff:{...report.outerCliff,topAnchors:undefined,topAnchorCount:report.outerCliff.topAnchors.length},minRadius,minY,maxY,topBytesUnchanged:true,walkwayWidthWorld:2}));
});
