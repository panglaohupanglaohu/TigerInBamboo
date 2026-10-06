import {register} from 'node:module';
const threeURL=new URL('../../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const T=await import('three');
const {applyTargetTerrainCandidate,targetTerrainHeight,TARGET_CITY_PLATFORMS}=await import('../../src/world/citadel/targetTerrainCandidate.js');
const {default:assert}=await import('node:assert/strict');
globalThis.location={search:'?citadelTerrainFirst=1&citadelTargetRemesh=1'};
const castle=new T.Group();castle.matrixAutoUpdate=false;castle.matrix.fromArray([-.5771265090244172,.12463062405961449,.807088718870361,0,.6354855835814281,.689249750214348,.3479839865419536,0,-.5129162364767383,.7137240288626759,-.4769852670498,0,124.43456408079132,72.61606956254715,90.15650671642375,1]);
const mesh=new T.Mesh(new T.BoxGeometry());mesh.name='citadel-oskar-grid-mountain-surface';castle.add(mesh);const report=applyTargetTerrainCandidate(castle);assert.equal(report.mesh.closed,true);assert.equal(report.mesh.components,1);assert.ok(report.mesh.invalidCells>0);assert.ok(Array.from(mesh.geometry.attributes.position.array).every(Number.isFinite));
for(const p of TARGET_CITY_PLATFORMS)for(const dx of [-.35,0,.35])for(const dz of [-.35,0,.35]){const h=targetTerrainHeight(p.center[0]+dx*p.radii[0],p.center[1]+dz*p.radii[1],-20);assert.ok(Math.abs(h-p.height)<.3,`buildable platform ${p.id}`);}
assert.equal(targetTerrainHeight(0,50,-20),-23,'bay remains open below ocean');
assert.ok(targetTerrainHeight(-3,-41,-20)<20,'central saddle stays below high shoulders');
const fresh=new T.Group(),m=new T.Mesh(new T.BoxGeometry());m.name=mesh.name;fresh.add(m);globalThis.location.search='';const g=m.geometry;assert.equal(applyTargetTerrainCandidate(fresh),null);assert.equal(m.geometry,g);
console.log(JSON.stringify({pass:true,report,checks:['finite closed domain-clipped geometry','3 buildable platforms with <.3m relief','open bay','low central saddle','default off']},null,2));
