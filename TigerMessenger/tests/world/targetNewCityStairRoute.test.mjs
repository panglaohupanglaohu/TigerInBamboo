import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {compileOfficialOcean} from '../../src/world/waterV8/officialOcean.js';
import {applyTargetTerrainCandidate} from '../../src/world/citadel/targetTerrainCandidate.js';
import {solveTargetNewCityStairRoute,createTargetNewCityStairRoute,createTargetStairSurfaceSampler} from '../../src/world/citadel/targetNewCityStairRoute.js';

// Reproduce the recorded castle chart and frozen r09 mesh in CPU memory. This
// fixture is not a claim that the live renderer has been inspected this turn.
function frozenScene() {
  const scene = new THREE.Group(), castle = new THREE.Group(); scene.add(castle);
  castle.matrixAutoUpdate = false;
  castle.matrix.fromArray([-.5771265090244172,.12463062405961449,.807088718870361,0,.6354855835814281,.689249750214348,.3479839865419536,0,-.5129162364767383,.7137240288626759,-.4769852670498,0,124.43456408079132,72.61606956254715,90.15650671642375,1]);
  const source = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({side: THREE.DoubleSide}));
  source.name = 'citadel-oskar-grid-mountain-surface'; castle.add(source);
  const previous = globalThis.location;
  globalThis.location = {search: '?citadelTerrainFirst=1&citadelTargetRemesh=1&citadelTerraceAprons=1&citadelRecessedSaddle=1&citadelValleyBenches=1'};
  try {const obsolete = source.geometry; applyTargetTerrainCandidate(castle); obsolete.dispose();}
  finally {if (previous === undefined) delete globalThis.location; else globalThis.location = previous;}
  const compiled = compileOfficialOcean().ocean, geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(compiled.positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(compiled.indices, 1)); geometry.computeVertexNormals();
  const ocean = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({side: THREE.DoubleSide})); ocean.name = 'planet-v8-curved-ocean'; scene.add(ocean);
  const originalBuilding = new THREE.Group(); originalBuilding.name = 'old-city-preserved'; castle.add(originalBuilding);
  scene.updateMatrixWorld(true);
  return {scene, castle, source, ocean, originalBuilding, dispose() {for (const m of [source, ocean]) {m.geometry.dispose(); m.material.dispose();}}};
}

test('frozen final triangle route has no sampled buried treads',()=>{const f=frozenScene(), sampleSurface=createTargetStairSurfaceSampler(f.castle,[f.source]);const a=createTargetNewCityStairRoute({sampleSurface});console.log(JSON.stringify({status:a.report.status,failures:a.report.failures,length:a.report.selected?.length,count:a.report.selected?.treads.length,points:a.report.selected?.points}));assert.equal(a.report.status,'solved-sampled');let y=a.report.start[1];for(const t of a.report.selected.treads){assert.ok(t.top>=t.groundMax-1e-8);assert.ok(t.top<=y+1e-8);assert.ok(y-t.top<=.25*t.ds+1e-8);assert.ok(t.samples.every(p=>t.bottom<p.height));y=t.top;}assert.ok(Math.abs(y-3)<.025);a.dispose();f.dispose();});
test('wide high plateau cannot be hidden by centre-only sampling',()=>{const r=solveTargetNewCityStairRoute({start:[0,12,0],end:[0,3,50],sampleSurface:(x,z)=>Math.abs(x)>1?20:0});assert.equal(r.status,'no-route');assert.ok(r.failures['terrain-above-entry']);});
test('detached route deterministic and disposal leaves source sampler untouched',()=>{const opts={sampleSurface:(x,z)=>z<8?12:0,start:[0,12,0],end:[0,3,50],waypointRoutes:[[]]};const a=createTargetNewCityStairRoute(opts),b=createTargetNewCityStairRoute(opts);assert.deepEqual(a.report,b.report);assert.equal(a.group.parent,null);let released=0;for(const m of a.group.children)m.geometry.addEventListener('dispose',()=>released++);const n=a.group.children.length;a.dispose();a.dispose();assert.equal(released,n);b.dispose();});

