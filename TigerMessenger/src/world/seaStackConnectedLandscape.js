import * as T from 'three';
import {buildTargetTerrainHeightfield} from './citadel/targetTerrainHeightfield.js';
import {finishMountainRockSurface} from './citadel/mountainRockSurfaceFinish.js';
export const connectedSeaStackLandscapeEnabled=()=>new URLSearchParams(globalThis.location?.search||'').get('seaStackConnected')!=='0';
/** Same-side modules with compatible height/saddle ports. Authored assembly,
 * not an assertion that WFC invents global circulation or Oskar private code. */
export function planConnectedSeaStackBanks({curves,reference,waterAt}){
 let nearest=null;for(const[name,curve]of Object.entries(curves)){if(!curve?.getPointAt)continue;const length=curve.getLength(),count=Math.ceil(length/2);for(let i=0;i<count;i++){const u=i/count,point=curve.getPointAt(u),distance=point.distanceToSquared(reference);if(!nearest||distance<nearest.distance)nearest={name,curve,length,u,point,distance};}}
 if(!nearest)throw new Error('connected sea stacks require actual rail curves');
 const groups=[];
 for(const side of[-1,1]){const nodes=[];for(const[i,station]of[-29,-10,12,31].entries()){
  const u=T.MathUtils.euclideanModulo(nearest.u+station/nearest.length,1),p=nearest.curve.getPointAt(u),tangent=nearest.curve.getTangentAt(u).normalize(),up=p.clone().normalize(),lateral=new T.Vector3().crossVectors(up,tangent).normalize();
  const direction=p.clone().normalize().multiplyScalar(p.length()).addScaledVector(lateral,side*(24+(i%2)*2)).normalize(),water=waterAt(direction);if(!water)continue;
  nodes.push({anchor:water.clone(),width:[15,18,16,14][i],height:(side===-1?[13,24,16,20]:[18,12,26,16])[i],seed:7100+(side+1)*10+i,station,u});
 }if(nodes.length>=2)groups.push({id:`coastal-bank-${side<0?'landward':'seaward'}`,side,nodes,sourceCurve:nearest.name});}
 return{groups,report:{version:'connected-coastal-plan-1',railSource:nearest.name,referenceStation:nearest.u,groups:groups.map(g=>({id:g.id,side:g.side,nodes:g.nodes.map(n=>({anchor:n.anchor.toArray(),height:n.height,width:n.width,u:n.u}))})),railUnchanged:true}};
}
/** Round the grid-stair perimeter in XZ only. Top/floor paired vertices move
 * together; no smoothing across risers or changing terrace heights. The total
 * movement remains inside the conservative cell clearance already reserved. */
