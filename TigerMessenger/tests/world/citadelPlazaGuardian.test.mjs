import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildCitadelPlazaStatue} from '../../src/world/citadel/plazaStatue.js';
import {createCitadelTrojanHorse} from '../../src/assets/citadelTrojanHorse.js';
globalThis.document={getElementById(){return null;},addEventListener(){}};globalThis.window={addEventListener(){}};
const {createCitadelPlazaGuardian}=await import('../../src/world/citadel/citadelPlazaGuardian.js');
import {applyFleetHullDamage} from '../../src/world/fleetHullDamage.js';
import {tickAircraftTranqFall} from '../../src/world/tranquilizer.js';

function fixture({lease=true,sampleSupport,player=false}={}){
 const scene=new T.Scene(),castle=new T.Group();castle.position.y=160;scene.add(castle);
 const statue=buildCitadelPlazaStatue();statue.position.x=-12;castle.add(statue);const horse=createCitadelTrojanHorse();horse.position.x=8;horse.scale.setScalar(.72);castle.add(horse);
 const paving=new T.Mesh(new T.PlaneGeometry(100,100).rotateX(-Math.PI/2),new T.MeshBasicMaterial());paving.name='target-plaza-paving-surface';castle.add(paving);
 const fleet=new T.Group();scene.add(fleet);const members=[0,1].map(i=>{const m=new T.Group();m.userData={kind:'moebius-aircraft',formationIndex:i,arrowHits:3};m.position.set(10+i*7,185,0);fleet.add(m);return m;});fleet.userData.members=members;
 const leaseState={allowed:lease,pending:false,held:false,releases:0};const night={requestGuardianLease(){leaseState.pending=true;return leaseState.held=leaseState.allowed;},releaseGuardianLease(){leaseState.pending=leaseState.held=false;leaseState.releases++;}};
 let activeFleet=fleet;const sounds=[],attacks=[];const guardian=createCitadelPlazaGuardian({scene,castle,statue,horse,getFleet:()=>activeFleet,getPlayerAircraft:()=>player?members[0]:null,nightInfiltration:night,sampleSupport,thunder:o=>sounds.push(o),getAssault:()=>({onFleetUnderAttack:o=>attacks.push(o),designateTarget(){}})});
 const step=n=>{for(let i=0;i<n;i++){guardian.update(.1);scene.updateMatrixWorld(true);}};
 return{scene,castle,statue,horse,fleet,members,leaseState,guardian,sounds,attacks,step,leave:()=>{activeFleet=null;}};
}

test('real articulated statue mounts original horse, strikes flagship with real hull damage and restores exact transforms',()=>{
 const f=fixture(),rootMatrix=f.statue.matrix.clone(),horsePosition=f.horse.position.clone(),horseQ=f.horse.quaternion.clone();
 f.step(32);assert.equal(f.guardian.report.phase,'mounted');assert.equal(f.guardian.report.strikes,1);assert.equal(f.guardian.report.lastTarget.formationIndex,0);assert.equal(f.members[0].userData.robotHullHealth,600);assert.equal(f.members[0].userData.arrowHits,3);
 assert.equal(f.statue.userData.heroRig.bodyRoot.parent,f.horse.userData.ridingAnchors.seat);assert.ok(f.guardian.report.moves>0);assert.equal(f.guardian.report.lastSupport.samples,4);assert.ok(f.guardian.stormState.intensity>.5);assert.equal(f.sounds.length,1);assert.equal(f.attacks.length,1);assert.ok(f.statue.matrix.equals(rootMatrix));
 f.step(32);assert.equal(f.guardian.report.strikes,2);assert.equal(f.members[0].userData.tranqFall.phase,'fall');assert.equal(f.guardian.report.disabled,1);
 f.leave();f.step(100);assert.equal(f.guardian.report.phase,'idle');assert.equal(f.statue.userData.heroRig.bodyRoot.parent,f.statue);assert.ok(f.horse.position.equals(horsePosition));assert.ok(f.horse.quaternion.equals(horseQ));assert.equal(f.leaseState.held,false);f.guardian.dispose();assert.equal(f.guardian.stormState.intensity,0);
});

test('night soldiers must return before awakening, and departing fleet releases a pending lease',()=>{
 const f=fixture({lease:false});f.step(60);assert.equal(f.guardian.report.phase,'waiting');assert.equal(f.guardian.report.strikes,0);assert.equal(f.statue.userData.heroRig.bodyRoot.parent,f.statue);assert.equal(f.leaseState.pending,true);
 f.leave();f.step(1);assert.equal(f.guardian.report.phase,'idle');assert.equal(f.leaseState.pending,false);f.guardian.dispose();
});

