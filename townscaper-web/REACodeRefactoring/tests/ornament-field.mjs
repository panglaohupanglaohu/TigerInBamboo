import assert from 'node:assert/strict';import{bakeOrnamentField}from'../src/core/ornament-field.js';
const a=bakeOrnamentField(),b=bakeOrnamentField();assert.deepEqual(a,b);assert.equal(a.rgba.length,128*128*4);
for(let i=0;i<a.field.length;i++){assert(Number.isFinite(a.field[i])&&a.field[i]>=0);assert(Math.abs(a.rgba[i*4]/255*.25-Math.min(.25,a.field[i]))<=.25/510+1e-7);assert.equal(a.rgba[i*4+3],255)}
for(const n of [0,4,1024,NaN])assert.throws(()=>bakeOrnamentField(n),RangeError);console.log('PASS single canonical distance field, quantization, deterministic and bounded');
