import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {parseLearningDeclaration} from '../src/scene-authoring/learning-declaration.js';
import {buildCapabilityEvolution,postTime,evolutionFingerprint} from '../../townscaper-web/REACodeRefactoring/src/core/capability-evolution.js';
import {scanCodeLibrary} from '../tools/refactor/scan-code-library.mjs';import {buildCodeCatalog} from '../src/system-workshop/code-library-catalog.js';
const source='townscaper-web/REACodeRefactoring/learn/';
const read=(p,name)=>parseLearningDeclaration(fs.readFileSync(source+p,'utf8'),name);
const learn=read('data.js','LEARN'),pipeline=read('pipeline.js','PIPELINE');
test('all posts preserve evidence and are sorted by exact author time, never study round or scan time',()=>{
 const model=buildCapabilityEvolution(learn,pipeline);assert.equal(model.counts.posts,learn.items.length);assert.equal(new Set(model.events.map(e=>e.id)).size,learn.items.length);
 assert.equal(model.counts.dateConflicts,4);assert.equal(postTime('1768627849529893109'),'2024-03-15T13:18:33.501Z');assert.equal(postTime('not-a-post'),null);
 assert.ok(model.events.every((e,i)=>!i||model.events[i-1].publishedAt<=e.publishedAt));
 for(const e of model.events){const original=learn.items.find(x=>x.id===e.id);assert.equal(e.recordedDate,original.date);assert.equal(e.status,original.status);assert.deepEqual(e.reviewStages,original.reviewStages);assert.ok(e.families.length);}
 const wrong=model.events.find(e=>e.id==='837027901853810688');assert.equal(wrong.date,'2017-03-01');assert.equal(wrong.recordedDate,'2018-06-18');assert.equal(wrong.dateConflict,true);
 assert.match(model.events.find(e=>e.id==='768886648625061889').projectLabel,/早期/);assert.equal(model.counts.validRelations,model.counts.relations);
});
test('same-post explanations and cross-project combinations remain distinct from scoped replacements',()=>{
 const m=buildCapabilityEvolution(learn,pipeline);const related=(a,b)=>m.relations.find(e=>e.fromId===a&&e.toId===b);
 assert.equal(related('1332410042784641026','1579483114178768898').type,'combines');
 assert.equal(related('793545297376972801','1579483114178768898').type,'combines');
 assert.equal(related('1664565063552847873','1666429884208381953').type,'alternative');
 assert.equal(related('1704218784028905984','1705195380457996629').type,'supersedes');
 assert.equal(related('1991099314714902634','1991101097818403263').type,'explains');
 assert.equal(m.relations.filter(e=>e.type==='supersedes').length,3);
 assert.ok(!m.relations.some(e=>e.fromId==='784847933686575104'&&e.toId==='1768627849529893109'));
});
test('changed source invalidates only dependent interpretation and changes shared fingerprint',async()=>{
 const before=buildCapabilityEvolution(learn,pipeline),next=structuredClone(learn);next.items.find(e=>e.id==='1705195380457996629').text+=' changed';
 const after=buildCapabilityEvolution(next,pipeline);const edge=after.relations.find(e=>e.toId==='1705195380457996629');assert.equal(edge.valid,false);assert.ok(after.issues.some(e=>e.type==='relation-evidence-changed'));assert.notEqual(await evolutionFingerprint(before),await evolutionFingerprint(after));
 const bad=structuredClone(pipeline);bad.evolution.relations.push(bad.evolution.relations[0]);assert.throws(()=>buildCapabilityEvolution(learn,bad),/重复/);
 const reversed=structuredClone(pipeline),e=reversed.evolution.relations.find(r=>r.type==='supersedes');[e.fromId,e.toId]=[e.toId,e.fromId];assert.throws(()=>buildCapabilityEvolution(learn,reversed),/后续/);
});
test('physical scan and catalog carry the same evolution fingerprint without promoting executable status',async()=>{
 const manifest=await scanCodeLibrary(),catalog=buildCodeCatalog(manifest);assert.equal(manifest.evolution.fingerprint,await evolutionFingerprint(buildCapabilityEvolution(learn,pipeline)));assert.equal(catalog.evolution.fingerprint,manifest.evolution.fingerprint);
 const nodes=catalog.workshops.flatMap(w=>w.domains.flatMap(d=>d.nodes)),shore=nodes.find(n=>n.module.path==='src/water/shore.js');assert.equal(shore.date,'2025-11-19');assert.ok(shore.module.evolution.clips.includes('1991101097818403263'));assert.equal(shore.exec,'library');assert.equal(shore.code.length,0);assert.ok(catalog.combinations.find(c=>c.id==='library-combination:water').evolutionClips.includes('1991101097818403263'));
 const noSource=nodes.find(n=>!n.module.evolution.clips.length);assert.equal(noSource.date,null);assert.equal(manifest.evolutionSources.length,2);
});
test('every partial has a current priority and explicit work, but newer evidence cannot inherit stale annotations',()=>{
 const m=buildCapabilityEvolution(learn,pipeline),partials=m.events.filter(e=>e.status==='partial');assert.equal(partials.length,m.counts.partial);assert.ok(partials.length>0);/* 上游学习任务会把 partial 推进为 done，数量不写死 */assert.ok(partials.every(e=>e.completion.current&&['高','中','低'].includes(e.completion.priority)&&e.completion.acceptance&&e.completion.nextAction));assert.equal(m.counts.priorityCounts['高']+m.counts.priorityCounts['中']+m.counts.priorityCounts['低'],partials.length);assert.equal(m.counts.priorityCounts['待复核']+m.counts.priorityCounts['待评估'],0);
 const next=structuredClone(learn);const probe=partials[0].id;next.items.find(e=>e.id===probe).note+=' new implementation';const changed=buildCapabilityEvolution(next,pipeline).events.find(e=>e.id===probe);assert.equal(changed.completion.current,false);assert.equal(changed.completion.priority,'待复核');
 assert.equal(m.events.find(e=>e.id==='1768627849529893109').phase,'sphere');assert.equal(m.events.find(e=>e.id==='784847933686575104').phase,'early');assert.equal(m.events.find(e=>e.id==='1991101097818403263').phase,'next');assert.equal(m.phases.reduce((n,p)=>n+p.posts,0),m.events.length);
});
