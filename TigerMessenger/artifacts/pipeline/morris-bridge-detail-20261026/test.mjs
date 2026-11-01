import assert from 'node:assert/strict';
import * as T from 'three';
import {dressMorrisBridge}from'../../../src/world/morrisLandscapeDetails.js';
const checks=[];function check(name,f){f();checks.push(name);}
for(const crown of[.25,.75])for(const slope of[0,.06,-.08,-.2390293]){
 const bridge=new T.Group(),deckY=z=>slope*z+crown*Math.cos(z/4*Math.PI/2),old=new T.Mesh(new T.BoxGeometry(.4,.3,8),new T.MeshStandardMaterial());old.name='bridge-low-stone-parapet';bridge.add(old);
 const position=new T.Vector3(8,2,32);bridge.position.copy(position);const quaternion=bridge.quaternion.clone(),report=dressMorrisBridge({bridge,deckY});bridge.updateWorldMatrix(true,true);
 const meshes=bridge.children.filter(x=>x.isMesh),localHits=(origin,direction,far=30)=>{const ray=new T.Raycaster(new T.Vector3(...origin).add(position),new T.Vector3(...direction),0,far);return ray.intersectObjects(meshes,false);};
 check('finite closed bridge details crown '+crown+' slope '+slope,()=>{for(const m of meshes)for(const n of m.geometry.attributes.position.array)assert.ok(Number.isFinite(n));assert.ok(report.closedArchCore&&report.continuousCoping);});
 check('original center orientation and eight metre envelope '+slope,()=>{assert.ok(bridge.position.equals(position)&&bridge.quaternion.equals(quaternion));const b=new T.Box3().setFromObject(bridge);assert.ok(b.min.z>=position.z-4.001&&b.max.z<=position.z+4.001);});
 check('whole3.2m walking corridor clear above unchanged deck '+slope,()=>{for(let z=-3.9;z<=3.9;z+=.3)for(const x of[-1.59,0,1.59])assert.equal(localHits([x,deckY(z)+.2,z],[0,1,0],2).length,0);});
 check('central underpass really open to stream '+slope,()=>{for(const z of[-1,0,1])assert.equal(localHits([-3,-1.2,z],[1,0,0],6).length,0);});
 check('continuous thick coping and solid guard walls '+slope,()=>{for(let z=-3.9;z<=3.9;z+=.2)for(const side of[-1,1]){assert.ok(localHits([side*1.8,deckY(z)+2,z],[0,-1,0],2).length>0);assert.ok(localHits([0,deckY(z)+.3,z],[side,0,0],3).length>0);}});
 check('limited shared static detail batches '+slope,()=>assert.ok(report.mergedStoneBatches<=6&&report.archStones===52));
 check('crown-linked arch thickness stays positive '+slope,()=>{assert.ok(Math.abs(report.deckCrown-crown)<1e-8);assert.ok(Math.abs(report.archRise-(1.58+Math.max(0,crown-.25)))<1e-8);assert.ok(report.minimumCoreThickness>.4);});
 check('repeat call replaces only own details '+slope,()=>{const count=bridge.children.length;dressMorrisBridge({bridge,deckY});assert.equal(bridge.children.length,count);});
}
console.log(JSON.stringify({passed:checks.length,checks},null,2));
