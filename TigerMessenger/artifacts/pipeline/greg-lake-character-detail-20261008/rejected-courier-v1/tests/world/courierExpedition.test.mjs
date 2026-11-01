import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildHumanCourier,animateHumanCourier} from '../../src/assets/characters/humanCourier.js';
import {COURIER_HEIGHT} from '../../src/core/characterScale.js';
test('approved expedition courier keeps height, articulated delivery/ride poses and finite geometry',()=>{
 const root=buildHumanCourier({style:'expedition'}),u=root.userData;root.updateMatrixWorld(true);
 const bounds=new T.Box3().setFromObject(root,true);assert.ok(Math.abs(bounds.max.y-bounds.min.y-COURIER_HEIGHT)<1e-5);
 assert.equal(u.runtimeModel,'expedition-courier-1');assert.equal(u.headbandTails.length,2);
 assert.ok(root.getObjectByName('expedition-travel-backpack'));assert.ok(root.getObjectByName('expedition-postal-satchel'));
 for(const name of ['head','body','armL','armR','elbowL','elbowR','handL','handR','legL','legR','kneeL','kneeR','letter'])assert.ok(u[name]?.isObject3D,name);
 const player={velocity:new T.Vector3(0,0,4),onGround:true,holdingLetter:true};
 for(const pose of[{riding:false,onGround:true},{riding:true,onGround:true},{riding:false,onGround:false}]){Object.assign(player,pose);for(let i=0;i<20;i++)animateHumanCourier(player,root,.016,true);root.updateMatrixWorld(true);root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite));if(o.isMesh)assert.ok(Array.from(o.geometry.attributes.position.array).every(Number.isFinite));});assert.equal(u.letter.visible,true);}
 player.holdingLetter=false;animateHumanCourier(player,root,.016,false);assert.equal(u.letter.visible,false);
});
