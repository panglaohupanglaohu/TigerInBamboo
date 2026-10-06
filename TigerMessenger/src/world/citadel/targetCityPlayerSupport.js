import * as THREE from 'three';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';
import {PLAYER_RADIUS,PLAYER_HEIGHT} from '../../core/constants.js';

export const TARGET_CITY_PLAYER_SUPPORT_VERSION='target-city-player-support-2';
const finite=v=>v?.isVector3&&[v.x,v.y,v.z].every(Number.isFinite);
const below=(object,root)=>{for(let o=object;o;o=o.parent)if(o===root)return true;return false;};
const visible=object=>{for(let o=object;o;o=o.parent)if(!o.visible)return false;return true;};
const roofLike=/(?:^|[-_])(?:roof|dome|cupola|ceiling|cornice|coping|parapet|handrail|baluster|lantern|finial|ridge|drip-edge)(?:[-_]|$)/i;
const nonSolid=/cloud|mist|spray|foam|ripple|water-sheet|water-surface|water-flow|canopy|foliage|leaves|grass|turf/i;
const builtInPublic=/^(main-hall-floor|entrance-landing|entrance-stair-\d+|gate-approach|central-step-\d+|upper-street-landing|terrace-\d+-[-\d]+(?:-deck)?|surveyed-route-tread-\d+)$/;
/** Read-only candidate adapter, NOT installed into main.js or a navigation system.
 * ground(worldFeet) -> world radius|null follows playerGround.js; walls(previous,
 * proposedFeet,velocity) mutates the latter two and returns whether blocked.
 * Call refresh() after geometry, transforms, instance transforms, or WFC asset
 * replacement. Visibility/detachment changes are checked on every query.
 * dispose() releases query material only; candidate/terrain remain caller-owned.
 * Walls use finite swept body rays, not an exact capsule/triangle manifold.
 */
