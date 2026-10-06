import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from '../../vendor/three.module.js';
import {PLAYER_HEIGHT,PLAYER_RADIUS} from '../../src/core/constants.js';
import {P} from '../../src/core/params.js';
import {installEditableJunction,junctionRegionDefaults,JUNCTION_EDIT_KEY} from '../../src/world/canalJunctionEditable.js';
import {buildCitadelTownAssembly} from '../../src/world/odysseyCitadel.js';
import {makeTownPassageGeometry,auditTownPassageClearance} from '../../src/world/citadel/townPassageGeometry.js';
import {solveTownSelection} from '../../src/world/citadel/wfcTownSelection.js';
import {townGridSignature,makeTownRoleOracle} from '../../src/world/citadel/wfcTownWiring.js';
const hashRoot=root=>{const records=[];root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;const h=createHash('sha256');h.update(o.name);for(const n of ['position','normal','uv']){const a=o.geometry.attributes[n]?.array;if(a)h.update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));}if(o.geometry.index)h.update(new Uint8Array(o.geometry.index.array.buffer));h.update(JSON.stringify(o.matrixWorld.elements));records.push(h.digest('hex'));});return createHash('sha256').update(records.sort().join('|')).digest('hex');};
const emptyStorage=()=>({getItem:()=>null});
const buildCity=(options={})=>{const c=new THREE.Group();installEditableJunction(c,{storage:emptyStorage(),...options});c.updateMatrixWorld(true);return c;};
// Default and explicit off follow the same original build branch.
const baseline=buildCity(),explicitOff=buildCity({wfcPassage:false});assert.equal(hashRoot(baseline),hashRoot(explicitOff));
const city=buildCity({wfcPassage:true}),editor=city.userData.junctionEditor;
assert.equal(editor.audit().regions.reduce((n,r)=>n+r.occupiedCount,0),398);assert.equal(editor.audit().regions.length,11);
assert.deepEqual(editor.snapshot(),baseline.userData.junctionEditor.snapshot());assert.notEqual(hashRoot(city),hashRoot(baseline));
const foundations=root=>root.children.filter(o=>!o.userData.junctionRegion);
assert.deepEqual(foundations(editor.root).map(hashRoot),foundations(baseline.userData.junctionEditor.root).map(hashRoot));
const passages=[];editor.root.traverse(o=>{if(o.userData.wfcPassage)passages.push(o);});assert.equal(passages.length,23);
let apertureRays=0,solidRays=0,chainRays=0;
const ray=(root,start,end)=>new THREE.Raycaster(start,end.clone().sub(start).normalize(),0,start.distanceTo(end)).intersectObject(root,true).filter(h=>h.object.isMesh);
for(const mesh of passages){const p=mesh.userData.wfcPassage,axis=p.axis==='x'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1),cross=new THREE.Vector3(-axis.z,0,axis.x);
 assert.equal(p.playerHeight,1.66);assert.equal(p.playerDiameter,.7);assert(p.clearHeight<PLAYER_HEIGHT);assert.equal(p.playerTraversable,false);assert(p.clearWidth>PLAYER_RADIUS*2);
 // Independently cast actual assembly triangles, including foundation and decor.
 for(const h of [.12,.45,.9,1.2])for(const offset of [-.25,0,.25])for(const sign of [-1,1]){
  const a=cross.clone().multiplyScalar(offset).addScaledVector(axis,-.799*sign);a.y=h-.85;const b=a.clone().addScaledVector(axis,1.598*sign);
  assert.equal(ray(city,mesh.localToWorld(a),mesh.localToWorld(b)).length,0,`${mesh.parent.parent.name}/${p.cell} blocked`);apertureRays++;
 }
 // Closed side piers, roof support and player's too-high head must hit actual mesh.
 for(const direction of [cross,new THREE.Vector3(0,1,0)]){const a=new THREE.Vector3(0,-.35,0),b=a.clone().addScaledVector(direction,1.4);assert(ray(mesh,mesh.localToWorld(a),mesh.localToWorld(b)).length);solidRays++;}
 const a=axis.clone().multiplyScalar(-.81);a.y=PLAYER_HEIGHT-.85;const b=a.clone().addScaledVector(axis,1.62);assert(ray(mesh,mesh.localToWorld(a),mesh.localToWorld(b)).length);solidRays++;
}
// Ground-floor chain across entire region rows, both orientations.
for(const [regionId,axis,offsets] of [['left-front-coral','x',[0]],['right-front-teal','z',[0,1.6]]]){
 const r=junctionRegionDefaults().find(x=>x.id===regionId),group=editor.root.getObjectByName(regionId);
 for(const offset of offsets){const a=new THREE.Vector3(axis==='x'?-2.399:offset,.65+r.baseY,axis==='z'?-2.399:1.6),b=a.clone();b[axis]=2.399;
  assert.equal(ray(city,group.localToWorld(a),group.localToWorld(b)).length,0);chainRays++;
 }
}
// Existing foundation top is independently measured under each aperture.
// A low foundation AABB alone would not prove actual support or a clear void.
let foundationProbes=0;const unsupportedFoundation=[];for(const mesh of passages){
 const world=mesh.localToWorld(new THREE.Vector3(0,2,0)),raycaster=new THREE.Raycaster(world,new THREE.Vector3(0,-1,0),0,20);
 const hit=raycaster.intersectObjects(foundations(editor.root),true)[0];assert(hit,'foundation absent under aperture');
 const floor=mesh.localToWorld(new THREE.Vector3(0,-.85,0)).y;const delta=hit.point.y-floor;assert(delta<2e-5,`foundation intrudes by ${delta}`);if(Math.abs(delta)>2e-5)unsupportedFoundation.push({region:mesh.parent.parent.name,cell:mesh.userData.wfcPassage.cell,delta});foundationProbes++;
}
assert.deepEqual(unsupportedFoundation.map(p=>[p.region,p.cell]),[['left-watchtower','0,0,1']]);assert(Math.abs(unsupportedFoundation[0].delta+2.7)<1e-6);assert.equal(editor.root.userData.passageClearance.fixedFoundationSupported,22);
const rotated=buildCity({wfcPassage:true});rotated.position.set(14,230,-17);rotated.rotation.set(.4,-.3,.7);rotated.updateMatrixWorld(true);
assert(auditTownPassageClearance([...rotated.userData.junctionEditor.root.children],{referenceRoot:rotated.userData.junctionEditor.root}).ok);
assert(rotated.userData.junctionEditor.edit({regionId:'left-front-coral',ix:0,iy:0,iz:2},'erase').ok);assert(rotated.userData.junctionEditor.undo());
// Genuine closed manifold, finite triangles; no vertex at aperture center.
for(const axis of ['x','z']){const g=makeTownPassageGeometry(1.6,1.7,{axis}),p=g.attributes.position,edges=new Map();for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(k=>new THREE.Vector3().fromBufferAttribute(p,i+k));assert(v.every(v=>v.toArray().every(Number.isFinite)));assert(v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).length()>1e-8);const keys=v.map(v=>v.toArray().map(x=>Math.round(x*1e6)).join(','));for(let j=0;j<3;j++){const k=[keys[j],keys[(j+1)%3]].sort().join('|');edges.set(k,(edges.get(k)||0)+1);}}assert([...edges.values()].every(n=>n===2));g.dispose();}
// Actual solver pins, same occupied cells: plain vs passage r0/r90 must cause
// different body geometry and rotate the direction of the real hole.
const grid=new Map([['0,0,0','0'],['0,1,0','0']]),spec={cellSize:1.6,cellHeight:1.7,levels:[['0'],['0']]},seed=7,fixtureHashes=[];
for(const key of ['body.plain@r0','body.passage@r0','body.passage@r90']){
 const solved=solveTownSelection({grid,seed,pins:[{cell:'0,0,0',variant:key},{cell:'0,1,0',variant:'flat.w0@r0'}]});assert(solved.ok);const roleAt=(x,y,z)=>solved.byCell[`${x},${y},${z}`]?.variant??null;
 const cache={wfcTownSelection:{sig:`${townGridSignature(grid)}|${seed}`,value:{...solved,roleAt}}};
 const town=buildCitadelTownAssembly(spec,{baseY:0,wfcTownV1:true,wfcPassageV1:true,wfcSeed:seed,townCtxCache:cache,leanDecor:true});town.group.updateMatrixWorld(true);fixtureHashes.push(hashRoot(town.group));
 const oracle=makeTownRoleOracle({...solved,roleAt});assert.equal(oracle.assignmentAt(0,0,0).key,key);
 const pm=town.group.getObjectByName('town-wfc-passage');if(key.includes('passage')){assert(pm);const axis=key.endsWith('r90')?'x':'z';assert.equal(pm.userData.wfcPassage.axis,axis);const a=new THREE.Vector3(0,-.2,0);a[axis]=-.799;const b=a.clone();b[axis]=.799;assert.equal(ray(town.group,pm.localToWorld(a),pm.localToWorld(b)).length,0);}else assert(!pm);
}
assert.equal(new Set(fixtureHashes).size,3);assert(!solveTownSelection({grid,seed,pins:[{cell:'0,1,0',variant:'body.passage@r0'}]}).ok,'invalid pin must fail, not silently place an arch');
// Delete/undo/redo and snapshot reload recover both assignments and geometry.
const records=new Map(),storage={getItem:k=>records.get(k),setItem:(k,v)=>records.set(k,v)};
const editCity=buildCity({wfcPassage:true,storage}),e=editCity.userData.junctionEditor,cell={regionId:'left-front-coral',ix:0,iy:0,iz:2};
const initial=e.snapshot(),beforeHash=hashRoot(e.root),beforeAssignments=e.audit().regions.map(r=>r.assignment),fixed=foundations(e.root).map(o=>o.uuid),other=e.root.getObjectByName('right-front-teal');
assert(e.edit(cell,'erase').ok);const erasedHash=hashRoot(e.root);assert.notEqual(erasedHash,beforeHash);assert(e.undo());assert.equal(hashRoot(e.root),beforeHash);assert.deepEqual(e.audit().regions.map(r=>r.assignment),beforeAssignments);assert.deepEqual(e.snapshot(),initial);assert(e.redo());assert.equal(hashRoot(e.root),erasedHash);assert(e.undo());assert.equal(e.root.getObjectByName('right-front-teal'),other);assert.deepEqual(foundations(e.root).map(o=>o.uuid),fixed);assert.equal(records.size,0);
// Picking a real pier resolves its occupied cell rather than an invented voxel.
const pm=e.root.getObjectByName('left-front-coral').getObjectByName('town-wfc-passage'),cp=pm.userData.wfcPassage,axis=cp.axis==='x'?new THREE.Vector3(1,0,0):new THREE.Vector3(0,0,1),cross=new THREE.Vector3(-axis.z,0,axis.x),a=cross.clone().multiplyScalar(.68).addScaledVector(axis,-1.05);a.y=-.4;const b=a.clone().addScaledVector(axis,2.1);pm.localToWorld(a);pm.localToWorld(b);const pick=e.pick(new THREE.Raycaster(a,b.clone().sub(a).normalize(),0,a.distanceTo(b)));assert.equal(pick.regionId,'left-front-coral');assert.equal(pick.iy,0);
e.save();assert.equal(JSON.parse(records.get(JUNCTION_EDIT_KEY)).schema,'junction-regions-v1');const restored=buildCity({wfcPassage:true,storage});assert.deepEqual(restored.userData.junctionEditor.snapshot(),initial);assert.equal(hashRoot(restored.userData.junctionEditor.root),beforeHash);
// A real obstacle rejects the transaction and leaves displayed state/history.
let obstruct=false;const txCity=buildCity({wfcPassage:true,build:(...args)=>{const town=buildCitadelTownAssembly(...args);if(obstruct){const passage=town.group.getObjectByName('town-wfc-passage');assert(passage,'failure fixture must still contain a solved passage');town.group.updateMatrixWorld(true);const blocker=new THREE.Mesh(new THREE.BoxGeometry(passage.userData.wfcPassage.axis==='x'?.08:1.5,1.5,passage.userData.wfcPassage.axis==='z'?.08:1.5),new THREE.MeshBasicMaterial());blocker.name='deliberate-passage-blocker';blocker.position.copy(passage.getWorldPosition(new THREE.Vector3()));town.group.add(blocker);}return town;}}),tx=txCity.userData.junctionEditor;
const txHash=hashRoot(tx.root),txState=tx.snapshot(),txRev=tx.revision;obstruct=true;assert.equal(tx.edit({...cell,iy:2,iz:0},'erase').ok,false);assert.equal(hashRoot(tx.root),txHash);assert.deepEqual(tx.snapshot(),txState);assert.equal(tx.revision,txRev);assert.equal(tx.undo(),false);
assert.throws(()=>buildCitadelTownAssembly(spec,{wfcTownV1:true,wfcPassageV1:true,gridV6:{}}),/regular-cell/);
const old=P.cornerModulesV1;P.cornerModulesV1=true;assert.throws(()=>buildCity({wfcPassage:true}),/cornerModulesV1/);P.cornerModulesV1=old;
console.log(JSON.stringify({passed:true,cells:398,regions:11,passages:23,apertureRays,solidRays,chainRays,foundationProbes,unsupportedFoundation,rotatedFramePassed:true,player:{height:PLAYER_HEIGHT,diameter:PLAYER_RADIUS*2,openingWidth:passages[0].userData.wfcPassage.clearWidth,openingHeight:passages[0].userData.wfcPassage.clearHeight,traversable:false},foundationUnchanged:true,defaultOffEquivalent:true,solverPinnedGeometryHashes:fixtureHashes,undoRedoGeometryExact:true,saveSchemaUnchanged:true,transactionObstructionRejected:true,actualClearance:editor.root.userData.passageClearance,limitation:'CPU actual triangle rays and lifecycle; browser image/GPU/player controller not validated'},null,2));
