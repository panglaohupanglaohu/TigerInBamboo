import assert from 'node:assert/strict';
import {compileVariants} from '../../src/procgen/wfc/socketCompiler.js';
import {compileCompatibilityTable,compileSidePairCompatibilityTable} from '../../src/procgen/wfc/compatibilityTable.js';
import {TOWN_MODULE_PROTOTYPES} from '../../src/world/citadel/townModulePrototypes.js';
const compiled=compileVariants(TOWN_MODULE_PROTOTYPES),old=compileCompatibilityTable(compiled);
const opposite={N:'S',E:'W',S:'N',W:'E',U:'D',D:'U'};
const pairs=Object.entries(opposite).map(([a,b])=>({direction:`pair:${a}:${b}`,sourceSide:a,targetSide:b}));
pairs.push({direction:'pair:E:E',sourceSide:'E',targetSide:'E'});
const next=compileSidePairCompatibilityTable(compiled,pairs);let checked=0;
for(let a=0;a<compiled.variants.length;a++)for(let b=0;b<compiled.variants.length;b++){
 for(const dir of old.directions){assert.equal(next.isCompatible(a,`pair:${dir}:${opposite[dir]}`,b),old.isCompatible(a,dir,b));checked++;}
 assert.equal(next.isCompatible(a,'pair:E:E',b),next.isCompatible(b,'pair:E:E',a));
}
assert.throws(()=>compileSidePairCompatibilityTable(compiled,[pairs[0]]),/reverse/);
assert.throws(()=>compileSidePairCompatibilityTable(compiled,[{direction:'x',sourceSide:'X',targetSide:'E'}]),/invalid/);
assert.throws(()=>compileSidePairCompatibilityTable(compiled,[pairs[0],{...pairs[0],targetSide:'E'}]),/conflicting/);
console.log('SIDE_PAIR_COMPATIBILITY_OK',checked,'original directed variant pairs identical; local E:E transpose, invalid tokens rejected');
