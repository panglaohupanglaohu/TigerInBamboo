import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
globalThis.document={getElementById:()=>null};globalThis.window={addEventListener(){}};
const {createBatianFleet}=await import('../../src/world/batianFleet.js');
test('production fleet snapshot never calls the defender snapshot that already reads fleet cycle',()=>{
 const scene=new T.Scene(),aircraft=new T.Group(),squad=new T.Group(),member=new T.Group(),battle=new T.Group();
 scene.add(aircraft,squad,battle);squad.add(member);squad.userData.members=[member];battle.name='saihoji-phalanx-battle';let reads=0;
 const fleet=createBatianFleet({scene,flagship:{aircraft},squad,targets:[{id:'moss',label:'moss',dir:new T.Vector3(0,1,0)}]});
 battle.userData.getBattleSnapshot=()=>{reads++;return{ambush:{stage:'landing'},cycle:fleet.snapshot().cycle};};
 for(let i=0;i<5;i++){assert.equal(fleet.snapshot().saihojiLandingHold,false);assert.equal(battle.userData.getBattleSnapshot().cycle,0);}
 assert.equal(reads,5,'only explicit defender reads; no recursive fleet->defender->fleet chain');fleet.dispose();
});
