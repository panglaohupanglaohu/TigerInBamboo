import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createTargetCityPlayerSupport} from '../../src/world/citadel/targetCityPlayerSupport.js';
import {createTargetNewCityMain} from '../../src/world/citadel/targetNewCityMain.js';
import {createTargetOldCity} from '../../src/world/citadel/targetOldCity.js';
import {createTargetCityBayBridge} from '../../src/world/citadel/targetCityBayBridge.js';
import {createTargetNewCityStairRoute} from '../../src/world/citadel/targetNewCityStairRoute.js';

function setup(){
 const castle=new T.Group();castle.position.set(0,10000,0);const root=new T.Group(),terrain=new T.Mesh(new T.BoxGeometry(250,1,250),new T.MeshBasicMaterial());terrain.position.y=-1;terrain.name='explicit-final-terrain';castle.add(root,terrain);const owned=[];
 const provider=createTargetCityPlayerSupport({castle,candidateRoot:root,finalTerrain:terrain});
 function add(a,position=[0,0,0]){a.group.position.fromArray(position);root.add(a.group);owned.push(a);provider.refresh();return a;}
 function p(x,y,z){castle.updateWorldMatrix(true,true);return new T.Vector3(x,y,z).applyMatrix4(castle.matrixWorld);}
 function move(a,b){const previous=p(...a),position=p(...b),velocity=position.clone().sub(previous).normalize();const blocked=provider.walls(previous,position,velocity);return{blocked,previous,position,velocity,contact:provider.report().lastWall};}
 return{castle,root,terrain,provider,add,p,move,close(){provider.dispose();owned.forEach(a=>a.dispose());terrain.geometry.dispose();terrain.material.dispose();}};
}
const near=(a,b,t=.003)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);

test('actual new-city nave and old-city gate remain open while their masonry stops a swept standing body',()=>{
 const f=setup();const main=f.add(createTargetNewCityMain());
 for(const x of[-1.8,0,1.8]){assert.equal(f.move([x,1.2,7.2],[x,1.2,4.8]).blocked,false);assert.equal(f.move([x,1.2,-6.5],[x,1.2,-8]).blocked,false);near(f.provider.ground(f.p(x,1.3,6)),f.p(x,1.2,6).length());}
 const blocked=f.move([3.6,1.2,7.2],[3.6,1.2,4.8]);assert.equal(blocked.blocked,true);assert.ok(blocked.position.z>6.6);assert.ok(blocked.velocity.length()<.001);assert.equal(blocked.contact.reason,'geometry-contact');
 main.group.visible=false;const old=f.add(createTargetOldCity());for(const x of[-1.6,0,1.6])assert.equal(f.move([x,.3,17],[x,.3,14]).blocked,false);assert.equal(f.move([3,.3,17],[3,.3,14]).blocked,true);near(f.provider.ground(f.p(0,.4,14)),f.p(0,.3,14).length());f.close();
});

test('ground casts only near feet and refuses roofs/private terraces even when standing above them',()=>{
 const f=setup(),a=f.add(createTargetNewCityMain());near(f.provider.ground(f.p(0,1.3,0)),f.p(0,1.2,0).length());assert.equal(f.provider.ground(f.p(8.05,14.3,.5)),null,'blue tower roof must never be a public support');assert.equal(f.provider.ground(f.p(0,23.3,-1.4)),null,'dome must never attract the player');assert.equal(f.provider.ground(f.p(0,-2,0)),null,'a floor well above the step limit cannot snap feet upwards');a.group.visible=false;
 const old=f.add(createTargetOldCity());const h=old.report.houses.find(h=>h.terrace);assert.equal(f.provider.ground(f.p(h.position[0],h.terrace.topY+.1,h.position[2]+1.75)),null,'private roof terrace excluded');f.close();
});

test('bridge real deck supports feet, its rails stop outward motion, surveyed stairs support ascending/descending steps',()=>{
 const f=setup(),bridge=f.add(createTargetCityBayBridge({path:[[-20,4,0],[20,4,0]],maxSpan:36,groundHeightAt:()=>-1,oceanHeightAt:()=>0}));
 for(const x of[-18,-9,0,9,18])near(f.provider.ground(f.p(x,4.1,0)),f.p(x,4,0).length());assert.equal(f.move([-3,4,0],[3,4,0]).blocked,false);assert.equal(f.move([0,4,0],[0,4,3]).blocked,true);
 bridge.group.visible=false;const stairs=f.add(createTargetNewCityStairRoute({sampleSurface:()=>({height:0}),start:[63.38,13.2,40.43]}));const treads=stairs.report.selected.treads;assert.ok(treads.length>20);
 for(const tread of treads.filter((_,i)=>i%4===0)){const x=tread.polygon.reduce((n,p)=>n+p[0],0)/tread.polygon.length,z=tread.polygon.reduce((n,p)=>n+p[1],0)/tread.polygon.length;near(f.provider.ground(f.p(x,tread.top+.1,z)),f.p(x,tread.top,z).length(),.02);}
 for(let i=2;i<Math.min(12,treads.length);i++){const a=treads[i-1],b=treads[i],center=t=>[t.polygon.reduce((n,p)=>n+p[0],0)/t.polygon.length,t.top,t.polygon.reduce((n,p)=>n+p[1],0)/t.polygon.length];assert.equal(f.move(center(a),center(b)).blocked,false,'legal stair risers are not standing walls');}f.close();
});

