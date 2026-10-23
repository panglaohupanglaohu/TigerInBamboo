import test from 'node:test';
import assert from 'node:assert/strict';
import {TIGER_WALK as G,tigerStrideLength,sampleTigerWalk as sample} from '../../src/assets/characters/tigerCoralGait.js';

test('four beat walk keeps original duty cycle, stride and one touch-down per quarter cycle',()=>{
 assert.deepEqual(G.phaseOffsets,[.25,.75,0,.5]);assert.equal(G.stanceFraction,.65);
 for(const scale of [.2,.4,.8])assert.equal(tigerStrideLength(scale),2*.95*scale/.65);
 const touchdowns=[];
 for(let foot=0;foot<4;foot++)touchdowns.push((1-G.phaseOffsets[foot])%1);
 assert.deepEqual(touchdowns.sort(),[0,.25,.5,.75]);
 for(let i=0;i<1000;i++){const feet=[0,1,2,3].map(f=>sample(i/1000,f));assert.ok(feet.filter(f=>f.stance).length>=2);}
});

test('release and touch-down are continuous in position and horizontal/vertical velocity',()=>{
 const h=1e-6,expected=-2*G.reach/G.stanceFraction;
 for(let foot=0;foot<4;foot++)for(const edge of [G.stanceFraction,1]){
  const phase=edge-G.phaseOffsets[foot],a=sample(phase-h,foot),b=sample(phase,foot),c=sample(phase+h,foot);
  assert.ok(Math.abs((b.travel-a.travel)/h-expected)<1e-4);
  assert.ok(Math.abs((c.travel-b.travel)/h-expected)<1e-4);
  assert.ok(Math.abs((b.swing-a.swing)/h)<1e-3);assert.ok(Math.abs((c.swing-b.swing)/h)<1e-3);
 }
});

test('stance soles cancel forward travel, swing clears then reaches forward with bounded release extension',()=>{
 const extrema={min:Infinity,max:-Infinity},h=.00001;
 for(let i=0;i<10000;i++){
  const p=i/10000,a=sample(p,0);extrema.min=Math.min(extrema.min,a.travel);extrema.max=Math.max(extrema.max,a.travel);
  if(a.stance&&sample(p+h,0).stance){const b=sample(p+h,0);assert.ok(Math.abs((b.travel-a.travel)+h*2*G.reach/G.stanceFraction)<1e-10);assert.equal(a.swing,0);}
  assert.ok(a.swing>=0&&a.swing<=1);
 }
 const mid=G.stanceFraction+(1-G.stanceFraction)/2-G.phaseOffsets[0];assert.ok(Math.abs(sample(mid,0).swing-1)<1e-12);
 assert.ok(extrema.min> -1.08&&extrema.max<1.08,'release follows ground velocity briefly without a large reach change');
 for(let foot=0;foot<4;foot++)assert.deepEqual({...sample(.71,foot,false),phase:0},{phase:0,swing:0,travel:0,stance:true});
 console.log('swing trajectory range',extrema);
});
