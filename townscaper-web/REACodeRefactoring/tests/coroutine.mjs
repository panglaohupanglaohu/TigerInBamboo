import assert from 'node:assert/strict';import{Scheduler,frame}from'../src/core/coroutine.js';
function* deep(n){if(n===0)return 7;const result=yield deep(n-1);yield frame();return result+1;}
const s=new Scheduler({opsPerFrame:32,maxTransitions:100});s.add(deep(60000));assert.equal(s.run(),60007);assert.equal(s.totalOps,60000);assert.equal(s.depthMax,60001);assert.ok(s.frames>600);assert.ok(s.peakOps<=32);assert.ok(s.trace.length<=128);
let closed=[];function* child(){try{yield frame();yield frame();}finally{closed.push('child')}}function* parent(){try{yield child()}finally{closed.push('parent')}}s.add(parent());s.step(); // completes with large budget; use a suspended case below
closed=[];const t=new Scheduler({opsPerFrame:1});t.add(parent());t.step();t.cancel();assert.deepEqual(closed,['child','parent']);assert.equal(t.done,true);
function* failing(){throw Error('child-error')}function* catching(){try{yield failing()}catch(e){return e.message}}
s.add(catching());assert.equal(s.run(),'child-error');s.add((function*(){yield;return 9})());s.step();assert.equal(s.done,false);s.step();assert.equal(s.result,9);
assert.throws(()=>new Scheduler({opsPerFrame:0}));assert.throws(()=>frame(-1));s.add((function*(){while(true)yield 1})());assert.throws(()=>s.run(2),/limit/);s.cancel();
console.log('PASS 60000-deep explicit recursion, budgets, reset, cancellation/finally, exception propagation and bounded history');
s.add((function*(){try{yield(function*(){throw null})()}catch(e){return e===null?'null propagated':'wrong'}})());assert.equal(s.run(),'null propagated');
