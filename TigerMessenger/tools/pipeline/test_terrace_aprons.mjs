import assert from 'node:assert/strict';
import {register} from 'node:module';
const threeURL=new URL('../../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const T=await import('three');
const {targetTerrainHeight,TARGET_CITY_PLATFORMS,applyTargetTerrainCandidate}=await import('../../src/world/citadel/targetTerrainCandidate.js');
const {createCastleOceanSampler}=await import('../../src/world/citadel/newCityRidgeCandidate.js');
const frame=new T.Matrix4().fromArray([-.5771265090244172,.12463062405961449,.807088718870361,0,.6354855835814281,.689249750214348,.3479839865419536,0,-.5129162364767383,.7137240288626759,-.4769852670498,0,124.43456408079132,72.61606956254715,90.15650671642375,1]);
const sea=createCastleOceanSampler(frame,160),rows=[];let before=0,after=0;
for(let z=0;z<=80;z++){let b=0,a=0;for(let x=-40;x<=45;x++){const h=sea(x,z);if(h===null)continue;if(targetTerrainHeight(x,z,h)<h)b++;if(targetTerrainHeight(x,z,h,{aprons:true})<h)a++;}before+=b;after+=a;rows.push({z,before:b,after:a});}
for(const p of TARGET_CITY_PLATFORMS)for(const dx of [-.35,0,.35])for(const dz of [-.35,0,.35]){const x=p.center[0]+dx*p.radii[0],z=p.center[1]+dz*p.radii[1];assert.ok(Math.abs(targetTerrainHeight(x,z,sea(x,z),{aprons:true})-p.height)<.3);}
for(let x=-130;x<=130;x+=5)for(let z=-60;z<=10;z+=5){const h=sea(x,z);if(h===null)continue;assert.equal(targetTerrainHeight(x,z,h,{aprons:true}),targetTerrainHeight(x,z,h),'rear shoulder unchanged');}
const castle=new T.Group();castle.matrixAutoUpdate=false;castle.matrix.copy(frame);const mesh=new T.Mesh(new T.BoxGeometry());mesh.name='citadel-oskar-grid-mountain-surface';castle.add(mesh);globalThis.location={search:'?citadelTerrainFirst=1&citadelTargetRemesh=1&citadelTerraceAprons=1'};const report=applyTargetTerrainCandidate(castle);assert.equal(report.mesh.closed,true);assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
assert.ok(after>=before,'aprons must not fill existing bay water');assert.ok(rows.every(r=>r.after>=r.before),'every sampled bay cross-section retains water width');
const evidence={closed:true,platformsFlat:true,rearShouldersUnchanged:true,baySampling:{bounds:{x:[-40,45],z:[0,80]},step:1,before,after,waterAreaLoss:1-after/before,rows},report};console.log(JSON.stringify(evidence,null,2));
