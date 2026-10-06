import test from 'node:test';
import assert from 'node:assert/strict';
import {eastCliffFinalSurfaceFixture} from '../../tools/pipeline/east_cliff_final_surface_fixture.mjs';
test('production source frame and full refinement reproduce observed live final epoch',()=>{
 const f=eastCliffFinalSurfaceFixture();try{
  assert.equal(f.epoch.after.position,2638422502);assert.equal(f.epoch.after.index,null);
  assert.equal(f.epoch.after.vertices,331512);assert.equal(f.epoch.after.refinement.refined,2669);
  assert.equal(f.epoch.after.refinement.maxOffset,.2193362385370818);
  assert.equal(f.epoch.after.surfaceNormals.pass,4);
  assert.ok(Math.abs(f.epoch.after.sourceToCastle[12]+52)<1e-10);
  assert.deepEqual(f.epoch.after.localBounds.min,[-91,-159.79254150390625,-72]);
 }finally{f.dispose();}
});
