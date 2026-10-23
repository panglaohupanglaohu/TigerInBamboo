import * as T from 'three';
import {clipShipHeadlandGeometry} from './targetShipHeadlandClip.js';
import {reshapeHorseSideRadialCliff} from './targetHorseSideRadialCliff.js';
import {clipRearShipVolume} from './targetRearShipVolumeClip.js';
const originals=new WeakMap();
export function restoreWestRailHeadland(castle){const source=castle.getObjectByName('citadel-oskar-grid-mountain-surface'),original=originals.get(source);if(!original)return false;source.geometry=original;originals.delete(source);delete source.userData.westRailHeadlandRetreat;return true;}
import {createCastleOceanSampler} from './newCityRidgeCandidate.js';

// User removed the uninhabited outer headland from the west railway to the
// ship-side water. Apply AFTER the strict east artifact and BEFORE all samplers.
// The old-town construction core starts at x=-86; x>=-96 stays byte-identical.
export function retreatWestRailHeadland(castle,{radius=160,shipWorldBoxes=null,railWorldBoxes=[],protectedWorldBoxes=[]}={}){
 const source=castle.getObjectByName('citadel-oskar-grid-mountain-surface');if(!source)return null;
 castle.updateWorldMatrix(true,true);
 if(originals.has(source))return source.userData.westRailHeadlandRetreat;
 const toChart=castle.matrixWorld.clone().invert().multiply(source.matrixWorld),scene=(()=>{let o=castle;while(o.parent)o=o.parent;return o;})();scene.updateWorldMatrix(true);
 const ships=shipWorldBoxes??['bookshop-steam-parts-freighter','swamp-shipwreck'].map(name=>scene.getObjectByName(name)).filter(Boolean).map(o=>({name:o.name,box:new T.Box3().setFromObject(o)}));
 const protections=[...protectedWorldBoxes];castle.traverse(o=>{if(o.isMesh&&/foundation|plaza.*deck|plaza.*paving|highland-gate/.test(o.name))protections.push(new T.Box3().setFromObject(o).expandByScalar(.25));});
 let {geometry,report}=clipShipHeadlandGeometry(source.geometry,{toChart,castleMatrix:castle.matrixWorld,seaAt:createCastleOceanSampler(castle.matrixWorld,radius),cutX:-91,keepX:-90,shipWorldBoxes:ships,railWorldBoxes,protectedWorldBoxes:protections});
 const westReport=report;
 const rear=clipRearShipVolume(geometry,{toChart});
 if(!rear.report.closedCutContours){
  const diagnostic={sourceTriangles:rear.report.sourceTriangles,openCapEndpoints:rear.report.openCapEndpoints,seamWelds:rear.report.quantizationSeamWelds,cut:[rear.report.x,rear.report.z],nodes:rear.report.openContourNodes?.slice(0,32),toChart:toChart.elements};
  rear.geometry.dispose();geometry.dispose();const error=new Error('REAR_SHIP_CUT_OPEN_CONTOUR '+JSON.stringify(diagnostic));error.diagnostic=diagnostic;throw error;
 }
 geometry.dispose();
 const horse=reshapeHorseSideRadialCliff(rear.geometry,{toChart,castleMatrix:castle.matrixWorld,enabled:true});rear.geometry.dispose();geometry=horse.geometry;report={...westReport,rearShipCliff:rear.report,horseSideCliff:horse.report};
 report.replay={version:1,cutX:-91,keepX:-90,radius,protectedWorldBoxes:protections.map(entry=>{const b=entry.box||entry;return{min:b.min.toArray(),max:b.max.toArray()};}),railWorldBoxes:railWorldBoxes.map(entry=>{const b=entry.box||entry;return{min:b.min.toArray(),max:b.max.toArray()};})};
 originals.set(source,source.geometry);source.geometry=geometry;report.version='west-rail-ship-headland-retreat-5';report.replay.rearVolumeCut={x:18,z:-10};report.replay.rearRadialCut=true;report.replay.horseSideRadialCliff=true;report.shipIdentities=ships.map(s=>s.name||'supplied-world-box');report.shipIdentityConfirmed=false;report.missingShipEvidence=!ships.length;report.missingRailEnvelope=railWorldBoxes.length===0;report.clearanceVerified=report.clearanceVerified&&!report.missingRailEnvelope;source.userData.westRailHeadlandRetreat=report;return report;
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

// Deterministic post-artifact replay, with the exact preparation-time boxes.
// Missing/corrupt snapshots reject rather than silently skipping a protection.
export function replayWestHeadlandRetreatGeometry(source,{toChart,castleMatrix,report}){
 const r=report?.replay;
 if(!['west-rail-ship-headland-retreat-2','west-rail-ship-headland-retreat-3','west-rail-ship-headland-retreat-4','west-rail-ship-headland-retreat-5'].includes(report?.version)||r?.version!==1||!Number.isFinite(r.radius)||r.radius<=0||!Array.isArray(r.protectedWorldBoxes)||!Array.isArray(r.railWorldBoxes))throw new Error('WEST_RETREAT_REPLAY_REQUIRED');
 const boxes=items=>items.map(b=>{if(!b||!Array.isArray(b.min)||!Array.isArray(b.max)||b.min.length!==3||b.max.length!==3||![...b.min,...b.max].every(Number.isFinite)||b.min.some((v,i)=>v>b.max[i]))throw new Error('WEST_RETREAT_REPLAY_BOX_INVALID');return new T.Box3(new T.Vector3(...b.min),new T.Vector3(...b.max));});
 const first=clipShipHeadlandGeometry(source,{toChart,castleMatrix,seaAt:createCastleOceanSampler(castleMatrix,r.radius),cutX:r.cutX,keepX:r.keepX,protectedWorldBoxes:boxes(r.protectedWorldBoxes),railWorldBoxes:boxes(r.railWorldBoxes)});
 if(report.version==='west-rail-ship-headland-retreat-2')return first;
 if(r.rearRadialCut!==true){first.geometry.dispose();throw new Error('REAR_SHIP_CLIFF_REPLAY_REQUIRED');}
 const rear=report.version==='west-rail-ship-headland-retreat-5'?clipRearShipVolume(first.geometry,{toChart,...r.rearVolumeCut}):clipShipHeadlandGeometry(first.geometry,{toChart,castleMatrix,seaAt:createCastleOceanSampler(castleMatrix,r.radius),rearRadialCut:true,protectedWorldBoxes:boxes(r.protectedWorldBoxes)});
 first.geometry.dispose();
 if(!['west-rail-ship-headland-retreat-4','west-rail-ship-headland-retreat-5'].includes(report.version))return rear;
 if(report.version==='west-rail-ship-headland-retreat-5'&&(!r.rearVolumeCut||r.rearVolumeCut.x!==18||r.rearVolumeCut.z!==-10||!rear.report.closedCutContours)){rear.geometry.dispose();throw new Error('REAR_SHIP_VOLUME_REPLAY_REQUIRED');}
 if(r.horseSideRadialCliff!==true){rear.geometry.dispose();throw new Error('HORSE_SIDE_CLIFF_REPLAY_REQUIRED');}
 const horse=reshapeHorseSideRadialCliff(rear.geometry,{toChart,castleMatrix,enabled:true});rear.geometry.dispose();return horse;
}
