import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {TIGER_CORAL_PALETTE,TIGER_WALK,tigerStrideLength,sampleTigerWalk,tigerLimbRadius} from '../../src/assets/characters/tigerCoralGait.js';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
let cached;
async function fixture(){if(cached)return cached;const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),tiger=root.userData.inner.userData.tiger;await tiger.userData.swampTigerV2Ready;const nodes=new Map();tiger.traverse(n=>{if(n.userData.blenderSourceNode)nodes.set(n.userData.blenderSourceNode,n);});root.updateMatrixWorld(true);return cached={root,tiger,nodes};}
function ringCentre(mesh,i){const p=mesh.geometry.attributes.position,c=new THREE.Vector3();for(let j=0;j<24;j++)c.add(new THREE.Vector3().fromBufferAttribute(p,i*25+j));return c.multiplyScalar(1/24);}
function closed(mesh){const g=mesh.geometry,p=g.attributes.position,idx=g.index,edges=new Map();const key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');for(let i=0;i<idx.count;i+=3){const a=[idx.getX(i),idx.getX(i+1),idx.getX(i+2)].map(key);if(new Set(a).size!==3)continue;for(let j=0;j<3;j++){const u=a[j],v=a[(j+1)%3],k=u<v?u+'|'+v:v+'|'+u;const e=edges.get(k)||[0,0];e[0]++;e[1]+=u<v?1:-1;edges.set(k,e);}}for(const [k,[count,balance]]of edges){assert.equal(count,2,`${mesh.name} open/nonmanifold edge ${k}`);assert.equal(balance,0,`${mesh.name} inconsistent winding ${k}`);}}

test('adult coral character has broad temples, muscular shoulders/thighs, load-bearing soles and live thin ink',async()=>{
 const {tiger,nodes}=await fixture();assert.equal(tiger.userData.tigerTargetRound,40);assert.equal(tiger.userData.displayName,'湖沼之虎');assert.deepEqual(tiger.userData.tigerCoralDesign.palette,TIGER_CORAL_PALETTE);
 const skull=nodes.get('n9');skull.geometry.computeBoundingBox();const size=skull.geometry.boundingBox.getSize(new THREE.Vector3());assert.ok(size.x/size.y>1.25&&size.x/size.y<1.7,'broad adult temples, not spherical kitten head');
 assert.ok(tigerLimbRadius(.17,true)[0]>2.5*tigerLimbRadius(1,true)[0]);assert.ok(tigerLimbRadius(.17,false)[0]>2*tigerLimbRadius(1,false)[0]);
 for(const id of ['n55','n62','n69','n76']){const paw=nodes.get(id);paw.geometry.computeBoundingBox();const b=paw.geometry.boundingBox,s=b.getSize(new THREE.Vector3());assert.ok(s.x>.77&&s.z>.9);const p=paw.geometry.attributes.position;let flat=0;for(let i=0;i<p.count;i++)if(Math.abs(p.getY(i)-b.min.y)<1e-5)flat++;assert.ok(flat>50,'flat load-bearing sole');}
 let lines=0;tiger.traverse(m=>{if(m.userData.tigerCoralOutline){lines++;assert.equal(m.geometry,m.parent.geometry);assert.equal(m.material.color.getHexString(),TIGER_CORAL_PALETTE.ink.slice(1).toLowerCase());assert.equal(m.material.side,THREE.BackSide);}});assert.equal(lines,13);
 for(const id of ['n2','n6','n53','n60','n67','n74']){const m=nodes.get(id);assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite));closed(m);}
});

test('four beat stance cancels ground speed at multiple scales and speeds; stopped feet do not cycle',()=>{
 for(const scale of [.2,.4,.8])for(const speed of [.1,1.2,2.4]){
  const dt=.001,distance=speed*dt,stride=tigerStrideLength(scale);
  for(let foot=0;foot<4;foot++){const start=.2-TIGER_WALK.phaseOffsets[foot],a=sampleTigerWalk(start,foot),b=sampleTigerWalk(start+distance/stride,foot);assert.ok(a.stance&&b.stance);assert.ok(Math.abs(distance+(b.travel-a.travel)*scale)<1e-10,'stance paw locks against actual travelled ground');}
 }
 for(let n=0;n<100;n++){const steps=[0,1,2,3].map(i=>sampleTigerWalk(n/100,i));assert.ok(steps.filter(s=>s.stance).length>=2,'a walk keeps at least two feet grounded');assert.ok(steps.every(s=>s.swing>=0&&s.swing<=1));}
 for(let foot=0;foot<4;foot++){const stop=sampleTigerWalk(.83,foot,false);assert.equal(stop.travel,0);assert.equal(stop.swing,0);assert.equal(stop.stance,true);}
});

