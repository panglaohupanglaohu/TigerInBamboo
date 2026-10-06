import * as T from 'three';
import {createTargetForestCompanions} from './targetForestCompanions.js';
const key=p=>`${p.kind}:${p.anchor.name}:${p.anchor.index}`;
const height=(fn,x,z)=>{const v=fn(x,z);return typeof v==='number'?v:v?.height;};
const names={cypress:'target-companion-cypress',shrub:'target-companion-shrubs'};
/** Default-off consumer transaction. Prepare AFTER vegetation.apply(), while its
 * remapped instances and the replacement final surface are installed. Keep the
 * original factory group/meshes/resources so its private dispose closure remains
 * valid. Roll back this transaction before its parent vegetation transaction. */
export function prepareEastCliffCompanionRefresh({enabled=false,castle,candidateRoot,vegetationReport,sampleTerrain,sampleSea,surfaces=[]}={}){
 const report={version:'east-cliff-companion-refresh-1',enabled,ready:false,applied:false,accepted:false,failures:[],remappedAnchors:[],retiredAnchors:[],limitations:['Original factory finite footprint samples and conservative envelopes; not continuous terrain certification.','Prepare after vegetation apply; rollback before vegetation rollback or candidate editing/disposal.','Navigation and cloud caches are not updated.']};
 let staged=null,committed=false,disposed=false;
 const api={report,commit,apply:commit,rollback,dispose(){rollback();disposed=true;}};
 if(!enabled)return api;
 if(!castle?.isObject3D||!candidateRoot?.isObject3D||!vegetationReport?.applied||typeof sampleTerrain!=='function'||typeof sampleSea!=='function'){report.failures.push('applied vegetation and actual surface samplers required');return api;}
 const original=candidateRoot.getObjectByName('target-forest-companions'),oldReport=original?.userData.forestCompanionsReport;
 if(!original||!oldReport?.placements){report.failures.push('original companion group/report missing');return api;}
 const owner=candidateRoot.userData.detailCandidateReport;
 if(owner&&owner.forestCompanions!==oldReport){report.failures.push('candidate companion report alias differs');return api;}
 castle.updateWorldMatrix(true,true);
 const remaps=new Map((vegetationReport.instanceRemap||[]).map(r=>[r.name,r]));
 for(const r of remaps.values()){const m=castle.getObjectByProperty('uuid',r.uuid);if(!m||m.count!==r.after){report.failures.push(`remap not installed: ${r.name}`);return api;}}
 const hidden=new Set(),hiddenRows=[],kindIndex={cypress:0,shrub:0};
 for(const p of oldReport.placements){const m=original.getObjectByName(names[p.kind]);if(!m){report.failures.push(`missing companion bucket ${p.kind}`);return api;}const i=kindIndex[p.kind]++,matrix=new T.Matrix4();m.getMatrixAt(i,matrix);const r=remaps.get(p.anchor.name),mapped=r?r.oldToNew[p.anchor.index]:p.anchor.index;
  if(mapped===undefined){report.failures.push('anchor outside supplied remap');return api;}
  if(mapped===null)report.retiredAnchors.push({kind:p.kind,anchor:p.anchor});else report.remappedAnchors.push({kind:p.kind,from:p.anchor,to:{name:p.anchor.name,index:mapped}});
  if(Math.abs(matrix.determinant())<1e-12){const row={...p,anchor:{...p.anchor,index:mapped},active:false,hiddenZeroScale:true,sourceAnchor:p.anchor,sourceBucketIndex:i,matrix:matrix.toArray()};hiddenRows.push(row);if(mapped!==null)hidden.add(key(row));}
 }
 // A read-only detached structural view excludes the old companion meshes.
 // Its root is world-space; shared source geometries/materials are never freed.
 function clone(o){
  // Object3D.clone JSON-serializes userData; the live candidate handle contains
  // a root back-reference. This read-only geometry view never copies handles.
  const c=o.isInstancedMesh?new T.InstancedMesh(o.geometry,o.material,0):o.isMesh?new T.Mesh(o.geometry,o.material):new T.Object3D();
  c.name=o.name;c.visible=o.visible;c.position.copy(o.position);c.quaternion.copy(o.quaternion);c.scale.copy(o.scale);c.matrix.copy(o.matrix);c.matrixAutoUpdate=o.matrixAutoUpdate;c.layers.mask=o.layers.mask;
  if(o.isInstancedMesh){c.instanceMatrix=o.instanceMatrix;c.instanceColor=o.instanceColor;c.count=o.count;}
  for(const child of o.children)if(child!==original)c.add(clone(child));return c;
 }
 const view=clone(candidateRoot);view.matrix.copy(candidateRoot.matrixWorld);view.matrixAutoUpdate=false;view.updateWorldMatrix(false,true);
 const fresh=createTargetForestCompanions({castle,candidateRoot:view,sampleTerrain,sampleSea,maxCypress:oldReport.budgets?.maxCypress??24,maxShrubs:oldReport.budgets?.maxShrubs??80});
 const rows=fresh.report.placements.filter(p=>!hidden.has(key(p)));
 // Independently recheck final roots; unavailable water cannot silently produce
 // a replacement scene with zero greenery and a successful transaction.
 for(const p of rows){const h=height(sampleTerrain,p.position[0],p.position[2]),sea=height(sampleSea,p.position[0],p.position[2]);if(!Number.isFinite(h)||!Number.isFinite(sea)||p.position[1]>h+.002||h-p.position[1]>.20)report.failures.push('new companion root unsupported');}
 if(!rows.length&&oldReport.placements.length)report.failures.push('no legal replacement companions; refusing empty rebuild');
 const buckets=[];
 for(const [kind,name]of Object.entries(names)){
  const selected=rows.filter(p=>p.kind===kind),zeros=hiddenRows.filter(p=>p.kind===kind),all=[...selected,...zeros];
  for(const bucketName of kind==='cypress'?[name,'target-companion-trunks']:[name]){
   const mesh=original.getObjectByName(bucketName);if(!mesh){if(all.length)report.failures.push(`missing original bucket ${bucketName}`);continue;}
   const array=new Float32Array(Math.max(1,all.length)*16),toMesh=mesh.matrixWorld.clone().invert().multiply(castle.matrixWorld);all.forEach((p,i)=>{const m=new T.Matrix4().fromArray(p.matrix);if(!p.hiddenZeroScale)m.premultiply(toMesh);array.set(m.elements,i*16);});
   const attr=new T.InstancedBufferAttribute(array,16);attr.setUsage(mesh.instanceMatrix.usage);
   // Preserve hidden instance colors by source order; newly regenerated entries
   // use white rather than indexing stale former instance colors.
   let colors=null;if(mesh.instanceColor){colors=new T.InstancedBufferAttribute(new Float32Array(Math.max(1,all.length)*3).fill(1),3);zeros.forEach((p,i)=>colors.array.set(mesh.instanceColor.array.subarray(p.sourceBucketIndex*3,p.sourceBucketIndex*3+3),(selected.length+i)*3));}
   buckets.push({mesh,attr,colors,count:all.length,old:{matrix:mesh.instanceMatrix,color:mesh.instanceColor,count:mesh.count,box:mesh.boundingBox,sphere:mesh.boundingSphere}});
  }
 }
 for(const p of rows){const anchor=castle.getObjectByName(p.anchor.name),m=new T.Matrix4();anchor.getMatrixAt(p.anchor.index,m);p.anchor={...p.anchor,meshUUID:anchor.uuid,matrix:m.toArray(),worldMatrix:anchor.matrixWorld.clone().multiply(m).toArray()};}
 const nextReport={...fresh.report,placements:[...rows.filter(p=>p.kind==='cypress'),...hiddenRows.filter(p=>p.kind==='cypress'),...rows.filter(p=>p.kind==='shrub'),...hiddenRows.filter(p=>p.kind==='shrub')],counts:{cypress:rows.filter(p=>p.kind==='cypress').length,shrub:rows.filter(p=>p.kind==='shrub').length},eastCliffRefresh:{version:report.version,instanceRemap:vegetationReport.instanceRemap,hiddenSlots:hiddenRows.length,sourceReportPreserved:true}};
 fresh.dispose();
 if(report.failures.length)return api;
 // Record every source that affected factory placement: trees, actor geometry,
 // public structures and explicit terrain. Also include cloud swept metadata.
 function epoch(){castle.updateWorldMatrix(true,true);const entries=[];const visit=o=>{entries.push([o.uuid,o.parent?.uuid,o.visible,o.matrixWorld.elements.slice()]);if(o.isMesh)entries.push([o.uuid,o.visible,o.matrixWorld.elements.slice(),o.geometry?.uuid,o.geometry?.attributes.position?.version,o.count??null,o.instanceMatrix?Array.from(o.instanceMatrix.array):null]);if(o.userData.cloudBankStudy)entries.push([o.uuid,o.userData.cloudBankStudy]);};castle.traverse(visit);for(const s of surfaces)if(!castle.getObjectByProperty('uuid',s.uuid)){s.updateWorldMatrix(true,false);visit(s);}return JSON.stringify(entries);}
 const beforeEpoch=epoch(),beforeMetadata=JSON.stringify(oldReport);
 staged={original,oldReport,owner,nextReport,buckets,epoch,beforeEpoch,beforeMetadata};report.ready=true;report.beforeCounts=oldReport.counts;report.afterCounts=nextReport.counts;report.hiddenSlots=hiddenRows.length;report.groupUUID=original.uuid;report.preservedResources=buckets.map(b=>({meshUUID:b.mesh.uuid,geometryUUID:b.mesh.geometry.uuid,materialUUID:b.mesh.material.uuid}));report.rebuilt=true;
 return api;
 function commit(){if(disposed||!report.ready)return false;if(committed)return true;const s=staged;if(s.original.userData.forestCompanionsReport!==s.oldReport||(s.owner&&s.owner.forestCompanions!==s.oldReport)||JSON.stringify(s.oldReport)!==s.beforeMetadata||s.epoch()!==s.beforeEpoch||!vegetationReport.applied){report.failures.push('companion/source epoch changed since prepare');report.ready=false;return false;}
  for(const b of s.buckets){b.mesh.instanceMatrix=b.attr;b.mesh.instanceColor=b.colors;b.mesh.count=b.count;b.mesh.computeBoundingBox();b.mesh.computeBoundingSphere();}
  s.original.userData.forestCompanionsReport=s.nextReport;if(s.owner)s.owner.forestCompanions=s.nextReport;committed=true;report.applied=true;return true;
 }
 function rollback(){if(!committed)return;for(const b of staged.buckets){b.mesh.instanceMatrix=b.old.matrix;b.mesh.instanceColor=b.old.color;b.mesh.count=b.old.count;b.mesh.boundingBox=b.old.box;b.mesh.boundingSphere=b.old.sphere;}staged.original.userData.forestCompanionsReport=staged.oldReport;if(staged.owner)staged.owner.forestCompanions=staged.oldReport;committed=false;report.applied=false;report.restored=true;}
}
