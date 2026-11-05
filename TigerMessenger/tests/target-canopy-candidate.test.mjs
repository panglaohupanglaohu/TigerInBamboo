import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createTargetCanopyNode,runTargetCanopyCandidate} from '../tools/scene-authoring/target_canopy_candidate.mjs';
const target={scene:'morris-lake',id:'fixture:canopy-A',revision:'sha256:'+'a'.repeat(64),part:'canopy'};
const inputs={format:'canopy.blobs.v1',blobs:[{x:0,y:2,z:0,r:1.6},{x:1.2,y:2.4,z:0,r:1.2}]};
const node=()=>createTargetCanopyNode({targetRef:target,inputs,params:{resolution:10,passes:2}});
test('actual fixed REA source executes a detached reproducible candidate with exact source revision',async()=>{
 const n=await node(),before=structuredClone({n,target,inputs}),a=await runTargetCanopyCandidate(n,{liveTargetRef:target}),b=await runTargetCanopyCandidate(n,{liveTargetRef:target});
 const source=await readFile('townscaper-web/REACodeRefactoring/src/core/canopy.js','utf8');
 assert.equal(a.capabilityRef.revision,'sha256:'+createHash('sha256').update(source).digest('hex'));
 assert.equal(a.geometry.stats.extraction,'surface-nets');assert.ok(a.checks.vertices>0);assert.ok(a.checks.closedEdges);assert.equal(a.geometryFingerprint,b.geometryFingerprint);assert.equal(a.canApplyToScene,false);assert.equal(a.status,'detached-candidate');assert.deepEqual({n,target,inputs},before);
});
test('node target binding remains fixed and refuses another selected object or stale revision',async()=>{
 const n=await node();await assert.rejects(runTargetCanopyCandidate(n,{liveTargetRef:{...target,id:'fixture:canopy-B'}}),/拒绝/);await assert.rejects(runTargetCanopyCandidate(n,{liveTargetRef:{...target,revision:'sha256:'+'b'.repeat(64)}}),/拒绝/);assert.equal(n.targetRef.id,target.id);
});
test('raw leaf cards, region input and session UUID cannot masquerade as compatible canopy targets',async()=>{
 await assert.rejects(createTargetCanopyNode({targetRef:target,inputs:{format:'mesh.leaf-cards.v1',blobs:inputs.blobs}}),/球团输入适配/);
 await assert.rejects(createTargetCanopyNode({targetRef:{...target,part:'region'},inputs}),/树冠部位/);
 await assert.rejects(createTargetCanopyNode({targetRef:{...target,id:'runtime-mesh:temporary'},inputs}),/稳定对象ID/);
});
test('tampered payload, algorithm identity, writeSet or params reject before execution',async()=>{
 for(const mutate of [n=>n.inputs.blobs[0].r=2,n=>n.params.passes=4,n=>n.capabilityRef.module='other.js',n=>n.writeSet.objectId='fixture:canopy-B']){const n=await node();mutate(n);await assert.rejects(runTargetCanopyCandidate(n,{liveTargetRef:target}),/节点绑定/);}
});
test('invalid or overbudget algorithm inputs reject, and JSON roundtrip preserves execution',async()=>{
 for(const params of [{resolution:48},{passes:30},{unknown:true},{softStiff:NaN}])await assert.rejects(createTargetCanopyNode({targetRef:target,inputs,params}));
 await assert.rejects(createTargetCanopyNode({targetRef:target,inputs:{...inputs,blobs:[{x:0,y:0,z:0,r:0}]}}),/半径/);
 const n=JSON.parse(JSON.stringify(await node())),a=await runTargetCanopyCandidate(n,{liveTargetRef:target});assert.equal(a.writeSet.objectId,target.id);
});
