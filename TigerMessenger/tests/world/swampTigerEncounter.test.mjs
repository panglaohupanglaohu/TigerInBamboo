import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {installSwampOppositeLanding} from '../../src/world/swampOppositeLanding.js';
import {installSwampTigerEncounter} from '../../src/world/swampTigerEncounter.js';
for(const [label,random]of [['swim',()=>0],['boat',()=>.5],['whale',()=>.99]])test(label+' arrives continuously after opposite-shore eye contact using existing actors',()=>{
 const s=new THREE.Group(),t=new THREE.Group(),boat=new THREE.Group(),whale=new THREE.Group();s.userData.waterY=25;s.userData.tiger=t;s.add(t,boat,whale);boat.position.set(8,25,6);whale.position.set(12,24,8);s.userData.shipyard={barge:boat,escort:whale};const ground=new THREE.Mesh(new THREE.BoxGeometry(80,.2,80),new THREE.MeshBasicMaterial());ground.position.y=39.9;s.add(ground);s.userData.tigerWalkSurfaces=[ground];t.userData.tigerRoam={rim:[new THREE.Vector3(37.4,40,0)],drink:new THREE.Vector3(26,25.25,0),steps:[new THREE.Vector3(36,39,0),new THREE.Vector3(33,35,0),new THREE.Vector3(29,30,0),new THREE.Vector3(26,25.25,0)]};t.position.copy(t.userData.tigerRoam.drink);t.userData._baseY=t.position.y;t.userData._mode='drink';s.update=()=>{};
 const c=installSwampTigerEncounter(s,{random}),player={position:new THREE.Vector3(33,40,0)},phases=new Set(),prior=t.position.clone();let max=0;
 for(let i=0;i<9000&&c.report.cycles<1;i++){c.step(1/30,i/30,player);c.syncCarrier(i/30);phases.add(c.report.phase);max=Math.max(max,Math.hypot(t.position.x-prior.x,t.position.z-prior.z));prior.copy(t.position);}
 assert.equal(c.report.transport,label);assert.equal(c.report.cycles,1);assert.ok(c.report.eyeContactSeconds>=3);assert.ok(phases.has('eye-contact')&&phases.has('meeting')&&phases.has('patrol-swim'));assert.ok(max<.3,'no tiger horizontal teleport: max frame displacement '+max);assert.ok(Math.hypot(t.position.x-t.userData.tigerRoam.drink.x,t.position.z-t.userData.tigerRoam.drink.z)<.1);assert.equal(s.userData.oppositeLanding.surfaces.length,18);assert.ok(s.userData.oppositeLanding.laneWidth>=4);
 if(label!=='swim'){assert.ok(phases.has('pickup')&&phases.has('embark')&&phases.has('carrier-home'));assert.equal(c.report.arrival,true);}
});

test('opposite portal retains submerged wall, attributes and material groups',()=>{
 const s=new THREE.Group(),geometry=new THREE.CylinderGeometry(34,13,30,64,4,true).toNonIndexed();geometry.clearGroups();geometry.addGroup(0,geometry.attributes.position.count/2,0);geometry.addGroup(geometry.attributes.position.count/2,geometry.attributes.position.count/2,1);
 const wall=new THREE.Mesh(geometry,[new THREE.MeshBasicMaterial(),new THREE.MeshBasicMaterial()]);wall.name='swamp-sinkhole-wall';wall.position.y=25;s.add(wall);s.userData.tiger=new THREE.Group();s.userData.tiger.tigerRoam={};s.userData.tiger.userData.tigerRoam={drink:new THREE.Vector3(26,25,0)};
 const shell=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({side:THREE.BackSide}));shell.userData.isOutline=true;shell.raycast=()=>{};wall.add(shell);
 const originalMin=geometry.attributes.position.array.filter((_,i)=>i%3===1).reduce((a,b)=>Math.min(a,b),Infinity),landing=installSwampOppositeLanding(s);
 assert.equal(shell.geometry,wall.geometry,'visible non-raycast toon shell must expose the same stair opening');
 assert.equal(landing.surfaces.length,18);assert.ok(wall.geometry.groups.length<=geometry.groups.length+1);assert.ok(wall.geometry.groups.some(g=>g.materialIndex===0)&&wall.geometry.groups.some(g=>g.materialIndex===1));assert.deepEqual(Object.keys(wall.geometry.attributes),Object.keys(geometry.attributes));
 const p=wall.geometry.attributes.position;let min=Infinity;for(let i=0;i<p.count;i++)min=Math.min(min,p.getY(i));assert.equal(min,originalMin);assert.notDeepEqual(p.array,geometry.attributes.position.array); 
});
