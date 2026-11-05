import assert from 'node:assert/strict';import{cubeDirection,bakeCubeHeight}from'../src/core/cube-height.js';
assert.deepEqual(cubeDirection(0,0,0),[1,0,0]);assert.deepEqual(cubeDirection(2,0,0),[0,1,0]);
const data=bakeCubeHeight(([x,y,z])=>.5+.1*x+.15*y+.2*z);assert.equal(data.samples,1536);assert.equal(data.faces.length,6);assert(data.faces.every(f=>f.length===16*16*4));
for(let f=0;f<6;f++)for(let y=0;y<16;y++)for(let x=0;x<16;x++){const p=cubeDirection(f,2*(x+.5)/16-1,2*(y+.5)/16-1),value=.5+.1*p[0]+.15*p[1]+.2*p[2];assert(Math.abs(data.faces[f][(y*16+x)*4]/255-value)<=.5/255+1e-12)}
assert.deepEqual(bakeCubeHeight(()=>2).faces[0].slice(0,4),new Uint8Array([255,255,255,255]));assert.throws(()=>bakeCubeHeight(()=>NaN),RangeError);assert.throws(()=>bakeCubeHeight(()=>0,{size:1000}),RangeError);console.log('PASS cube directions, sample counts, quantization, clamp and validation');
