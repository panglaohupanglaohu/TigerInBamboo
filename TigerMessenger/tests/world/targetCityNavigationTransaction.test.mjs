import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createTargetCityPlayerSupport} from '../../src/world/citadel/targetCityPlayerSupport.js';
import {createTargetCityPlayerNavigation} from '../../src/world/citadel/targetCityPlayerNavigation.js';
function fixture(){
 const castle=new T.Group();castle.position.y=160;
 const root=new T.Group(),material=new T.MeshBasicMaterial({side:T.DoubleSide});
 const old=new T.BoxGeometry(4,1,4),next=new T.BoxGeometry(4,5,4),terrain=new T.Mesh(old,material);terrain.position.y=-.5;castle.add(root,terrain);
 const provider=createTargetCityPlayerSupport({castle,candidateRoot:root,finalTerrain:[terrain]});
 const runtime={root,report:{installed:true},getPlayerSupport:()=>provider};
 const nav=createTargetCityPlayerNavigation({runtime,castle,finalTerrain:[terrain]});
 return{castle,root,terrain,old,next,provider,nav,close(){nav.dispose();provider.dispose();old.dispose();next.dispose();material.dispose();}};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-5,`${a} != ${b}`);
test('real support and airborne fallback change together and rollback restores old query geometry before owner restores mesh',()=>{
 const f=fixture(),revision=f.provider.report().revision,b=f.nav.prepareTerrainRefresh();
 near(f.nav.terrainGround(new T.Vector3(0,168,0)),160);f.terrain.geometry=f.next;
 // Mere mesh replacement must not masquerade as refreshed cached queries.
 near(f.nav.terrainGround(new T.Vector3(0,168,0)),160);
 b.commit();near(f.nav.terrainGround(new T.Vector3(0,168,0)),162);near(f.nav.ground(new T.Vector3(0,162.1,0)),162);
 let p=new T.Vector3(3.5,160.1,0),q=new T.Vector3(1.5,160.1,0),v=new T.Vector3(-1,0,0);
 assert.equal(f.nav.walls(p,q,v),true);
 b.rollback();assert.equal(f.terrain.geometry,f.next);near(f.nav.terrainGround(new T.Vector3(0,168,0)),160);near(f.nav.ground(new T.Vector3(0,160.1,0)),160);
 assert.equal(f.nav.walls(p,new T.Vector3(1.5,160.1,0),v),false);assert.equal(f.provider.report().revision,revision);
 f.terrain.geometry=f.old;b.rollback();assert.throws(()=>b.commit(),/not prepared/);f.close();
});
test('fallback build failure after support commit rolls both caches back without disposing borrowed support',()=>{
 const f=fixture(),revision=f.provider.report().revision,b=f.nav.prepareTerrainRefresh(),original=f.next.computeBoundingBox;
 let calls=0;f.next.computeBoundingBox=function(){if(++calls===2)throw Error('fallback index build failure');return original.call(this);};f.terrain.geometry=f.next;
 assert.throws(()=>b.commit(),/fallback index build failure/);assert.equal(f.provider.report().revision,revision);near(f.nav.ground(new T.Vector3(0,160.1,0)),160);near(f.nav.terrainGround(new T.Vector3(0,168,0)),160);
 b.rollback();assert.equal(f.provider.report().disposed,false);f.next.computeBoundingBox=original;f.terrain.geometry=f.old;f.close();
});
test('intervening explicit refresh rejects stale prepared or committed bindings',()=>{
 const f=fixture(),b=f.nav.prepareTerrainRefresh();f.nav.refresh();assert.throws(()=>b.commit(),/cache changed/);b.rollback();
 const c=f.nav.prepareTerrainRefresh();c.commit();f.provider.refresh();assert.throws(()=>c.rollback(),/cache changed after commit/);f.close();
});
test('support option validation failure restores previous roots and cache',()=>{
 const f=fixture(),revision=f.provider.report().revision,b=f.provider.prepareRefresh({candidateRoot:new T.Group()});
 assert.throws(()=>b.commit(),/belong to castle/);assert.equal(f.provider.report().revision,revision);near(f.provider.ground(new T.Vector3(0,160.1,0)),160);f.provider.refresh();near(f.provider.ground(new T.Vector3(0,160.1,0)),160);f.close();
});
