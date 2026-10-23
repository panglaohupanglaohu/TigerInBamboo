import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {installSwampHarborScene,overviewCamera,HARBOR_OVERVIEW}=await import('../../src/world/swampHarborScene.js');
const {pruneTaggedOfficialOceanOccludeds}=await import('../../src/core/officialOceanOcclusionPruning.js');
const {crystalV7SwampDir}=await import('../../src/world/crystalV7Layout.js');
const {createSwampLivingPathConstraints}=await import('../../src/world/swampGregLivingPaths.js');


const swamp=createMoebiusSwampPlacement({seed:7711,scale:.5});
const inner=swamp.userData.inner;
const before={};inner.traverse(o=>{if(['swamp-longtail-monkey','swamp-pink-hanger'].includes(o.name))before[o.uuid]=o;});
const h=installSwampHarborScene({swamp,departure:'original',workerScale:1});
const repair=h.monkeyRepair;
assert.deepEqual(repair.report.identities,{mastWorkers:2,longTail:3,chili:3});
assert.equal(repair.report.participants.length,6);
assert.ok(h.pier.segments.filter(s=>s.name==='cliff-work-quay').length>=6);
for(const p of repair.report.participants)assert.ok(before[p.uuid]);
const snapshots=[];for(const time of [0,3,6,10,13]){swamp.userData.update(.05,time,{});h.update(time);snapshots.push({time,mast:inner.userData.shipyard.mastPivot.rotation.z,workers:repair.report.participants.map(p=>({...p})),tools:repair.report.participants.map(p=>{const a=before[p.uuid];const tool=a.getObjectByName('swamp-existing-monkey-'+p.role);a.updateWorldMatrix(true,true);return tool.getWorldPosition(new T.Vector3()).toArray();})});}
assert.ok(new Set(snapshots.map(s=>s.mast)).size>1,'original mast cycle alive');
for(let i=0;i<6;i++)assert.ok(snapshots.some(s=>s.tools[i].some((v,k)=>Math.abs(v-snapshots[0].tools[i][k])>.005)),'actual held tool moves '+i);
assert.ok(repair.report.participants.every(p=>Math.hypot(p.station[0],p.station[2])<35.4),'outside 2m main ribbon');
let lotusGap=Infinity; const distance=(p,s)=>{const a=new T.Vector3(...s.from),b=new T.Vector3(...s.to),d=b.clone().sub(a);d.y=0;const q=Math.max(0,Math.min(1,p.clone().sub(a).dot(d)/d.lengthSq()));return Math.hypot(p.x-a.x-q*d.x,p.z-a.z-q*d.z)-s.width/2;};
for(let k=0;k<600;k++){const time=k*.2;swamp.userData.update(.2,time,{});h.update(time);for(const r of inner.userData.flowerBoyActivities.navigation.records)for(const s of h.pier.segments)lotusGap=Math.min(lotusGap,distance(r.boat.position,s)-r.radius);}
assert.ok(lotusGap>0,'flower navigation footprint never overlaps the cliff quay '+lotusGap);
console.log(JSON.stringify({lotusGap,pier:h.report.pier,repair:repair.report,snapshots},null,2));
