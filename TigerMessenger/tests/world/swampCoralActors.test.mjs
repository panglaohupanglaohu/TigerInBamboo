import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:'?swampV2=0'};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const current=await import('../../src/world/moebiusSwamp.js');
// The preserved pre-reconstruction source provides original RNG and animation contracts.
const sourceUrl=new URL('../../src/world/moebiusSwamp.js',import.meta.url);
let oldSource=fs.readFileSync(new URL('../../artifacts/pipeline/lake-reconstruction-20261007/source-before/moebiusSwamp.js',import.meta.url),'utf8');
oldSource=oldSource.replace(/from\s+(["'])([^"']+)\1/g,(_,q,path)=>`from ${q}${path.startsWith('.')?new URL(path,sourceUrl).href:import.meta.resolve(path)}${q}`);
const original=await import(`data:text/javascript;base64,${Buffer.from(oldSource).toString('base64')}`);
const rng=()=>{let state=7711,calls=0;return{rnd:()=>{calls++;state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},get calls(){return calls;},get state(){return state;}};};
const names=['whale','lotusLeafBoat','swampBird','longTailMonkey','glowLizard'];
function draws(root){let n=0;root.traverse(o=>{if(o.isMesh||o.isLine||o.isSprite)n++;});return n;}
function finite(root){root.updateMatrixWorld(true);root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite),o.name);if(o.geometry)for(const attr of Object.values(o.geometry.attributes))assert.ok([...attr.array].every(Number.isFinite),o.name);});}
function closed(geo){const edges=new Map(),ids=geo.index.array;for(let i=0;i<ids.length;i+=3)for(let j=0;j<3;j++){const a=ids[i+j],b=ids[i+(j+1)%3];assert.notEqual(a,b);const k=a<b?`${a}:${b}`:`${b}:${a}`;edges.set(k,(edges.get(k)||0)+1);}assert.ok([...edges.values()].every(n=>n===2),'each topological edge has exactly two incident faces');}

