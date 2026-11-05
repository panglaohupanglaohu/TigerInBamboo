import assert from 'node:assert/strict';
import {buildFrontier,frontierClearance,sampleFrontierBezier} from '../src/core/frontier.js';
import {generateCampaign} from '../src/campaign/campaign.js';
let success=0,failed=[];
for(let seed=0;seed<32;seed++)for(const position of [-8,0,8]){
 const c=generateCampaign({seed}),before=JSON.stringify(c.nodes),f=buildFrontier(c.nodes,{position});assert.equal(JSON.stringify(c.nodes),before);
 if(!f.ok){failed.push({seed,position,reason:f.reason});continue}
 success++;assert.deepEqual(f.path[0],f.from);assert.deepEqual(f.path.at(-1),f.to);
 for(let i=1;i<f.path.length;i++)assert(frontierClearance(f.path[i-1],f.path[i],c.nodes)>=.02-1e-8);
 for(let i=1;i<f.edgePath.length;i++){const a=f.edges[f.edgePath[i-1]],b=f.edges[f.edgePath[i]];assert(f.triangles.some(t=>[a.a,a.b,b.a,b.b].every(v=>t.includes(v))))}
 if(seed===0)assert.deepEqual(f,buildFrontier(c.nodes,{position}));
}
assert(success>80,'must generate broadly, explicit failure remains allowed');
const nodes=[{x:-1,y:0,r:.5},{x:1,y:0,r:.5}],budget=buildFrontier(nodes,{maxVisits:0});assert.equal(budget.ok,false);assert.equal(budget.reason,'budget');assert.deepEqual(budget.path,[]);
assert.throws(()=>buildFrontier(nodes,{clearance:2}),RangeError);
console.log('PASS padded triangle edge routes, rendered Bezier clearance, deterministic and bounded',{success,failed});

const rounded=sampleFrontierBezier([{x:-1,y:0},{x:0,y:0},{x:0,y:1}],[{x:-.1,y:.1,r:.05}]);
assert(rounded.corners[0].fraction<.25,'tight corner must reduce rounding to preserve clearance');
for(let i=1;i<rounded.path.length;i++)assert(frontierClearance(rounded.path[i-1],rounded.path[i],[{x:-.1,y:.1,r:.05}])>=.02-1e-9);
assert.throws(()=>sampleFrontierBezier([],[]),RangeError);
assert.throws(()=>sampleFrontierBezier([{x:0,y:0},{x:1,y:1}],[],{samples:100000}),RangeError);
assert.throws(()=>sampleFrontierBezier([{x:-1,y:0},{x:1,y:0}],[{x:0,y:0,r:.1}]),/unsafe/);
console.log('PASS adaptive Bezier corner and unsafe/public budget validation');