test('hidden source ancestors, detached WFC assets and old scene siblings cannot provide support or collision',()=>{
 const f=setup(),a=f.add(createTargetNewCityMain()),original=f.p(0,1.3,0);a.group.visible=false;near(f.provider.ground(original),f.p(0,-.5,0).length());assert.equal(f.move([3.6,1.2,7.2],[3.6,1.2,4.8]).blocked,false);
 a.group.visible=true;near(f.provider.ground(original),f.p(0,1.2,0).length());a.group.removeFromParent();near(f.provider.ground(original),f.p(0,-.5,0).length());
 const legacy=createTargetNewCityMain();f.castle.add(legacy.group);f.provider.refresh();near(f.provider.ground(original),f.p(0,-.5,0).length());legacy.dispose();
 const next=f.add(createTargetNewCityMain());near(f.provider.ground(original),f.p(0,1.2,0).length());assert.ok(f.provider.report().revision>=3);f.close();
});

test('geometry-backed queries support instances and mirrored faces without altering source materials; disposal leaves assets owned by caller',()=>{
 const f=setup(),geometry=new T.BoxGeometry(3,1,3),material=new T.MeshBasicMaterial({side:T.BackSide}),instance=new T.InstancedMesh(geometry,material,2);instance.name='test-platform';instance.userData.targetWalkable=true;instance.setMatrixAt(0,new T.Matrix4().makeTranslation(0,2,0));instance.setMatrixAt(1,new T.Matrix4().makeTranslation(6,3,0));f.root.add(instance);f.provider.refresh();
 near(f.provider.ground(f.p(0,2.6,0)),f.p(0,2.5,0).length());near(f.provider.ground(f.p(6,3.6,0)),f.p(6,3.5,0).length());assert.equal(material.side,T.BackSide);
 let disposed=0;geometry.addEventListener('dispose',()=>disposed++);f.provider.dispose();f.provider.dispose();assert.equal(disposed,0);assert.equal(instance.parent,f.root);assert.equal(f.provider.ground(f.p(0,2.6,0)),null);assert.equal(f.provider.report().productionInstalled,false);geometry.dispose();material.dispose();f.close();
});

test('frozen r17 castle transform and actual final mountain triangles return world radii at both city portals and terrain',async()=>{
 const {applyTargetTerrainCandidate}=await import('../../src/world/citadel/targetTerrainCandidate.js'),{createTargetStairSurfaceSampler}=await import('../../src/world/citadel/targetNewCityStairRoute.js');
 const castle=new T.Group();castle.matrixAutoUpdate=false;castle.matrix.fromArray([-.5771265090244172,.12463062405961449,.807088718870361,0,.6354855835814281,.689249750214348,.3479839865419536,0,-.5129162364767383,.7137240288626759,-.4769852670498,0,124.43456408079132,72.61606956254715,90.15650671642375,1]);
 const terrain=new T.Mesh(new T.BoxGeometry(),new T.MeshBasicMaterial({side:T.DoubleSide}));terrain.name='citadel-oskar-grid-mountain-surface';castle.add(terrain);const location=globalThis.location;globalThis.location={search:'?citadelTerrainFirst=1&citadelTargetRemesh=1&citadelTerraceAprons=1&citadelRecessedSaddle=1&citadelValleyBenches=1'};
 try{const obsolete=terrain.geometry;applyTargetTerrainCandidate(castle);obsolete.dispose();}finally{if(location===undefined)delete globalThis.location;else globalThis.location=location;}
 const root=new T.Group(),main=createTargetNewCityMain(),old=createTargetOldCity();castle.add(root);root.add(main.group,old.group);main.group.position.set(74,12,33);main.group.rotation.y=-55*Math.PI/180;old.group.position.set(-55,17,9);old.group.rotation.y=Math.PI/4;castle.updateWorldMatrix(true,true);
 const provider=createTargetCityPlayerSupport({castle,candidateRoot:root,finalTerrain:terrain});
 for(const [asset,local]of[[main,[0,1.2,4]],[old,[0,.3,14.5]]]){const surface=new T.Vector3(...local).applyMatrix4(asset.group.matrixWorld),feet=surface.clone().addScaledVector(surface.clone().normalize(),.1);near(provider.ground(feet),surface.length(),.005);}
 const sample=createTargetStairSurfaceSampler(castle,[terrain]);for(const[x,z]of[[-75,10],[87,25],[58,83]]){const sampled=sample(x,z);assert.ok(sampled);const surface=new T.Vector3(x,sampled.height,z).applyMatrix4(castle.matrixWorld),feet=surface.clone().addScaledVector(surface.clone().normalize(),.1);near(provider.ground(feet),surface.length(),.02);}
 assert.equal(provider.report().terrainInstances,1);assert.equal(provider.report().navigationComplete,false);provider.dispose();main.dispose();old.dispose();terrain.geometry.dispose();terrain.material.dispose();
});

test('refresh reads replacement transforms and newly restored hidden meshes; invalid inputs and sweep budget are explicit',()=>{
 const f=setup(),a=createTargetNewCityMain();a.group.visible=false;f.add(a);assert.equal(f.move([3.6,1.2,7.2],[3.6,1.2,4.8]).blocked,false);a.group.visible=true;assert.equal(f.move([3.6,1.2,7.2],[3.6,1.2,4.8]).blocked,true);
 a.group.position.x=30;f.provider.refresh();assert.equal(f.move([3.6,1.2,7.2],[3.6,1.2,4.8]).blocked,false);assert.equal(f.move([33.6,1.2,7.2],[33.6,1.2,4.8]).blocked,true);
 const move=f.move([0,1,0],[20,1,0]);assert.equal(move.blocked,true);assert.equal(move.contact.reason,'sweep-budget-exceeded');assert.deepEqual(move.previous.toArray(),move.position.toArray());assert.equal(f.provider.ground(new T.Vector3(NaN,1,0)),null);f.close();
 assert.throws(()=>createTargetCityPlayerSupport({castle:new T.Group(),candidateRoot:new T.Group(),finalTerrain:new T.Group()}),/belong/);
});