test('player-driven lead is excluded; unsupported plaza prevents mounting or floating horse movement',()=>{
 const f=fixture({player:true});f.step(32);assert.equal(f.guardian.report.lastTarget.formationIndex,1);assert.equal(f.members[0].userData.robotHullHealth,undefined);f.guardian.dispose();
 const blocked=fixture({sampleSupport:()=>null});blocked.step(100);assert.equal(blocked.guardian.report.strikes,0);assert.equal(blocked.guardian.report.phase,'waiting');assert.equal(blocked.horse.position.x,8);blocked.guardian.dispose();
});

test('mechanical damage shares existing knockdown/recovery and never changes whale arrow damage',()=>{
 const parent=new T.Group(),m=new T.Group();parent.add(m);m.position.set(0,180,0);m.userData={kind:'moebius-aircraft',arrowHits:17};
 assert.equal(applyFleetHullDamage(m,1200).damage,1200);assert.equal(applyFleetHullDamage(m,1200).disabled,true);assert.equal(m.userData.robotHullHealth,450);assert.equal(m.userData.arrowHits,17);assert.equal(applyFleetHullDamage(m,1200).accepted,false);
 for(let i=0;i<500;i++)tickAircraftTranqFall(m,.1,160,new T.Vector3(0,180,0));assert.equal(m.userData.tranqFall,null);assert.equal(m.userData.arrowHits,17);assert.equal(applyFleetHullDamage(m,100,{source:'robot-defense'}).health,350);
 const airship=new T.Group();parent.add(airship);airship.userData.kind='moebius-airship';assert.equal(applyFleetHullDamage(airship,1200).accepted,false);
});

test('real hostile fleet membership and local city range are required; airship and hidden fleet never trigger',()=>{
 const f=fixture();f.members.forEach(m=>m.userData.kind='moebius-airship');f.step(80);assert.equal(f.guardian.report.awakenings,0);
 f.members.forEach(m=>{m.userData.kind='moebius-aircraft';m.position.set(200,185,0);});f.step(50);assert.equal(f.guardian.report.awakenings,0);
 f.members.forEach(m=>m.position.set(10,185,0));f.fleet.visible=false;f.step(50);assert.equal(f.guardian.report.awakenings,0);
 f.fleet.visible=true;f.members.forEach(m=>m.userData.team='friendly');f.step(50);assert.equal(f.guardian.report.awakenings,0);f.guardian.dispose();
});

test('large delta cannot produce repeated lightning in one tick and dispose restores a mounted actor',()=>{
 const f=fixture();f.step(30);const strikes=f.guardian.report.strikes;f.guardian.update(100);assert.ok(f.guardian.report.strikes<=strikes+1);assert.equal(f.statue.userData.heroRig.bodyRoot.parent,f.horse.userData.ridingAnchors.seat);
 f.guardian.dispose();assert.equal(f.statue.userData.heroRig.bodyRoot.parent,f.statue);assert.equal(f.leaseState.held,false);assert.equal(f.guardian.storm.group.parent,null);assert.equal(f.guardian.stormState.active,false);
});


test('entering hostile flagship awakens metal, waiting stays stone and exact stone materials return',()=>{
 const f=fixture({lease:false}),appearance=f.statue.userData.guardianAppearance;
 assert.ok(appearance,'production statue must expose the stone/metal appearance owner');
 const body=f.statue.userData.heroRig.bodyRoot,original=new Map();body.traverse(o=>{if(o.isMesh)original.set(o,o.material);});
 f.step(2);assert.equal(f.guardian.report.phase,'waiting');assert.equal(appearance.awake,false);
 f.leaseState.allowed=true;f.step(32);assert.equal(f.guardian.report.phase,'mounted');assert.equal(appearance.awake,true);
 assert.ok([...original].some(([mesh,material])=>mesh.material!==material));
 assert.equal(f.guardian.report.events.some(e=>e.type==='invasion-detected'&&e.formationIndex===0),true);
 f.leave();f.step(110);assert.equal(appearance.awake,false);for(const[mesh,material]of original)assert.equal(mesh.material,material);
 f.guardian.dispose();assert.equal(appearance.awake,false);
});