test('actor reconstruction preserves original random stream and bounds draw calls',()=>{
 for(const name of names){const a=rng(),b=rng(),old=original.SWAMP_COMPONENT_BUILDERS[name](a.rnd,name==='swampBird'?0xd8ffe0:undefined),now=current.SWAMP_COMPONENT_BUILDERS[name](b.rnd,name==='swampBird'?0xd8ffe0:undefined);assert.equal(a.calls,b.calls,name);assert.equal(a.state,b.state,name);assert.equal(now.name,old.name);finite(now);assert.ok(draws(now)<=draws(old)+2,`${name} draws ${draws(now)} vs ${draws(old)}`);}
});
test('whale body is a closed smooth volume; small side eyes and rounded fins retain forward axis',()=>{
 const w=current.SWAMP_COMPONENT_BUILDERS.whale(rng().rnd),body=w.getObjectByName('swamp-beluga-continuous-body');closed(body.geometry);body.geometry.computeBoundingBox();const box=body.geometry.boundingBox;assert.ok(box.min.z< -4&&box.max.z>3.5);assert.ok(box.max.x<1.9);assert.ok(w.getObjectByName('swamp-beluga-rounded-fins'));assert.equal(w.userData.parts.length,3);
 let volume=0;const pos=body.geometry.attributes.position,idx=body.geometry.index.array;for(let i=0;i<idx.length;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,idx[i]),b=new THREE.Vector3().fromBufferAttribute(pos,idx[i+1]),c=new THREE.Vector3().fromBufferAttribute(pos,idx[i+2]);volume+=a.dot(b.cross(c))/6;}assert.ok(volume>0,'outward-facing closed body');
 const eyes=w.getObjectByName('swamp-beluga-side-eyes');eyes.geometry.computeBoundingBox();assert.ok(eyes.geometry.boundingBox.max.y-eyes.geometry.boundingBox.min.y<.16);assert.ok(eyes.geometry.boundingBox.max.z<3.0);
 for(const m of [body,w.getObjectByName('swamp-beluga-rounded-fins')])assert.equal(m.children[0].material.color.getHex(),0x514b64);
});
test('flower cup has closed thin walls, a floor under passengers and one line batch',()=>{
 for(const radius of [2.3,3.4,4.4]){const r=rng(),boat=current.SWAMP_COMPONENT_BUILDERS.lotusLeafBoat(r.rnd,radius),cup=boat.getObjectByName('swamp-flower-boat-cup');closed(cup.geometry);assert.equal(cup.children.length,0);assert.ok(boat.getObjectByName('swamp-flower-boat-veins').isLineSegments);const dolls=boat.children.filter(o=>o.name==='swamp-native-doll');assert.ok(dolls.length>=2&&dolls.length<=3);for(const doll of dolls){assert.ok(Math.hypot(doll.position.x,doll.position.z)<boat.userData.flowerCup.flatRadius);assert.ok(doll.position.y>=boat.userData.flowerCup.floorY);}
 cup.geometry.computeBoundingBox();assert.ok(cup.geometry.boundingBox.max.y>.4);assert.ok(cup.geometry.boundingBox.min.y>-.02);assert.ok(boat.userData.halo?.isSprite);finite(boat);}
});
test('wing and work-arm pivots remain available to existing animations',()=>{
 const b=current.SWAMP_COMPONENT_BUILDERS.swampBird(rng().rnd,0xd8ffe0);assert.ok(b.userData.wingL&&b.userData.wingR);b.userData.wingL.rotation.z=-1;b.userData.wingR.rotation.z=1;finite(b);
 const m=current.SWAMP_COMPONENT_BUILDERS.longTailMonkey(rng().rnd);for(const arm of [m.userData.armL,m.userData.armR]){assert.equal(arm.userData.baseRotX,-.3);arm.rotation.x=arm.userData.baseRotX-1.65;}finite(m);
});
test('actual factory preserves creature counts, pink hanger identity and story anchors',()=>{
 const before=original.createMoebiusSwampPlacement({scale:.5,seed:7711}),after=current.createMoebiusSwampPlacement({scale:.5,seed:7711});
 const collect=(root,name)=>{const a=[];root.traverse(o=>{if(o.name===name)a.push(o);});return a;};
 for(const [name,count] of [['swamp-bird',4],['swamp-longtail-monkey',5],['swamp-glow-lizard',4]]){const a=collect(before,name),b=collect(after,name);assert.equal(b.length,count,name);assert.equal(a.length,b.length);for(let i=0;i<a.length;i++){assert.deepEqual(b[i].position.toArray(),a[i].position.toArray(),name);assert.deepEqual(b[i].rotation.toArray(),a[i].rotation.toArray(),name);assert.equal(b[i].userData.phase,a[i].userData.phase,name);}}
 const h0=collect(before,'swamp-pink-hanger'),h1=collect(after,'swamp-pink-hanger');assert.equal(h1.length,h0.length);assert.ok(h1.length>0);for(let i=0;i<h0.length;i++)assert.deepEqual(h0[i].position.toArray(),h1[i].position.toArray());
 for(const name of ['swamp-lotus-leaf-boat','moebius-beluga-whale']){const a=collect(before,name),b=collect(after,name);assert.equal(a.length,b.length);for(let i=0;i<a.length;i++){assert.deepEqual(a[i].position.toArray(),b[i].position.toArray());assert.deepEqual(a[i].userData.swim,b[i].userData.swim);}}
 const a=before.userData.inner.userData.shipyard,b=after.userData.inner.userData.shipyard;assert.deepEqual(a.dock.position.toArray(),b.dock.position.toArray());assert.deepEqual(a.waterLizard.position.toArray(),b.waterLizard.position.toArray());assert.ok(b.waterLizard.children.length>1,'water carrier still owns its gourd/halo');
});

