import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from 'three';
import {createCitadelTrojanHorse} from '../../src/assets/citadelTrojanHorse.js';
const world=o=>{o.updateWorldMatrix(true,true);return o.getWorldPosition(new T.Vector3());};
function dispose(g){const gs=new Set(),ms=new Set(),ts=new Set();g.traverse(o=>{if(o.isMesh){gs.add(o.geometry);ms.add(o.material);if(o.material.map)ts.add(o.material.map);}});gs.forEach(o=>o.dispose());ms.forEach(o=>o.dispose());ts.forEach(o=>o.dispose());}
const names=['hip','stifle','hock','hoof'];
const sources=root=>{const result=[];root.traverse(o=>{if(o.isMesh)result.push(...(o.userData.materialSourceNames||[o.name]));});return result;};

test('hind silhouette has a buried hip, tucked stifle and one hock, with no extra exposed axle or thin link',()=>{
 const g=createCitadelTrojanHorse(),rig=g.userData.articulation;
 for(const id of ['hindLeft','hindRight']){const chain=rig.joints[id];assert.deepEqual(Object.keys(chain),names);assert.equal(chain.knee,chain.stifle);for(let i=1;i<names.length;i++)assert.equal(chain[names[i]].parent,chain[names[i-1]]);
  assert.ok(world(chain.stifle).y>3.2,'stifle is contained by the lower haunch instead of dangling below the belly');assert.ok(world(chain.stifle).z>world(chain.hip).z);assert.ok(world(chain.hock).z<world(chain.stifle).z);assert.ok(world(chain.hoof).z>world(chain.hock).z);
  const rendered=sources(chain.hip);for(const obsolete of ['functional-hip-bearing','hind-gold-bearing','hind-timber-bone'])assert.ok(!rendered.includes(obsolete));assert.ok(rendered.includes('continuous-powerful-hind-thigh'));assert.ok(rendered.includes('solid-hind-shin'));assert.ok(rendered.includes('single-wood-hock'));
 }
 for(const id of ['foreLeft','foreRight'])assert.ok(world(rig.joints[id].hoof).y>3);
 g.traverse(o=>{if(o.isMesh){assert.equal(o.material.metalness,0);assert.ok(o.material.roughness>=.8);assert.ok(o.material.map?.isDataTexture);}});dispose(g);
});

test('pose sampling retains bone lengths and real timber overlap across every downstream joint',()=>{
 const g=createCitadelTrojanHorse(),rig=g.userData.articulation,records=[];let overlapRays=0;
 for(const id of ['hindLeft','hindRight']){const chain=rig.joints[id],lengths=names.slice(1).map((name,i)=>world(chain[name]).distanceTo(world(chain[names[i]])));
  for(const angle of[-.5,-.25,0,.25,.5]){rig.reset();rig.setJoint(id,'hip',angle);rig.setJoint(id,'stifle',-angle*.8);rig.setJoint(id,'hock',angle*.6);rig.setJoint(id,'hoof',-angle*.3);g.updateMatrixWorld(true);
   for(let i=1;i<names.length;i++){const joint=chain[names[i]],parent=chain[names[i-1]],centre=world(joint);assert.ok(Math.abs(centre.distanceTo(world(parent))-lengths[i-1])<1e-8);
    // Only each rigid link's own meshes may close the seam. Recursing into
    // children here would let a disconnected parent falsely pass the test.
    for(const owner of[parent,joint])for(const axis of [new T.Vector3(1,0,0),new T.Vector3(-1,0,0),new T.Vector3(0,1,0),new T.Vector3(0,0,1)]){const origin=centre.clone().addScaledVector(axis,.8),hit=new T.Raycaster(origin,axis.clone().negate(),0,.8).intersectObjects(owner.children.filter(o=>o.isMesh),false)[0];assert.ok(hit,`${id}/${names[i]} ${owner.name} has an open timber seam at ${angle}`);overlapRays++;}
   }
   records.push({id,angle,pivots:Object.fromEntries(names.map(n=>[n,world(chain[n]).toArray()]))});
  }
 }
 rig.reset();assert.equal(overlapRays,240);const bbox=new T.Box3().setFromObject(g);assert.ok(bbox.min.y>=-.01);assert.ok(bbox.max.x<3&&bbox.min.x> -3);assert.ok(bbox.max.y<8.5);assert.ok(bbox.max.z<5&&bbox.min.z> -4);
 if(process.env.TROJAN_HIND_CHAIN_REPORT)fs.writeFileSync(process.env.TROJAN_HIND_CHAIN_REPORT,JSON.stringify({source:g.userData.sourceId,canonicalChain:names,kneeAlias:true,woodMaterial:true,overlapRays,records,bounds:{min:bbox.min.toArray(),max:bbox.max.toArray()},hatchHeight:2.46,locomotionImplemented:rig.locomotionImplemented,gpuVerified:false},null,2));dispose(g);
});
