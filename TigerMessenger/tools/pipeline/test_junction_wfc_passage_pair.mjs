import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as THREE from '../../vendor/three.module.js';
import {installEditableJunction,junctionRegionDefaults} from '../../src/world/canalJunctionEditable.js';
import {solveTownSelection} from '../../src/world/citadel/wfcTownSelection.js';
import {solveTownPassagePairs,PASSAGE_PAIR_CELLS} from '../../src/world/citadel/townPassagePairSelection.js';
import {PLAYER_HEIGHT,PLAYER_RADIUS} from '../../src/core/constants.js';
import {createJunctionPlayerSupport} from '../../src/world/canalJunctionTarget.js';
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),storage=()=>({getItem:()=>null});
function city(mode,s=storage()){const c=new THREE.Group();installEditableJunction(c,{wfcPassage:mode,storage:s});c.updateMatrixWorld(true);return c;}
const hash=(root,accept=()=>true)=>{const records=[];root.updateMatrixWorld(true);root.traverse(m=>{if(!m.isMesh||!accept(m))return;const h=createHash('sha256');h.update(m.name);for(const name of ['position','normal','uv','color']){const a=m.geometry.attributes[name]?.array;if(a)h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}if(m.geometry.index)h.update(new Uint8Array(m.geometry.index.array.buffer));h.update(JSON.stringify(m.matrixWorld.elements));records.push(h.digest('hex'));});return createHash('sha256').update(records.sort().join('|')).digest('hex');};
const before=city(1),c=city(2),e=c.userData.junctionEditor,b=before.userData.junctionEditor;
assert.deepEqual(e.snapshot(),b.snapshot());assert.equal(e.audit().regions.reduce((s,r)=>s+r.occupiedCount,0),398);
const regionId='left-mid-yellow',group=e.root.getObjectByName(regionId),base=b.root.getObjectByName(regionId),r=junctionRegionDefaults().find(r=>r.id===regionId),pairSet=new Set(PASSAGE_PAIR_CELLS);
const others=e.root.children.filter(o=>o!==group);for(const g of others)assert.equal(hash(g),hash(b.root.getObjectByName(g.name)),`non-target geometry changed ${g.name}`);
const isOther=m=>{const cell=m.userData.cell;if(cell&&pairSet.has(`${cell.ix},${cell.iy},${cell.iz}`))return false;return !(m.userData.cells||[]).some(c=>pairSet.has(typeof c==='string'?c:`${c.ix},${c.iy},${c.iz}`));};
assert.equal(hash(group,isOther),hash(base,isOther),'same-region cells outside the six owners changed');
const pairMeshes=[];group.traverse(m=>{if(m.userData.wfcPassagePair)pairMeshes.push(m);});assert.equal(pairMeshes.length,6);assert.equal(pairMeshes.filter(m=>m.userData.wfcPassage).length,3);
const grid=new Map();r.levels.forEach((rows,y)=>rows.forEach((row,z)=>[...row].forEach((v,x)=>{if(v!=='.')grid.set(`${x},${y},${z}`,v)})));
const solved=solveTownPassagePairs(grid,{seed:r.seed});assert(solved.ok);assert.equal(solved.hash,solveTownPassagePairs(grid,{seed:r.seed}).hash);
const original=solveTownSelection({grid,seed:r.seed});for(const[k,v]of Object.entries(solved.byCell))if(!pairSet.has(k))assert.deepEqual(v,original.byCell[k]);
for(const x of [0,1,2]){
 const lo=solved.byCell[`${x},0,1`],hi=solved.byCell[`${x},1,1`];assert.equal(lo.variant,'passage2.lower.x');assert.equal(hi.variant,'passage2.upper.x');
 const li=solved.compiled.variantIndex.get(lo.key),ui=solved.compiled.variantIndex.get(hi.key);assert(solved.table.isCompatible(li,'U',ui));
 const zi=solved.compiled.variantIndex.get('body.passage2.upper.z@r0');assert(!solved.table.isCompatible(li,'U',zi));
}
assert.equal(solveTownPassagePairs(grid,{seed:r.seed,pins:[{cell:'1,0,1',variant:'body.passage2.lower.x@r0'},{cell:'1,1,1',variant:'body.passage2.upper.z@r0'}]}).ok,false);
// Check closed triangle edges for each actual emitted solid, with no metadata shortcut.
let closedEdges=0;for(const mesh of pairMeshes){const p=mesh.geometry.attributes.position,idx=mesh.geometry.index,edges=new Map(),key=v=>v.toArray().map(n=>Math.round(n*1e6)).join(',');
 for(let i=0;i<(idx?.count??p.count);i+=3){const v=[0,1,2].map(k=>V().fromBufferAttribute(p,idx?idx.getX(i+k):i+k));assert(V().subVectors(v[1],v[0]).cross(V().subVectors(v[2],v[0])).length()>1e-8);for(let k=0;k<3;k++){const a=key(v[k]),b=key(v[(k+1)%3]),ek=[a,b].sort().join('|');edges.set(ek,(edges.get(ek)||0)+1);}}
 for(const n of edges.values())assert.equal(n,2);closedEdges+=edges.size;
}
// Independent exact segment-triangle distance. Triangle closest-point and all
// edge segment distances cover the interior, face and edge Voronoi regions.
function segmentDistance(p1,q1,p2,q2){const d1=q1.clone().sub(p1),d2=q2.clone().sub(p2),rr=p1.clone().sub(p2),a=d1.dot(d1),ee=d2.dot(d2),ff=d2.dot(rr);let s,t;if(a<1e-16&&ee<1e-16)return p1.distanceTo(p2);if(a<1e-16){s=0;t=THREE.MathUtils.clamp(ff/ee,0,1);}else{const cc=d1.dot(rr);if(ee<1e-16){t=0;s=THREE.MathUtils.clamp(-cc/a,0,1);}else{const bb=d1.dot(d2),den=a*ee-bb*bb;s=den?THREE.MathUtils.clamp((bb*ff-cc*ee)/den,0,1):0;t=(bb*s+ff)/ee;if(t<0){t=0;s=THREE.MathUtils.clamp(-cc/a,0,1);}else if(t>1){t=1;s=THREE.MathUtils.clamp((bb-cc)/a,0,1);}}}return p1.clone().addScaledVector(d1,s).distanceTo(p2.clone().addScaledVector(d2,t));}
function distanceToTriangle(a,b,t){const ab=b.clone().sub(a),ray=new THREE.Ray(a,ab.clone().normalize()),hit=ray.intersectTriangle(t.a,t.b,t.c,false,V());if(hit&&hit.distanceTo(a)<=ab.length()+1e-9)return 0;return Math.min(t.closestPointToPoint(a,V()).distanceTo(a),t.closestPointToPoint(b,V()).distanceTo(b),segmentDistance(a,b,t.a,t.b),segmentDistance(a,b,t.b,t.c),segmentDistance(a,b,t.c,t.a));}
assert(distanceToTriangle(V(0,-1,0),V(0,1,0),new THREE.Triangle(V(-1,0,-1),V(1,0,-1),V(0,0,1)))===0);
assert(Math.abs(distanceToTriangle(V(0,2,0),V(0,3,0),new THREE.Triangle(V(-1,0,-1),V(1,0,-1),V(0,0,1)))-2)<1e-9);
// Entire scene's real triangles inside corridor+approaches, not declared arch bounds.
const floor=r.baseY,routeZ=r.z,routeX=r.x,route=new THREE.Box3(V(routeX-3.9,floor-.1,routeZ-.7),V(routeX+3.9,floor+2.1,routeZ+.7)),tris=[],grounds=[];
e.root.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position,idx=m.geometry.index;for(let i=0;i<(idx?.count??p.count);i+=3){const pts=[0,1,2].map(k=>V().fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(m.matrixWorld)),box=new THREE.Box3().setFromPoints(pts);if(!box.intersectsBox(route))continue;const tri=new THREE.Triangle(...pts),n=tri.getNormal(V());
 // Only independently coplanar, up-facing foundation triangles are designated ground.
 const isFoundation=m.parent===e.root&&!m.userData.junctionRegion;
 const isFloor=m.userData.junctionWalk&&n.y>.99&&pts.every(v=>Math.abs(v.y-floor)<.01);
 if(isFloor)grounds.push({tri,box,name:m.name});else if(!pts.every(v=>v.y<=floor+2e-5))tris.push({tri,box,name:m.name});}}
);
const unsupportedFootSamples=[],approachCollisions=[];let minMargin=Infinity,interiorMinMargin=Infinity,capsules=0;const STEP=.04,R=PLAYER_RADIUS;
for(const lateral of [-.08,0,.08])for(let j=0;j<=170;j++){
 const foot=V(routeX-3.4+j*STEP,floor,routeZ+lateral),a=foot.clone().add(V(0,R,0)),z=foot.clone().add(V(0,PLAYER_HEIGHT-R,0)),bounds=new THREE.Box3().setFromPoints([a,z]).expandByScalar(R+.1);let margin=Infinity,nearest="";
 for(const q of tris)if(q.box.intersectsBox(bounds)){const distance=distanceToTriangle(a,z,q.tri)-R;if(distance<margin){margin=distance;nearest=q.name;}}
 if(Math.abs(foot.x-routeX)<=1.9){assert(margin>=.05+STEP/2,`interior capsule blocked at ${foot.toArray()} margin=${margin} mesh=${nearest}`);interiorMinMargin=Math.min(interiorMinMargin,margin);}else if(margin<.05+STEP/2)approachCollisions.push({foot:foot.toArray(),margin});minMargin=Math.min(minMargin,margin);capsules++;
 // Foot support across a disk must be on actual unchanged triangles, not AABB top.
 for(const [dx,dz]of [[0,0],[R,0],[-R,0],[0,R],[0,-R]]){const q=foot.clone().add(V(dx,0,dz));const supported=grounds.some(g=>{const hit=new THREE.Ray(q.clone().add(V(0,.02,0)),V(0,-1,0)).intersectTriangle(g.tri.a,g.tri.b,g.tri.c,false,V());return hit&&Math.abs(hit.y-q.y)<.01;});if(!supported)unsupportedFootSamples.push(q.toArray());if(Math.abs(foot.x-routeX)<=1.6)assert(supported,`unsupported interior ${q.toArray()}`);}
}
assert(unsupportedFootSamples.length>0,'known left approach lacks level foundation and must not be certified');
// Establish the initial capsule spine is outside every closed solid, using
// independent point-in-mesh parity; clearance alone cannot distinguish an
// entirely enclosed capsule from exterior free space.
let entryVolumeChecks=0,entryAabbTests=0;
for(const lateral of [-.08,0,.08]){
 const point=V(routeX-3.4,floor+PLAYER_HEIGHT/2,routeZ+lateral),direction=V(1,.317,.193).normalize();
 e.root.traverse(mesh=>{if(!mesh.isMesh)return;entryAabbTests++;if(!new THREE.Box3().setFromObject(mesh).containsPoint(point))return;const p=mesh.geometry.attributes.position,idx=mesh.geometry.index,ray=new THREE.Ray(point,direction),distances=[];
 for(let i=0;i<(idx?.count??p.count);i+=3){const pts=[0,1,2].map(k=>V().fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(mesh.matrixWorld)),hit=ray.intersectTriangle(...pts,false,V());if(hit)distances.push(hit.distanceTo(point));}
 distances.sort((a,b)=>a-b);const unique=distances.filter((v,i)=>!i||Math.abs(v-distances[i-1])>1e-6);assert.equal(unique.length%2,0,`entry inside solid ${mesh.name}`);entryVolumeChecks++;
 });
}
// The distance function is 1-Lipschitz under translation. Each between-sample
// capsule is <=.02m from a tested capsule, proving at least minMargin-.02 clearance.
assert(interiorMinMargin-STEP/2>=.05);assert(minMargin-STEP/2>=.05);
// Actual head-height cross section: rays find inner arch at >=2.1m, all three owners.
const roofs=[];for(const x of [0,1,2])for(const cross of [-.4,0,.4]){const start=V(routeX+(x-1)*1.6,floor+.02,routeZ+cross),hit=new THREE.Raycaster(start,V(0,1,0),0,4).intersectObject(e.root,true)[0];assert(hit);const height=hit.point.y-floor;assert(height>=2.1&&height<=2.30001);roofs.push(height);}
const approachGroundSamples=[];
for(const x of [-15.4,-14.5,-14.25,-14,-9.2]){const hit=new THREE.Raycaster(V(x,floor+.3,routeZ),V(0,-1,0),0,5).intersectObject(e.root,true)[0];assert(hit);approachGroundSamples.push({x,height:hit.point.y,gap:floor-hit.point.y,mesh:hit.object.name});}
assert(Math.abs(approachGroundSamples[0].gap-2.7)<2e-5);assert(Math.abs(approachGroundSamples[2].gap-.095)<2e-5);
// Negative control: the old actual pass1 arch must collide with the same
// capsule; a synthetic thin horizontal obstruction must also be detected.
let oldCapsuleMargin=Infinity;const spineA=V(routeX,floor+R,routeZ),spineB=V(routeX,floor+PLAYER_HEIGHT-R,routeZ);
base.traverse(m=>{if(!m.isMesh)return;const p=m.geometry.attributes.position,idx=m.geometry.index;for(let i=0;i<(idx?.count??p.count);i+=3){const v=[0,1,2].map(k=>V().fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(m.matrixWorld));oldCapsuleMargin=Math.min(oldCapsuleMargin,distanceToTriangle(spineA,spineB,new THREE.Triangle(...v))-R);}});
assert(oldCapsuleMargin<-.1);assert(distanceToTriangle(spineA,spineB,new THREE.Triangle(V(routeX-1,floor+1.55,routeZ-1),V(routeX+1,floor+1.55,routeZ-1),V(routeX,floor+1.55,routeZ+1)))-R<0);
const pickedOwners=[];for(const iy of [0,1]){
 const h=iy===0?.85:2.60,origin=V(routeX-5,floor+h,routeZ+.65),picked=e.pick(new THREE.Raycaster(origin,V(1,0,0),0,10));assert(picked);assert.equal(picked.regionId,regionId);assert.equal(picked.ix,0);assert.equal(picked.iy,iy);assert.equal(picked.iz,1);pickedOwners.push(picked);
}
// Structural deletion is transactional and reports why; upper deletion retires
// the complete pair chain, a single cell only. Undo/redo restore exact meshes.
const snapshot=e.snapshot(),initialHash=hash(c),rev=e.revision,untouched=new Map(others.map(g=>[g.name,g]));
const failed=e.edit({regionId,ix:1,iy:0,iz:1},'erase');assert.equal(failed.ok,false);assert(failed.error.includes('上格仍占用'));assert.equal(e.revision,rev);assert.deepEqual(e.snapshot(),snapshot);assert.equal(hash(c),initialHash);
const erased=e.edit({regionId,ix:1,iy:1,iz:1},'erase');assert(erased.ok,erased.error);assert.equal(e.audit().regions.reduce((s,r)=>s+r.occupiedCount,0),397);assert.equal(e.audit().regions.find(r=>r.regionId===regionId).pairCandidate.active,false);assert(e.undo());assert.deepEqual(e.snapshot(),snapshot);assert.equal(hash(c),initialHash);assert(e.redo());assert(e.undo());assert.equal(hash(c),initialHash);
for(const[name,obj]of untouched)assert.equal(e.root.getObjectByName(name),obj);
const resourceCount=root=>{const g=new Set(),m=new Set();root.traverse(o=>{if(o.geometry)g.add(o.geometry);for(const v of Array.isArray(o.material)?o.material:[o.material])if(v)m.add(v);});return [g.size,m.size];};
const resourceBaseline=resourceCount(c);for(let i=0;i<10;i++){assert(e.edit({regionId,ix:1,iy:1,iz:1},'erase').ok);assert(e.undo());assert.equal(hash(c),initialHash);assert.deepEqual(resourceCount(c),resourceBaseline);}
let saved;const savedCity=city(2,{getItem:()=>null,setItem:(k,v)=>{saved=v}});savedCity.userData.junctionEditor.save();assert.equal(JSON.parse(saved).schema,'junction-regions-v1');assert.equal(hash(city(2,{getItem:()=>saved})),initialHash);
assert(readFileSync(new URL('../../src/ui/citadelEditorPanel.js',import.meta.url),'utf8').includes('statsEl.textContent=result.error;toast(result.error,4)'));
// Existing gameplay adapter in a spherical-style translated frame, restricted
// to the supported interior: positive movement/ground smoke check, not a full
// arbitrary-world-pose capsule certificate or proof of the failed approach.
c.position.y=230;c.updateMatrixWorld(true);const playerSupport=createJunctionPlayerSupport(c);let controllerSteps=0;
for(const sign of [-1,1])for(let k=0;k<60;k++){
 const a=c.localToWorld(V(routeX+sign*(-1.5+k*.05),floor,routeZ)),b=c.localToWorld(V(routeX+sign*(-1.5+(k+1)*.05),floor,routeZ)),velocity=b.clone().sub(a).normalize().multiplyScalar(7.2);
 const expected=b.clone();assert.equal(playerSupport.walls(a,b,velocity),false);assert(b.distanceTo(expected)<1e-10);const support=playerSupport.ground(b);assert(Number.isFinite(support));assert(Math.abs(support-b.length())<2e-5);controllerSteps++;
}
console.log(JSON.stringify({passed:true,cellCount:398,pairedCells:6,pairs:3,pickedOwners,otherRegionsAndFoundationsIdentical:true,otherTargetRegionOwnersIdentical:true,solver:{hash:solved.hash,fixedOutsideCells:solved.pairCandidate.fixedOutsideCells,wrongUpperOrientationRejected:true},closedEdges,fullTraversalAccepted:false,exactTriangleDistance:{triangles:tris.length,groundTriangles:grounds.length,capsules,step:STEP,minSampleMargin:minMargin,interiorMinSampleMargin:interiorMinMargin,interiorGuaranteedBetweenSampleMargin:interiorMinMargin-STEP/2,approachClearanceFailures:approachCollisions.length,entryVolumeChecks,entryAabbTests,guaranteedFullRouteBodyMargin:minMargin-STEP/2,scope:'whole-scene obstacle triangles for three routes and one metre approaches; low ground-contact surfaces excluded; support independently fails'},measuredInnerHeights:roofs,approachSupport:{passed:false,unsupportedSamples:unsupportedFootSamples.length,examples:unsupportedFootSamples.slice(0,5),reason:"left fixed quay is 2.70m below aperture; existing seawall-plinth is .095m below; no foundation modified",supportStepCriterion:.01,fullySupportedCenterRouteHalfLength:1.6,actualGroundSamples:approachGroundSamples},undoRedoExact:true,repeatedPairRebuilds:20,retainedResourceCount:resourceBaseline,lowerDeletionRejectedWithMessage:true,upperDeletionRetiresPairs:true,saveSchemaUnchanged:true,oldPass1CapsuleMargin:oldCapsuleMargin,thinCeilingRejected:true,existingControllerInteriorSteps:controllerSteps,gameplayAndGPUAccepted:false},null,2));
