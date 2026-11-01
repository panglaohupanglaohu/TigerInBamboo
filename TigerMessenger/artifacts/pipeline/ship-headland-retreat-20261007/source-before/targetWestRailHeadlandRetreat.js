import * as T from 'three';
import {createCastleOceanSampler} from './newCityRidgeCandidate.js';

// User removed the uninhabited outer headland from the west railway to the
// ship-side water. Apply AFTER the strict east artifact and BEFORE all samplers.
// The old-town construction core starts at x=-86; x>=-96 stays byte-identical.
export function retreatWestRailHeadland(castle,{radius=160}={}){
 const source=castle.getObjectByName('citadel-oskar-grid-mountain-surface');if(!source)return null;
 castle.updateWorldMatrix(true,true);
 const geometry=source.geometry.clone(),toChart=castle.matrixWorld.clone().invert().multiply(source.matrixWorld);
 const report=applyWestHeadlandRetreatGeometry(geometry,{toChart,castleMatrix:castle.matrixWorld,radius});
 source.geometry=geometry;source.userData.westRailHeadlandRetreat=report;return report;
}

export function applyWestHeadlandRetreatGeometry(geometry,{toChart,castleMatrix,radius=160}){
 const fromChart=toChart.clone().invert(),seaAt=createCastleOceanSampler(castleMatrix,radius),a=geometry.attributes.position,p=new T.Vector3();
 let changed=0,maxDrop=0,protectedVertices=0;
 for(let i=0;i<a.count;i++){
  p.fromBufferAttribute(a,i).applyMatrix4(toChart);
  if(p.x>=-96){protectedVertices++;continue;}
  const sea=seaAt(p.x,p.z);if(sea===null)continue;
  const weight=1-T.MathUtils.smoothstep(p.x,-102,-96),y=T.MathUtils.lerp(p.y,Math.min(p.y,sea-4),weight),drop=p.y-y;
  if(drop<=1e-7)continue;
  maxDrop=Math.max(maxDrop,drop);p.y=y;p.applyMatrix4(fromChart);a.setXYZ(i,p.x,p.y,p.z);changed++;
 }
 a.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 return{version:'west-rail-ship-headland-retreat-1',changed,maxDrop,protectedVertices,fullRemovalWestOf:-102,unchangedEastOf:-96,seaBedOffset:-4,railChanged:false,phase:'before-planting-navigation-and-city-foundations'};
}
