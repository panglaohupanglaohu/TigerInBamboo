import assert from'node:assert/strict';import * as T from'three';import{createMorrisTerrain,installMorrisLandscape}from'../../../src/world/morrisLandscape.js';
const edge=a=>22*Math.sqrt(7)*(1+.055*Math.sin(a*3+.7)+.028*Math.cos(a*7)),terrain=createMorrisTerrain(160,edge),root=new T.Group(),land=installMorrisLandscape({root,terrain,heightAt:terrain.height,R:160});root.updateMatrixWorld(true);
const bridge=land.bridge,q=bridge.quaternion.clone(),origin=bridge.position.clone(),g=land.deck.geometry.attributes.position,checks=[];function check(n,f){f();checks.push(n);}
const deckY=z=>{const i=Math.max(0,Math.min(23,Math.floor((z+4)*3))),t=(z+4)*3-i;return T.MathUtils.lerp(g.getY(i*2),g.getY((i+1)*2),t);};
const rayHits=(p,d,far)=>new T.Raycaster(bridge.localToWorld(new T.Vector3(...p)),new T.Vector3(...d).applyQuaternion(q),0,far).intersectObjects(bridge.children.filter(x=>x.isMesh&&x!==land.deck),false);
check('production bridge location remains existing route crossing',()=>{assert.ok(Math.hypot(origin.x-terrain.route.bridge.x,origin.z-terrain.route.bridge.z)<1e-8);assert.equal(land.report.bridgeDetail.revision,'continuous-arch-r3');});
check('production bridge deck unaltered 24x2 strips',()=>assert.equal(g.count,50));
check('actual production deck walking clearance3.2m',()=>{for(let z=-3.8;z<=3.8;z+=.25)for(const x of[-1.59,0,1.59])assert.equal(rayHits([x,deckY(z)+.20,z],[0,1,0],2).length,0);});
check('production stream water level has genuine transverse arch opening',()=>{for(const z of[-1,0,1])assert.equal(rayHits([-3,-1.18,z],[1,0,0],6).length,0);});
check('production detail envelope preserves8m length',()=>{for(const m of bridge.children.filter(x=>x.userData.morrisBridgeDetail)){m.geometry.computeBoundingBox();assert.ok(m.geometry.boundingBox.min.z>=-4.001&&m.geometry.boundingBox.max.z<=4.001);}});
console.log(JSON.stringify({passed:checks.length,checks,report:land.report.bridgeDetail,bridgePosition:origin.toArray(),deckEndpoints:[g.getY(0),g.getY(48)]},null,2));
