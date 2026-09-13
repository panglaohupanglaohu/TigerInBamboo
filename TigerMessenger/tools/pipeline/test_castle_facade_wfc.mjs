import assert from 'node:assert/strict';
import {solveCastleFacade} from '../../src/world/citadel/castleFacadeWfc.js';
const hashes=new Set();
for(let rows=1;rows<=5;rows++)for(let seed=0;seed<20;seed++){
 const a=solveCastleFacade({rows,seed});assert.deepEqual(a,solveCastleFacade({rows,seed}));hashes.add(a.solutionHash);
 for(const row of a.grid){assert(row[0].startsWith('stone'));assert(row[2].startsWith('stone'));assert(['arch','slit'].includes(row[1]));}
 assert.equal(a.grid[0][1],'arch');
}
assert(hashes.size>10);
assert.throws(()=>solveCastleFacade({rows:3,seed:1,extraPins:[{cell:'r:0:0',variant:'arch@r0'}]}),/contradiction/);
console.log('PASS: 100 deterministic layouts, aligned openings, solid corners, seed variation, impossible boundary.');
