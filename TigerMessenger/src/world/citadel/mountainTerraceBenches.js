import * as THREE from 'three';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';

export const MOUNTAIN_TERRACE_BENCH_REVISION='terrace-benches-candidate-1';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

/** A closed stepped solid, not a terrain boolean or WFC solver. Levels are
 * ordered low/outside to high/inside. All coordinates are final castle-local.
 * The caller must remove/clip superseded source faces before publication. */
export function createTerraceBenchGeometry({center,radii,levels,bottomY,segments=40}){
 if(!Array.isArray(center)||!Array.isArray(radii)||radii.some(v=>!Number.isFinite(v)||v<=0)||!Number.isFinite(bottomY))throw new Error('finite center/radii/bottomY required');
 if(center.some(v=>!Number.isFinite(v))||center.length!==2||radii.length!==2||levels.length<2||levels.length>3)throw new Error('two or three levels required');
 if(!Number.isInteger(segments)||segments<12||segments>96)throw new Error('segments 12..96 required');
 for(let i=0;i<levels.length;i++){const l=levels[i];if(!Number.isFinite(l.y)||!Number.isFinite(l.scale)||l.scale<=0||l.scale>1||l.y<=bottomY||(i&&(l.y<=levels[i-1].y||l.scale>=levels[i-1].scale)))throw new Error('levels must ascend while shrinking');}
 const offset=l=>l.centerOffset||[0,0];
 for(let i=0;i<levels.length;i++){
  const o=offset(levels[i]);if(o.length!==2||o.some(v=>!Number.isFinite(v)))throw new Error('finite centerOffset pair required');
  if(i){const prev=offset(levels[i-1]),drift=Math.hypot((o[0]-prev[0])/radii[0],(o[1]-prev[1])/radii[1]);if(drift>0&&drift>=levels[i-1].scale*.94-levels[i].scale*1.06)throw new Error('offset would cross lower ledge perimeter');}
 }
 const positions=[],indices=[],rings=[];
 const ring=(scale,y,o=[0,0])=>{const ids=[];for(let i=0;i<segments;i++){const a=i*Math.PI*2/segments,w=1+.035*Math.sin(3*a+.4)+.025*Math.cos(5*a-.3);ids.push(positions.length/3);positions.push(center[0]+o[0]+radii[0]*scale*w*Math.cos(a),y,center[1]+o[1]+radii[1]*scale*w*Math.sin(a));}rings.push(ids);return ids;};
 const wall=(lower,upper)=>{for(let i=0;i<segments;i++){const j=(i+1)%segments;indices.push(lower[i],upper[i],upper[j],lower[i],upper[j],lower[j]);}};
 const terrace=(outer,inner)=>{for(let i=0;i<segments;i++){const j=(i+1)%segments;indices.push(outer[i],inner[i],inner[j],outer[i],inner[j],outer[j]);}};
 const bottom=ring(levels[0].scale,bottomY,offset(levels[0]));let outer=ring(levels[0].scale,levels[0].y,offset(levels[0]));wall(bottom,outer);
 for(let i=1;i<levels.length;i++){const inner=ring(levels[i].scale,levels[i-1].y,offset(levels[i]));terrace(outer,inner);const upper=ring(levels[i].scale,levels[i].y,offset(levels[i]));wall(inner,upper);outer=upper;}
 const topCenter=positions.length/3;positions.push(center[0]+offset(levels.at(-1))[0],levels.at(-1).y,center[1]+offset(levels.at(-1))[1]);
 const baseCenter=positions.length/3;positions.push(center[0]+offset(levels[0])[0],bottomY,center[1]+offset(levels[0])[1]);
 for(let i=0;i<segments;i++){const j=(i+1)%segments;indices.push(topCenter,outer[j],outer[i],baseCenter,bottom[i],bottom[j]);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 geometry.userData.terraceBenches={revision:MOUNTAIN_TERRACE_BENCH_REVISION,center:[...center],radii:[...radii],levels:levels.map(l=>({...l,centerOffset:[...offset(l)]})),bottomY,segments,closed:true,booleanUnion:false};return geometry;
}

/** Read-only source sampling and conservative protection before creating a
 * detached group. protectedBoxes and railPoints are CASTLE-LOCAL; points along
 * the railway must be dense enough for the caller's complete route audit. */
export function buildMountainTerraceBenches({castle,surfaces=[],surfaceIndex,center,radii,levels,enabled=false,bottomY,embedDepth=2,segments=40,protectedBoxes=[],railPoints=[],railClearance=20,protectionMargin=0,sampleStep=2,sourceRevision=null,material}={}){
 const audit={revision:MOUNTAIN_TERRACE_BENCH_REVISION,enabled,applied:false,coordinateSpace:'final castle-local',sourceRevision,sourceSamples:0,sourceMisses:0,protectedBoxHits:0,railHits:0,requiresSourceClipping:true};
 const reject=reason=>({group:null,geometry:null,audit:{...audit,reason}});
 if(!enabled)return reject('disabled');
 if(!castle||!center||!radii||!levels)return reject('explicit final-chart anchors required');
 if(!surfaces.length&&!surfaceIndex)return reject('final source surfaces required');
 if(!Number.isFinite(sampleStep)||sampleStep<.5||!Number.isFinite(embedDepth)||embedDepth<=0||!Number.isFinite(railClearance)||railClearance<0)return reject('invalid sampling or clearance');
 castle.updateWorldMatrix(true,true);const toWorld=castle.matrixWorld.clone(),toCastle=toWorld.clone().invert(),index=surfaceIndex||buildMountainSurfaceIndex(surfaces);
 const up=V(0,1,0).transformDirection(toWorld),sample=(x,z)=>{const origin=V(x,Math.max(200,...levels.map(l=>l.y+100)),z).applyMatrix4(toWorld),hit=index.sample(new THREE.Ray(origin,up.clone().negate()),0,2000);audit.sourceSamples++;if(!hit){audit.sourceMisses++;return null;}return hit.point.clone().applyMatrix4(toCastle).y;};
 const samples=[];for(let i=0;i<segments;i++){const a=i*Math.PI*2/segments,w=1+.035*Math.sin(3*a+.4)+.025*Math.cos(5*a-.3);for(const l of levels){const x=center[0]+(l.centerOffset?.[0]||0)+radii[0]*l.scale*w*Math.cos(a),z=center[1]+(l.centerOffset?.[1]||0)+radii[1]*l.scale*w*Math.sin(a),y=sample(x,z);if(y!==null)samples.push(y);}}
 for(let x=-radii[0];x<=radii[0];x+=sampleStep)for(let z=-radii[1];z<=radii[1];z+=sampleStep)if((x/radii[0])**2+(z/radii[1])**2<=1){const y=sample(center[0]+(levels[0].centerOffset?.[0]||0)+x,center[1]+(levels[0].centerOffset?.[1]||0)+z);if(y!==null)samples.push(y);}
 if(audit.sourceMisses||!samples.length)return reject('source support sample miss');
 const sourceMin=Math.min(...samples),sourceMax=Math.max(...samples),base=bottomY??sourceMin-embedDepth;
 Object.assign(audit,{sourceMin,sourceMax,bottomY:base,sourceAboveLowestBench:samples.filter(y=>y>levels[0].y).length,sourceAboveHighestBench:samples.filter(y=>y>levels.at(-1).y).length,sampledSupportOnly:true});
 if(base>sourceMin-embedDepth+1e-6)return reject('bottom does not embed beneath all sampled source heights');
 let geometry;try{geometry=createTerraceBenchGeometry({center,radii,levels,bottomY:base,segments});}catch(e){return reject(e.message);}
 const bound=geometry.boundingBox,p=geometry.attributes.position,idx=geometry.index;
 // Broadphase rejection is deliberately conservative: a protected volume in
 // the hollow centre of a boundary-only test must never be silently accepted.
 for(const b of protectedBoxes){const box=(b.box||b).clone().expandByScalar(protectionMargin);if(bound.intersectsBox(box))audit.protectedBoxHits++;}
 // Conservative continuous-segment check against the clearance-expanded AABB:
 // covers volume interiors and gaps between route samples, not only vertices.
 const railBox=bound.clone().expandByScalar(railClearance);
 for(let i=0;i<railPoints.length;i++){const a=railPoints[i].isVector3?railPoints[i]:V(...railPoints[i]);if(railBox.containsPoint(a)){audit.railHits++;continue;}if(i){const b=railPoints[i-1].isVector3?railPoints[i-1]:V(...railPoints[i-1]),delta=a.clone().sub(b),length=delta.length();if(length){const hit=new THREE.Ray(b,delta.divideScalar(length)).intersectBox(railBox,V());if(hit&&hit.distanceTo(b)<=length)audit.railHits++;}}}
 audit.protectionMode='whole-solid conservative AABB rejection, rail continuous segments with expanded AABB';
 if(audit.protectedBoxHits||audit.railHits){geometry.dispose();return reject('protected volume intersects candidate envelope');}
 // Flat per-face shading preserves ledge/cliff breaks without changing topology.
 const renderGeometry=geometry.toNonIndexed();renderGeometry.computeVertexNormals();renderGeometry.userData={...geometry.userData};
 const mesh=new THREE.Mesh(renderGeometry,material||new THREE.MeshStandardMaterial({color:0xaeb8b2,roughness:.95}));mesh.name='citadel-left-terrace-bench-candidate';mesh.userData={isCitadelTerrain:true,terraceBenchCandidate:true,sourceRevision,requiresSourceClipping:true};mesh.castShadow=true;mesh.receiveShadow=true;
 const group=new THREE.Group();group.name='citadel-terrace-benches-candidate';group.add(mesh);
 Object.assign(audit,{applied:true,status:'detached-candidate-not-published',triangles:idx.count/3,vertices:p.count,bounds:{min:bound.min.toArray(),max:bound.max.toArray()},noSourceMutation:true});group.userData.terraceBenchAudit=audit;
 return {group,geometry,audit};
}
