import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
globalThis.location={search:''}; // raised town is the default
globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){},clearRect(){},fillText(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},measureText:()=>({width:10})})})};
const S=await import('../../src/world/bookshopTownSite.js');
const {installBookshopJakubPass}=await import('../../src/world/bookshopJakubPass.js');
test('raised town: plaza +5, coast and berth at old grade, rails stay off the checked exit deck',()=>{
  assert.equal(S.BOOKSHOP_RAISE,5);
  assert.equal(S.bookshopRaiseFlat(0,32),5);
  assert.equal(S.bookshopRaiseFlat(-70,60),0);
  assert.ok(S.bookshopRailRaiseFlat(94.8,45.6)<1e-6,'citadel crossing source deck stays on its authored height');
  assert.equal(S.bookshopRailRaiseFlat(-80,56),5,'freight loop bridge stays at town level');
});
test('raised Jakub pass builds the lower harbor, terrace and relief without throwing',()=>{
  const R=160,scene=new T.Scene(),root=new T.Group();root.name='bookshop-steampunk-robots';
  const pose=S.bookshopTownPose(R);root.position.copy(pose.position);root.quaternion.copy(pose.quaternion);scene.add(root);
  const shop=new T.Group();shop.add(new T.Mesh(new T.BoxGeometry(6,6,6)));shop.userData.townSite={};S.placeBookshopTown(shop,R);scene.add(shop);
  scene.updateMatrixWorld(true);const colliders=[],platforms=[];
  const api=installBookshopJakubPass({scene,root,R,colliders,platforms,bookshop:shop});
  assert.ok(api.stats.viaductBays>100,'viaduct '+api.stats.viaductBays);
  assert.equal(api.stats.ship,1);assert.equal(api.stats.terrace,1);assert.ok(api.stats.cliffs>10,'cliffs '+api.stats.cliffs);
  assert.ok(platforms.some(p=>typeof p.topHeightAt==='function'),'stairs are walkable ramps');
  api.remove();assert.equal(platforms.length,0);assert.equal(colliders.length,0);
});