export function softenConnectedBankBoundary(geometry,{maxMove=.32,rounds=2}={}){
 const p=geometry.attributes.position,ix=geometry.index;if(!ix)return {moved:0,maxMove:0};
 const groups=new Map(),keys=[];for(let i=0;i<p.count;i++){const key=`${p.getX(i)},${p.getZ(i)}`;keys[i]=key;if(!groups.has(key))groups.set(key,{ids:[],neighbors:new Set(),x:p.getX(i),z:p.getZ(i)});groups.get(key).ids.push(i);}
 for(let f=0;f<ix.count;f+=3){const ks=[...new Set([keys[ix.getX(f)],keys[ix.getX(f+1)],keys[ix.getX(f+2)]])];if(ks.length===2){groups.get(ks[0]).neighbors.add(ks[1]);groups.get(ks[1]).neighbors.add(ks[0]);}}
 const original=p.array.slice(),v=[new T.Vector3(),new T.Vector3(),new T.Vector3()],before=new T.Vector3(),after=new T.Vector3();let rejected=0;
 for(let iteration=0;iteration<rounds;iteration++){
  const updates=new Map();for(const[key,g]of groups){if(g.neighbors.size!==2)continue;const ns=[...g.neighbors].map(k=>groups.get(k)),x=(ns[0].x+ns[1].x)/2,z=(ns[0].z+ns[1].z)/2,dx=(x-g.x)*.5,dz=(z-g.z)*.5,ox=original[g.ids[0]*3],oz=original[g.ids[0]*3+2],tx=g.x+dx-ox,tz=g.z+dz-oz,length=Math.hypot(tx,tz),scale=length>maxMove?maxMove/length:1;updates.set(key,[ox+tx*scale,oz+tz*scale]);}
  const apply=()=>{for(const[key,g]of groups){const u=updates.get(key);for(const i of g.ids){p.setX(i,u?u[0]:g.x);p.setZ(i,u?u[1]:g.z);}}};apply();
  // Simultaneous Float32 triangle orientation/area check, never hide a fold.
  for(let pass=0;pass<5;pass++){const blocked=new Set();for(let f=0;f<ix.count;f+=3){const ids=[ix.getX(f),ix.getX(f+1),ix.getX(f+2)];ids.forEach((id,j)=>v[j].set(groups.get(keys[id]).x,p.getY(id),groups.get(keys[id]).z));before.subVectors(v[1],v[0]).cross(v[2].clone().sub(v[0]));ids.forEach((id,j)=>v[j].fromBufferAttribute(p,id));after.subVectors(v[1],v[0]).cross(v[2].clone().sub(v[0]));if(after.lengthSq()<1e-10||before.dot(after)<=0)ids.forEach(id=>blocked.add(keys[id]));}if(!blocked.size)break;for(const key of blocked)if(updates.delete(key))rejected++;apply();}
  for(const[key,u]of updates){const g=groups.get(key);g.x=p.getX(g.ids[0]);g.z=p.getZ(g.ids[0]);}
 }
 let moved=0,largest=0;for(let i=0;i<p.count;i++){const d=Math.hypot(p.getX(i)-original[i*3],p.getZ(i)-original[i*3+2]);if(d>1e-6)moved++;largest=Math.max(largest,d);}p.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();return{moved,maxMove:largest,rejected,rounds,heightsUnchanged:true,trianglesUnchanged:true};
}
/** Closed, shared-vertex coastal solid. A continuous permission field excludes
 * loaded rail sweeps and protected objects before any material/plant is built. */