test('coral atmosphere stays local and attenuated throughout animation; visual rollback restores legacy glow',()=>{
 const saved=globalThis.location.search;
 globalThis.location.search='?swampV2=0&gregLakeVisuals=0';const legacy=current.createMoebiusSwampPlacement({scale:.5,seed:7711});
 globalThis.location.search='?swampV2=0';const coral=current.createMoebiusSwampPlacement({scale:.5,seed:7711});
 const glows=root=>{const out=[];root.traverse(o=>{if(o.userData.coralGlow)out.push(o);});return out;};
 const a=glows(legacy),b=glows(coral);assert.equal(a.length,b.length);assert.ok(b.length>80);
 const beforeCore=legacy.userData.inner.userData.giantFlowers.map(f=>f.userData.core),afterCore=coral.userData.inner.userData.giantFlowers.map(f=>f.userData.core);
 for(let i=0;i<a.length;i++){const u=b[i].userData.coralGlow;assert.equal(a[i].userData.coralGlow.opacityFactor,1);assert.equal(a[i].userData.coralGlow.sizeFactor,1);assert.ok(Math.abs(b[i].scale.x/a[i].scale.x-u.sizeFactor)<1e-12);assert.ok(Math.abs(b[i].material.opacity-a[i].material.opacity*u.opacityFactor)<1e-12);assert.equal(b[i].material.color.getHex(),a[i].material.color.getHex());}
 assert.equal(coral.userData.inner.userData.coralAtmosphere.shaftOpacityFactor,.25);
 assert.equal(legacy.userData.inner.userData.coralAtmosphere.shaftOpacityFactor,1);
 for(const time of [0,.25,1,6,12,30,60,120]){
  legacy.userData.inner.update(1/60,time,{});coral.userData.inner.update(1/60,time,{});
  for(let i=0;i<a.length;i++){const u=b[i].userData.coralGlow;assert.ok(Math.abs(b[i].material.opacity-a[i].material.opacity*u.opacityFactor)<1e-10,`halo at ${time}`);assert.ok(Math.abs(b[i].scale.x/a[i].scale.x-u.sizeFactor)<1e-12);}
  assert.ok(Math.abs(coral.getObjectByName('swamp-moon-shaft').material.opacity-legacy.getObjectByName('swamp-moon-shaft').material.opacity*.25)<1e-12);
  for(let i=0;i<beforeCore.length;i++)assert.ok(beforeCore[i].material.color.equals(afterCore[i].material.color),'flower bodies retain authored pulse brightness');
 }
 globalThis.location.search=saved;
});