test('r29 corner regressions: full-width platforms have no missing feet or transverse high steps',async()=>{
 const {createTargetNewCityMain}=await import('../../src/world/citadel/targetNewCityMain.js');
 const f=frozenScene(),sampleSurface=createTargetStairSurfaceSampler(f.castle,[f.source]),start=[63.383789506014665,12,40.43355061510956];
 const a=createTargetNewCityStairRoute({sampleSurface,start}),main=createTargetNewCityMain();f.castle.add(a.group,main.group);main.group.position.set(74,12,33);main.group.rotation.y=-55*Math.PI/180;f.scene.updateMatrixWorld(true);
 assert.equal(a.report.status,'solved-sampled');assert.equal(a.report.selected.landings.filter(t=>t.kind==='corner-landing').length,3);assert.deepEqual(a.report.selected.points.slice(2),[[48,71],[62,71],[62,64]]);
 const fourteen=a.report.selected.treads[14];assert.ok(Math.abs(fourteen.x-54.46119159252616)<1e-6);assert.ok(Math.abs(fourteen.z-43.33355061510956)<1e-6);assert.ok(Math.abs(fourteen.top-11.820296716518753)<1e-5,'bridge join height must stay fixed');
 const surfaces=[f.source,...a.group.children.filter(o=>o.name.startsWith('surveyed-route-tread-'))];main.group.traverse(o=>{if(o.isMesh&&/^entrance-stair-|entrance-landing/.test(o.name))surfaces.push(o);});const support=createTargetStairSurfaceSampler(f.castle,surfaces);
 const entry=[68.51168130326376,13.2,36.84296212355201],points=[...a.report.selected.walkPath].reverse();points.push(entry);
 for(let i=1;i<points.length;i++){
  const A=points[i-1],B=points[i],dx=B[0]-A[0],dz=B[2]-A[2],length=Math.hypot(dx,dz);if(length<1e-8)continue;const count=Math.max(1,Math.ceil(length/.25));
  for(let j=0;j<=count;j++){const k=j/count,p=A.map((v,n)=>v+(B[n]-v)*k),heights=[-.45,0,.45].map(side=>support(p[0]-dz/length*side,p[2]+dx/length*side)?.height);assert.ok(heights.every(Number.isFinite));const spread=Math.max(...heights)-Math.min(...heights);assert.ok(spread<=.30001,`transverse step ${spread} at ${p}`);assert.ok(Math.abs(Math.max(...heights)-p[1])<=.42,`route height gap at ${p}`);}
 }
 // Corner polygon vertices are shared with trimmed adjacent tread endpoints.
 for(const t of a.report.selected.landings){assert.ok(t.polygon.length>=4);assert.ok(t.top>=t.groundMax-1e-8);}
 a.dispose();main.dispose();f.dispose();
});

test('polygon landings do not overlap adjacent treads and side rails follow actual outer edges',()=>{
 const a=createTargetNewCityStairRoute({sampleSurface:()=>0,start:[0,5,0],end:[12,0,18],width:4.4,waypointRoutes:[[[0,18]]],entryLanding:false});assert.equal(a.report.status,'solved-sampled');
 const cross=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 function intersect(poly,boundary){let out=poly;for(let i=0;i<boundary.length&&out.length;i++){const a=boundary[i],b=boundary[(i+1)%boundary.length],input=out;out=[];for(let j=0;j<input.length;j++){const p=input[j],q=input[(j+1)%input.length],dp=cross(a,b,p),dq=cross(a,b,q);if(dp>=-1e-8)out.push(p);if((dp>=-1e-8)!==(dq>=-1e-8)){const f=dp/(dp-dq);out.push([p[0]+(q[0]-p[0])*f,p[1]+(q[1]-p[1])*f]);}}}return out;}
 const area=p=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;
 const ts=a.report.selected.treads;for(let i=0;i<ts.length;i++)for(let j=i+1;j<ts.length;j++)assert.ok(area(intersect(ts[i].polygon,ts[j].polygon))<1e-7,`${i}/${j} top polygons must be disjoint`);
 a.group.updateMatrixWorld(true);const rails=a.group.children.filter(m=>m.isInstancedMesh),points=a.report.selected.walkPath;
 for(let i=1;i<points.length;i++)for(const h of[.55,1.0,1.8]){
  const A=new THREE.Vector3(...points[i-1]).add(new THREE.Vector3(0,h,0)),B=new THREE.Vector3(...points[i]).add(new THREE.Vector3(0,h,0)),v=B.clone().sub(A);if(v.length()<1e-6)continue;
  assert.equal(new THREE.Raycaster(A,v.clone().normalize(),0,v.length()).intersectObjects(rails,false).length,0,'no parapet crosses landing centreline');
 }
 a.dispose();
});