export function buildConnectedSeaStackBank({nodes,waterAt,railSamples=[],protectedBoxes=[],seed=0,step=1.35,allowWorldPoint=null}){
 if(nodes.length<2)throw new Error('two same-side nodes required');
 const center=nodes.reduce((a,n)=>a.add(n.anchor),new T.Vector3()).multiplyScalar(1/nodes.length),anchor=waterAt(center);if(!anchor)throw new Error('connected bank misses actual ocean');
 const up=anchor.clone().normalize(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),up),matrix=new T.Matrix4().compose(anchor,q,new T.Vector3(1,1,1)),inverse=matrix.clone().invert(),localNodes=nodes.map(n=>({...n,p:n.anchor.clone().applyMatrix4(inverse)}));
 const extent=new T.Box3();for(const n of localNodes)extent.expandByPoint(n.p.clone().add(new T.Vector3(n.width+2,0,n.width+2))).expandByPoint(n.p.clone().add(new T.Vector3(-n.width-2,0,-n.width-2)));
 const worldBounds=extent.clone();worldBounds.min.y=-20;worldBounds.max.y=40;worldBounds.applyMatrix4(matrix).expandByScalar(8);
 const rails=railSamples.filter(v=>worldBounds.containsPoint(v)),boxes=protectedBoxes.map(e=>e.box||e).filter(b=>b.intersectsBox(worldBounds)),cache=new Map();let rejectedRail=0,rejectedProtected=0,seaMisses=0;
 const margin=step*1.6; // covers each cell footprint, not merely its center.
 const ray=new T.Line3(),closest=new T.Vector3();
 function sample(x,z){const key=x+','+z;if(cache.has(key))return cache.get(key);let height=0,occupied=false;
  for(const n of localNodes){const dx=x-n.p.x,dz=z-n.p.z,d=Math.hypot(dx/n.width,dz/(n.width*.87));if(d>1+.04*Math.sin(dx*.2+seed))continue;occupied=true;
   // Wide lower meadow; a displaced high shoulder, with narrow steep risers.
   let h=5.8;h+=5.5*(1-T.MathUtils.smoothstep(d,.73,.88));const shoulder=Math.hypot((dx+n.width*.23)/(n.width*.61),(dz-n.width*.08)/(n.width*.58));h+=(n.height-11.3)*(1-T.MathUtils.smoothstep(shoulder,.80,1));height=Math.max(height,h+.10*Math.sin(x*.14+z*.17));
  }
  for(let i=1;i<localNodes.length;i++){const a=localNodes[i-1],b=localNodes[i],v=new T.Vector2(b.p.x-a.p.x,b.p.z-a.p.z),len=v.lengthSq(),t=T.MathUtils.clamp(((x-a.p.x)*v.x+(z-a.p.z)*v.y)/len,0,1),distance=Math.hypot(x-a.p.x-v.x*t,z-a.p.z-v.y*t);if(distance<8.5){occupied=true;height=Math.max(height,8.1+1.4*Math.sin(t*Math.PI));}}
  if(!occupied){cache.set(key,null);return null;}
  const water=waterAt(new T.Vector3(x,0,z).applyMatrix4(matrix));if(!water){seaMisses++;cache.set(key,null);return null;}
  if(allowWorldPoint&&!allowWorldPoint(water)){rejectedProtected++;cache.set(key,null);return null;}
  const floorWorld=water.clone().addScaledVector(water.clone().normalize(),-2.4),topWorld=water.clone().addScaledVector(up,height),floor=floorWorld.clone().applyMatrix4(inverse).y,top=topWorld.clone().applyMatrix4(inverse).y;
  ray.set(new T.Vector3(x,floor,z).applyMatrix4(matrix),new T.Vector3(x,top,z).applyMatrix4(matrix));
  // Capsule encloses loaded body (including 5.71m cargo top) and interpolation.
  for(const p of rails){const railCenter=p.clone().addScaledVector(p.clone().normalize(),2.55);ray.closestPointToPoint(railCenter,true,closest);if(closest.distanceTo(railCenter)<6.2+margin){rejectedRail++;cache.set(key,null);return null;}}
  const column=new T.Box3().setFromPoints([ray.start,ray.end]).expandByScalar(margin);if(boxes.some(b=>b.intersectsBox(column))){rejectedProtected++;cache.set(key,null);return null;}
  const result={top,floor,water:water.toArray()};cache.set(key,result);return result;
 }
 const built=buildTargetTerrainHeightfield({bounds:{minX:extent.min.x,maxX:extent.max.x,minZ:extent.min.z,maxZ:extent.max.z},heightAt:(x,z)=>sample(x,z)?.top??null,floorAt:(x,z)=>sample(x,z)?.floor??null,step,maxCells:14000});
 const boundaryFinish=softenConnectedBankBoundary(built.geometry);
 const finished=finishMountainRockSurface(built.geometry,{enabled:true,relax:false,creaseAngleDeg:42,terraceSlope:.78});built.geometry.dispose();const geometry=finished.geometry;geometry.computeBoundingBox();
 let footprintRadius=0;const finalPositions=geometry.attributes.position;for(let i=0;i<finalPositions.count;i++)footprintRadius=Math.max(footprintRadius,Math.hypot(finalPositions.getX(i),finalPositions.getZ(i)));
 geometry.userData.terraces={seed,height:geometry.boundingBox.max.y-geometry.boundingBox.min.y,footprintRadius,connectedLandscape:true};geometry.userData.surfaceRevision=`connected-coast-${seed}-1`;
 const report={...built.audit,version:'connected-coastal-solid-1',rejectedRail,rejectedProtected,seaMisses,railSamples:rails.length,modules:localNodes.length,saddlePorts:localNodes.length-1,flatMeadowIntent:true,clearanceMargin:6.2+margin,actualOcean:true,boundaryFinish,geometryNormals:finished.report,visualReviewed:false};geometry.userData.connectedLandscape=report;return{geometry,matrix,anchor,report};
}