test('ordinary lizards follow rendered rim/floor, turn before entrance, and retain legacy rollback and water carrier',()=>{
 const saved=globalThis.location.search;
 globalThis.location.search='';const scene=current.createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=scene.userData.inner,rim=inner.userData.gregCoralRim;
 assert.ok(rim?.ok);const ordinary=inner.children.filter(o=>o.name==='swamp-glow-lizard'&&o.userData.speed);
 assert.equal(ordinary.length,3);assert.equal(ordinary.filter(o=>o.userData.coralRoute.kind==='rim-ping-pong').length,2);
 const carrier=inner.userData.shipyard.waterLizard;assert.equal(carrier.userData.coralRoute,undefined);
 const floor=inner.getObjectByName('swamp-lake-floor');const ray=new THREE.Raycaster(),up=new THREE.Vector3(),down=new THREE.Vector3(0,-1,0),inverse=new THREE.Matrix4();
 function support(mesh,x,z,y){up.set(x,y+2,z).applyMatrix4(inner.matrixWorld);down.set(0,-1,0).transformDirection(inner.matrixWorld);ray.set(up,down);const hit=ray.intersectObject(mesh,false)[0];assert.ok(hit,`missing support ${x},${z}`);return hit.point.clone().applyMatrix4(inverse).y;}
 let minAngle=Infinity,maxAngle=-Infinity;
 for(let sample=0;sample<=240;sample++){
  const t=sample*2.75;inner.update(1/60,t,{});scene.updateMatrixWorld(true);inverse.copy(inner.matrixWorld).invert();
  for(const lz of ordinary){const route=lz.userData.coralRoute,mesh=route.kind==='rim-ping-pong'?rim.walkMeshes[0]:floor;
   const y=support(mesh,lz.position.x,lz.position.z,lz.position.y);assert.ok(Math.abs(lz.position.y+route.footMin-y)<1e-4,'feet rest on rendered top');
   assert.equal(lz.userData.orbitR,route.legacyOrbitR);assert.equal(lz.userData.baseY,route.legacyBaseY);
   // A disk enclosing every anatomical vertex must fit on real geometry. This
   // is stricter than only testing four feet and covers the long tail at turns.
   for(let k=0;k<16;k++){const a=k*Math.PI/8,x=lz.position.x+Math.cos(a)*route.envelopeRadius,z=lz.position.z+Math.sin(a)*route.envelopeRadius;assert.ok(Math.abs(support(mesh,x,z,y)-y)<1e-4,`${route.kind} time ${t} r ${Math.hypot(x,z)} support ${support(mesh,x,z,y)} expected ${y} point ${x},${z}`);if(route.kind==='rim-ping-pong'){const delta=Math.abs(Math.atan2(Math.sin(Math.atan2(z,x)-rim.entranceAngle),Math.cos(Math.atan2(z,x)-rim.entranceAngle)));assert.ok(delta>rim.entranceHalfAngle,'whole animal stays outside entrance gap');}}
   if(route.kind==='rim-ping-pong'){let a=Math.atan2(lz.position.z,lz.position.x);while(a<route.startAngle-.001)a+=Math.PI*2;assert.ok(a<=route.endAngle+.001);minAngle=Math.min(minAngle,a);maxAngle=Math.max(maxAngle,a);}
  }
 }
 assert.ok(maxAngle-minAngle>5,'route visits both turnarounds');
 globalThis.location.search='?gregLakeRim=0';const legacy=current.createMoebiusSwampPlacement({scale:.5,seed:7711}),oldInner=legacy.userData.inner;assert.equal(oldInner.userData.gregCoralRim,undefined);
 const oldLizards=oldInner.children.filter(o=>o.name==='swamp-glow-lizard'&&o.userData.speed);
 for(const t of [0,3,45,600]){oldInner.update(1/60,t,{});for(const lz of oldLizards){const u=lz.userData,a=t*u.speed+u.phase,r=u.orbitR+Math.sin(a*3.1)*1.4;assert.equal(u.coralRoute,undefined);assert.ok(Math.abs(lz.position.x-Math.cos(a)*r)<1e-12);assert.equal(lz.position.y,u.baseY);}}
 globalThis.location.search=saved;
});

test('falling and floating leaves are single two-sided tapered blades, preserve RNG and pool slots',()=>{
 const scene=current.createMoebiusSwampPlacement({scale:.5,seed:7711}),inner=scene.userData.inner;
 const falling=inner.userData.fallingLeaves,floating=inner.children.filter(o=>o.name==='swamp-floating-leaf');assert.equal(falling.length,60);assert.equal(floating.length,18);
 for(const leaf of [...falling,...floating]){assert.equal(leaf.children.length,0,'no inverse outline shell on open leaf');assert.equal(leaf.material.side,THREE.DoubleSide);assert.ok(!leaf.geometry.type.includes('Plane'));const p=leaf.geometry.attributes.position;leaf.geometry.computeBoundingBox();const box=leaf.geometry.boundingBox;for(let i=0;i<p.count;i++)if(Math.abs(p.getX(i))>box.max.x*.95)assert.ok(Math.abs(p.getY(i))<.01,'leaf tapers at both tips');assert.ok(p.count<=32);}
 const old=original.createMoebiusSwampPlacement({scale:.5,seed:7711});assert.equal(old.userData.inner.userData.fallingLeaves.length,falling.length);
 const oldFloats=old.userData.inner.children.filter(o=>o.userData.drift!==undefined&&o.userData.dRadius!==undefined);assert.equal(oldFloats.length,18);
 for(let i=0;i<18;i++){assert.deepEqual(floating[i].position.toArray(),oldFloats[i].position.toArray());assert.deepEqual(floating[i].rotation.toArray(),oldFloats[i].rotation.toArray());assert.equal(floating[i].userData.drift,oldFloats[i].userData.drift);}
});
