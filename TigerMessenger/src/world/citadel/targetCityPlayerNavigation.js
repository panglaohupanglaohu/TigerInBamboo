import * as T from 'three';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';
const below=(o,root)=>{for(let p=o;p;p=p.parent)if(p===root)return true;return false;};
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
/** Production wiring around the candidate's borrowed support provider. No player
 * teleport or global collision replacement. This layer owns only terrain query
 * resources; runtime/candidate owns support.dispose(). refresh after terrain edits.
 */
export function createTargetCityPlayerNavigation({runtime,castle,finalTerrain,legacyCitadelPosition,legacyColliders=[]}={}){
 if(!runtime?.getPlayerSupport||!castle?.isObject3D||!Array.isArray(finalTerrain)||!finalTerrain.length)throw new TypeError('runtime, castle and final terrain required');
 const provider=runtime.getPlayerSupport(),material=new T.MeshBasicMaterial({side:T.DoubleSide});
 let records=[],disposed=false,lastTerrain=null,cameraRecords=[],cameraRevision=-1,terrainRevision=0;
 const report={version:'target-city-player-navigation-1',installed:true,continuousRouteVerified:false,legacyProxyRemoved:0,terrainQueries:0,terrainHits:0,scope:'candidate public floors/walls and actual final terrain; remaining world uses original collision',limitations:['Finite body rays retain provider limitations; continuous bookshop-to-city journey not yet tested.','No ceiling collision or spawn-inside recovery; neither tram routing nor moving-actor avoidance is implemented.','Terrain fallback samples actual upward-facing triangles only; private roofs never become an airborne landing target.']};
 // The original messenger scene creates precisely one untagged 6m proxy here.
 // Match its identity once; never suppress unrelated colliders by region/radius.
 const matches=legacyCitadelPosition?.isVector3?legacyColliders.filter(c=>c.radius===6&&!c.kind&&c.position?.isVector3&&c.position.distanceToSquared(legacyCitadelPosition)<1e-12):[];
 const obsoleteProxy=matches.length===1?matches[0]:null;report.legacyProxyRemoved=obsoleteProxy?1:0;report.legacyProxyAmbiguous=matches.length>1;
 function active(){return !disposed&&runtime.report?.installed===true&&runtime.root?.parent===castle;}
 function refresh(){
  if(disposed)throw new Error('navigation disposed');castle.updateWorldMatrix(true,true);
  records=finalTerrain.map(source=>{if(!source?.isMesh||!below(source,castle)||!source.geometry?.attributes.position)throw new TypeError('final terrain must be a castle mesh');source.geometry.computeBoundingBox();const box=source.geometry.boundingBox.clone().applyMatrix4(source.matrixWorld),sphere=box.getBoundingSphere(new T.Sphere()),proxy=new T.Mesh(source.geometry,material);proxy.matrixAutoUpdate=false;proxy.matrixWorld.copy(source.matrixWorld);return{source,index:buildMountainSurfaceIndex([proxy]),normal:new T.Matrix3().getNormalMatrix(source.matrixWorld),farRadius:sphere.center.length()+sphere.radius+1};});
  terrainRevision++;return report;
 }
 // Synchronous binding for a terrain-owner transaction. Both the borrowed
 // public support cache and radial airborne fallback must move together.
 function prepareTerrainRefresh(){
  if(disposed)throw new Error('navigation disposed');
  if(typeof provider.prepareRefresh!=='function')throw new Error('support provider requires transactional refresh');
  const supportBinding=provider.prepareRefresh(),before={records,lastTerrain,cameraRecords,cameraRevision,terrainRevision};
  let state='prepared';
  function restore(){({records,lastTerrain,cameraRecords,cameraRevision,terrainRevision}=before);}
  return{
   commit(){
    if(state!=='prepared')throw new Error('navigation refresh transaction is not prepared');
    if(disposed||terrainRevision!==before.terrainRevision)throw new Error('navigation cache changed after preparation');
    try{supportBinding.commit();refresh();lastTerrain=null;cameraRecords=[];cameraRevision=-1;state='committed';return true;}
    catch(error){supportBinding.rollback();restore();state='rolled-back';throw error;}
   },
   rollback(){
    if(state==='rolled-back')return;
    if(disposed)throw new Error('navigation disposed during rollback');
    if(state==='committed'&&terrainRevision!==before.terrainRevision+1)throw new Error('navigation cache changed after commit');
    supportBinding.rollback();if(state==='committed')restore();state='rolled-back';
   }
  };
 }
 function terrainGround(position){
  lastTerrain=null;if(!active()||!position?.isVector3||position.lengthSq()<1||![position.x,position.y,position.z].every(Number.isFinite))return null;
  const up=position.clone().normalize();let best=null;report.terrainQueries++;
  for(const r of records){if(!visible(r.source)||!below(r.source,castle))continue;const ray=new T.Ray(up.clone().multiplyScalar(r.farRadius),up.clone().negate());const hit=r.index.sample(ray,0,r.farRadius,h=>h.point.dot(up)>0&&h.face.normal.clone().applyMatrix3(r.normal).normalize().dot(up)>.5);if(hit&&(!best||hit.point.length()>best.radius))best={mesh:r.source.name,radius:hit.point.length(),world:hit.point.toArray()};}
  if(best){lastTerrain=best;report.terrainHits++;return best.radius;}return null;
 }
 function ground(position){if(!active())return null;return provider.ground(position)??terrainGround(position);}
 function walls(previous,position,velocity){return active()?provider.walls(previous,position,velocity):false;}
 function platformsForPhysics(platforms){if(!active())return platforms;return platforms.filter(p=>!p.mesh||!below(p.mesh,castle)||visible(p.mesh));}
 function collidersForPhysics(colliders){if(!active()||!obsoleteProxy)return colliders;return colliders.filter(c=>c!==obsoleteProxy);}
 function cameraOccluders(position,reach){
  if(!active()||!position)return[];
  const revision=provider.report().revision;
  if(cameraRevision!==revision){cameraRecords=[];runtime.root.updateWorldMatrix(true,true);runtime.root.traverse(o=>{if(o.isMesh&&!o.userData.skipColliders&&!/cloud|mist|water|grass|foliage/.test(o.name))cameraRecords.push({mesh:o,box:new T.Box3().setFromObject(o)});});cameraRevision=revision;}
  return cameraRecords.filter(r=>visible(r.mesh)&&below(r.mesh,runtime.root)&&r.box.distanceToPoint(position)<reach).map(r=>r.mesh);
 }
 try{refresh();}catch(error){material.dispose();throw error;}
 return{ground,walls,terrainGround,platformsForPhysics,collidersForPhysics,cameraOccluders,refresh,prepareTerrainRefresh,report,get active(){return active();},get lastTerrain(){return lastTerrain;},dispose(){if(disposed)return;disposed=true;records=[];cameraRecords=[];material.dispose();report.installed=false;}};
}
