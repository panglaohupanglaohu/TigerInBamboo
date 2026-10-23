import * as T from 'three';
import {createTargetNewCityPlacement} from './targetNewCityPlacement.js';
const PLAZA=[[45,76],[49,69],[65,64],[81,67],[88,76],[83,87],[64,91],[49,87]];
function distanceToPolygon(x,z,polygon){
 let inside=false,distance=Infinity;
 for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[j],b=polygon[i],dx=b[0]-a[0],dz=b[1]-a[1];
  if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  const t=T.MathUtils.clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz),0,1);
  distance=Math.min(distance,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
 }
 return inside?-distance:distance;
}
/** One coherent radial construction shelf, and a narrow sea-facing cliff break.
 * The cliff only removes the exterior toe; rail curves and plaza heights stay put.
 */
export function createTargetNewCityCliffField({castleMatrix}={}){
 const placement=createTargetNewCityPlacement(castleMatrix),p=new T.Vector3();
 const report={version:'new-city-radial-shelf-steep-cliff-2',placement:placement.report,
  cliffTransition:1.4,plazaSetback:2.8,changedShelfQueries:0,changedCliffQueries:0,
  scope:'new-city construction shelf and exterior toe; old city, plaza and railway curves fixed',visualVerified:false};
 function shelfHeight(x,z,original){
  const y=placement.planeAt(x,z,-.12);p.set(x,y,z).applyMatrix4(placement.inverse);
  // The entry descent and bridge dock remain below and outside the shelf.
  const across=1-T.MathUtils.smoothstep(Math.abs(p.x),23,27);
  const along=T.MathUtils.smoothstep(p.z,-27,-23)*(1-T.MathUtils.smoothstep(p.z,8,12));
  const weight=across*along;
  if(weight>0)report.changedShelfQueries++;
  return T.MathUtils.lerp(original,y,weight);
 }
 function cliffHeight(x,z,original,sea){
  if(x<34||z<16)return original;
  const ellipse=(Math.hypot((x-74)/29,(z-33)/37)-1)*29;
  const plaza=distanceToPolygon(x,z,PLAZA)-2.8;
  // Preserve the established stair/bridge approach between upper town and square.
  const passage=distanceToPolygon(x,z,[[44,37],[65,37],[67,68],[44,79]])-1.5;
  const distance=Math.min(ellipse,plaza,passage);
  const edge=1.0+.32*Math.sin(z*.36)+.22*Math.sin(x*.47);
  const weight=T.MathUtils.smoothstep(distance,edge,edge+1.4)*T.MathUtils.smoothstep(z,16,23)*T.MathUtils.smoothstep(x,34,40);
  if(weight===0||original<=sea-3)return original;
  const next=T.MathUtils.lerp(original,sea-3,weight);
  if(next<original)report.changedCliffQueries++;
  return next;
 }
 return {shelfHeight,cliffHeight,report};
}

/** Deterministically reprofile an already validated final mesh BEFORE consumers.
 * Columns deform between their fixed submerged foot and the measured top. This
 * preserves the archived rail-cut topology, including vertical wall vertices.
 */
export function applyNewCityCliffGeometry(geometry,{toChart,castleMatrix,radius=160,surfaceIndexFactory,seaAt}={}){
 if(!surfaceIndexFactory||!seaAt)throw new TypeError('actual surface index and sea sampler required');
 const field=createTargetNewCityCliffField({castleMatrix}),proxy=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));
 proxy.matrixAutoUpdate=false;proxy.matrix.copy(toChart);proxy.updateMatrixWorld(true);
 const index=surfaceIndexFactory([proxy]),fromChart=toChart.clone().invert(),position=geometry.attributes.position;
 const point=new T.Vector3(),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),cache=new Map();
 let moved=0,maxDisplacement=0;
 for(let i=0;i<position.count;i++){
  point.fromBufferAttribute(position,i).applyMatrix4(toChart);
  if(point.x<34||point.z< -25)continue;
  const key=point.x.toFixed(5)+','+point.z.toFixed(5);let column=cache.get(key);
  if(!column){
   const sea=seaAt(point.x,point.z);if(!Number.isFinite(sea))continue;
   ray.origin.set(point.x,220,point.z);const hit=index.sample(ray,0,1000);if(!hit)continue;
   const top=hit.point.y,floor=Math.min(top-1,sea-12),shelf=field.shelfHeight(point.x,point.z,top);
   const next=field.cliffHeight(point.x,point.z,shelf,sea);
   column={top,floor,next};cache.set(key,column);
  }
  const weight=T.MathUtils.clamp((point.y-column.floor)/(column.top-column.floor),0,1);
  const delta=(column.next-column.top)*weight;if(Math.abs(delta)<1e-6)continue;
  moved++;maxDisplacement=Math.max(maxDisplacement,Math.abs(delta));point.y+=delta;point.applyMatrix4(fromChart);position.setXYZ(i,point.x,point.y,point.z);
 }
 proxy.material.dispose();position.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const report={...field.report,movedVertices:moved,maxDisplacement,columns:cache.size,sourceTopologyPreserved:true,radius};
 geometry.userData.newCityRadialCliff=report;return report;
}
