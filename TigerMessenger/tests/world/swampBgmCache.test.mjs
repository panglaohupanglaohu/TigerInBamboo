import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
// Execute the production module body, injecting only audio and Three imports.
// No browser audio, saved state or production function is replaced/rewritten.
const calls=[],slot=Symbol.for('swamp-bgm-cache-test');
globalThis[slot]={THREE,setSwampBgm:active=>calls.push(active)};
const source=readFileSync(new URL('../../src/scenes/messenger/swampBgm.js',import.meta.url),'utf8')
 .replace('import * as THREE from "three";','const THREE=globalThis[Symbol.for("swamp-bgm-cache-test")].THREE;')
 .replace('import { setSwampBgm } from "../../audio/sfx.js";','const setSwampBgm=globalThis[Symbol.for("swamp-bgm-cache-test")].setSwampBgm;');
const {createSwampBgmState,tickSwampBgm}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
function fixture(){const scene=new THREE.Scene(),swamp=new THREE.Group(),parent=new THREE.Group();swamp.userData.kind='moebius-swamp';parent.add(swamp);scene.add(parent);let scans=0;const traverse=scene.traverse;scene.traverse=function(fn){scans++;return traverse.call(this,fn);};return{scene,swamp,parent,get scans(){return scans;}};}
const player=(x=0,y=20,z=0)=>({position:new THREE.Vector3(x,y,z)});
test('same attached lake scans once across 1000 ticks, every tick retains audio request',()=>{const f=fixture(),s=createSwampBgmState(),start=calls.length;for(let i=0;i<1000;i++)tickSwampBgm(s,f.scene,player());assert.equal(f.scans,1);assert.equal(calls.length-start,1000);assert(calls.slice(start).every(Boolean));});
test('entry / exit hysteresis and ceiling remain identical',()=>{const f=fixture(),s=createSwampBgmState(),start=calls.length;for(const p of[player(34),player(32),player(35),player(38),player(0,29),player(0,27),player(0,33),player(0,35),null])tickSwampBgm(s,f.scene,p);assert.deepEqual(calls.slice(start),[false,true,true,false,false,true,true,false,false]);});
test('scene replacement, removed root, same-count nested replacement, and late root work',()=>{const f=fixture(),g=fixture(),s=createSwampBgmState();tickSwampBgm(s,f.scene,player());g.swamp.position.x=100;tickSwampBgm(s,g.scene,player());assert.equal(s.inside,false);assert.equal(g.scans,1);g.parent.remove(g.swamp);tickSwampBgm(s,g.scene,player());assert.equal(s.inside,false);const late=new THREE.Group();late.userData.kind='moebius-swamp';g.parent.add(late);tickSwampBgm(s,g.scene,player());assert.equal(s.inside,true);assert.equal(g.scans,3);g.parent.remove(late);const replacement=new THREE.Group();replacement.userData.kind='moebius-swamp';replacement.position.x=100;g.parent.add(replacement);tickSwampBgm(s,g.scene,player());assert.equal(s.inside,false);assert.equal(g.scans,4);});
test('no player does not scan; moved cached root uses current transform; independent state',()=>{const f=fixture(),s=createSwampBgmState();tickSwampBgm(s,f.scene,null);assert.equal(f.scans,0);tickSwampBgm(s,f.scene,player());f.swamp.position.x=100;tickSwampBgm(s,f.scene,player());assert.equal(s.inside,false);assert.equal(f.scans,1);tickSwampBgm(createSwampBgmState(),f.scene,player());assert.equal(f.scans,2);});
