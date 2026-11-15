import {test} from 'node:test';import assert from 'node:assert/strict';
import {runGscenePlan,matchGscene} from '../src/system-workshop/gscene/capabilities.js';
import {verifyGscene} from '../src/system-workshop/gscene/verify.js';
import {hexToOklab,deltaE} from '../../townscaper-web/REACodeRefactoring/src/core/oklab.js';
const M=['#334466','#668899','#bc9765','#a15e77','#eeeecc','#428245'].map((color,i)=>({id:'m'+i,name:'mat'+i,color,base:color,uses:i+1}));
const steps=[{id:'scene.oklab-palette',params:{colors:3,maxDelta:5,strength:.7}},{id:'scene.oklab-contrast',params:{gain:1.25,maxDelta:4}}];
test('two real source-backed adapters change materials on a copy, keep actual output within color budget',()=>{
 const input=structuredClone(M),r=runGscenePlan(M,steps);assert.deepEqual(M,input);assert.ok(Object.keys(r.colors).length>0);
 for(const [id,color]of Object.entries(r.colors))assert.ok(deltaE(hexToOklab(M.find(m=>m.id===id).color),hexToOklab(color))<=9.00001);
 const v=verifyGscene(M,r.colors,{steps:r.report});assert.notEqual(v.status,'fail',JSON.stringify(v));assert.equal(v.checks.find(c=>c.id==='delta').status,'pass');
});
test('all material adapters preserve manual colors by default; explicit opt-in works',()=>{
 const rows=M.map(m=>({...m,locked:true}));const r=runGscenePlan(rows,steps);assert.deepEqual(r.colors,{});assert.ok(matchGscene(rows).every(r=>r.count===0));
 const out=runGscenePlan(rows,[{id:'scene.oklab-contrast',params:{gain:1.25,includeEdited:true}}]);assert.ok(Object.keys(out.colors).length);assert.equal(verifyGscene(rows,out.colors,{steps:out.report}).checks.find(c=>c.id==='manual').status,'pass');
});
test('verifier rejects forged locked edits and perceptual budget excess independently',()=>{
 const rows=M.map(m=>({...m,locked:true}));assert.equal(verifyGscene(rows,{m0:'#ffffff'},{steps}).checks.find(c=>c.id==='manual').status,'fail');
 assert.equal(verifyGscene(M,{m0:'#ffffff'},{steps:[{params:{maxDelta:1}}]}).checks.find(c=>c.id==='delta').status,'fail');
});
test('reordered inputs produce identical deterministic palette results',()=>{
 const a=runGscenePlan(M,steps),b=runGscenePlan([...M].reverse(),steps);assert.deepEqual(a.colors,b.colors);
});
test('neutral gain is a no-op, malformed params and invalid output are rejected',()=>{
 assert.deepEqual(runGscenePlan(M,[{id:'scene.oklab-contrast',params:{gain:1}}]).colors,{});
 assert.throws(()=>runGscenePlan(M,[{id:'scene.oklab-contrast',params:{gain:'bad'}}]),/无效参数/);
 assert.throws(()=>runGscenePlan(M,[{id:'scene.oklab-contrast',params:{includeEdited:'false'}}]),/无效开关/);
 assert.equal(verifyGscene(M,{m0:'invalid'}).status,'fail');
});
test('gamut extremes are finite and quantized output obeys the tightest budget',()=>{
 const rows=['#ff0000','#00ff00','#0000ff','#ffffff','#000000'].map((color,i)=>({id:'p'+i,color,uses:1}));
 for(const id of ['scene.oklab-contrast','scene.oklab-palette']){const r=runGscenePlan(rows,[{id,params:{maxDelta:1,gain:1.4,strength:1,colors:2}}]);for(const [key,color]of Object.entries(r.colors)){assert.match(color,/^#[0-9a-f]{6}$/);assert.ok(deltaE(hexToOklab(rows.find(m=>m.id===key).color),hexToOklab(color))<=1.00001);}}
});
