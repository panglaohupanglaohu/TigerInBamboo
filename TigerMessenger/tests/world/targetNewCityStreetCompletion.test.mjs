import test from 'node:test';
import assert from 'node:assert/strict';
import {createTargetNewCityStairs} from '../../src/world/citadel/targetNewCityStairs.js';
const far=[{id:'far',polygon:[[100,100],[101,100],[101,101],[100,101]]}];
const protectedCourt=[{id:'actual-court',polygon:[[-100,-100],[100,-100],[100,100],[-100,100]]}];
test('completed primary street rejection is not a startup fatal or permission to build in protected space',()=>{
 const a=createTargetNewCityStairs({surfaceHeightAt:()=>0});
 assert.throws(()=>a.completeSecondaryStreetClusters({enabled:true,publicFootprints:far,protectedFootprints:far}),/primary street infill first/);
 const primary=a.completeStreetInfill({publicFootprints:far,protectedFootprints:protectedCourt});
 assert.equal(primary.modules.length,0);assert.equal(primary.finitePass,false);assert.equal(primary.rejected.length,4);
 const secondary=a.completeSecondaryStreetClusters({enabled:true,publicFootprints:far,protectedFootprints:protectedCourt});
 assert.equal(secondary.enabled,true);assert.equal(secondary.modules.length,0);assert.equal(secondary.finitePass,false);assert.equal(secondary.rejected.length,8);a.dispose();
});
test('missing terrain rejects optional rooms but nonfinite terrain still throws',()=>{
 const a=createTargetNewCityStairs({surfaceHeightAt:()=>null});
 const primary=a.completeStreetInfill({publicFootprints:far});assert.equal(primary.modules.length,0);
 const secondary=a.completeSecondaryStreetClusters({enabled:true,publicFootprints:far,protectedFootprints:far});assert.equal(secondary.modules.length,0);assert.ok(secondary.rejected.some(p=>p.reason==='actual-terrain-missing'));a.dispose();
 let invalid=false;const b=createTargetNewCityStairs({surfaceHeightAt:()=>invalid?NaN:0});invalid=true;assert.throws(()=>b.completeStreetInfill({publicFootprints:far}),/nonfinite/);assert.throws(()=>b.completeSecondaryStreetClusters({enabled:true,publicFootprints:far,protectedFootprints:far}),/primary street infill first/);b.dispose();
});