export function createTargetCityPlayerSupport({castle,candidateRoot,finalTerrain,maxStepUp=.4,maxDrop=3,playerRadius=PLAYER_RADIUS,playerHeight=PLAYER_HEIGHT,maxSweep=8}={}){
 if(!castle?.isObject3D||!candidateRoot?.isObject3D)throw new TypeError('castle and candidateRoot Object3D required');
 for(const[k,v]of Object.entries({maxStepUp,maxDrop,playerRadius,playerHeight,maxSweep}))if(!Number.isFinite(v)||v<=0)throw new RangeError(`${k} must be finite and positive`);
 if(maxStepUp+.05>=playerHeight)throw new RangeError('step height must leave standing body samples');
 let root=candidateRoot,terrain=finalTerrain,records=[],disposed=false,revision=0,unsupported=[],lastWall=null,lastGround=null;
 const queryMaterial=new THREE.MeshBasicMaterial({side:THREE.DoubleSide}),ray=new THREE.Raycaster(),up=new THREE.Vector3(),direction=new THREE.Vector3(),normal=new THREE.Vector3();ray.layers.enableAll();
 function terrainRoots(){const roots=Array.isArray(terrain)?terrain:[terrain];if(!roots.length||roots.some(o=>!o?.isObject3D))throw new TypeError('finalTerrain requires explicit Object3D or nonempty array');return roots;}
 function active(r){return visible(r.source)&&below(r.source,r.owner)&&below(r.owner,castle)&&!r.source.userData.targetSupportDisabled;}
 function materialVisible(r,hit){const m=Array.isArray(r.source.material)?r.source.material[hit.face?.materialIndex??0]:r.source.material;return !!m&&m.visible!==false&&(m.opacity??1)>.01;}
 function hits(near,origin,dir,far,accept){ray.set(origin,dir);ray.far=far;ray.near=0;const results=[];for(const r of near){if(!active(r))continue;const valid=hit=>materialVisible(r,hit)&&accept(hit,r);if(r.index){const hit=r.index.sample(ray.ray,0,far,valid);if(hit)results.push({hit,record:r});}else for(const hit of ray.intersectObject(r.proxy,false))if(valid(hit))results.push({hit,record:r});}return results.sort((a,b)=>a.hit.distance-b.hit.distance);}
 function isFloor(hit,r){if(!hit.face)return false;normal.copy(hit.face.normal).applyMatrix3(r.normalMatrix).normalize();return normal.dot(up)>.5;}
 function isWall(hit,r){if(!hit.face)return false;normal.copy(hit.face.normal).applyMatrix3(r.normalMatrix).normalize();return Math.abs(normal.dot(up))<=.7;}

 function refresh(options={}){
  if(disposed)throw new Error('support adapter disposed');if(options.candidateRoot!==undefined){if(!options.candidateRoot?.isObject3D)throw new TypeError('invalid candidateRoot');root=options.candidateRoot;}if(options.finalTerrain!==undefined)terrain=options.finalTerrain;
  const terrains=terrainRoots();if(!below(root,castle)||terrains.some(t=>!below(t,castle)))throw new Error('candidate and final terrain must belong to castle');castle.updateWorldMatrix(true,true);
  const publicNames=new Set();root.traverse(o=>{for(const key of['targetArchitectureReport','stairCandidateReport','bridgeCandidateReport','connectorReport']){const report=o.userData?.[key];for(const row of[...(report?.walkSurfaces??[]),...(report?.walkable??[])])if(typeof row.id==='string'){publicNames.add(row.id);publicNames.add(row.id+'-deck');}for(const fp of report?.footprints??[])if(fp.walkable===true)publicNames.add(fp.id);}});
  const next=[],skipped=[],seen=new Set();
  function collect(owner,isTerrain){owner.traverse(source=>{
   if(!source.isMesh||seen.has(source))return;seen.add(source);
   if(source.isSkinnedMesh||source.morphTargetInfluences?.length){skipped.push({name:source.name,reason:'animated geometry requires dedicated collider'});return;}
   if(!source.geometry?.attributes.position)return;
   if(!isTerrain){for(let p=source;p&&p!==root;p=p.parent)if(nonSolid.test(p.name))return;}
   const walkable=isTerrain||(!roofLike.test(source.name)&&(source.userData.targetWalkable===true||source.userData.westCityWalkable===true||publicNames.has(source.name)||builtInPublic.test(source.name)));
   source.geometry.computeBoundingBox();const instances=source.isInstancedMesh?source.count:1;
   for(let i=0;i<instances;i++){const proxy=new THREE.Mesh(source.geometry,queryMaterial);proxy.matrixAutoUpdate=false;proxy.matrixWorld.copy(source.matrixWorld);if(source.isInstancedMesh){const m=new THREE.Matrix4();source.getMatrixAt(i,m);proxy.matrixWorld.multiply(m);}const box=source.geometry.boundingBox.clone().applyMatrix4(proxy.matrixWorld);next.push({source,owner,isTerrain,walkable,proxy,box,instanceId:source.isInstancedMesh?i:null,normalMatrix:new THREE.Matrix3().getNormalMatrix(proxy.matrixWorld),index:(source.geometry.index?.count??source.geometry.attributes.position.count)>6000?buildMountainSurfaceIndex([proxy]):null});}
  });}
  terrains.forEach(t=>collect(t,true));collect(root,false);records=next;unsupported=skipped;revision++;return report();
 }
 function ground(position){
  lastGround=null;
  if(disposed||!finite(position)||position.lengthSq()<1)return null;up.copy(position).normalize();const origin=position.clone().addScaledVector(up,maxStepUp),dir=up.clone().negate();const range=maxStepUp+maxDrop;
  const near=records.filter(r=>r.walkable&&r.box.distanceToPoint(position)<=range);
  for(const{hit,record}of hits(near,origin,dir,range,isFloor)){if(!hit.face)continue;normal.copy(hit.face.normal).applyMatrix3(record.normalMatrix).normalize();if(normal.dot(up)>.5){lastGround={mesh:record.source.name,faceIndex:hit.faceIndex,instanceId:record.instanceId,world:hit.point.toArray(),radius:hit.point.length()};return lastGround.radius;}}return null;
 }
 function walls(previous,position,velocity){
  lastWall=null;if(disposed||!finite(previous)||!finite(position)||!finite(velocity)||previous.lengthSq()<1)return false;
  up.copy(previous).normalize();const motion=position.clone().sub(previous);motion.addScaledVector(up,-motion.dot(up));const length=motion.length();if(length<1e-7)return false;
  const near=records.filter(r=>active(r)&&r.box.distanceToPoint(previous)<=length+playerHeight+playerRadius);if(!near.length)return false;
  if(length>maxSweep){position.copy(previous);velocity.set(0,0,0);lastWall={reason:'sweep-budget-exceeded',requested:length,limit:maxSweep};return true;}
  direction.copy(motion).multiplyScalar(1/length);const side=new THREE.Vector3().crossVectors(up,direction).normalize();
  let allowed=length,block=null;
  // Five lateral samples use their own circular forward reach. Low risers are
  // stepped by ground(); vertical walls at standing heights remain collidable.
  const heights=[maxStepUp+.05,(maxStepUp+playerHeight)/2,playerHeight-.08];
  for(const height of heights)for(const offset of[-1,-.5,0,.5,1]){
   const lateral=offset*playerRadius,reach=Math.sqrt(Math.max(0,playerRadius*playerRadius-lateral*lateral)),origin=previous.clone().addScaledVector(up,height).addScaledVector(side,lateral);
   for(const{hit,record}of hits(near,origin,direction,length+reach+.015,isWall)){
    if(!hit.face)continue;normal.copy(hit.face.normal).applyMatrix3(record.normalMatrix).normalize();if(Math.abs(normal.dot(up))>.7)continue;
    const travel=Math.max(0,hit.distance-reach-.015);if(travel<allowed){allowed=travel;block={mesh:record.source.name,instanceId:record.instanceId,point:hit.point.toArray(),sampleHeight:height};}break;
   }
  }
  if(allowed>=length)return false;position.addScaledVector(direction,allowed-length);const into=velocity.dot(direction);if(into>0)velocity.addScaledVector(direction,-into);lastWall={reason:'geometry-contact',allowed,requested:length,...block};return true;
 }
 // Capture the borrowed query cache, not the geometry owner. The terrain
 // transaction swaps geometry before commit and restores it after rollback.
 // Rebuilding during rollback would therefore read the wrong terrain epoch.
 function prepareRefresh(options={}){
  if(disposed)throw new Error('support adapter disposed');
  const before={root,terrain,records,revision,unsupported,lastWall,lastGround};
  let state='prepared';
  function restore(){({root,terrain,records,revision,unsupported,lastWall,lastGround}=before);}
  return{
   commit(){
    if(state!=='prepared')throw new Error('support refresh transaction is not prepared');
    if(disposed||revision!==before.revision)throw new Error('support cache changed after preparation');
    try{refresh(options);state='committed';return true;}catch(error){restore();state='rolled-back';throw error;}
   },
   rollback(){
    if(state==='rolled-back')return;
    if(disposed)throw new Error('support adapter disposed during rollback');
    if(state==='committed'&&revision!==before.revision+1)throw new Error('support cache changed after commit');
    if(state==='committed')restore();state='rolled-back';
   }
  };
 }
 function report(){return{version:TARGET_CITY_PLAYER_SUPPORT_VERSION,revision,disposed,sourceMeshes:new Set(records.map(r=>r.source)).size,queryInstances:records.length,indexedInstances:records.filter(r=>r.index).length,walkableInstances:records.filter(r=>r.walkable).length,terrainInstances:records.filter(r=>r.isTerrain).length,unsupported:[...unsupported],lastGround:lastGround?{...lastGround}:null,lastWall:lastWall?{...lastWall}:null,contract:{ground:'world radius or null',walls:'mutates proposed feet/velocity and returns boolean',maxStepUp,maxDrop,playerRadius,playerHeight,maxSweep},productionInstalled:false,navigationComplete:false,limitations:['Static geometry/instance transforms require refresh after changes; visibility and detachment are live.','Only registered public surfaces and explicit finalTerrain support feet; residential roofs and private terraces are excluded.','Finite 15-ray body sweep is not exact capsule contact: very small obstacles between samples, spawn-inside recovery, ceilings, moving geometry and wall sliding are not solved.','Mesh bounds only filter queries; actual double-sided triangles decide contacts, preserving true arches.','Dense geometry uses exact world BVH with face-predicate traversal; small meshes use Raycaster. Runtime still requires profiling.','World origin is the sphere centre, matching the existing player radius contract; no floating-origin support.']};}
 try{refresh();}catch(error){queryMaterial.dispose();throw error;}return{ground,sampleGroundRadius:ground,walls,resolveWalls:walls,refresh,prepareRefresh,report,dispose(){if(disposed)return;disposed=true;records=[];queryMaterial.dispose();}};
}
