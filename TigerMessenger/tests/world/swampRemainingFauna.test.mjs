import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(16)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {SWAMP_COMPONENT_BUILDERS:b,createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const baseline=JSON.parse(fs.readFileSync(new URL('../fixtures/swampRemainingFaunaBaseline.json',import.meta.url)));
const plain=g=>({name:g.name,position:g.position.toArray(),rotation:g.rotation.toArray(),scale:g.scale.toArray(),data:Object.fromEntries(Object.entries(g.userData).filter(([k,v])=>['number','boolean','string'].includes(typeof v)&&!k.startsWith('coral')))});
function rng(){let n=7711,calls=0;const f=()=>{calls++;n=(n*1664525+1013904223)>>>0;return n/4294967296;};f.stats=()=>({calls,state:n});return f;}
function closed(geometry){const p=geometry.attributes.position,idx=geometry.index,edges=new Map(),key=i=>[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');for(let i=0,n=idx?idx.count:p.count;i<n;i+=3){const a=[0,1,2].map(j=>key(idx?idx.getX(i+j):i+j));if(new Set(a).size!==3)continue;for(let j=0;j<3;j++){const u=a[j],v=a[(j+1)%3],k=u<v?u+'|'+v:v+'|'+u;edges.set(k,(edges.get(k)||0)+1);}}assert.ok([...edges.values()].every(n=>n===2),'closed anatomical pieces, no open tube ends');}

test('remaining fauna preserves exact sampled RNG consumption and authored placement/phase metadata',()=>{
 for(const[id,old]of Object.entries(baseline.builders)){const rnd=rng(),g=id==='nativeDoll'?b[id](1):b[id](rnd);assert.deepEqual(rnd.stats(),{calls:old.calls,state:old.state},id);assert.deepEqual(plain(g),old.actor,id);if(old.children)assert.deepEqual(g.children.map(plain),old.children,id);}
});

test('first fauna pass uses sealed tapered anatomy and restrained shared ink',()=>{
 for(const id of ['swampEel','tubeWormCluster','pinkHanger','ribbonFish']){const g=b[id](rng());assert.equal(g.userData.coralFaunaVersion,1);let skins=0,ink=0;g.traverse(m=>{if(!m.isMesh)return;if(m.userData.isOutline){ink++;assert.ok(m.userData.fineAnimalInk);return;}skins++;assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite));closed(m.geometry);});assert.equal(skins,1,id);assert.equal(ink,1,id);}
 const eel=b.swampEel(rng()),body=eel.getObjectByName('swamp-eel-smooth-anatomy');body.geometry.computeBoundingBox();assert.ok(body.geometry.boundingBox.getSize(new THREE.Vector3()).x>11,'original long eel span retained');
});

test('formal factory retains native identities and ribbon animation keeps thickness and contour attached',async()=>{
 const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner;await inner.userData.tiger.userData.swampTigerV2Ready;
 const formal=[];inner.traverse(g=>{if(['swamp-eel','swamp-tube-worms','swamp-pink-hanger','swamp-glow-ribbonfish'].includes(g.name)||/^swamp-fish-\d+$/.test(g.name)||(g.name==='swamp-native-doll'&&!!g.userData.coralSwimLimbs)||(g.isSprite&&g.userData.orbitPh!==undefined&&g.userData.trail!==undefined))formal.push(plain(g));});assert.deepEqual(JSON.parse(JSON.stringify(formal)),baseline.formal);
 const ribbons=[];let tubeCount=0;inner.traverse(g=>{if(g.name==='swamp-glow-ribbonfish')ribbons.push(g);if(g.name==='swamp-tube-worms')tubeCount+=g.userData.coralTubeCount||0;});assert.equal(ribbons.length,3);assert.equal(tubeCount,11);
 for(const t of [0,.7,3.2,9.5]){root.userData.update(1/60,t,{});for(const fish of ribbons){const u=fish.userData,p=u.bodyMesh.geometry.attributes.position;for(let i=0;i<p.count;i+=17){const x=u.baseX[i],expected=u.baseZ[i]+Math.sin(x*2-t*u.wave+u.phase)*.3*(.15+.85*(.5-x/3.8));assert.ok(Math.abs(p.getZ(i)-expected)<1e-6);}for(const child of u.bodyMesh.children)if(child.userData.isOutline)assert.equal(child.geometry.attributes.position,p);assert.ok(u.halo.scale.x<=.281,'local fish glimmer, not body-sized glare');}}
});

test('fish, swimmer and point lights use formal anatomy with finite closed parts and bounded drawing cost',async()=>{
 const root=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=root.userData.inner;await inner.userData.tiger.userData.swampTigerV2Ready;
 const fish=[],lights=[];let swimmer;
 inner.traverse(g=>{if(/^swamp-fish-\d+$/.test(g.name))fish.push(g);if(g.name==='swamp-native-doll'&&!!g.userData.coralSwimLimbs)swimmer=g;if(g.isSprite&&g.userData.orbitPh!==undefined&&g.userData.trail!==undefined)lights.push(g);});
 assert.equal(fish.length,9);assert.equal(lights.length,46);assert.ok(swimmer);assert.equal(swimmer.userData.coralSwimLimbs.length,4);
 const children=[];inner.traverse(g=>{if(g.name==='swamp-native-doll')children.push(g);});
 assert.equal(children.filter(g=>g.userData.flowerBoy).length,10,'all original flower children survive reparenting');
 assert.equal(children.filter(g=>g.userData.coralSwimLimbs).length,1,'one distinct legacy swimmer');
 assert.equal(children.length,11);
 assert.deepEqual(new Set(children.filter(g=>g.userData.flowerBoy)),new Set(inner.userData.lotuses.flatMap(g=>g.userData.passengers)),'same ten story references');
 let meshes=0;
 for(const g of [...fish,swimmer]){assert.equal(g.userData.coralFaunaVersion,1);g.traverse(m=>{if(!m.isMesh)return;meshes++;assert.ok([...m.geometry.attributes.position.array].every(Number.isFinite));if(!m.userData.isOutline)closed(m.geometry);});}
 assert.equal(meshes,28,'nine fish at two draws and one child at ten draws; no per-spot/curl meshes');
 const tex=lights[0].material.map;assert.ok(tex.isDataTexture);assert.ok(lights.every(p=>Math.abs(p.material.opacity-.6)<1e-12&&p.userData.coralGlow.opacityFactor===.75));assert.ok(lights.every(p=>p.material.map===tex));
 const alpha=Array.from(tex.image.data).filter((_,i)=>i%4===3);assert.ok(alpha.filter(x=>x>0).length/alpha.length<.18,'point footprint confined to less than 18% of sprite area');
 const originalOp=lights.map(p=>p.userData.op),phases=fish.map(g=>g.userData.phase),positions=[];
 for(const t of [0,.73,2.14,6.29]){
  root.userData.update(1/60,t,{});positions.push(swimmer.userData.coralSwimLimbs.map(l=>l.node.rotation.x));
  assert.ok(lights.every(p=>Number.isFinite(p.material.opacity)&&p.material.opacity<=.76));
  for(const g of fish)assert.ok(g.position.toArray().every(Number.isFinite));
 }
 assert.notDeepEqual(positions[0],positions[1],'limbs actually paddle independently of whole-body orbit');
 assert.deepEqual(lights.map(p=>p.userData.op),originalOp);assert.deepEqual(fish.map(g=>g.userData.phase),phases);
 assert.ok(swimmer.userData.coralSwimLimbs.every(l=>Math.abs(l.node.rotation.x)<=(l.arm?.24:.31)));
});

test('micropoint appearance retains explicit legacy atmosphere fallback',()=>{
 location.search='?gregLakeVisuals=0';
 try{const g=b.fireflies(rng());assert.ok(g.children.every(p=>p.userData.coralFaunaVersion===undefined&&!p.material.map.isDataTexture));}
 finally{location.search='';}
});

// A frontward ray must hit visible dark eye geometry before the pink skin,
// at the unchanged authored head location; no detached eyeball is needed.
test('pink hanger eyes reach the actual curved skin surface',()=>{
 const g=b.pinkHanger(rng());g.updateMatrixWorld(true);
 const body=g.getObjectByName('swamp-pink-clinging-anatomy'),colors=body.geometry.attributes.color,ink=new THREE.Color(0x435968);
 for(const x of [-.088,.088]){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,-.48,2),new THREE.Vector3(0,0,-1)).intersectObject(body,false);
  assert.ok(hits.length>=2);const i=hits[0].face.a;
  assert.ok(Math.abs(colors.getX(i)-ink.r)<1e-6&&Math.abs(colors.getY(i)-ink.g)<1e-6&&Math.abs(colors.getZ(i)-ink.b)<1e-6,'nearest visible surface is the eye');
  const skin=hits.find(h=>Math.abs(colors.getX(h.face.a)-ink.r)>1e-4);
  assert.ok(skin);assert.ok(hits[0].point.z-skin.point.z>.005&&hits[0].point.z-skin.point.z<.03,'eye rests on the skin, not recessed or detached');
 }
});
