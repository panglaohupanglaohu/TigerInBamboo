import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {auditTargetCityWalking} from '../../tools/pipeline/target_city_walk_audit.js';
import {createTargetCityPlayerSupport} from '../../src/world/citadel/targetCityPlayerSupport.js';
test('external route audit detects unregistered actual promenade rather than trusting its label',()=>{
 const castle=new T.Group();castle.position.y=160;const root=new T.Group();castle.add(root);
 const terrain=new T.Mesh(new T.PlaneGeometry(20,20),new T.MeshBasicMaterial());terrain.rotation.x=-Math.PI/2;terrain.position.y=-2;castle.add(terrain);
 const deck=new T.Mesh(new T.BoxGeometry(2,.2,4),new T.MeshBasicMaterial());deck.position.y=.1;deck.name='front-bay-promenade-stone-deck';root.add(deck);castle.updateMatrixWorld(true);
 const provider=createTargetCityPlayerSupport({castle,candidateRoot:root,finalTerrain:terrain});
 const parapet=deck.clone();parapet.name='old-waterfront-side-parapets-open-ends';parapet.position.y=2;root.add(parapet);castle.updateMatrixWorld(true);
 const candidate={root,report:{}};let audit=auditTargetCityWalking({THREE:T,castle,candidate,provider});
 assert.deepEqual(audit.externalMeshes,[deck.name]);assert.ok(audit.failures>0,'unregistered deck must not silently use the lower terrain');
 deck.userData.targetWalkable=true;provider.refresh();audit=auditTargetCityWalking({THREE:T,castle,candidate,provider});
 assert.equal(audit.failures,0);assert.ok(audit.ground.length>=2);assert.equal(audit.actualPlayerWalked,false);assert.equal(audit.productionInstalled,false);
 provider.dispose();terrain.geometry.dispose();terrain.material.dispose();deck.geometry.dispose();deck.material.dispose();
});
