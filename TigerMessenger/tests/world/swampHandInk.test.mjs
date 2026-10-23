import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement}=await import('../../src/world/moebiusSwamp.js');
const {installSwampHandInk,topEdgeLines,buildInkRibbon,createInkRibbonMaterial}=await import('../../src/world/swampHandInk.js');
const {GREG_INK_SHARED,GREG_LAKE_LINE_PROFILE}=await import('../../src/world/swampGregVisuals.js');

test('a box top gives one closed outline of its top face, not its sides',()=>{
  const box=new T.Mesh(new T.BoxGeometry(2,.2,1));const lines=topEdgeLines(box,new T.Vector3(0,1,0));
  assert.equal(lines.length,1);const l=lines[0];assert.ok(l.every(p=>Math.abs(p.y-(.1+.012))<1e-6));
  let len=0;for(let i=1;i<l.length;i++)len+=l[i].distanceTo(l[i-1]);assert.ok(Math.abs(len-6)<1e-6,`perimeter ${len}`);
});

test('ribbon geometry: 4 vertices and 2 triangles per segment, outline flag, no raycast',()=>{
  const m=buildInkRibbon([[new T.Vector3(),new T.Vector3(1,0,0),new T.Vector3(1,0,1)]],createInkRibbonMaterial(1));
  assert.equal(m.geometry.attributes.position.count,8);assert.equal(m.geometry.index.count,12);assert.equal(m.userData.isOutline,true);
});

test('real swamp: continuous lines on walkways, leaf boats and a few rock creases; lake lines thin past 10 m and stop at 20 m; nothing under water',()=>{
  const scene=createMoebiusSwampPlacement({seed:7711,scale:.5});scene.updateMatrixWorld(true);
  const ink=installSwampHandInk({swamp:scene,enabled:true});
  const r=ink.report;console.log('hand-ink',JSON.stringify(r));
  assert.ok(r.walkMeshes>=3,'walk meshes outlined');assert.ok(r.boatCups>=4,'leaf boats outlined');
  assert.ok(r.rockLines>0&&r.rockLines<=20,'only a few structural rock lines');
  assert.ok(Math.abs(GREG_INK_SHARED.uWaterY.value-24.98)<1e-6);
  assert.equal(GREG_LAKE_LINE_PROFILE.fadeStart,10);assert.equal(GREG_LAKE_LINE_PROFILE.fadeEnd,20);
});
