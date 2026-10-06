import * as T from 'three';
import {surveyTargetCityLandmarks,applyTargetCityLandmarksCandidate} from './targetCityLandmarksCandidate.js?revision=statue-front-2';
import {createTargetStairSurfaceSampler} from './targetNewCityStairRoute.js';
import {rangeWorldToLocal} from '../citadelRange.js';
const v=a=>new T.Vector3(...a);
const live=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
/** Finite walking-width/height probes, NOT a continuous swept-volume proof. */
export function integrateTargetCityLandmarks({castle,sceneRoot,range,detailCandidate,terrainMeshes,worldToRange=rangeWorldToLocal}={}){
 const report={version:'target-landmark-integration-1',ok:false,failures:[],route:[],forestRemoved:[],validation:'0.5m centreline, three lateral support/head probes; finite rays, not continuous collision certification'};
 const reject=reason=>({ok:false,reason,report});
 const detail=detailCandidate?.root||detailCandidate?.group,dr=detailCandidate?.report;
 const sr=dr?.newCityStairs?.surveyed;if(!detail||!sr?.selected?.treads?.length)return reject('missing-surveyed-stairs');
 castle.updateWorldMatrix(true,true);sceneRoot?.updateWorldMatrix(true,true);
 const terrain=terrainMeshes||((dr.sourceSurfaces?.terrain||[]).map(s=>castle.getObjectByName(typeof s==='string'?s:s.name)).filter(Boolean));
 if(!terrain.length){const m=castle.getObjectByName('citadel-oskar-grid-mountain-surface');if(m)terrain.push(m);}
 const survey=surveyTargetCityLandmarks({castle,range,terrainMeshes:terrain,stairRouteReport:sr});report.survey=survey;if(!survey.ready)return reject('landmark-survey-not-ready');
 const supports=[...terrain],obstacles=[];detail.traverse(o=>{if(o.isMesh){obstacles.push(o);if(/^(?:surveyed-route-(?:tread-|turn-platform|entry)|entrance-stair-|entrance-landing)/.test(o.name))supports.push(o);}});
 const sample=createTargetStairSurfaceSampler(castle,supports),horse=survey.candidates.horse.selected.position,statue=survey.candidates.statue.selected.position;
 // Match the migration module's actual 49-point horse paving top exactly.
 const pavingHeights=[];for(const ratio of[0,.5,1])for(let i=0;i<(ratio?24:1);i++){const h=sample(horse[0]+3.2*ratio*Math.cos(i*Math.PI/12),horse[2]+3.2*ratio*Math.sin(i*Math.PI/12));if(!h)return reject('horse-paving-support-miss');pavingHeights.push(h.height);}
 const pavingTop=Math.max(...pavingHeights)+.06;report.horsePavingTop=pavingTop;
 const end=sr.end,entry=dr.newCity.geometry.entry.position,yaw=dr.newCity.yawDegrees*Math.PI/180,np=dr.newCity.position;
 const entryLocal=[np[0]+entry[0]*Math.cos(yaw)+entry[2]*Math.sin(yaw),np[1]+entry[1],np[2]-entry[0]*Math.sin(yaw)+entry[2]*Math.cos(yaw)];
 const walking=sr.selected.walkPath||[sr.start,...sr.selected.treads.map(t=>[t.x,t.top,t.z]),end];
 if(!walking.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))return reject('invalid-walk-path');
 report.walkPathSource=sr.selected.walkPath?'selected.walkPath':'legacy-tread-centres';
 const mainWalk=dr.newCity.geometry.stairs?.walkPath;
 if(mainWalk&&!mainWalk.every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))return reject('invalid-main-step-path');
 const mainPoints=mainWalk?mainWalk.map(p=>[np[0]+p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw),np[1]+p[1],np[2]-p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw)]):[entryLocal];
 report.mainWalkPathSource=mainWalk?'geometry.stairs.walkPath':'legacy-direct-entry';
 const points=[horse,[Math.max(horse[0],statue[0]+6),horse[1],68],...walking.slice().reverse(),...mainPoints];
 const rows=[];for(let i=1;i<points.length;i++){const a=v(points[i-1]),b=v(points[i]),dist=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(1,Math.ceil(dist/.5));for(let j=0;j<=n;j++){
  const p=a.clone().lerp(b,j/n),dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,feet=[];
  for(const side of[-.45,0,.45]){const x=p.x-dz/len*side,z=p.z+dx/len*side,h=sample(x,z);feet.push({x,z,height:h? (Math.hypot(x-horse[0],z-horse[2])<=3.2?pavingTop:h.height):null});}
  if(feet.some(f=>!Number.isFinite(f.height))){report.failures.push({kind:'support-miss',point:p.toArray()});continue;}
  const h=Math.max(...feet.map(f=>f.height));if(Math.abs(h-p.y)>.42||Math.max(...feet.map(f=>f.height))-Math.min(...feet.map(f=>f.height))>.3)report.failures.push({kind:'support-step-or-gap',point:p.toArray(),feet});
  if(Math.hypot(p.x-statue[0],p.z-statue[2])<2.8)report.failures.push({kind:'statue-clearance',point:p.toArray()});
  rows.push({position:[p.x,h,p.z],feet});
 }}
 report.route=rows;report.captureTarget=castle.localToWorld(v(entryLocal)).toArray();if(report.failures.length)return reject('route-support-rejected');
 // Only this candidate forest is removable; all other scene meshes remain obstacles.
 const canopy=castle.getObjectByName('citadel-mountain-canopy-candidate'),inst=[];canopy?.traverse(o=>{if(o.isInstancedMesh)inst.push(o);});
 const inv=castle.matrixWorld.clone().invert(),removeKeys=new Set(),saved=[],matrix=new T.Matrix4();
 const key=m=>m.elements.map(n=>n.toFixed(5)).join(',');
 for(const m of inst){m.geometry.computeBoundingBox();for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);const box=m.geometry.boundingBox.clone().applyMatrix4(inv.clone().multiply(m.matrixWorld).multiply(matrix));
  const overlaps=rows.some(r=>box.clone().expandByScalar(.65).containsPoint(v(r.position).add(new T.Vector3(0,1.2,0))))||[statue,horse].some((p,k)=>box.intersectsBox(new T.Box3(v([p[0]-(k?3.5:2.6),p[1],p[2]-(k?3.5:2.6)]),v([p[0]+(k?3.5:2.6),p[1]+8,p[2]+(k?3.5:2.6)]))));if(overlaps)removeKeys.add(key(matrix));}}
 for(const m of inst)for(let i=0;i<m.count;i++){m.getMatrixAt(i,matrix);if(removeKeys.has(key(matrix)))saved.push({mesh:m,index:i,matrix:matrix.clone()});}
 const removed=new Set(saved.map(r=>r.mesh.uuid+':'+r.index));
 const actorSet=new Set();for(const actor of[range.trojanHorse,castle.getObjectByName('citadel-plaza-hero-statue')])actor.traverse(o=>actorSet.add(o));
 const sceneMeshes=[];(sceneRoot||castle).traverse(o=>{if(o.isMesh&&live(o)&&!actorSet.has(o)&&!supports.includes(o)&&!o.userData.skipColliders&&!/cloud|grass|turf|water|ocean|outline/i.test(o.name))sceneMeshes.push(o);});
 // Include nonremoved candidate forest even though its render meshes skip global colliders.
 sceneMeshes.push(...inst);
 const landmarkBoxes=[statue,horse].map((p,i)=>new T.Box3(v([p[0]-(i?3.5:2.6),p[1]+.25,p[2]-(i?3.5:2.6)]),v([p[0]+(i?3.5:2.6),p[1]+(i?11:9),p[2]+(i?3.5:2.6)])));
 report.envelopeChecks=[];
 for(const m of sceneMeshes){
  const matrices=m.isInstancedMesh?Array.from({length:m.count},(_,i)=>{const t=new T.Matrix4();m.getMatrixAt(i,t);return {matrix:inv.clone().multiply(m.matrixWorld).multiply(t),index:i};}):[{matrix:inv.clone().multiply(m.matrixWorld),index:null}];
  m.geometry.computeBoundingBox();const p=m.geometry.attributes.position,idx=m.geometry.index;if(!p)continue;
  for(const instance of matrices){if(removed.has(m.uuid+':'+instance.index))continue;const b=m.geometry.boundingBox.clone().applyMatrix4(instance.matrix),boxes=landmarkBoxes.filter(l=>l.intersectsBox(b));if(!boxes.length)continue;
   const ancestors=[];for(let a=m;a;a=a.parent)ancestors.push({name:a.name,uuid:a.uuid});
   const audit={name:m.name,uuid:m.uuid,instance:instance.index,ancestors,material:(Array.isArray(m.material)?m.material:[m.material]).map(a=>({type:a?.type,name:a?.name,transparent:a?.transparent,depthTest:a?.depthTest})),broadphase:true,trianglesChecked:0,hitFace:null};
   const tri=new T.Triangle();for(let i=0,n=idx?idx.count:p.count;i<n;i+=3){tri.a.fromBufferAttribute(p,idx?idx.getX(i):i).applyMatrix4(instance.matrix);tri.b.fromBufferAttribute(p,idx?idx.getX(i+1):i+1).applyMatrix4(instance.matrix);tri.c.fromBufferAttribute(p,idx?idx.getX(i+2):i+2).applyMatrix4(instance.matrix);audit.trianglesChecked++;if(boxes.some(l=>l.intersectsTriangle(tri))){audit.hitFace=i/3;break;}}
   report.envelopeChecks.push(audit);if(audit.hitFace!==null)report.failures.push({kind:'landmark-envelope-triangle-obstacle',...audit});
  }
 }
 if(report.failures.length)return reject('landmark-obstacle-rejected');
 const ray=new T.Raycaster(),up=new T.Vector3(0,1,0).transformDirection(castle.matrixWorld),frame=castle.matrixWorld;
 for(let i=1;i<rows.length;i++)for(const h of[.55,1.2,1.8])for(const side of[-.4,0,.4]){const a=v(rows[i-1].position),b=v(rows[i].position),dir=b.clone().sub(a),len=Math.hypot(dir.x,dir.z)||1,offset=new T.Vector3(-dir.z/len*side,0,dir.x/len*side);a.add(offset).applyMatrix4(frame).addScaledVector(up,h);b.add(offset).applyMatrix4(frame).addScaledVector(up,h);const delta=b.clone().sub(a);if(delta.lengthSq()<1e-12)continue;ray.set(a,delta.clone().normalize());ray.far=delta.length();const hit=ray.intersectObjects(sceneMeshes,false).find(hit=>!removed.has(hit.object.uuid+':'+hit.instanceId));if(hit){report.failures.push({kind:'head-or-body-obstacle',name:hit.object.name,uuid:hit.object.uuid,point:hit.point.toArray()});break;}}
 if(report.failures.length)return reject('route-obstacle-rejected');
 const horseActor=range.trojanHorse,oldRange=horseActor.userData.rangeLocal,oldPlacement=horseActor.userData.placement;
 const toRange=worldToRange(castle.localToWorld(v(horse)));if(!Number.isFinite(toRange?.x)||!Number.isFinite(toRange?.z))return reject('range-coordinate-failed');
 const result=applyTargetCityLandmarksCandidate({castle,sceneRoot,range,terrainMeshes:terrain,clearanceVerified:true,routes:{stairRoute:rows.map(r=>castle.localToWorld(v(r.position))),waterfallRoute:[],captureTarget:castle.localToWorld(v(entryLocal))}});
 if(!result.ok)return reject('actor-transaction:'+result.reason);
 for(const s of saved)s.mesh.setMatrixAt(s.index,new T.Matrix4().makeScale(0,0,0));for(const m of inst){m.instanceMatrix.needsUpdate=true;m.computeBoundingBox();m.computeBoundingSphere();}
 const actual=horseActor.getWorldPosition(new T.Vector3()),localRange=worldToRange(actual);horseActor.userData.rangeLocal={lx:localRange.x,lz:localRange.z};horseActor.userData.placement={...oldPlacement,kind:'target-new-city-plaza-original-actor',castleLocal:castle.worldToLocal(actual.clone()).toArray(),yaw:survey.candidates.horse.selected.yaw};
 report.ok=true;report.forestAction='temporarily hidden via zero instance matrices; not relocated';report.forestRemoved=saved.map(s=>({uuid:s.mesh.uuid,index:s.index}));report.migration=result.report;
 return{ok:true,report,group:result.group,visibilityExemptions:result.visibilityExemptions,rollback(){const r=result.rollback();if(!r.ok)return r;for(const s of saved)s.mesh.setMatrixAt(s.index,s.matrix);for(const m of inst){m.instanceMatrix.needsUpdate=true;m.computeBoundingBox();m.computeBoundingSphere();}horseActor.userData.rangeLocal=oldRange;horseActor.userData.placement=oldPlacement;return{ok:true};}};
}
