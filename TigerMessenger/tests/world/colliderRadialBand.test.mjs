import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {resolveSphericalColliders} from '../../src/planet/sphericalPlayer.js';
const player=()=>({position:new T.Vector3(0,161,0),forward:new T.Vector3(1,0,0)});
test('banded collider only blocks within its radial band; unbanded keeps old behaviour',()=>{
 const deckPost={position:new T.Vector3(.3,167.5,0),radius:.4,minR:166,maxR:171};
 const a=player();resolveSphericalColliders(a,[deckPost]);assert.equal(a.position.x,0,'ground walker passes under a deck railing');
 const b=player();b.position.set(0,166.6,0);resolveSphericalColliders(b,[deckPost]);assert.ok(Math.abs(b.position.x)>.1,'deck walker is stopped by the railing');
 const c=player();resolveSphericalColliders(c,[{position:new T.Vector3(.3,167.5,0),radius:.4}]);assert.ok(Math.abs(c.position.x)>.1,'no band = infinite post as before');
});
