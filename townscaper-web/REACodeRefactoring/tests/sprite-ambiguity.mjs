import assert from 'node:assert/strict';import{measureAmbiguity,chooseSpriteFlip}from'../src/core/sprite-ambiguity.js';
const make=(w,h,points)=>{const data=new Uint8ClampedArray(w*h*4);for(const[x,y,r=255,g=r,b=r,a=255]of points)data.set([r,g,b,a],(y*w+x)*4);return {width:w,height:h,data}};
const sym=make(5,2,[[1,0],[3,0],[2,1]]),a=measureAmbiguity(sym);assert.equal(a.mirrorIoU,1);assert.equal(a.flipDiff,0);assert.equal(a.massSkew,0);
const off=measureAmbiguity(make(5,2,[[0,0],[1,0]]));assert.ok(off.mirrorIoU<1&&off.massSkew>0);assert.equal(measureAmbiguity(make(5,2,[])).empty,true);
const alpha=measureAmbiguity(make(3,1,[[0,0,255,255,255,128],[2,0,255,255,255,255]]));assert.equal(alpha.mirrorIoU,1);assert.ok(alpha.flipDiff>0&&alpha.massSkew>0,'partial alpha is really premultiplied');
assert.equal(measureAmbiguity(make(4,1,[[0,0],[2,0]]),{pivotX:1}).mirrorIoU,1);assert.throws(()=>measureAmbiguity(sym,{pivotX:1.1}));
const right={x:1,z:0};assert.equal(chooseSpriteFlip({x:1,z:0},right,true),false);assert.equal(chooseSpriteFlip({x:-1,z:0},right,false),true);assert.equal(chooseSpriteFlip({x:.01,z:1},right,true),true);assert.equal(chooseSpriteFlip({x:0,z:0},right,true),true);
console.log('PASS pivot/alpha metrics, empty/invalid data, screen facing and hysteresis');
