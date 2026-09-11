import * as THREE from 'three';
import {orientWarship} from './warshipNavigation.js';

// A short posed connector from a turning-clear harbor entry to the exact berth.
// All interpolated positions and yaw changes use the same full vessel triangles.
export function findDockConnector(entries,point,heading,position,clear,meshCheck,scale,radius){
 const frame=new THREE.Group();let checks=0,lastFailure=null;
 for(const entry of entries){
  if(!clear(entry))continue;
  const start=position(entry);if(!start)continue;
  const control=point.clone().addScaledVector(heading,-Math.min(4,start.distanceTo(point)*.5));
  const steps=Math.max(16,Math.ceil((start.distanceTo(control)+control.distanceTo(point))/.25));
  const points=[],poses=[];let previous=null,safe=true;
  for(let i=0;i<=steps;i++){
   const t=i/steps,raw=start.clone().multiplyScalar((1-t)**2).addScaledVector(control,2*(1-t)*t).addScaledVector(point,t*t),direction=raw.normalize();
   const p=position(direction);if(!p){safe=false;break;}
   const tangent=control.clone().sub(start).multiplyScalar(1-t).addScaledVector(point.clone().sub(control),t);
   orientWarship(frame,direction,tangent);const q=frame.quaternion.clone();
   const substeps=previous?Math.max(1,Math.ceil(previous.p.distanceTo(p)/.01),Math.ceil(previous.q.angleTo(q)/(.25*Math.PI/180))):1;
   for(let j=0;j<=substeps;j++){
    const u=j/substeps,sp=previous?previous.p.clone().lerp(p,u):p,sq=previous?previous.q.clone().slerp(q,u):q;
    const hit=meshCheck.clear(sp,sq,scale);checks++;if(!hit.clear){lastFailure=hit;safe=false;break;}
   }
   if(!safe)break;
   points.push(direction.clone());poses.push({position:p.toArray(),quaternion:q.toArray()});previous={p,q};
  }
  if(safe)return {valid:true,entry:entry.clone(),points,poses,checks,length:points.slice(1).reduce((sum,d,i)=>sum+d.angleTo(points[i])*radius,0),scope:'Posed connector sampled at <=0.01m and <=0.25deg including turns; global sea route and boarding animation unverified'};
 }
 return {valid:false,checks,lastFailure};
}

export function placeDockConnector(boat,path,progress){
 const poses=path.poses;if(!poses||poses.length<2)return false;
 const lengths=poses.slice(1).map((p,i)=>new THREE.Vector3(...p.position).distanceTo(new THREE.Vector3(...poses[i].position)));
 let remaining=THREE.MathUtils.clamp(progress,0,1)*lengths.reduce((a,b)=>a+b,0);
 for(let i=1;i<poses.length;i++){
  if(remaining<=lengths[i-1]||i===poses.length-1){
   const t=THREE.MathUtils.clamp(remaining/Math.max(1e-8,lengths[i-1]),0,1);
   boat.position.fromArray(poses[i-1].position).lerp(new THREE.Vector3(...poses[i].position),t);
   boat.quaternion.fromArray(poses[i-1].quaternion).slerp(new THREE.Quaternion(...poses[i].quaternion),t);return true;
  }
  remaining-=lengths[i-1];
 }
 return false;
}
