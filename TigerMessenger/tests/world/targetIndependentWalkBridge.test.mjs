import test from 'node:test';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as T from 'three';
import {actualCliffTransitFixture} from './targetCliffTransitStructure.fixture.mjs';
import {createTargetCityDetailCandidate} from '../../src/world/citadel/targetCityDetailCandidate.js';
import {createTargetCliffTransitStructure} from '../../src/world/citadel/targetCliffTransitStructure.js';

const drawnXZ=[[-31,11],[-28,20],[-20,27],[-8,31],[16,38],[49,45]];
test('optional drawn short walk bridge replaces long links and reaches actual stair side with finite player and loaded train clearance',()=>{
 const f=actualCliffTransitFixture(),original=f.release.curves.red.getPointAt(.6).toArray(),release={...f.release,walkingConnection:{kind:'independent-short-bridge',pathXZ:drawnXZ}};
 const c=createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:release,fitSunShadow:false});f.castle.add(c.root);const provider=c.getPlayerSupport(),r=c.report.cliffTransit,b=r.independentWalkingBridge,connector=c.report.bridgeConnector,failures=[];let queries=0;
 try{
  assert.equal(r.walkingMode,'independent-short-bridge');assert.deepEqual(r.connections,[]);assert.equal(c.root.getObjectByName('old-city-cliff-link'),undefined);assert.equal(c.root.getObjectByName('new-city-cliff-link'),undefined);assert.ok(c.root.getObjectByName('cliff-transit-central'));assert.ok(c.root.getObjectByName('citadel-independent-short-walk-bridge'));
  assert.equal(r.finitePass,true,JSON.stringify(r.issues));assert.equal(b.supportSampledPass,true);assert.equal(b.terrainClearance.pass,true);assert.equal(b.vehicleClearance.pass,true);assert.equal(b.vehicleClearance.envelope.top,5.36);assert.equal(b.removedLongCityLinks,true);assert.equal(b.endApronExtension,.35);assert.equal(c.report.bridge.independentFromRail,true);
  assert.deepEqual(b.requestedPathXZ,drawnXZ);assert.deepEqual(release.walkingConnection.pathXZ,drawnXZ);assert.ok(b.oldApproachLength<8);assert.ok(connector.length<6);assert.ok(connector.walkSurfaces.length>0);assert.ok(connector.support.uniqueSamples>0);assert.equal(connector.support.validated,true);assert.equal(connector.stairOverlapAreaRemaining,0);assert.deepEqual(b.path.at(-1),connector.dock);
  const walk=[...b.path,connector.endpoint];
  for(const reverse of[false,true])for(const lateral of[-.4,0,.4]){const points=(reverse?[...walk].reverse():walk).map(p=>new T.Vector3(...p));let previous=null;
   for(let j=1;j<points.length;j++){const a=points[j-1],z=points[j],side=new T.Vector3(z.z-a.z,0,a.x-z.x).normalize(),n=Math.ceil(a.distanceTo(z)/.1);
    for(let i=0;i<=n;i++){const local=a.clone().lerp(z,i/n).addScaledVector(side,lateral),world=local.clone().applyMatrix4(f.castle.matrixWorld),radius=provider.ground(world);queries++;if(radius===null||Math.abs(radius-world.length())>.3)failures.push({type:'ground',reverse,lateral,j,i,local:local.toArray(),radius,difference:radius===null?null:radius-world.length(),hit:provider.report().lastGround});if(radius!==null)world.setLength(radius);if(previous&&provider.walls(previous,world.clone(),world.clone().sub(previous)))failures.push({type:'body',reverse,lateral,j,i,local:local.toArray(),hit:provider.report().lastWall});previous=world;}
   }
  }
  if(process.env.CITADEL_SHORT_BRIDGE_REPORT)writeFileSync(process.env.CITADEL_SHORT_BRIDGE_REPORT,JSON.stringify({scope:'actual inner release plus optional hand-drawn short bridge; not yet new rail route or GPU',bridge:b,connector,issues:r.issues,vehicleClearance:r.vehicleClearance,body:{queries,step:.1,lateral:[-.4,0,.4],failures},gpuVerified:false},null,2)+'\n');
  assert.ok(queries>6000);assert.deepEqual(failures,[]);assert.deepEqual(f.release.curves.red.getPointAt(.6).toArray(),original);
  const geometry=new Set();c.root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);});let count=0;for(const g of geometry)g.addEventListener('dispose',()=>count++);c.dispose();c.dispose();assert.equal(count,geometry.size);
 }finally{c.dispose();f.dispose();}
});

test('independent walk spec rejects nonfinite input, narrow deck and mismatched city ports instead of silently reverting',()=>{
 const f=actualCliffTransitFixture(),options={release:f.release,sampleTerrain:()=>-100,sampleSea:()=>-10,connectionTargets:{old:[0,10,0],new:[30,10,0]}};
 try{
  assert.throws(()=>createTargetCliffTransitStructure({...options,walkingConnection:{kind:'wrong',path:[[0,10,0],[30,10,0]]}}),/walkingConnection/);
  assert.throws(()=>createTargetCliffTransitStructure({...options,walkingConnection:{kind:'independent-short-bridge',width:2,path:[[0,10,0],[30,10,0]]}}),/width/);
  assert.throws(()=>createTargetCliffTransitStructure({...options,walkingConnection:{kind:'independent-short-bridge',path:[[1,10,0],[30,10,0]]}}),/actual old public port/);
  const children=[...f.castle.children];assert.throws(()=>createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:{...f.release,walkingConnection:{kind:'independent-short-bridge',pathXZ:[[0,0],[NaN,0]]}},fitSunShadow:false}),/pathXZ/);assert.deepEqual(f.castle.children,children);
 }finally{f.dispose();}
});
