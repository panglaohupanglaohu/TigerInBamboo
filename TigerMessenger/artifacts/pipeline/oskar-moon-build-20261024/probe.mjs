import assert from 'node:assert/strict';
import * as T from '../../../vendor/three.module.js';
import {createMoonLakeGarden} from '../../../src/world/moonLakeGarden.js';
import {createMoonLakeCompanionPine} from '../../../src/assets/moonLakePineCompanions.js';
const parent=new T.Group(),original=new T.Group();original.name='original-pine-sentinel';original.position.set(9.3,-.45,1.5);parent.add(original);parent.position.set(16,159,-4);parent.rotation.z=.12;
const before=original.matrix.clone(),g=createMoonLakeGarden(parent);assert.deepEqual(g.report.sites.map(s=>s.id),[2,4,5,6]);assert.equal(g.report.rejected.length,0);assert.equal(g.colliders.length,4);assert.ok(g.report.sites.every(s=>s.pathGap>.7));
const signatures=[];for(const role of ['lean','spread','windswept','arching']){const m=createMoonLakeCompanionPine({role});signatures.push(JSON.stringify(m.report.trunk));m.dispose();}assert.equal(new Set(signatures).size,4);
const refs=[...g.colliders],oldY=g.trees.map(t=>t.position.y),sphere=(x,z)=>Math.sqrt(160.6**2-x*x-z*z)-160.78;
const seated=g.reseat((x,z)=>sphere(x,z)+2);assert.deepEqual(seated.seated,[2,4,5,6]);assert.equal(seated.rejected.length,0);assert.equal(seated.missingGroundVertices,0);
for(let i=0;i<4;i++){assert.equal(g.colliders[i],refs[i]);assert.ok(Math.abs(g.trees[i].position.y-oldY[i]-2)<1e-9);const p=g.trees[i].localToWorld(new T.Vector3(0,.65,0));assert.ok(p.distanceTo(refs[i].position)<1e-9);}
const y=g.trees.map(t=>t.position.y);g.reseat((x,z)=>sphere(x,z)+2);assert.deepEqual(g.trees.map(t=>t.position.y),y);const rejected=g.reseat(()=>null);assert.equal(rejected.rejected.length,4);assert.deepEqual(g.trees.map(t=>t.position.y),y);
assert.ok(original.parent===parent);assert.deepEqual(original.position.toArray(),[9.3,-.45,1.5]);assert.ok(original.matrix.equals(before));
console.log(JSON.stringify({ok:true,modelsDistinct:true,siteIds:[2,4,5,6],rootRingGaps:g.report.sites.map(s=>s.pathGap),draws:g.report.draws,triangles:g.report.triangles,groundcover:g.report.groundcover.length,reseat:seated,repeatedReseatIdempotent:true,nullSurfaceRejectsWithoutTeleport:true,colliderReferencesStable:true,originalPreserved:true}));
g.dispose();g.dispose();assert.deepEqual(parent.children,[original]);console.log('dispose restores original parent; double dispose safe');