test('swing actively bends separate fore elbow and hind knee/hock while shoulder anchors and paw ends stay attached',async()=>{
 const {tiger,nodes}=await fixture(),fore=nodes.get('n53'),rear=nodes.get('n67');
 tiger.userData.updateTargetForelimbs(0,[0,0,0,0]);tiger.userData.updateTargetHindlimbs(0,[0,0,0,0]);
 const f=[0,12,24,36].map(i=>ringCentre(fore,i)),r=[0,12,24,36].map(i=>ringCentre(rear,i));
 tiger.userData.updateTargetForelimbs(0,[1,0,0,0]);tiger.userData.updateTargetHindlimbs(0,[0,0,1,0]);
 const ff=[0,12,24,36].map(i=>ringCentre(fore,i)),rr=[0,12,24,36].map(i=>ringCentre(rear,i));
 assert.ok(ff[0].distanceTo(f[0])<1e-6&&ff[3].distanceTo(f[3])<1e-6);assert.ok(rr[0].distanceTo(r[0])<1e-6&&rr[3].distanceTo(r[3])<1e-6);
 assert.ok(ff[1].z<f[1].z-.4,'fore elbow flexes rearwards');assert.ok(rr[1].z>r[1].z+.25,'rear knee flexes forwards');assert.ok(rr[2].z<r[2].z-.2,'hock flexes rearwards');
 closed(fore);closed(rear);tiger.userData.updateTargetForelimbs(0,[0,0,0,0]);tiger.userData.updateTargetHindlimbs(0,[0,0,0,0]);
});


test('adult muzzle extends ahead of restrained side-set eyes, without inherited smile/brow addons',async()=>{
 const {tiger,nodes}=await fixture();
 const bridge=nodes.get('add:Tiger_Broad_Nasal_Bridge'),nose=nodes.get('n25'),eye=nodes.get('n19');
 for(const m of [bridge,nose,eye])m.geometry.computeBoundingBox();
 const eyeBox=eye.geometry.boundingBox;assert.ok(eyeBox.getSize(new THREE.Vector3()).y<.1,'restrained eye aperture');
 assert.ok(nose.geometry.boundingBox.max.z-eyeBox.max.z>.55,'adult nasal length ahead of eye');
 assert.ok(bridge.geometry.boundingBox.getSize(new THREE.Vector3()).z>1.4,'horizontal nasal bridge');
 for(const id of ['add:Tiger_Heavy_Brow_n19','add:Tiger_Heavy_Brow_n21','add:Tiger_Ivory_Chin'])assert.equal(nodes.get(id).visible,false);
 let smile=false;tiger.traverse(o=>{if(o.name==='v2-tiger-lip'&&o.visible)smile=true;});assert.equal(smile,false);
 assert.ok(tiger.getObjectByName('adult-tiger-neutral-lips-and-whiskers'));
});


test('round38 muzzle is wide and deep with a broad embedded nasal pad, not a detached white tube',async()=>{
 const {nodes}=await fixture(),muzzle=nodes.get('n23'),nose=nodes.get('n25'),bridge=nodes.get('add:Tiger_Broad_Nasal_Bridge');
 for(const m of [muzzle,nose,bridge])m.geometry.computeBoundingBox();
 const mb=muzzle.geometry.boundingBox,nb=nose.geometry.boundingBox,ms=mb.getSize(new THREE.Vector3()),ns=nb.getSize(new THREE.Vector3());
 assert.ok(ms.x>1.30&&ms.y>.66,'wide substantial whisker-pad volume');
 assert.ok(ns.x>.54,'broad tiger nasal pad');assert.ok(nb.max.z-mb.max.z<.06,'nasal pad embedded in blunt muzzle end');
 assert.ok(mb.min.z<.36,'white muzzle joins back into the cheeks');
 assert.ok(bridge.geometry.boundingBox.max.z<mb.max.z,'gold bridge ends behind nasal pad');closed(muzzle);closed(bridge);
});

test('round40 continuous torso has a higher scapula, tucked flank, buried limb root rings and a fixed water-contact nose',async()=>{
 const {tiger,nodes,root}=await fixture();root.updateMatrixWorld(true);
 const anatomy=tiger.userData.tigerAnatomy,sections=anatomy.torsoSections;
 const rump=sections.find(s=>s[0]===-2.15),flank=sections.find(s=>s[0]===-1.3),shoulder=sections.find(s=>s[0]===1.03),chest=sections.find(s=>s[0]===.3);
 assert.ok(shoulder[2]+shoulder[3]>rump[2]+rump[3]+.3,'shoulder silhouette leads the rump');
 assert.ok(flank[3]-flank[2]>chest[3]-chest[2]+.45,'belly tucks behind the deep ribcage');
 const body=nodes.get('n2'),probe=new THREE.Mesh(body.geometry,new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),ray=new THREE.Raycaster(),inv=new THREE.Matrix4().copy(body.matrixWorld).invert();probe.updateMatrixWorld(true);
 for(const id of ['n53','n60','n67','n74']){
  const limb=nodes.get(id),p=limb.geometry.attributes.position,m=new THREE.Matrix4().multiplyMatrices(inv,limb.matrixWorld);
  for(let j=0;j<24;j++){
   const v=new THREE.Vector3().fromBufferAttribute(p,j).applyMatrix4(m);ray.set(v,new THREE.Vector3(1,.001,.003).normalize());
   assert.ok(ray.intersectObject(probe,false).length%2===1,`${id} root ring ${j} must lie inside the torso skin, not expose a sausage cap`);
  }
 }
 probe.material.dispose();
 const nose=nodes.get('n25');nose.geometry.computeBoundingBox();assert.ok(Math.abs(nose.geometry.boundingBox.max.z-1.589)<.001,'nose drinking datum retained');
 for(const id of ['n55','n62','n69','n76']){nodes.get(id).geometry.computeBoundingBox();assert.ok(Math.abs(nodes.get(id).geometry.boundingBox.min.y+2.075)<1e-6);}
});
