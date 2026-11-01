import * as T from 'three';
import {latLonToDir} from './sphereMath.js';
/** Closest safe site to the live moon garden, with full enlarged footprint. */
export function chooseMorrisIslandSite({obstacles=[],curves=[],R=160,near=null,footprintRadius=22*Math.sqrt(7),route=null,anchor=null,awayFrom=null}={}){
 const samples=curves.filter(c=>c?.getSpacedPoints).flatMap(c=>c.getSpacedPoints(800));
 const target=near?.clone().normalize().multiplyScalar(R)??latLonToDir(75,-14).multiplyScalar(R);
 const envelope=footprintRadius*1.085+7,candidates=[];
 for(let lat=-70;lat<=85;lat+=5)for(let lon=-180;lon<180;lon+=5){
  const direction=latLonToDir(lat,lon),centre=direction.clone().multiplyScalar(R);let clearance=Infinity;
  for(const o of obstacles)if(o.position?.length()>1)clearance=Math.min(clearance,centre.distanceTo(o.position.clone().normalize().multiplyScalar(R))-(o.radius??0));
  for(const p of samples)clearance=Math.min(clearance,centre.distanceTo(p.clone().normalize().multiplyScalar(R))-4);
  candidates.push({lat,lon,direction,clearance,targetDistance:centre.distanceTo(target)});
 }
 const safe=candidates.filter(c=>c.clearance>=envelope).sort((a,b)=>a.targetDistance-b.targetDistance||b.clearance-a.clearance);
 let site=safe[0],anchorMigration=null;if(anchor){
  const originalDirection=anchor.clone().normalize();
  let direction=originalDirection.clone();
  if(awayFrom?.position?.length()>1){
   const awayDirection=awayFrom.position.clone().normalize();
   const required=envelope+(awayFrom.radius??0);
   const currentAngle=originalDirection.angleTo(awayDirection),requiredAngle=2*Math.asin(Math.min(1,required/(2*R)));
   if(requiredAngle>currentAngle){
    const delta=Math.acos(T.MathUtils.clamp(Math.cos(requiredAngle)/Math.cos(currentAngle),-1,1));
    const tangent=originalDirection.clone().addScaledVector(awayDirection,-originalDirection.dot(awayDirection));
    if(tangent.lengthSq()<1e-8){const pole=Math.abs(awayDirection.y)<.9?new T.Vector3(0,1,0):new T.Vector3(1,0,0);tangent.crossVectors(awayDirection,pole);}
    tangent.normalize();
    direction.multiplyScalar(Math.cos(delta)).addScaledVector(tangent,Math.sin(delta)).normalize();
    anchorMigration={from:originalDirection.toArray(),to:direction.toArray(),awayFrom:awayDirection.toArray(),chordBefore:2*R*Math.sin(currentAngle/2),chordAfter:2*R*Math.sin(requiredAngle/2),requiredClearance:required};
   }
  }
  const centre=direction.clone().multiplyScalar(R);let clearance=Infinity;for(const o of obstacles)if(o.position?.length()>1)clearance=Math.min(clearance,centre.distanceTo(o.position.clone().normalize().multiplyScalar(R))-(o.radius??0));
  site={direction,lat:T.MathUtils.radToDeg(Math.asin(direction.y)),lon:T.MathUtils.radToDeg(Math.atan2(direction.z,direction.x)),clearance,targetDistance:centre.distanceTo(target)};
 }
 if(!site)throw new Error('No surveyed space for enlarged Morris island: preserve old regions');
 return {...site,survey:{obstacles:obstacles.map(o=>({position:o.position?.toArray(),radius:o.radius??0})),rail:samples.map(p=>p.toArray()),R,near:near?.toArray(),route:route?{departure:route.departure.toArray(),destination:route.destination.toArray()}:null},report:{method:anchor?'explicit user-selected original music-elder shoreline; finite old-ground join and protected rail/actor corridors':'closest safe enlarged footprint along bookshop-to-Saihoji sea corridor; colliders/landmarks/land shell/rail survey',userSpecifiedAnchor:!!anchor,automaticEmptyOceanAcceptance:!anchor,anchorMigration,lat:site.lat,lon:site.lon,minimumClearance:site.clearance,envelope,footprintRadius,routeMidpointDistance:site.targetDistance,routeMidpointEdgeDistance:Math.max(0,site.targetDistance-footprintRadius),obstacles:obstacles.length,routeSamples:samples.length,candidates:candidates.length,otherObjectsMoved:false,route:route?{departure:route.departure.toArray(),destination:route.destination.toArray(),bookshopDistance:site.direction.angleTo(route.departure.clone().normalize())*R,saihojiDistance:site.direction.angleTo(route.destination.clone().normalize())*R,request:'书店镇去苔庭路上的广阔海域'}:null,nearestSafeCandidates:safe.slice(0,6).map(({lat,lon,clearance,targetDistance})=>({lat,lon,clearance,targetDistance}))}};
}
