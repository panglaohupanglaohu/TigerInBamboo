import {targetCityParams} from './targetCityRelease.js';
import * as THREE from 'three';
import {landformProtection} from './mountainLandform.js';

// The visible left foreground hill is the separate west-wall asset. Sculpt its
// real source surface into broad, gently draining benches; keep its sea foot,
// original footprint and building contact geometry instead of overlaying slabs.
const ORIGINALS=new WeakMap();
const KNots=[[-5,-5],[0,0],[4,8],[11,8.2],[14,16],[20,16.2],[23,25],[31,25.2]];
export function westTerraceHeight(y){
 if(y<=KNots[0][0])return y;
 if(y>=KNots.at(-1)[0])return KNots.at(-1)[1]+y-KNots.at(-1)[0];
 for(let i=1;i<KNots.length;i++)if(y<=KNots[i][0]){const a=KNots[i-1],b=KNots[i];return THREE.MathUtils.lerp(a[1],b[1],(y-a[0])/(b[0]-a[0]));}
 return y;
}
function subdivide(source){
 const attributes=Object.entries(source.attributes).filter(([n])=>n!=='normal'),values=Object.fromEntries(attributes.map(([n])=>[n,[]]));
 const bary=[[1,0,0],[0,1,0],[0,0,1],[.5,.5,0],[0,.5,.5],[.5,0,.5]],count=source.index?.count??source.attributes.position.count;
 for(let i=0;i<count;i+=3){const ids=[0,1,2].map(k=>source.index?source.index.getX(i+k):i+k);for(const q of [0,3,5,3,1,4,5,4,2,3,4,5])for(const [n,a]of attributes)for(let k=0;k<a.itemSize;k++)values[n].push(ids.reduce((s,id,j)=>s+a.array[id*a.itemSize+k]*bary[q][j],0));}
 const g=new THREE.BufferGeometry();for(const [n,a]of attributes)g.setAttribute(n,new THREE.Float32BufferAttribute(values[n],a.itemSize));g.userData={...source.userData};return g;
}
export function replaceWestWallWithTerraces(castle,{radius=160,curves={}}={}){
 if(targetCityParams().get('citadelBroadTerraces')!=='1')return null;
 const wall=castle.getObjectByName('highland-ravine-wall-west');if(!wall)return {applied:false,reason:'west wall absent'};
 castle.updateWorldMatrix(true,true);if(!ORIGINALS.has(wall))ORIGINALS.set(wall,wall.geometry);
 const source=ORIGINALS.get(wall),intermediate=subdivide(source),g=subdivide(intermediate);intermediate.dispose();
 const inverse=castle.matrixWorld.clone().invert(),toCastle=inverse.clone().multiply(wall.matrixWorld),toWall=toCastle.clone().invert(),p=g.attributes.position;
 const terrainFirst=targetCityParams().get('citadelTerrainFirst')==='1';
 const protection=terrainFirst?[]:landformProtection(castle),rails=[];for(const curve of Object.values(terrainFirst?{}:curves))for(let i=0;i<1200;i++)rails.push(curve.getPointAt(i/1200));
 const world=q=>q.clone().applyMatrix4(castle.matrixWorld),gap=q=>{const w=world(q);let d=Infinity;for(const box of protection)d=Math.min(d,box.distanceToPoint(w)-3);for(const r of rails)d=Math.min(d,w.distanceTo(r)-12);return d;};
 const nodes=[],ids=[],lookup=new Map(),bounds=new THREE.Box3();
 for(let i=0;i<p.count;i++){const q=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(toCastle),key=q.toArray().map(v=>Math.round(v*1e5)).join(',');let id=lookup.get(key);if(id===undefined){id=nodes.length;lookup.set(key,id);nodes.push({q,delta:0});bounds.expandByPoint(q);}ids.push(id);}
 let fixed=0,partial=0;
 for(const n of nodes){const {q}=n;if(q.y<=0){fixed++;continue;}const clearance=gap(q);if(clearance<=0){fixed++;continue;}
  const mobility=THREE.MathUtils.smoothstep(q.y,0,4)*THREE.MathUtils.smoothstep(clearance,0,5),target=THREE.MathUtils.lerp(q.y,westTerraceHeight(q.y),mobility);let y=q.y;
  // Swept clearance cannot jump through a foundation between two clear ends.
  for(let i=0;i<32;i++){const remain=target-y;if(Math.abs(remain)<1e-6)break;const d=gap(new THREE.Vector3(q.x,y,q.z));if(d<.01)break;y+=Math.sign(remain)*Math.min(Math.abs(remain),d*.8);}
  if(Math.abs(y-target)>.03)partial++;n.delta=y-q.y;
 }
 const faces=[],normal=(ids,moved)=>{const [a,b,c]=ids.map(id=>{const n=nodes[id];return n.q.clone().add(new THREE.Vector3(0,moved?n.delta:0,0));});return b.sub(a).cross(c.sub(a));};
 for(let i=0;i<ids.length;i+=3){const face=ids.slice(i,i+3),n=normal(face,false);faces.push({face,n,area:n.length()});}
 const invalid=f=>{if(f.area<1e-8)return f.face.some(id=>Math.abs(nodes[id].delta)>1e-6);const n=normal(f.face,true),len=n.length();return len<Math.max(1e-8,f.area*.005)||n.dot(f.n)<0;};
 let reductions=0;for(let step=0;step<18;step++){const blocked=new Set();for(const f of faces)if(invalid(f))for(const id of f.face)blocked.add(id);if(!blocked.size)break;for(const id of blocked){nodes[id].delta*=.5;reductions++;}}
 // Return any unresolved faces and their shared vertices to the source.
 for(let step=0;step<nodes.length;step++){const blocked=new Set();for(const f of faces)if(invalid(f))for(const id of f.face)if(nodes[id].delta)blocked.add(id);if(!blocked.size)break;for(const id of blocked)nodes[id].delta=0;}
 let changed=0,maxDelta=0;for(const n of nodes){if(Math.abs(n.delta)>1e-5)changed++;maxDelta=Math.max(maxDelta,Math.abs(n.delta));}
 for(let i=0;i<p.count;i++){const n=nodes[ids[i]],q=n.q.clone();q.y+=n.delta;q.applyMatrix4(toWall);p.setXYZ(i,q.x,q.y,q.z);}
 g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();wall.geometry=g;
 return wall.userData.terraceReplacement={revision:3,applied:true,terrainFirst,layoutStatus:terrainFirst?'terrain candidate; architecture and railway pending relayout':'legacy layout protected',sourceBounds:{min:bounds.min.toArray(),max:bounds.max.toArray()},sourceVertices:source.attributes.position.count,vertices:p.count,changed,maxDelta,fixed,partial,reductions,invalidFaces:faces.filter(invalid).length,levels:KNots,method:'source-preserving west massif terracing; two shared subdivisions; swept foundation/rail protection; welded face orientation guard; coastline below y0 unchanged',release:false};
}
