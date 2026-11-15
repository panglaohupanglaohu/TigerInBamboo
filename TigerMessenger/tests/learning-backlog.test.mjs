import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {reconcileBacklog} from '../src/scene-authoring/learning-backlog.js';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const liveProgress=read('../../townscaper-web/REACodeRefactoring/learn/coverage-progress.json');
const liveCoverage=read('../../townscaper-web/REACodeRefactoring/learn/coverage.json');
const ledger=read('../src/scene-authoring/catalog/learning-backlog-review.json');
// Historical audit fixture must not use today's mutable array indices.
const progress={next:ledger.items.flatMap(i=>i.records).sort((a,b)=>a.originalIndex-b.originalIndex)};
const coverage={modules:ledger.items.flatMap(i=>i.evidence).map(e=>({source:e.module,evidence:e.path,status:e.status,gap:e.gap,frameReview:true}))};
test('all 113 records accounted, duplicate histories consolidated, closure evidence retained',async()=>{
 const r=await reconcileBacklog(progress,coverage,ledger);
 assert.equal(r.rawCount,113);assert.equal(r.items.length,106);assert.equal(r.merged,7);assert.equal(r.closed.length,6);assert.equal(r.active.length,100);
 assert.equal(r.items.flatMap(x=>x.records).length,113);
 assert.equal(Object.values(r.counts).reduce((a,b)=>a+b),100);
 assert.ok(r.closed.every(x=>x.reason));
});
test('reordering preserves reviewed identities and states',async()=>{
 const a=await reconcileBacklog(progress,coverage,ledger),b=await reconcileBacklog({...progress,next:[...progress.next].reverse()},coverage,ledger);
 assert.deepEqual(a.counts,b.counts);assert.deepEqual(a.items.map(x=>[x.id,x.state]).sort(),b.items.map(x=>[x.id,x.state]).sort());
});
test('new or changed titles never inherit a closure from clip IDs',async()=>{
 const next=[{...progress.next[2],title:'new unresolved problem'}];const r=await reconcileBacklog({next},coverage,ledger);
 assert.equal(r.closed.length,0);assert.equal(r.counts.review,1);
});
test('changed evidence reopens a historical closure',async()=>{
 const c=structuredClone(coverage);c.modules.find(m=>m.source==='src/wake.js').gap='new unresolved condition';
 const r=await reconcileBacklog({next:[progress.next[75]]},c,ledger);
 assert.equal(r.closed.length,0);assert.equal(r.counts.review,1);
});
test('missing ledger keeps every entry visible and requires review',async()=>{
 const r=await reconcileBacklog(progress,coverage,null);assert.equal(r.closed.length,0);assert.equal(r.counts.review,113);
});
test('same clip with distinct deliverables is not collapsed',async()=>{
 const r=await reconcileBacklog({next:[progress.next[0],progress.next[39]]},coverage,ledger);assert.equal(r.active.length,2);
});
test('superseded DDA implementation is not scheduled twice',async()=>{
 const r=await reconcileBacklog({next:[progress.next[92],progress.next[93]]},coverage,ledger);assert.equal(r.active.length,1);assert.match(r.active[0].reason,/太阳DDA已补/);
});

test('live source may evolve without dropping records or reusing historical positions',async()=>{
 const r=await reconcileBacklog(liveProgress,liveCoverage,ledger);assert.equal(r.rawCount,liveProgress.next.length);assert.equal(r.items.flatMap(i=>i.records).length,liveProgress.next.length);
 assert.deepEqual(r.items.flatMap(i=>i.records).map(r=>r.title).sort(),liveProgress.next.map(r=>r.title).sort());
 assert.equal(Object.values(r.counts).reduce((a,b)=>a+b,0)+r.closed.length,r.items.length);
});