test('r31 body obstruction: relocated rose house and persistent terminal side access clear actual six-house triangles',async()=>{
 const {createTargetNewCityStairs}=await import('../../src/world/citadel/targetNewCityStairs.js');
 const {createTargetNewCityMain}=await import('../../src/world/citadel/targetNewCityMain.js');
 const {createTargetBridgeStairConnector}=await import('../../src/world/citadel/targetBridgeStairConnector.js');
 const f=frozenScene(),sample=createTargetStairSurfaceSampler(f.castle,[f.source]),yaw=-55*Math.PI/180,start=[63.383789506014665,12,40.43355061510956],houseOffsets={'new-city-stair-house-1--1':[6.5*Math.cos(yaw),6.5*Math.sin(yaw)]};
 const houseOptions={surfaceHeightAt:(x,z)=>sample(74+x*Math.cos(yaw)+z*Math.sin(yaw),33-x*Math.sin(yaw)+z*Math.cos(yaw))?.height-12};
 const route=createTargetNewCityStairRoute({sampleSurface:sample,start,terminalAccess:{from:[72,68],width:2.4}}),main=createTargetNewCityMain(),houses=createTargetNewCityStairs({...houseOptions,houseOffsets}),before=createTargetNewCityStairs(houseOptions);
 for(const c of [...houses.group.children])if(!/^new-city-stair-house-/.test(c.name))houses.group.remove(c);
 for(const asset of[main,houses]){asset.group.position.set(74,12,33);asset.group.rotation.y=yaw;f.castle.add(asset.group);}f.castle.add(route.group);
 const connector=createTargetBridgeStairConnector({stairReport:route.report,groundHeightAt:(x,z)=>sample(x,z)?.height??null});f.castle.add(connector.group);route.setSideOpeningFootprints(connector.sideOpeningFootprints);
 assert.ok(route.report.parapets.openingFootprints.length>connector.sideOpeningFootprints.length,'refreshing bridge access retains the separate terminal entrance');
 const fourteen=route.report.selected.treads[14];assert.ok(Math.abs(fourteen.top-11.820296716518753)<1e-5);assert.ok(Math.abs(fourteen.x-54.46119159252616)<1e-6);
 const moved=houses.report.houses.find(h=>h.id==='new-city-stair-house-1--1'),old=before.report.houses.find(h=>h.id===moved.id),newCentre=new THREE.Vector3(...moved.position).applyAxisAngle(new THREE.Vector3(0,1,0),yaw).add(new THREE.Vector3(74,12,33));
 assert.ok(Math.abs(newCentre.x-55.96777551152006)<1e-6);assert.ok(Math.abs(newCentre.z-53.23013066355665)<1e-6);
 assert.ok(moved.position[1]!==old.position[1],'foundation is resampled at the new location, not translated with stale height');
 for(const h of houses.report.houses.filter(h=>h.id!==moved.id))assert.deepEqual(h,before.report.houses.find(p=>p.id===h.id));
 const fps=houses.report.footprints.filter(p=>p.role==='stair-flank-house');for(let i=0;i<fps.length;i++)for(let j=i+1;j<fps.length;j++){if(fps[i].id!==moved.id&&fps[j].id!==moved.id)continue;const a=fps[i].polygon,b=fps[j].polygon;assert.ok([0,1].some(k=>Math.max(...a.map(p=>p[k]))<=Math.min(...b.map(p=>p[k]))||Math.max(...b.map(p=>p[k]))<=Math.min(...a.map(p=>p[k]))),`house footprint overlap ${fps[i].id}/${fps[j].id}`);}
 f.scene.updateMatrixWorld(true);const supports=[f.source,...route.group.children.filter(o=>o.name.startsWith('surveyed-route-tread-'))],obstacles=[];main.group.traverse(o=>{if(o.isMesh){if(/^entrance-stair-|entrance-landing/.test(o.name))supports.push(o);else obstacles.push(o);}});houses.group.traverse(o=>{if(o.isMesh)obstacles.push(o);});connector.group.traverse(o=>{if(o.isMesh)obstacles.push(o);});obstacles.push(...route.group.children.filter(o=>o.isInstancedMesh));
 const support=createTargetStairSurfaceSampler(f.castle,supports),entry=[68.51168130326376,13.2,36.84296212355201],points=[[72,3,78],[72,3,68],...route.report.selected.walkPath.slice().reverse(),entry],rows=[];
 for(let i=1;i<points.length;i++){const A=points[i-1],B=points[i],dx=B[0]-A[0],dz=B[2]-A[2],len=Math.hypot(dx,dz)||1,n=Math.max(1,Math.ceil(len/.5));for(let j=0;j<=n;j++){const p=A.map((v,k)=>v+(B[k]-v)*j/n),heights=[-.45,0,.45].map(side=>support(p[0]-dz/len*side,p[2]+dx/len*side)?.height);assert.ok(heights.every(Number.isFinite));assert.ok(Math.max(...heights)-Math.min(...heights)<=.30001);assert.ok(Math.abs(Math.max(...heights)-p[1])<=.42);rows.push([p[0],Math.max(...heights),p[2]]);}}
 const hits=[],up=new THREE.Vector3(0,1,0).transformDirection(f.castle.matrixWorld);let probes=0;
 for(let i=1;i<rows.length;i++)for(const h of[.55,1.2,1.8])for(const side of[-.4,0,.4]){const a=new THREE.Vector3(...rows[i-1]),b=new THREE.Vector3(...rows[i]),dir=b.clone().sub(a),len=Math.hypot(dir.x,dir.z)||1,o=new THREE.Vector3(-dir.z/len*side,0,dir.x/len*side);a.add(o).applyMatrix4(f.castle.matrixWorld).addScaledVector(up,h);b.add(o).applyMatrix4(f.castle.matrixWorld).addScaledVector(up,h);const d=b.clone().sub(a);if(d.lengthSq()<1e-12)continue;probes++;const hit=new THREE.Raycaster(a,d.clone().normalize(),0,d.length()).intersectObjects(obstacles,false)[0];if(hit)hits.push({i,h,side,name:hit.object.name});}
 assert.deepEqual(hits,[]);assert.ok(probes>1000);console.log(JSON.stringify({r31BodyRegression:{probes,collisions:hits.length,rosePosition:newCentre.toArray(),houseGround:moved.position[1]+12,terminalOmissions:route.report.parapets.omittedSegments.filter(x=>x.treadIndex>75).length}}));
 for(const asset of[connector,route,main,houses,before])asset.dispose();f.dispose();
});

test('terminal access validates its coordinates and never changes tread geometry',()=>{
 const options={sampleSurface:()=>0,start:[0,2,0],end:[0,0,20],waypointRoutes:[[]],entryLanding:false};
 for(const terminalAccess of[{from:[NaN,20],width:2.4},{from:[2,20],width:0},{from:[0,20],width:2.4}])assert.throws(()=>createTargetNewCityStairRoute({...options,terminalAccess}),/terminalAccess/);
 const plain=createTargetNewCityStairRoute(options),open=createTargetNewCityStairRoute({...options,terminalAccess:{from:[6,18],width:2.4}});assert.deepEqual(open.report.selected,plain.report.selected);assert.ok(open.report.parapets.omittedSegments.length>0);const n=open.report.parapets.omittedSegments.length;open.setSideOpeningFootprints([]);assert.equal(open.report.parapets.omittedSegments.length,n);plain.dispose();open.dispose();
});
