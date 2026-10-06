import * as THREE from 'three';
import {citadelCoastalFrame} from './coastalTramRoute.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

// The displaced city's rear shoreline sits below the old castle tangent plane.
// The old western-only cut did not reach it. Reserve an open coastal corridor
// around both final tracks, restricted to uninhabited low/back perimeter rock.
export function openFinalMountainRailCoast(castle,radius,curves){
 const mesh=castle.getObjectByName('citadel-oskar-grid-mountain-surface');if(!mesh)return null;
 castle.updateWorldMatrix(true,true);const invCastle=castle.matrixWorld.clone().invert(),invMesh=mesh.matrixWorld.clone().invert();
 const samples=[];for(const curve of Object.values(curves))for(let i=0;i<2400;i++)samples.push(curve.getPointAt(i/2400).normalize());
 const geometry=mesh.geometry.clone(),a=geometry.attributes.position,p=new THREE.Vector3(),local=new THREE.Vector3(),direction=new THREE.Vector3();let changed=0,maxDrop=0;
 for(let i=0;i<a.count;i++){
  p.fromBufferAttribute(a,i).applyMatrix4(mesh.matrixWorld);local.copy(p).applyMatrix4(invCastle);
  if(local.y> -28)continue;
  const r=p.length();direction.copy(p).normalize();let distance2=Infinity;
  for(const q of samples)distance2=Math.min(distance2,q.distanceToSquared(direction));
  const distance=Math.sqrt(distance2)*radius;if(distance>=25)continue;
  const t=THREE.MathUtils.clamp((distance-9)/16,0,1),blend=1-t*t*(3-2*t);
  const target=Math.min(r,radius+officialOceanLevelAt(direction)-2.5),next=r+(target-r)*blend;
  if(r-next<1e-6)continue;
  maxDrop=Math.max(maxDrop,r-next);p.multiplyScalar(next/r).applyMatrix4(invMesh);a.setXYZ(i,p.x,p.y,p.z);changed++;
 }
 a.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
 // Any legacy derived ink/rim mesh must follow the exact new coastline.
 const rim=castle.getObjectByName('backlit-highlight-citadel-oskar-grid-mountain-surface');if(rim)rim.visible=false;
 return {changed,maxDrop,coreRadius:9,blendRadius:25,protectedCastleY:-28};
}

// The revealed rear coast used the legacy +0.3 m world-track floor, below the
// official +0.5 m sea. Lift the shared control curve before rails, decks and
// vehicles are constructed, feathering into the unchanged city approaches.
export function raiseCitadelMountainCoastRail(points,radius){
 const round=new URLSearchParams(globalThis.location?.search||'').get('citadelMountain');
 if(round!==null&&Number(round)<13)return;
 const inv=citadelCoastalFrame().clone().invert();
 for(const point of points){
  const local=point.clone().applyMatrix4(inv);
  const blend=(1-THREE.MathUtils.smoothstep(Math.abs(local.x),160,195))*(1-THREE.MathUtils.smoothstep(Math.abs(local.z+5),90,125))*(1-THREE.MathUtils.smoothstep(local.y,-28,-12));
  if(blend<=0)continue;
  const floor=radius+officialOceanLevelAt(point)+.65;
  if(point.length()<floor)point.setLength(THREE.MathUtils.lerp(point.length(),floor,blend));
 }
}
