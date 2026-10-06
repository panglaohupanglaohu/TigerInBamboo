import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
// Execute the actual main-loop function without booting DOM/WebGL. Reproduces
// the parked messenger / remote train case that made citadel captures unstable.
const main=fs.readFileSync(new URL('../../src/main.js',import.meta.url),'utf8');
const start=main.indexOf('function updateMoebiusBarrier(dt) {');
const end=main.indexOf('// ---------- 阿狸',start);
assert.ok(start>=0&&end>start);
function fixture(v5=false){
 const sky=new THREE.Color('#80c9eb'),sunColor=new THREE.Color('#fff8e8');
 const ctx={THREE,targetCityInspection:{active:false},camera:{position:new THREE.Vector3(0,180,0)},player:{position:new THREE.Vector3(0,170,0)},messenger:{landmarks:{tramSystem:{tram:{position:new THREE.Vector3(0,-170,0)}}}},moebiusFactor:0,MOEBIUS_SKY:new THREE.Color(0xebb9b6),MOEBIUS_SUN:new THREE.Color(0xf0c294),scene:{background:sky.clone(),fog:{color:sky.clone()}},sun:{color:sunColor.clone()},ambient:{color:new THREE.Color('white')},skyMat:null,lastFactor:null};
 ctx.lightingDirector={isEnabled:()=>v5,setMoebiusFactor:f=>ctx.lastFactor=f};
 ctx.dayNight={getCurrent:()=>({skyMid:sky,sunColor})};
 vm.createContext(ctx);vm.runInContext(main.slice(start,end),ctx);
 ctx.advance=n=>{for(let i=0;i<n;i++){ctx.sun.color.copy(sunColor);ctx.scene.background.copy(sky);ctx.updateMoebiusBarrier(1/60);}};
 return ctx;
}
test('remote southern train does not recolour stationary northern messenger',()=>{
 const f=fixture();f.advance(240);assert.equal(f.moebiusFactor,0);assert.equal(f.ambient.color.getHex(),0xffffff);assert.equal(f.sun.color.getHex(),0xfff8e8);
});
test('messenger entering southern region fades tint, returning restores ambient colour',()=>{
 const f=fixture();f.player.position.y=-160;f.messenger.landmarks.tramSystem.tram.position.y=160;f.advance(360);
 assert.ok(f.moebiusFactor>.94);assert.notEqual(f.ambient.color.getHex(),0xffffff);
 f.player.position.y=160;f.advance(960);assert.ok(f.moebiusFactor<.001);assert.equal(f.ambient.color.getHex(),0xffffff);assert.equal(f.sun.color.getHex(),0xfff8e8);
});
test('V5 receives observer blend and owns its own light colours',()=>{
 const f=fixture(true);f.ambient.color.set('#123456');f.advance(120);assert.equal(f.lastFactor,0);assert.equal(f.ambient.color.getHex(),0x123456);
 f.player.position.y=-160;f.advance(240);assert.ok(f.lastFactor>.8);assert.equal(f.ambient.color.getHex(),0x123456);
});

test('manual northern review uses camera region, returning follows unmoved messenger',()=>{
 const f=fixture();f.player.position.y=-160;f.targetCityInspection.active=true;f.advance(240);
 assert.equal(f.moebiusFactor,0);assert.equal(f.ambient.color.getHex(),0xffffff);
 assert.equal(f.player.position.y,-160);f.targetCityInspection.active=false;f.advance(360);assert.ok(f.moebiusFactor>.94);
});
