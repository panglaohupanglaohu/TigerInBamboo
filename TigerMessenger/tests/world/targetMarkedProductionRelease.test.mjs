import test from 'node:test';
import assert from 'node:assert/strict';
import {actualUserMarkedStructureFixture} from './targetUserMarkedStructure.fixture.mjs';
import {createTargetUserMarkedProductionRelease} from '../../src/world/citadel/targetUserMarkedProductionRelease.js';
import {prepareCitadelRailStartup} from '../../src/world/citadel/citadelRailStartup.js';

test('production marked route matches the audited route and preserves source joins and open western approach',()=>{
  const f=actualUserMarkedStructureFixture();
  try {
    const r=createTargetUserMarkedProductionRelease({sourceCurves:f.sourceCurves});
    const startup=prepareCitadelRailStartup(f.sourceCurves,r.specs);
    assert.ok(startup.splice,JSON.stringify(startup.report));
    for(const lane of ['red','blue','center']) {
      for(let i=0;i<=100;i++)assert.ok(r.curves[lane].getPointAt(i/100).distanceTo(f.release.curves[lane].getPointAt(i/100))<1e-7);
      const [a,b]=r.report.retainedOldSourceIntervals[lane];
      assert.equal(a,r.specs[lane].endU);
      assert.ok(b>a&&b<1);
      for(const u of [0,.2,.4,.95])assert.ok(startup.curves[lane].getPointAt(startup.splice.lanes[lane].mapOriginalProgress(u).progress).distanceTo(f.sourceCurves[lane].getPointAt(u))<.01);
    }
    assert.equal(r.coastalCliffCuts.protectedPolygons.length,3);
    assert.equal(r.structureOptions.galleryPierWidths.oldShore,.9);
    assert.equal(r.walkingConnection.kind,'stacked-connected');
  } finally { f.dispose(); }
});
