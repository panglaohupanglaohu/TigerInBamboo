import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Vector3} from 'three';
// CPU-only route construction. HUD/audio imports have no real DOM or audio
// services in this test; no browser is launched or controlled.
globalThis.document={getElementById:()=>null};
globalThis.window={addEventListener(){}};
const {createChristchurchTramSourceCurves}=await import('../../src/world/tramSystem.js');

test('production route extraction preserves every previously recorded red and blue global sample',()=>{
  const recorded=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-live-tram-clearance-20261006/global-tram-samples.json',import.meta.url)));
  const curves=createChristchurchTramSourceCurves(160);
  for(const key of ['red','blue']) {
    assert.ok(Math.abs(curves[key].getLength()-recorded.lanes[key].length)<1e-7);
    for(const p of recorded.lanes[key].samples)assert.ok(curves[key].getPointAt(p.u).distanceTo(new Vector3(...p.world))<1e-7,`${key} ${p.u}`);
  }
  for(const c of [curves.center,curves.red,curves.blue]) {
    assert.equal(c.closed,true);
    assert.ok(c.getPointAt(0).distanceTo(c.getPointAt(1))<1e-8);
  }
});
